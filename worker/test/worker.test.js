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
