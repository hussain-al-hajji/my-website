// يصلح النص العربي في ملفات PDF التي يولّدها Chrome ليُنسخ ويُبحث فيه طبيعياً.
// المتصفح يرسم الحروف بترتيبها البصري ويضع على كل حرف وسم ActualText مستقلاً، فيتفكك النص العربي عند النسخ والبحث
// (تظهر مسافات داخل الكلمات، أو تنعكس الحروف في بعض القارئات). هنا نجمع حروف الكلمة الواحدة في وسم واحد بنصها كما يرسمها المتصفح،
// فيستعيد منه القارئ الكلمة كاملة. ولا نمسّ شيئاً من الرسم نفسه.
// كما نوزّع نصوص الصفحة الطويلة على صفحات (splitPdf) كي لا يتكرر نص القسم كله عند قصّه على عدة صفحات A4.
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

const dec = new TextDecoder('latin1'), enc = new TextEncoder();
const isWs = (c) => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
const isDelim = (c) => c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;
const NUM = /^[+-]?(\d+\.?\d*|\.\d+)$/;

// يقسّم محتوى الصفحة إلى عبارات: معاملات + معامل التشغيل، مع مواضعها في النص الأصلي
function parseStream(s) {
  const out = [];
  let i = 0, start = -1, args = [];
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (isWs(c)) { i++; continue; }
    if (c === 0x25) { while (i < n && s.charCodeAt(i) !== 10 && s.charCodeAt(i) !== 13) i++; continue; }
    const t0 = i;
    let tok;
    if (c === 0x2f) { i++; while (i < n && !isWs(s.charCodeAt(i)) && !isDelim(s.charCodeAt(i))) i++; tok = { k: 'name', raw: s.slice(t0, i), v: s.slice(t0 + 1, i) }; }
    else if (c === 0x28) {
      let d = 0;
      while (i < n) { const ch = s.charCodeAt(i); if (ch === 0x5c) i++; else if (ch === 0x28) d++; else if (ch === 0x29 && --d === 0) { i++; break; } i++; }
      tok = { k: 'str', raw: s.slice(t0, i) };
    } else if (c === 0x3c && s.charCodeAt(i + 1) === 0x3c) {
      let d = 0;
      while (i < n) {
        const two = s.slice(i, i + 2);
        if (two === '<<') { d++; i += 2; } else if (two === '>>') { d--; i += 2; if (!d) break; } else if (s[i] === '(') { let p = 0; while (i < n) { const ch = s.charCodeAt(i); if (ch === 0x5c) i++; else if (ch === 0x28) p++; else if (ch === 0x29 && --p === 0) { i++; break; } i++; } } else i++;
      }
      tok = { k: 'dict', raw: s.slice(t0, i) };
    } else if (c === 0x3c) { i = s.indexOf('>', i) + 1; if (i === 0) return null; tok = { k: 'hex', raw: s.slice(t0, i) }; }
    else if (c === 0x5b) {
      let d = 0;
      while (i < n) { const ch = s.charCodeAt(i); if (ch === 0x5b) d++; else if (ch === 0x5d && --d === 0) { i++; break; } else if (ch === 0x28) { let p = 0; while (i < n) { const x = s.charCodeAt(i); if (x === 0x5c) i++; else if (x === 0x28) p++; else if (x === 0x29 && --p === 0) break; i++; } } i++; }
      tok = { k: 'arr', raw: s.slice(t0, i) };
    } else if (isDelim(c)) { i++; continue; }
    else { while (i < n && !isWs(s.charCodeAt(i)) && !isDelim(s.charCodeAt(i))) i++; const raw = s.slice(t0, i); tok = NUM.test(raw) ? { k: 'num', raw, v: parseFloat(raw) } : { k: 'op', raw }; }
    if (start < 0) start = t0;
    if (tok.k === 'op') {
      if (tok.raw === 'BI') return null;    // صور مضمّنة: لا نعالج هذه الصفحة
      out.push({ s: start, e: i, op: tok.raw, args });
      args = []; start = -1;
    } else args.push(tok);
  }
  return out;
}

