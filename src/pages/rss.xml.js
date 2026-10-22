import { abs, site, getNews, getPosts } from '../lib/site.js';

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function GET() {
  const items = [
    ...getNews().map((n) => ({ t: n.title, u: abs('/news/' + n.id), d: n.summary, date: n.date })),
    ...getPosts().filter((p) => p.body).map((p) => ({ t: p.title, u: abs('/blog/' + p.slug), d: p.summary, date: p.date })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(site.title)}</title><link>${abs('/')}</link><description>${esc(site.description)}</description><language>ar</language>\n` +
    items.map((i) => `<item><title>${esc(i.t)}</title><link>${i.u}</link><guid>${i.u}</guid><description>${esc(i.d)}</description>${i.date ? `<pubDate>${new Date(i.date).toUTCString()}</pubDate>` : ''}</item>`).join('\n') + '\n</channel></rss>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
