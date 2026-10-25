// ملخص قصير لعنصر في السيرة (للنسخة المختصرة): الحقل «brief» إن كُتب، وإلا يُقتطع تلقائياً من الوصف.
const MAX = 150;
const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();

/** يقتطع جملة أو جملتين من نص طويل بحدّ أقصى للحروف، ويقطع عند حدّ كلمة إن لزم */
export function extract(text, max = MAX) {
  const t = clean(text);
  if (t.length <= max) return t;
  const parts = t.split(/(?<=[.؟!؛])\s+/);
  let out = '';
  for (const p of parts) {
    if (out && (out + ' ' + p).length > max) break;
    out = out ? out + ' ' + p : p;
    if (out.length >= max * 0.6) break;
  }
  if (out.length <= max + 20) return out.replace(/[.؛]$/, '.');
  const cut = out.slice(0, max).replace(/\s+\S*$/, '');
  return cut.replace(/[،,:؛]$/, '') + '…';
}

export function briefOf(item, max = MAX) {
  const b = clean(item.brief);
  if (b) return b;
  const base = clean(item.desc) || clean(String(item.details || '').split('\n').find((l) => /^[-•\d]/.test(l.trim())) || '').replace(/^[-•\d.\s]+/, '');
  return extract(base, max);
}
