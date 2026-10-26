// صور المشاركة (Open Graph): تُولَّد وقت البناء من SVG بخط عربي مضمَّن.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { site } from './site.js';

const root = process.cwd();
const fontFiles = ['src/fonts/og/arabic-bold.ttf', 'src/fonts/og/latin-bold.ttf'].map((f) => path.join(root, f));

// الشعار الكامل: الاسم مع السلوقن تحته، يُرسم بلون واحد
const fullLogo = fs.readFileSync(path.join(root, 'public/brand/logo-full-light.svg'), 'utf8');
const fullPaths = [...fullLogo.matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function wrap(text, max, lines) {
  const words = String(text).trim().split(/\s+/);
  const out = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/[\s،.:؛]*$/, '') + '…'; }
  return out;
}

export function renderOg({ title, kicker = '' }) {
  const lines = wrap(title, 26, 3);
  const size = lines.length > 2 ? 62 : 72;
  const lh = size * 1.45;
  const total = lines.length * lh;
  const y0 = 372 - total / 2 + size;
  const body = lines.map((l, i) => `<text x="1140" y="${(y0 + i * lh).toFixed(0)}" font-family="OG Arabic" font-size="${size}" font-weight="700" fill="#1b1b1a" direction="rtl" text-anchor="end">${esc(l)}</text>`).join('');
  const k = kicker ? `<text x="1140" y="${(y0 - lh * 0.92).toFixed(0)}" font-family="OG Arabic" font-size="30" font-weight="700" fill="#835410" direction="rtl" text-anchor="end">${esc(kicker)}</text>` : '';
  const sc = 300 / 2600;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f5f5f2"/>
<rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="#d9d8d2" stroke-width="2"/>
<g transform="translate(${1140 - 300} 44) scale(${sc})" fill="#1b1b1a" fill-rule="evenodd">${fullPaths.map((d) => `<path d="${d}"/>`).join('')}</g>
${k}${body}
<line x1="60" y1="548" x2="1140" y2="548" stroke="#d9d8d2" stroke-width="2"/>
<text x="1140" y="584" font-family="OG Arabic" font-size="25" font-weight="700" fill="#6b6a64" direction="rtl" text-anchor="end">${esc(site.role + '، ' + (site.focus || ''))}</text>
<text x="60" y="108" font-family="OG Latin" font-size="26" font-weight="700" fill="#6b6a64" text-anchor="start">hussain-al-hajji.com</text>
</svg>`;
  const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'OG Arabic' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return png;
}

// صورة مشاركة الصفحة الرئيسية: رسم الرصاص بجانب الاسم والسلوقن بالمخطوطة السوداء
const portraitB64 = fs.readFileSync(path.join(root, 'src/assets/og-portrait.png')).toString('base64');


// سطرا التعريف تحت الاسم؛ الخط العربي المضمَّن بلا رمز «|» فيُرسم الفاصل خطاً، وتُقاس القطع لتُرصّ من اليمين إلى اليسار
const fontOpts = { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'OG Arabic' } };
const textW = (t, size) => new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200"><text x="10" y="100" font-family="OG Arabic" font-size="${size}" font-weight="700" direction="rtl">${esc(t)}</text></svg>`, fontOpts).getBBox()?.width || t.length * size * 0.5;
function ogLines(cx, y0) {
  return (site.hero.ogLines || []).slice(0, 2).map((line, i) => {
    const size = i ? 30 : 24, fill = i ? '#835410' : '#3a3a37', y = y0 + i * 52;
    const parts = line.split('|').map((t) => t.trim()).filter(Boolean), gap = 22;
    const ws = parts.map((t) => textW(t, size));
    let x = cx + (ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1)) / 2, out = '';
    parts.forEach((t, k) => {
      out += `<text x="${(x - ws[k] / 2).toFixed(1)}" y="${y.toFixed(0)}" font-family="OG Arabic" font-size="${size}" font-weight="700" fill="${fill}" direction="rtl" text-anchor="middle">${esc(t)}</text>`;
      x -= ws[k];
      if (k < parts.length - 1) out += `<rect x="${(x - gap / 2 - 1).toFixed(1)}" y="${y - size * 0.8}" width="2" height="${size * 0.95}" fill="#b9b8b1"/>`;
      x -= gap;
    });
    return out;
  }).join('');
}

export function renderHomeOg() {
  const lw = 590, sc = lw / 2600, lh = 961 * sc;
  const ph = 590, pw = Math.round(ph * 620 / 768);
  const lx = 1160 - lw, ly = (630 - lh) / 2 - 10;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f5f5f2"/>
<image x="64" y="30" width="${pw}" height="${ph - 20}" preserveAspectRatio="xMidYMax slice" xlink:href="data:image/png;base64,${portraitB64}"/>
<g transform="translate(${lx} ${ly.toFixed(0)}) scale(${sc})" fill="#161615" fill-rule="evenodd">${fullPaths.map((d) => `<path d="${d}"/>`).join('')}</g>
${ogLines(lx + lw / 2, ly + lh + 62)}
<text x="1160" y="592" font-family="OG Latin" font-size="26" font-weight="700" fill="#8a8984" text-anchor="end">hussain-al-hajji.com</text>
</svg>`;
  return new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'OG Latin' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
