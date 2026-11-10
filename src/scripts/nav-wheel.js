// بكرة صفحات الموقع في الرئيسية: عناوين القائمة على أسطوانة عمودية تدور تلقائياً ببطء، ويُحرّكها المستخدم بسحب الإصبع أو الفأرة
// للأعلى والأسفل (مع استمرار الحركة بعد رفع الإصبع وتوقّف عند أقرب عنوان). العنوان في الوسط أوضح، وما حوله يبهت ويميل.
const box = document.getElementById('nwheel');
if (box) {
  const ring = box.querySelector('.nwheel-ring');
  const items = [...ring.children];
  const N = items.length, STEP = 360 / N;
  const ROW = 44;                                   // ارتفاع العنوان (بكسل)
  const R = ROW / 2 / Math.tan((STEP / 2) * Math.PI / 180) * 1.05;   // نصف قطر الأسطوانة بحيث تتجاور العناوين
  const AUTO = 9;                                   // سرعة الدوران التلقائي (درجة/ثانية)
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rot = 0, vel = 0, drag = null, moved = 0, idleAt = 0, visible = true, last = 0, snapTo = null;

  items.forEach((el, i) => { el.style.transform = `rotateX(${-i * STEP}deg) translateZ(${R}px)`; });
  box.style.setProperty('--row', ROW + 'px');
  const norm = (a) => ((a % 360) + 540) % 360 - 180;
  const paint = () => {
    ring.style.transform = `translateZ(${-R}px) rotateX(${rot}deg)`;
    items.forEach((el, i) => {
      const d = Math.abs(norm(-i * STEP + rot));        // بُعد العنوان عن الوسط بالدرجات
      const e = Math.max(0, 1 - d / 75);
      el.style.opacity = d > 82 ? 0 : (0.14 + 0.86 * e * e).toFixed(3);
      el.classList.toggle('on', d < STEP / 2);
      el.style.pointerEvents = d > 70 ? 'none' : '';
    });
  };

  const tick = (t) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (!drag) {
      if (snapTo !== null) {                          // بعد الإفلات: ينساب إلى أقرب عنوان
        const diff = snapTo - rot;
        if (Math.abs(diff) < 0.15) { rot = snapTo; snapTo = null; idleAt = t + 2200; } else rot += diff * Math.min(1, dt * 9);
      } else if (Math.abs(vel) > 6) {
        rot += vel * dt; vel *= Math.pow(0.05, dt);
        if (Math.abs(vel) <= 6) snapTo = Math.round(rot / STEP) * STEP;
      } else if (!still && visible && t > idleAt) rot += AUTO * dt;
    }
    paint();
  };

  const PX = STEP / ROW;                              // درجات لكل بكسل سحب: عنوان واحد لكل ارتفاع عنوان
  const down = (e) => {
    if (e.button > 0) return;
    e.stopPropagation();
    drag = { y: e.clientY, rot, ly: e.clientY, lt: performance.now() }; moved = 0; vel = 0; snapTo = null;
    box.classList.add('grab');
  };
  const move = (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dy));
    if (moved > 5 && !box.hasPointerCapture?.(e.pointerId)) box.setPointerCapture?.(e.pointerId);
    rot = drag.rot - dy * PX;
    const now = performance.now();
    if (now - drag.lt > 16) { vel = -((e.clientY - drag.ly) * PX) / ((now - drag.lt) / 1000); drag.ly = e.clientY; drag.lt = now; }
  };
  const up = () => {
    if (!drag) return; drag = null; box.classList.remove('grab');
    vel = Math.max(-420, Math.min(420, vel));
    if (Math.abs(vel) <= 6) snapTo = Math.round(rot / STEP) * STEP;
    idleAt = performance.now() + 2200;
  };
  box.addEventListener('pointerdown', down);
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  // لوحة اللمس في الحاسوب (سحب إصبعين) وعجلة الفأرة: تحرّك البكرة للأعلى والأسفل ثم تستقر على أقرب عنوان
  let wheelT = 0;
  box.addEventListener('wheel', (e) => {
    e.preventDefault(); e.stopPropagation();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    snapTo = null; vel = 0;
    rot += dy * PX * 0.9;
    idleAt = performance.now() + 2500;
    clearTimeout(wheelT); wheelT = setTimeout(() => { snapTo = Math.round(rot / STEP) * STEP; }, 140);
  }, { passive: false });
  box.addEventListener('mouseenter', () => { idleAt = Infinity; });
  box.addEventListener('mouseleave', () => { idleAt = performance.now() + 800; });
  // النقر بعد سحب لا يفتح الصفحة
  box.addEventListener('click', (e) => { if (moved > 5) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  box.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { snapTo = Math.round(rot / STEP) * STEP + (e.key === 'ArrowDown' ? -STEP : STEP); idleAt = performance.now() + 2500; e.preventDefault(); } });

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.1 }).observe(box);
  requestAnimationFrame(tick);
}
