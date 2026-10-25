// تخصيص السيرة الذاتية: أي رابط إلى ملف السيرة PDF يفتح نافذة اختيار الأقسام.
// الأجزاء (الغلاف، كل قسم، الخاتمة) مولَّدة مسبقاً بمقاس A4، فتُدمج هنا في المتصفح وتُنزَّل مباشرة مع ترقيم الصفحات.
const dlg = document.getElementById('cvDialog');
if (dlg && typeof dlg.showModal === 'function') {
  const KEY = 'cv-sections';
  const boxes = [...dlg.querySelectorAll('.cv-opt input')];
  const go = dlg.querySelector('[data-cv-go]');
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(saved)) boxes.forEach((b) => { b.checked = saved.includes(b.value); }); } catch { /* تجاهل */ }
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href$="hussain-al-hajji-profile.pdf"]');
    if (!a || a.closest('dialog') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); dlg.showModal(); dlg.querySelector('h2').focus();
  });
  dlg.querySelectorAll('[data-cv-all]').forEach((b) => b.addEventListener('click', () => boxes.forEach((x) => { x.checked = b.dataset.cvAll === '1'; })));
  go.addEventListener('click', async () => {
    const ids = boxes.filter((b) => b.checked).map((b) => b.value);
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* تجاهل */ }
    const label = go.textContent; go.disabled = true; go.textContent = 'جارٍ إنشاء الملف…';
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const out = await PDFDocument.create();
      for (const name of ['cover', ...ids, 'tail']) {
        const r = await fetch(`${dlg.dataset.parts}/${name}.pdf`);
        if (!r.ok) throw new Error(name);
        const src = await PDFDocument.load(await r.arrayBuffer());
        (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
      }
      const font = await out.embedFont(StandardFonts.Helvetica), pages = out.getPages();
      pages.forEach((p, i) => {
        const t = `${i + 1} / ${pages.length}`, w = font.widthOfTextAtSize(t, 8);
        p.drawText(t, { x: (p.getWidth() - w) / 2, y: 20, size: 8, font, color: rgb(0.55, 0.55, 0.52) });
      });
      out.setTitle('السيرة الذاتية - حسين الحاجي'); out.setLanguage('ar');
      const url = URL.createObjectURL(new Blob([await out.save()], { type: 'application/pdf' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'hussain-al-hajji-cv.pdf' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      dlg.close();
    } catch {
      location.href = dlg.querySelector('a[download]').href; // تعذّر الدمج: تُنزَّل النسخة الكاملة
    } finally { go.disabled = false; go.textContent = label; }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}
