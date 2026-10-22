import { verifyIdToken, isAllowed, AuthError } from './auth.js';
import { validatePublish, ValidationError, LIST_FILES, OBJECT_FILES } from './validate.js';
import { commitFiles, readFile } from './github.js';

function cors(env, req) {
  const allow = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  const ok = allow.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allow[0] || 'null',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const reply = (env, req, status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(env, req) } });

export async function authorize(req, env, deps = {}) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || '');
  if (!m) throw new AuthError('missing');
  const payload = await verifyIdToken(m[1], { projectId: env.FIREBASE_PROJECT_ID, ...deps });
  if (!isAllowed(payload, env)) throw new AuthError('forbidden');
  return payload;
}

export async function handle(req, env, deps = {}) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
  if (url.pathname === '/api/health') return reply(env, req, 200, { ok: true });

  try {
    if (url.pathname === '/api/content' && req.method === 'GET') {
      await authorize(req, env, deps.auth);
      const names = [...LIST_FILES, ...OBJECT_FILES];
      const entries = await Promise.all(names.map(async (n) => [n, JSON.parse(await readFile(env, `src/data/${n}.json`, deps.fetch))]));
      return reply(env, req, 200, Object.fromEntries(entries));
    }
    if (url.pathname === '/api/publish' && req.method === 'POST') {
      const who = await authorize(req, env, deps.auth);
      const { files, message } = validatePublish(await req.json().catch(() => null));
      const res = await commitFiles(env, files, `${message}\n\nبواسطة لوحة التحكم (${who.sub.slice(0, 8)})`, deps.fetch);
      return reply(env, req, 200, { ok: true, ...res });
    }
    return reply(env, req, 404, { error: 'not-found' });
  } catch (e) {
    if (e instanceof AuthError) return reply(env, req, e.message === 'forbidden' ? 403 : 401, { error: e.message });
    if (e instanceof ValidationError) return reply(env, req, 400, { error: 'invalid', message: e.message });
    console.error(e.message);
    return reply(env, req, 502, { error: 'upstream' });
  }
}

export default { fetch: (req, env) => handle(req, env) };
