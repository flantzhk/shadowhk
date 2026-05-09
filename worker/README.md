# ShadowSpeak API Worker

Cloudflare Worker that handles Stripe webhooks and writes
`subscription_status` to `users/{uid}` in Firestore.

## Routes

- `POST /stripe-webhook` — Stripe events (signature verified)
- `POST /create-checkout-session` — TODO (existing endpoint, not yet ported)

Stripe events handled:

| Event                            | Action                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| `checkout.session.completed`     | Set `subscription_status = 'pro'`, store `stripe_customer_id`          |
| `customer.subscription.updated`  | Map Stripe status -> `'pro'` (active/trialing) or `'free'` (otherwise) |
| `customer.subscription.deleted`  | Set `subscription_status = 'free'`                                     |

## Setup

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Create the service account

In Google Cloud Console:

1. IAM & Admin > Service Accounts > Create Service Account
2. Grant it **Cloud Datastore User** (or `roles/datastore.user`)
3. Keys > Add Key > JSON. Download the file.

### 3. Set secrets

From `worker/`:

```bash
# whsec_... from Stripe Dashboard > Developers > Webhooks
wrangler secret put STRIPE_WEBHOOK_SECRET

# Paste the full service account JSON when prompted
wrangler secret put FIRESTORE_SERVICE_ACCOUNT_JSON
```

### 4. Deploy

```bash
wrangler deploy
```

The deploy URL will be something like
`https://shadowspeak-api.<your-subdomain>.workers.dev`.

### 5. Register the webhook in Stripe

Stripe Dashboard > Developers > Webhooks > Add endpoint:

- **URL:** `https://shadowspeak-api.<your-subdomain>.workers.dev/stripe-webhook`
- **Events:**
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy the resulting **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`
(step 3) if you didn't already.

## Local development

```bash
wrangler dev   # starts on http://localhost:8787
```

Forward live Stripe events to the local worker:

```bash
stripe listen --forward-to localhost:8787/stripe-webhook
```

`stripe listen` prints a temporary `whsec_...` for the CLI session. Use it in
a `.dev.vars` file at `worker/.dev.vars`:

```
STRIPE_WEBHOOK_SECRET=whsec_xxx_from_stripe_listen
FIRESTORE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

`wrangler dev` loads `.dev.vars` automatically. **Do not commit it.**

Trigger a test event in another terminal:

```bash
stripe trigger checkout.session.completed
```

## Notes / caveats

- `client_reference_id` must be set to the Firebase UID when creating the
  Stripe Checkout Session — that's how `checkout.session.completed` is mapped
  to the right user. Confirm the existing `/create-checkout-session` does this.
- Subscription update/delete events look up the user by `stripe_customer_id`.
  That field is written on first `checkout.session.completed`, so the very
  first event for a customer must be the checkout one (Stripe's normal order).
- The Firestore helper only encodes string/number/boolean/null/Date values.
  Extend `encodeValue` in `src/firestore.js` if you need arrays or maps.
- The OAuth access token is cached in the Worker isolate's memory. Cold
  starts will re-mint a JWT — fine, just adds ~100ms to that one request.
