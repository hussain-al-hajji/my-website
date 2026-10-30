// يجلب صورة المعاينة (og:image) لروابط الأخبار في بيانات الإعلام التي لم تُرفق بها صورة، ويحفظها مصغّرة في public/img/previews
// ويسجّلها في src/data/link-previews.json لتظهر في مربعات صفحة الإعلام. أي فشل (موقع يمنع الطلب، لا صورة...) لا يوقف البناء: يُعرض المربع بلا صورة.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('[previews] sharp غير متوفر'); process.exit(0); }

const root = path.resolve('.');
const media = JSON.parse(fs.readFileSync(path.join(root, 'src/data/media.json'), 'utf8'));
const cacheFile = path.join(root, 'src/data/link-previews.json');
const outDir = path.join(root, 'public/img/previews');
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
fs.mkdirSync(outDir, { recursive: true });

const UAS = ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'];
const BLOCKED = /(^|\.)(x\.com|twitter\.com|instagram\.com|linkedin\.com|facebook\.com)$/;
const get = (url, ua, ms = 9000) => fetch(url, { headers: { 'user-agent': ua, accept: 'text/html,image/*,*/*', 'accept-language': 'ar,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(ms) });

function youtubeId(u) {
  const h = u.hostname.replace(/^www\./, '');
  if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0];
  if (h.endsWith('youtube.com')) return u.searchParams.get('v') || (/^\/(shorts|embed|live)\/([\w-]+)/.exec(u.pathname) || [])[2];
  return null;
}

async function candidates(link) {
  const u = new URL(link);
  if (BLOCKED.test(u.hostname)) return [];
  const yt = youtubeId(u);
  if (yt) return [`https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`];
  for (const ua of UAS) {
    try {
      const r = await get(link, ua);
      if (!r.ok) continue;
      const html = (await r.text()).slice(0, 400000);
      const metas = [...html.matchAll(/<meta\s[^>]*>/gi)].map((m) => m[0]);
      const pick = (...keys) => {
        for (const k of keys) for (const m of metas) {
          if (new RegExp(`(?:property|name)=["']${k}["']`, 'i').test(m)) { const c = /content=["']([^"']+)["']/i.exec(m); if (c) return c[1].replace(/&amp;/g, '&'); }
        }
        return null;
      };
      const img = pick('og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src');
      if (img) return [new URL(img, r.url).href];
    } catch { /* جرّب الوكيل التالي */ }
  }
  return [];
}

async function fetchImage(urls) {
  for (const url of urls) {
    for (const ua of UAS) {
      try {
        const r = await get(url, ua, 12000);
        if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 4000 || buf.length > 8e6) continue;
        return await sharp(buf).resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
      } catch { /* التالي */ }
    }
  }
  return null;
}

const todo = [...new Set(media.filter((m) => m.link && !m.image).map((m) => m.link))]
  .filter((l) => !(cache[l] && fs.existsSync(path.join(root, 'public', cache[l]))));
let ok = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let link = queue.shift(); link; link = queue.shift()) {
    try {
      const body = await fetchImage(await candidates(link));
      if (!body) { console.log(`[previews] لا صورة: ${link}`); continue; }
      const name = crypto.createHash('sha1').update(link).digest('hex').slice(0, 12) + '.webp';
      fs.writeFileSync(path.join(outDir, name), body);
      cache[link] = `/img/previews/${name}`; ok++;
    } catch (e) { console.log(`[previews] تعذّر ${link}: ${e.message}`); }
  }
}));
// يُحذف ما لم يعد له ملف
for (const k of Object.keys(cache)) if (!fs.existsSync(path.join(root, 'public', cache[k]))) delete cache[k];
const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(cacheFile, JSON.stringify(sorted, null, 2) + '\n');
console.log(`[previews] ${ok} جديدة من ${todo.length} · الإجمالي ${Object.keys(sorted).length}`);
