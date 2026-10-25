// «عرض المزيد»: يُطوى النص الطويل بعد نحو ثلاثة أسطر، ويُترك القصير كاملاً بلا زر.
const boxes = [...document.querySelectorAll('[data-more]')];
const measure = () => boxes.forEach((box) => {
  const body = box.querySelector('.more-body'), btn = box.querySelector('.more-btn');
  if (box.classList.contains('open')) return;
  box.classList.add('fold');
  const long = body.scrollHeight > body.clientHeight + 4;
  btn.hidden = !long; box.classList.toggle('fold', long);
});
boxes.forEach((box) => {
  const btn = box.querySelector('.more-btn');
  btn.addEventListener('click', () => {
    const open = box.classList.toggle('open');
    box.classList.toggle('fold', !open);
    btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'عرض أقل' : 'عرض المزيد';
    if (!open) box.closest('li')?.scrollIntoView({ block: 'nearest' });
  });
});
// المحتوى داخل قسم مطوي بلا قياس؛ يُقاس عند فتح القسم
document.querySelectorAll('details.fold-sec').forEach((d) => d.addEventListener('toggle', () => d.open && measure()));
measure();
document.fonts?.ready.then(measure);
let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(measure, 150); });
