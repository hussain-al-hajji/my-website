// عدّاد الزيارات: يرسل زيارة مجهولة (بلا كوكيز ولا بيانات شخصية) ويعرض «هذه الزيارة رقم كذا» لمن دخل جلسة جديدة.
import PUB from '../admin/public-config.json';

const API = (PUB.apiUrl || '').replace(/\/$/, '');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const num = (n) => Number(n).toLocaleString('en-US');
const owner = (() => { try { return localStorage.getItem('nocount') === '1'; } catch { return false; } })();
const skip = !API || owner || navigator.webdriver || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || /^\/admin/.test(location.pathname);

function paint(total) {
  const el = document.getElementById('visitCount');
  if (el && total) { el.textContent = `زيارات الموقع: ${num(total)}`; el.hidden = false; }
}
function toast(n) {
  const t = document.createElement('div');
  t.className = 'visit-pill'; t.setAttribute('role', 'status');
  t.innerHTML = `هذه الزيارة رقم <b>${num(n)}</b>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), reduce ? 0 : 800); }, 6500);
}

if (!skip) {
  let first = true;
  try { first = !sessionStorage.getItem('vs'); sessionStorage.setItem('vs', '1'); } catch {}
  const q = new URLSearchParams(location.search);
  fetch(API + '/api/hit', {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p: location.pathname, r: document.referrer, w: innerWidth, s: first, u: q.get('utm_source') || '' }),
  }).then((r) => (r.status === 200 ? r.json() : null)).then((j) => {
    if (!j) return;
    paint(j.total);
    if (first && j.visit) toast(j.visit);
  }).catch(() => {});
}
