import { getKits, getPosts, getNews, href, records, courses, MEDIA_SECTION } from '../lib/site.js';
import projects from '../data/projects.json';
import media from '../data/media.json';
import pages from '../data/pages.json';

export function GET() {
  const idx = [];
  const add = (k, u, t, d = '', x = '') => idx.push({ k, u, t, d: d.length > 140 ? d.slice(0, 138) + '…' : d, x: x.slice(0, 900) });
  [['/bio', 'السيرة والإنجازات'], ['/training-programs', 'سجل الأثر'], ['/collaborate', 'الحقائب التدريبية'], ['/contact', 'تواصل'], ['/honor', 'التكريم والشهادات'],
    ['/arab-youth-pioneers', 'رواد الشباب العربي'], ['/media', 'الإعلام'], ['/feedback', 'آراء وتوصيات'], ['/recorded-courses', 'الدورات المسجلة'], ['/partnerships', 'الشراكات'],
    ['/gallery', 'المعرض'], ['/blog', 'محتوى مضيء'], ['/my-projects', 'المشاريع'], ['/news', 'الأخبار'], ['/methodology', pages.methodology.title]]
    .forEach(([u, t]) => add('page', href(u), t));
  getKits().forEach((k) => add('kit', href('/collaborate') + '#' + k.id, k.title, k.duration, [k.summary, ...k.axes].join(' ')));
  getNews().forEach((n) => add('news', href('/news/' + n.id), n.title, n.summary, n.body));
  getPosts().forEach((p) => add('post', p.body ? href('/blog/' + p.slug) : p.link || p.pdf, p.title, p.summary, p.body));
  records.forEach((r) => add('record', href('/training-programs'), r.title, [r.org, r.location, r.year].filter(Boolean).join(' · '), [r.role, r.topic].join(' ')));
  courses.forEach((c) => add('course', c.link || href('/recorded-courses'), c.title, c.platform, c.desc));
  projects.forEach((p) => add('project', href('/my-projects'), p.name, p.nameEn, p.desc));
  media.forEach((m) => add('media', m.link || href('/media'), m.title, `${m.outlet} · ${MEDIA_SECTION[m.section] || ''}`, m.note));
  return new Response(JSON.stringify(idx), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
