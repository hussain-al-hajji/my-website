// يولّد الملف التعريفي (/profile) وملف الأعمال (/portfolio) بصيغة PDF بعد بناء الموقع، فيتجدّدان مع كل نشر.
// إن لم يتوفر متصفح يُكتفى بتحذير، إلا إن ضُبط REQUIRE_PDF=1.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

// يحوّل Chrome صور webp إلى PNG ضخمة داخل الملف، فنقدّم له نسخاً مصغّرة: JPEG للصور، وPNG للصور الشفافة
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('[pdf] sharp غير متوفر، ستُستخدم الصور كما هي'); }
const MAX = 1100;
async function slim(file) {
  const img = sharp(file), meta = await img.metadata();
  const r = img.resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true });
  return meta.hasAlpha
    ? { type: 'image/png', body: await r.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer() }
    : { type: 'image/jpeg', body: await r.flatten({ background: '#ffffff' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer() };
}

const dist = path.resolve('dist');
const base = (process.env.SITE_BASE || '/').replace(/\/$/, '');
const JOBS = [
  { page: '/profile', file: 'hussain-al-hajji-profile.pdf', pdf: {
    format: 'A4', preferCSSPageSize: false, margin: { top: '14mm', right: '15mm', bottom: '17mm', left: '15mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#8d8c85;text-align:center;font-family:Arial,sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  } },
  { page: '/profile-en', file: 'hussain-al-hajji-profile-en.pdf', pdf: {
    format: 'A4', preferCSSPageSize: false, margin: { top: '14mm', right: '15mm', bottom: '17mm', left: '15mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#8d8c85;text-align:center;font-family:Arial,sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  } },
  { page: '/portfolio', file: 'hussain-al-hajji-portfolio.pdf', pdf: { width: '297mm', height: '210mm', preferCSSPageSize: true } },
];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };

const candidates = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const exe = candidates.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });

function fail(msg) {
  console.warn(`[pdf] ${msg}`);
  if (process.env.REQUIRE_PDF === '1') process.exit(1);
  process.exit(0);
}
if (!fs.existsSync(path.join(dist, 'profile.html'))) fail('dist/profile.html غير موجود');
if (!exe) fail('لا يوجد متصفح لتوليد PDF');

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (base && p.startsWith(base)) p = p.slice(base.length) || '/';
  const tries = [p, p + '.html', path.join(p, 'index.html')];
  const file = tries.map((t) => path.join(dist, t)).find((f) => f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile());
  if (!file) { res.writeHead(404); res.end('not found'); return; }
  if (sharp && /\.(webp|png|jpe?g)$/i.test(file) && !/\/brand\/(favicon|icon|apple)/.test(file)) {
    slim(file).then(({ type, body }) => { res.writeHead(200, { 'Content-Type': type }); res.end(body); })
      .catch(() => { res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res); });
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

let browser;
try {
  browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--font-render-hinting=none'] });
  for (const job of JOBS) {
    if (!fs.existsSync(path.join(dist, job.page.slice(1) + '.html'))) { console.warn(`[pdf] dist${job.page}.html غير موجود`); continue; }
    const out = path.join(dist, job.file);
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}${base}${job.page}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: out, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, ...job.pdf });
    await page.close();
    const pages = (fs.readFileSync(out, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(`[pdf] ${path.relative(process.cwd(), out)} · ${pages} صفحة · ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
  // أجزاء السيرة (الغلاف، كل قسم، الخاتمة) تُدمج في متصفح الزائر لتصدير النسخة المخصّصة بمقاس A4 مباشرة
  if (fs.existsSync(path.join(dist, 'profile.html'))) {
    // كل بناء في مجلد بإصدار خاص، فلا يختلط جزء مخزَّن قديماً في المتصفح أو الشبكة بملف manifest جديد
    const ver = Date.now().toString(36);
    const root = path.join(dist, 'cv-parts');
    fs.rmSync(root, { recursive: true, force: true });
    const parts = path.join(root, ver);
    fs.mkdirSync(parts, { recursive: true });
    const probe = await browser.newPage();
    await probe.goto(`http://127.0.0.1:${port}${base}/profile`, { waitUntil: 'networkidle' });
    const ids = await probe.evaluate(() => [...document.querySelectorAll('[data-sec]')].map((e) => e.dataset.sec));
    await probe.close();
    // الغلاف بمقاس A4 كاملاً؛ وكل قسم والخاتمة صفحة واحدة طويلة بعرض 180mm، مع إحداثيات نقاط القصّ (بداية كل عنصر) ليرصّها المتصفح متصلة حسب اختيار الزائر
    // المفاتيح: [en-][s-]id لكل لغة (عربي/إنجليزي) ونمط (كامل/مختصر)
    let total = 0;
    const manifest = {};
    const plan = [];
    for (const [lp, route] of [['', '/profile'], ['en-', '/profile-en']]) {
      const cover = await browser.newPage();
      await cover.goto(`http://127.0.0.1:${port}${base}${route}?part=cover`, { waitUntil: 'networkidle' });
      await cover.evaluate(() => document.fonts.ready);
      await cover.emulateMedia({ media: 'print' });
      await cover.pdf({ path: path.join(parts, lp + 'cover.pdf'), printBackground: true, format: 'A4', margin: { top: '14mm', right: '15mm', bottom: '17mm', left: '15mm' } });
      await cover.close();
      for (const [pre, mode] of [['', ''], ['s-', '&mode=short']]) {
        plan.push(...ids.map((id) => [lp + pre + id, route, `part=sec&s=${encodeURIComponent(id)}&pack=1${mode}`, false]), [lp + pre + 'tail', route, `part=tail&pack=1${mode}`, true]);
      }
    }
    // أجزاء متوازية (4 صفحات معاً) لتقصير زمن البناء
    const one = async ([name, route, qs, tail]) => {
      const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
      await page.goto(`http://127.0.0.1:${port}${base}${route}?${qs}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: 'print' });
      const info = await page.evaluate((isTail) => {
        const shown = (e) => e.getClientRects().length > 0;
        const els = [...document.querySelectorAll(isTail ? '[data-tail]' : '[data-sec]')].filter((e) => !e.classList.contains('pf-off') && shown(e));
        const y = (e, k) => e.getBoundingClientRect()[k] + scrollY;
        const top = y(els[0], 'top'), bottom = y(els.at(-1), 'bottom');
        const brk = [...document.querySelectorAll('[data-brk]')].filter((e) => !e.closest('.pf-off') && shown(e)).map((e) => y(e, 'top') - top);
        const th = [...els[0].querySelectorAll('.pf-tbl thead')].find(shown);
        return { w: document.querySelector('.pf').getBoundingClientRect().width, h: bottom - top, brk: brk.slice(1), top, thead: th ? [y(th, 'top') - top, y(th, 'bottom') - top] : null };
      }, tail);
      const out = path.join(parts, name + '.pdf');
      // يُقصّ أعلى الصفحة عند بداية القسم، فتبدأ الصفحة الطويلة من الحافة العليا للقسم
      await page.addStyleTag({ content: `@page{size:${info.w}px ${Math.ceil(info.top + info.h) + 2}px;margin:0}html,body{margin:0}` });
      await page.pdf({ path: out, printBackground: true, width: `${info.w}px`, height: `${Math.ceil(info.top + info.h) + 2}px`, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' });
      await page.close();
      manifest[name] = { w: info.w, top: info.top, h: info.h, pageH: Math.ceil(info.top + info.h) + 2, brk: info.brk, thead: info.thead };
      total += fs.statSync(out).size;
    };
    const queue = [...plan];
    await Promise.all(Array.from({ length: 4 }, async () => { for (let it = queue.shift(); it; it = queue.shift()) await one(it); }));
    fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ v: ver, parts: manifest }));
    console.log(`[pdf] dist/cv-parts · ${plan.length + 2} جزءاً · ${(total / 1024).toFixed(0)} KB`);
  }
} catch (e) {
  fail('تعذّر توليد PDF: ' + e.message);
} finally {
  await browser?.close();
  server.close();
}
