// ترجمة الصفحة إلى الإنجليزية عبر مترجم قوقل. تُحمَّل أداة قوقل عند طلب الإنجليزية فقط.
const COOKIE = 'googtrans';
const isEn = () => /(?:^|;\s*)googtrans=\/ar\/en/.test(document.cookie);

function writeCookie(value) {
  const exp = value ? '' : ';expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const host = location.hostname;
  const parts = host.split('.');
  const bases = [host];
  if (parts.length > 2) bases.push('.' + parts.slice(-2).join('.'));
  document.cookie = `${COOKIE}=${value};path=/${exp}`;
  bases.forEach((d) => (document.cookie = `${COOKIE}=${value};path=/;domain=${d}${exp}`));
}

function applyDir(en) {
  const h = document.documentElement;
  h.lang = en ? 'en' : 'ar';
  h.dir = en ? 'ltr' : 'rtl';
  h.classList.toggle('is-en', en);
  document.querySelectorAll('[data-lang-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(en));
    b.setAttribute('aria-label', en ? 'العربية' : 'English');
    const t = b.querySelector('.lang-txt'); if (t) t.textContent = en ? 'AR' : 'EN';
  });
}

function loadWidget() {
  window.gtInit = () => {
    /* eslint-disable-next-line no-undef */
    new google.translate.TranslateElement({ pageLanguage: 'ar', includedLanguages: 'en', autoDisplay: false }, 'gt-el');
  };
  const s = document.createElement('script');
  s.src = 'https://translate.google.com/translate_a/element.js?cb=gtInit';
  s.async = true;
  document.head.appendChild(s);
}

const en = isEn();
applyDir(en);
if (en) loadWidget();

document.querySelectorAll('[data-lang-toggle]').forEach((b) => b.addEventListener('click', () => {
  if (isEn()) writeCookie(''); else writeCookie('/ar/en');
  location.reload();
}));
