// سياق الزائر من الرابط: ?for=owners&goal=ai. يُحفظ طوال الجلسة فيبقى أثناء تنقله بين الصفحات.
const KEY = 'for', GKEY = 'goal';
const read = (k, valid) => {
  try {
    const v = new URLSearchParams(location.search).get(k);
    if (v && valid.includes(v)) { sessionStorage.setItem(k, v); return v; }
    const s = sessionStorage.getItem(k);
    return s && valid.includes(s) ? s : '';
  } catch { return ''; }
};
const ctx = JSON.parse(document.body.dataset.ctx || '{"auds":{},"goals":{}}');
export const AUDS = ctx.auds, GOALS = ctx.goals;
export const getAud = () => read(KEY, Object.keys(AUDS));
export const getGoal = () => read(GKEY, Object.keys(GOALS));
