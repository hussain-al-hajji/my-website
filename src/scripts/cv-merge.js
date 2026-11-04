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
  return out.save();
}

