// أقسام قابلة للطيّ: الرابط المباشر إلى قسم (#career) يفتحه ويمرّ إليه، وفتح قسم لا يغلق غيره.
const open = (hash) => {
  const el = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
  const d = el && (el.matches('details') ? el : el.querySelector('details.fold-sec'));
  if (!d) return;
  d.open = true;
  requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
};
open(location.hash);
addEventListener('hashchange', () => open(location.hash));
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href*="#"]');
  if (!a || a.origin !== location.origin || a.pathname !== location.pathname) return;
  open(a.hash);
});
