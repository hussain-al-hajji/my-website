import { SECTIONS, FILES } from './schema.js';
import PUB from './public-config.json';
import { statsPanel } from './stats-view.js';

const ENV = import.meta.env;
// إعدادات Firebase للويب وعنوان الـ Worker عامة بطبيعتها (ليست أسراراً). المتغيّرات البيئية تتقدّم عليها إن وُجدت.
const CFG = {
  apiKey: ENV.PUBLIC_FIREBASE_API_KEY || PUB.apiKey, authDomain: ENV.PUBLIC_FIREBASE_AUTH_DOMAIN || PUB.authDomain,
  projectId: ENV.PUBLIC_FIREBASE_PROJECT_ID || PUB.projectId, appId: ENV.PUBLIC_FIREBASE_APP_ID || PUB.appId,
};
const B = (ENV.BASE_URL || '/').replace(/\/$/, '');
const API = (ENV.PUBLIC_API_URL || PUB.apiUrl || '').replace(/\/$/, '');
const CONFIGURED = !!(CFG.apiKey && CFG.projectId && API);
const FB = 'https://www.gstatic.com/firebasejs/11.0.2/';
const DEMO_KEY = 'admin-demo-v1';

const $ = (s, r = document) => r.querySelector(s);
const clone = (x) => JSON.parse(JSON.stringify(x));
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') e.value = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.'); let a = o;
  ks.slice(0, -1).forEach((k) => { a = a[k] ??= {}; });
  a[ks.at(-1)] = v;
}

// ---------- الحالة ----------
const seed = JSON.parse($('#seed').textContent);
const S = {
  mode: null, // 'live' | 'demo'
  user: null, token: async () => null,
  data: {}, base: {}, uploads: {}, // uploads: path -> {b64, url}
  section: SECTIONS[0].id, editing: null, filter: '', busy: false,
};
const root = $('#app');
let auth = null;

function load(src) {
  FILES.forEach((f) => { S.data[f] = clone(src[f]); S.base[f] = JSON.stringify(src[f]); });
}
const dirtyFiles = () => FILES.filter((f) => JSON.stringify(S.data[f]) !== S.base[f]);
const secOf = (id) => SECTIONS.find((s) => s.id === id);
const listOf = (s) => (s.kind === 'list' ? S.data[s.file] : null);
const objOf = (s) => (s.path ? S.data[s.file][s.path] ??= {} : S.data[s.file]);

function say(msg, kind = '') {
  let t = $('#toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.className = 'toast ' + kind; t.textContent = msg; t.hidden = false;
  clearTimeout(say.t); say.t = setTimeout(() => { t.hidden = true; }, 5200);
}

// ---------- حفظ محلي لوضع المعاينة ----------
function saveDemo() {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify({ data: S.data, uploads: S.uploads })); } catch { /* الحجم أو المنع */ }
}
function loadDemo() {
  try { const d = JSON.parse(localStorage.getItem(DEMO_KEY)); if (d) { FILES.forEach((f) => (S.data[f] = d.data[f] ?? S.data[f])); S.uploads = d.uploads || {}; } } catch { /* تجاهل */ }
}

// ---------- الصور ----------
const slug = (s) => (s.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'img').slice(0, 30);
async function compress(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  for (let q = 0.84; q >= 0.4; q -= 0.12) {
    const blob = await new Promise((r) => c.toBlob(r, 'image/webp', q));
    if (blob && blob.size <= 1_300_000) return blob;
  }
  throw new Error('الصورة كبيرة جداً حتى بعد الضغط.');
}
const toB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(blob); });
async function addUpload(file) {
  const blob = await compress(file);
  const b64 = await toB64(blob);
  const path = `/img/uploads/${slug(file.name)}-${Date.now().toString(36)}.webp`;
  S.uploads[path] = { b64, url: URL.createObjectURL(blob), kb: Math.round(blob.size / 1024) };
  return path;
}
const imgSrc = (p) => (S.uploads[p]?.url || (p ? (p.startsWith('http') ? p : B + p) : ''));

