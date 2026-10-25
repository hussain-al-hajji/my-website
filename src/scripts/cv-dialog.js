// تخصيص السيرة الذاتية: أي رابط إلى ملف السيرة PDF يفتح نافذة اختيار الأقسام، ثم تُفتح صفحة /profile مصفّاة وتُطبع.
const dlg = document.getElementById('cvDialog');
if (dlg && typeof dlg.showModal === 'function') {
  const KEY = 'cv-sections';
  const boxes = [...dlg.querySelectorAll('.cv-opt input')];
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(saved)) boxes.forEach((b) => { b.checked = saved.includes(b.value); }); } catch { /* تجاهل */ }
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href$="hussain-al-hajji-profile.pdf"]');
    if (!a || a.closest('dialog') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); dlg.showModal(); dlg.querySelector('h2').focus();
  });
  dlg.querySelectorAll('[data-cv-all]').forEach((b) => b.addEventListener('click', () => boxes.forEach((x) => { x.checked = b.dataset.cvAll === '1'; })));
  dlg.querySelector('[data-cv-go]').addEventListener('click', () => {
    const ids = boxes.filter((b) => b.checked).map((b) => b.value);
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* تجاهل */ }
    dlg.close();
    window.open(`${dlg.dataset.profile}?s=${encodeURIComponent(ids.join(',') || '-')}&print=1`, '_blank');
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}
