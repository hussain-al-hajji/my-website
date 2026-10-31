// حلقة إعلانات البرامج في الرئيسية: الإعلانات على دائرة ثلاثية الأبعاد تدور تلقائياً ويُتحكَّم بها بالسحب (إصبع أو فأرة).
// الإعلان في المقدّمة بألوانه كاملة، وما سواه يبهت ويخبو بقدر بُعده عنه.
const box = document.getElementById('pring');
if (box) {
  const ring = box.querySelector('.pring-ring');
  const items = [...ring.children];
  const GAP = 34, AUTO = 46;                      // فراغ بين الإعلانات (بكسل)، وسرعة الدوران التلقائي (بكسل/ثانية على المقدّمة)
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let R = 800, angles = [], rot = 0, started = false, vel = 0, drag = null, moved = 0, idleAt = 0, raf = 0, visible = true;

  const layout = () => {
    const ws = items.map((el) => el.offsetWidth || 240);
    const total = ws.reduce((a, w) => a + w + GAP, 0);
    R = total / (2 * Math.PI);
    let pos = 0;
    angles = ws.map((w) => { const c = pos + w / 2; pos += w + GAP; return (c / R) * (180 / Math.PI); });
    items.forEach((el, i) => { el.style.transform = `rotateY(${angles[i]}deg) translateZ(${R}px)`; });
    box.style.perspective = `${Math.max(900, R * 0.9)}px`;
    if (!started) { rot = angles[0]; started = true; }          // أول إعلان في المقدّمة عند الفتح
    paint();
  };

  const norm = (a) => ((a % 360) + 540) % 360 - 180;
  const paint = () => {
    ring.style.transform = `translateZ(${-R}px) rotateY(${-rot}deg)`;
    items.forEach((el, i) => {
      const d = Math.abs(norm(angles[i] - rot));                       // بُعد الإعلان عن المقدّمة بالدرجات
      const px = (d * Math.PI / 180) * R;                               // وبالبكسل على محيط الدائرة
      const e = Math.max(0, 1 - px / (Math.min(box.clientWidth, 1100) * 0.62));   // 1 في المقدّمة وتتناقص حتى 0
      el.style.opacity = d > 105 ? 0 : (0.22 + 0.78 * e * e).toFixed(3);
      el.style.filter = `saturate(${(0.08 + 0.92 * e * e).toFixed(3)}) brightness(${(0.82 + 0.18 * e).toFixed(3)})`;
      el.style.visibility = d > 105 ? 'hidden' : 'visible';
      el.style.pointerEvents = d > 70 ? 'none' : '';
    });
  };

  let last = 0;
  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (!drag) {
      if (Math.abs(vel) > 0.01) { rot += vel * dt; vel *= Math.pow(0.04, dt); }     // استمرار الحركة بعد رفع الإصبع ثم تباطؤ
      else if (!still && t > idleAt && visible) rot += (AUTO / R) * (180 / Math.PI) * dt;
    }
    paint();
  };

  const down = (e) => {
    if (e.button > 0) return;
    drag = { x: e.clientX, rot, t: performance.now(), lx: e.clientX, lt: performance.now() };
    moved = 0; vel = 0; box.classList.add('grab');
  };
  const move = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x; moved = Math.max(moved, Math.abs(dx));
    if (moved > 6 && !box.hasPointerCapture?.(e.pointerId)) box.setPointerCapture?.(e.pointerId);
    rot = drag.rot - (dx / R) * (180 / Math.PI);
    const now = performance.now();
    if (now - drag.lt > 16) { vel = -((e.clientX - drag.lx) / R) * (180 / Math.PI) / ((now - drag.lt) / 1000); drag.lx = e.clientX; drag.lt = now; }
  };
  const up = () => { if (!drag) return; drag = null; box.classList.remove('grab'); idleAt = performance.now() + 2500; vel = Math.max(-400, Math.min(400, vel)); };
  box.addEventListener('pointerdown', down);
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  box.addEventListener('mouseenter', () => { idleAt = Infinity; });
  box.addEventListener('mouseleave', () => { idleAt = performance.now() + 800; });
  // نقرة بعد سحب لا تفتح الصورة
  box.addEventListener('click', (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  // لوحة المفاتيح: الأسهم تحرّك الحلقة
  box.tabIndex = 0;
  box.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { vel += (e.key === 'ArrowLeft' ? 1 : -1) * 90; idleAt = performance.now() + 2500; e.preventDefault(); } });

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.05 }).observe(box);
  new ResizeObserver(layout).observe(box);
  items.forEach((el) => el.querySelector('img')?.addEventListener('load', layout));
  layout();
  idleAt = 0;
  raf = requestAnimationFrame(tick);
}
