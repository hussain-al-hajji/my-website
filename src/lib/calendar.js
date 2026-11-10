// روزنامة المدرب: برامج وفعاليات بتاريخ من/إلى. ما انقضى وقته ينتقل تلقائياً إلى سجل الأثر وقت البناء.
import calendar from '../data/calendar.json';

/** تاريخ اليوم في الرياض بصيغة YYYY-MM-DD. */
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d) => d.toISOString().slice(0, 10);
const days = (x) => (Array.isArray(x) ? x : String(x || '').split(/[\n,]/)).map((t) => String(t).trim()).filter((t) => ISO.test(t));

/** هل البرنامج متكرر أو متفرق الأيام؟ (أيام أسبوع مختارة و/أو أيام يدوية) */
export const weekdaysOf = (x) => [...new Set((x.weekdays || []).map(Number).filter((n) => n >= 0 && n <= 6))].sort();
export const isRecurring = (x) => weekdaysOf(x).length > 0 || days(x.dates).length > 0;

/**
 * الأيام التي يُنفَّذ فيها البرنامج: بلا تكرار هي كل أيام النطاق من/إلى؛ ومع التكرار هي أيام الأسبوع المختارة داخل النطاق
 * مطروحاً منها الأيام المستثناة، مضافاً إليها الأيام اليدوية. والبرنامج كله يُحتسب مشاركة واحدة في سجل الأثر.
 */
export function occurrences(x) {
  if (!ISO.test(x.from || '')) return [];
  const to = ISO.test(x.to || '') ? x.to : x.from;
  const wd = weekdaysOf(x), extra = days(x.dates), skip = new Set(days(x.except));
  const out = new Set();
  if (!isRecurring(x) || wd.length) {
    for (let d = new Date(x.from + 'T12:00:00Z'), n = 0; iso(d) <= to && n < 800; d.setUTCDate(d.getUTCDate() + 1), n++) {
      if ((!wd.length || wd.includes(d.getUTCDay())) && !skip.has(iso(d))) out.add(iso(d));
    }
  }
  extra.forEach((d) => out.add(d));
  return [...out].sort();
}

// عند التكرار يُشتقّ نطاق البرنامج الفعلي (أول يوم وآخر يوم) من أيامه، فتُحسب حالته (قادم/جارٍ/منجز) ونقله إلى السجل منها
const norm = (x) => {
  const base = { ...x, to: x.to || x.from };
  if (!isRecurring(x)) return base;
  const occ = occurrences(x);
  return occ.length ? { ...base, from: occ[0], to: occ[occ.length - 1], occ } : base;
};
const valid = (x) => x.title && ISO.test(x.from || '');

/** كل المدخلات صالحة الشكل، مرتبة زمنياً (الأقدم أولاً). */
export function calendarItems() {
  return calendar.filter(valid).map(norm).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

export const isEnded = (x, today = todayISO()) => x.to < today;

/** برامج الروزنامة المنتهية بصيغة قيد في سجل الأثر. */
export function archivedRecords() {
  const today = todayISO();
  return calendarItems()
    .filter((x) => isEnded(x, today))
    .reverse()
    .map((x) => ({
      id: 'cal-' + x.id,
      year: Number(x.to.slice(0, 4)),
      title: x.title,
      role: x.role || 'مدرب',
      duration: x.duration || '',
      location: x.location || '',
      org: x.org || '',
      topic: x.topic || 'أخرى',
      kind: x.kind || 'حضوري',
      note: x.details || '',
      images: [],
      video: '',
    }));
}

/** عناصر البكرة: كل البرامج (المنجزة والقادمة) بترتيبها الزمني؛ pastKeep لتحديد عدد المنجزة إن لزم. */
export function wheelItems(pastKeep = Infinity) {
  const today = todayISO();
  const all = calendarItems();
  const past = all.filter((x) => isEnded(x, today)).slice(Number.isFinite(pastKeep) ? -pastKeep : 0);
  return [...past, ...all.filter((x) => !isEnded(x, today))];
}

const mon = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { month: 'long' });
const dayNum = (s) => Number(s.slice(8, 10));
const monName = (s) => mon.format(new Date(s + 'T12:00:00Z'));
/** نطاق التاريخ للعرض: سطر رئيسي وسنة. */
export function rangeAr(from, to = from) {
  const y = from.slice(0, 4), y2 = to.slice(0, 4);
  if (from === to) return { line: `${dayNum(from)} ${monName(from)}`, year: y };
  if (from.slice(0, 7) === to.slice(0, 7)) return { line: `${dayNum(from)} – ${dayNum(to)} ${monName(to)}`, year: y };
  return { line: `${dayNum(from)} ${monName(from)} – ${dayNum(to)} ${monName(to)}`, year: y === y2 ? y : `${y} – ${y2}` };
}

/** عنوان تاريخ البرنامج المتكرر: «كل أحد» وتحته النطاق؛ أو عدد الأيام إن كانت متفرقة. */
export function recurAr(x) {
  const wd = weekdaysOf(x), r = rangeAr(x.from, x.to);
  const line = wd.length ? 'كل ' + wd.map((n) => WEEKDAYS[n]).join('، ') : `${(x.occ || []).length} أيام`;
  return { line, year: `${r.line} ${r.year}` };
}

export const stateOf = (x, today = todayISO()) => (x.to < today ? 'past' : x.from <= today ? 'now' : 'next');

/** بيانات منظمة Event للبرامج القادمة والجارية. */
export function eventSchemas(site, abs) {
  const today = todayISO();
  const next = (x) => (x.occ ? x.occ.find((d) => d >= today) || x.to : x.from);
  return calendarItems().filter((x) => !isEnded(x, today)).map((x) => {
    const loc = x.location || '';
    const online = /عن بُعد|عن بعد|افتراض|إلكتروني|اونلاين|أونلاين/.test(loc + ' ' + (x.kind || ''));
    const onsite = /حضوري/.test(loc + ' ' + (x.kind || ''));
    const city = (loc.split(/\s*[-–]\s*/)[1] || '').trim();
    const place = { '@type': 'Place', name: city || loc.replace(/^حضوري\s*[-–]?\s*/, '') || 'المملكة العربية السعودية', address: { '@type': 'PostalAddress', ...(city ? { addressLocality: city } : {}), addressCountry: 'SA' } };
    const virtual = { '@type': 'VirtualLocation', url: abs('/') };
    return {
      '@context': 'https://schema.org', '@type': 'Event',
      name: x.title, startDate: next(x), endDate: x.occ ? next(x) : x.to, inLanguage: 'ar',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: online && onsite ? 'https://schema.org/MixedEventAttendanceMode' : online ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
      location: online && onsite ? [place, virtual] : online ? virtual : place,
      description: x.details || x.title,
      ...(x.org ? { organizer: { '@type': 'Organization', name: x.org } } : {}),
      performer: { '@type': 'Person', name: site.name, url: abs('/') },
      url: abs('/') + '#calendar',
    };
  });
}
