// بيانات منظّمة (JSON-LD) تقرؤها محركات البحث ونماذج الذكاء الاصطناعي.
import bio from '../data/bio.json';
import { site, abs, SITE_URL } from './site.js';
import { STATIC_PAGES } from './pages.js';

const KNOWS = ['إدارة مشاريع التدريب والتطوير', 'تمكين الشباب', 'التجارة الإلكترونية', 'العمل الحر عبر الإنترنت', 'الإرشاد المهني', 'ريادة الأعمال الرقمية', 'العلامة التجارية الشخصية', 'تطبيقات الذكاء الاصطناعي في الأعمال', 'التدريب والاستشارات', 'قيادة المبادرات التنموية'];

export function personSchema() {
  const creds = bio.filter((x) => x.section === 'credentials').map((x) => ({
    '@type': 'EducationalOccupationalCredential',
    name: x.title,
    credentialCategory: 'certification',
    ...(x.subtitle ? { description: x.subtitle } : {}),
  }));
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': SITE_URL + '/#person',
    name: site.name,
    alternateName: 'Hussain Al-Hajji',
    jobTitle: site.role,
    description: site.description,
    url: SITE_URL + '/',
    image: abs('/img/photos/p29.webp'),
    email: site.contact.email,
    knowsLanguage: ['ar', 'en'],
    nationality: { '@type': 'Country', name: 'المملكة العربية السعودية' },
    address: { '@type': 'PostalAddress', addressCountry: 'SA' },
    knowsAbout: KNOWS,
    hasCredential: creds,
    award: ['رواد الشباب العربي (النسخة الرابعة، 2025) في مسار ريادة الأعمال'],
    sameAs: [site.contact.linkedin, site.contact.podcast, site.contact.scribd].filter(Boolean),
  };
}

export function breadcrumbSchema(path, title) {
  if (!path || path === '/') return null;
  const items = [{ name: site.name, path: '/' }];
  const seg = path.split('/').filter(Boolean);
  if (seg.length > 1) {
    const parent = STATIC_PAGES.find((p) => p.path === '/' + seg[0]);
    if (parent) items.push({ name: parent.title, path: parent.path });
  }
  items.push({ name: title || seg.at(-1), path });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE_URL + (it.path === '/' ? '/' : it.path) })),
  };
}

export function coursesSchema(kits) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'الحقائب التدريبية',
    itemListElement: kits.map((k, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Course',
        name: k.title,
        description: k.summary,
        url: SITE_URL + '/collaborate#' + k.id,
        inLanguage: 'ar',
        timeRequired: k.duration,
        provider: { '@type': 'Person', '@id': SITE_URL + '/#person', name: site.name },
        ...(k.axes?.length ? { teaches: k.axes.slice(0, 8) } : {}),
        ...(k.audience?.length ? { audience: { '@type': 'Audience', audienceType: k.audience.map((a) => a.split(':')[0]).join('، ') } } : {}),
      },
    })),
  };
}

export function faqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })),
  };
}
