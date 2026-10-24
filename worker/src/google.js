// الوصول إلى واجهات Google (Search Console وGA4) بحساب خدمة: مفتاح JSON سري في أسرار الـ Worker (GOOGLE_SA_JSON).
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (s) => new TextEncoder().encode(s);

export async function googleToken(env, scope, f = fetch) {
  if (!env.GOOGLE_SA_JSON) throw new Error('not-configured');
  const sa = JSON.parse(env.GOOGLE_SA_JSON);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64u(enc(JSON.stringify({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[A-Z ]+-----|\s/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc(head + '.' + claim)));
  const r = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }) });
  if (!r.ok) throw new Error('google-token');
  return (await r.json()).access_token;
}

const iso = (t) => new Date(t).toISOString().slice(0, 10);
export function ranges(now = Date.now(), len = 28) {
  const end = now - 864e5, start = end - (len - 1) * 864e5;
  return { start: iso(start), end: iso(end), pStart: iso(start - len * 864e5), pEnd: iso(start - 864e5) };
}
const row = (r, n = 1) => ({ k: (r.keys || []).slice(0, n).join(' | '), clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });

/** بيانات Search Console لآخر 28 يوماً: إجماليات ومقارنة بالفترة السابقة، السلسلة اليومية، الاستعلامات، الصفحات، الدول، الأجهزة */
export async function searchConsole(env, f = fetch, now = Date.now()) {
  if (!env.GSC_SITE) throw new Error('not-configured');
  const token = await googleToken(env, 'https://www.googleapis.com/auth/webmasters.readonly', f);
  const { start, end, pStart, pEnd } = ranges(now);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(env.GSC_SITE)}/searchAnalytics/query`;
  const q = async (body) => {
    const r = await f(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('gsc-' + r.status);
    return (await r.json()).rows || [];
  };
  const [tot, prev, byDate, byQuery, byPage, byCountry, byDevice] = await Promise.all([
    q({ startDate: start, endDate: end }), q({ startDate: pStart, endDate: pEnd }),
    q({ startDate: start, endDate: end, dimensions: ['date'] }),
    q({ startDate: start, endDate: end, dimensions: ['query'], rowLimit: 60 }),
    q({ startDate: start, endDate: end, dimensions: ['page'], rowLimit: 12 }),
    q({ startDate: start, endDate: end, dimensions: ['country'], rowLimit: 8 }),
    q({ startDate: start, endDate: end, dimensions: ['device'] }),
  ]);
  const t = tot[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 }, p = prev[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const queries = byQuery.map((r) => row(r));
  return {
    range: { start, end }, totals: { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position }, prev: { clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position },
    series: byDate.map((r) => ({ d: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
    queriesByClicks: [...queries].filter((x) => x.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 12),
    queriesByImpressions: [...queries].sort((a, b) => b.impressions - a.impressions).slice(0, 12),
    pages: byPage.map((r) => row(r)), countries: byCountry.map((r) => row(r)), devices: byDevice.map((r) => row(r)),
  };
}

/** بيانات GA4 لآخر 28 يوماً: الجلسات والمستخدمون والمصادر والصفحات والدول */
export async function analytics4(env, f = fetch) {
  if (!env.GA4_PROPERTY_ID) throw new Error('not-configured');
  const token = await googleToken(env, 'https://www.googleapis.com/auth/analytics.readonly', f);
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`;
  const range = [{ startDate: '28daysAgo', endDate: 'yesterday' }];
  const run = async (body) => {
    const r = await f(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ dateRanges: range, ...body }) });
    if (!r.ok) throw new Error('ga4-' + r.status);
    return (await r.json()).rows || [];
  };
  const m = (r, i) => Number(r.metricValues?.[i]?.value || 0);
  const d = (r, i = 0) => r.dimensionValues?.[i]?.value || '';
  const [tot, chan, src, pages, geo] = await Promise.all([
    run({ metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'engagementRate' }] }),
    run({ dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], limit: 8, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
    run({ dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], limit: 10, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
    run({ dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], limit: 10, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }] }),
    run({ dimensions: [{ name: 'country' }], metrics: [{ name: 'sessions' }], limit: 8, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
  ]);
  const t = tot[0];
  return {
    totals: t ? { sessions: m(t, 0), users: m(t, 1), newUsers: m(t, 2), views: m(t, 3), avgDuration: m(t, 4), engagement: m(t, 5) } : { sessions: 0, users: 0, newUsers: 0, views: 0, avgDuration: 0, engagement: 0 },
    channels: chan.map((r) => ({ k: d(r), n: m(r, 0) })), sources: src.map((r) => ({ k: d(r), n: m(r, 0) })),
    pages: pages.map((r) => ({ k: d(r), n: m(r, 0) })), countries: geo.map((r) => ({ k: d(r), n: m(r, 0) })),
  };
}
