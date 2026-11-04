// يولّد الملف التعريفي (/profile) وملف الأعمال (/portfolio) بصيغة PDF بعد بناء الموقع، فيتجدّدان مع كل نشر.
// إن لم يتوفر متصفح يُكتفى بتحذير، إلا إن ضُبط REQUIRE_PDF=1.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { fixPdf, splitPdf, pageCount } from './pdf-text.mjs';
import { mergeCv } from '../src/scripts/cv-merge.js';

// يحوّل Chrome صور webp إلى PNG ضخمة داخل الملف، فنقدّم له نسخاً مصغّرة: JPEG للصور، وPNG للصور الشفافة
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('[pdf] sharp غير متوفر، ستُستخدم الصور كما هي'); }
// سقف حجم أي ملف يستخرجه الزائر، بهامش أمان: السيرة الذاتية بكل نماذجها أقل من 2 ميجا، والبورتفوليو أقل من 5 ميجا.
// تُبدأ الصور بأعلى جودة، وتُخفَّض درجة بعد أخرى حتى يدخل الملف تحت السقف؛ والنص يبقى متجهاً بلا أي تغيير
const PF_BUDGET = Number(process.env.PDF_MAX_BYTES) || 4_800_000;
const CV_BUDGET = Number(process.env.CV_MAX_BYTES) || 1_950_000;
const PF_TIERS = [
  { max: 1100, q: 78, pal: 90 }, { max: 1000, q: 72, pal: 80 }, { max: 900, q: 66, pal: 70 },
  { max: 800, q: 60, pal: 60 }, { max: 700, q: 54, pal: 50 }, { max: 600, q: 48, pal: 40 },
];
// صور السيرة صغيرة العرض (شعارات جهات بعرض نحو 12mm وصور بحجم الإبهام)، فتتحمّل أبعاداً أقل
const CV_TIERS = [
  { max: 900, q: 72, pal: 85 }, { max: 700, q: 64, pal: 75 }, { max: 560, q: 56, pal: 65 },
  { max: 440, q: 50, pal: 55 }, { max: 340, q: 44, pal: 45 }, { max: 260, q: 40, pal: 40 },
];
let tier = 0, TIERS = PF_TIERS;
// آخر درجة جودة نجحت لكل ملف: يبدأ منها البناء فيكتفي بتوليد واحد بدل إعادة التوليد درجة بعد أخرى
const tiersFile = path.resolve('scripts/pdf-tiers.json');
let saved = {};
try { saved = JSON.parse(fs.readFileSync(tiersFile, 'utf8')); } catch { /* أول تشغيل */ }
const remember = (k, t) => { if (saved[k] !== t) { saved[k] = t; try { fs.writeFileSync(tiersFile, JSON.stringify(saved, null, 2) + '\n'); } catch { /* مجلد للقراءة فقط */ } } };
async function slim(file) {
  const T = TIERS[tier];
  const img = sharp(file), meta = await img.metadata();
  const r = img.resize({ width: T.max, height: T.max, fit: 'inside', withoutEnlargement: true });
  return meta.hasAlpha
    ? { type: 'image/png', body: await r.png({ compressionLevel: 9, palette: true, quality: T.pal }).toBuffer() }
    : { type: 'image/jpeg', body: await r.flatten({ background: '#ffffff' }).jpeg({ quality: T.q, mozjpeg: true }).toBuffer() };
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
  { page: '/portfolio-en', file: 'hussain-al-hajji-portfolio-en.pdf', pdf: { width: '297mm', height: '210mm', preferCSSPageSize: true } },
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

// الخط المتغيّر يُضمَّن في PDF بصيغة Type3 فيتشوّه النص العربي عند النسخ والبحث؛ فنقدّم للمتصفح نسخاً ثابتة الوزن منه (scripts/pdf-fonts)
const fontDir = path.resolve('scripts/pdf-fonts');
const ranges = {
  ar: 'U+0600-06FF,U+0750-077F,U+0870-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC',
  lat: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
};
const staticCss = ['ar', 'lat'].flatMap((t) => [300, 400, 500, 600, 700, 800].map((w) =>
  `@font-face{font-family:"NSA PDF";font-weight:${w};src:url("/__pdf-fonts/nsa-${t}-${w}.woff2") format("woff2");unicode-range:${ranges[t]}}`)).join('') +
  ':root{--font:"NSA PDF","Noto Sans Arabic",system-ui,sans-serif}';
const hasStatic = fs.existsSync(path.join(fontDir, 'nsa-ar-400.woff2'));
async function settle(page) {
  if (hasStatic) await page.addStyleTag({ content: staticCss });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(60);
  await page.evaluate(() => document.fonts.ready);
}

// إصلاح النص العربي ليُنسخ ويُبحث فيه؛ إن تعذّر يبقى الملف كما ولّده المتصفح
async function safe(fn, bytes, ...rest) {
  if (process.env.PDF_NOFIX) return bytes;
  try { return (await fn(bytes, ...rest)) || bytes; } catch (e) { console.warn(`[pdf] تعذّر إصلاح نص الملف: ${e.message}`); return bytes; }
}

// ذاكرة مؤقتة: ملفات PDF لا تتغير إلا إذا تغيّر مصدرها (صفحات السيرة والبورتفوليو وأنماطها وصورها المستخدمة وأكواد التوليد).
// تعديل أي صفحة أخرى (الإعلام، الأخبار...) لا يمسّها، فنعيد نسخها بدل ساعة من توليد جديد. تحفظ GitHub Actions المجلد .pdf-cache بين التشغيلات
const cacheRoot = path.resolve('.pdf-cache');
function fingerprint() {
  const h = crypto.createHash('sha1');
  const files = ['profile', 'profile-en', 'portfolio', 'portfolio-en'].map((n) => path.join(dist, n + '.html')).filter((f) => fs.existsSync(f));
  const refs = new Set();
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    h.update(html);
    for (const m of html.matchAll(/(?:src|href)="([^"]+\.css)"/g)) { const cf = path.join(dist, m[1].replace(base, '')); if (fs.existsSync(cf)) h.update(fs.readFileSync(cf)); }
    for (const m of html.matchAll(/["'(](\/(?:img|brand)\/[^"')\s?#]+)/g)) refs.add(m[1]);
  }
  for (const r of [...refs].sort()) { const f = path.join(dist, r.replace(base, '')); try { const st = fs.statSync(f); h.update(r + st.size); } catch { h.update(r + 'x'); } }
  for (const f of ['scripts/make-pdf.mjs', 'scripts/pdf-text.mjs', 'src/scripts/cv-merge.js']) { try { h.update(fs.readFileSync(f)); } catch { /* غير موجود */ } }
  for (const f of fs.readdirSync(fontDir)) h.update(fs.readFileSync(path.join(fontDir, f)));
  h.update(String(PF_BUDGET) + String(CV_BUDGET));
  return h.digest('hex').slice(0, 16);
}
const fp = process.env.PDF_NO_CACHE ? null : fingerprint();
const slot = fp ? path.join(cacheRoot, fp) : null;
if (slot && fs.existsSync(path.join(slot, 'done'))) {
  for (const j of JOBS) if (fs.existsSync(path.join(slot, j.file))) fs.copyFileSync(path.join(slot, j.file), path.join(dist, j.file));
  fs.rmSync(path.join(dist, 'cv-parts'), { recursive: true, force: true });
  if (fs.existsSync(path.join(slot, 'cv-parts'))) fs.cpSync(path.join(slot, 'cv-parts'), path.join(dist, 'cv-parts'), { recursive: true });
  console.log(`[pdf] ملفات PDF لم يتغيّر مصدرها (${fp})، أُعيد استخدام النسخة المحفوظة`);
  process.exit(0);
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/__pdf-fonts/')) {
    const f = path.join(fontDir, path.basename(p));
    if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'font/woff2' }); fs.createReadStream(f).pipe(res); return;
  }
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

let browser, okRun = false;
try {
  browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--font-render-hinting=none'] });
  for (const job of (process.env.PDF_SKIP_JOBS ? [] : JOBS.filter((j) => !process.env.PDF_ONLY_JOB || j.page === process.env.PDF_ONLY_JOB))) {
    if (!fs.existsSync(path.join(dist, job.page.slice(1) + '.html'))) { console.warn(`[pdf] dist${job.page}.html غير موجود`); continue; }
    const out = path.join(dist, job.file);
    const isCv = /profile/.test(job.page), BUDGET = isCv ? CV_BUDGET : PF_BUDGET;
    TIERS = isCv ? CV_TIERS : PF_TIERS;
    for (tier = Math.min(saved[job.file] || 0, TIERS.length - 1); ; tier++) {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}${base}${job.page}`, { waitUntil: 'networkidle' });
      await settle(page);
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: out, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, ...job.pdf });
      await page.close();
      fs.writeFileSync(out, await safe(fixPdf, fs.readFileSync(out)));      // نص عربي قابل للنسخ والبحث
      if (fs.statSync(out).size <= BUDGET || tier >= TIERS.length - 1) break;
      console.log(`[pdf] ${job.file}: ${(fs.statSync(out).size / 1048576).toFixed(2)} MB فوق السقف، تُخفَّض جودة الصور`);
    }
    remember(job.file, tier);
    const pages = await pageCount(fs.readFileSync(out));
    console.log(`[pdf] ${path.relative(process.cwd(), out)} · ${pages} صفحة · ${(fs.statSync(out).size / 1024).toFixed(0)} KB · جودة الصور ${tier + 1}/${TIERS.length}`);
    if (fs.statSync(out).size > BUDGET) console.warn(`[pdf] تحذير: ${job.file} ما زال فوق السقف (${(fs.statSync(out).size / 1048576).toFixed(2)} MB)`);
  }
  // أجزاء السيرة (الغلاف، كل قسم، الخاتمة) تُدمج في متصفح الزائر لتصدير النسخة المخصّصة بمقاس A4 مباشرة
  if (!process.env.PDF_SKIP_PARTS && fs.existsSync(path.join(dist, 'profile.html'))) {
    TIERS = CV_TIERS;
    const BUDGET = CV_BUDGET;
    for (tier = Math.min(Number(process.env.PDF_TIER) || saved.parts || 0, TIERS.length - 1); ; tier++) {
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
      await settle(cover);
      await cover.emulateMedia({ media: 'print' });
      const coverFile = path.join(parts, lp + 'cover.pdf');
      await cover.pdf({ path: coverFile, printBackground: true, format: 'A4', margin: { top: '14mm', right: '15mm', bottom: '17mm', left: '15mm' } });
      await cover.close();
      fs.writeFileSync(coverFile, await safe(fixPdf, fs.readFileSync(coverFile)));
      for (const [pre, mode] of [['', ''], ['s-', '&mode=short']]) {
        plan.push(...ids.map((id) => [lp + pre + id, route, `part=sec&s=${encodeURIComponent(id)}&pack=1${mode}`, false]), [lp + pre + 'tail', route, `part=tail&pack=1${mode}`, true]);
      }
    }
    // أجزاء متوازية (4 صفحات معاً) لتقصير زمن البناء
    const one = async ([name, route, qs, tail]) => {
      const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
      await page.goto(`http://127.0.0.1:${port}${base}${route}?${qs}`, { waitUntil: 'networkidle' });
      await settle(page);
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
      const pageH = Math.ceil(info.top + info.h) + 2;
      await page.pdf({ path: out, printBackground: true, width: `${info.w}px`, height: `${pageH}px`, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' });
      await page.close();
      // الصفحة الطويلة تُرسم في المتصفح مقصوصة على عدة صفحات A4، فلكل جزء (بين نقطتي قصّ) صفحة يحوي نصه وحده، ولرأس الجدول صفحة خاصة؛ كي لا يتكرر نص القسم كله في كل صفحة
      const PT = 0.75, cut = [0, ...info.brk.map((b) => (info.top + b) * PT), pageH * PT];
      const ranges = cut.slice(1).map((c, i) => [cut[i], c]);
      if (info.thead) ranges.push([(info.top + info.thead[0]) * PT - 1, (info.top + info.thead[1]) * PT + 1]);
      const bytes = fs.readFileSync(out);
      let split = null;
      try { split = await splitPdf(bytes, ranges); } catch (e) { console.warn(`[pdf] تعذّر توزيع نص ${name}: ${e.message}`); }
      fs.writeFileSync(out, split || await safe(fixPdf, bytes));
      manifest[name] = { w: info.w, top: info.top, h: info.h, pageH, brk: info.brk, thead: info.thead, ...(split ? { chunks: cut.length - 1, headPage: info.thead ? cut.length - 1 : -1 } : {}) };
      total += fs.statSync(out).size;
    };
    const queue = [...plan];
    await Promise.all(Array.from({ length: 4 }, async () => { for (let it = queue.shift(); it; it = queue.shift()) await one(it); }));
    fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ v: ver, parts: manifest }));
    console.log(`[pdf] dist/cv-parts · ${plan.length + 2} جزءاً · ${(total / 1024).toFixed(0)} KB`);
    // أكبر ملف يستطيع الزائر استخراجه (كل الأقسام، بكل لغة ونمط) يُقاس بالدمج نفسه الذي يجري في المتصفح، فإن تجاوز السقف تُخفَّض الصور وتُعاد الأجزاء
    let worst = 0;
    try {
      const PDFLib = await import('pdf-lib');
      const load = (n) => PDFLib.PDFDocument.load(fs.readFileSync(path.join(parts, n + '.pdf')));
      for (const lang of ['ar', 'en']) for (const short of [false, true]) worst = Math.max(worst, (await mergeCv({ PDFLib, load, manifest }, ids, short, lang)).length);
    } catch (e) { console.warn(`[pdf] تعذّر قياس حجم التصدير المخصّص: ${e.message}`); break; }
    remember('parts', tier);
    console.log(`[pdf] أكبر ملف سيرة مخصّص ${(worst / 1048576).toFixed(2)} MB · جودة الصور ${tier + 1}/${TIERS.length}`);
    if (process.env.PDF_ONCE || worst <= BUDGET || tier >= TIERS.length - 1) { if (worst > BUDGET) console.warn('[pdf] تحذير: التصدير المخصّص فوق السقف'); break; }
    }
  }
  okRun = true;
} catch (e) {
  fail('تعذّر توليد PDF: ' + e.message);
} finally {
  await browser?.close();
  server.close();
  // حفظ النتيجة للتشغيل القادم (ما لم يفشل شيء): نسخة واحدة فقط، تُحذف ما قبلها
  if (okRun && slot && !process.env.PDF_ONLY_JOB && !process.env.PDF_SKIP_PARTS && !process.env.PDF_NOFIX) {
    try {
      fs.rmSync(cacheRoot, { recursive: true, force: true });
      fs.mkdirSync(slot, { recursive: true });
      for (const j of JOBS) if (fs.existsSync(path.join(dist, j.file))) fs.copyFileSync(path.join(dist, j.file), path.join(slot, j.file));
      if (fs.existsSync(path.join(dist, 'cv-parts'))) fs.cpSync(path.join(dist, 'cv-parts'), path.join(slot, 'cv-parts'), { recursive: true });
      fs.writeFileSync(path.join(slot, 'done'), '1');
    } catch (e) { console.warn(`[pdf] تعذّر حفظ النسخة المؤقتة: ${e.message}`); }
  }
}
