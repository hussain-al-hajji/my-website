import { verifyIdToken, isAllowed, AuthError } from './auth.js';
import { validatePublish, ValidationError, LIST_FILES, OBJECT_FILES } from './validate.js';
import { commitFiles, readFile, sha256, canonical, deployStatus } from './github.js';
import { Stats, BOT_RE } from './stats.js';
import { searchConsole, analytics4 } from './google.js';
import { bing } from './bing.js';
import { translateTexts, TranslateError } from './translate.js';

export { Stats };

// نطاقات الموقع الافتراضية، وتُضاف إليها ما في ALLOWED_ORIGIN
const DEFAULT_ORIGINS = ['https://hussain-al-hajji.com', 'https://hussain-al-hajji.github.io', 'http://localhost:4321'];
const DEFAULT_PROJECT = 'my-website-983ed';

function cors(env, req) {
  const allow = [...String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean), ...DEFAULT_ORIGINS];
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
  const payload = await verifyIdToken(m[1], { projectId: env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT, ...deps });
  if (!isAllowed(payload, env)) throw new AuthError('forbidden');
  return payload;
}

// الوصول إلى كائن الإحصاءات (أو بديل اختباري)
const statsStub = (env, deps) => deps.stats || {
  hit: async (d) => (await env.STATS.get(env.STATS.idFromName('main')).fetch('https://do/hit', { method: 'POST', body: JSON.stringify(d) })).json(),
  snapshot: async (days) => (await env.STATS.get(env.STATS.idFromName('main')).fetch('https://do/snapshot?days=' + days)).json(),
};
const settle = async (p) => {
  try { return { ok: true, ...(await p) }; } catch (e) { return { ok: false, reason: e.message === 'not-configured' ? 'not-configured' : 'error', detail: String(e.message).slice(0, 60) }; }
};

export async function handle(req, env, deps = {}) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
  if (url.pathname === '/api/health') return reply(env, req, 200, { ok: true });

  // تسجيل زيارة من الموقع: عام، يقبل نطاقات الموقع فقط ولا يحفظ بيانات شخصية
  if (url.pathname === '/api/hit' && req.method === 'POST') {
    const allow = cors(env, req)['Access-Control-Allow-Origin'];
    const origin = req.headers.get('Origin') || '';
    if (!origin || origin !== allow || /localhost|127\.0\.0\.1/.test(origin)) return new Response(null, { status: 204, headers: cors(env, req) });
    const ua = req.headers.get('User-Agent') || '';
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== 'object' || BOT_RE.test(ua) || /^\/admin/.test(String(b.p || ''))) return reply(env, req, 200, { visit: null });
    const siteHost = new URL(origin).hostname;
    const { visit, total } = await statsStub(env, deps).hit({
      path: String(b.p || '/'), ref: String(b.r || '').slice(0, 300), utm: String(b.u || '').slice(0, 40), width: Number(b.w) || 0, newSession: !!b.s,
      country: req.cf?.country || req.headers.get('CF-IPCountry') || '', siteHost, now: deps.now || Date.now(),
    });
    const base = Number(env.VISITS_BASE) || 0;
    return reply(env, req, 200, { visit: visit == null ? null : visit + base, total: (total || 0) + base });
  }

  try {
    if (url.pathname === '/api/stats' && req.method === 'GET') {
      await authorize(req, env, deps.auth);
      const f = deps.fetch || fetch;
      const [own, gsc, ga4, bg] = await Promise.all([
        statsStub(env, deps).snapshot(30), settle(searchConsole(env, f)), settle(analytics4(env, f)), settle(bing(env, f)),
      ]);
      own.total += Number(env.VISITS_BASE) || 0;
      return reply(env, req, 200, { own, gsc, ga4, bing: bg, at: new Date().toISOString() });
    }
    if (url.pathname === '/api/content' && req.method === 'GET') {
      await authorize(req, env, deps.auth);
      const names = [...LIST_FILES, ...OBJECT_FILES];
      const entries = await Promise.all(names.map(async (n) => [n, JSON.parse(await readFile(env, `src/data/${n}.json`, deps.fetch))]));
      return reply(env, req, 200, Object.fromEntries(entries));
    }
    if (url.pathname === '/api/translate' && req.method === 'POST') {
      await authorize(req, env, deps.auth);
      const b = await req.json().catch(() => null);
      const texts = await translateTexts(env, b && b.texts, deps);
      return reply(env, req, 200, { texts });
    }
    if (url.pathname === '/api/deploy' && req.method === 'GET') {
      await authorize(req, env, deps.auth);
      const sha = url.searchParams.get('sha') || '';
      if (!/^[0-9a-f]{7,40}$/.test(sha)) return reply(env, req, 400, { error: 'bad-request' });
      return reply(env, req, 200, await deployStatus(env, sha, deps.fetch));
    }
    if (url.pathname === '/api/publish' && req.method === 'POST') {
      const who = await authorize(req, env, deps.auth);
      const body = await req.json().catch(() => null);
      const { files, message } = validatePublish(body);
      // منع محو تعديل أحدث: إن تغيّر ملف بيانات في المستودع منذ فتحته اللوحة يُرفض النشر
      const bases = body && body.bases && typeof body.bases === 'object' ? body.bases : {};
      const conflicts = [];
      for (const f of files) {
        if (!/^src\/data\/[a-z0-9-]+\.json$/.test(f.path) || typeof bases[f.path] !== 'string') continue;
        let cur = null;
        try { cur = await sha256(canonical(await readFile(env, f.path, deps.fetch))); } catch { continue; }   // ملف جديد غير موجود
        if (cur !== bases[f.path]) conflicts.push(f.path);
      }
      if (conflicts.length) return reply(env, req, 409, { error: 'conflict', files: conflicts });
      const res = await commitFiles(env, files, `${message}\n\nبواسطة لوحة التحكم (${who.sub.slice(0, 8)})`, deps.fetch);
      return reply(env, req, 200, { ok: true, ...res });
    }
    return reply(env, req, 404, { error: 'not-found' });
  } catch (e) {
    if (e instanceof AuthError) return reply(env, req, e.message === 'forbidden' ? 403 : 401, { error: e.message });
    if (e instanceof TranslateError) return reply(env, req, e.message === 'not-configured' ? 501 : e.message === 'bad-request' || e.message === 'too-long' ? 400 : 502, { error: e.message });
    if (e instanceof ValidationError) return reply(env, req, 400, { error: 'invalid', message: e.message });
    console.error(e.message);
    return reply(env, req, 502, { error: 'upstream' });
  }
}

export default { fetch: (req, env) => handle(req, env) };
