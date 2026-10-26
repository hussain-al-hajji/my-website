// ترجمة نصوص السيرة من العربية إلى الإنجليزية لمحرّر لوحة التحكم.
// الأفضلية لـ Claude إن ضُبط سرّ ANTHROPIC_API_KEY، وإلا Workers AI (ربط AI) دون أسرار.
export const TRANSLATE_LIMITS = { items: 60, itemChars: 6000, totalChars: 30000 };
export class TranslateError extends Error {}

const SYSTEM = 'You translate Arabic professional CV and website content (a Saudi trainer, mentor and project manager) into natural, polished, professional English. Rules: keep every line break, list marker ("- "), numbered prefix, heading line ending with a colon, number, placeholder in {braces}, URL and Latin-script term exactly as they are; use the official English names of known organizations, programs and universities; keep the first-person voice where the Arabic uses it; do not add or omit information; output only the translation.';

const clean = (t) => String(t).replace(/\s+$/g, '');

export function validateTexts(texts) {
  if (!Array.isArray(texts) || !texts.length || texts.length > TRANSLATE_LIMITS.items) throw new TranslateError('bad-request');
  let total = 0;
  for (const t of texts) {
    if (typeof t !== 'string' || t.length > TRANSLATE_LIMITS.itemChars) throw new TranslateError('bad-request');
    total += t.length;
  }
  if (total > TRANSLATE_LIMITS.totalChars) throw new TranslateError('too-long');
  return texts;
}

async function viaClaude(env, texts, f) {
  const r = await f('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.TRANSLATE_MODEL || 'claude-haiku-5-5', max_tokens: 8000, system: SYSTEM + ' The user message is a JSON array of strings. Reply with ONLY a JSON array of translated strings, same length and order.',
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
    }),
  });
  if (!r.ok) throw new TranslateError('upstream-' + r.status);
  const j = await r.json();
  const raw = (j.content || []).map((c) => c.text || '').join('').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  let out;
  try { out = JSON.parse(raw); } catch { throw new TranslateError('bad-output'); }
  if (!Array.isArray(out) || out.length !== texts.length || out.some((x) => typeof x !== 'string')) throw new TranslateError('bad-output');
  return out.map(clean);
}

// Workers AI: ترجمة سطراً سطراً مع حفظ بادئات القوائم والرموز {…}
async function viaWorkersAI(env, texts) {
  const one = async (line) => {
    const m = /^(\s*(?:[-•▪]|\d+\s*[-.)])\s*)?(.*)$/s.exec(line);
    const prefix = m[1] || '', body = m[2];
    if (!body.trim()) return line;
    const holds = [];
    const safe = body.replace(/\{[a-zA-Z]+\}/g, (x) => { holds.push(x); return `ZQ${holds.length - 1}X`; });
    const res = await env.AI.run('@cf/meta/m2m100-1.2b', { text: safe, source_lang: 'arabic', target_lang: 'english' });
    const t = String(res.translated_text || '').replace(/ZQ(\d+)X/g, (_, i) => holds[+i] || '');
    return prefix + t;
  };
  return Promise.all(texts.map(async (t) => (await Promise.all(t.split('\n').map(one))).join('\n')));
}

export async function translateTexts(env, texts, deps = {}) {
  validateTexts(texts);
  if (env.ANTHROPIC_API_KEY) return viaClaude(env, texts, deps.fetch || fetch);
  if (env.AI) return viaWorkersAI(env, texts);
  throw new TranslateError('not-configured');
}
