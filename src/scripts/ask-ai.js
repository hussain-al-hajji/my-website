// قسم «اسأل الذكاء الاصطناعي»: اختيار سؤال يغيّر النص المعروض وروابط الأدوات.
// الأدوات التي لا تقبل السؤال في الرابط (Gemini) يُنسخ السؤال إلى الحافظة عند الضغط على أيقونتها ليُلصق في المحادثة
const box = document.getElementById('ask');
if (box) {
  const chips = [...box.querySelectorAll('.ask-qs .fchip')];
  const note = document.getElementById('askNote');
  const links = [...box.querySelectorAll('.ask-tools a')];
  const base = note.textContent;
  let cur = chips[0]?.dataset.prompt || '';
  const pick = (chip) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
    cur = chip.dataset.prompt;
    links.forEach((a) => { if (!a.hasAttribute('data-ask-copy')) a.href = a.dataset.base + encodeURIComponent(cur); });
  };
  chips.forEach((c) => c.addEventListener('click', () => pick(c)));
  links.filter((a) => a.hasAttribute('data-ask-copy')).forEach((a) => a.addEventListener('click', () => {
    const say = (t) => { note.textContent = t; note.classList.add('on'); setTimeout(() => { note.textContent = base; note.classList.remove('on'); }, 6000); };
    navigator.clipboard?.writeText(cur).then(() => say('نُسخ السؤال، الصقه في محادثة Gemini.'), () => say('تعذّر النسخ تلقائياً، حدّد نص السؤال وانسخه ثم الصقه في Gemini.'));
  }));
}
