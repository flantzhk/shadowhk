// ShadowSpeak API — Cloudflare Worker
//
// Handles Stripe webhook events and updates the user's subscription_status
// in Firestore. The frontend reads users/{uid}.subscription_status.
//
// Routes:
//   POST /stripe-webhook            — Stripe events
//   POST /create-checkout-session   — TODO: existing endpoint, not implemented here
//
// Required secrets (set via `wrangler secret put`):
//   STRIPE_WEBHOOK_SECRET           — whsec_... from Stripe dashboard
//   FIRESTORE_SERVICE_ACCOUNT_JSON  — full GCP service account JSON

import { getFirestore } from './firestore.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/stripe-webhook') {
      return handleStripeWebhook(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/create-checkout-session') {
      // TODO: port the existing create-checkout-session implementation here.
      // Out of scope for this task — the frontend already has a working endpoint.
      return new Response('Not implemented in this worker yet', { status: 501 });
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleStripeWebhook(request, env) {
  const signature = request.headers.get('Stripe-Signature');
  if (!signature) {
    return new Response('Missing Stripe-Signature header', { status: 400 });
  }

  // Stripe requires the raw body for signature verification.
  const rawBody = await request.text();

  let event;
  try {
    const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      return new Response('Invalid signature', { status: 400 });
    }
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    const firestore = getFirestore(env);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.client_reference_id;
        const customerId = session.customer;
        if (!uid) {
          console.warn('checkout.session.completed missing client_reference_id', session.id);
          break;
        }
        await firestore.updateDoc('users', uid, {
          subscription_status: 'pro',
          stripe_customer_id: customerId,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = sub.customer;
        const status = mapStripeStatus(sub.status);
        const uid = await findUidByCustomerId(firestore, customerId);
        if (!uid) {
          console.warn('No user found for customer', customerId);
          break;
        }
        await firestore.updateDoc('users', uid, { subscription_status: status });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer;
        const uid = await findUidByCustomerId(firestore, customerId);
        if (!uid) {
          console.warn('No user found for customer', customerId);
          break;
        }
        await firestore.updateDoc('users', uid, { subscription_status: 'free' });
        break;
      }

      default:
        // Unhandled event type — log and acknowledge.
        console.log('Unhandled Stripe event:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Internal error', { status: 500 });
  }
}

// Map Stripe subscription status -> our two-state model.
function mapStripeStatus(stripeStatus) {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'pro';
  // canceled, past_due, unpaid, incomplete_expired, incomplete -> free
  return 'free';
}

async function findUidByCustomerId(firestore, customerId) {
  const matches = await firestore.queryByField('users', 'stripe_customer_id', customerId);
  if (matches.length === 0) return null;
  // doc name is "projects/.../documents/users/{uid}" — extract the last segment.
  const name = matches[0].name;
  return name.split('/').pop();
}

// --- Stripe signature verification (Web Crypto) ---
//
// Stripe-Signature header format:
//   t=1492774577,v1=hex_signature,v1=other_hex,v0=...
// We HMAC-SHA256 over `${t}.${rawBody}` with the webhook secret and check
// for a constant-time match against any v1 entry. Default tolerance: 5 minutes.

const SIGNATURE_TOLERANCE_SECONDS = 300;

async function verifyStripeSignature(payload, header, secret) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');

  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    })
  );
  // Multiple v1 entries are possible (during secret rotation); split manually.
  const v1Signatures = header
    .split(',')
    .map((kv) => kv.trim())
    .filter((kv) => kv.startsWith('v1='))
    .map((kv) => kv.slice(3));

  const timestamp = parts.t;
  if (!timestamp || v1Signatures.length === 0) return false;

  // Replay protection.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = await hmacSha256Hex(secret, signedPayload);

  // Constant-time compare against each provided v1.
  return v1Signatures.some((sig) => constantTimeEqual(sig, expected));
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(sig);
}

function bufferToHex(buf) {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