// ---------- حقول النموذج ----------
function field(f, get, set, ctx) {
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  const val = get(f.k);
  const wrap = h('div', { class: 'fld' + (f.type === 'bool' ? ' fld-bool' : '') });
  const label = h('label', { for: id }, f.label, f.required ? h('b', { class: 'req', 'aria-hidden': 'true' }, ' *') : '');
  const help = f.help ? h('small', {}, f.help) : null;
  const err = h('small', { class: 'err', role: 'alert' });
  wrap._err = err; wrap._f = f; wrap._get = () => get(f.k);
  let input;
  const upd = (v) => { set(f.k, v); if (ctx.touch) ctx.touch(); };
  switch (f.type) {
    case 'textarea': case 'md':
      input = h('textarea', { id, rows: f.rows || 4, onInput: (e) => upd(e.target.value), class: f.type === 'md' ? 'md' : '' }); input.value = val ?? ''; break;
    case 'bool':
      input = h('input', { id, type: 'checkbox', onChange: (e) => upd(e.target.checked) }); input.checked = !!val; break;
    case 'number':
      input = h('input', { id, type: 'number', onInput: (e) => upd(e.target.value === '' ? '' : +e.target.value) }); input.value = val ?? ''; break;
    case 'date':
      input = h('input', { id, type: 'date', onInput: (e) => upd(e.target.value) }); input.value = val ?? ''; break;
    case 'select': {
      input = h('select', { id, onChange: (e) => upd(e.target.value) },
        ...f.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; const op = h('option', { value: v }, l); if (v === val) op.selected = true; return op; }));
      break;
    }
    case 'combo': {
      const [file, key] = (f.from || '').split('.');
      const opts = [...new Set((S.data[file] || []).map((x) => x[key]).filter(Boolean))];
      const dl = h('datalist', { id: id + 'l' }, ...opts.map((o) => h('option', { value: o })));
      input = h('input', { id, list: id + 'l', onInput: (e) => upd(e.target.value) }); input.value = val ?? '';
      wrap.append(dl); break;
    }
    case 'multi': {
      input = h('div', { class: 'multi', id }, ...f.options.map(([v, l]) => {
        const cb = h('input', { type: 'checkbox', onChange: () => {
          const cur = new Set(get(f.k) || []); cb.checked ? cur.add(v) : cur.delete(v);
          upd(f.options.map((o) => o[0]).filter((x) => cur.has(x)));
        } });
        cb.checked = (val || []).includes(v);
        return h('label', { class: 'chk' }, cb, ' ', l);
      }));
      break;
    }
    case 'lines':
      input = h('textarea', { id, rows: Math.min(14, Math.max(4, (val || []).length + 1)), onInput: (e) => upd(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)) });
      input.value = (val || []).join('\n'); break;
    case 'image': {
      const prev = h('img', { class: 'thumb', alt: '' });
      const nm = h('span', { class: 'fname' });
      const refresh = () => { const v = get(f.k); prev.src = imgSrc(v); prev.hidden = !v; nm.textContent = v ? v.split('/').pop() + (S.uploads[v] ? ` · جديدة ${S.uploads[v].kb}KB` : '') : 'لا صورة'; };
      const file = h('input', { type: 'file', accept: 'image/*', id, hidden: true, onChange: async (e) => {
        const fl = e.target.files[0]; if (!fl) return;
        try { upd(await addUpload(fl)); refresh(); saveDemoIfNeeded(); } catch (x) { say(x.message, 'bad'); }
      } });
      input = h('div', { class: 'imgf' }, prev, h('div', {}, nm,
        h('div', { class: 'row-btns' },
          h('button', { type: 'button', class: 'btn sm', onClick: () => file.click() }, 'اختيار صورة'),
          h('button', { type: 'button', class: 'btn sm ghost', onClick: () => { upd(''); refresh(); } }, 'إزالة'))), file);
      refresh(); break;
    }
    case 'sections': {
      const keys = f.options.map((o) => o[0]), lab = Object.fromEntries(f.options);
      const cur = () => { const a = (get(f.k) || []).filter((k) => keys.includes(k)); return [...a, ...keys.filter((k) => !a.includes(k))]; };
      const box = h('ol', { class: 'ordl', id });
      const draw = () => {
        const a = cur();
        box.replaceChildren(...a.map((k, i) => h('li', {}, h('span', {}, `${i + 1}. ${lab[k]}`),
          h('span', { class: 'row-btns' },
            h('button', { type: 'button', class: 'btn sm ghost', disabled: i === 0, onClick: () => mv(i, -1) }, 'أعلى'),
            h('button', { type: 'button', class: 'btn sm ghost', disabled: i === a.length - 1, onClick: () => mv(i, 1) }, 'أسفل')))));
      };
      const mv = (i, d) => { const a = cur(), j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; upd(a); draw(); };
      if (!Array.isArray(get(f.k))) set(f.k, cur());
      draw(); input = box; break;
    }
    case 'objects': {
      const arr = () => get(f.k) || [];
      const box = h('div', { class: 'objs', id });
      const draw = () => {
        box.replaceChildren(...arr().map((it, i) => {
          const card = h('div', { class: 'objcard' },
            ...f.fields.map((sf) => field(sf, (k) => arr()[i][k], (k, v) => { arr()[i][k] = v; }, ctx)),
            h('div', { class: 'row-btns' },
              h('button', { type: 'button', class: 'btn sm ghost', onClick: () => mv(i, -1) }, 'أعلى'),
              h('button', { type: 'button', class: 'btn sm ghost', onClick: () => mv(i, 1) }, 'أسفل'),
              h('button', { type: 'button', class: 'btn sm danger', onClick: () => { arr().splice(i, 1); upd(arr()); draw(); } }, 'حذف')));
          return card;
        }), h('button', { type: 'button', class: 'btn sm', onClick: () => { const a = arr(); a.push(Object.fromEntries(f.fields.map((sf) => [sf.k, sf.type === 'bool' ? false : '']))); upd(a); draw(); } }, 'إضافة عنصر'));
      };
      const mv = (i, d) => { const a = arr(); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; upd(a); draw(); };
      if (!Array.isArray(get(f.k))) set(f.k, []);
      draw(); input = box; break;
    }
    default:
      input = h('input', { id, type: 'text', onInput: (e) => upd(e.target.value) }); input.value = val ?? '';
  }
  if (f.type === 'bool') wrap.append(...[h('label', { class: 'chk' }, input, ' ', f.label), help, err].filter(Boolean));
  else wrap.append(...[label, input, help, err].filter(Boolean));
  return wrap;
}
function validateForm(form) {
  let ok = true;
  form.querySelectorAll('.fld').forEach((w) => {
    if (!w._f) return;
    const f = w._f; const v = w._get(); let m = '';
    if (f.required && (v == null || v === '' || (Array.isArray(v) && !v.length))) m = 'مطلوب.';
    else if (f.pattern && v && !new RegExp(f.pattern).test(String(v))) m = 'صيغة غير صحيحة.';
    w._err.textContent = m; if (m) ok = false;
  });
  return ok;
}
function refreshCount() {
  saveDemoIfNeeded();
  const n = dirtyFiles().length;
  const c = $('.top .cnt'); if (c) c.textContent = n ? `${n} ملفات معدّلة` : 'لا تغييرات';
  const b = $('.top .btn.primary'); if (b && S.mode) b.disabled = S.busy || !n;
}
const saveDemoIfNeeded = () => { if (S.mode === 'demo') saveDemo(); };

