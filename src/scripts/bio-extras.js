// السبورة وفقاعات المهارات (في آخر صفحة «عنّي»): كانتا في الرئيسية.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const data = JSON.parse($('#bioExtraData').textContent);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const norm = (s = '') => String(s).replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();

/* ------------------------------------------------------------------ السبورة */
(function board() {
  const steps = $$('.bd-step'), line = $('.chalk-line');
  if (!steps.length) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('drawn'); io.unobserve(e.target); } }), { threshold: 0.5 });
  steps.forEach((s, i) => { s.style.setProperty('--i', i); io.observe(s); });
  if (line) io.observe(line);
  const hd = $('#bd-h'); if (hd) io.observe(hd);
})();

/* ------------------------------------------------------------------ فقاعات المهارات */
(function bubbles() {
  const field = $('#bubField'), panel = $('#bubPanel'), titles = data.bubbles || [];
  if (!field || titles.length < 4) return;
  const COL = [['#f3e4c0', '#1b1b1a'], ['#1b1b1a', '#f5f5f2'], ['#dfe9dc', '#1b1b1a'], ['#fbd9c8', '#1b1b1a'], ['#e2b257', '#1b1b1a'], ['#e8e6df', '#1b1b1a']];
  const STOP = new Set(['في', 'من', 'على', 'مع', 'نحو', 'التي', 'الذي', 'عمل', 'احتياجات']);
  const stem = (w) => w.replace(/^(وال|بال|لل|ال)/, '');
  const toks = (s) => norm(s).split(/[^؀-ۿa-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);
  const kitText = data.kits.map((k) => norm([k.short, k.headline || '', ...(k.points || [])].join(' ')));
  function related(title) {
    const t = toks(title);
    return data.kits.map((k, i) => ({ k, s: t.filter((w) => w.length >= 3 && kitText[i].includes(w)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.k);
  }
  let W = field.clientWidth, H = W < 700 ? 600 : 460;
  field.style.height = H + 'px';
  const phone = W < 700, random = rng(3);
  const B = titles.map((t, i) => {
    const d = phone ? Math.min(124, 84 + t.length * 1.0) : Math.min(168, 100 + t.length * 1.7), el = document.createElement('button');
    el.type = 'button'; el.className = 'bub'; el.style.width = el.style.height = d + 'px'; el.style.background = COL[i % COL.length][0]; el.style.color = COL[i % COL.length][1]; el.innerHTML = `<span>${esc(t)}</span>`;
    field.appendChild(el);
    const r = d / 2;
    return { el, r, x: r + random() * (W - d), y: r + random() * (H - d), vx: (random() - 0.5) * 1.6, vy: (random() - 0.5) * 1.6, drag: false, t };
  });
  const place = () => B.forEach((b) => { b.el.style.transform = `translate(${b.x - b.r}px,${b.y - b.r}px)`; });
  place();
  if (reduce) { field.classList.add('static'); B.forEach((b) => { b.el.style.transform = ''; }); }
  function select(b) {
    B.forEach((o) => o.el.classList.toggle('sel', o === b));
    const ks = related(b.t);
    panel.innerHTML = `<h3>${esc(b.t)}</h3>` + (ks.length
      ? `<p>حقائب ترتبط بهذا المجال:</p><div class="bp-links">${ks.map((k) => `<a class="pill" href="${k.page}">${esc(k.short)}</a>`).join('')}</div>`
      : `<p>أخبرني عن احتياجك في هذا المجال وأصمّم لك البرنامج المناسب.</p><div class="bp-links"><a class="pill" href="${data.collabUrl.replace('collaborate', 'contact')}?like=${encodeURIComponent(b.t)}">اطلب برنامجاً</a></div>`);
    panel.classList.add('on');
  }
  // سحب وإفلات
  let grab = null;
  B.forEach((b) => {
    b.el.addEventListener('pointerdown', (e) => {
      if (reduce) { select(b); return; }
      b.el.setPointerCapture(e.pointerId); const r = field.getBoundingClientRect();
      grab = { b, dx: b.x - (e.clientX - r.left), dy: b.y - (e.clientY - r.top), px: e.clientX, py: e.clientY, mx: 0, hist: [] }; b.drag = true; b.vx = b.vy = 0;
    });
    b.el.addEventListener('pointermove', (e) => {
      if (!grab || grab.b !== b) return; const r = field.getBoundingClientRect();
      const nx = e.clientX - r.left + grab.dx, ny = e.clientY - r.top + grab.dy;
      grab.mx = Math.max(grab.mx, Math.hypot(e.clientX - grab.px, e.clientY - grab.py)); grab.hist.push([performance.now(), nx, ny]); if (grab.hist.length > 5) grab.hist.shift();
      b.x = Math.max(b.r, Math.min(W - b.r, nx)); b.y = Math.max(b.r, Math.min(H - b.r, ny));
    });
    const up = (e) => {
      if (!grab || grab.b !== b) return; const h = grab.hist; b.drag = false;
      if (e && e.type === 'pointercancel') { grab = null; return; }   // المتصفح أخذ اللمسة للتمرير
      if (grab.mx < 6) select(b); else if (h.length > 1) { const a = h[0], z = h[h.length - 1], dt = Math.max(16, z[0] - a[0]); b.vx = Math.max(-18, Math.min(18, (z[1] - a[1]) / dt * 16)); b.vy = Math.max(-18, Math.min(18, (z[2] - a[2]) / dt * 16)); }
      grab = null;
    };
    b.el.addEventListener('pointerup', up); b.el.addEventListener('pointercancel', up);
  });
  let on = false;
  function step() {
    if (!on) return;
    for (const b of B) {
      if (b.drag) continue;
      b.x += b.vx; b.y += b.vy; b.vx *= 0.996; b.vy *= 0.996;
      if (Math.hypot(b.vx, b.vy) < 0.35) { b.vx += (random() - 0.5) * 0.12; b.vy += (random() - 0.5) * 0.12; }
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.85; } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.85; }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.85; } if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * 0.85; }
    }
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], c = B[j], dx = c.x - a.x, dy = c.y - a.y, dist = Math.hypot(dx, dy) || 0.01, min = a.r + c.r;
      if (dist >= min) continue;
      const nx = dx / dist, ny = dy / dist, ov = min - dist, wa = a.drag ? 0 : c.drag ? 1 : 0.5, wc = c.drag ? 0 : a.drag ? 1 : 0.5;
      a.x -= nx * ov * wa; a.y -= ny * ov * wa; c.x += nx * ov * wc; c.y += ny * ov * wc;
      const dvn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
      if (dvn > 0) { const k = dvn * 0.92; if (!a.drag) { a.vx -= nx * k; a.vy -= ny * k; } if (!c.drag) { c.vx += nx * k; c.vy += ny * k; } }
    }
    place(); requestAnimationFrame(step);
  }
  if (!reduce) new IntersectionObserver((es) => { const v = es[0].isIntersecting; if (v && !on) { on = true; requestAnimationFrame(step); } else if (!v) on = false; }).observe(field);
  addEventListener('resize', () => { W = field.clientWidth; H = W < 700 ? 600 : 460; field.style.height = H + 'px'; B.forEach((b) => { b.x = Math.min(b.x, W - b.r); b.y = Math.min(b.y, H - b.r); }); });
})();
