import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyIdToken, isAllowed, AuthError } from '../src/auth.js';
import { validatePublish, ValidationError } from '../src/validate.js';
import { handle } from '../src/index.js';

const PROJECT = 'demo-project';
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const getKeys = async () => [jwk];

async function mint(claims = {}, { kid = 'k1', key = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: 'https://securetoken.google.com/' + PROJECT, aud: PROJECT, sub: 'uid-123', iat: now - 10, exp: now + 3600, email: 'owner@example.com', email_verified: true, ...claims };
  const h = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })), p = b64u(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(h + '.' + p));
  return h + '.' + p + '.' + b64u(sig);
}
const opts = { projectId: PROJECT, getKeys };

test('رمز صالح يُقبل', async () => {
  const p = await verifyIdToken(await mint(), opts);
  assert.equal(p.sub, 'uid-123');
});
for (const [name, claims] of [['aud خاطئ', { aud: 'other' }], ['iss خاطئ', { iss: 'https://evil' }], ['منتهي', { exp: 1 }], ['بلا sub', { sub: '' }]]) {
  test('يرفض: ' + name, async () => {
    await assert.rejects(verifyIdToken(await mint(claims), opts), AuthError);
  });
}
test('يرفض توقيعاً بمفتاح آخر', async () => {
  const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  await assert.rejects(verifyIdToken(await mint({}, { key: other.privateKey }), opts), AuthError);
});
test('يرفض kid مجهولاً ورمزاً مشوّهاً', async () => {
  await assert.rejects(verifyIdToken(await mint({}, { kid: 'zzz' }), opts), AuthError);
  await assert.rejects(verifyIdToken('a.b', opts), AuthError);
});
test('يرفض عند غياب مشروع Firebase', async () => {
  await assert.rejects(verifyIdToken(await mint(), { getKeys }), AuthError);
});

test('القائمة المسموحة: بريد موثَّق أو UID', () => {
  const env = { ALLOWED_EMAILS: 'Owner@example.com', ALLOWED_UIDS: 'apple-uid' };
  assert.ok(isAllowed({ sub: 'x', email: 'owner@example.com', email_verified: true }, env));
  assert.ok(!isAllowed({ sub: 'x', email: 'owner@example.com', email_verified: false }, env));
  assert.ok(!isAllowed({ sub: 'x', email: 'other@example.com', email_verified: true }, env));
  assert.ok(isAllowed({ sub: 'apple-uid' }, env));
  assert.ok(!isAllowed({ sub: 'x', email: 'a@privaterelay.appleid.com', email_verified: true }, { ALLOWED_EMAILS: 'a@privaterelay.appleid.com' }));
  assert.ok(!isAllowed({ sub: 'x' }, {}));
});

const webp = Buffer.from('RIFF....WEBPVP8 ').toString('base64');
test('التحقق من النشر: مسارات وبيانات', () => {
  const ok = validatePublish({ files: [{ path: 'src/data/news.json', content: '[{"id":"n1"}]' }, { path: 'public/img/uploads/a-1.webp', content: webp, encoding: 'base64' }], message: 'x\ny' });
  assert.equal(ok.files.length, 2);
  assert.equal(ok.message, 'x y');
  for (const bad of [
    { files: [{ path: 'src/pages/index.astro', content: 'x' }] },
    { files: [{ path: '.github/workflows/deploy.yml', content: 'x' }] },
    { files: [{ path: 'src/data/../../x.json', content: '[]' }] },
    { files: [{ path: 'src/data/unknown.json', content: '[]' }] },
    { files: [{ path: 'src/data/news.json', content: '{}' }] },
    { files: [{ path: 'src/data/site.json', content: '[]' }] },
    { files: [{ path: 'src/data/news.json', content: '[1]' }] },
    { files: [{ path: 'src/data/news.json', content: 'nope' }] },
    { files: [{ path: 'public/img/uploads/x.webp', content: Buffer.from('notwebp!!').toString('base64'), encoding: 'base64' }] },
    { files: [{ path: 'public/img/uploads/x.png', content: webp, encoding: 'base64' }] },
    { files: [] }, null,
  ]) assert.throws(() => validatePublish(bad), ValidationError);
});

