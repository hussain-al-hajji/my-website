// لحظات التفاعل في الصفحة الرئيسية.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const data = JSON.parse($('#homeData').textContent);
const log = data.log;

// الأمثلة والأسماء تُدرج كنص لا كـ HTML
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// المعرض الأفقي
const g = $('#gal');
if (g) {
  const step = (d) => { const s = g.querySelector('.slide'); g.scrollBy({ left: d * (s.offsetWidth + 20), behavior: reduce ? 'auto' : 'smooth' }); };
  $('#next').addEventListener('click', () => step(-1));
  $('#prev').addEventListener('click', () => step(1));
}

// اللحظة 1: الصورة تنفتح من نافذة إلى العرض الكامل
const fig = $('#heroFig');
function opening() {
  const r = fig.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.9) - 0.35));
  fig.style.setProperty('--p', reduce ? 1 : p.toFixed(3));
}

// أرقام تتدحرج
const fmt = new Intl.NumberFormat('en-US');
const cio = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  cio.unobserve(e.target);
  const el = e.target, to = +el.dataset.count;
  if (reduce) return;
  const t0 = performance.now();
  (function tick(t) {
    const k = Math.min(1, (t - t0) / 1400);
    el.textContent = fmt.format(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}), { threshold: 0.6 });
$$('[data-count]').forEach((el) => cio.observe(el));

// اللحظة 3: جملة الجائزة تضيء كلمة كلمة
const ink = $('#inkFill');
ink.innerHTML = ink.textContent.trim().split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
const ws = $$('.w', ink);
function inkFill() {
  const r = ink.getBoundingClientRect();
  const p = reduce ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (innerHeight * 0.55)));
  const n = Math.round(p * ws.length);
  ws.forEach((w, i) => w.classList.toggle('lit', i < n));
}

// اللحظة 4: باحث الحقائب، يقترح أكثر من برنامج حسب الفئة والمخرج والمدة
const KITS = data.kits, LB = data.labels;
const sel = { a: 'students', g: '', t: '' };
const rMain = $('#rMain'), rMore = $('#rMore'), result = $('#result');
function rank() {
  const score = (k) => (k.audiences.includes(sel.a) ? 4 : 0) + (sel.g && k.goals.includes(sel.g) ? 4 : 0) + (sel.t && k.times.includes(sel.t) ? 2 : 0);
  const fits = (k) => k.audiences.includes(sel.a) && (!sel.g || k.goals.includes(sel.g));
  let list = KITS.filter(fits), relaxed = '';
  if (!list.length && sel.g) { list = KITS.filter((k) => k.goals.includes(sel.g)); relaxed = 'لا برنامج لهذه الفئة بهذا المخرج تحديداً، هذه أقرب الخيارات للمخرج.'; }
  if (!list.length) { list = KITS.filter((k) => k.audiences.includes(sel.a)); relaxed = 'هذه أقرب الخيارات لفئتك.'; }
  if (!list.length) { list = [...KITS]; relaxed = 'أخبرني بهدفك وأقترح لك برنامجاً مناسباً.'; }
  const by = (x, y) => y.s - x.s || KITS.indexOf(x.k) - KITS.indexOf(y.k);
  const ranked = list.map((k) => ({ k, s: score(k) })).sort(by);
  const related = KITS.filter((k) => !list.includes(k)).map((k) => ({ k, s: score(k) })).filter((x) => x.s > 0).sort(by);
  return { list: ranked, related, relaxed };
}
const tags = (k) => {
  const t = [];
  if (k.audiences.includes(sel.a)) t.push(LB.aud[sel.a]);
  if (sel.g && k.goals.includes(sel.g)) t.push(LB.goal[sel.g]);
  if (sel.t && k.times.includes(sel.t)) t.push(LB.time[sel.t]);
  return t.map((x) => `<span class="tg">${esc(x)}</span>`).join('');
};
function render() {
  const { list, related, relaxed } = rank();
  const top = list[0].k, rest = list.slice(1);
  const n = list.length;
  const count = n === 1 ? 'برنامج واحد مناسب' : n === 2 ? 'برنامجين مناسبين' : n <= 10 ? `${n} برامج مناسبة` : `${n} برنامجاً مناسباً`;
  rMain.innerHTML = `<img src="${top.image}" alt="" loading="lazy"><div class="body"><span class="lbl">${n > 1 ? `الأنسب لك، من بين ${count}` : 'البرنامج المناسب'}</span><h3>${esc(top.short)}</h3><p class="meta">${esc(top.duration)}</p>${top.headline ? `<p class="hl">${esc(top.headline)}</p>` : ''}<div class="tgs">${tags(top)}</div><ul>${top.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${relaxed ? `<p class="note">${esc(relaxed)}</p>` : ''}<div class="acts"><a class="pill" href="${top.contact}">اطلب هذه الحقيبة</a> <a class="more" href="${top.page}">تفاصيل الحقيبة</a></div></div>`;
  const pool = rest.concat(relaxed ? [] : related);
  const shown = pool.slice(0, 4);
  rMore.innerHTML = shown.length ? `<h4>${rest.length ? 'برامج أخرى تناسبك' : 'قد تهمك أيضاً'}</h4><ul>${shown.map(({ k }) => `<li><a href="${k.page}"><img src="${k.image}" alt="" loading="lazy"><span><b>${esc(k.short)}</b><small>${esc(k.duration)}</small></span></a></li>`).join('')}</ul>${pool.length > shown.length || n > 1 ? `<a class="more" href="${data.collabUrl}?aud=${sel.a}${sel.g ? '&goal=' + sel.g : ''}">كل البرامج المناسبة (${n})</a>` : ''}` : '';
  result.classList.remove('swap'); void result.offsetWidth; result.classList.add('swap');
}
$$('.seg').forEach((grp) => $$('button', grp).forEach((b) => b.addEventListener('click', () => {
  $$('button', grp).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  sel[grp.dataset.q] = b.dataset.v; render();
})));
render();

