// تخصيص السيرة الذاتية: أي رابط إلى ملف السيرة PDF يفتح نافذة اختيار الأقسام.
// كل قسم مولَّد مسبقاً صفحةً طويلة واحدة مع نقاط القصّ بين عناصره؛ فيرصّها المتصفح متتابعة على صفحات A4 (قسم يبدأ بعد الذي قبله)
// ثم يُنزَّل الملف مباشرة مع ترقيم الصفحات.
import { mergeCv } from './cv-merge.js';
const dlg = document.getElementById('cvDialog');

async function build(ids, short, lang) {
  const PDFLib = await import('pdf-lib');
  const root = dlg.dataset.parts;
  // manifest يحدّد إصدار الأجزاء؛ إن كان قديماً (مخزَّناً) فتغيب أجزاؤه، فيُعاد جلبه بلاحقة جديدة
  const fetchManifest = async (bust) => { const r = await fetch(`${root}/manifest.json${bust ? '?t=' + Date.now() : ''}`, { cache: 'no-store' }); if (!r.ok) throw new Error('manifest'); return r.json(); };
  let data = await fetchManifest(false);
  const head = await fetch(`${root}/${data.v}/cover.pdf`, { method: 'HEAD' }).catch(() => null);
  if (!head || !head.ok) data = await fetchManifest(true);
  const base = `${root}/${data.v}`;
  const load = async (name) => { const r = await fetch(`${base}/${name}.pdf`); if (!r.ok) throw new Error(name); return PDFLib.PDFDocument.load(await r.arrayBuffer()); };
  return mergeCv({ PDFLib, load, manifest: data.parts }, ids, short, lang);
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

// البورتفوليو: أي رابط إلى ملف الأعمال PDF يفتح نافذة اختيار اللغة (عربي أو إنجليزي) ثم يُنزَّل الملف المختار
const pf = document.getElementById('pfDialog');
if (pf && typeof pf.showModal === 'function') {
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href$="hussain-al-hajji-portfolio.pdf"]');
    if (!a || a.closest('dialog') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); pf.showModal(); pf.querySelector('h2').focus();
  });
  pf.querySelectorAll('a[data-pf]').forEach((l) => l.addEventListener('click', () => setTimeout(() => pf.close(), 150)));
  pf.addEventListener('click', (e) => { if (e.target === pf) pf.close(); });
}