// خريطة ToUnicode للخط: رمز الحرف إلى نصه
function parseCMap(text) {
  const map = new Map();
  let len = 2;
  const cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(text); if (cs) len = cs[1].length / 2;
  const u16 = (h) => { let r = ''; for (let i = 0; i < h.length; i += 4) r += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return r; };
  for (const b of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const m of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), u16(m[2]));
  for (const b of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]*)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
      if (m[5] !== undefined) { const arr = [...m[5].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => u16(x[1])); for (let c = lo; c <= hi; c++) map.set(c, arr[c - lo] || ''); }
      else { const base = m[4]; const head = u16(base.slice(0, -4)), last = parseInt(base.slice(-4), 16); for (let c = lo; c <= hi; c++) map.set(c, head + String.fromCharCode(last + c - lo)); }
    }
  }
  return { map, len };
}

// خطوط الصفحة: اسم المورد => { cm: خريطة ToUnicode، dict: قاموس الخط، used: رموز الحروف المستعملة }
function fontInfos(doc, page, shared) {
  const res = page.node.Resources();
  const fonts = res && res.lookupMaybe(PDFName.of('Font'), PDFDict);
  const out = new Map();
  if (!fonts) return out;
  for (const [name, ref] of fonts.entries()) {
    const key = ref.toString();
    if (shared.has(key)) { out.set(name.decodeText(), shared.get(key)); continue; }
    const dict = fonts.context.lookup(ref, PDFDict);
    const tu = dict && dict.lookupMaybe(PDFName.of('ToUnicode'), PDFRawStream);
    let cm = { map: new Map(), len: 1 }, src = '';
    if (tu) { try { src = dec.decode(decodePDFRawStream(tu).decode()); cm = parseCMap(src); } catch { /* تجاهل */ } }
    const info = { cm, dict, src, used: new Set(), hasTu: !!tu };
    shared.set(key, info);
    out.set(name.decodeText(), info);
  }
  return out;
}

// الرموز التي لا تعيين لها في ToUnicode (كنقاط الحروف المنفصلة) تُعيَّن إلى «ـ» (كشيدة، حرف عربي): فيعدّ قارئ Chrome الكتلة عربية
// ويرتّب حروف الكلمة صحيحاً. هذه الرموز تقع دائماً داخل وسم ActualText فلا يظهر الحرف في النص المستخرج
function patchToUnicode(doc, shared) {
  const weak = (v) => v === '' || v === '\u0000' || /^\p{M}+$/u.test(v);          // لا تعيين، أو علامة تشكيل وحدها
  for (const info of shared.values()) {
    if (!info.hasTu) continue;
    const missing = [...info.used].filter((c) => info.cm.map.get(c) === undefined);
    const weakCodes = new Set([...info.cm.map].filter(([, v]) => weak(v)).map(([c]) => c));
    if (!missing.length && !weakCodes.size) continue;
    const w = info.cm.len * 2;
    let add = '';
    for (let i = 0; i < missing.length; i += 100) {
      const chunk = missing.slice(i, i + 100);
      add += `${chunk.length} beginbfchar\n${chunk.map((c) => `<${c.toString(16).toUpperCase().padStart(w, '0')}> <0640>`).join('\n')}\nendbfchar\n`;
    }
    let patched = info.src.replace(/<([0-9a-fA-F]+)>(\s*)<([0-9a-fA-F]{4})>/g, (m, code, sp, val) => (weakCodes.has(parseInt(code, 16)) ? `<${code}>${sp}<0640>` : m));
    patched = patched.includes('endcmap') ? patched.replace('endcmap', add + 'endcmap') : patched + add;
    info.dict.set(PDFName.of('ToUnicode'), doc.context.register(doc.context.flateStream(enc.encode(patched))));
  }
}

