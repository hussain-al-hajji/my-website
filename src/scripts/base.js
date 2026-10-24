// السلوكيات المشتركة: ظهور تدريجي، قائمة الجوال، البحث، عارض الصور، التصفية، النسخ.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

import './lang.js';
import { getAud, getGoal, AUDS } from './aud.js';
import './ink.js';
import './season.js';
import './hit.js';
import './rail.js';

// ظهور العناصر عند التمرير
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px' });
$$('[data-in]').forEach((el) => io.observe(el));

// خط بقلم رصاص تحت عناوين الأقسام: يُرسم من اليمين عند ظهور العنوان
const hio = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('ul-in'); hio.unobserve(e.target); }
}), { threshold: 0.7 });
$$('h2.h2, .sec-head h2').forEach((el) => hio.observe(el));

// قائمة الجوال
const mnav = $('#mnav');
const openBtn = $('[data-menu-open]');
function menu(open) {
  mnav.hidden = !open;
  openBtn.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) $('[data-menu-close]').focus(); else openBtn.focus();
}
openBtn?.addEventListener('click', () => menu(true));
$('[data-menu-close]')?.addEventListener('click', () => menu(false));
$$('a', mnav).forEach((a) => a.addEventListener('click', () => menu(false)));

// البحث
const sov = $('#sov'), sq = $('#sq'), sres = $('#sres');
let index = null, sel = -1, results = [];
const KIND = { page: 'صفحة', kit: 'حقيبة تدريبية', news: 'خبر', post: 'مقال', record: 'سجل الأثر', course: 'دورة', media: 'إعلام', project: 'مشروع' };
const norm = (s = '') => String(s).replace(/[ً-ٰٟـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[“”«»"'،؛:.\-–—()]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
async function load() {
  if (index) return index;
  try {
    const r = await fetch(document.body.dataset.search);
    index = (await r.json()).map((x) => ({ ...x, _t: norm(x.t), _x: norm(x.x || '') }));
  } catch { index = []; }
  return index;
}
function paint() {
  sres.innerHTML = '';
  if (!sq.value.trim()) { sres.innerHTML = '<li class="shint">اكتب كلمة أو أكثر. اضغط Esc للإغلاق.</li>'; return; }
  if (!results.length) { sres.innerHTML = '<li class="shint">لا نتائج مطابقة.</li>'; return; }
  results.forEach((r, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = r.u; a.setAttribute('aria-selected', String(i === sel));
    a.innerHTML = '<span class="kind"></span><b></b><span class="d"></span>';
    a.children[0].textContent = KIND[r.k] || '';
    a.children[1].textContent = r.t;
    a.children[2].textContent = r.d || '';
    li.append(a); sres.append(li);
  });
}
async function run() {
  const terms = norm(sq.value).split(' ').filter(Boolean);
  if (!terms.length) { results = []; sel = -1; paint(); return; }
  const idx = await load();
  results = idx.map((x) => {
    let s = 0;
    for (const t of terms) {
      if (x._t.includes(t)) s += 5; else if (x._x.includes(t)) s += 1; else return null;
    }
    return { ...x, s };
  }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 12);
  sel = results.length ? 0 : -1;
  paint();
}
function search(open) {
  sov.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) { sq.value = ''; results = []; paint(); sq.focus(); load(); }
}
$$('[data-search-open]').forEach((b) => b.addEventListener('click', () => search(true)));
sq?.addEventListener('input', run);
sov?.addEventListener('click', (e) => { if (e.target === sov) search(false); });
sq?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!results.length) return;
    sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; paint();
    $$('a', sres)[sel]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && results[sel]) location.href = results[sel].u;
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!sov.hidden) search(false); if (!lb.hidden) lbClose(); if (!mnav.hidden) menu(false); }
  if ((e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault(); search(true);
  }
});

