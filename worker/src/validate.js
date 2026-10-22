// فحص ما يُرسل للنشر: مسارات مسموحة فقط، JSON صالح، صور WebP بحجم معقول.
export const LIST_FILES = ['bio', 'courses', 'faq', 'featured', 'gallery', 'highlights', 'honors', 'kits', 'media', 'news', 'partners', 'posters', 'posts', 'projects', 'records', 'ring', 'testimonials'];
export const OBJECT_FILES = ['award', 'pages', 'site'];
const DATA_RE = /^src\/data\/([a-z0-9-]+)\.json$/;
const IMG_RE = /^public\/img\/uploads\/[a-z0-9][a-z0-9-]{0,60}\.webp$/;
export const LIMITS = { files: 25, imageBytes: 1_500_000, jsonBytes: 2_000_000, totalBytes: 9_000_000 };

export class ValidationError extends Error {}
const fail = (m) => { throw new ValidationError(m); };

const b64Bytes = (s) => Math.floor((s.length * 3) / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);

/** يعيد قائمة ملفات جاهزة للإيداع، أو يرمي ValidationError. */
export function validatePublish(body) {
  if (!body || !Array.isArray(body.files) || !body.files.length) fail('لا ملفات للنشر.');
  if (body.files.length > LIMITS.files) fail('عدد الملفات أكبر من المسموح.');
  let total = 0;
  const seen = new Set();
  const out = body.files.map((f) => {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') fail('ملف غير صالح.');
    if (seen.has(f.path)) fail('مسار مكرر: ' + f.path);
    seen.add(f.path);
    const dm = DATA_RE.exec(f.path);
    if (dm) {
      const name = dm[1];
      if (![...LIST_FILES, ...OBJECT_FILES].includes(name)) fail('ملف بيانات غير معروف: ' + name);
      if (f.content.length > LIMITS.jsonBytes) fail('ملف كبير: ' + f.path);
      let data;
      try { data = JSON.parse(f.content); } catch { fail('JSON غير صالح في ' + f.path); }
      if (LIST_FILES.includes(name)) {
        if (!Array.isArray(data)) fail(f.path + ' يجب أن يكون قائمة.');
        if (data.some((x) => !x || typeof x !== 'object' || Array.isArray(x))) fail('عناصر غير صالحة في ' + f.path);
      } else if (!data || typeof data !== 'object' || Array.isArray(data)) fail(f.path + ' يجب أن يكون كائناً.');
      total += f.content.length;
      return { path: f.path, content: JSON.stringify(data, null, 2) + '\n', encoding: 'utf-8' };
    }
    if (IMG_RE.test(f.path)) {
      if (f.encoding !== 'base64' || !/^[A-Za-z0-9+/]+={0,2}$/.test(f.content)) fail('صورة غير صالحة: ' + f.path);
      const bytes = b64Bytes(f.content);
      if (bytes > LIMITS.imageBytes) fail('الصورة أكبر من المسموح: ' + f.path);
      const head = riffHead(f.content);
      if (head !== 'RIFF') fail('الصورة ليست WebP: ' + f.path);
      total += bytes;
      return { path: f.path, content: f.content, encoding: 'base64' };
    }
    return fail('مسار غير مسموح: ' + f.path);
  });
  if (total > LIMITS.totalBytes) fail('الحجم الإجمالي كبير.');
  const message = String(body.message || 'تحديث المحتوى من لوحة التحكم').replace(/[\r\n]+/g, ' ').slice(0, 120);
  return { files: out, message };
}

function riffHead(b64) {
  return atob(b64.slice(0, 8)).slice(0, 4);
}
