import { marked } from 'marked';
import site from '../data/site.json';
import news from '../data/news.json';
import posts from '../data/posts.json';
import kits from '../data/kits.json';
import rawRecords from '../data/records.json';
import { archivedRecords } from './calendar.js';
import media from '../data/media.json';
import courses from '../data/courses.json';

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
export const SITE_URL = (import.meta.env.SITE || 'https://hussain-al-hajji.com').replace(/\/$/, '');

/** رابط داخلي أو أصل ثابت، مع احترام المسار الأساسي للنشر. */
export function href(p = '/') {
  if (!p) return '';
  if (/^(https?:|mailto:|tel:|#|\/\/)/.test(p)) return p;
  if (p === '/') return BASE + '/';
  return BASE + (p.startsWith('/') ? p : '/' + p);
}
export const asset = href;
export const abs = (p) => (/^https?:/.test(p) ? p : SITE_URL + href(p));

/** يحوّل ماركداون إلى HTML ويصلح الروابط الداخلية. */
export function md(src = '') {
  const html = marked.parse(String(src), { gfm: true, breaks: false });
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`);
}
export const mdInline = (src = '') => marked.parseInline(String(src));

const fmtMonth = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long' });
const fmtDay = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
export function dateAr(s, full = true) {
  if (!s) return '';
  const d = new Date(s.length === 7 ? s + '-01' : s);
  if (isNaN(d)) return s;
  return (full && s.length > 7 ? fmtDay : fmtMonth).format(d);
}

/** تطبيع عربي للبحث: يوحّد الألف والياء والتاء المربوطة ويحذف التشكيل. */
export function norm(s = '') {
  return String(s)
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[“”«»"'،؛:.\-–—()]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const today = () => new Date().toISOString().slice(0, 10);
const live = (x) => x.published !== false && (!x.expires || x.expires >= today());

export const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));

export function getNews() {
  return news.filter(live).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || byDateDesc(a, b));
}
export function getAnnouncement() {
  const a = site.announcement;
  if (!a || !a.enabled || !a.text) return null;
  if (a.expires && a.expires < today()) return null;
  return a;
}
export const getPosts = () => [...posts].sort(byDateDesc);
export const getKits = () => [...kits].sort((a, b) => (a.priority || 99) - (b.priority || 99));

export const AUDIENCES = {
  students: 'طلاب وحديثو تخرج',
  employees: 'موظفون',
  owners: 'أصحاب منشآت ورواد أعمال',
  leaders: 'قادة شباب',
  trainers: 'مدربون',
};
export const GOALS = {
  ai: 'توظيف الذكاء الاصطناعي في عملي',
  ecom: 'إطلاق مشروعي أو متجري الإلكتروني',
  sales: 'تنمية المبيعات والتسويق والعملاء',
  leadership: 'القيادة وإدارة الفرق والمشاريع',
  career: 'التميّز المهني والعمل الحر',
  training: 'تصميم البرامج التدريبية وتقديمها',
};
export const TIMES = { short: 'ساعتان إلى خمس', day: 'يوم كامل', long: 'عدة أيام' };

export const POST_KIND = { long: 'مقال', short: 'مقالة قصيرة', external: 'منشور خارجي', guide: 'دليل' };
export const MEDIA_SECTION = {
  tv: 'تلفزيون',
  radio: 'إذاعة',
  press: 'صحافة ومقالات',
  event: 'فعاليات',
  'award-press': 'الصحافة عن التكريم',
  'award-tv': 'التلفزيون عن التكريم',
};
export const PARTNER_GROUP = {
  gov: 'جهات حكومية',
  nonprofit: 'جهات غير ربحية',
  private: 'القطاع الخاص',
  edu: 'جهات تعليمية',
  gulf: 'خليجية',
  intl: 'دولية',
  chambers: 'غرف تجارية',
};
export const BIO_SECTION = {
  career: 'المسيرة المهنية',
  achievements: 'الإنجازات',
  credentials: 'الاعتمادات',
  committees: 'اللجان والعضويات',
  leadership: 'برامج القيادة',
  mentoring: 'الإرشاد والمسرّعات',
  bootcamps: 'المعسكرات',
  learning: 'التعلّم والتطوير',
  writing: 'الكتابة',
  volunteer: 'العمل التطوعي',
  skills: 'المهارات',
  expertise: 'مجالات الخبرة',
  values: 'القيم',
};

/** سجل مبسّط للجدار والخريطة، يُدمج في الصفحة كـ JSON. */
export function logForClient() {
  return records.map((r) => ({
    y: r.year, n: r.title, r: r.role, d: r.duration, l: r.location, o: r.org, t: r.topic, k: r.kind, id: r.id,
  }));
}

export function stats() {
  const years = [...new Set(records.map((r) => r.year))].sort();
  const last = years[years.length - 1];
  return {
    entries: records.length,
    years,
    lastYear: last,
    inLastYear: records.filter((r) => r.year === last).length,
  };
}

// برامج الروزنامة المنتهية تنضم تلقائياً إلى سجل الأثر (الأحدث سنةً أولاً)
const records = [...archivedRecords(), ...rawRecords].sort((a, b) => b.year - a.year);

export { site, records, media, courses };
export const contactLinks = () => {
  const c = site.contact;
  return {
    mail: 'mailto:' + c.email,
    wa: 'https://wa.me/' + c.whatsapp,
    tel: 'tel:' + c.phone.replace(/\s/g, ''),
  };
};

export const GNAV = [
  { label: 'عنّي', href: '/bio', key: 'bio' },
  { label: 'سجل الأثر', href: '/training-programs', key: 'training-programs' },
  { label: 'الحقائب التدريبية', href: '/collaborate', key: 'collaborate' },
  { label: 'الأكاديمية', href: 'https://academy.hussain-al-hajji.com/', key: 'academy' },
  { label: 'الإعلام', href: '/media', key: 'media' },
  { label: 'آراء المتدربين', href: '/feedback', key: 'feedback' },
  { label: 'محتوى مضيء', href: '/blog', key: 'blog' },
  { label: 'الأخبار', href: '/news', key: 'news' },
  { label: 'تواصل', href: '/contact', key: 'contact' },
];
export const FOOT_DIR = [
  { h: 'استكشف', l: [['السيرة', '/bio'], ['سجل الأثر', '/training-programs'], ['الجوائز والتكريم', '/honor'], ['رواد الشباب العربي', '/arab-youth-pioneers'], ['مشاريع ومشاركات مميزة', '/featured'], ['المعرض', '/gallery'], ['بطاقتي الرقمية', '/card']] },
  { h: 'للجهات', l: [['الحقائب التدريبية', '/collaborate'], ['اطلب برنامجاً', '/contact'], ['ابنِ عرضك', '/proposal'], ['أسئلة شائعة', '/faq'], ['الشركاء', '/partnerships'], ['منهجي في التدريب', '/methodology'], ['مبادرات مبتكرة', '/my-projects']] },
  { h: 'المحتوى', l: [['محتوى مضيء', '/blog'], ['محتوى مرئي', '/recorded-courses'], ['اسأل حسين', '/faq#ask'], ['الإعلام', '/media'], ['آراء المتدربين', '/feedback'], ['الأخبار', '/news']] },
];
