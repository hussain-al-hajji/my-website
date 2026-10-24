// لحظات التفاعل في الصفحة الرئيسية.
import { getAud, getGoal } from './aud.js';
import { onTilt } from './tiltfx.js';
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
// رابط حملة ?for=owners&goal=ai: يُحدَّد الجمهور والمخرج في الباحث وتظهر جملة ترحيب في الأعلى
{
  const A = getAud(), G = getGoal();
  if (A) { sel.a = A; $$('.seg[data-q="a"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === A))); }
  if (G) { sel.g = G; $$('.seg[data-q="g"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === G))); }
  const line = A && data.campaign?.[A], box = $('#forLine');
  if (line && box) {
    box.innerHTML = `<span>${esc(line)}</span><a class="pill" href="${data.collabUrl}?for=${A}${G ? '&goal=' + G : ''}">الحقائب المناسبة لي</a>`;
    box.hidden = false;
  }
}
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
  $$('button:not([data-clone])', grp).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  sel[grp.dataset.q] = b.dataset.v; render();
})));
render();

// اللحظة 0: حلقة صور البرامج
const ring = $('#ring'), stage = $('#ringStage'), sub = $('#sub');
const subBase = sub.innerHTML;
const frames = []; let spin = 0, vel = 0, rxNow = 500, dragging = false, paused = false, visible = true, last = performance.now();
data.ring.forEach((f, k) => {
  const a = document.createElement('a');
  a.className = 'frame'; a.draggable = false; a.href = data.recordsUrl; a.setAttribute('aria-label', `${f.title}، ${f.caption}`);
  const im = document.createElement('img'); im.src = f.image; im.alt = ''; im.draggable = false; im.decoding = 'async'; im.loading = k < 8 ? 'eager' : 'lazy';
  const fr = { el: a, k, ar: f.ratio || 1.5 };
  const setAr = () => { if (im.naturalWidth) fr.ar = Math.min(2.2, Math.max(0.6, im.naturalWidth / im.naturalHeight)); };
  im.addEventListener('load', setAr); setAr();
  a.append(im);
  const on = () => { if (dragging) return; paused = true; ring.classList.add('focus'); frames.forEach((x) => x.el.classList.remove('on')); a.classList.add('on'); sub.innerHTML = `<b>${esc(f.title)}</b>${esc(f.caption)}`; };
  const off = () => { paused = false; ring.classList.remove('focus'); a.classList.remove('on'); sub.innerHTML = subBase; };
  a.addEventListener('mouseenter', on); a.addEventListener('focus', on); a.addEventListener('mouseleave', off); a.addEventListener('blur', off);
  ring.appendChild(a); frames.push(fr);
});
function drawRing() {
  const W = ring.clientWidth, H = ring.clientHeight, phone = W < 760, n = phone ? 12 : frames.length;
  const r = stage.getBoundingClientRect(), c = reduce ? 0 : Math.min(1, Math.max(0, -r.top / (H * 0.55)));
  const cx = W / 2, cy = H / 2;
  const rx = (phone ? W * 0.62 : Math.min(600, W * 0.42)) * (1 - c * 0.85); rxNow = rx;
  const ry = (phone ? W * 0.74 : Math.min(450, H * 0.45)) * (1 - c * 0.85);
  frames.forEach((f, i) => {
    if (i >= n) { f.el.hidden = true; return; }
    f.el.hidden = false;
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2 + spin, x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t), depth = (Math.sin(t) + 1) / 2;
    // الصورة الواصلة أسفل الأزرار تكبر تدريجياً، وتعود لحجمها حين تبتعد
    const bot = Math.max(0, Math.min(1, (Math.sin(t) - 0.84) / 0.16)), grow = 1 + (phone ? 0.5 : 0.7) * bot * bot * (3 - 2 * bot);
    const base = phone ? 60 + 26 * depth : 96 + 58 * depth, area = base * base * 0.75;
    const w = Math.sqrt(area * f.ar), hgt = Math.sqrt(area / f.ar);
    const ang = Math.max(-24, Math.min(24, Math.cos(t) * -18)) * (1 - Math.min(1, (grow - 1) * 3));
    f.el.style.width = w + 'px'; f.el.style.height = hgt + 'px'; f.el.style.zIndex = depth > 0.5 ? 2 : 1;
    let sc = (f.el.classList.contains('on') ? 1.25 : 1) * grow * (1 - c * 0.55);
    // النمو يمتد إلى الأسفل: تبقى الحافة العلوية مكانها فلا تغطي الأزرار
    const yy = y + (grow > 1 ? hgt * (sc - (1 - c * 0.55)) / 2 : 0);
    f.el.style.transform = `translate(${x - w / 2}px,${yy - hgt / 2}px) rotate(${ang.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
    if (!ring.classList.contains('focus')) f.el.style.opacity = (1 - c).toFixed(3);
  });
}
function loop(t) {
  const dt = Math.min(64, t - last); last = t;
  if (!dragging) {
    if (Math.abs(vel) > 1e-6) { spin += vel * dt; vel *= Math.pow(0.94, dt / 16); } else vel = 0;
    if (!paused && !reduce && visible) spin += dt * 0.000045;
  }
  if (visible) drawRing();
  requestAnimationFrame(loop);
}
new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(stage);
// سحب الحلقة باليد يميناً ويساراً مع قصور ذاتي، وتستأنف حركتها الآلية بعد الإفلات
{
  let down = null, moved = 0, lx = 0, lt = 0, wasPaused = false;
  const cyOf = () => stage.getBoundingClientRect().top + ring.clientHeight / 2;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('.core > div')) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, top: e.clientY < cyOf() }; moved = 0; lx = e.clientX; lt = performance.now(); vel = 0;
  });
  stage.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - lx, now = performance.now(), dtm = Math.max(1, now - lt);
    moved += Math.abs(dx);
    if (!dragging && moved > 6) { dragging = true; wasPaused = paused; paused = true; ring.classList.add('dragging'); ring.classList.remove('focus'); frames.forEach((x) => x.el.classList.remove('on')); stage.setPointerCapture(e.pointerId); }
    if (!dragging) return;
    const dth = (down.top ? 1 : -1) * dx / Math.max(200, rxNow);
    spin += dth; vel = 0.8 * vel + 0.2 * (dth / dtm); lx = e.clientX; lt = now;
  });
  const end = (e) => {
    if (!down || (e && e.pointerId !== down.id)) return;
    const was = dragging; down = null;
    if (was) { dragging = false; paused = wasPaused; ring.classList.remove('dragging'); setTimeout(() => { moved = 0; }, 0); }
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  // لا يُفتح الرابط بعد سحب
  stage.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  // لوحة اللمس: التمرير الأفقي يحرّك الحلقة
  stage.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) { e.preventDefault(); spin -= e.deltaX / Math.max(200, rxNow); }
  }, { passive: false });
}

drawRing(); requestAnimationFrame(loop);

// اللحظة 2ب: خريطة الأثر من السجل نفسه
const CITIES = data.cities;
const counts = {}, samples = {};
log.forEach((r) => {
  const txt = `${r.l} ${r.o} ${r.n}`;
  const add = (c) => { counts[c[0]] = (counts[c[0]] || 0) + 1; (samples[c[0]] = samples[c[0]] || []).push(r.n); };
  let hit = false;
  CITIES.forEach((c) => { if (c[1].some((k) => txt.includes(k))) { add(c); hit = true; } });
  // أي برنامج حضوري لم تُحدَّد مدينته يُحتسب في الرياض
  if (!hit && !/عن بُعد/.test(r.k || '')) { const ry = CITIES.find((c) => c[0] === 'الرياض'); if (ry) add(ry); }
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
onTilt(tilt, (x, y) => {
  if (!tilt) return;
  tilt.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(2) + 'deg'); tilt.style.setProperty('--rx', ((0.5 - y) * 14).toFixed(2) + 'deg');
  tilt.style.setProperty('--gx', x * 100 + '%'); tilt.style.setProperty('--gy', y * 100 + '%'); tilt.style.setProperty('--go', 1);
});
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

// ذوبان الرسم إلى الصورة: بالمؤشر على الحاسوب، وباللمس على الجوال
const pfig = $('#pfig');
if (pfig) {
  let off = 0;
  const at = (e) => {
    const r = pfig.getBoundingClientRect();
    pfig.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
    pfig.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
  };
  pfig.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; at(e); pfig.classList.add('on'); });
  pfig.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pfig.classList.remove('on'); });
  pfig.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(off);
    if (pfig.classList.toggle('on')) { at(e); off = setTimeout(() => pfig.classList.remove('on'), 3600); }
  });
}

// شاشة الافتتاح: الصورة والمخطوطة كبيرتان وتومضان ثم تتقلصان إلى مكانهما في الرئيسية
const splash = $('#splash');
if (splash) {
  const root = document.documentElement;
  const finish = () => { root.classList.remove('sp-on'); root.classList.add('sp-done'); splash.remove(); };
  if (!root.classList.contains('sp-on')) splash.remove();
  else {
    const decoded = Promise.all($$('img', splash).map((i) => (i.decode ? i.decode().catch(() => {}) : 0)));
    const hold = new Promise((r) => setTimeout(r, Math.max(0, 2250 - performance.now())));
    Promise.all([decoded, hold]).then(() => {
      scrollTo(0, 0);
      const jobs = [[$('.sp-fig', splash), $('#pfig')], [$('.sp-name', splash), $('.hero-name img')]];
      const anims = jobs.map(([el, to]) => {
        const c = el.getBoundingClientRect(), t = to.getBoundingClientRect();
        return el.animate(
          [{ transformOrigin: '0 0', transform: 'none' }, { transformOrigin: '0 0', transform: `translate(${t.left - c.left}px,${t.top - c.top}px) scale(${t.width / c.width})` }],
          { duration: 1050, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' },
        );
      });
      splash.animate([{ backgroundColor: 'rgba(255,255,255,1)' }, { backgroundColor: 'rgba(255,255,255,1)', offset: .4 }, { backgroundColor: 'rgba(255,255,255,0)' }], { duration: 1050, fill: 'forwards' });
      return Promise.all(anims.map((a) => a.finished));
    }).then(finish, finish);
  }
}

// روزنامة المدرب: بكرة عمودية، البارز في وسطها وما فوقه وتحته يخفت ويميل
const whView = $('#whView');
if (whView) {
  const rows = $$('.wh-row', whView), count = $('#whCount'), up = $('#whUp'), down = $('#whDown');
  const today = new Date().toLocaleDateString('en-CA');
  const LBL = { past: 'منجز', now: 'جارٍ الآن', next: 'قادم' };
  rows.forEach((r) => {
    const st = r.dataset.to < today ? 'past' : r.dataset.from <= today ? 'now' : 'next';
    r.dataset.state = st; $('.wh-state', r).textContent = LBL[st];
  });
  let rh = rows[0].offsetHeight, cur = -1, raf = 0;
  const paint = () => {
    raf = 0;
    const c = whView.scrollTop + whView.clientHeight / 2;
    let best = 0, bd = 1e9;
    rows.forEach((r, i) => {
      const d = (r.offsetTop + rh / 2 - c) / rh, a = Math.min(Math.abs(d), 2.6);
      r.style.setProperty('--d', d.toFixed(3)); r.style.setProperty('--a', a.toFixed(3));
      if (Math.abs(d) < bd) { bd = Math.abs(d); best = i; }
    });
    if (best !== cur) {
      cur = best;
      rows.forEach((r, i) => { r.classList.toggle('is-focus', i === best); r.querySelector('.wh-like').tabIndex = i === best ? 0 : -1; });
      count.textContent = `برنامج ${best + 1} من ${rows.length}`;
      up.disabled = best === 0; down.disabled = best === rows.length - 1;
    }
  };
  const go = (i, smooth = true) => whView.scrollTo({ top: Math.max(0, Math.min(rows.length - 1, i)) * rh, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  const focusIndex = () => { const i = rows.findIndex((r) => r.dataset.state !== 'past'); return i < 0 ? rows.length - 1 : i; };
  const measure = () => { rh = rows[0].offsetHeight; go(cur < 0 ? focusIndex() : cur, false); paint(); };
  whView.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
  rows.forEach((r, i) => r.addEventListener('click', (e) => { if (i !== cur && !e.target.closest('a')) go(i); }));
  up.addEventListener('click', () => go(cur - 1)); down.addEventListener('click', () => go(cur + 1));
  whView.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); go(cur - 1); } else if (e.key === 'ArrowDown') { e.preventDefault(); go(cur + 1); }
  });
  addEventListener('resize', measure);
  measure(); requestAnimationFrame(measure);
}

function onScroll() { opening(); inkFill(); }
onScroll(); addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);

// بطاقات «خبرة تراكمت من الميدان» في الجوال: تحريك بالأسهم
const xp = $('#xpTrack');
if (xp) {
  const stepXp = (d) => { const c = xp.querySelector('li'); xp.scrollBy({ left: d * (c.offsetWidth + 14), behavior: reduce ? 'auto' : 'smooth' }); };
  $('#xpNext').addEventListener('click', () => stepXp(-1));
  $('#xpPrev').addEventListener('click', () => stepXp(1));
}
