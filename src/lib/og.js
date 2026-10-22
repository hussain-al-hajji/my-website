// صور المشاركة (Open Graph): تُولَّد وقت البناء من SVG بخط عربي مضمَّن.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = process.cwd();
const fontFiles = ['src/fonts/og/arabic-bold.ttf', 'src/fonts/og/latin-bold.ttf'].map((f) => path.join(root, f));
const logoSvg = fs.readFileSync(path.join(root, 'public/brand/logo-name-gold.svg'), 'utf8');
const logoPath = /<path[^>]* d="([^"]+)"/.exec(logoSvg)?.[1] || '';

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
  const body = lines.map((l, i) => `<text x="1140" y="${(y0 + i * lh).toFixed(0)}" font-family="OG Arabic" font-size="${size}" font-weight="700" fill="#f5f5f2" direction="rtl" text-anchor="end">${esc(l)}</text>`).join('');
  const k = kicker ? `<text x="1140" y="${(y0 - lh * 0.92).toFixed(0)}" font-family="OG Arabic" font-size="30" font-weight="700" fill="#c48e44" direction="rtl" text-anchor="end">${esc(kicker)}</text>` : '';
  const sc = 300 / 2600;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#0b0b0a"/>
<rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="#2c2c29" stroke-width="2"/>
<g transform="translate(${1140 - 300} 52) scale(${sc})"><path d="${logoPath}" fill="#c48e44" fill-rule="evenodd"/></g>
${k}${body}
<line x1="60" y1="548" x2="1140" y2="548" stroke="#2c2c29" stroke-width="2"/>
<text x="1140" y="584" font-family="OG Arabic" font-size="28" font-weight="700" fill="#a3a29b" direction="rtl" text-anchor="end">مدرب ومرشد مهني معتمد، أمكّن الشباب</text>
<text x="60" y="584" font-family="OG Latin" font-size="26" font-weight="700" fill="#a3a29b" text-anchor="start">hussain-al-hajji.com</text>
</svg>`;
  const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'OG Arabic' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return png;
}