// عارض الصور: أي عنصر [data-lightbox] ضمن مجموعة data-group
const lb = $('#lb'), lbi = $('#lbi'), lbc = $('#lbc');
let group = [], gi = 0, lastFocus = null;
function lbShow() {
  const it = group[gi]; lbi.src = it.src; lbi.alt = it.cap || ''; lbc.textContent = it.cap || '';
}
function lbOpen(items, i) { lastFocus = document.activeElement; group = items; gi = i; lbShow(); lb.hidden = false; document.body.style.overflow = 'hidden'; $('[data-lb=close]').focus(); }
function lbClose() { lb.hidden = true; document.body.style.overflow = ''; lbi.removeAttribute('src'); lastFocus?.focus(); }
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-lightbox]');
  if (t) {
    const g = t.dataset.group || '';
    const els = $$('[data-lightbox]').filter((x) => (x.dataset.group || '') === g && !x.closest('[hidden]'));
    lbOpen(els.map((x) => ({ src: x.dataset.full || x.querySelector('img')?.src, cap: x.dataset.cap || x.querySelector('img')?.alt })), els.indexOf(t));
    return;
  }
  const c = e.target.closest('[data-lb]');
  if (c) {
    if (c.dataset.lb === 'close') lbClose();
    else { gi = (gi + (c.dataset.lb === 'next' ? 1 : -1) + group.length) % group.length; lbShow(); }
  } else if (e.target === lb) lbClose();
});
addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  if (e.key === 'ArrowLeft') { gi = (gi + 1) % group.length; lbShow(); }
  if (e.key === 'ArrowRight') { gi = (gi - 1 + group.length) % group.length; lbShow(); }
});

// تصفية عامة: [data-filter-root] يحتوي أزرار [data-f="key:value"] وعناصر [data-item] بخاصية data-<key>
$$('[data-filter-root]').forEach((root) => {
  const items = $$('[data-item]', root);
  const input = $('[data-q]', root);
  const count = $('[data-count-out]', root);
  const empty = $('[data-empty]', root);
  const state = {};
  function apply() {
    const q = norm(input?.value || '');
    let n = 0;
    items.forEach((el) => {
      let ok = true;
      for (const [k, v] of Object.entries(state)) if (v && !(el.dataset[k] || '').split('|').includes(v)) ok = false;
      if (ok && q && !norm(el.dataset.text || el.textContent).includes(q)) ok = false;
      el.hidden = !ok; if (ok) n++;
    });
    if (count) count.textContent = n + ' نتيجة';
    if (empty) empty.hidden = n > 0;
  }
  $$('[data-f]', root).forEach((b) => b.addEventListener('click', () => {
    const [k, v] = b.dataset.f.split(':');
    $$(`[data-f^="${k}:"]:not([data-clone])`, root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    state[k] = v; apply();
  }));
  input?.addEventListener('input', apply);
  apply();
  // رابط حملة: ?for=owners&goal=ai يحدّد الفئة والمخرج مسبقاً
  const A = getAud(), G = getGoal();
  if (A) $(`[data-f="aud:${A}"]:not([data-clone])`, root)?.click();
  if (G) $(`[data-f="goal:${G}"]:not([data-clone])`, root)?.click();
});

// شريط اختيارات أفقي دائري: يُسحب يميناً ويساراً ويعود من أوله عند آخر خيار دون رجوع
$$('[data-loop]').forEach((row) => {
  const orig = [...row.children];
  if (orig.length < 2) return;
  row.classList.add('looping');                       // سطر واحد: نقيس عرضه الحقيقي
  if (row.scrollWidth <= row.clientWidth + 2) { row.classList.remove('looping'); return; }   // يتسع كله: يبقى بلا حلقة
  const mk = (src) => src.map((el) => {
    const c = el.cloneNode(true);
    c.dataset.clone = '1'; c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; c.removeAttribute('id');
    return c;
  });
  const before = mk(orig), after = mk(orig);
  row.prepend(...before); row.append(...after);
  const rtl = getComputedStyle(row).direction === 'rtl';
  const get = () => (rtl ? -row.scrollLeft : row.scrollLeft), put = (p) => { row.scrollLeft = rtl ? -p : p; };
  let W = 0;
  const measure = () => {
    W = Math.abs(after[0].getBoundingClientRect().left - orig[0].getBoundingClientRect().left);
    return W;
  };
  const home = () => { measure(); put(W); };
  home();
  addEventListener('resize', () => { const frac = W ? (get() - W) / W : 0; measure(); put(W + frac * W); });
  let busy = false;
  row.addEventListener('scroll', () => {
    if (busy || !W) return;
    const p = get();
    if (p < W * 0.35) { busy = true; put(p + W); } else if (p > W * 1.65) { busy = true; put(p - W); }
    requestAnimationFrame(() => { busy = false; });
  }, { passive: true });
  // النسخ تعكس حالة الأصل وتنقل نقراتها إليه
  const sync = () => orig.forEach((o, i) => { const v = o.getAttribute('aria-pressed'); if (v != null) { before[i].setAttribute('aria-pressed', v); after[i].setAttribute('aria-pressed', v); } });
  const mo = new MutationObserver(sync);
  orig.forEach((o) => mo.observe(o, { attributes: true, attributeFilter: ['aria-pressed'] }));   // الأصول فقط، حتى لا تتكرر الحلقة
  sync();
  row.addEventListener('click', (e) => {
    const c = e.target.closest('[data-clone]'); if (!c) return;
    const i = (c.parentElement === row ? [...before, ...after] : []).indexOf(c) % orig.length;
    if (i >= 0) orig[i].click();
  });
  // سحب بالفأرة على الحاسوب
  let d = null, moved = 0;
  row.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button) return; d = { x: e.clientX, s: row.scrollLeft }; moved = 0; });
  row.addEventListener('pointermove', (e) => {
    if (!d) return; const dx = e.clientX - d.x; moved = Math.max(moved, Math.abs(dx));
    if (moved > 5) { row.classList.add('dragging'); row.scrollLeft = d.s - dx; }
  });
  const stop = () => { d = null; row.classList.remove('dragging'); };
  row.addEventListener('pointerup', stop); row.addEventListener('pointerleave', stop);
  row.addEventListener('click', (e) => { if (moved > 5) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
});