// اللحظة 0: حلقة صور البرامج
const ring = $('#ring'), stage = $('#ringStage'), sub = $('#sub');
const subBase = sub.innerHTML;
const frames = []; let spin = 0, paused = false, visible = true, last = performance.now();
data.ring.forEach((f, k) => {
  const a = document.createElement('a');
  a.className = 'frame'; a.href = data.recordsUrl; a.setAttribute('aria-label', `${f.title}، ${f.caption}`);
  const im = document.createElement('img'); im.src = f.image; im.alt = ''; im.decoding = 'async'; im.loading = k < 8 ? 'eager' : 'lazy';
  const fr = { el: a, k, ar: f.ratio || 1.5 };
  const setAr = () => { if (im.naturalWidth) fr.ar = Math.min(2.2, Math.max(0.6, im.naturalWidth / im.naturalHeight)); };
  im.addEventListener('load', setAr); setAr();
  a.append(im);
  const on = () => { paused = true; ring.classList.add('focus'); frames.forEach((x) => x.el.classList.remove('on')); a.classList.add('on'); sub.innerHTML = `<b>${esc(f.title)}</b>${esc(f.caption)}`; };
  const off = () => { paused = false; ring.classList.remove('focus'); a.classList.remove('on'); sub.innerHTML = subBase; };
  a.addEventListener('mouseenter', on); a.addEventListener('focus', on); a.addEventListener('mouseleave', off); a.addEventListener('blur', off);
  ring.appendChild(a); frames.push(fr);
});
function drawRing() {
  const W = ring.clientWidth, H = ring.clientHeight, phone = W < 760, n = phone ? 12 : frames.length;
  const r = stage.getBoundingClientRect(), c = reduce ? 0 : Math.min(1, Math.max(0, -r.top / (H * 0.55)));
  const cx = W / 2, cy = H / 2;
  const rx = (phone ? W * 0.62 : Math.min(600, W * 0.42)) * (1 - c * 0.85);
  const ry = (phone ? W * 0.74 : Math.min(450, H * 0.45)) * (1 - c * 0.85);
  frames.forEach((f, i) => {
    if (i >= n) { f.el.hidden = true; return; }
    f.el.hidden = false;
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2 + spin, x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t), depth = (Math.sin(t) + 1) / 2;
    const base = phone ? 60 + 26 * depth : 96 + 58 * depth, area = base * base * 0.75;
    const w = Math.sqrt(area * f.ar), hgt = Math.sqrt(area / f.ar);
    const ang = Math.max(-24, Math.min(24, Math.cos(t) * -18));
    f.el.style.width = w + 'px'; f.el.style.height = hgt + 'px'; f.el.style.zIndex = depth > 0.5 ? 2 : 1;
    const sc = (f.el.classList.contains('on') ? 1.25 : 1) * (1 - c * 0.55);
    f.el.style.transform = `translate(${x - w / 2}px,${y - hgt / 2}px) rotate(${ang.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
    if (!ring.classList.contains('focus')) f.el.style.opacity = (1 - c).toFixed(3);
  });
}
function loop(t) {
  const dt = Math.min(64, t - last); last = t;
  if (!paused && !reduce && visible) spin += dt * 0.000045;
  if (visible) drawRing();
  requestAnimationFrame(loop);
}
new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(stage);
drawRing(); requestAnimationFrame(loop);

// اللحظة 2ب: خريطة الأثر من السجل نفسه
const CITIES = data.cities;
const counts = {}, samples = {};
log.forEach((r) => {
  const txt = `${r.l} ${r.o} ${r.n}`;
  CITIES.forEach((c) => {
    if (c[1].some((k) => txt.includes(k))) { counts[c[0]] = (counts[c[0]] || 0) + 1; (samples[c[0]] = samples[c[0]] || []).push(r.n); }
  });
});
const NS = 'http://www.w3.org/2000/svg';
const map = $('#map'), mCard = $('#mCard');
const P = (lat, lon) => [((lon - 35) / (60 - 35)) * 1000, ((31 - lat) / (31 - 15.8)) * 600];
const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
const home = P(25.38, 49.59), gA = el('g', {}), gC = el('g', {});
map.appendChild(gA); map.appendChild(gC);
const placed = CITIES.filter((c) => counts[c[0]]);
placed.forEach((c, i) => {
  const q = P(c[2], c[3]), n = counts[c[0]], isHome = c[0] === 'الأحساء';
  if (!isHome) {
    const mx = (home[0] + q[0]) / 2, my = (home[1] + q[1]) / 2, dx = q[0] - home[0], dy = q[1] - home[1], len = Math.hypot(dx, dy);
    const cxp = mx - dy * 0.22, cyp = my + dx * 0.22 - len * 0.12;
    const path = el('path', { class: 'arc', d: `M${home[0]},${home[1]} Q${cxp},${cyp} ${q[0]},${q[1]}` });
    gA.appendChild(path);
    path.style.setProperty('--len', path.getTotalLength()); path.style.setProperty('--i', i);
  }
  const labelled = n >= 3 || isHome;
  const gg = el('g', { class: 'c', tabindex: 0, role: 'button', ...(labelled ? {} : { 'aria-label': `${c[0]} ${n} مشاركة` }) });
  const rad = 4 + Math.sqrt(n) * 2.4;
  gg.appendChild(el('circle', { class: 'halo', cx: q[0], cy: q[1], r: rad * 2 }));
  gg.appendChild(el('circle', { class: 'city' + (isHome ? ' home' : ''), cx: q[0], cy: q[1], r: rad }));
  const POS = { 'الأحساء': 'd', 'الدمام والخبر': 'u', 'الإمارات': 'r', 'قطر': 'r', 'البحرين': 'u', 'المدينة المنورة': 'u' };
  const pos = POS[c[0]] || (q[0] < 110 ? 'r' : 'l');
  if (n >= 3 || isHome) {
    let lx = q[0], ly = q[1] + 5, an = 'middle';
    if (pos === 'l') { lx = q[0] - rad - 8; an = 'start'; } else if (pos === 'r') { lx = q[0] + rad + 8; an = 'end'; } else if (pos === 'u') { ly = q[1] - rad - 30; } else { ly = q[1] + rad + 20; }
    const tx = el('text', { x: lx, y: ly, 'text-anchor': an, direction: 'rtl' }); tx.textContent = c[0]; gg.appendChild(tx);
    const t2 = el('text', { class: 'sm', x: lx, y: ly + 18, 'text-anchor': an, direction: 'rtl' }); t2.textContent = n + ' مشاركة'; gg.appendChild(t2);
  }
  const show = () => {
    const w = map.parentNode.getBoundingClientRect(), d = gg.querySelector('.city').getBoundingClientRect();
    mCard.innerHTML = `<b>${esc(c[0])}</b><span>${n} مشاركة في السجل</span>` + samples[c[0]].slice(0, 2).map((s) => `<span>${esc(s)}</span>`).join('');
    mCard.hidden = false;
    const x = d.left - w.left + d.width / 2, cw = mCard.offsetWidth;
    mCard.style.left = Math.max(0, Math.min(w.width - cw, x - cw / 2)) + 'px';
    mCard.style.top = (d.top - w.top - mCard.offsetHeight - 16) + 'px';
  };
  gg.addEventListener('mouseenter', show); gg.addEventListener('focus', show); gg.addEventListener('click', show);
  gg.addEventListener('mouseleave', () => (mCard.hidden = true)); gg.addEventListener('blur', () => (mCard.hidden = true));
  gC.appendChild(gg);
});
$('#mCount').textContent = placed.length;
$('#mLabel').textContent = `تم تنفيذ البرامج حضورياً في أكثر من ${Math.floor(placed.length / 10) * 10} موقعاً داخل وخارج المملكة`;
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { map.classList.add('in'); o.disconnect(); } }, { threshold: 0.3 }).observe(map);

// اللحظة 3ب: الدرع يتبع اليد
const tilt = $('#tilt');
if (tilt && !reduce && matchMedia('(hover:hover)').matches) {
  tilt.addEventListener('pointermove', (e) => {
    const r = tilt.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    tilt.classList.add('live');
    tilt.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
    tilt.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
    tilt.style.setProperty('--gx', x * 100 + '%'); tilt.style.setProperty('--gy', y * 100 + '%'); tilt.style.setProperty('--go', 1);
  });
  tilt.addEventListener('pointerleave', () => {
    tilt.classList.remove('live');
    tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg'); tilt.style.setProperty('--go', 0);
  });
}

// اللحظة 5: رزمة أصوات
const cards = $$('#deck .voice'); let top = 0;
const deckPos = $('#deckPos');
function nextCard() {
  const cur = cards[top];
  cur.classList.add('out');
  setTimeout(() => {
    cur.classList.remove('out'); top = (top + 1) % cards.length;
    cards.forEach((c, i) => { c.dataset.pos = (i - top + cards.length) % cards.length; });
    deckPos.textContent = `${top + 1} من ${cards.length}`;
  }, reduce ? 0 : 380);
}
cards.forEach((c) => c.addEventListener('click', nextCard));
$('#deckNext')?.addEventListener('click', nextCard);

function onScroll() { opening(); inkFill(); }
onScroll(); addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);

// بطاقات «خبرة تراكمت من الميدان» في الجوال: تحريك بالأسهم
const xp = $('#xpTrack');
if (xp) {
  const stepXp = (d) => { const c = xp.querySelector('li'); xp.scrollBy({ left: d * (c.offsetWidth + 14), behavior: reduce ? 'auto' : 'smooth' }); };
  $('#xpNext').addEventListener('click', () => stepXp(-1));
  $('#xpPrev').addEventListener('click', () => stepXp(1));
}
