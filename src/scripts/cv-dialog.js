// تخصيص السيرة الذاتية: أي رابط إلى ملف السيرة PDF يفتح نافذة اختيار الأقسام.
// كل قسم مولَّد مسبقاً صفحةً طويلة واحدة مع نقاط القصّ بين عناصره؛ فيرصّها المتصفح متتابعة على صفحات A4 (قسم يبدأ بعد الذي قبله)
// ثم يُنزَّل الملف مباشرة مع ترقيم الصفحات.
const dlg = document.getElementById('cvDialog');
const PT = 0.75, MM = 72 / 25.4;                       // بكسل CSS إلى نقطة، وملم إلى نقطة
const A4 = [595.28, 841.89], TOP = 14 * MM, BOTTOM = 17 * MM, LEFT = 15 * MM, GAP = 6 * MM;

async function build(ids, short, lang) {
  const { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = await import('pdf-lib');
  const root = dlg.dataset.parts;
  // manifest يحدّد إصدار الأجزاء؛ إن كان قديماً (مخزَّناً) فتغيب أجزاؤه، فيُعاد جلبه بلاحقة جديدة
  const fetchManifest = async (bust) => { const r = await fetch(`${root}/manifest.json${bust ? '?t=' + Date.now() : ''}`, { cache: 'no-store' }); if (!r.ok) throw new Error('manifest'); return r.json(); };
  let data = await fetchManifest(false);
  const head = await fetch(`${root}/${data.v}/cover.pdf`, { method: 'HEAD' }).catch(() => null);
  if (!head || !head.ok) data = await fetchManifest(true);
  const manifest = data.parts, base = `${root}/${data.v}`;
  const load = async (name) => { const r = await fetch(`${base}/${name}.pdf`); if (!r.ok) throw new Error(name); return PDFDocument.load(await r.arrayBuffer()); };
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
    const [emb] = await out.embedPdf(src, [0]);
    // حماية من اختلاط الإصدارات: مقاس الصفحة الفعلي يجب أن يطابق ما سُجّل وقت التوليد وإلا نعود للنسخة الكاملة
    if (Math.abs(emb.width - m.w * PT) > 3 || Math.abs(emb.height - m.pageH * PT) > 3) throw new Error('size mismatch ' + name);
    const W = m.w * PT, H = (m.h + m.top) * PT;
    // مقطع من الصفحة الطويلة من a إلى b (بكسل من أعلاها) يُرسم أعلاه عند y
    const draw = (a, b, yTop) => {
      const hh = (b - a) * PT;
      page.pushOperators(pushGraphicsState(), rectangle(LEFT, yTop - hh, W, hh), clip(), endPath());
      page.drawPage(emb, { x: LEFT, y: yTop - H + (a + m.top) * PT, width: W, height: H });
      page.pushOperators(popGraphicsState());
      return hh;
    };
    const cuts = [0, ...m.brk, m.h], cap = A4[1] - TOP - BOTTOM, rule = rgb(0.514, 0.329, 0.063);
    for (let k = 0; k < cuts.length - 1; k++) {
      let a = cuts[k];
      const b = cuts[k + 1], atTop = () => y >= A4[1] - TOP - 0.5;
      const th = m.thead && k > 0 ? (m.thead[1] - m.thead[0]) * PT + 1.4 : 0;   // رأس الجدول يتكرر أعلى الصفحة التي يستمر فيها
      const startPage = () => {
        fresh();
        if (th) { page.drawRectangle({ x: LEFT, y: y - 1.4, width: W, height: 1.4, color: rule }); y -= 1.4; y -= draw(m.thead[0], m.thead[1], y); }
      };
      const need = (b - a) * PT;
      if (need + th <= cap) {
        let gap = k === 0 && !atTop() ? GAP : 0;
        if (y - gap - need < BOTTOM) { startPage(); gap = 0; }
        y -= gap;
        y -= draw(a, b, y);
      } else {
        // قطعة أطول من صفحة كاملة (نادرة): تُقصّ على حدود الصفحات
        if (k === 0 && !atTop()) y -= GAP;
        while (b - a > 0.5) {
          if (y - BOTTOM < 60) startPage();
          const take = Math.min(b - a, (y - BOTTOM) / PT);
          y -= draw(a, a + take, y); a += take;
        }
      }
    }
  }

  const font = await out.embedFont(StandardFonts.Helvetica), pages = out.getPages();
  pages.forEach((p, i) => {
    const t = `${i + 1} / ${pages.length}`, w = font.widthOfTextAtSize(t, 8);
    p.drawText(t, { x: (p.getWidth() - w) / 2, y: 20, size: 8, font, color: rgb(0.55, 0.55, 0.52) });
  });
  out.setTitle('السيرة الذاتية - حسين الحاجي'); out.setLanguage('ar');
  return out.save();
}

if (dlg && typeof dlg.showModal === 'function') {
  const KEY = 'cv-sections', LKEY = 'cv-lang';
  const radios = [...dlg.querySelectorAll('input[name=cvlang]')];
  const lang = () => (radios.find((r) => r.checked) || {}).value || 'ar';
  const paint = () => {
    const l = lang();
    dlg.querySelectorAll('[data-ar]').forEach((el) => { el.textContent = el.dataset[l]; });
    const a = dlg.querySelector('a[download]'); if (a) a.href = a.dataset['href' + (l === 'en' ? 'En' : 'Ar')];
    dlg.querySelector('.cv-box').dir = l === 'en' ? 'ltr' : 'rtl';
  };
  try { const sl = localStorage.getItem(LKEY); if (sl) radios.forEach((r) => { r.checked = r.value === sl; }); } catch { /* تجاهل */ }
  radios.forEach((r) => r.addEventListener('change', () => { try { localStorage.setItem(LKEY, lang()); } catch { /* تجاهل */ } paint(); }));
  paint();
  const boxes = [...dlg.querySelectorAll('.cv-opt input')];
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(saved)) boxes.forEach((b) => { b.checked = saved.includes(b.value); }); } catch { /* تجاهل */ }
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href$="hussain-al-hajji-profile.pdf"]');
    if (!a || a.closest('dialog') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); dlg.showModal(); dlg.querySelector('h2').focus();
  });
  dlg.querySelectorAll('[data-cv-all]').forEach((b) => b.addEventListener('click', () => boxes.forEach((x) => { x.checked = b.dataset.cvAll === '1'; })));
  dlg.querySelectorAll('[data-cv-go]').forEach((go) => go.addEventListener('click', async () => {
    const ids = boxes.filter((b) => b.checked).map((b) => b.value);
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* تجاهل */ }
    const all = dlg.querySelectorAll('[data-cv-go]'), labels = [...all].map((b) => b.textContent);
    all.forEach((b) => { b.disabled = true; });
    go.textContent = 'جارٍ إنشاء الملف…';
    try {
      const url = URL.createObjectURL(new Blob([await build(ids, go.dataset.cvGo === 'short', lang())], { type: 'application/pdf' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `hussain-al-hajji-cv${lang() === 'en' ? '-en' : ''}${go.dataset.cvGo === 'short' ? '-short' : ''}.pdf` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      dlg.close();
    } catch (err) {
      console.error(err); try { sessionStorage.setItem('cvErr', String(err && err.message || err)); } catch { /* تجاهل */ }
      location.href = dlg.querySelector('a[download]').href; // تعذّر الدمج: تُنزَّل النسخة الكاملة
    } finally { all.forEach((b, i) => { b.disabled = false; b.textContent = labels[i]; }); }
  }));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}
