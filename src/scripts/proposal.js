// مولّد العرض المقترح: يبني ورقة العرض من الحقائب المختارة، ويحفظها PDF عبر نافذة الطباعة.
const data = JSON.parse(document.getElementById('prData').textContent);
const f = document.getElementById('prForm');
const sheet = document.getElementById('prSheet');
const hint = document.getElementById('prHint');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byId = Object.fromEntries(data.kits.map((k) => [k.id, k]));
const num = (n) => Number(n).toLocaleString('en-US');

// اختيار مسبق من الرابط: ?kit=ai-ecommerce,b2b
const pre = (new URLSearchParams(location.search).get('kit') || '').split(',').filter((x) => byId[x]);
f.querySelectorAll('input[name=kit]').forEach((i) => { i.checked = pre.includes(i.value); });

function state() {
  const d = new FormData(f);
  return {
    kits: d.getAll('kit').map((id) => byId[id]).filter(Boolean),
    org: (d.get('org') || '').trim(), who: (d.get('who') || '').trim(),
    aud: d.get('aud') || '', n: d.get('n') || '', fmt: d.get('fmt') || '',
    when: (d.get('when') || '').trim(), where: (d.get('where') || '').trim(), notes: (d.get('notes') || '').trim(),
  };
}
const list = (t, items) => (items.length ? `<h4>${t}</h4><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

function render() {
  const s = state();
  if (!s.kits.length) {
    sheet.innerHTML = '<p class="pr-empty">اختر حقيبة واحدة على الأقل ليظهر عرضك هنا.</p>';
    return;
  }
  const date = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const facts = [['الجمهور', s.aud], ['عدد المشاركين', s.n ? num(s.n) : ''], ['شكل التنفيذ', s.fmt], ['الإطار الزمني', s.when], ['الموقع', s.where]].filter((x) => x[1]);
  const st = data.site;
  sheet.innerHTML = `
    <header class="pr-head">
      <div><img src="${esc(data.logo)}" alt="${esc(st.name)}" width="2600" height="961"><p class="pr-role">${esc(st.role)}</p>${st.focus ? `<p class="pr-role pr-focus">${esc(st.focus)}</p>` : ''}</div>
      <div class="pr-meta"><h2>عرض مقترح</h2><p>${esc(date)}</p>${s.org ? `<p>مقدَّم إلى: <b>${esc(s.org)}</b></p>` : ''}${s.who ? `<p>بطلب من: ${esc(s.who)}</p>` : ''}</div>
    </header>
    <p class="pr-intro">يسرّني أن أقدّم ${s.org ? `لـ${esc(s.org)} ` : ''}هذا العرض المقترح للبرامج التدريبية التالية. نفّذتُ أكثر من ${num(st.programs)} برنامجاً مع أكثر من ${num(st.partners)} جهة منذ ${esc(st.since)}، وأخصّص المحتوى والأمثلة والتمارين لقطاعكم وجمهوركم قبل التنفيذ.</p>
    ${facts.length ? `<dl class="pr-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${s.kits.map((k, i) => `
      <section class="pr-kit">
        <h3><span>${i + 1}</span>${esc(k.title)}</h3>
        <p class="pr-dur">${esc(k.duration)}</p>
        <p>${esc(k.summary)}</p>
        ${k.headline ? `<p class="pr-hl">${esc(k.headline)}</p>` : ''}
        ${list('الفئة المستهدفة', k.audience)}${list('المحاور', k.axes)}${list('ما يخرج به المشاركون', k.outcomes)}
      </section>`).join('')}
    ${s.notes ? `<section class="pr-kit"><h4>ملاحظات</h4><p>${esc(s.notes)}</p></section>` : ''}
    <footer class="pr-foot">
      <div>
        <p class="pr-note">يُستكمل هذا العرض بالتكلفة والجدول التفصيلي بعد النقاش والاتفاق على النطاق.</p>
        <ul>
          <li><span>الجوال</span><b class="ltr">${esc(st.phone)}</b></li>
          <li><span>البريد</span><b class="ltr">${esc(st.email)}</b></li>
          <li><span>الموقع</span><b class="ltr">${esc(st.web)}</b></li>
        </ul>
      </div>
      <div class="pr-qr" aria-hidden="true">${data.qr}</div>
    </footer>`;
}

function message() {
  const s = state();
  const lines = ['السلام عليكم ورحمة الله،', '', 'أرغب في برنامج تدريبي، وهذه تفاصيل طلبي:', ''];
  s.kits.forEach((k) => lines.push('• ' + k.short + ' (' + k.duration + ')'));
  if (s.org) lines.push('', 'الجهة: ' + s.org);
  if (s.aud) lines.push('الجمهور: ' + s.aud);
  if (s.n) lines.push('عدد المشاركين: ' + s.n);
  if (s.fmt) lines.push('شكل التنفيذ: ' + s.fmt);
  if (s.when) lines.push('الإطار الزمني: ' + s.when);
  if (s.where) lines.push('الموقع: ' + s.where);
  if (s.notes) lines.push('', s.notes);
  lines.push('', s.who);
  return { subject: 'طلب عرض: ' + (s.kits.length === 1 ? s.kits[0].short : s.kits.length + ' حقائب'), text: lines.join('\n') };
}
const need = () => {
  if (state().kits.length) { hint.classList.remove('warn'); return true; }
  hint.classList.add('warn'); hint.textContent = 'اختر حقيبة واحدة على الأقل أولاً.';
  f.querySelector('.pr-kits').scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
};
document.getElementById('prPdf').addEventListener('click', () => { if (need()) { render(); print(); } });
document.getElementById('prWa').addEventListener('click', () => { if (!need()) return; const m = message(); open('https://wa.me/' + data.site.wa + '?text=' + encodeURIComponent(m.subject + '\n\n' + m.text), '_blank', 'noopener'); });
document.getElementById('prMail').addEventListener('click', () => { if (!need()) return; const m = message(); location.href = 'mailto:' + data.site.email + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.text); });
f.addEventListener('input', render);
f.addEventListener('change', render);
f.addEventListener('submit', (e) => e.preventDefault());
render();
