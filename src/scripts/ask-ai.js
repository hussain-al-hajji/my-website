// قسم «اسأل الذكاء الاصطناعي»: اختيار سؤال يغيّر النص المعروض وروابط الأدوات، ويمكن نسخ السؤال لأي أداة أخرى
const box = document.getElementById('ask');
if (box) {
  const chips = [...box.querySelectorAll('.ask-qs .fchip')];
  const text = document.getElementById('askText');
  const links = [...box.querySelectorAll('.ask-tools a')];
  const copy = document.getElementById('askCopy');
  let cur = chips[0]?.dataset.prompt || '';
  const pick = (chip) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
    cur = chip.dataset.prompt; text.textContent = cur;
    links.forEach((a) => { a.href = a.dataset.base + encodeURIComponent(cur); });
  };
  chips.forEach((c) => c.addEventListener('click', () => pick(c)));
  copy?.addEventListener('click', async () => {
    const done = (t) => { copy.textContent = t; setTimeout(() => { copy.textContent = 'انسخ السؤال'; }, 2200); };
    try { await navigator.clipboard.writeText(cur); done('نُسخ السؤال'); }
    catch {
      const r = document.createRange(); r.selectNodeContents(text); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      done('حدّد النص وانسخه');
    }
  });
}
