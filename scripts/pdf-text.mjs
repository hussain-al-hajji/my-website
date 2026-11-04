// يصلح النص العربي في ملفات PDF التي يولّدها Chrome ليُنسخ ويُبحث فيه طبيعياً.
// المتصفح يرسم الحروف بترتيبها البصري ويضع على كل حرف وسم ActualText مستقلاً، فيتفكك النص العربي عند النسخ والبحث
// (تظهر مسافات داخل الكلمات، أو تنعكس الحروف في بعض القارئات). هنا نجمع حروف الكلمة الواحدة في وسم واحد بنصها كما يرسمها المتصفح،
// فيستعيد منه القارئ الكلمة كاملة. ولا نمسّ شيئاً من الرسم نفسه.
// كما نوزّع نصوص الصفحة الطويلة على صفحات (splitPdf) كي لا يتكرر نص القسم كله عند قصّه على عدة صفحات A4.
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import pako from 'pako';

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
    const info = { cm, dict, src, used: new Set(), hasTu: !!tu, marks: new Set(), newCids: new Map(), pairs: new Map() };
    shared.set(key, info);
    out.set(name.decodeText(), info);
  }
  return out;
}

// قارئات تعتمد خريطة ToUnicode وحدها (Preview وقارئات الهاتف) تتجاهل وسوم ActualText، ومشكلة خط Noto Sans Arabic أن الحرف الواحد يُرسم برمزين:
// جسم مشترك بين عدة حروف (جسم «ب» و«ت» و«ث» و«ن» و«ي» واحد) ونقاط منفصلة. فيخرج النسخ حروفاً بلا نقاط وأشكالاً مقطوعة (ٮ ں).
// الحل: لكل زوج (جسم، حرف) رمز جديد يشير إلى الجسم نفسه عبر CIDToGIDMap، وخريطة ToUnicode تعيّن الرمز الجديد إلى الحرف الصحيح، والنقاط إلى لا شيء.
const PF = /[ﭐ-﷿ﹰ-﻿ﬀ-ﬆ]/;
const normPF = (v) => (PF.test(v) ? v.normalize('NFKC') : v);
const MARK = process.env.PDF_MARK_MODE === 'tatweel' ? 'ـ' : process.env.PDF_MARK_MODE === 'zwsp' ? '​' : process.env.PDF_MARK_MODE === 'none' ? null : '';
const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, '0');
const ustr = (str) => { let h = ''; for (let i = 0; i < str.length; i++) h += hex4(str.charCodeAt(i)); return h; };

function widthsOf(fi) {
  if (fi.w) return fi.w;
  const arr = fi.dict.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray);
  const desc = arr && arr.lookupMaybe(0, PDFDict);
  fi.desc = desc;
  const map = new Map();
  let dw = 1000;
  if (desc) {
    const d = desc.lookupMaybe(PDFName.of('DW'), PDFNumber); if (d) dw = d.asNumber();
    const W = desc.lookupMaybe(PDFName.of('W'), PDFArray);
    if (W) {
      const a = W.asArray(); let i = 0;
      while (i < a.length) {
        const c = a[i].asNumber(), nx = desc.context.lookup(a[i + 1]);
        if (nx instanceof PDFArray) { nx.asArray().forEach((v, k) => map.set(c + k, v.asNumber())); i += 2; }
        else { const hi = nx.asNumber(), w = a[i + 2].asNumber(); for (let k = c; k <= hi; k++) map.set(k, w); i += 3; }
      }
    }
  }
  fi.w = (c) => (map.has(c) ? map.get(c) : dw);
  return fi.w;
}

