// عرض الأقسام في لوحة التحكم لصفحات منشورة مقسّمة بعناوين: عنّي، الشراكات، الإعلام، مكتبة الأوامر، المشاريع المميزة.
// كل قسم عنوان جانبي مطوي يُفتح بالضغط، ويمكن تسميته وترتيبه (سحب أو أسهم) وإخفاؤه وإضافة أقسام جديدة ونقل العناصر بينها.
import { resolveGroups, GROUP_PAGES } from '../lib/group-defaults.js';

const strip = (g) => { const o = { id: g.id, title: g.title }; if (g.hidden) o.hidden = true; if (g.block) o.block = g.block; if (g.style) o.style = g.style; return o; };
const STYLES = [['', 'قائمة زمنية'], ['table', 'جدول'], ['chips', 'وسوم']];
let drag = null; // { kind: 'group'|'item', id|index }

export function groupedView(c) {
  const { h, S, sec, field, say, render, save, openEditor, clone, getPath, setPath, touch } = c;
  const cfg = sec.grouped, page = cfg.page, key = GROUP_PAGES[page].key, file = sec.file;
  const pages = S.data.pages, list = S.data[file];
  const st = (S.gv ||= {})[sec.id] ||= { open: new Set(), filter: '', adding: false };
  const view = () => resolveGroups(page, pages.groups?.[page], list);
  const write = (arr) => { (pages.groups ||= {})[page] = arr.map(strip); save(); render(); };
  const mutate = (id, fn) => { const arr = view().map((g) => ({ ...g })); const g = arr.find((x) => x.id === id); if (g) fn(g, arr); write(arr); };
  const move = (id, d) => { const arr = view(); const i = arr.findIndex((g) => g.id === id), j = i + d; if (i < 0 || j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; write(arr); };
  const reorderTo = (fromId, toId, after) => {
    const arr = view(); const from = arr.findIndex((g) => g.id === fromId); if (from < 0 || fromId === toId) return;
    const [g] = arr.splice(from, 1); let to = arr.findIndex((x) => x.id === toId); if (to < 0) return; if (after) to += 1; arr.splice(to, 0, g); write(arr);
  };
  const itemsOf = (id) => list.map((x, i) => ({ x, i })).filter(({ x }) => x[key] === id);
  const groups = view();
  const known = new Set(groups.map((g) => g.id));
  const orphans = list.map((x, i) => ({ x, i })).filter(({ x }) => !known.has(x[key]));
  const q = st.filter.trim();
  const match = ({ x }) => !q || (sec.title(x) + ' ' + (sec.meta(x) || '')).includes(q);

  const itemRow = ({ x, i }, gid, idx, total) => h('li', { class: 'gv-item', draggable: 'true',
    onDragstart: (e) => { drag = { kind: 'item', index: i }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); },
    onDragend: () => { drag = null; } },
    h('button', { type: 'button', class: 'item', onClick: () => openEditor(i, clone(x)) }, h('b', {}, sec.title(x) || '(بلا عنوان)'), h('span', {}, sec.meta(x))),
    h('div', { class: 'row-btns' },
      h('select', { class: 'gv-move', 'aria-label': 'نقل إلى قسم آخر', onChange: (e) => { if (e.target.value) { x[key] = e.target.value; st.open.add(e.target.value); save(); render(); say('نُقل العنصر. اضغط «نشر التغييرات» ليظهر.', 'ok'); } } },
        h('option', { value: '' }, 'نقل إلى…'), ...groups.filter((g) => !g.block && g.id !== gid).map((g) => h('option', { value: g.id }, g.title))),
      h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': 'أعلى', disabled: idx === 0, onClick: () => swap(gid, idx, -1) }, 'أعلى'),
      h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': 'أسفل', disabled: idx === total - 1, onClick: () => swap(gid, idx, 1) }, 'أسفل'),
      h('button', { type: 'button', class: 'btn sm ghost', onClick: () => { const cp = clone(x); cp.id = (cp.id || 'x') + '-copy' + Date.now().toString(36).slice(-3); list.splice(i + 1, 0, cp); save(); render(); } }, 'نسخ'),
      h('button', { type: 'button', class: 'btn sm danger', onClick: () => { if (confirm('حذف «' + sec.title(x) + '»؟')) { list.splice(i, 1); save(); render(); } } }, 'حذف')));
  function swap(gid, idx, d) {
    const its = itemsOf(gid), a = its[idx], b = its[idx + d]; if (!a || !b) return;
    [list[a.i], list[b.i]] = [list[b.i], list[a.i]]; save(); render();
  }

  const blockBody = (g) => {
    const fields = (cfg.blocks || {})[g.block] || [];
    return h('form', { class: 'form gv-form', novalidate: true, onSubmit: (e) => { e.preventDefault(); save(); say('حُفظ محلياً. اضغط «نشر التغييرات» ليظهر على الموقع.', 'ok'); } },
      ...fields.map((f) => field(f, (k) => getPath(pages, k), (k, v) => setPath(pages, k, v), { touch })),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', type: 'submit' }, 'حفظ')));
  };

  const settings = (g) => {
    const row = h('div', { class: 'gv-set' });
    const name = h('input', { class: 'gv-name', type: 'text', value: g.title, 'aria-label': 'اسم القسم' });
    const commit = () => { const v = name.value.trim(); if (v && v !== g.title) mutate(g.id, (x) => { x.title = v; }); };
    name.addEventListener('change', commit); name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    row.append(h('label', { class: 'gv-lbl' }, 'اسم القسم', name));
    if (!(cfg.fixed || []).includes(g.id)) row.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !g.hidden, onChange: (e) => mutate(g.id, (x) => { x.hidden = !e.target.checked; }) }), ' يظهر في الصفحة'));
    if (cfg.pdf && !g.block && g.style !== 'chips') {
      const pdf = pages.bio.pdf || [];
      row.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: pdf.includes(g.id), onChange: (e) => { const s = new Set(pages.bio.pdf || []); e.target.checked ? s.add(g.id) : s.delete(g.id); pages.bio.pdf = [...s]; save(); } }), ' يُدرج في السيرة الذاتية PDF'));
    }
    if (cfg.styles && !g.block) {
      const sel = h('select', { 'aria-label': 'نمط العرض', onChange: (e) => mutate(g.id, (x) => { x.style = e.target.value; }) }, ...STYLES.map(([v, l]) => h('option', { value: v, selected: (g.style || '') === v }, l)));
      row.append(h('label', { class: 'gv-lbl sm' }, 'نمط العرض', sel));
    }
    if (g.custom && !g.block) {
      const empty = !itemsOf(g.id).length;
      row.append(h('button', { type: 'button', class: 'btn sm danger', disabled: !empty, title: empty ? '' : 'انقل عناصر القسم أولاً', onClick: () => { if (confirm('حذف القسم «' + g.title + '»؟')) { write(view().filter((x) => x.id !== g.id)); } } }, 'حذف القسم'));
    }
    return row;
  };

  const groupEl = (g, n) => {
    const its = itemsOf(g.id), shown = its.filter(match);
    if (q && !g.block && !shown.length) return null;
    const open = st.open.has(g.id) || (!!q && shown.length > 0);
    const head = h('div', { class: 'gv-head', onDragover: (e) => { if (drag) { e.preventDefault(); head.classList.add('over'); } }, onDragleave: () => head.classList.remove('over'),
      onDrop: (e) => {
        e.preventDefault(); head.classList.remove('over'); if (!drag) return;
        if (drag.kind === 'item' && !g.block) { const it = list[drag.index]; if (it) { it[key] = g.id; st.open.add(g.id); save(); render(); say('نُقل العنصر إلى «' + g.title + '».', 'ok'); } }
        else if (drag.kind === 'group') { const r = head.getBoundingClientRect(); reorderTo(drag.id, g.id, e.clientY > r.top + r.height / 2); }
        drag = null;
      } },
      h('span', { class: 'gv-grip', draggable: 'true', title: 'اسحب لإعادة الترتيب', 'aria-hidden': 'true',
        onDragstart: (e) => { drag = { kind: 'group', id: g.id }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g.id); e.dataTransfer.setDragImage(head, 20, 20); }, onDragend: () => { drag = null; } }),
      h('button', { type: 'button', class: 'gv-title', 'aria-expanded': String(open), onClick: () => { open ? st.open.delete(g.id) : st.open.add(g.id); render(); } },
        h('i', { class: 'gv-chev', 'aria-hidden': 'true' }), h('b', {}, g.title), g.block ? null : h('span', { class: 'gv-count' }, String(its.length)), g.hidden ? h('span', { class: 'gv-off' }, 'مخفي') : null),
      h('div', { class: 'row-btns' },
        h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': 'تحريك القسم لأعلى', disabled: n === 0, onClick: () => move(g.id, -1) }, 'أعلى'),
        h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': 'تحريك القسم لأسفل', disabled: n === groups.length - 1, onClick: () => move(g.id, 1) }, 'أسفل')));
    const body = open ? h('div', { class: 'gv-body' },
      settings(g),
      g.block ? blockBody(g) : [
        h('div', { class: 'gv-add' }, h('button', { type: 'button', class: 'btn sm primary', onClick: () => { st.open.add(g.id); openEditor(-1, { ...sec.blank(), [key]: g.id }); } }, 'إضافة عنصر إلى هذا القسم')),
        shown.length ? h('ul', { class: 'items gv-items' }, ...shown.map((it, idx) => itemRow(it, g.id, idx, shown.length))) : h('p', { class: 'cnt' }, its.length ? 'لا نتائج.' : 'لا عناصر بعد. أضف عنصراً أو اسحب عنصراً من قسم آخر إلى عنوان هذا القسم.'),
      ]) : null;
    return h('section', { class: 'gv-group' + (open ? ' open' : '') + (g.hidden ? ' off' : ''), 'data-id': g.id }, head, body);
  };

  const addForm = h('form', { class: 'gv-new', onSubmit: (e) => {
    e.preventDefault(); const t = e.target.elements.t.value.trim(); if (!t) return;
    const id = 's' + Date.now().toString(36);
    const arr = view(); arr.push({ id, title: t, style: cfg.styles ? e.target.elements.s?.value || '' : '' }); st.open.add(id); st.adding = false; write(arr);
    say('أُضيف القسم «' + t + '». أضف إليه عناصر أو انقل إليه عناصر موجودة.', 'ok');
  } },
    h('input', { name: 't', type: 'text', placeholder: 'اسم القسم الجديد', 'aria-label': 'اسم القسم الجديد', required: true }),
    cfg.styles ? h('select', { name: 's', 'aria-label': 'نمط العرض' }, ...STYLES.map(([v, l]) => h('option', { value: v }, l))) : null,
    h('button', { class: 'btn primary', type: 'submit' }, 'إضافة قسم'),
    h('button', { class: 'btn ghost', type: 'button', onClick: () => { st.adding = false; render(); } }, 'إلغاء'));

  return h('div', { class: 'gv' },
    h('div', { class: 'head' }, h('h1', {}, sec.label),
      h('div', { class: 'row-btns' },
        h('button', { type: 'button', class: 'btn ghost', onClick: () => { const all = groups.every((g) => st.open.has(g.id)); groups.forEach((g) => (all ? st.open.delete(g.id) : st.open.add(g.id))); render(); } }, groups.every((g) => st.open.has(g.id)) ? 'طيّ الكل' : 'فتح الكل'),
        h('button', { type: 'button', class: 'btn primary', onClick: () => { st.adding = true; render(); setTimeout(() => document.querySelector('.gv-new input')?.focus(), 0); } }, 'قسم جديد'))),
    sec.help && h('p', { class: 'hint' }, sec.help),
    st.adding ? addForm : null,
    h('input', { class: 'q', type: 'search', placeholder: 'بحث في عناصر ' + sec.label, value: st.filter, 'aria-label': 'بحث', onInput: (e) => { st.filter = e.target.value; const pos = e.target.selectionStart; render(); const n = document.querySelector('.gv .q'); n?.focus(); n?.setSelectionRange(pos, pos); } }),
    h('p', { class: 'cnt' }, `${groups.filter((g) => !g.block).length} قسماً · ${list.length} عنصراً. اضغط على عنوان القسم لفتحه، واسحب العنوان لإعادة ترتيب الأقسام في الصفحة، أو اسحب عنصراً إلى عنوان قسم آخر لنقله.`),
    ...groups.map((g, n) => groupEl(g, n)).filter(Boolean),
    orphans.length ? h('section', { class: 'gv-group open orphan' }, h('div', { class: 'gv-head' }, h('b', {}, 'عناصر بلا قسم'), h('span', { class: 'gv-count' }, String(orphans.length))),
      h('div', { class: 'gv-body' }, h('p', { class: 'cnt' }, 'هذه العناصر قسمها محذوف أو غير معروف ولا تظهر في الصفحة. انقلها إلى قسم.'), h('ul', { class: 'items gv-items' }, ...orphans.filter(match).map((it, idx) => itemRow(it, '', idx, orphans.length))))) : null);
}
