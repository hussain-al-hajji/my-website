// بيانات ملف الأعمال المشتركة بين نسخة الـPDF (components/Portfolio.astro) وصفحة الويب (pages/work-file.astro).
// كل ما يُعرض مشتق من src/data، فتتحدّث الصفحتان والملف مع كل بناء جديد.
import pages from '../data/pages.json';
import projects from '../data/projects.json';
import featured from '../data/featured.json';
import partners from '../data/partners.json';
import award from '../data/award.json';
import testimonials from '../data/testimonials.json';
import mediaAll from '../data/media.json';
import honors from '../data/honors.json';
import { site, getKits, records, stats, isRemote, getGroups } from './site.js';
import { fillTokens } from './faq.js';
import { mapShapes, CITY_EN } from './impactmap.js';

export function portfolioData(lang = 'ar', otherLabel = 'مواضيع أخرى') {
  const en = lang === 'en';
  const tx = (x, k) => (en && x.en && x.en[k]) || x[k];
  const S = (en && site.en) || {};
  const sName = S.name || site.name, sTag = (en && S.tagline) || site.tagline, sRole = S.role || site.role, sFocus = S.focus || site.focus;
  const aw = (k) => (en && award.en && award.en[k]) || award[k];
  const cityName = (c) => (en && CITY_EN[c]) || c;
  const st = stats();
  const featTitle = Object.fromEntries(getGroups('featured', featured).map((g) => [g.id, (en && g.titleEn) || g.title]));
  const y0 = st.years[0], y1 = st.lastYear;
  const kits = getKits();
  const n = (v) => Number(v).toLocaleString('en-US');
  const bioP = (en && pages.bio.en) || pages.bio;
  const intro = (bioP.intro || []).map(fillTokens);
  const remoteN = records.filter(isRemote).length;
  const inN = records.length - remoteN;
  const logos = partners.filter((p) => p.logo);
  // التوصيات المنشورة في الرئيسية نفسها (المميّزة)
  const voices = testimonials.filter((t) => t.kind === 'recommendation' && t.featured && (t.quote || t.full)).map((t) => ({ name: tx(t, 'name'), role: tx(t, 'role'), text: (tx(t, 'quote') || tx(t, 'full')).replace(/^[“"]|[”"]$/g, '') }));
  const seen = new Set();
  // شعارات الاستضافات الإعلامية (حقل «شعار البورتفليو» في قسم الإعلام)، شعار واحد لكل جهة
  const outlets = mediaAll.filter((m) => m.pdfLogo).map((m) => ({ name: (m.short || m.outlet.split('،')[0]).trim(), logo: m.pdfLogo })).filter((o) => (seen.has(o.logo) ? false : seen.add(o.logo)));

  // الغلاف: كل برنامج في السجل نقطة على حلزون ذهبي، والأحدث أسطع
  const GA = Math.PI * (3 - Math.sqrt(5));
  const galaxy = [...records].sort((a, b) => a.year - b.year).map((r, i) => {
    const rr = 7.4 * Math.sqrt(i + 4), t = i * GA;
    return { x: 200 + rr * Math.cos(t), y: 200 + rr * Math.sin(t), o: 0.28 + 0.72 * ((r.year - y0) / Math.max(1, y1 - y0)), s: 2.1 + (i % 7 === 0 ? 1.1 : 0) };
  });

  // الأثر في أرقام: أعمدة سنوات من نقاط (الأقدم يميناً)، والمواضيع
  const perYear = st.years.map((y) => ({ y, c: records.filter((r) => r.year === y).length }));
  const maxY = Math.max(...perYear.map((p) => p.c));
  const COLS = 4, DOT = 9, colW = 64;
  const yearsSvgW = perYear.length * colW;
  const yearsSvgH = Math.ceil(maxY / COLS) * DOT + 46;
  const tcount = {};
  records.forEach((r) => { tcount[r.topic] = (tcount[r.topic] || 0) + 1; });
  const topicEn = Object.fromEntries((S.topics || []).map((x) => [x.ar, x.en]));
  const topicName = (t) => (en && topicEn[t]) || t;
  const topicsAll = Object.entries(tcount).filter(([t]) => t !== 'أخرى').sort((a, b) => b[1] - a[1]);
  const topics = topicsAll.slice(0, 6);
  const otherT = topicsAll.slice(6).reduce((a, b) => a + b[1], 0) + (tcount['أخرى'] || 0);
  if (otherT) topics.push([otherLabel, otherT]);
  // أمثلة «مواضيع أخرى»: عناوين تُحرَّر من لوحة التحكم (portfolioTopicExamples)
  const otherSamples = (en && S.portfolioTopicExamples) || site.portfolioTopicExamples || [];
  const remoteDeg = (remoteN / records.length) * 360;

  const pillarsAr = (pages.methodology?.pillars || []).slice(0, 5);
  const pillars = pillarsAr.map((pl, i) => ((en && pages.methodology.en?.pillars?.[i]) || pl));
  const impactMap = mapShapes(records, en);
  if (en) impactMap.label = `Programs were delivered in person in more than ${Math.floor(impactMap.total / 10) * 10} locations inside and outside the Kingdom`;
  const topCities = [...impactMap.placed].sort((a, b) => b.n - a.n).slice(0, 6);
  // صورة لحظة التكريم من معرض الجائزة، وإلا صورة الصفحة الرئيسية للجائزة
  const awardImg = (award.gallery || []).find((g) => /لحظة التكريم/.test(g.caption || ''))?.image || award.hero;
  // الصورة الجماعية للمكرّمين في حفل التكريم
  const awardGroup = (award.gallery || []).find((g) => /صورة جماعية لرواد الشباب العربي في النسخة الرابعة/.test(g.caption || '')) || (award.gallery || []).find((g) => /صورة جماعية/.test(g.caption || ''));
  // أدواري في التعاون (من لوحة التحكم)
  const roles = site.portfolioRoles || [];
  const rolesShown = (en && S.portfolioRoles) || roles;

  return {
    en, tx, S, sName, sTag, sRole, sFocus, aw, cityName, st, featTitle, y0, y1, kits, n, bioP, intro, remoteN, inN, logos, voices, outlets,
    galaxy, perYear, maxY, COLS, DOT, colW, yearsSvgW, yearsSvgH, topics, topicName, otherSamples, remoteDeg, pillars, impactMap, topCities,
    awardImg, awardGroup, roles, rolesShown, projects, featured, records, honors, award, pages,
  };
}

// أيقونة خطية لكل دور بحسب كلماته
const ICONS = [
  [/مدرب/, '<path d="M3 4h18v11H3z"/><path d="M8 20l4-5 4 5"/><path d="M7 11l3-3 2 2 4-4"/>'],
  [/مرشد/, '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'],
  [/مستشار/, '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>'],
  [/مطور|مبادر/, '<path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>'],
  [/مدير|مشاريع/, '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5M8 17h7"/><path d="M4 9h2"/>'],
  [/محك/, '<path d="M12 3v18M6 21h12"/><path d="M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>'],
  [/كاتب|محتوى/, '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'],
];
export const roleIcon = (r) => `<svg viewBox="0 0 24 24" aria-hidden="true">${(ICONS.find(([re]) => re.test(r)) || [0, '<circle cx="12" cy="12" r="8"/>'])[1]}</svg>`;
