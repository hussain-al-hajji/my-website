// شريط جانبي خفيف يبيّن أقسام الصفحة وموقع القارئ منها؛ يظهر في الصفحات ذات الأقسام الكثيرة فقط.
const MIN = 4;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const main = document.querySelector('main');
const labelOf = (s) => {
  const id = s.getAttribute('aria-labelledby');
  const el = (id && document.getElementById(id)) || s.querySelector('h2');
  const t = (el ? (el.innerText || el.textContent) : s.getAttribute('aria-label')) || '';
  return t.replace(/\s+/g, ' ').replace(/[.:]\s*$/, '').trim();
};
if (main && document.querySelector('.foot')) {
  const all = [...main.querySelectorAll('section')].filter((s) => (s.querySelector('h2') || s.getAttribute('aria-labelledby')) && s.offsetHeight > 120);
  const secs = all.filter((s) => !all.some((o) => o !== s && o.contains(s))).map((el) => ({ el, label: labelOf(el) })).filter((x) => x.label);
  if (secs.length >= MIN) {
    const nav = document.createElement('nav');
    nav.className = 'rail'; nav.setAttribute('aria-label', 'أقسام الصفحة');
    nav.innerHTML = '<span class="rail-track"><i class="rail-fill"></i></span>' + secs.map((s, i) =>
      `<button type="button" class="rail-dot" style="--p:${(i / (secs.length - 1) * 100).toFixed(2)}%" aria-label="${s.label.replace(/"/g, '&quot;')}"><span class="rail-tip">${s.label.replace(/</g, '&lt;')}</span></button>`).join('');
    document.body.appendChild(nav);
    const dots = [...nav.querySelectorAll('.rail-dot')], fill = nav.querySelector('.rail-fill');
    dots.forEach((d, i) => d.addEventListener('click', () => secs[i].el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })));
    let cur = -1, raf = 0, peek = 0;
    const update = () => {
      raf = 0;
      const line = innerHeight * 0.35;
      let a = 0, frac = 0;
      secs.forEach((s, i) => { const r = s.el.getBoundingClientRect(); if (r.top <= line) { a = i; frac = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height))); } });
      const first = secs[0].el.getBoundingClientRect().top;
      nav.classList.toggle('on', scrollY > 240 || first < innerHeight * 0.6);
      const p = first > line ? 0 : Math.min(1, (a + (a < secs.length - 1 ? frac : 0)) / (secs.length - 1));
      fill.style.transform = `scaleY(${p.toFixed(4)})`;
      if (a !== cur) {
        dots[cur]?.classList.remove('is'); dots[cur]?.removeAttribute('aria-current');
        cur = a; dots[a].classList.add('is'); dots[a].setAttribute('aria-current', 'location');
        // يظهر اسم القسم الجديد لحظة ثم يختفي
        nav.querySelectorAll('.peek').forEach((d) => d.classList.remove('peek'));
        if (nav.classList.contains('on')) { dots[a].classList.add('peek'); clearTimeout(peek); peek = setTimeout(() => dots[a].classList.remove('peek'), 1400); }
      }
      dots.forEach((d, i) => d.classList.toggle('done', i < a));
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(update); });
    update();
  }
}
