import { abs, href, getPosts, getNews } from '../lib/site.js';

const STATIC = ['/', '/bio', '/training-programs', '/collaborate', '/contact', '/honor', '/arab-youth-pioneers', '/media', '/feedback',
  '/recorded-courses', '/partnerships', '/gallery', '/blog', '/my-projects', '/featured', '/faq', '/news', '/methodology', '/card'];

export function GET() {
  const urls = [
    ...STATIC.map((p) => ({ loc: abs(p) })),
    ...getPosts().filter((p) => p.body).map((p) => ({ loc: abs('/blog/' + p.slug), lastmod: p.date })),
    ...getNews().map((n) => ({ loc: abs('/news/' + n.id), lastmod: n.date })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