// ---------- النشر ----------
async function publish() {
  const files = dirtyFiles();
  if (!files.length) return say('لا تغييرات للنشر.');
  if (S.mode !== 'live') return say('وضع المعاينة لا ينشر. اربط تسجيل الدخول أولاً، أو نزّل نسخة JSON.', 'bad');
  S.busy = true; render();
  try {
    const payload = files.map((f) => ({ path: `src/data/${f}.json`, content: JSON.stringify(S.data[f], null, 2) }));
    const used = JSON.stringify(files.map((f) => S.data[f]));
    Object.entries(S.uploads).forEach(([p, u]) => { if (used.includes(p)) payload.push({ path: 'public' + p, content: u.b64, encoding: 'base64' }); });
    const msg = 'تحديث: ' + files.map((f) => secOfFile(f)).join('، ');
    const r = await fetch(API + '/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await S.token()) }, body: JSON.stringify({ files: payload, message: msg }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 403 ? 'حسابك غير مسموح له بالنشر.' : j.message || 'تعذّر النشر (' + r.status + ').');
    files.forEach((f) => (S.base[f] = JSON.stringify(S.data[f])));
    S.uploads = {};
    say('تم النشر. يظهر التحديث على الموقع خلال دقيقتين تقريباً.', 'ok');
  } catch (e) { say(e.message, 'bad'); }
  S.busy = false; render();
}
const secOfFile = (f) => SECTIONS.filter((s) => s.file === f).map((s) => s.label)[0] || f;

function exportJson() {
  const bundle = Object.fromEntries(dirtyFiles().map((f) => [f, S.data[f]]));
  const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: 'تغييرات-الموقع.json' }); a.click(); URL.revokeObjectURL(url);
}
function resetDemo() {
  if (!confirm('مسح كل تغييرات المعاينة؟')) return;
  try { localStorage.removeItem(DEMO_KEY); } catch {}
  S.uploads = {}; load(seed); S.editing = null; render();
}

