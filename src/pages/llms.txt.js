import { site, abs, getKits, getPosts, getNews, records, MEDIA_SECTION, contactLinks } from '../lib/site.js';
import { STATIC_PAGES } from '../lib/pages.js';
import { faqItems } from '../lib/faq.js';
import partners from '../data/partners.json';

// ملخص مقروء للآلة عن الموقع، على صيغة llms.txt
export function GET() {
  const kits = getKits();
  const links = contactLinks();
  const faq = faqItems().slice(0, 6);
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `${site.name} مدرب ومرشد مهني معتمد (CCSP) في المملكة العربية السعودية. يقدّم حقائب تدريبية واستشارات وإرشاداً مهنياً وتحكيماً لتمكين الشباب في التجارة الإلكترونية والعمل الحر والمسار المهني والذكاء الاصطناعي في الأعمال.`,
    '',
    '## معلومات أساسية',
    `- منذ ${site.stats.since}: أكثر من ${site.stats.programs} برنامجاً وفعالية ومبادرة مع أكثر من ${site.stats.partners} جهة، واستفاد أكثر من ${site.stats.beneficiaries.toLocaleString('en-US')} شاب وشابة.`,
    `- سجل منشور بـ${records.length} مشاركة موثّقة: ${abs('/training-programs')}`,
    `- جهات عمل معها: ${partners.slice(0, 12).map((p) => p.name).join('، ')}.`,
    '- تكريم: درع «رواد الشباب العربي» (النسخة الرابعة، 2025) في مسار ريادة الأعمال.',
    `- التواصل: ${site.contact.email} | واتساب ${links.wa} | لينكدإن ${site.contact.linkedin}`,
    '',
    '## الصفحات الرئيسية',
    ...STATIC_PAGES.filter((p) => p.path !== '/').map((p) => `- [${p.title}](${abs(p.path)})`),
    '',
    '## الحقائب التدريبية',
    ...kits.map((k) => `- [${k.title}](${abs('/collaborate')}#${k.id}): ${k.duration}. ${k.summary.slice(0, 160).trim()}…`),
    '',
    '## أسئلة شائعة',
    ...faq.map((q) => `- ${q.q} ${q.a}`),
    '',
    '## محتوى حديث',
    ...getNews().slice(0, 5).map((n) => `- [${n.title}](${abs('/news/' + n.id)})`),
    ...getPosts().filter((p) => p.body).slice(0, 8).map((p) => `- [${p.title}](${abs('/blog/' + p.slug)})`),
    '',
    '## خرائط وملفات',
    `- خريطة الموقع: ${abs('/sitemap.xml')}`,
    `- خلاصة RSS: ${abs('/rss.xml')}`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