// زر واتساب العائم: رسالة مناسبة للصفحة، وللحقيبة التي يقرؤها الزائر
const fab = $('#waFab');
if (fab) {
  let kit = '';
  const aud = getAud();
  const page = location.origin + location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '');
  const title = fab.dataset.title || document.title.split('|')[0].trim();
  const msg = () => {
    const l = ['السلام عليكم ورحمة الله،', ''];
    if (kit) l.push(`أرغب في الاستفسار عن حقيبة «${kit}».`);
    else if (fab.dataset.type === 'article') l.push(`قرأتُ مقالك «${title}» وأودّ التواصل معك.`);
    else if (location.pathname.endsWith('/') || /\/(index)?(\.html)?$/.test(location.pathname)) l.push('زرتُ موقعك وأرغب في الحديث معك.');
    else l.push(`زرتُ صفحة «${title}» وأرغب في الحديث معك.`);
    if (aud) l.push('', 'الفئة: ' + AUDS[aud]);
    l.push('', 'الصفحة: ' + page);
    return l.join('\n');
  };
  const sync = () => { fab.href = 'https://wa.me/' + fab.dataset.wa + '?text=' + encodeURIComponent(msg()); };
  sync();
  fab.addEventListener('click', sync);
  const kits = $$('.kit[id]');
  if (kits.length) {
    const vis = new Map();
    const ko = new IntersectionObserver((es) => {
      es.forEach((e) => vis.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
      const best = [...vis.entries()].sort((a, b) => b[1] - a[1])[0];
      kit = best && best[1] > 0 ? ($('h2', best[0])?.textContent || '').trim() : '';
      sync();
    }, { threshold: [0, .25, .5, .75] });
    kits.forEach((k) => ko.observe(k));
  }
  const show = () => { fab.hidden = false; fab.classList.toggle('on', scrollY > 520); };
  show(); addEventListener('scroll', show, { passive: true });
}

// نسخ نص
$$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); const o = b.textContent; b.textContent = 'تم النسخ'; setTimeout(() => (b.textContent = o), 1600); } catch {}
}));
$$('[data-share]').forEach((b) => b.addEventListener('click', async () => {
  const d = { title: document.title, url: location.href };
  if (navigator.share) { try { await navigator.share(d); } catch {} } else { try { await navigator.clipboard.writeText(d.url); b.textContent = 'تم نسخ الرابط'; } catch {} }
}));