function fakeGithub() {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = String(url).replace('https://api.github.com', '');
    calls.push([init.method || 'GET', u]);
    const json = (o) => new Response(JSON.stringify(o), { status: 200 });
    if (u.includes('/git/ref/heads/')) return json({ object: { sha: 'H' } });
    if (u.endsWith('/git/commits/H')) return json({ tree: { sha: 'T0' } });
    if (u.endsWith('/git/blobs')) return json({ sha: 'B' + calls.length });
    if (u.endsWith('/git/trees')) return json({ sha: 'T1' });
    if (u.endsWith('/git/commits')) return json({ sha: 'C1', html_url: 'u' });
    if (u.includes('/git/refs/heads/')) return json({});
    return new Response('[]', { status: 200 });
  };
  return { f, calls };
}
const env = { FIREBASE_PROJECT_ID: PROJECT, ALLOWED_EMAILS: 'owner@example.com', ALLOWED_ORIGIN: 'https://site.test', GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r' };
const req = (path, init = {}) => new Request('https://w.test' + path, { ...init, headers: { Origin: 'https://site.test', ...(init.headers || {}) } });

test('نقطة النشر: بلا رمز 401، رمز غير مسموح 403، مسموح 200', async () => {
  const gh = fakeGithub();
  const deps = { auth: { getKeys }, fetch: gh.f };
  const body = JSON.stringify({ files: [{ path: 'src/data/news.json', content: '[]' }] });
  assert.equal((await handle(req('/api/publish', { method: 'POST', body }), env, deps)).status, 401);
  const bad = await mint({ email: 'intruder@example.com' });
  assert.equal((await handle(req('/api/publish', { method: 'POST', body, headers: { Authorization: 'Bearer ' + bad } }), env, deps)).status, 403);
  assert.equal(gh.calls.length, 0);
  const good = await mint();
  const r = await handle(req('/api/publish', { method: 'POST', body, headers: { Authorization: 'Bearer ' + good } }), env, deps);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).sha, 'C1');
  assert.deepEqual(gh.calls.map((c) => c[0]), ['GET', 'GET', 'POST', 'POST', 'POST', 'PATCH']);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://site.test');
});
test('نقطة النشر ترفض مساراً غير مسموح بـ 400 قبل لمس GitHub', async () => {
  const gh = fakeGithub();
  const r = await handle(req('/api/publish', { method: 'POST', body: JSON.stringify({ files: [{ path: '.github/workflows/x.yml', content: 'x' }] }), headers: { Authorization: 'Bearer ' + (await mint()) } }), env, { auth: { getKeys }, fetch: gh.f });
  assert.equal(r.status, 400);
  assert.equal(gh.calls.length, 0);
});
test('CORS وفحص الصحة', async () => {
  const o = await handle(req('/api/publish', { method: 'OPTIONS' }), env);
  assert.equal(o.status, 204);
  assert.equal((await handle(req('/api/health'), env)).status, 200);
  const foreign = await handle(new Request('https://w.test/api/health', { headers: { Origin: 'https://evil.test' } }), env);
  assert.equal(foreign.headers.get('Access-Control-Allow-Origin'), 'https://site.test');
});

// ---------- الإحصاءات ----------
import { classifySource, cleanPath, deviceOf, dayKey, Stats } from '../src/stats.js';
import { googleToken, ranges } from '../src/google.js';

const memStorage = () => {
  const m = new Map();
  return { get: async (k) => structuredClone(m.get(k)), put: async (k, v) => { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) m.set(a, structuredClone(b)); else m.set(k, structuredClone(v)); },
    list: async ({ prefix }) => new Map([...m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])), delete: async (ks) => { [].concat(ks).forEach((k) => m.delete(k)); }, m };
};

