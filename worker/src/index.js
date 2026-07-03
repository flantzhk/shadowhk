// ShadowSpeak API — Cloudflare Worker
//
// Routes:
//   POST /stripe-webhook            — Stripe events → Firestore
//   POST /create-checkout-session   — Create Stripe checkout session (authenticated)
//   POST /revenuecat-webhook        — RevenueCat IAP events (Apple IAP) → Firestore
//
// Required secrets (set via `wrangler secret put`):
//   STRIPE_WEBHOOK_SECRET           — whsec_... from Stripe dashboard
//   STRIPE_API_KEY                  — sk_live_... or sk_test_...
//   STRIPE_PRICE_ANNUAL             — price_... for HK$488/year subscription
//   STRIPE_PRICE_MONTHLY            — price_... for HK$68/month subscription
//   STRIPE_PRICE_LIFETIME           — price_... for HK$1488 one-time payment
//   FIRESTORE_SERVICE_ACCOUNT_JSON  — full GCP service account JSON
//   FIREBASE_PROJECT_ID             — e.g. "shadowspeak-abc12"
//   REVENUECAT_WEBHOOK_AUTH_HEADER  — shared secret set in RevenueCat dashboard

import { getFirestore } from './firestore.js';

const CORS_ORIGIN = 'https://flantzhk.github.io';
const APP_SUCCESS_URL = 'https://flantzhk.github.io/shadowhk/?checkout=success';
const APP_CANCEL_URL  = 'https://flantzhk.github.io/shadowhk/';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsPreflightResponse();
    }

    if (request.method === 'POST' && url.pathname === '/stripe-webhook') {
      return handleStripeWebhook(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/create-checkout-session') {
      return withCors(handleCreateCheckoutSession(request, env));
    }

    if (request.method === 'POST' && url.pathname === '/revenuecat-webhook') {
      return handleRevenueCatWebhook(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

// ── /create-checkout-session ──────────────────────────────────────────────────

async function handleCreateCheckoutSession(request, env) {
  // Verify Firebase ID token and extract uid.
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const idToken = authHeader.slice(7);

  let uid;
  try {
    uid = await verifyFirebaseToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    console.warn('Firebase token verification failed:', err.message);
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Parse planId from request body.
  let planId;
  try {
    const body = await request.json();
    planId = body?.planId;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Map planId to Stripe price and mode.
  const planConfig = getPlanConfig(planId, env);
  if (!planConfig) {
    return jsonResponse({ error: `Unknown plan: ${planId}` }, 400);
  }

  // Create Stripe checkout session.
  try {
    const session = await createStripeCheckoutSession(planConfig, uid, env.STRIPE_API_KEY);
    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    return jsonResponse({ error: 'Failed to create checkout session' }, 500);
  }
}

function getPlanConfig(planId, env) {
  switch (planId) {
    case 'annual':
      return {
        mode: 'subscription',
        priceId: env.STRIPE_PRICE_ANNUAL,
        trialDays: 7,
      };
    case 'monthly':
      return {
        mode: 'subscription',
        priceId: env.STRIPE_PRICE_MONTHLY,
        trialDays: 0,
      };
    case 'lifetime':
      return {
        mode: 'payment',
        priceId: env.STRIPE_PRICE_LIFETIME,
        trialDays: 0,
      };
    default:
      return null;
  }
}

async function createStripeCheckoutSession(planConfig, uid, stripeApiKey) {
  const params = new URLSearchParams({
    'payment_method_types[]': 'card',
    mode: planConfig.mode,
    'line_items[0][price]': planConfig.priceId,
    'line_items[0][quantity]': '1',
    client_reference_id: uid,
    success_url: APP_SUCCESS_URL,
    cancel_url: APP_CANCEL_URL,
  });

  if (planConfig.mode === 'subscription' && planConfig.trialDays > 0) {
    params.set('subscription_data[trial_period_days]', String(planConfig.trialDays));
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeApiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Stripe API ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── /revenuecat-webhook ───────────────────────────────────────────────────────

async function handleRevenueCatWebhook(request, env) {
  // RevenueCat sends a configurable Authorization header for security.
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!env.REVENUECAT_WEBHOOK_AUTH_HEADER || authHeader !== env.REVENUECAT_WEBHOOK_AUTH_HEADER) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = body?.event;
  if (!event) {
    return new Response('Missing event', { status: 400 });
  }

  // app_user_id is set to the Firebase UID when the app calls Purchases.logIn(uid).
  const uid = event.app_user_id;
  if (!uid) {
    console.warn('[RevenueCat] Missing app_user_id in event', event.type);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const status = mapRevenueCatStatus(event.type);
  if (status === null) {
    // No Firestore change needed for this event type.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  try {
    const firestore = getFirestore(env);
    await firestore.updateDoc('users', uid, {
      subscription_status: status,
      subscription_platform: 'apple',
    });
    console.log(`[RevenueCat] ${event.type} → ${uid} → ${status}`);
  } catch (err) {
    console.error('[RevenueCat] Firestore update failed:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Maps RevenueCat event types to our two-state model.
// Returns null for events that require no Firestore change.
function mapRevenueCatStatus(eventType) {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'NON_SUBSCRIPTION_PURCHASE': // lifetime purchase
    case 'UNCANCELLATION':
      return 'pro';
    case 'EXPIRATION':
      return 'free';
    // Cancellation = user canceled but still has access until period ends.
    // Billing issues = Stripe handles the final downgrade via subscription events.
    // These should NOT immediately downgrade — leave status as-is.
    case 'CANCELLATION':
    case 'BILLING_ISSUE':
    case 'PRODUCT_CHANGE':
    case 'SUBSCRIBER_ALIAS':
    case 'TRANSFER':
    default:
      return null;
  }
}

// ── /stripe-webhook ───────────────────────────────────────────────────────────

async function handleStripeWebhook(request, env) {
  const signature = request.headers.get('Stripe-Signature');
  if (!signature) {
    return new Response('Missing Stripe-Signature header', { status: 400 });
  }

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
          subscription_platform: 'stripe',
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

function mapStripeStatus(stripeStatus) {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'pro';
  return 'free';
}

async function findUidByCustomerId(firestore, customerId) {
  const matches = await firestore.queryByField('users', 'stripe_customer_id', customerId);
  if (matches.length === 0) return null;
  const name = matches[0].name;
  return name.split('/').pop();
}

// ── Firebase ID token verification (RS256, Web Crypto) ────────────────────────
//
// Firebase ID tokens are RS256-signed JWTs. Public keys are available as JWKs
// at Google's well-known endpoint. We cache them for the lifetime of the isolate.

const FIREBASE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cachedJwks = null;

async function verifyFirebaseToken(idToken, projectId) {
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID secret is not set');

  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));

  // Validate claims before touching crypto.
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('Token expired');
  if (payload.iat > now + 60) throw new Error('Token issued in the future');
  if (payload.aud !== projectId) throw new Error('Invalid audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Invalid issuer');
  if (!payload.sub) throw new Error('Missing sub claim');

  // Fetch JWKs (cached in module scope across requests in same isolate).
  if (!cachedJwks) {
    const res = await fetch(FIREBASE_JWK_URL);
    if (!res.ok) throw new Error('Failed to fetch Firebase JWKs');
    cachedJwks = await res.json();
  }

  const jwk = cachedJwks.keys?.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error(`No JWK found for kid ${header.kid}`);

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = base64UrlToBuffer(parts[2]);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    new TextEncoder().encode(signingInput)
  );

  if (!valid) throw new Error('Invalid JWT signature');

  return payload.sub; // Firebase UID
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    str.length + ((4 - (str.length % 4)) % 4), '='
  );
  return atob(padded);
}

function base64UrlToBuffer(str) {
  const binary = base64UrlDecode(str);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

// ── Stripe signature verification ─────────────────────────────────────────────

const SIGNATURE_TOLERANCE_SECONDS = 300;

async function verifyStripeSignature(payload, header, secret) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');

  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    })
  );
  const v1Signatures = header
    .split(',')
    .map((kv) => kv.trim())
    .filter((kv) => kv.startsWith('v1='))
    .map((kv) => kv.slice(3));

  const timestamp = parts.t;
  if (!timestamp || v1Signatures.length === 0) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = await hmacSha256Hex(secret, signedPayload);

  return v1Signatures.some((sig) => constantTimeEqual(sig, expected));
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(sig);
}

function bufferToHex(buf) {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// ── CORS helpers ──────────────────────────────────────────────────────────────

function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function withCors(responsePromise) {
  const response = await responsePromise;
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', CORS_ORIGIN);
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
