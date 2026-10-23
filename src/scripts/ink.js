// حبر ذهبي يتشرّبه اسمي بالمخطوطة عند المرور عليه أو لمسه، ثم يجفّ بهدوء.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce) {
  document.querySelectorAll('[data-ink]').forEach((el) => {
    const gold = el.querySelector('.gold'); if (!gold) return;
    let pts = [], raf = 0, last = null;
    const paint = () => {
      pts = pts.filter((p) => p.a > 0.02);
      gold.style.backgroundImage = pts.map((p) => `radial-gradient(circle ${p.r * 0.45}px at ${p.x}px ${p.y}px, rgba(255,243,200,${(p.a * 0.95).toFixed(3)}), transparent 100%), radial-gradient(circle ${p.r}px at ${p.x}px ${p.y}px, rgba(226,178,87,${p.a.toFixed(3)}), rgba(196,142,68,${(p.a * 0.7).toFixed(3)}) 55%, transparent 100%)`).join(',') || 'none';
      pts.forEach((p) => { p.a *= 0.955; });
      raf = pts.length ? requestAnimationFrame(paint) : 0;
    };
    const stamp = (e) => {
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, R = Math.max(34, r.width * 0.12);
      if (last && Math.hypot(x - last[0], y - last[1]) < R * 0.28) return;
      last = [x, y]; pts.push({ x, y, r: R, a: 1 }); if (pts.length > 40) pts.shift();
      if (!raf) raf = requestAnimationFrame(paint);
    };
    el.addEventListener('pointermove', stamp); el.addEventListener('pointerdown', stamp);
    el.addEventListener('pointerleave', () => { last = null; });
  });
}
