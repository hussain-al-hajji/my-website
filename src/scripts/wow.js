// لحظات بصرية تفاعلية في الرئيسية: كوكبة الأثر، شبكة الشراكات، السبورة، فقاعات المهارات.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const data = JSON.parse($('#homeData').textContent);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const norm = (s = '') => String(s).replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();

/* ------------------------------------------------------------------ كوكبة الأثر */
(async function constellation() {
  const cv = $('#csCanvas'), sec = $('#constellation');
  if (!cv || !sec) return;
  const log = data.log, N = log.length, ctx = cv.getContext('2d'), tip = $('#csTip'), cap = $('#csCap');
  const P = (lat, lon) => [((lon - 35) / 25) * 1000, ((31 - lat) / 15.2) * 600];
  const CITIES = data.cities;
  // مدينة كل سجل
  const cityOf = log.map((r) => { const t = `${r.l} ${r.o} ${r.n}`; return CITIES.findIndex((c) => c[1].some((k) => t.includes(k))); });
  const counts = {}; cityOf.forEach((ci) => { if (ci >= 0) counts[ci] = (counts[ci] || 0) + 1; });
  const placedN = Object.keys(counts).length;
  const years = [...new Set(log.map((r) => r.y))].sort(), y0 = years[0], y1 = years[years.length - 1];
  const geo = $$('#map .geo path').map((p) => new Path2D(p.getAttribute('d')));
  const img = new Image(); img.src = cv.dataset.logo; try { await img.decode(); } catch {}
  const coarse = matchMedia('(pointer:coarse)').matches, DUST = coarse ? 650 : 1500, random = rng(7);
  const sc = [], nm = [], mp = [], yr = [], dsc = [], dnm = [], dmp = [], dyr = [];
  let W = 0, H = 0, dpr = 1, mapT = null, yearCols = [], virtN = 0, virtPt = [0, 0];
  const gauss = () => (random() + random() + random() - 1.5) * 1.3;

  function layout() {
    const r = cv.getBoundingClientRect(); W = Math.max(280, r.width); H = Math.max(260, r.height);
    dpr = Math.min(coarse ? 1.5 : 2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr;
    // الاسم: عيّنات من بكسلات المخطوطة
    const nw = Math.min(W * 0.9, 820), nh = nw * 961 / 2600, ox = (W - nw) / 2, oy = (H - nh) / 2;
    const off = document.createElement('canvas'); off.width = Math.round(nw); off.height = Math.round(nh);
    const o = off.getContext('2d', { willReadFrequently: true }); if (img.naturalWidth) o.drawImage(img, 0, 0, off.width, off.height);
    const px = o.getImageData(0, 0, off.width, off.height).data, pts = [];
    for (let y = 0; y < off.height; y += 2) for (let x = 0; x < off.width; x += 2) if (px[(y * off.width + x) * 4 + 3] > 140) pts.push([ox + x, oy + y]);
    const rr = rng(11), pick = () => pts[Math.floor(rr() * pts.length)] || [W / 2, H / 2];
    // الخريطة
    const s = Math.min(W / 1000, H / 600) * 0.93, mx = (W - 1000 * s) / 2, my = (H - 600 * s) / 2;
    mapT = { s, mx, my };
    const home = P(25.38, 49.59);
    const cp = CITIES.map((c) => { const q = P(c[2], c[3]); return [mx + q[0] * s, my + q[1] * s]; });
    const virt = [mx + 150 * s, my + 500 * s]; virtN = cityOf.filter((c) => c < 0).length; virtPt = virt;
    // السنوات
    const m = Math.max(34, W * 0.06), cw = (W - m * 2) / Math.max(1, years.length - 1);
    yearCols = years.map((y, i) => ({ y, x: W - m - i * cw, n: log.filter((r) => r.y === y).length }));   // الأقدم عند اليمين
    const seen = {}, base = H - 64, gap = Math.max(8, Math.min(12, cw / 7));
    for (let i = 0; i < N; i++) {
      const rec = log[i], c = CITIES[cityOf[i]];
      sc[i] = [rr() * W, rr() * H]; nm[i] = pick();
      const base2 = cityOf[i] >= 0 ? cp[cityOf[i]] : virt, rad = 4 + Math.sqrt(cityOf[i] >= 0 ? counts[cityOf[i]] : virtN) * 3.6;
      const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * rad * s * (W < 600 ? 1.1 : 1.3);
      mp[i] = [base2[0] + Math.cos(a) * d, base2[1] + Math.sin(a) * d];
      const k = seen[rec.y] = (seen[rec.y] || 0) + 1, col = yearCols.find((c2) => c2.y === rec.y), cols = col.n > 30 ? 5 : 3;
      yr[i] = [col.x + ((k - 1) % cols - (cols - 1) / 2) * gap, base - Math.floor((k - 1) / cols) * gap];
    }
    const wt = Object.entries(counts).map(([ci, n]) => [+ci, n]), tot = wt.reduce((a, b) => a + b[1], 0);
    for (let i = 0; i < DUST; i++) {
      dsc[i] = [rr() * W, rr() * H]; dnm[i] = pick();
      let t = rr() * tot, c2 = wt[0][0]; for (const [ci, n] of wt) { t -= n; if (t <= 0) { c2 = ci; break; } }
      const b2 = cp[c2], sp = 16 * s * (0.5 + rr()); mp[N + i] = [b2[0] + gauss() * sp, b2[1] + gauss() * sp];
      const col = yearCols[Math.floor(rr() * yearCols.length)];
      yr[N + i] = [col.x + gauss() * 18, base - rr() * 150 - 6];
    }
    for (let i = 0; i < DUST; i++) { dmp[i] = mp[N + i]; dyr[i] = yr[N + i]; }
  }
  layout();
  addEventListener('resize', () => { layout(); });

  // التقدّم مع التمرير
  let target = reduce ? 0.86 : 0, cur = target, force = null, hover = -1, active = false, stage = -1;
  const range = () => Math.max(1, sec.offsetHeight - innerHeight);
  const measure = () => { if (force != null) return force; if (reduce) return 0.86; const r = sec.getBoundingClientRect(); return clamp(-r.top / range()); };
  const HOLD = [0.24, 0.5, 0.9];
  $$('[data-cs]').forEach((b) => b.addEventListener('click', () => {
    const k = +b.dataset.cs;
    if (reduce) { force = HOLD[k]; cur = target = force; } else sec.scrollIntoView(), scrollTo({ top: sec.offsetTop + range() * HOLD[k] - 0, behavior: 'smooth' });
  }));
  // مؤشر التشكيل: يحرّك التقدّم مباشرة (بتمرير الصفحة نفسها حتى تبقى الحالة واحدة)
  const scrub = $('#csScrub'); let scrubbing = false;
  if (scrub) {
    const seek = () => {
      const p = clamp(+scrub.value / 1000);
      if (reduce) { force = p; cur = target = p; } else scrollTo({ top: sec.getBoundingClientRect().top + scrollY + range() * p, behavior: 'instant' });
    };
    scrub.addEventListener('input', seek);
    scrub.addEventListener('pointerdown', () => { scrubbing = true; });
    ['pointerup', 'pointercancel', 'blur'].forEach((ev) => scrub.addEventListener(ev, () => { scrubbing = false; }));
  }
  const CAP = [`${N} برنامجاً، وكل نقطة منها حكاية.`, `${placedN} موقعاً داخل المملكة وخارجها.`, `من ${y0} إلى ${y1}، سنة بعد سنة.`];

  function pos(i, p) {
    const dust = i >= N, a = ease(clamp(p / 0.18)), b = ease(clamp((p - 0.3) / 0.2)), c = ease(clamp((p - 0.62) / 0.2));
    const A = dust ? dsc[i - N] : sc[i], B = dust ? dnm[i - N] : nm[i], C = mp[i], D = yr[i];
    return [lerp(lerp(lerp(A[0], B[0], a), C[0], b), D[0], c), lerp(lerp(lerp(A[1], B[1], a), C[1], b), D[1], c)];
  }
  const font = '600 13px "Noto Sans Arabic", system-ui, sans-serif';
  function draw(t) {
    const p = cur, wMap = ease(clamp((p - 0.3) / 0.2)) * (1 - ease(clamp((p - 0.62) / 0.2))), wYear = ease(clamp((p - 0.62) / 0.2));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (wMap > 0.02 && mapT) {
      ctx.save(); ctx.translate(mapT.mx, mapT.my); ctx.scale(mapT.s, mapT.s); ctx.strokeStyle = `rgba(255,255,255,${0.2 * wMap})`; ctx.fillStyle = `rgba(255,255,255,${0.035 * wMap})`; ctx.lineWidth = 1 / mapT.s;
      geo.forEach((g) => { ctx.fill(g); ctx.stroke(g); }); ctx.restore();
    }
    // غبار
    ctx.fillStyle = 'rgba(232,189,99,.62)';
    for (let i = 0; i < DUST; i++) { const q = pos(N + i, p), j = reduce || coarse ? 0 : Math.sin(t / 900 + i) * 1.2; ctx.fillRect(q[0] + j, q[1] + (reduce || coarse ? 0 : Math.cos(t / 1100 + i) * 1.2), 1.9, 1.9); }
    // النقاط
    for (let i = 0; i < N; i++) {
      const q = pos(i, p), h = i === hover;
      ctx.beginPath(); ctx.arc(q[0], q[1], h ? 11 : 7.5, 0, 6.283); ctx.fillStyle = h ? 'rgba(255,255,255,.22)' : 'rgba(226,178,87,.16)'; ctx.fill();
      ctx.beginPath(); ctx.arc(q[0], q[1], h ? 4.6 : 3.1, 0, 6.283); ctx.fillStyle = h ? '#fff' : '#e8bd63'; ctx.fill();
    }
    ctx.font = font; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    if (wMap > 0.5 && mapT) {
      ctx.fillStyle = `rgba(245,245,242,${(wMap - 0.5) * 2 * 0.9})`;
      CITIES.forEach((c, ci) => { if ((counts[ci] || 0) >= 6) { const q = P(c[2], c[3]); ctx.fillText(c[0], mapT.mx + q[0] * mapT.s, mapT.my + q[1] * mapT.s - (8 + Math.sqrt(counts[ci]) * 5) * mapT.s * 1.2); } });
    }
    if (wMap > 0.5 && virtN) { ctx.fillStyle = `rgba(245,245,242,${(wMap - 0.5) * 2 * 0.9})`; ctx.fillText(`عن بُعد · ${virtN} برنامجاً`, virtPt[0], virtPt[1] - (10 + Math.sqrt(virtN) * 4) * mapT.s * 1.1 - 8); }
    if (wYear > 0.5) {
      ctx.fillStyle = `rgba(245,245,242,${(wYear - 0.5) * 2})`; ctx.font = '700 14px "Noto Sans Arabic", system-ui, sans-serif';
      yearCols.forEach((c) => { ctx.fillText(String(c.y), c.x, H - 34); ctx.fillStyle = `rgba(163,162,155,${(wYear - 0.5) * 2})`; ctx.font = '500 12px "Noto Sans Arabic", system-ui, sans-serif'; ctx.fillText(c.n + ' برنامج', c.x, H - 14); ctx.fillStyle = `rgba(245,245,242,${(wYear - 0.5) * 2})`; ctx.font = '700 14px "Noto Sans Arabic", system-ui, sans-serif'; });
    }
  }
  let last = 0, lastCur = -1, lastHover = -2, keepPin = () => {};
  function frame(t) {
    if (!active) return;
    target = measure(); cur += (target - cur) * (reduce ? 1 : 0.14); if (Math.abs(target - cur) < 0.0004) cur = target;
    if (scrub && !scrubbing) scrub.value = Math.round(cur * 1000);
    const st = cur < 0.28 ? 0 : cur < 0.6 ? 1 : 2;
    if (st !== stage) { stage = st; cap.textContent = CAP[st]; $$('[data-cs]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.cs === st))); }
    // على اللمس لا نعيد الرسم ما لم يتغيّر التقدم أو النقطة المحددة، حتى لا يثقل التمرير
    if (!coarse || cur !== lastCur || hover !== lastHover) { draw(t); lastCur = cur; lastHover = hover; }
    keepPin(); last = t; requestAnimationFrame(frame);
  }
  new IntersectionObserver((es) => { const on = es[0].isIntersecting; if (on && !active) { active = true; requestAnimationFrame(frame); } else if (!on) active = false; }, { rootMargin: '200px' }).observe(sec);
  // التلميح عند المرور على نقطة
  const near = (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = -1, bd = 18 * 18;
    for (let i = 0; i < N; i++) { const q = pos(i, cur), d = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return { best, x, y };
  };
  // البطاقة: المرور يعرضها مؤقتاً، والنقر أو اللمس يثبّتها للقراءة حتى النقر على نقطة أخرى أو في الفراغ أو خارج القسم
  let pinned = -1;
  const place = (i, x, y) => {
    const rec = log[i], w = cv.parentNode.getBoundingClientRect();
    if (tip.dataset.i !== String(i)) {
      tip.dataset.i = i;
      tip.innerHTML = `<b>${esc(rec.n)}</b><span>${esc(rec.o || '')}</span><span>${rec.y}${rec.l ? ' · ' + esc(rec.l) : ''}</span>` + (pinned === i ? '<button type="button" class="tip-x" aria-label="إغلاق البطاقة">×</button>' : '');
    }
    tip.hidden = false; tip.classList.toggle('pinned', pinned === i);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(0, Math.min(w.width - tw, x - tw / 2)) + 'px';
    tip.style.top = (y - th - 16 < 0 ? Math.min(w.height - th, y + 18) : y - th - 16) + 'px';
  };
  const unpin = () => { pinned = -1; hover = -1; tip.hidden = true; tip.classList.remove('pinned'); delete tip.dataset.i; };
  // تتبّع النقطة المثبّتة إذا تحرّكت مع التمرير أو المؤشر
  keepPin = () => { if (pinned >= 0) { const q = pos(pinned, cur); place(pinned, q[0], q[1]); } };
  cv.addEventListener('pointermove', (e) => {
    if (pinned >= 0 || e.pointerType === 'touch') return;
    const { best, x, y } = near(e); hover = best;
    if (best < 0) { tip.hidden = true; delete tip.dataset.i; return; }
    place(best, x, y);
  });
  cv.addEventListener('click', (e) => {
    const { best } = near(e);
    if (best < 0 || best === pinned) { unpin(); return; }
    pinned = hover = best; delete tip.dataset.i; const q = pos(best, cur); place(best, q[0], q[1]);
  });
  cv.addEventListener('pointerleave', () => { if (pinned < 0) { hover = -1; tip.hidden = true; delete tip.dataset.i; } });
  tip.addEventListener('click', (e) => { if (e.target.closest('.tip-x')) unpin(); });
  document.addEventListener('pointerdown', (e) => { if (pinned >= 0 && !e.target.closest('#csTip') && e.target !== cv) unpin(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned >= 0) unpin(); });
})();

/* ------------------------------------------------------------------ شبكة الشراكات */
(function network() {
  const box = $('#netv'), card = $('#netCard'), net = data.net || [];
  if (!box || net.length < 4) return;
  let nodes = [];
  const NS = 'http://www.w3.org/2000/svg';
  function build() {
    const W = box.clientWidth, phone = W < 700, H = phone ? Math.round(W * 1.12) : Math.min(640, Math.round(W * 0.54));
    box.style.height = H + 'px'; box.replaceChildren();
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('aria-hidden', 'true'); box.appendChild(svg);
    const cx = W / 2, cy = H / 2, Rx = W * (phone ? 0.3 : 0.28), Ry = H * (phone ? 0.27 : 0.3), size = phone ? 46 : 64;
    const hub = document.createElement('div'); hub.className = 'nhub'; hub.innerHTML = `<img src="${esc(data.portrait)}" alt=""><span>${esc(String(data.net.reduce((a, n) => a + n.recs.length, 0)))} برنامجاً</span>`; hub.style.left = cx + 'px'; hub.style.top = cy + 'px'; box.appendChild(hub);
    nodes = net.map((n, i) => {
      const t = -Math.PI / 2 + (i / net.length) * Math.PI * 2, x = cx + Rx * Math.cos(t), y = cy + Ry * Math.sin(t);
      const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'ng'); svg.appendChild(g);
      const l0 = document.createElementNS(NS, 'line'); l0.setAttribute('x1', cx); l0.setAttribute('y1', cy); l0.setAttribute('x2', x); l0.setAttribute('y2', y); l0.setAttribute('class', 'nl0'); g.appendChild(l0);
      const dots = n.recs.map((r, j) => {
        const per = phone ? 6 : 9, row = Math.floor(j / per), k = j % per, rad = (phone ? 40 : 54) + row * (phone ? 11 : 13), span = (phone ? 11 : 13) / Math.max(1, (Math.hypot(x - cx, y - cy) / 100)),
          ang = t + (k - (Math.min(per, n.recs.length) - 1) / 2) * (phone ? 0.2 : 0.16), dx = x + Math.cos(ang) * rad * (phone ? 1 : 1.15), dy = y + Math.sin(ang) * rad;
        const ln = document.createElementNS(NS, 'line'); ln.setAttribute('x1', x); ln.setAttribute('y1', y); ln.setAttribute('x2', dx); ln.setAttribute('y2', dy); ln.setAttribute('class', 'nl1'); g.appendChild(ln);
        const d = document.createElement('span'); d.className = 'nd'; d.style.left = dx + 'px'; d.style.top = dy + 'px'; d.title = `${r.t} (${r.y})`; box.appendChild(d); return d;
      });
      const b = document.createElement('button'); b.type = 'button'; b.className = 'np'; b.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`; b.setAttribute('aria-label', `${n.name}: ${n.recs.length} برنامجاً`);
      b.innerHTML = `<img src="${esc(n.logo)}" alt="" loading="lazy">`; box.appendChild(b);
      const on = () => activate(i), off = () => { if (!box.matches(':focus-within') && !pinned) clear(); };
      b.addEventListener('mouseenter', on); b.addEventListener('focus', on); b.addEventListener('mouseleave', off);
      b.addEventListener('click', () => { pinned = pinned === i ? -1 : i; if (pinned === i) activate(i); else clear(); });
      return { g, b, dots, n };
    });
  }
  let pinned = -1;
  function activate(i) {
    box.classList.add('has');
    nodes.forEach((o, k) => { const a = k === i; o.g.classList.toggle('on', a); o.b.classList.toggle('on', a); o.dots.forEach((d) => d.classList.toggle('on', a)); });
    const n = nodes[i].n;
    card.innerHTML = `<b>${esc(n.name)}</b><span>${n.recs.length} برنامجاً معها</span><ul>${n.recs.slice(0, 4).map((r) => `<li>${esc(r.t)} <small>${r.y}</small></li>`).join('')}</ul>${n.recs.length > 4 ? `<small>و${n.recs.length - 4} برامج أخرى</small>` : ''}`;
  }
  function clear() { box.classList.remove('has'); nodes.forEach((o) => { o.g.classList.remove('on'); o.b.classList.remove('on'); o.dots.forEach((d) => d.classList.remove('on')); }); card.innerHTML = ''; }
  build();
  let rw = box.clientWidth; addEventListener('resize', () => { if (Math.abs(box.clientWidth - rw) > 20) { rw = box.clientWidth; pinned = -1; build(); card.innerHTML = ''; } });
  document.addEventListener('click', (e) => { if (!box.contains(e.target) && !card.contains(e.target)) { pinned = -1; clear(); } });
})();

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
