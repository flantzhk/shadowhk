// Firestore REST helper for Cloudflare Workers.
//
// Uses a Google service account to mint OAuth 2.0 access tokens via the
// JWT bearer flow. Caches the token in memory until 5 min before expiry.
//
// env.FIRESTORE_SERVICE_ACCOUNT_JSON — the full service account JSON string
// (the file you download from Google Cloud Console > IAM > Service Accounts).

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_REFRESH_BUFFER_SECONDS = 300; // refresh 5 min before expiry

// Module-scoped cache. A single Worker isolate may handle many requests;
// caching here avoids re-signing a JWT on every webhook.
let cachedToken = null; // { token, expiresAt, clientEmail }

export function getFirestore(env) {
  const sa = parseServiceAccount(env.FIRESTORE_SERVICE_ACCOUNT_JSON);
  const projectId = sa.project_id;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  async function authHeaders() {
    const token = await getAccessToken(sa);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  return {
    async getDoc(collection, docId) {
      const res = await fetch(`${baseUrl}/${collection}/${encodeURIComponent(docId)}`, {
        headers: await authHeaders(),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Firestore getDoc failed: ${res.status} ${await res.text()}`);
      return res.json();
    },

    // PATCH with updateMask so we don't overwrite unrelated fields.
    async updateDoc(collection, docId, data) {
      const fieldNames = Object.keys(data);
      const params = new URLSearchParams();
      for (const f of fieldNames) params.append('updateMask.fieldPaths', f);
      // currentDocument.exists not set => upsert behavior (create if missing).

      const url = `${baseUrl}/${collection}/${encodeURIComponent(docId)}?${params.toString()}`;
      const body = JSON.stringify({ fields: encodeFields(data) });
      const res = await fetch(url, {
        method: 'PATCH',
        headers: await authHeaders(),
        body,
      });
      if (!res.ok) {
        throw new Error(`Firestore updateDoc failed: ${res.status} ${await res.text()}`);
      }
      return res.json();
    },

    // Equality query on a single field. Returns array of document objects.
    async queryByField(collection, field, value) {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
      const body = JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: 'EQUAL',
              value: encodeValue(value),
            },
          },
          limit: 1,
        },
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: await authHeaders(),
        body,
      });
      if (!res.ok) {
        throw new Error(`Firestore queryByField failed: ${res.status} ${await res.text()}`);
      }
      const rows = await res.json();
      // runQuery returns an array of { document?, readTime }; filter empty rows.
      return rows.filter((r) => r.document).map((r) => r.document);
    },
  };
}

function parseServiceAccount(raw) {
  if (!raw) throw new Error('FIRESTORE_SERVICE_ACCOUNT_JSON is not set');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('FIRESTORE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (
    cachedToken &&
    cachedToken.clientEmail === sa.client_email &&
    cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_SECONDS > now
  ) {
    return cachedToken.token;
  }

  const jwt = await signServiceAccountJwt(sa);
  const params = new URLSearchParams();
  params.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.set('assertion', jwt);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in || 3600),
    clientEmail: sa.client_email,
  };
  return cachedToken.token;
}

async function signServiceAccountJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: FIRESTORE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encClaims = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encHeader}.${encClaims}`;

  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncodeBuffer(sig)}`;
}

async function importPrivateKey(pem) {
  // Strip PEM headers/footers and whitespace.
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = base64ToArrayBuffer(body);
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// --- Firestore value encoding ---
// Minimal subset sufficient for our writes (strings, numbers, booleans, null).
// Extend if we ever need timestamps, arrays, maps, etc.

function encodeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = encodeValue(v);
  }
  return out;
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  // TODO: handle arrays/maps if needed.
  throw new Error(`Unsupported Firestore value type: ${typeof v}`);
}

// --- base64 helpers ---

function base64UrlEncode(str) {
  return base64UrlFromBase64(btoa(unescape(encodeURIComponent(str))));
}

function base64UrlEncodeBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return base64UrlFromBase64(btoa(bin));
}

function base64UrlFromBase64(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
