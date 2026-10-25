// تقسيمات الصفحات ذات الأقسام: الأسماء الافتراضية وحلّال موحّد يقرأ التعريفات المحفوظة من لوحة التحكم (pages.json ← groups).
// وحدة بلا اعتماديات، فيستخدمها بناء الموقع ولوحة التحكم معاً.
export const PROMPT_CAT = {
  products: 'اكتشاف المنتجات والفرص',
  listings: 'وصف المنتجات والمتجر',
  content: 'المحتوى والتسويق',
  support: 'خدمة العملاء',
  sales: 'المبيعات والعروض',
  ops: 'التحليل والتشغيل',
  training: 'التدريب وتصميم المحتوى',
};

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
  education: 'التعليم والدرجات الأكاديمية',
  projects: 'مشاريع تدريبية مرموقة',
  sdgs: 'أهداف التنمية المستدامة',
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


export const GROUP_PAGES = {
  bio: { defaults: BIO_SECTION, key: 'section' },
  partners: { defaults: PARTNER_GROUP, key: 'group' },
  media: { defaults: MEDIA_SECTION, key: 'section' },
  prompts: { defaults: PROMPT_CAT, key: 'category' },
  featured: { defaults: {}, key: 'group' },
};

/** كتل نصية ثابتة تظهر في صفحة «عنّي» كأقسام (نبذة، مسارات العمل) ويمكن ترتيبها مع الأقسام */
export const BIO_BLOCKS = { intro: 'نبذة', tracks: 'مسارات العمل' };

/**
 * الأقسام مرتّبة كما في لوحة التحكم: المحفوظة أولاً بترتيبها، ثم الافتراضية غير المذكورة.
 * كل قسم: { id, title, hidden, block, style, custom }. تعيد أيضاً عناصر بلا قسم معروف في قسم أخير «orphan» إن طُلب.
 */
export function resolveGroups(page, saved = [], items = []) {
  const cfg = GROUP_PAGES[page] || { defaults: {}, key: 'group' };
  const out = [], seen = new Set();
  const push = (g) => { if (g.id && !seen.has(g.id)) { seen.add(g.id); out.push(g); } };
  for (const g of saved || []) {
    push({ id: g.id, title: g.title || cfg.defaults[g.id] || (page === 'bio' && BIO_BLOCKS[g.id]) || g.id, hidden: !!g.hidden, block: g.block || (page === 'bio' && BIO_BLOCKS[g.id] ? g.id : ''), style: g.style || '', custom: !(g.id in cfg.defaults) && !(page === 'bio' && g.id in BIO_BLOCKS) });
  }
  for (const id of Object.keys(cfg.defaults)) push({ id, title: cfg.defaults[id], hidden: false, block: '', style: '', custom: false });
  // قيم قديمة غير معرّفة (مثل عناوين نصية في «المميزة»): تُضاف بعنوانها نفسه
  if (!saved?.length || page === 'featured') for (const it of items || []) { const id = it[cfg.key]; if (id) push({ id, title: cfg.defaults[id] || id, hidden: false, block: '', style: '', custom: !(id in cfg.defaults) }); }
  return out;
}
export const groupTitle = (groups, id) => (groups.find((g) => g.id === id) || {}).title || id;
