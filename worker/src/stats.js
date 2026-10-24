// عدّاد الزيارات والتحليلات الخاصة: كائن دائم (Durable Object) واحد يحفظ أرقاماً مجمّعة فقط، بلا عناوين IP ولا معرّفات شخصية.
const DAY_KEEP = 400;
const CAP = { pages: 300, refs: 200, cc: 80 };

export const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python-requests|axios|node-fetch|go-http/i;
const SEARCH = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.[a-z.]+|yandex\.[a-z.]+|search\.brave\.com|ecosia\.org|baidu\.com|startpage\.com)$/i;
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|instagram\.com|t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|tiktok\.com|snapchat\.com|whatsapp\.com|wa\.me|t\.me|telegram\.org|threads\.net|reddit\.com|pinterest\.com)$/i;

export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

/** تصنيف مصدر الزيارة: direct | search | social | referral (ويُعاد اسم المضيف للإحالات) */
export function classifySource(ref, siteHost = '', utm = '') {
  const u = String(utm || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
  const h = hostOf(ref);
  if (u) return { kind: SOCIAL.test(u + '.com') ? 'social' : 'campaign', host: 'utm:' + u };
  if (!h || h === String(siteHost).replace(/^www\./, '')) return { kind: 'direct', host: '' };
  if (SEARCH.test(h)) return { kind: 'search', host: h };
  if (SOCIAL.test(h)) return { kind: 'social', host: h };
  return { kind: 'referral', host: h };
}
export const deviceOf = (w = 0) => (w && w < 600 ? 'mobile' : w && w < 1024 ? 'tablet' : 'desktop');

export function cleanPath(p = '/') {
  let s = String(p).split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/+$/, '') || '/';
  if (!s.startsWith('/')) s = '/' + s;
  return /^[\p{L}\p{N}/_.~%-]+$/u.test(s) ? s.slice(0, 90) : '/';
}
// اليوم بتوقيت الرياض (UTC+3) لتطابق أرقام اليوم ما يراه صاحب الموقع
export const dayKey = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);

const bump = (o, k, cap) => { if (k in o) o[k] += 1; else if (!cap || Object.keys(o).length < cap) o[k] = 1; };
const top = (o, n = 12) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, n: v }));

export class Stats {
  constructor(state) { this.storage = state.storage; }

  async hit(d) {
    const s = this.storage;
    const day = dayKey(d.now), dk = 'day:' + day;
    const [pages, cur] = await Promise.all([s.get('pages'), s.get(dk)]);
    const pg = pages || {}, dd = cur || { v: 0, pv: 0 };
    bump(pg, cleanPath(d.path), CAP.pages); dd.pv += 1;
    const put = { pages: pg, pv: ((await s.get('pv')) || 0) + 1 };
    let visit = null;
    if (d.newSession) {
      const [total, src, refs, cc, dev] = await Promise.all([s.get('total'), s.get('src'), s.get('refs'), s.get('cc'), s.get('dev')]);
      const so = classifySource(d.ref, d.siteHost, d.utm);
      const S = src || {}, R = refs || {}, C = cc || {}, V = dev || {};
      bump(S, so.kind); if (so.host) bump(R, so.host, CAP.refs);
      bump(C, /^[A-Z]{2}$/.test(d.country || '') ? d.country : 'XX', CAP.cc); bump(V, deviceOf(d.width));
      visit = (total || 0) + 1; dd.v += 1;
      Object.assign(put, { total: visit, src: S, refs: R, cc: C, dev: V });
    }
    put[dk] = dd;
    await s.put(put);
    return { visit, total: visit ?? ((await s.get('total')) || 0) };
  }

  async snapshot(days = 30) {
    const s = this.storage;
    const [total, pv, pages, src, refs, cc, dev, dayMap] = await Promise.all([s.get('total'), s.get('pv'), s.get('pages'), s.get('src'), s.get('refs'), s.get('cc'), s.get('dev'), s.list({ prefix: 'day:' })]);
    const series = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) { const k = dayKey(now - i * 864e5); const v = dayMap.get('day:' + k) || { v: 0, pv: 0 }; series.push({ d: k, v: v.v, pv: v.pv }); }
    const sum = (n) => series.slice(-n).reduce((a, x) => ({ v: a.v + x.v, pv: a.pv + x.pv }), { v: 0, pv: 0 });
    // تنظيف الأيام الأقدم من سنة وزيادة
    const old = [...dayMap.keys()].sort().slice(0, Math.max(0, dayMap.size - DAY_KEEP));
    if (old.length) await s.delete(old);
    return {
      total: total || 0, pageviews: pv || 0, today: series.at(-1), week: sum(7), month: sum(30), series,
      sources: top(src || {}), referrers: top(refs || {}), pages: top(pages || {}, 15), countries: top(cc || {}, 10), devices: top(dev || {}),
    };
  }

  async fetch(req) {
    const url = new URL(req.url);
    const json = (x) => new Response(JSON.stringify(x), { headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/hit' && req.method === 'POST') return json(await this.hit(await req.json()));
    if (url.pathname === '/snapshot') return json(await this.snapshot(Math.min(90, Number(url.searchParams.get('days')) || 30)));
    return new Response('not found', { status: 404 });
  }
}