const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const nums = (a) => a.filter((t) => t.k === 'num').map((t) => t.v);
const utf16hex = (str) => { let h = 'FEFF'; for (let i = 0; i < str.length; i++) h += str.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'); return h; };
const KEEP_IN_DROPPED = new Set(['rg', 'RG', 'g', 'G', 'k', 'K', 'sc', 'scn', 'SC', 'SCN', 'cs', 'CS', 'gs', 'Tf', 'Tr', 'Tc', 'Tw', 'Tz', 'TL', 'Ts']);
const LETTER = /[\p{L}\p{M}]/u;

// يحلّل الكتل النصية (BT..ET): موضع كل كتلة، وأوسمة ActualText التي في حاويات ReversedChars
function analyse(stmts, pageH, fmaps) {
  const blocks = [];
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  let cur = null, tm, tlm, leading = 0, marks = [], font = null;
  stmts.forEach((st, idx) => {
    const a = nums(st.args);
    switch (st.op) {
      case 'q': stack.push(ctm.slice()); break;
      case 'Q': if (stack.length) ctm = stack.pop(); break;
      case 'cm': if (a.length === 6) ctm = mul(a, ctm); break;
      case 'BT': cur = { from: idx, to: idx, baseY: null, spans: [] }; tm = tlm = [1, 0, 0, 1, 0, 0]; marks = []; break;
      case 'ET': if (cur) { cur.to = idx; blocks.push(cur); cur = null; } break;
      case 'Tf': font = st.args[0]?.v; break;
      case 'BMC': if (cur) marks.push({ rev: st.args[0]?.v === 'ReversedChars' }); break;
      case 'BDC': if (cur) {
        const m = /\/ActualText\s*<([0-9a-fA-F\s]*)>/.exec(st.args[1]?.raw || '');
        let t = null;
        if (m) { const h = m[1].replace(/\s+/g, ''); t = ''; for (let i = 4; i < h.length; i += 4) t += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); }
        marks.push({ bdc: idx, text: t, inRev: marks.some((x) => x.rev) });
      } break;
      case 'EMC': if (cur) { const m = marks.pop(); if (m && m.text !== undefined && m.text !== null && m.inRev) cur.spans.push({ bdc: m.bdc, emc: idx, text: m.text }); } break;
      case 'Tj': case 'TJ': {
        if (!cur) break;
        const fi = fmaps.get(font);
        const fm = fi ? fi.cm : { map: new Map(), len: 1 };
        const hx = st.args.find((x) => x.k === 'hex' || x.k === 'arr');
        const raws = !hx ? [] : hx.k === 'arr' ? [...hx.raw.matchAll(/<([0-9a-fA-F\s]*)>/g)].map((x) => x[1]) : [hx.raw.slice(1, -1)];
        let t = '';
        for (const r of raws) { const h = r.replace(/\s+/g, ''); for (let i = 0; i + fm.len * 2 <= h.length; i += fm.len * 2) { const code = parseInt(h.slice(i, i + fm.len * 2), 16); if (fi) fi.used.add(code); t += fm.map.get(code) ?? ''; } }
        // رمز بلا وسم ActualText داخل حاوية ReversedChars: حرف له تعيين مباشر في ToUnicode
        if (!marks.some((m) => m.rev) || marks.some((m) => m.text !== undefined)) break;
        const prev = stmts[idx - 1];
        cur.spans.push({ bdc: prev && (prev.op === 'Td' || prev.op === 'TD') ? idx - 1 : idx, emc: idx, text: t, plain: true });
        break;
      }
      case 'Tm': if (cur && a.length === 6) { tm = tlm = a; if (cur.baseY === null) cur.baseY = pageH - mul(tm, ctm)[5]; } break;
      case 'Td': case 'TD': if (cur && a.length === 2) { if (st.op === 'TD') leading = -a[1]; tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm); tm = tlm; } break;
      case 'T*': if (cur) { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; } break;
      case 'TL': leading = a[0] || 0; break;
      default:
    }
  });
  return blocks;
}

