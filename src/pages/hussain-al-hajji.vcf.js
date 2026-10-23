// بطاقة اتصال (vCard) تُولَّد وقت البناء من بيانات الموقع، فتتحدّث مع لوحة التحكم.
import fs from 'node:fs';
import path from 'node:path';
import { site, abs } from '../lib/site.js';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
// طيّ الأسطر على 75 بايتاً كما تشترط الصيغة، دون كسر حرف متعدد البايتات
function fold(line) {
  const out = []; let cur = '', bytes = 0, limit = 74;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 74; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

export function GET() {
  const c = site.contact;
  const photo = fs.readFileSync(path.join(process.cwd(), 'src/assets/vcard-photo.jpg')).toString('base64');
  const [first, ...rest] = site.name.split(' ');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(rest.join(' '))};${esc(first)};;;`,
    `FN:${esc(site.name)}`,
    `ORG:${esc(site.tagline)}`,
    `TITLE:${esc(site.role)}`,
    `TEL;TYPE=CELL,VOICE:${c.phone.replace(/\s/g, '')}`,
    `EMAIL;TYPE=INTERNET,WORK:${c.email}`,
    `URL:${abs('/')}`,
    `URL;TYPE=LinkedIn:${c.linkedin}`,
    `ADR;TYPE=WORK:;;;;;;${esc(c.country)}`,
    `NOTE:${esc(site.description)}`,
    `PHOTO;ENCODING=b;TYPE=JPEG:${photo}`,
    'END:VCARD',
  ];
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/vcard; charset=utf-8' },
  });
}
