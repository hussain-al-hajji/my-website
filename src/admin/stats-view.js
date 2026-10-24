// شاشة «مؤشرات الموقع» في لوحة التحكم: زيارات (عدّاد خاص وGA4)، بحث (Search Console وBing)، روابط خلفية (Bing)، وفحص سيو للصفحات.
const n0 = (v) => Number(v || 0).toLocaleString('en-US');
const pct = (v) => (Number(v || 0) * 100).toFixed(1) + '%';
const dec1 = (v) => Number(v || 0).toFixed(1);
const KIND = { direct: 'مباشر', search: 'محركات البحث', social: 'تواصل اجتماعي', referral: 'مواقع محيلة', campaign: 'حملات' };
const DEV = { mobile: 'جوال', tablet: 'لوحي', desktop: 'حاسوب', MOBILE: 'جوال', TABLET: 'لوحي', DESKTOP: 'حاسوب' };
let regionNames = null;
const country = (c) => {
  if (!c || c === 'XX') return 'غير معروف';
  try { regionNames ||= new Intl.DisplayNames(['ar'], { type: 'region' }); return regionNames.of(String(c).slice(0, 2).toUpperCase()) || c; } catch { return c; }
};
const countryAny = (c) => (/^[A-Za-z]{2}$/.test(c) ? country(c) : /^[A-Za-z]{3}$/.test(c) ? c.toUpperCase() : c);
const shortUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?hussain-al-hajji\.com/, '') || '/';

const HINTS = {
  gsc: 'غير متصل. اربط Search Console: أنشئ حساب خدمة، وأضف بريده مستخدماً بصلاحية «عرض» في الخاصية، ثم ضع مفتاحه سراً GOOGLE_SA_JSON وقيمة GSC_SITE في الـ Worker.',
  ga4: 'غير متصل. فعّل واجهة Analytics Data، وأضف بريد حساب الخدمة مشاهداً في خاصية GA4، وضع GA4_PROPERTY_ID في الـ Worker، ومعرّف القياس (G-…) في «الصفحة الرئيسية» بالوحة.',
  bing: 'غير متصل. وثّق الموقع في Bing Webmaster Tools، وأنشئ مفتاح API، وضعه سراً BING_API_KEY مع BING_SITE في الـ Worker.',
};