// حروف الكلمة المتجاورة (كل حرف في وسم) تُدمج في وسم واحد؛ وعلامات الترقيم تبقى أوسمة مستقلة كي تُوضع في مكانها الصحيح
function mergeSpans(stmts, blocks) {
  const drop = new Set(), before = new Map(), after = new Map();
  for (const b of blocks) {
    const sp = b.spans.slice().sort((x, y) => x.bdc - y.bdc);
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        run.forEach((r) => { if (!r.plain) { drop.add(r.bdc); drop.add(r.emc); } });
        // النص كما يرسمه المتصفح: حروف الكلمة بترتيبها البصري (معكوسة)
        const vis = run.map((r) => [...r.text].reverse().join('')).join('');
        before.set(run[0].bdc, `/Span<</ActualText <${utf16hex(vis)}>>>BDC`);
        after.set(run.at(-1).emc, 'EMC');
      }
      run = [];
    };
    for (const s of sp) {
      const prev = run.at(-1);
      const contiguous = prev && !stmts.slice(prev.emc + 1, s.bdc).some((x) => x.op === 'Tj' || x.op === 'TJ');
      if (!LETTER.test(s.text)) { flush(); continue; }     // علامة ترقيم أو رقم: يبقى وسماً مستقلاً
      if (prev && !contiguous) flush();
      run.push(s);
    }
    flush();
  }
  return { drop, before, after };
}

const pageStream = (doc, page) => {
  const c = page.node.Contents();
  const streams = c instanceof PDFArray ? c.asArray().map((r) => doc.context.lookup(r)) : [c];
  return streams.map((s) => dec.decode(decodePDFRawStream(s).decode())).join('\n');
};
const setContent = (doc, page, str) => page.node.set(PDFName.Contents, doc.context.register(doc.context.flateStream(enc.encode(str))));

// يبني محتوى الصفحة. keep(block) اختياري: الكتل النصية المحذوفة لا يبقى منها إلا ضبط الحالة (الألوان والخطوط)
function build(text, stmts, blocks, keep) {
  const { drop, before, after } = mergeSpans(stmts, blocks);
  const blockAt = new Map(blocks.map((b) => [b.from, b]));
  const parts = [];
  for (let i = 0; i < stmts.length; i++) {
    const b = blockAt.get(i);
    const gone = b && keep && !keep(b);
    if (gone) { for (let k = b.from; k <= b.to; k++) if (KEEP_IN_DROPPED.has(stmts[k].op)) parts.push(text.slice(stmts[k].s, stmts[k].e)); i = b.to; continue; }
    if (before.has(i)) parts.push(before.get(i));
    if (!drop.has(i)) parts.push(text.slice(stmts[i].s, stmts[i].e));
    if (after.has(i)) parts.push(after.get(i));
  }
  return parts.join('\n');
}

// يصلح كل صفحات الملف
export async function fixPdf(bytes) {
  const doc = await PDFDocument.load(bytes);
  const shared = new Map(), todo = [];
  for (const page of doc.getPages()) {
    const text = pageStream(doc, page), stmts = parseStream(text);
    if (!stmts) continue;
    todo.push({ page, text, stmts, blocks: analyse(stmts, page.getHeight(), fontInfos(doc, page, shared)) });
  }
  patchToUnicode(doc, shared);
  for (const t of todo) setContent(doc, t.page, build(t.text, t.stmts, t.blocks, null));
  return doc.save();
}

// يحوّل الصفحة الطويلة إلى عدة صفحات بالمقاس والموارد نفسها: الرسم كاملاً في كل صفحة، لكن نص نطاقها وحده.
// ranges: [من، إلى] بالنقاط من أعلى الصفحة؛ كل نطاق صفحة مستقلة. يعيد null إن تعذّر تحليل الصفحة
export async function splitPdf(bytes, ranges) {
  const doc = await PDFDocument.load(bytes);
  const base = doc.getPage(0);
  const text = pageStream(doc, base), stmts = parseStream(text);
  if (!stmts) return null;
  const shared = new Map();
  const blocks = analyse(stmts, base.getHeight(), fontInfos(doc, base, shared));
  patchToUnicode(doc, shared);
  const pages = ranges.map((_, i) => {
    if (i === 0) return base;
    const np = doc.addPage([base.getWidth(), base.getHeight()]);
    np.node.set(PDFName.Resources, base.node.get(PDFName.Resources));
    return np;
  });
  ranges.forEach(([a, b], i) => setContent(doc, pages[i], build(text, stmts, blocks, (blk) => blk.baseY === null || (blk.baseY >= a - 0.01 && blk.baseY < b - 0.01))));
  return doc.save();
}

export async function pageCount(bytes) {
  return (await PDFDocument.load(bytes)).getPageCount();
}
