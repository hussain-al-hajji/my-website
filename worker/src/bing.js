// Bing Webmaster Tools: الروابط الواردة وإحصاءات الظهور والاستعلامات. المفتاح سري (BING_API_KEY) والموقع في BING_SITE.
const BASE = 'https://ssl.bing.com/webmaster/api.svc/json/';
const ms = (s) => { const m = /\/Date\((-?\d+)/.exec(String(s || '')); return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : String(s || '').slice(0, 10); };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u || ''); } };

export async function bing(env, f = fetch) {
  if (!env.BING_API_KEY || !env.BING_SITE) throw new Error('not-configured');
  const call = async (name, extra = {}) => {
    const u = new URL(BASE + name);
    u.searchParams.set('siteUrl', env.BING_SITE); u.searchParams.set('apikey', env.BING_API_KEY);
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    const r = await f(u);
    if (!r.ok) throw new Error('bing-' + r.status);
    return (await r.json()).d;
  };
  const [links, traffic, queries] = await Promise.all([
    call('GetLinkCounts', { page: 0 }).catch(() => null), call('GetRankAndTrafficStats').catch(() => []), call('GetQueryStats').catch(() => []),
  ]);
  const pages = (links?.Links || []).map((x) => ({ k: x.Url, n: x.Count })).sort((a, b) => b.n - a.n);
  const totalLinks = pages.reduce((a, x) => a + x.n, 0);
  // المواقع المُحيلة إلى أكثر صفحة مرتبطاً بها
  let domains = [];
  if (pages[0]) {
    const ul = await call('GetUrlLinks', { link: pages[0].k, page: 0 }).catch(() => null);
    const c = {};
    (ul?.Details || []).forEach((x) => { const h = hostOf(x.Url); if (h) c[h] = (c[h] || 0) + 1; });
    domains = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ k, n }));
  }
  const series = (traffic || []).map((x) => ({ d: ms(x.Date), clicks: x.Clicks || 0, impressions: x.Impressions || 0 })).sort((a, b) => a.d.localeCompare(b.d)).slice(-28);
  return {
    links: { total: totalLinks, pages: pages.slice(0, 10), domains },
    totals: series.reduce((a, x) => ({ clicks: a.clicks + x.clicks, impressions: a.impressions + x.impressions }), { clicks: 0, impressions: 0 }), series,
    queries: (queries || []).map((x) => ({ k: x.Query, clicks: x.Clicks || 0, impressions: x.Impressions || 0, position: x.AvgImpressionPosition || 0 })).sort((a, b) => b.impressions - a.impressions).slice(0, 12),
  };
}