test('تصنيف مصادر الزيارة', () => {
  assert.equal(classifySource('', 'hussain-al-hajji.com').kind, 'direct');
  assert.equal(classifySource('https://hussain-al-hajji.com/bio', 'hussain-al-hajji.com').kind, 'direct');
  assert.deepEqual(classifySource('https://www.google.com.sa/', 'x.com'), { kind: 'search', host: 'google.com.sa' });
  assert.equal(classifySource('https://t.co/abc', 'x.com').kind, 'social');
  assert.equal(classifySource('https://blog.example.org/post', 'x.com').kind, 'referral');
  assert.equal(classifySource('', 'x.com', 'LinkedIn').host, 'utm:linkedin');
});
test('تنظيف المسارات والأجهزة واليوم', () => {
  assert.equal(cleanPath('/bio.html?x=1#a'), '/bio');
  assert.equal(cleanPath('/blog/post-1/'), '/blog/post-1');
  assert.equal(cleanPath('/<script>'), '/');
  assert.equal(deviceOf(390), 'mobile'); assert.equal(deviceOf(800), 'tablet'); assert.equal(deviceOf(1440), 'desktop');
  assert.equal(dayKey(Date.UTC(2026, 0, 1, 22, 30)), '2026-01-02'); // الرياض UTC+3
});
test('العدّاد يزيد بالجلسة الجديدة فقط ويحسب المشاهدات', async () => {
  const st = new Stats({ storage: memStorage() });
  const base = { path: '/', ref: 'https://www.google.com/', width: 400, country: 'SA', siteHost: 'hussain-al-hajji.com', now: Date.UTC(2026, 5, 1, 9) };
  assert.equal((await st.hit({ ...base, newSession: true })).visit, 1);
  assert.equal((await st.hit({ ...base, path: '/bio.html', newSession: false })).visit, null);
  assert.equal((await st.hit({ ...base, ref: '', newSession: true })).visit, 2);
  const s = await st.snapshot(7);
  assert.equal(s.total, 2); assert.equal(s.pageviews, 3);
  assert.equal(s.sources.find((x) => x.k === 'search').n, 1);
  assert.equal(s.pages[0].k, '/');
  assert.equal(s.countries[0].k, 'SA');
});
test('/api/hit عام ويحترم النطاق والروبوتات', async () => {
  const calls = [];
  const stats = { hit: async (d) => { calls.push(d); return { visit: d.newSession ? 41 : null, total: 41 }; }, snapshot: async () => ({ total: 41 }) };
  const mk = (body, origin = 'https://hussain-al-hajji.com', ua = 'Mozilla/5.0') => handle(new Request('https://w.test/api/hit', { method: 'POST', headers: { Origin: origin, 'User-Agent': ua, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { VISITS_BASE: '1000' }, { stats });
  const ok = await (await mk({ p: '/', s: true })).json();
  assert.equal(ok.visit, 1041); assert.equal(ok.total, 1041);
  assert.equal((await (await mk({ p: '/', s: true }, 'https://hussain-al-hajji.com', 'Googlebot/2.1')).json()).visit, null);
  assert.equal((await mk({ p: '/', s: true }, 'https://evil.example')).status, 204);
  assert.equal((await mk({ p: '/admin', s: true })).status, 200);
  assert.equal(calls.length, 1);
});
test('/api/stats يتطلب مصادقة', async () => {
  const r = await handle(new Request('https://w.test/api/stats'), {}, { stats: { snapshot: async () => ({}) } });
  assert.equal(r.status, 401);
});
test('رمز حساب خدمة Google يُوقَّع ويُطلب', async () => {
  const pk = await crypto.subtle.exportKey('pkcs8', privateKey);
  const pem = '-----BEGIN PRIVATE KEY-----\n' + Buffer.from(pk).toString('base64') + '\n-----END PRIVATE KEY-----\n';
  let sent;
  const f = async (u, o) => { sent = { u: String(u), body: String(o.body) }; return new Response(JSON.stringify({ access_token: 'tok' })); };
  const t = await googleToken({ GOOGLE_SA_JSON: JSON.stringify({ client_email: 'sa@x.iam', private_key: pem }) }, 'scope-a', f);
  assert.equal(t, 'tok');
  assert.match(sent.u, /oauth2\.googleapis\.com\/token/);
  assert.match(sent.body, /grant_type=urn/);
  await assert.rejects(googleToken({}, 's', f), /not-configured/);
  const r = ranges(Date.UTC(2026, 5, 29));
  assert.equal(r.end, '2026-06-28'); assert.equal(r.start, '2026-06-01');
});

// ---------- الترجمة ----------
test('الترجمة: تتطلب دخولاً مسموحاً وتتحقق من المدخلات', async () => {
  const body = JSON.stringify({ texts: ['مرحبا'] });
  assert.equal((await handle(req('/api/translate', { method: 'POST', body }), env, { auth: { getKeys } })).status, 401);
  const bad = await mint({ email: 'intruder@example.com' });
  assert.equal((await handle(req('/api/translate', { method: 'POST', body, headers: { Authorization: 'Bearer ' + bad } }), env, { auth: { getKeys } })).status, 403);
  const good = { Authorization: 'Bearer ' + (await mint()) };
  const noCfg = await handle(req('/api/translate', { method: 'POST', body, headers: good }), env, { auth: { getKeys } });
  assert.equal(noCfg.status, 501);
  const empty = await handle(req('/api/translate', { method: 'POST', body: JSON.stringify({ texts: [] }), headers: good }), { ...env, ANTHROPIC_API_KEY: 'k' }, { auth: { getKeys } });
  assert.equal(empty.status, 400);
});
test('الترجمة عبر Claude: تعيد مصفوفة بالطول نفسه وترفض ناتجاً مشوّهاً', async () => {
  const good = { Authorization: 'Bearer ' + (await mint()) };
  const calls = [];
  const claude = (reply) => async (url, init) => { calls.push([String(url), JSON.parse(init.body)]); return new Response(JSON.stringify({ content: [{ type: 'text', text: reply }] }), { status: 200 }); };
  const body = JSON.stringify({ texts: ['مدرب أعمال', 'خبرة منذ {since}'] });
  const e2 = { ...env, ANTHROPIC_API_KEY: 'k' };
  const ok = await handle(req('/api/translate', { method: 'POST', body, headers: good }), e2, { auth: { getKeys }, fetch: claude('["Business trainer","Experience since {since}"]') });
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).texts, ['Business trainer', 'Experience since {since}']);
  assert.equal(calls[0][0], 'https://api.anthropic.com/v1/messages');
  const bad = await handle(req('/api/translate', { method: 'POST', body, headers: good }), e2, { auth: { getKeys }, fetch: claude('["only one"]') });
  assert.equal(bad.status, 502);
});
test('الترجمة عبر Workers AI: تحفظ بادئات القوائم والرموز', async () => {
  const good = { Authorization: 'Bearer ' + (await mint()) };
  const AI = { run: async (_m, { text }) => ({ translated_text: 'EN(' + text + ')' }) };
  const r = await handle(req('/api/translate', { method: 'POST', body: JSON.stringify({ texts: ['عنوان:\n- مهمة منذ {since}'] }), headers: good }), { ...env, AI }, { auth: { getKeys } });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).texts, ['EN(عنوان:)\n- EN(مهمة منذ ZQ0X)'.replace('ZQ0X', '{since}')]);
});