// pagesBlocks: [{ blocks, repl }]. يملأ repl (رقم عبارة Tj إلى {رمز قديم إلى جديد}) ويعدّل خطوط الملف (ToUnicode وCIDToGIDMap وW)
function remapFonts(doc, shared, pagesBlocks) {
  const clusters = [];
  for (const pb of pagesBlocks) for (const b of pb.blocks) for (const sp of b.spans) {
    if (sp.plain || !sp.text || !sp.tjs || !sp.tjs.length) continue;
    const fi = sp.tjs[0].fi;
    if (sp.tjs.some((t) => t.fi !== fi) || fi.cm.len !== 2) continue;
    const w = widthsOf(fi);
    const codes = sp.tjs.flatMap((t) => t.codes);
    codes.filter((c) => w(c) === 0).forEach((c) => fi.marks.add(c));
    const bases = codes.filter((c) => w(c) > 0);
    if (bases.length !== 1) continue;
    const tj = sp.tjs.find((t) => t.codes.includes(bases[0]));
    if (!fi.pairs.has(bases[0])) fi.pairs.set(bases[0], new Set());
    fi.pairs.get(bases[0]).add(sp.text);
    clusters.push({ pb, fi, base: bases[0], text: sp.text, idx: tj.idx });
  }
  for (const c of clusters) {
    const { fi } = c;
    const orig = normPF(fi.cm.map.get(c.base) || '');
    if (fi.pairs.get(c.base).size === 1 && orig === c.text) continue;          // الرمز الحالي يعطي الحرف الصحيح أصلاً
    if (fi.next === undefined) fi.next = Math.max(0, ...fi.used) + 1;
    const key = `${c.base}|${c.text}`;
    if (!fi.newCids.has(key)) fi.newCids.set(key, { cid: fi.next++, base: c.base, text: c.text });
    const nc = fi.newCids.get(key).cid;
    if (!c.pb.repl.has(c.idx)) c.pb.repl.set(c.idx, new Map());
    c.pb.repl.get(c.idx).set(c.base, nc);
  }
  for (const fi of shared.values()) {
    if (!fi.hasTu || fi.cm.len !== 2) continue;
    const entries = new Map();
    for (const [c, v] of fi.cm.map) if (v !== '\u0000') entries.set(c, normPF(v));
    for (const c of fi.marks) { if (MARK === null) entries.delete(c); else entries.set(c, MARK); }
    for (const { cid, text } of fi.newCids.values()) entries.set(cid, text);
    const rows = [...entries].sort((x, y) => x[0] - y[0]);
    let body = '';
    for (let i = 0; i < rows.length; i += 100) {
      const ch = rows.slice(i, i + 100);
      body += `${ch.length} beginbfchar\n${ch.map(([c, v]) => `<${hex4(c)}> <${ustr(v)}>`).join('\n')}\nendbfchar\n`;
    }
    const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${body}endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
    fi.dict.set(PDFName.of('ToUnicode'), doc.context.register(doc.context.flateStream(enc.encode(cmap))));
    if (fi.newCids.size && fi.desc) {
      const top = fi.next, map = new Uint8Array(top * 2);
      for (let c = 0; c < top; c++) { map[c * 2] = c >> 8; map[c * 2 + 1] = c & 255; }
      const W = fi.desc.lookupMaybe(PDFName.of('W'), PDFArray);
      for (const { cid, base } of fi.newCids.values()) {
        map[cid * 2] = base >> 8; map[cid * 2 + 1] = base & 255;
        if (W) { W.push(PDFNumber.of(cid)); W.push(doc.context.obj([fi.w(base)])); }
      }
      fi.desc.set(PDFName.of('CIDToGIDMap'), doc.context.register(doc.context.flateStream(map)));
    }
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
        marks.push({ bdc: idx, text: t, inRev: marks.some((x) => x.rev), tjs: [] });
      } break;
      case 'EMC': if (cur) { const m = marks.pop(); if (m && m.text !== undefined && m.text !== null && m.inRev) cur.spans.push({ bdc: m.bdc, emc: idx, text: m.text, tjs: m.tjs }); } break;
      case 'Tj': case 'TJ': {
        if (!cur) break;
        const fi = fmaps.get(font);
        const fm = fi ? fi.cm : { map: new Map(), len: 1 };
        const hx = st.args.find((x) => x.k === 'hex' || x.k === 'arr');
        const raws = !hx ? [] : hx.k === 'arr' ? [...hx.raw.matchAll(/<([0-9a-fA-F\s]*)>/g)].map((x) => x[1]) : [hx.raw.slice(1, -1)];
        let t = '';
        const codes = [];
        for (const r of raws) { const h = r.replace(/\s+/g, ''); for (let i = 0; i + fm.len * 2 <= h.length; i += fm.len * 2) { const code = parseInt(h.slice(i, i + fm.len * 2), 16); codes.push(code); if (fi) fi.used.add(code); t += fm.map.get(code) ?? ''; } }
        const host = [...marks].reverse().find((m) => m.tjs && m.text && m.inRev);
        if (host && fi && st.op === 'Tj') host.tjs.push({ idx, fi, codes });
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

// أرقام Chrome بسبع خانات عشرية تُضخّم المحتوى؛ نقرّبها إلى 0.01 نقطة لإزاحات النص (فرق لا يُرى) وإلى 0.001 لبقية الإحداثيات
const ROUND2 = new Set(['Td', 'TD']), ROUND3 = new Set(['Tm', 'cm', 'm', 'l', 'c', 'v', 'y', 're', 'w']);
const rnd = (v, d) => { const r = Math.round(v * 10 ** d) / 10 ** d; return Object.is(r, -0) ? '0' : String(r); };
function compact(text, st) {
  const d = ROUND2.has(st.op) ? 2 : ROUND3.has(st.op) ? 3 : 0;
  const raw = text.slice(st.s, st.e);
  if (!d || st.args.some((a) => a.k !== 'num')) return raw;
  return `${st.args.map((a) => rnd(a.v, d)).join(' ')} ${st.op}`;
}

// يبدّل رموز الحروف داخل سلسلة Tj السداسية (رمزان لكل حرف)
function replaceCodes(st, map) {
  const hx = st.args.find((a) => a.k === 'hex');
  if (!hx || st.args.length !== 1 || st.op !== 'Tj') return null;
  const h = hx.raw.slice(1, -1).replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i + 4 <= h.length; i += 4) { const c = parseInt(h.slice(i, i + 4), 16); out += hex4(map.has(c) ? map.get(c) : c); }
  return `<${out}> Tj`;
}

const pageStream = (doc, page) => {
  const c = page.node.Contents();
  const streams = c instanceof PDFArray ? c.asArray().map((r) => doc.context.lookup(r)) : [c];
  return streams.map((s) => dec.decode(decodePDFRawStream(s).decode())).join('\n');
};
// ضغط محتوى الصفحة بأعلى مستوى (9) لتصغير الملف
const setContent = (doc, page, str) => page.node.set(PDFName.Contents, doc.context.register(PDFRawStream.of(doc.context.obj({ Filter: 'FlateDecode' }), pako.deflate(enc.encode(str), { level: 9 }))));

// يبني محتوى الصفحة. keep(block) اختياري: الكتل النصية المحذوفة لا يبقى منها إلا ضبط الحالة (الألوان والخطوط)
// عناصر الرسم (مسارات وصور) التي تقع خارج النطاق [a, b] (بالنقاط من أعلى الصفحة): تُحذف من صفحة ذلك الجزء كي لا تتكرر في كل الأجزاء.
// مسارات القصّ تبقى دائماً، وكل ما يتقاطع مع النطاق يبقى
function cullOutside(stmts, pageH, a, b) {
  const drop = new Set(), M = 8;
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  let path = [], lo = Infinity, hi = -Infinity, clip = false;
  const dy = (x, y) => pageH - (ctm[1] * x + ctm[3] * y + ctm[5]);
  const pt = (x, y) => { const v = dy(x, y); if (v < lo) lo = v; if (v > hi) hi = v; };
  const reset = () => { path = []; lo = Infinity; hi = -Infinity; clip = false; };
  const outside = () => lo === Infinity || hi < a - M || lo > b + M;
  stmts.forEach((st, i) => {
    const n = nums(st.args);
    switch (st.op) {
      case 'q': stack.push(ctm.slice()); break;
      case 'Q': if (stack.length) ctm = stack.pop(); break;
      case 'cm': if (n.length === 6) ctm = mul(n, ctm); break;
      case 'm': case 'l': if (n.length >= 2) { path.push(i); pt(n[0], n[1]); } break;
      case 'c': if (n.length >= 6) { path.push(i); pt(n[0], n[1]); pt(n[2], n[3]); pt(n[4], n[5]); } break;
      case 'v': case 'y': if (n.length >= 4) { path.push(i); pt(n[0], n[1]); pt(n[2], n[3]); } break;
      case 're': if (n.length >= 4) { path.push(i); pt(n[0], n[1]); pt(n[0] + n[2], n[1] + n[3]); } break;
      case 'h': path.push(i); break;
      case 'W': case 'W*': clip = true; break;
      case 'f': case 'F': case 'f*': case 'S': case 's': case 'B': case 'B*': case 'b': case 'b*':
        if (!clip && path.length && outside()) { path.forEach((k) => drop.add(k)); drop.add(i); }
        reset(); break;
      case 'n': reset(); break;
      case 'Do': { lo = Infinity; hi = -Infinity; pt(0, 0); pt(1, 1); const o = outside(); lo = Infinity; hi = -Infinity; if (o) drop.add(i); break; }
      default:
    }
  });
  return drop;
}

function build(text, stmts, blocks, keep, cull, repl) {
  const { drop, before, after } = mergeSpans(stmts, blocks);
  const blockAt = new Map(blocks.map((b) => [b.from, b]));
  const parts = [];
  for (let i = 0; i < stmts.length; i++) {
    const b = blockAt.get(i);
    const gone = b && keep && !keep(b);
    if (gone) { for (let k = b.from; k <= b.to; k++) if (KEEP_IN_DROPPED.has(stmts[k].op)) parts.push(text.slice(stmts[k].s, stmts[k].e)); i = b.to; continue; }
    if (cull && cull.has(i)) continue;
    if (before.has(i)) parts.push(before.get(i));
    if (!drop.has(i)) parts.push(repl && repl.has(i) ? replaceCodes(stmts[i], repl.get(i)) : compact(text, stmts[i]));
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
  for (const t of todo) t.repl = new Map();
  remapFonts(doc, shared, todo.map((t) => ({ blocks: t.blocks, repl: t.repl })));
  for (const t of todo) setContent(doc, t.page, build(t.text, t.stmts, t.blocks, null, null, t.repl));
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
  const pb = { blocks, repl: new Map() };
  remapFonts(doc, shared, [pb]);
  const pages = ranges.map((_, i) => {
    if (i === 0) return base;
    const np = doc.addPage([base.getWidth(), base.getHeight()]);
    np.node.set(PDFName.Resources, base.node.get(PDFName.Resources));
    return np;
  });
  ranges.forEach(([a, b], i) => setContent(doc, pages[i], build(text, stmts, blocks, (blk) => blk.baseY === null || (blk.baseY >= a - 0.01 && blk.baseY < b - 0.01), cullOutside(stmts, base.getHeight(), a, b), pb.repl)));
  return doc.save();
}

export async function pageCount(bytes) {
  return (await PDFDocument.load(bytes)).getPageCount();
}
