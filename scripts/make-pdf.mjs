// يولّد الملف التعريفي (PDF) من صفحة /profile بعد بناء الموقع، فيتجدّد مع كل نشر.
// إن لم يتوفر متصفح يُكتفى بتحذير، إلا إن ضُبط REQUIRE_PDF=1.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const dist = path.resolve('dist');
const base = (process.env.SITE_BASE || '/').replace(/\/$/, '');
const out = path.join(dist, 'hussain-al-hajji-profile.pdf');
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
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

let browser;
try {
  browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}${base}/profile`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages = (fs.readFileSync(out, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`[pdf] ${path.relative(process.cwd(), out)} · ${pages} صفحة · ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
} catch (e) {
  fail('تعذّر توليد PDF: ' + e.message);
} finally {
  await browser?.close();
  server.close();
}