// ---------- منع محو التعديلات الأحدث، وحالة البناء ----------
import { sha256, deployStatus } from '../src/github.js';

test('النشر يُرفض بـ 409 إن تغيّر الملف في المستودع منذ فتحته اللوحة، ويمرّ إن لم يتغيّر', async () => {
  const gh = fakeGithub();   // يعيد [] لقراءة أي ملف
  const deps = { auth: { getKeys }, fetch: gh.f };
  const headers = { Authorization: 'Bearer ' + (await mint()) };
  const files = [{ path: 'src/data/news.json', content: '[{"a":1}]' }];
  const stale = await handle(req('/api/publish', { method: 'POST', headers, body: JSON.stringify({ files, bases: { 'src/data/news.json': await sha256('[{"x":0}]') } }) }), env, deps);
  assert.equal(stale.status, 409);
  assert.deepEqual((await stale.json()).files, ['src/data/news.json']);
  assert.ok(!gh.calls.some((c) => c[0] === 'POST'), 'لا إيداع عند التعارض');
  const fresh = await handle(req('/api/publish', { method: 'POST', headers, body: JSON.stringify({ files, bases: { 'src/data/news.json': await sha256('[]') } }) }), env, deps);
  assert.equal(fresh.status, 200);
});
test('حالة البناء: الإيداع الملغى بإيداع أحدث ناجح يُعدّ منشوراً', async () => {
  const run = (sha, status, conclusion, at) => ({ head_sha: sha, status, conclusion, created_at: at, html_url: 'u-' + sha });
  const f = (runs) => async () => new Response(JSON.stringify({ workflow_runs: runs }), { status: 200 });
  const e = { GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r' };
  const newest = [run('b', 'completed', 'success', '2026-01-01T00:02:00Z'), run('a', 'completed', 'cancelled', '2026-01-01T00:01:00Z')];
  assert.equal((await deployStatus(e, 'a', f(newest))).state, 'success');
  assert.equal((await deployStatus(e, 'a', f([run('a', 'in_progress', null, '2026-01-01T00:01:00Z')]))).state, 'running');
  assert.equal((await deployStatus(e, 'a', f([run('a', 'completed', 'failure', '2026-01-01T00:01:00Z')]))).state, 'failure');
  assert.equal((await deployStatus(e, 'zz', f(newest))).state, 'queued');
});