// ---------- مؤشرات الموقع ----------
const STATS = '__stats';
async function loadStats(force) {
  const st = S.stats || (S.stats = { status: 'idle', tab: 'overview' });
  if (S.mode !== 'live') { st.status = 'demo'; return render(); }
  if (st.status === 'ok' && !force) return render();
  st.status = 'loading'; render();
  try {
    const r = await fetch(API + '/api/stats', { headers: { Authorization: 'Bearer ' + (await S.token()) } });
    if (!r.ok) throw new Error('رمز ' + r.status);
    st.data = await r.json();
    st.audit = await fetch(B + '/seo-audit.json', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    st.status = 'ok';
  } catch (e) { st.status = 'err'; st.err = e.message; }
  render();
}

// ---------- العرض ----------
function render() {
  const sec = secOf(S.section);
  const dirty = dirtyFiles();
  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  root.replaceChildren(
    h('div', { class: 'shell' },
      h('aside', { class: 'side', 'aria-label': 'الأقسام' },
        h('div', { class: 'brand' }, h('img', { src: B + '/brand/icon-192.png', alt: '', width: 28, height: 28 }), h('b', {}, 'لوحة التحكم')),
        h('nav', {}, h('h2', {}, 'التحليلات'),
          h('button', { class: 'nav' + (S.section === STATS ? ' on' : ''), onClick: () => { S.section = STATS; S.editing = null; render(); loadStats(); } }, 'مؤشرات الموقع')),
        ...groups.map((g) => h('nav', {}, h('h2', {}, g), ...SECTIONS.filter((s) => s.group === g).map((s) =>
          h('button', { class: 'nav' + (s.id === S.section ? ' on' : ''), onClick: () => { S.section = s.id; S.editing = null; S.filter = ''; render(); } },
            s.label, dirty.includes(s.file) ? h('i', { class: 'dot', title: 'تغييرات غير منشورة' }) : '')))),
        h('div', { class: 'who' }, S.user ? [h('span', {}, S.user.email || S.user.name || 'مدير'), h('button', { class: 'btn sm ghost', onClick: signOutUser }, 'خروج')] : h('span', {}, 'وضع المعاينة'))),
      h('div', { class: 'main' },
        h('header', { class: 'top' },
          S.mode === 'demo' && h('p', { class: 'demo' }, 'وضع المعاينة: ما تكتبه يُحفظ في هذا المتصفح فقط ولا يصل إلى الموقع.'),
          h('div', { class: 'actions' },
            h('span', { class: 'cnt' }, dirty.length ? `${dirty.length} ملفات معدّلة` : 'لا تغييرات'),
            S.mode === 'demo' && h('button', { class: 'btn ghost', onClick: resetDemo }, 'مسح المعاينة'),
            dirty.length > 0 && h('button', { class: 'btn ghost', onClick: exportJson }, 'تنزيل JSON'),
            h('button', { class: 'btn primary', disabled: S.busy || !dirty.length, onClick: publish }, S.busy ? 'جارٍ النشر…' : 'نشر التغييرات'))),
        h('section', { class: S.section === STATS ? 'panel wide' : 'panel' }, S.section === STATS ? statsPanel({ h, S, reload: (soft) => (soft === true ? render() : loadStats(true)) }) : S.editing ? editor(sec) : sec.kind === 'list' ? listView(sec) : objectView(sec))),
    ));
}

function listView(sec) {
  const all = listOf(sec);
  const q = S.filter.trim();
  const rows = all.map((x, i) => ({ x, i })).filter(({ x }) => !q || (sec.title(x) + ' ' + sec.meta(x)).includes(q));
  if (sec.sort && !q) rows.sort((a, b) => sec.sort(a.x, b.x));
  const shown = rows.slice(0, 120);
  return h('div', {},
    h('div', { class: 'head' }, h('h1', {}, sec.label), h('button', { class: 'btn primary', onClick: () => { S.editing = { i: -1, draft: sec.blank() }; render(); } }, 'إضافة')),
    sec.help && h('p', { class: 'hint' }, sec.help),
    h('input', { class: 'q', type: 'search', placeholder: 'بحث في ' + sec.label, value: S.filter, 'aria-label': 'بحث', onInput: (e) => { S.filter = e.target.value; const pos = e.target.selectionStart; render(); const n = $('.q'); n.focus(); n.setSelectionRange(pos, pos); } }),
    h('p', { class: 'cnt' }, `${rows.length} عنصر${rows.length > shown.length ? ' (يُعرض أول 120، استخدم البحث)' : ''}`),
    h('ul', { class: 'items' }, ...shown.map(({ x, i }) => h('li', {},
      h('button', { class: 'item', onClick: () => { S.editing = { i, draft: clone(x) }; render(); } },
        h('b', {}, sec.title(x) || '(بلا عنوان)'), h('span', {}, sec.meta(x))),
      h('div', { class: 'row-btns' },
        sec.ordered && h('button', { class: 'btn sm ghost', 'aria-label': 'أعلى', onClick: () => { move(all, i, -1); render(); saveDemoIfNeeded(); } }, 'أعلى'),
        sec.ordered && h('button', { class: 'btn sm ghost', 'aria-label': 'أسفل', onClick: () => { move(all, i, 1); render(); saveDemoIfNeeded(); } }, 'أسفل'),
        h('button', { class: 'btn sm ghost', onClick: () => { const c = clone(x); c.id = (c.id || 'x') + '-copy' + Date.now().toString(36).slice(-3); if (c.slug) c.slug += '-copy'; all.splice(i + 1, 0, c); render(); saveDemoIfNeeded(); } }, 'نسخ'),
        h('button', { class: 'btn sm danger', onClick: () => { if (confirm('حذف «' + sec.title(x) + '»؟')) { all.splice(i, 1); render(); saveDemoIfNeeded(); } } }, 'حذف'))))));
}
function move(a, i, d) { const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; }

function editor(sec) {
  const { i, draft } = S.editing;
  const form = h('form', { class: 'form', novalidate: true, onSubmit: (e) => {
    e.preventDefault();
    if (!validateForm(form)) { say('راجع الحقول المطلوبة.', 'bad'); form.querySelector('.err:not(:empty)')?.scrollIntoView({ block: 'center' }); return; }
    const list = listOf(sec);
    if (sec.id === 'kits' && list.some((k, n) => k.id === draft.id && n !== i)) return say('المعرّف مستخدم في حقيبة أخرى.', 'bad');
    if (sec.id === 'posts' && draft.slug && list.some((k, n) => k.slug === draft.slug && n !== i)) return say('هذا المعرّف مستخدم في مقال آخر.', 'bad');
    if (i < 0) list.unshift(draft); else list[i] = draft;
    S.editing = null; saveDemoIfNeeded(); render(); say('حُفظ محلياً. اضغط «نشر التغييرات» ليظهر على الموقع.', 'ok');
  } },
    ...sec.fields.map((f) => field(f, (k) => getPath(draft, k), (k, v) => setPath(draft, k, v), {})),
    h('div', { class: 'row-btns sticky' },
      h('button', { class: 'btn primary', type: 'submit' }, 'حفظ'),
      h('button', { class: 'btn ghost', type: 'button', onClick: () => { S.editing = null; render(); } }, 'إلغاء')));
  return h('div', {}, h('div', { class: 'head' }, h('h1', {}, (i < 0 ? 'إضافة: ' : 'تعديل: ') + sec.label)), form);
}

function objectView(sec) {
  const o = objOf(sec);
  const form = h('form', { class: 'form', novalidate: true, onSubmit: (e) => { e.preventDefault(); saveDemoIfNeeded(); render(); say('حُفظ محلياً. اضغط «نشر التغييرات» ليظهر على الموقع.', 'ok'); } },
    ...sec.fields.map((f) => field(f, (k) => getPath(o, k), (k, v) => { setPath(o, k, v); }, { touch: refreshCount })),
    h('div', { class: 'row-btns sticky' }, h('button', { class: 'btn primary', type: 'submit' }, 'حفظ')));
  return h('div', {}, h('div', { class: 'head' }, h('h1', {}, sec.label)), sec.help && h('p', { class: 'hint' }, sec.help), form);
}

// ---------- الدخول ----------
function loginScreen() {
  root.replaceChildren(h('main', { class: 'login' },
    h('img', { src: B + '/brand/logo-full-light.svg', alt: 'حسين الحاجي', width: 240 }),
    h('h1', {}, 'لوحة التحكم'),
    CONFIGURED
      ? [h('p', {}, 'سجّل الدخول بحساب مسموح له.'),
        h('button', { class: 'btn primary wide', onClick: () => signIn('google') }, 'الدخول بحساب Google'),
        h('button', { class: 'btn dark wide', onClick: () => signIn('apple') }, 'الدخول بحساب Apple')]
      : h('p', { class: 'hint' }, 'لم يُربط تسجيل الدخول بعد (Firebase والـ Worker). يمكنك تجربة اللوحة في وضع المعاينة دون نشر.'),
    h('button', { class: CONFIGURED ? 'btn ghost wide' : 'btn primary wide', onClick: enterDemo }, 'وضع المعاينة'),
    h('p', { class: 'err', id: 'lerr', role: 'alert' })));
}
function enterDemo() { S.mode = 'demo'; load(seed); loadDemo(); render(); }

async function signIn(kind) {
  try {
    const { GoogleAuthProvider, OAuthProvider, signInWithPopup } = auth.mod;
    const p = kind === 'apple' ? new OAuthProvider('apple.com') : new GoogleAuthProvider();
    if (kind === 'apple') { p.addScope('email'); p.addScope('name'); }
    await signInWithPopup(auth.inst, p);
  } catch (e) { const el = $('#lerr'); if (el) el.textContent = e.code === 'auth/popup-closed-by-user' ? '' : 'تعذّر تسجيل الدخول.'; }
}
async function signOutUser() {
  if (S.mode === 'live') { await auth.mod.signOut(auth.inst); } else { S.mode = null; loginScreen(); }
}

async function enterLive(user) {
  S.mode = 'live'; S.user = user;
  try { localStorage.setItem('nocount', '1'); } catch {}   // لا تُحتسب زياراتي بعد دخول اللوحة
  S.token = () => user.getIdToken();
  load(seed);
  root.replaceChildren(h('p', { class: 'boot' }, 'جارٍ تحميل المحتوى…'));
  try {
    const r = await fetch(API + '/api/content', { headers: { Authorization: 'Bearer ' + (await user.getIdToken()) } });
    if (r.status === 403) { await auth.mod.signOut(auth.inst); loginScreen(); $('#lerr').textContent = 'هذا الحساب غير مسموح له بالدخول.'; return; }
    if (!r.ok) { const e = new Error('content'); e.status = r.status; throw e; }
    load(await r.json());
  } catch (e) {
    render();
    const why = e.status ? `رمز الخطأ ${e.status}` : 'تعذّر الاتصال بخدمة النشر';
    return say(`تعذّر جلب آخر نسخة من المحتوى (${why})، تُعرض النسخة المضمّنة في آخر بناء. النشر قد لا يعمل حتى تُصلح الخدمة.`, 'bad');
  }
  render();
}

async function boot() {
  if (!CONFIGURED) return loginScreen();
  try {
    const [app, mod] = await Promise.all([import(/* @vite-ignore */ FB + 'firebase-app.js'), import(/* @vite-ignore */ FB + 'firebase-auth.js')]);
    auth = { mod, inst: mod.getAuth(app.initializeApp(CFG)) };
    mod.onAuthStateChanged(auth.inst, (u) => { if (u) enterLive(u); else if (S.mode !== 'demo') { S.mode = null; S.user = null; loginScreen(); } });
  } catch { loginScreen(); $('#lerr').textContent = 'تعذّر تحميل خدمة الدخول.'; }
}
addEventListener('beforeunload', (e) => { if (S.mode === 'live' && dirtyFiles().length) { e.preventDefault(); e.returnValue = ''; } });
boot();
