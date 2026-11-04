// دمج أجزاء السيرة الذاتية (المولَّدة عند البناء) في ملف A4 واحد حسب أقسام الزائر.
// يُستخدم في المتصفح (نافذة التخصيص)، وعند البناء لقياس أكبر حجم ممكن للملف المستخرج ومنعه من تجاوز الحد.
const PT = 0.75, MM = 72 / 25.4;                       // بكسل CSS إلى نقطة، وملم إلى نقطة
const A4 = [595.28, 841.89], TOP = 14 * MM, BOTTOM = 17 * MM, LEFT = 15 * MM, GAP = 6 * MM;

/**
 * PDFLib: وحدة pdf-lib. load(name): تعيد PDFDocument الجزء. manifest: أبعاد الأجزاء ونقاط قصّها.
 */
export async function mergeCv({ PDFLib, load, manifest }, ids, short, lang) {
  const { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = PDFLib;
  const lp = lang === 'en' ? 'en-' : '', pre = lp + (short ? 's-' : '');
  const out = await PDFDocument.create();

  const cover = await load(lp + 'cover');
  (await out.copyPages(cover, cover.getPageIndices())).forEach((pg) => out.addPage(pg));

  let page = null, y = 0;
  const fresh = () => { page = out.addPage(A4); y = A4[1] - TOP; };
  const room = () => y - BOTTOM;
  fresh(); // الخبرات تبدأ من الصفحة الثانية

  for (const key of [...ids, 'tail']) {
    const name = pre + key, m = manifest[name]; if (!m) continue;
    const src = await load(name);
    // لكل جزء بين نقطتي قصّ صفحة نصها وحده (والرسم كاملاً)، ولرأس الجدول صفحة خاصة؛ فلا يتكرر نص القسم في كل صفحة A4
    const embs = await out.embedPdf(src, src.getPageIndices());
    const emb = embs[0];
    // حماية من اختلاط الإصدارات: مقاس الصفحة الفعلي يجب أن يطابق ما سُجّل وقت التوليد وإلا نعود للنسخة الكاملة
    if (Math.abs(emb.width - m.w * PT) > 3 || Math.abs(emb.height - m.pageH * PT) > 3) throw new Error('size mismatch ' + name);
    if (m.chunks && embs.length < m.chunks) throw new Error('chunks mismatch ' + name);
    const W = m.w * PT, H = (m.h + m.top) * PT;
    // مقطع من الصفحة الطويلة من a إلى b (بكسل من أعلاها) يُرسم أعلاه عند y
    const draw = (a, b, yTop, src = emb) => {
      const hh = (b - a) * PT;
      page.pushOperators(pushGraphicsState(), rectangle(LEFT, yTop - hh, W, hh), clip(), endPath());
      page.drawPage(src, { x: LEFT, y: yTop - H + (a + m.top) * PT, width: W, height: H });
      page.pushOperators(popGraphicsState());
      return hh;
    };
    const cuts = [0, ...m.brk, m.h], cap = A4[1] - TOP - BOTTOM, rule = rgb(0.514, 0.329, 0.063);
    for (let k = 0; k < cuts.length - 1; k++) {
      let a = cuts[k];
      const part = m.chunks ? embs[k] : emb;
      const b = cuts[k + 1], atTop = () => y >= A4[1] - TOP - 0.5;
      const th = m.thead && k > 0 ? (m.thead[1] - m.thead[0]) * PT + 1.4 : 0;   // رأس الجدول يتكرر أعلى الصفحة التي يستمر فيها
      const startPage = () => {
        fresh();
        if (th) { page.drawRectangle({ x: LEFT, y: y - 1.4, width: W, height: 1.4, color: rule }); y -= 1.4; y -= draw(m.thead[0], m.thead[1], y, m.headPage >= 0 ? embs[m.headPage] : emb); }
      };
      const need = (b - a) * PT;
      if (need + th <= cap) {
        let gap = k === 0 && !atTop() ? GAP : 0;
        if (y - gap - need < BOTTOM) { startPage(); gap = 0; }
        y -= gap;
        y -= draw(a, b, y, part);
      } else {
        // قطعة أطول من صفحة كاملة (نادرة): تُقصّ على حدود الصفحات
        if (k === 0 && !atTop()) y -= GAP;
        while (b - a > 0.5) {
          if (y - BOTTOM < 60) startPage();
          const take = Math.min(b - a, (y - BOTTOM) / PT);
          y -= draw(a, a + take, y, part); a += take;
        }
      }
    }
  }

  const font = await out.embedFont(StandardFonts.Helvetica), pages = out.getPages();
  pages.forEach((p, i) => {
    const t = `${i + 1} / ${pages.length}`, w = font.widthOfTextAtSize(t, 8);
    p.drawText(t, { x: (p.getWidth() - w) / 2, y: 20, size: 8, font, color: rgb(0.55, 0.55, 0.52) });
  });
  out.setTitle(lang === 'en' ? 'Curriculum Vitae - Hussain Al-Hajji' : 'السيرة الذاتية - حسين الحاجي'); out.setLanguage(lang === 'en' ? 'en' : 'ar');
  try { await out.flush(); dedupeImages(PDFLib, out); } catch { /* يبقى الملف كما هو */ }
  return out.save();
}

// كل جزء يضمّن صوره وملفات ألوانه (ICC) بنفسه، فتتكرر الشعارات نفسها في عدة أجزاء؛ نُبقي نسخة واحدة من كل متطابق ونوجّه إليها المراجع،
// ثم تُحذف الكائنات التي لم يعد يشير إليها شيء
function dedupeImages({ PDFName, PDFRawStream, PDFRef, PDFDict, PDFArray }, doc) {
  const ctx = doc.context, N = (k) => PDFName.of(k);
  const sub = (o) => String(o.dict.get(N('Subtype')) ?? '');
  const isImg = (o) => o instanceof PDFRawStream && sub(o) === '/Image';
  const isIcc = (o) => o instanceof PDFRawStream && o.dict.has(N('N')) && !sub(o);
  const hash = (u8) => { let a = 0x811c9dc5, b = 0x1b873593; for (let i = 0; i < u8.length; i++) { a = Math.imul(a ^ u8[i], 16777619); b = Math.imul(b + u8[i], 2246822519) ^ (b >>> 13); } return (a >>> 0).toString(36) + (b >>> 0).toString(36) + u8.length; };
  const remap = new Map();
  const str = (v) => (v instanceof PDFArray ? '[' + v.asArray().map(str).join(',') + ']' : v instanceof PDFRef ? (remap.get(v) || v).toString() : String(v ?? ''));
  // فضاء اللون مصفوفة تشير إلى ملف ICC؛ نقارن بمحتوى الملف لا برقمه
  const cs = (v) => (v instanceof PDFArray ? '[' + v.asArray().map((e) => { const t = e instanceof PDFRef ? ctx.lookup(e) : e; return t instanceof PDFRawStream ? 'S' + hash(t.contents) : String(t); }).join(',') + ']' : str(v));
  const pass = (match, keyOf) => {
    const seen = new Map();
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (remap.has(ref) || !match(obj)) continue;
      const key = keyOf(obj);
      if (seen.has(key)) remap.set(ref, seen.get(key)); else seen.set(key, ref);
    }
    if (!remap.size) return;
    const fix = (v, set) => { if (v instanceof PDFRef && remap.has(v)) set(remap.get(v)); else if (v instanceof PDFDict) walkDict(v); else if (v instanceof PDFArray) walkArr(v); };
    const walkDict = (d) => { for (const [k, v] of d.entries()) fix(v, (n) => d.set(k, n)); };
    const walkArr = (a) => { a.asArray().forEach((v, i) => fix(v, (n) => a.set(i, n))); };
    for (const [, obj] of ctx.enumerateIndirectObjects()) {
      if (obj instanceof PDFDict) walkDict(obj);
      else if (obj instanceof PDFArray) walkArr(obj);
      else if (obj instanceof PDFRawStream) walkDict(obj.dict);
    }
  };
  const g = (o, k) => String(o.dict.get(N(k)) ?? '');
  pass(isIcc, (o) => 'icc|' + g(o, 'N') + '|' + hash(o.contents));
  const imgKey = (o) => [g(o, 'Width'), g(o, 'Height'), g(o, 'BitsPerComponent'), cs(o.dict.get(N('ColorSpace'))), g(o, 'Filter'), g(o, 'Decode'), str(o.dict.get(N('SMask'))), str(o.dict.get(N('Mask'))), hash(o.contents)].join('|');
  pass((o) => isImg(o) && !o.dict.has(N('SMask')), imgKey);       // الصور الرمادية (أقنعة الشفافية) أولاً، ثم الملوّنة بعد توحيد مراجع أقنعتها
  pass((o) => isImg(o) && o.dict.has(N('SMask')), imgKey);
  // كنس: كل كائن لا يمكن الوصول إليه من جذر الملف يُحذف
  const live = new Set(), todo = [ctx.trailerInfo.Root];
  const visit = (v) => { if (v instanceof PDFRef) { if (!live.has(v)) { live.add(v); todo.push(ctx.lookup(v)); } } else if (v instanceof PDFDict) { for (const [, x] of v.entries()) visit(x); } else if (v instanceof PDFArray) { v.asArray().forEach(visit); } else if (v instanceof PDFRawStream) { visit(v.dict); } };
  while (todo.length) visit(todo.pop());
  if (ctx.trailerInfo.Info) visit(ctx.trailerInfo.Info);
  for (const [ref] of [...ctx.enumerateIndirectObjects()]) if (!live.has(ref)) ctx.delete(ref);
}
