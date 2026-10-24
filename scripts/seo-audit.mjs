// فحص سيو مبني على صفحات dist بعد البناء: عناوين ووصف وعناوين رئيسية وصور بلا نص بديل وبيانات منظمة، ويُحفظ في dist/seo-audit.json لتعرضه لوحة التحكم.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
if (!fs.existsSync(dist)) { console.warn('[seo] dist غير موجود'); process.exit(0); }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(dist).filter((f) => f.endsWith('.html') && !/\/(404|admin\/)/.test(f.replace(dist, '')) && !/\/og\//.test(f));
const dec = (s = '') => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const meta = (h, re) => dec((h.match(re) || [])[1] || '');

const pages = files.map((f) => {
  const h = fs.readFileSync(f, 'utf8');
  const rel = '/' + path.relative(dist, f).replace(/\\/g, '/').replace(/index\.html$/, '').replace(/\.html$/, '');
  const url = rel.length > 1 ? rel.replace(/\/$/, '') : '/';
  const title = meta(h, /<title>([\s\S]*?)<\/title>/), desc = meta(h, /<meta name="description" content="([^"]*)"/);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(h);
  const main = (h.match(/<main[\s\S]*?<\/main>/) || [''])[0].replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
  const imgs = [...h.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const rec = {
    p: url, title, tl: [...title].length, desc, dl: [...desc].length, noindex,
    h1: (h.match(/<h1[\s>]/g) || []).length, noAlt: imgs.filter((t) => !/\salt=/.test(t)).length,
    words: dec(main).split(' ').filter(Boolean).length, jsonld: (h.match(/application\/ld\+json/g) || []).length,
    canonical: /<link rel="canonical"/.test(h), og: /<meta property="og:image"/.test(h),
  };
  rec.issues = [];
  if (!noindex) {
    if (!rec.tl || rec.tl < 15) rec.issues.push('عنوان قصير');
    if (rec.tl > 70) rec.issues.push('عنوان طويل');
    if (!rec.dl) rec.issues.push('بلا وصف');
    else if (rec.dl < 70) rec.issues.push('وصف قصير');
    else if (rec.dl > 170) rec.issues.push('وصف طويل');
    if (rec.h1 !== 1) rec.issues.push(rec.h1 ? 'أكثر من عنوان رئيسي' : 'بلا عنوان رئيسي');
    if (rec.noAlt) rec.issues.push(`${rec.noAlt} صورة بلا نص بديل`);
    if (!rec.canonical) rec.issues.push('بلا رابط قانوني');
    if (!rec.og) rec.issues.push('بلا صورة مشاركة');
    if (rec.words < 120) rec.issues.push('محتوى قليل');
  }
  return rec;
}).sort((a, b) => a.p.localeCompare(b.p));

const idx = pages.filter((x) => !x.noindex);
const dupTitles = Object.values(idx.reduce((a, x) => ((a[x.title] ||= []).push(x.p), a), {})).filter((v) => v.length > 1);
const sm = fs.existsSync(path.join(dist, 'sitemap.xml')) ? fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8') : '';
const out = {
  at: new Date().toISOString(),
  summary: {
    pages: pages.length, indexable: idx.length, noindex: pages.length - idx.length,
    withIssues: idx.filter((x) => x.issues.length).length, issueCount: idx.reduce((a, x) => a + x.issues.length, 0),
    dupTitles: dupTitles.length, noAlt: idx.reduce((a, x) => a + x.noAlt, 0), sitemapUrls: (sm.match(/<loc>/g) || []).length,
    avgTitle: Math.round(idx.reduce((a, x) => a + x.tl, 0) / Math.max(1, idx.length)), avgDesc: Math.round(idx.reduce((a, x) => a + x.dl, 0) / Math.max(1, idx.length)),
    schema: idx.filter((x) => x.jsonld).length,
  },
  files: Object.fromEntries(['robots.txt', 'sitemap.xml', 'rss.xml', 'llms.txt'].map((n) => [n, fs.existsSync(path.join(dist, n))])),
  dupTitles, pages,
};
fs.writeFileSync(path.join(dist, 'seo-audit.json'), JSON.stringify(out));
console.log(`[seo] ${out.summary.indexable} صفحة قابلة للأرشفة · ${out.summary.withIssues} بها ملاحظات · ${out.summary.issueCount} ملاحظة`);
