// بطاقات الحقائب: إمالة خفيفة مع المؤشر، وقلب بالضغط أو لوحة المفاتيح. الوجه الخلفي لا يُتنقَّل إليه إلا بعد القلب.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
const cards = [...document.querySelectorAll('[data-kd] .kd-i')];
const setFlip = (li, on) => {
  li.classList.toggle('flipped', on);
  li.querySelector('.kd-f').setAttribute('aria-expanded', on);
  const back = li.querySelector('.kd-b'); back.setAttribute('aria-hidden', !on);
  back.querySelectorAll('a').forEach((a) => a.tabIndex = on ? 0 : -1);
};
cards.forEach((li) => {
  const c = li.querySelector('.kd-c');
  li.querySelector('.kd-f').addEventListener('click', () => {
    const on = !li.classList.contains('flipped');
    cards.forEach((o) => o !== li && setFlip(o, false));
    setFlip(li, on);
  });
  li.addEventListener('keydown', (e) => { if (e.key === 'Escape' && li.classList.contains('flipped')) { setFlip(li, false); li.querySelector('.kd-f').focus(); } });
  li.querySelector('.kd-b').addEventListener('click', (e) => { if (!e.target.closest('a')) setFlip(li, false); });
  if (reduce || !fine) return;
  li.addEventListener('pointermove', (e) => {
    const r = li.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--ty', ((x - 0.5) * 12).toFixed(2) + 'deg'); c.style.setProperty('--tx', ((0.5 - y) * 10).toFixed(2) + 'deg');
    c.style.setProperty('--sx', x * 100 + '%'); c.style.setProperty('--sy', y * 100 + '%');
  });
  li.addEventListener('pointerleave', () => { c.style.removeProperty('--ty'); c.style.removeProperty('--tx'); });
});
