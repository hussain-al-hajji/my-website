// التحقق من رمز Firebase ID (RS256) بلا مكتبات خارجية، ثم فحص القائمة المسموح لها.
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const dec = new TextDecoder();
function b64u(s) {
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p.padEnd(Math.ceil(p.length / 4) * 4, '='));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const json = (s) => JSON.parse(dec.decode(b64u(s)));

let cache = { at: 0, keys: null };
export async function fetchJwks(fetchImpl = fetch) {
  if (cache.keys && Date.now() - cache.at < 3_600_000) return cache.keys;
  const r = await fetchImpl(JWKS_URL);
  if (!r.ok) throw new Error('jwks');
  const body = await r.json();
  cache = { at: Date.now(), keys: body.keys };
  return body.keys;
}
export const _resetJwksCache = () => (cache = { at: 0, keys: null });

export class AuthError extends Error {}

export async function verifyIdToken(token, { projectId, getKeys = fetchJwks, now = Date.now() }) {
  if (!projectId) throw new AuthError('not-configured');
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new AuthError('malformed');
  let header, payload;
  try { header = json(parts[0]); payload = json(parts[1]); } catch { throw new AuthError('malformed'); }
  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('alg');
  const keys = await getKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new AuthError('signature');
  const t = Math.floor(now / 1000);
  if (payload.aud !== projectId) throw new AuthError('aud');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new AuthError('iss');
  if (!payload.sub) throw new AuthError('sub');
  if (typeof payload.exp !== 'number' || payload.exp <= t) throw new AuthError('expired');
  if (typeof payload.iat !== 'number' || payload.iat > t + 300) throw new AuthError('iat');
  return payload;
}

const list = (s) => String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

/** مسموح إن تطابق UID، أو تطابق بريد موثَّق. بريد Apple المستعار يُعتمد فيه UID فقط. */
export function isAllowed(payload, env) {
  const uids = list(env.ALLOWED_UIDS);
  if (uids.includes(String(payload.sub).toLowerCase())) return true;
  const emails = list(env.ALLOWED_EMAILS);
  const email = String(payload.email || '').toLowerCase();
  if (email && payload.email_verified === true && !email.endsWith('@privaterelay.appleid.com') && emails.includes(email)) return true;
  return false;
}