export function statsPanel({ h, S, reload }) {
  const st = S.stats || (S.stats = { status: 'idle', tab: 'overview' });
  const card = (title, ...kids) => h('section', { class: 'st-card' }, title && h('h3', {}, title), ...kids);
  const notice = (src, r) => h('p', { class: 'st-note' }, r?.reason === 'error' ? `تعذّر الجلب من ${src === 'gsc' ? 'Search Console' : src === 'ga4' ? 'GA4' : 'Bing'} (${r.detail || 'خطأ'}). تحقق من الصلاحيات والإعدادات.` : HINTS[src]);
  const kpi = (label, value, sub, good) => h('div', { class: 'st-kpi' }, h('span', {}, label), h('b', {}, value), sub != null && h('small', { class: good === true ? 'up' : good === false ? 'down' : '' }, sub));
  const delta = (cur, prev, invert) => {
    if (prev == null || (!prev && !cur)) return [null, null];
    const d = invert ? prev - cur : cur - prev, rel = prev ? (cur - prev) / prev : 0;
    const txt = invert ? (d === 0 ? 'دون تغيّر' : (d > 0 ? '▲ ' : '▼ ') + dec1(Math.abs(d))) : (d === 0 ? 'دون تغيّر' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(rel * 100)) + '%');
    return [txt + ' عن الفترة السابقة', d === 0 ? null : d > 0];
  };
  const table = (cols, rows, empty = 'لا بيانات بعد.') => rows?.length
    ? h('div', { class: 'st-tbl' }, h('table', {}, h('thead', {}, h('tr', {}, ...cols.map((c) => h('th', { class: c.num ? 'num' : '' }, c.t)))),
      h('tbody', {}, ...rows.map((r) => h('tr', {}, ...cols.map((c) => h('td', { class: c.num ? 'num' : '', dir: c.ltr ? 'ltr' : null }, c.f(r))))))))
    : h('p', { class: 'st-note' }, empty);
  const bars = (series, key, label) => {
    const max = Math.max(1, ...series.map((x) => x[key])), W = 600, H = 120, bw = W / series.length;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H + 18}`); svg.setAttribute('class', 'st-chart'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
    series.forEach((x, i) => {
      const r = document.createElementNS(NS, 'rect'), hh = Math.max(x[key] ? 2 : 0, (x[key] / max) * H);
      r.setAttribute('x', W - (i + 1) * bw + 1.5); r.setAttribute('y', H - hh); r.setAttribute('width', bw - 3); r.setAttribute('height', hh); r.setAttribute('rx', 2);
      const t = document.createElementNS(NS, 'title'); t.textContent = `${x.d}: ${n0(x[key])}`; r.append(t); svg.append(r);
    });
    [0, series.length - 1].forEach((i) => { const t = document.createElementNS(NS, 'text'); t.setAttribute('x', i === 0 ? W - 2 : 2); t.setAttribute('y', H + 14); t.setAttribute('text-anchor', i === 0 ? 'start' : 'end'); t.textContent = series[i].d.slice(5); svg.append(t); });
    return svg;
  };
  const list = (rows, f) => table([{ t: 'المصدر', f: (r) => f(r.k) }, { t: 'العدد', num: true, f: (r) => n0(r.n) }], rows);

  const head = h('div', { class: 'head' }, h('h1', {}, 'مؤشرات الموقع'),
    h('button', { class: 'btn ghost', disabled: st.status === 'loading', onClick: reload }, st.status === 'loading' ? 'جارٍ التحديث…' : 'تحديث'));
  if (st.status === 'demo') return h('div', {}, head, h('p', { class: 'hint' }, 'المؤشرات تحتاج الدخول بحساب مسموح (وضع المعاينة لا يتصل بالخدمة).'));
  if (st.status === 'idle' || st.status === 'loading') return h('div', {}, head, h('p', { class: 'boot' }, 'جارٍ جلب المؤشرات…'));
  if (st.status === 'err') return h('div', {}, head, h('p', { class: 'hint' }, `تعذّر جلب المؤشرات (${st.err}). تأكد من نشر آخر نسخة من الـ Worker وربط العدّاد.`));

  const { own, gsc, ga4, bing, at } = st.data, audit = st.audit;
  const tabs = [['overview', 'نظرة عامة'], ['visits', 'الزيارات'], ['search', 'البحث'], ['links', 'الروابط الخلفية'], ['seo', 'فحص السيو']];
  const nav = h('div', { class: 'st-tabs', role: 'tablist' }, ...tabs.map(([k, t]) => h('button', { class: 'st-tab' + (st.tab === k ? ' on' : ''), role: 'tab', 'aria-selected': String(st.tab === k), onClick: () => { st.tab = k; reload(true); } }, t)));
  const stamp = h('p', { class: 'cnt' }, 'آخر تحديث: ' + new Date(at).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) + ' · بيانات Search Console تتأخر يومين تقريباً');
  let body;

  if (st.tab === 'overview') {
    const g = gsc.ok ? gsc : null;
    const [dc, gc] = g ? delta(g.totals.clicks, g.prev.clicks) : [];
    const [di, gi] = g ? delta(g.totals.impressions, g.prev.impressions) : [];
    const [dp, gp] = g ? delta(g.totals.position, g.prev.position, true) : [];
    body = h('div', {},
      card('الزيارات (عدّاد الموقع)', h('div', { class: 'st-kpis' },
        kpi('إجمالي الزيارات', n0(own.total)), kpi('اليوم', n0(own.today?.v)), kpi('آخر 7 أيام', n0(own.week.v)), kpi('آخر 30 يوماً', n0(own.month.v)), kpi('مشاهدات الصفحات (30 يوماً)', n0(own.month.pv))),
        bars(own.series, 'v', 'الزيارات اليومية لآخر 30 يوماً'), h('p', { class: 'st-note' }, 'عدّاد خاص بلا بيانات شخصية؛ تُحتسب الزيارة بالجلسة، ولا تُحتسب زياراتك أنت بعد دخولك للوحة ولا الروبوتات.')),
      card('الظهور في البحث (Google، آخر 28 يوماً)', g ? [h('div', { class: 'st-kpis' },
        kpi('مرات الظهور', n0(g.totals.impressions), di, gi), kpi('النقرات', n0(g.totals.clicks), dc, gc), kpi('نسبة النقر', pct(g.totals.ctr)), kpi('متوسط الترتيب', dec1(g.totals.position), dp, gp)),
        bars(g.series.map((x) => ({ d: x.d, v: x.impressions })), 'v', 'الظهور اليومي في البحث')] : notice('gsc', gsc)),
      card('الروابط الخلفية والسيو', h('div', { class: 'st-kpis' },
        kpi('روابط واردة (Bing)', bing.ok ? n0(bing.links.total) : '—'), kpi('صفحات بها ملاحظات سيو', audit ? n0(audit.summary.withIssues) + ' من ' + n0(audit.summary.indexable) : '—'), kpi('زيارات GA4 (28 يوماً)', ga4.ok ? n0(ga4.totals.sessions) : '—')),
        !bing.ok && notice('bing', bing)));
  } else if (st.tab === 'visits') {
    body = h('div', {},
      card('مصادر الزيارات (عدّاد الموقع)', h('div', { class: 'st-grid' },
        list(own.sources, (k) => KIND[k] || k), list(own.referrers, (k) => (k.startsWith('utm:') ? 'حملة: ' + k.slice(4) : k)))),
      card('أكثر الصفحات مشاهدة', table([{ t: 'الصفحة', ltr: true, f: (r) => r.k }, { t: 'المشاهدات', num: true, f: (r) => n0(r.n) }], own.pages)),
      card('الدول والأجهزة', h('div', { class: 'st-grid' }, list(own.countries, country), list(own.devices, (k) => DEV[k] || k))),
      card('Google Analytics 4 (آخر 28 يوماً)', ga4.ok ? [h('div', { class: 'st-kpis' },
        kpi('الجلسات', n0(ga4.totals.sessions)), kpi('المستخدمون', n0(ga4.totals.users)), kpi('مستخدمون جدد', n0(ga4.totals.newUsers)), kpi('المشاهدات', n0(ga4.totals.views)),
        kpi('متوسط مدة الجلسة', Math.round(ga4.totals.avgDuration) + ' ث'), kpi('معدل التفاعل', pct(ga4.totals.engagement))),
      h('div', { class: 'st-grid' }, card('قنوات الاكتساب', list(ga4.channels, (k) => k)), card('أكثر المصادر', list(ga4.sources, (k) => k))),
      h('div', { class: 'st-grid' }, card('أكثر الصفحات', list(ga4.pages, (k) => h('span', { dir: 'ltr' }, k))), card('الدول', list(ga4.countries, (k) => k)))] : notice('ga4', ga4)));
  } else if (st.tab === 'search') {
    const q = (rows) => table([{ t: 'الكلمة', f: (r) => r.k }, { t: 'نقرات', num: true, f: (r) => n0(r.clicks) }, { t: 'ظهور', num: true, f: (r) => n0(r.impressions) }, { t: 'نسبة النقر', num: true, f: (r) => pct(r.ctr ?? (r.impressions ? r.clicks / r.impressions : 0)) }, { t: 'الترتيب', num: true, f: (r) => dec1(r.position) }], rows);
    body = h('div', {},
      gsc.ok ? [
        card('الكلمات التي قادت الزوار إلى الموقع', q(gsc.queriesByClicks)),
        card('الكلمات التي ظهر فيها الموقع (الأكثر ظهوراً)', q(gsc.queriesByImpressions)),
        card('أفضل الصفحات في نتائج البحث', table([{ t: 'الصفحة', ltr: true, f: (r) => shortUrl(r.k) }, { t: 'نقرات', num: true, f: (r) => n0(r.clicks) }, { t: 'ظهور', num: true, f: (r) => n0(r.impressions) }, { t: 'الترتيب', num: true, f: (r) => dec1(r.position) }], gsc.pages)),
        card('الدول والأجهزة', h('div', { class: 'st-grid' },
          table([{ t: 'الدولة', f: (r) => countryAny(r.k) }, { t: 'نقرات', num: true, f: (r) => n0(r.clicks) }, { t: 'ظهور', num: true, f: (r) => n0(r.impressions) }], gsc.countries),
          table([{ t: 'الجهاز', f: (r) => DEV[r.k] || r.k }, { t: 'نقرات', num: true, f: (r) => n0(r.clicks) }, { t: 'ظهور', num: true, f: (r) => n0(r.impressions) }], gsc.devices))),
      ] : card('Google Search Console', notice('gsc', gsc)),
      card('Bing: الكلمات والظهور', bing.ok ? [h('div', { class: 'st-kpis' }, kpi('ظهور (28 يوماً)', n0(bing.totals.impressions)), kpi('نقرات', n0(bing.totals.clicks))), q(bing.queries)] : notice('bing', bing)));
  } else if (st.tab === 'links') {
    body = bing.ok ? h('div', {},
      card('الروابط الواردة (Bing Webmaster)', h('div', { class: 'st-kpis' }, kpi('إجمالي الروابط الواردة', n0(bing.links.total)), kpi('صفحات مرتبط بها', n0(bing.links.pages.length))),
        h('p', { class: 'st-note' }, 'يغطي Bing جزءاً من الروابط الخلفية الكلية؛ يصلح مؤشراً على الاتجاه لا حصراً كاملاً.')),
      card('أكثر صفحاتك ارتباطاً من مواقع أخرى', table([{ t: 'الصفحة', ltr: true, f: (r) => shortUrl(r.k) }, { t: 'روابط واردة', num: true, f: (r) => n0(r.n) }], bing.links.pages)),
      card('مواقع تُحيل إلى أكثر صفحاتك ارتباطاً', table([{ t: 'الموقع', ltr: true, f: (r) => r.k }, { t: 'روابط', num: true, f: (r) => n0(r.n) }], bing.links.domains, 'لم تُرجِع Bing تفاصيل المواقع المُحيلة بعد.')))
      : card('الروابط الواردة', notice('bing', bing));
  } else {
    const a = audit;
    body = !a ? card('فحص السيو', h('p', { class: 'st-note' }, 'ملف الفحص غير متوفر (يُولَّد مع كل بناء للموقع).')) : h('div', {},
      card('ملخص الفحص', h('div', { class: 'st-kpis' },
        kpi('صفحات قابلة للأرشفة', n0(a.summary.indexable)), kpi('صفحات بها ملاحظات', n0(a.summary.withIssues), a.summary.withIssues ? 'تحتاج مراجعة' : 'سليمة', !a.summary.withIssues),
        kpi('إجمالي الملاحظات', n0(a.summary.issueCount)), kpi('صور بلا نص بديل', n0(a.summary.noAlt)), kpi('بيانات منظمة (Schema)', `${n0(a.summary.schema)} صفحة`), kpi('روابط خريطة الموقع', n0(a.summary.sitemapUrls)), kpi('متوسط طول العنوان', Math.round(a.summary.avgTitle) + ' حرفاً'), kpi('متوسط طول الوصف', Math.round(a.summary.avgDesc) + ' حرفاً')),
        h('p', { class: 'st-note' }, 'ملفات الموقع: ' + Object.entries(a.files).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · ') + (a.summary.dupTitles ? ` · عناوين مكررة: ${a.summary.dupTitles}` : ' · لا عناوين مكررة'))),
      card('صفحات تحتاج مراجعة', table([{ t: 'الصفحة', ltr: true, f: (r) => r.p }, { t: 'الملاحظات', f: (r) => r.issues.join('، ') }], a.pages.filter((x) => x.issues.length).slice(0, 40), 'كل الصفحات سليمة.')),
      h('p', { class: 'st-note' }, `آخر فحص: ${new Date(a.at).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}. معايير الفحص: العنوان 15–70 حرفاً، الوصف 70–170، عنوان رئيسي واحد، نص بديل للصور، رابط قانوني، صورة مشاركة.`));
  }
  return h('div', { class: 'stats' }, head, nav, stamp, body);
}
