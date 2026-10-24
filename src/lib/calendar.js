// روزنامة المدرب: برامج وفعاليات بتاريخ من/إلى. ما انقضى وقته ينتقل تلقائياً إلى سجل الأثر وقت البناء.
import calendar from '../data/calendar.json';

/** تاريخ اليوم في الرياض بصيغة YYYY-MM-DD. */
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

const norm = (x) => ({ ...x, to: x.to || x.from });
const valid = (x) => x.title && /^\d{4}-\d{2}-\d{2}$/.test(x.from || '');

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

/** عناصر البكرة: آخر ستة منجزة وكل القادم. */
export function wheelItems(pastKeep = 6) {
  const today = todayISO();
  const all = calendarItems();
  const past = all.filter((x) => isEnded(x, today)).slice(-pastKeep);
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

export const stateOf = (x, today = todayISO()) => (x.to < today ? 'past' : x.from <= today ? 'now' : 'next');

/** بيانات منظمة Event للبرامج القادمة والجارية. */
export function eventSchemas(site, abs) {
  const today = todayISO();
  return calendarItems().filter((x) => !isEnded(x, today)).map((x) => {
    const loc = x.location || '';
    const online = /عن بُعد|عن بعد|افتراض|إلكتروني|اونلاين|أونلاين/.test(loc + ' ' + (x.kind || ''));
    const onsite = /حضوري/.test(loc + ' ' + (x.kind || ''));
    const city = (loc.split(/\s*[-–]\s*/)[1] || '').trim();
    const place = { '@type': 'Place', name: city || loc.replace(/^حضوري\s*[-–]?\s*/, '') || 'المملكة العربية السعودية', address: { '@type': 'PostalAddress', ...(city ? { addressLocality: city } : {}), addressCountry: 'SA' } };
    const virtual = { '@type': 'VirtualLocation', url: abs('/') };
    return {
      '@context': 'https://schema.org', '@type': 'Event',
      name: x.title, startDate: x.from, endDate: x.to, inLanguage: 'ar',
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
