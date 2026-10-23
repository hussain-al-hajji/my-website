// سجل الصفحات: يغذّي صور المشاركة وملف llms.txt.
import { site, getPosts, getNews, getKits } from './site.js';

export const STATIC_PAGES = [
  { path: '/', title: site.name, kicker: site.tagline },
  { path: '/bio', title: 'السيرة والإنجازات' },
  { path: '/training-programs', title: 'سجل الأثر' },
  { path: '/collaborate', title: 'الحقائب التدريبية' },
  { path: '/contact', title: 'تواصل' },
  { path: '/honor', title: 'التكريم والشهادات' },
  { path: '/arab-youth-pioneers', title: 'رواد الشباب العربي' },
  { path: '/media', title: 'الإعلام' },
  { path: '/feedback', title: 'آراء وتوصيات' },
  { path: '/recorded-courses', title: 'محتوى مرئي' },
  { path: '/partnerships', title: 'الشراكات' },
  { path: '/gallery', title: 'المعرض' },
  { path: '/blog', title: 'محتوى مضيء' },
  { path: '/my-projects', title: 'مبادرات مبتكرة' },
  { path: '/featured', title: 'مشاريع ومشاركات مميزة' },
  { path: '/news', title: 'الأخبار' },
  { path: '/methodology', title: 'منهجي في التدريب' },
  { path: '/faq', title: 'أسئلة شائعة' },
  { path: '/card', title: 'بطاقتي الرقمية' },
  { path: '/proposal', title: 'ابنِ عرضك' },
];

export const slugOf = (p) => (p === '/' ? 'index' : p.replace(/^\//, ''));

export function allOgPages() {
  return [
    ...STATIC_PAGES.map((p) => ({ slug: slugOf(p.path), title: p.title, kicker: p.kicker || '' })),
    ...getPosts().filter((p) => p.body).map((p) => ({ slug: 'blog/' + p.slug, title: p.title, kicker: 'محتوى مضيء' })),
    ...getNews().map((n) => ({ slug: 'news/' + n.id, title: n.title, kicker: n.type || 'الأخبار' })),
  ];
}
export const ogSlugSet = () => new Set(allOgPages().map((p) => p.slug));
