// Export du projet en présentation PDF 16:9 (pdfkit, polices DejaVu pour les accents et symboles)
// Partagé : utilisé par le serveur local (Node) et par la démo en ligne (navigateur)
import { analyse, callSheet, fmtE, hm, fdate, fdateL, cls, DEFAULT_SETTINGS, bible, KIND, fmtMin, unavail, shotLabel, setDateLocale } from './parser.js';
import { tr, LOCALES } from './i18n.js';
import { computeBudget, CURRENCIES, money } from './budget.js';
import { shotPrompts } from './aistudio.js';
import { STAGES, POST_GROUPS, postOf, postStats } from './aipost.js';
import { isAI, isPub } from './formats.js';
import { headerCredits } from './team.js';
import { BRIEF_FIELDS, DATES as BR_DATES, APPROVALS as BR_OK } from './commercial.js';

const W = 960, H = 540, M = 44, TOP = 96, BOTTOM = H - 40;
const C = { ink: '#141418', mute: '#77777f', line: '#e3e3e8', soft: '#f4f4f6', accent: '#e0892b', gold: '#c99a4b', board: '#eef0f3', ij: '#f4f1ea', ej: '#f3dd6b', in: '#93b5ea', en: '#9dd39a' };
const EFFECT = { ij: 'INT JOUR', ej: 'EXT JOUR', in: 'INT NUIT', en: 'EXT NUIT' };
export const SECTIONS = [
  ['ppm', 'Brief et PPM'], ['cover', 'Couverture'], ['film', 'Le film'], ['chars', 'Personnages'], ['places', 'Lieux'], ['objects', 'Objets'], ['canvas', 'Vue d’ensemble du canvas'], ['mood', 'Moodboards par scène'], ['notes', 'Notes et mind maps'],
  ['palette', 'Palette de couleurs'], ['dep', 'Dépouillement'], ['art', 'Liste artistique'], ['pdt', 'Plan de travail'],
  ['dec', 'Découpage technique'], ['story', 'Storyboard des plans'], ['strip', 'Stripboard'], ['pdtc', 'Plan de travail classique'], ['fds', 'Feuilles de service'], ['bud', 'Budget'], ['post', 'Post-production IA']
];

export function buildPdfCore({ PDFDocument, fonts, readImage, lang = 'fr' }, project, sections) {
  setDateLocale(LOCALES[lang]);
  const want = new Set(sections && sections.length ? sections : SECTIONS.map(s => s[0]));
  const P = analyse(project), set = { ...DEFAULT_SETTINGS(), ...(project.settings || {}) }, edits = project.edits || {};
  const HC = headerCredits(project, lang);
  const items = (project.canvas && project.canvas.items) || [], links = (project.canvas && project.canvas.links) || [];
  const doc = new PDFDocument({ size: [W, H], margin: 0, autoFirstPage: false, bufferPages: true, info: { Title: project.name, Creator: 'GOSET.ai' } });
  doc.registerFont('R', fonts.R); doc.registerFont('B', fonts.B); doc.registerFont('T', fonts.T); doc.registerFont('H', fonts.H || fonts.R);
  doc.registerFont('I', fonts.I || fonts.T); doc.registerFont('AR', fonts.AR || fonts.R); doc.registerFont('ARB', fonts.ARB || fonts.AR || fonts.B);
  // Police courante suivie : l'arabe et quelques symboles passent par DejaVu (les polices de titre et de texte ne les ont pas)
  let curFont = 'R'; const _font = doc.font.bind(doc); doc.font = (n, ...a) => { curFont = n; return _font(n, ...a); };
  const FALL = /[؀-ۿﭐ-﷿ﹰ-﻿✓✔✕✗⚠★☆◆◇☐☑]/, fb = () => ({ B: 'ARB', T: 'ARB', R: 'AR', I: 'AR' })[curFont];
  // ---------- Langue : libellés traduits + texte arabe de droite à gauche ----------
  const T = v => { if (typeof v !== 'string' || lang === 'fr') return v; const m = v.match(/^(.*) \(suite\)$/); return m ? tr(m[1], lang) + ' (' + tr('suite', lang) + ')' : tr(v, lang); };
  const AR = /[؀-ۿﭐ-﷿ﹰ-﻿]/, NB = ' ';
  const _text = doc.text.bind(doc), _h = doc.heightOfString.bind(doc), _w = doc.widthOfString.bind(doc);
  const LTR = /(?:[0-9]+[A-Za-zÀ-ÿ]|[A-Za-zÀ-ÿ])[A-Za-zÀ-ÿ0-9.'’\-_]*(?: +(?:[0-9]+[A-Za-zÀ-ÿ]?|[A-Za-zÀ-ÿ])[A-Za-zÀ-ÿ0-9.'’\-_]*)*|[0-9]+(?:[.,:/h][0-9]+)*/g;
  const runs = line => { const out = []; let last = 0; line.replace(LTR, (m, off) => { if (off > last) out.push(line.slice(last, off)); out.push(m); last = off + m.length; return m; }); if (last < line.length) out.push(line.slice(last)); return out.map(x => x.trim()).filter(Boolean).map(x => x.replace(/ /g, NB)); };
  const lineW = line => { const r = runs(line); return r.reduce((a, t) => a + _w(t), 0) + Math.max(0, r.length - 1) * _w(NB); };
  const wrap = (str, width) => { const out = []; String(str).split('\n').forEach(par => { let cur = ''; par.split(/ +/).forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (cur && lineW(t) > width) { out.push(cur); cur = wd; } else cur = t; }); out.push(cur); }); return out; };
  doc.text = function (str, x, y, opts) {
    if (x && typeof x === 'object') { opts = x; x = undefined; y = undefined; }
    opts = opts || {}; const s0 = T(str), s = s0 == null ? '' : String(s0);
    if (curFont === 'T' || curFont === 'I') opts = { ...opts, features: ['lnum', 'kern', 'liga'] }; // chiffres alignés (08h00, pas 08hoo)
    if (!AR.test(s)) {
      if (FALL.test(s) && fb()) { const keep = curFont; _font(fb()); const r = x === undefined ? _text(s, opts) : _text(s, x, y, opts); _font(keep); return r; }
      return x === undefined ? _text(s, opts) : _text(s, x, y, opts);
    }
    const keepF = curFont; if (fb()) _font(fb());
    try {
    const X0 = x ?? doc.x, Y0 = y ?? doc.y, width = opts.width ?? (doc.page.width - X0 - 20), lh = doc.currentLineHeight(true) + (opts.lineGap || 0);
    let lines = opts.lineBreak === false ? [s.replace(/\n/g, ' ')] : wrap(s, width);
    if (opts.height) { const max = Math.max(1, Math.floor((opts.height + 1) / lh)); if (lines.length > max) { lines = lines.slice(0, max); lines[max - 1] += '…'; } }
    lines.forEach((ln, i) => {
      const lw = lineW(ln); let xr = opts.lineBreak === false && opts.width === undefined ? X0 + lw : opts.align === 'center' ? X0 + (width + lw) / 2 : X0 + width;
      runs(ln).forEach(t => { const w = _w(t); xr -= w; _text(t, xr, Y0 + i * lh, { lineBreak: false }); xr -= _w(NB); });
    });
    doc.x = X0; doc.y = Y0 + lines.length * lh; return doc;
    } finally { _font(keepF); }
  };
  doc.heightOfString = (str, opts = {}) => { const s = String(T(str) ?? ''); return AR.test(s) ? wrap(s, opts.width ?? 400).length * (doc.currentLineHeight(true) + (opts.lineGap || 0)) : _h(s, opts); };
  doc.widthOfString = (str, opts) => { const s = String(T(str) ?? ''); return AR.test(s) ? lineW(s) : _w(s, opts); };

  // ---------- Images ----------
  const imgCache = new Map();
  const img = src => {
    if (imgCache.has(src)) return imgCache.get(src);
    let out = null;
    try {
      const data = readImage(src);
      if (data) { const o = doc.openImage(data); out = { buf: data, w: o.width, h: o.height }; }
    } catch { out = null; }
    imgCache.set(src, out); return out;
  };
  function drawImg(src, x, y, w, h, mode = 'fit') {
    const im = img(src);
    if (!im) { doc.save().rect(x, y, w, h).fill('#e5e5ea').restore(); doc.font('R').fontSize(9).fillColor(C.mute).text('Image non prise en charge (WebP/GIF)', x + 6, y + h / 2 - 6, { width: w - 12, align: 'center' }); return; }
    if (mode === 'cover') {
      const r = Math.max(w / im.w, h / im.h), iw = im.w * r, ih = im.h * r;
      doc.save().rect(x, y, w, h).clip(); doc.image(im.buf, x + (w - iw) / 2, y + (h - ih) / 2, { width: iw, height: ih }); doc.restore();
    } else doc.image(im.buf, x, y, { fit: [w, h], align: 'center', valign: 'center' });
  }

  // ---------- Mise en page ----------
  const pages = { cover: false };
  function slide(title, kicker) {
    doc.addPage();
    doc.rect(0, 0, W, H).fill('#ffffff');
    // En-tête de diapositive : rubrique en capitales espacées, titre en Cormorant, filet fin
    if (kicker) doc.font('B').fontSize(7.5).fillColor(C.accent).text(T(kicker).toUpperCase(), M, 36, { characterSpacing: 2.2, lineBreak: false });
    doc.font('T').fontSize(27).fillColor(C.ink).text(title, M, 47, { width: W - 2 * M, lineBreak: false, ellipsis: true });
    doc.moveTo(M, 84).lineTo(W - M, 84).lineWidth(.6).strokeColor(C.line).stroke();
    doc.rect(M, 83.4, 34, 1.8).fill(C.ink);
    return TOP;
  }
  class Flow {
    constructor(title, kicker) { this.title = title; this.kicker = kicker; this.y = slide(title, kicker); this.n = 1; }
    ensure(h) { if (this.y + h > BOTTOM) { this.n++; this.y = slide(this.title + ' (suite)', this.kicker); return true; } return false; }
  }
  function table(flow, cols, rows, o = {}) {
    const fs_ = o.size || 9, x0 = o.x ?? M, tw = o.w ?? (W - 2 * M), pad = 5;
    const tot = cols.reduce((a, c) => a + c.w, 0), ws = cols.map(c => c.w / tot * tw);
    const head = () => {
      doc.font('B').fontSize(7.5);
      const hh = Math.max(...cols.map((c, i) => doc.heightOfString(c.h.toUpperCase(), { width: ws[i] - 2 * pad }))) + 2 * pad;
      flow.ensure(hh + 18);
      doc.font('B').fontSize(7.5);
      let x = x0; doc.rect(x0, flow.y, tw, hh).fill(C.ink);
      cols.forEach((c, i) => { doc.fillColor('#ffffff').text(c.h.toUpperCase(), x + pad, flow.y + pad, { width: ws[i] - 2 * pad, characterSpacing: .8, align: c.a || undefined }); x += ws[i]; });
      flow.y += hh;
    };
    head();
    rows.forEach(r => {
      if (r.band) {
        const bh = 20; if (flow.ensure(bh)) head();
        doc.rect(x0, flow.y, tw, bh).fill('#2a2a31'); doc.rect(x0, flow.y, 3, bh).fill(C.accent);
        doc.font('B').fontSize(8).fillColor('#fff').text(r.band, x0 + 12, flow.y + 6, { width: tw - 20, characterSpacing: .6 }); flow.y += bh; return;
      }
      const cells = cols.map(c => String(c.v(r) ?? ''));
      const hts = cells.map((t, i) => { doc.font(cols[i].b ? 'B' : 'R').fontSize(fs_); return doc.heightOfString(t || ' ', { width: ws[i] - 2 * pad }); });
      const rh = Math.max(...hts) + 2 * pad;
      if (flow.ensure(rh)) head();
      let x = x0; flow.zb = !flow.zb;
      if (r._bg) doc.rect(x0, flow.y, tw, rh).fill(r._bg); else if (flow.zb) doc.rect(x0, flow.y, tw, rh).fill('#fafafb');
      cells.forEach((t, i) => {
        const f = cols[i].fill && cols[i].fill(r);
        if (f) doc.rect(x, flow.y, ws[i], rh).fill(f);
        doc.font(cols[i].b ? 'B' : 'R').fontSize(fs_).fillColor(cols[i].color ? cols[i].color(r) : C.ink).text(t, x + pad, flow.y + pad, { width: ws[i] - 2 * pad, align: cols[i].a || undefined });
        x += ws[i];
      });
      doc.moveTo(x0, flow.y + rh).lineTo(x0 + tw, flow.y + rh).lineWidth(.5).strokeColor(C.line).stroke();
      flow.y += rh;
    });
    flow.y += 12;
  }
  const kv = (x, y, w, label, value, big) => {
    doc.font('B').fontSize(7).fillColor(C.mute).text(label.toUpperCase(), x, y, { width: w, characterSpacing: .6 });
    doc.font(big ? 'T' : 'R').fontSize(big ? 20 : 10).fillColor(value ? C.ink : '#b07a00').text(value || 'À compléter', x, y + 10, { width: w });
    return doc.y;
  };

  // ---------- Graphe du canvas ----------
  const byId = new Map(items.map(i => [i.id, i]));
  const nb = new Map(); items.forEach(i => nb.set(i.id, []));
  links.forEach(l => { if (nb.has(l.from) && nb.has(l.to)) { nb.get(l.from).push(l.to); nb.get(l.to).push(l.from); } });
  const sceneCards = items.filter(i => i.type === 'scene');
  const near = (startId, depth, pred) => {
    const seen = new Set([startId]), out = []; let front = [startId];
    for (let d = 0; d < depth; d++) {
      const nx = [];
      front.forEach(id => (nb.get(id) || []).forEach(o => { if (seen.has(o)) return; seen.add(o); const it = byId.get(o); if (!it || it.type === 'scene') return; if (pred(it)) out.push(it); nx.push(o); }));
      front = nx;
    }
    return out;
  };
  const estH = it => it.h || ({ scene: 130, note: 60, title: 50, todo: 40 + 24 * ((it.tasks || []).length), swatch: 150 }[it.type] || ((it.w || 300) * .62));
  const span = P.days.length ? `${fdateL(P.days[0].date)} → ${fdateL(P.days[P.days.length - 1].date)}` : '';
  const totalE = P.scenes.reduce((a, s) => a + s.e, 0);
  const images = items.filter(i => i.type === 'image' && i.src);
  const BB = bible(project, P);

  // ---------- Couverture ----------
  if (want.has('cover')) {
    doc.addPage(); pages.cover = true;
    doc.rect(0, 0, W, H).fill(C.ink);
    const hero = (project.cover && img(project.cover) ? { src: project.cover } : null) || images.find(i => img(i.src));
    const tx = M + 8, tw = hero ? W * .5 - M : W - 2 * M - 8;
    if (hero) { drawImg(hero.src, W * .52, 0, W * .48, H, 'cover'); doc.save().rect(W * .52, 0, 60, H).fillOpacity(.35).fill(C.ink).restore(); }
    doc.rect(M, 72, 1.5, 150).fill(C.gold);
    doc.font('B').fontSize(8.5).fillColor(C.gold).text(T('DOSSIER DE PRÉPARATION'), tx + 10, 74, { characterSpacing: 3.2 });
    doc.font('T').fontSize(52).fillColor('#ffffff').text(project.name, tx + 10, 90, { width: tw - 10, lineGap: -6 });
    let y = Math.max(doc.y + 14, 190);
    const by = HC.length ? HC : [set.prod && [T('Production'), set.prod], set.real && [T('Réalisation'), set.real]].filter(Boolean);
    if (by.length) { by.slice(0, 6).forEach(([r, n]) => { doc.font('R').fontSize(9.5).fillColor('#a1a1a6').text(r.toUpperCase(), tx + 10, y, { width: 150, characterSpacing: .6, lineBreak: false }); doc.font('B').fontSize(11.5).fillColor('#ffffff').text(n, tx + 168, y - 1.5, { width: tw - 168, lineBreak: false, ellipsis: true }); y += 18; }); y += 4; }
    if (BB.film.genres.length || BB.film.format) { doc.font('B').fontSize(8.5).fillColor(C.gold).text([BB.film.format, ...BB.film.genres].filter(Boolean).join('  ·  ').toUpperCase(), tx + 10, y, { width: tw - 10, characterSpacing: 1 }); y = doc.y + 8; }
    if (BB.film.logline) { doc.font('I').fontSize(15).fillColor('#e9e4da').text(BB.film.logline, tx + 10, y, { width: tw - 10, height: 70, ellipsis: true, lineGap: 1 }); y = doc.y + 8; }
    if (span) doc.font('R').fontSize(11).fillColor('#a1a1a6').text(T('Tournage') + ' : ' + span, tx + 10, y, { width: tw - 10 });
    const st = [[P.scenes.length, 'scènes'], [P.roles.length, 'rôles'], [new Set(P.scenes.map(s => s.dk)).size, 'décors'], [P.days.length, 'jours'], [fmtE(totalE), 'pages']];
    st.forEach(([v, l], i) => {
      const x = tx + 10 + i * Math.min(92, (tw - 10) / 5);
      doc.font('T').fontSize(30).fillColor('#ffffff').text(String(v), x, H - 124, { lineBreak: false });
      doc.font('B').fontSize(8).fillColor('#a1a1a6').text(l.toUpperCase(), x, H - 88, { characterSpacing: 1, lineBreak: false });
    });
    doc.font('R').fontSize(8).fillColor('#6e6e73').text(T('Généré le') + ' ' + new Date().toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric' }) + ' · GOSET.ai', tx + 10, H - 44);
  }

  // ---------- Publicité : brief et PPM ----------
  if (want.has('ppm') && isPub(project) && project.brief) {
    const b = project.brief, spots = Array.isArray(project.episodes) && project.episodes.length ? project.episodes : null;
    const f = new Flow(T('Brief et PPM'), T('Publicité'));
    const cw = (W - 2 * M - 30) / 2;
    let col = 0, ys = [f.y, f.y];
    BRIEF_FIELDS.forEach(([title, fields]) => {
      const rows = fields.filter(([k]) => (b[k] || '').trim()); if (!rows.length) return;
      const x = M + col * (cw + 30); let y = ys[col];
      let need = 20; rows.forEach(([k]) => { doc.font('R').fontSize(9); need += 12 + doc.heightOfString(b[k], { width: cw }); });
      if (y + need > BOTTOM) { if (ys[1 - col] + need <= BOTTOM) { col = 1 - col; } }
      const x2 = M + col * (cw + 30); y = ys[col];
      doc.font('T').fontSize(12).fillColor(C.ink).text(T(title), x2, y, { width: cw }); y += 18;
      rows.forEach(([k, l]) => { doc.font('B').fontSize(7.5).fillColor(C.mute).text(T(l).toUpperCase(), x2, y, { width: cw, characterSpacing: .5 }); y = doc.y + 1; doc.font('R').fontSize(9).fillColor(C.ink).text(b[k], x2, y, { width: cw }); y = doc.y + 6; });
      ys[col] = y + 10; col = ys[0] <= ys[1] ? 0 : 1;
    });
    const dl = (b.deliverables || []);
    if (dl.length) {
      const sn = id => { if (!spots) return T('Spot principal'); const i = spots.findIndex(x => x.id === id); return i >= 0 ? `${i + 1}. ${spots[i].name}` : T('Toute la campagne'); };
      table(new Flow(T('Livrables'), T('Publicité')), [{ h: T('Spot'), w: 22, v: d => sn(d.spot), b: 1 }, { h: T('Durée'), w: 8, v: d => d.dur + '″' }, { h: T('Format'), w: 9, v: d => d.ratio }, { h: T('Diffusion'), w: 15, v: d => T(d.media) }, { h: T('Langue'), w: 9, v: d => d.lang }, { h: T('Sous-titres'), w: 10, v: d => d.subs ? '✓' : '—' }, { h: T('À livrer le'), w: 12, v: d => d.due ? fdate(new Date(d.due + 'T12:00:00')) : '—' }], dl, { size: 9 });
    }
    const dates = BR_DATES.filter(([k]) => (b.dates || {})[k]);
    if (dates.length || BR_OK.some(([k]) => (b.ok || {})[k])) {
      const g = new Flow(T('Planning et validations'), T('Publicité'));
      let y = g.y; doc.font('T').fontSize(12).fillColor(C.ink).text(T('Planning de la campagne'), M, y); y += 20;
      dates.forEach(([k, l]) => { doc.font('R').fontSize(9.5).fillColor(C.mute).text(T(l), M, y, { width: 220 }); doc.font('B').fillColor(C.ink).text(fdate(new Date(b.dates[k] + 'T12:00:00')), M + 230, y, { width: 150 }); y += 17; });
      let y2 = g.y, x2 = M + cw + 30; doc.font('T').fontSize(12).fillColor(C.ink).text(T('Validations client'), x2, y2); y2 += 20;
      BR_OK.forEach(([k, l]) => { const on = !!(b.ok || {})[k]; doc.roundedRect(x2, y2 + 1, 10, 10, 2).lineWidth(1).strokeColor(on ? '#1f8a3b' : '#c7c7cc').stroke(); if (on) doc.moveTo(x2 + 2, y2 + 6).lineTo(x2 + 4.5, y2 + 9).lineTo(x2 + 9, y2 + 3).strokeColor('#1f8a3b').stroke(); doc.font('R').fontSize(9.5).fillColor(on ? C.ink : C.mute).text(T(l) + (on && typeof b.ok[k] === 'string' ? '  ·  ' + fdate(new Date(b.ok[k])) : ''), x2 + 18, y2, { width: cw - 18 }); y2 += 17; });
      y = Math.max(y, y2) + 30;
      if (y < BOTTOM - 60) { doc.font('B').fontSize(8).fillColor(C.mute).text(T('SIGNATURE CLIENT').toUpperCase(), M, y, { characterSpacing: 1 }); doc.text(T('SIGNATURE AGENCE').toUpperCase(), M + cw + 30, y, { characterSpacing: 1 }); doc.roundedRect(M, y + 14, cw, 50, 6).dash(3, { space: 3 }).lineWidth(.7).strokeColor('#c7c7cc').stroke(); doc.roundedRect(M + cw + 30, y + 14, cw, 50, 6).stroke().undash(); }
    }
  }
  // ---------- Le film ----------
  const F = BB.film;
  if (want.has('film') && (P.series || F.logline || F.synopsis || F.style || F.genres.length || F.format || F.duree || F.ratio)) {
    const f = new Flow('Le film', 'Bible');
    if (F.genres.length) {
      let gx = M; doc.font('B').fontSize(9);
      F.genres.forEach(g => { const w = doc.widthOfString(g.toUpperCase()) + 18; doc.roundedRect(gx, f.y, w, 18, 9).fill(C.ink); doc.fillColor('#fff').text(g.toUpperCase(), gx + 9, f.y + 5, { lineBreak: false }); gx += w + 6; });
      f.y += 30;
    }
    if (F.logline) { doc.font('T').fontSize(17); const h = doc.heightOfString(F.logline, { width: W - 2 * M }); f.ensure(h); doc.fillColor(C.ink).text(F.logline, M, f.y, { width: W - 2 * M }); f.y = doc.y + 14; }
    if (P.series) {
      f.ensure(30); doc.font('B').fontSize(7).fillColor(C.mute).text('ÉPISODES', M, f.y, { characterSpacing: .8 }); f.y += 11;
      doc.font('R').fontSize(11).fillColor(C.ink).text(P.episodes.map(e => `${e.n}. ${e.name} (${P.scenes.filter(s => s.epId === e.id).length} séq.)`).join('    ·    '), M, f.y, { width: W - 2 * M }); f.y = doc.y + 14;
    }
    const facts = [['Format', F.format], ['Durée', F.duree], ['Image', F.ratio], ['Production', set.prod], ['Réalisation', set.real]].filter(x => x[1]);
    if (facts.length) { f.ensure(40); facts.forEach(([l, v], i) => kv(M + i * 170, f.y, 160, l, v)); f.y += 40; }
    [['Synopsis', F.synopsis], ['Style visuel / ton', F.style]].forEach(([l, v]) => {
      if (!v) return; doc.font('R').fontSize(11); const h = doc.heightOfString(v, { width: W - 2 * M }); f.ensure(Math.min(h, 200) + 20);
      doc.font('B').fontSize(7).fillColor(C.mute).text(l.toUpperCase(), M, f.y, { characterSpacing: .8 });
      doc.font('R').fontSize(11).fillColor(C.ink).text(v, M, f.y + 11, { width: W - 2 * M }); f.y = doc.y + 14;
    });
  }
  // ---------- Fiches : personnages, lieux, objets ----------
  function sheets(kind, title) {
    const list = BB[kind]; if (!list.length) return;
    const v = (x, f) => BB.val(x.key, f);
    const per = 6, cols = 3, g = 14, cw = (W - 2 * M - g * (cols - 1)) / cols, ch = (BOTTOM - TOP - g) / 2;
    for (let p = 0; p < list.length; p += per) {
      slide(title + (p ? ' (suite)' : ''), 'Bible');
      list.slice(p, p + per).forEach((x, i) => {
        const cx = M + (i % cols) * (cw + g), cy = TOP + Math.floor(i / cols) * (ch + g), pw = 78;
        doc.roundedRect(cx, cy, cw, ch, 10).fill(C.soft);
        const ph = v(x, 'photo');
        if (ph && img(ph)) { doc.save().roundedRect(cx + 10, cy + 10, pw, pw + 20, 8).clip(); drawImg(ph, cx + 10, cy + 10, pw, pw + 20, 'cover'); doc.restore(); }
        else { doc.roundedRect(cx + 10, cy + 10, pw, pw + 20, 8).fill({ ch: C.ink, pl: '#0a84ff', ob: '#30d158' }[kind]); doc.font('T').fontSize(30).fillColor('#fff').text(x.name.slice(0, 1).toUpperCase(), cx + 10, cy + 40, { width: pw, align: 'center' }); }
        const tx = cx + pw + 20, tw = cw - pw - 30;
        doc.font('T').fontSize(13).fillColor(C.ink).text(x.name, tx, cy + 12, { width: tw, height: 34, ellipsis: true });
        let lines;
        if (kind === 'ch') lines = [[v(x, 'age'), v(x, 'height')].filter(Boolean).join(' · '), v(x, 'style'), v(x, 'actor') && T('Joué par') + ' ' + v(x, 'actor'), x.role && `${x.role.cat} · sc. ${x.scenes.join(', ')}`];
        else if (kind === 'pl') lines = [v(x, 'address'), [v(x, 'type') || [...(x.ie || [])].join(' / '), v(x, 'permit') && T('Autorisation') + ' : ' + v(x, 'permit')].filter(Boolean).join(' · '), v(x, 'style'), x.scenes && x.scenes.length && 'Sc. ' + x.scenes.join(', ')];
        else lines = [[v(x, 'status'), v(x, 'qty') && T('Quantité') + ' ' + v(x, 'qty')].filter(Boolean).join(' · '), v(x, 'style'), v(x, 'owner') && T('Responsable') + ' : ' + v(x, 'owner'), (x.scenes && x.scenes.length ? 'Sc. ' + x.scenes.join(', ') : v(x, 'scenes') && 'Sc. ' + v(x, 'scenes'))];
        doc.font('R').fontSize(9.5).fillColor('#3a3a3c').text(lines.filter(Boolean).join('\n'), tx, doc.y + 4, { width: tw, height: pw - 10, ellipsis: true });
        const extra = [kind === 'ch' && v(x, 'look') && T('Look') + ' : ' + v(x, 'look'), v(x, 'desc'), kind !== 'ch' && v(x, 'contact') && T('Contact') + ' : ' + v(x, 'contact'), v(x, 'notes')].filter(Boolean).join('\n');
        if (extra) doc.font('R').fontSize(9).fillColor(C.ink).text(extra, cx + 12, cy + pw + 40, { width: cw - 24, height: ch - pw - 50, ellipsis: true });
      });
    }
  }
  if (want.has('chars')) sheets('ch', 'Personnages');
  if (want.has('places')) sheets('pl', 'Lieux');
  if (want.has('objects')) sheets('ob', 'Objets');

  // ---------- Vue d'ensemble du canvas ----------
  if (want.has('canvas') && items.length) {
    slide('Vue d’ensemble', 'Canvas');
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    items.forEach(i => { const w = i.w || 240, h = estH(i); x1 = Math.min(x1, i.x); y1 = Math.min(y1, i.y); x2 = Math.max(x2, i.x + w); y2 = Math.max(y2, i.y + h); });
    const ax = M, ay = TOP, aw = W - 2 * M, ah = BOTTOM - TOP - 6;
    doc.roundedRect(ax, ay, aw, ah, 10).fill(C.board);
    const pad = 16, s = Math.min((aw - 2 * pad) / (x2 - x1 || 1), (ah - 2 * pad) / (y2 - y1 || 1), 1);
    const ox = ax + pad + ((aw - 2 * pad) - (x2 - x1) * s) / 2, oy = ay + pad + ((ah - 2 * pad) - (y2 - y1) * s) / 2;
    const X = v => ox + (v - x1) * s, Y = v => oy + (v - y1) * s;
    const txt = (t, x, y, w, size, font = 'R', color = C.ink, h) => { if (size * s < 2.6 || !t) return; doc.font(font).fontSize(size * s).fillColor(color).text(t, x, y, { width: Math.max(4, w), height: h, ellipsis: true }); };
    doc.save().rect(ax, ay, aw, ah).clip();
    links.forEach(l => {
      const a = byId.get(l.from), b = byId.get(l.to); if (!a || !b) return;
      const ca = { x: a.x + (a.w || 240) / 2, y: a.y + estH(a) / 2 }, cb = { x: b.x + (b.w || 240) / 2, y: b.y + estH(b) / 2 };
      doc.moveTo(X(ca.x), Y(ca.y)).bezierCurveTo(X((ca.x + cb.x) / 2), Y(ca.y), X((ca.x + cb.x) / 2), Y(cb.y), X(cb.x), Y(cb.y)).lineWidth(Math.max(.4, 1.6 * s)).strokeColor('#8e8e93').stroke();
    });
    items.forEach(it => {
      const x = X(it.x), y = Y(it.y), w = (it.w || 240) * s, h = estH(it) * s, r = Math.max(1, 6 * s);
      if (it.type === 'title') { txt(it.text, x, y, w, 30, 'T'); return; }
      if (it.type === 'image') { if (it.src) drawImg(it.src, x, y, w, h, 'fit'); return; }
      const fill = it.type === 'note' ? (it.color || '#ffffff') : '#ffffff';
      doc.roundedRect(x, y, w, h, r).fill(fill);
      if (it.type === 'scene') {
        const sc = P.scenes.find(z => z.k === it.sceneKey);
        if (!sc) { txt('Scène retirée', x + 8 * s, y + 8 * s, w - 16 * s, 12, 'R', C.mute); return; }
        doc.save().roundedRect(x, y, w, h, r).clip().rect(x, y, w, 26 * s).fill(C[cls(sc)]).restore();
        txt(`${sc.num}  ${sc.ie} ${sc.timeL}`, x + 8 * s, y + 7 * s, w - 16 * s, 12, 'B');
        txt(sc.decor, x + 10 * s, y + 34 * s, w - 20 * s, 12, 'B');
        txt(sc.summary, x + 10 * s, y + 52 * s, w - 20 * s, 12, 'R', '#3a3a3c', h - 56 * s);
      } else if (it.type === 'note') txt(it.text, x + 12 * s, y + 10 * s, w - 24 * s, 14, 'R', it.color === '#2c2c2e' ? '#f2f2f7' : C.ink, h - 14 * s);
      else if (it.type === 'todo') txt([it.title, ...(it.tasks || []).map(t => (t.done ? '☑ ' : '☐ ') + t.t)].join('\n'), x + 12 * s, y + 10 * s, w - 24 * s, 13, 'R', C.ink, h - 14 * s);
      else if (it.type === 'swatch') { doc.rect(x + 8 * s, y + 8 * s, w - 16 * s, 90 * s).fill(it.color || '#ff9f0a'); txt(it.label || (it.color || '').toUpperCase(), x + 8 * s, y + 104 * s, w - 16 * s, 12, 'B'); }
    });
    doc.restore();
  }

  // ---------- Moodboards ----------
  function grid(list, x, y, w, h, caption = true) {
    const n = list.length, cols = n <= 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), g = 10, capH = caption ? 14 : 0;
    const cw = (w - g * (cols - 1)) / cols, ch = (h - g * (rows - 1)) / rows;
    list.forEach((it, i) => {
      const cx = x + (i % cols) * (cw + g), cy = y + Math.floor(i / cols) * (ch + g);
      drawImg(it.src, cx, cy, cw, ch - capH, n === 1 ? 'fit' : 'cover');
      const cap = it.caption || '';
      if (caption && cap) doc.font('R').fontSize(8).fillColor(C.mute).text(cap, cx, cy + ch - capH + 3, { width: cw, height: 11, ellipsis: true });
    });
  }
  if (want.has('mood')) {
    const used = new Set();
    P.scenes.forEach(sc => {
      const card = sceneCards.find(c => c.sceneKey === sc.k); if (!card) return;
      const imgs = near(card.id, 3, i => i.type === 'image' && i.src); const notes = near(card.id, 1, i => i.type === 'note' && (i.text || '').trim());
      if (!imgs.length) return;
      imgs.forEach(i => used.add(i.id));
      for (let p = 0; p < imgs.length; p += 6) {
        slide(`Scène ${sc.num} · ${sc.decor}`, 'Moodboard' + (p ? ' (suite)' : ''));
        const lw = 250;
        doc.roundedRect(M, TOP, 92, 20, 4).fill(C[cls(sc)]);
        doc.font('B').fontSize(9).fillColor(C.ink).text(`${sc.ie} ${sc.timeL}`, M + 8, TOP + 5, { width: 80 });
        doc.font('R').fontSize(9).fillColor(C.mute).text(`J${sc.day} · ${fmtE(sc.e)} p.`, M + 102, TOP + 5);
        doc.font('R').fontSize(11).fillColor(C.ink).text(sc.actText.slice(0, 520) + (sc.actText.length > 520 ? '…' : ''), M, TOP + 34, { width: lw, height: 220, ellipsis: true });
        let y = doc.y + 12;
        if (sc.roles.length) { doc.font('B').fontSize(7).fillColor(C.mute).text('RÔLES', M, y, { characterSpacing: .8 }); doc.font('R').fontSize(10).fillColor(C.ink).text(sc.roles.map(r => r.name).join(', '), M, y + 10, { width: lw }); y = doc.y + 10; }
        if (notes.length && y < BOTTOM - 40) { doc.font('B').fontSize(7).fillColor(C.mute).text('NOTES', M, y, { characterSpacing: .8 }); doc.font('R').fontSize(9.5).fillColor('#3a3a3c').text(notes.map(n => '• ' + n.text.trim()).join('\n'), M, y + 10, { width: lw, height: BOTTOM - y - 14, ellipsis: true }); }
        grid(imgs.slice(p, p + 6), M + lw + 24, TOP, W - 2 * M - lw - 24, BOTTOM - TOP - 4);
      }
    });
    const rest = images.filter(i => !used.has(i.id));
    for (let p = 0; p < rest.length; p += 6) { slide('Moodboard général' + (p ? ' (suite)' : ''), 'Moodboard'); grid(rest.slice(p, p + 6), M, TOP, W - 2 * M, BOTTOM - TOP - 4); }
  }

  // ---------- Notes & mind maps ----------
  if (want.has('notes')) {
    const isNote = i => ['note', 'title', 'todo'].includes(i.type);
    const notes = items.filter(i => isNote(i) && (i.type === 'todo' ? (i.tasks || []).some(t => (t.t || '').trim()) : (i.text || '').trim()));
    if (notes.length) {
      const out = new Map(notes.map(n => [n.id, []])), hasIn = new Set();
      links.forEach(l => { if (out.has(l.from) && out.has(l.to)) { out.get(l.from).push(l.to); hasIn.add(l.to); } });
      const roots = notes.filter(n => !hasIn.has(n.id)).sort((a, b) => a.y - b.y || a.x - b.x);
      const flow = new Flow('Notes et idées', 'Canvas'); const colW = W - 2 * M;
      const seen = new Set();
      const walk = (n, depth) => {
        if (seen.has(n.id) || depth > 8) return; seen.add(n.id);
        const x = M + depth * 22, w = colW - depth * 22;
        if (n.type === 'title') { doc.font('T').fontSize(16); const h = doc.heightOfString(n.text, { width: w }) + 8; flow.ensure(h + 20); doc.fillColor(C.ink).text(n.text, x, flow.y + 4, { width: w }); flow.y = doc.y + 6; }
        else if (n.type === 'todo') {
          const lines = [(n.title || 'À faire'), ...(n.tasks || []).filter(t => t.t).map(t => (t.done ? '☑  ' : '☐  ') + t.t)];
          doc.font('R').fontSize(11); const h = doc.heightOfString(lines.join('\n'), { width: w }); flow.ensure(h + 8);
          doc.font('B').fillColor(C.ink).text(lines[0], x, flow.y, { width: w }); doc.font('R').fillColor('#3a3a3c').text(lines.slice(1).join('\n'), x + 6, doc.y + 2, { width: w - 6 }); flow.y = doc.y + 8;
        } else {
          doc.font(depth ? 'R' : 'B').fontSize(depth ? 11 : 12); const h = doc.heightOfString(n.text.trim(), { width: w - 14 }); flow.ensure(h + 6);
          if (n.color && n.color !== '#ffffff') doc.circle(x + 4, flow.y + 7, 3.5).fill(n.color === '#2c2c2e' ? C.ink : n.color); else doc.circle(x + 4, flow.y + 7, 2.5).fill(depth ? C.mute : C.accent);
          doc.fillColor(C.ink).text(n.text.trim(), x + 14, flow.y, { width: w - 14 }); flow.y = doc.y + 6;
        }
        (out.get(n.id) || []).map(id => byId.get(id)).filter(Boolean).sort((a, b) => a.y - b.y).forEach(c => walk(c, depth + 1));
        if (!depth) flow.y += 6;
      };
      roots.forEach(r => walk(r, 0)); notes.forEach(n => { if (!seen.has(n.id)) walk(n, 0); });
    }
  }

  // ---------- Palette ----------
  if (want.has('palette')) {
    const sw = items.filter(i => i.type === 'swatch');
    for (let p = 0; p < sw.length; p += 6) {
      slide('Palette de couleurs', 'Direction artistique');
      const list = sw.slice(p, p + 6), n = list.length, g = 16, cw = (W - 2 * M - g * (n - 1)) / n;
      list.forEach((s, i) => {
        const x = M + i * (cw + g);
        doc.roundedRect(x, TOP + 10, cw, 290, 8).fill(s.color || '#ff9f0a');
        doc.font('B').fontSize(13).fillColor(C.ink).text(s.label || 'Sans nom', x, TOP + 316, { width: cw });
        doc.font('R').fontSize(10).fillColor(C.mute).text((s.color || '').toUpperCase(), x, doc.y + 2, { width: cw });
      });
    }
  }

  const effectFill = r => C[cls(r)];
  // ---------- Dépouillement ----------
  if (want.has('dep') && P.scenes.length) {
    const lab = { fig: 'Fig.', acc: 'Acc.', cos: 'Cost.', hmc: 'HMC', veh: 'Véh.', ani: 'Anim.', casc: 'Casc.', sfx: 'SFX', son: 'Son', rem: 'Rem.' };
    const val = (s, k) => (edits['bd.' + s.k + '.' + k] ?? (s.det[k] || '')).trim();
    table(new Flow('Dépouillement', 'Production'), [
      { h: 'N°', w: 4, v: s => s.num, b: 1, fill: effectFill }, { h: 'Effet', w: 8, v: s => T(`${s.ie} ${s.timeL}`), fill: effectFill },
      { h: 'Décor', w: 14, v: s => s.decor, b: 1 }, { h: 'Résumé', w: 22, v: s => s.summary }, { h: 'Rôles', w: 13, v: s => s.roles.map(r => r.name).join(', ') },
      { h: 'Durée', w: 5, v: s => fmtE(s.e) }, { h: 'Jour', w: 4, v: s => 'J' + s.day },
      { h: 'Éléments', w: 30, v: s => Object.keys(lab).map(k => [k, val(s, k)]).filter(x => x[1]).map(([k, v]) => `${lab[k]} ${v}`).join(' · ') }
    ], P.scenes);
  }
  // ---------- Liste artistique ----------
  if (want.has('art') && P.roles.length) {
    const cs = (r, f) => edits['cs.' + r.name + '.' + f] || '—';
    const fr = x => new Date(x + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    table(new Flow('Liste artistique', 'Production'), [
      { h: 'N°', w: 4, v: r => r.id, b: 1 }, { h: 'Rôle', w: 13, v: r => r.name, b: 1 }, { h: 'Catégorie', w: 9, v: r => r.cat },
      { h: 'Comédien·ne', w: 15, v: r => edits['cast.' + r.name + '.n'] || '—' }, { h: 'Séq.', w: 4, v: r => r.all.length }, { h: 'Jours', w: 5, v: r => r.days.length },
      { h: 'Contrat', w: 7, v: r => cs(r, 'contract') }, { h: 'Costume', w: 6, v: r => cs(r, 'cos') }, { h: 'Maquil.', w: 7, v: r => cs(r, 'mak') }, { h: 'Scénario', w: 8, v: r => cs(r, 'read') },
      { h: 'Indisponible', w: 12, v: r => unavail(edits, r.name).map(u => u.to && u.to !== u.from ? fr(u.from) + '→' + fr(u.to) : fr(u.from)).join(', ') || '—', color: r => P.days.some(d => d.conflicts.includes(r.name)) ? '#c4271c' : C.ink },
      { h: 'Contact', w: 10, v: r => edits['cast.' + r.name + '.c'] || '—' }
    ], P.roles, { size: 8.5 });
  }
  // ---------- Plan de travail ----------
  if (want.has('pdt') && P.days.length) {
    const f = new Flow('Plan de travail', 'Production');
    const mv = P.days.reduce((a, d) => a + d.moves, 0), tm = P.days.reduce((a, d) => a + d.min, 0);
    [[P.days.length, 'jours'], [P.scenes.length, 'séquences'], ['≈ ' + P.quota, 'séq. / jour possibles'], [fmtMin(tm / P.days.length), 'moy. / jour'], [mv, 'déplacements']].forEach(([v, l], i) => {
      doc.font('T').fontSize(20).fillColor(C.ink).text(String(v), M + i * 150, f.y, { lineBreak: false });
      doc.font('B').fontSize(7).fillColor(C.mute).text(l.toUpperCase(), M + i * 150, f.y + 26, { characterSpacing: .8, lineBreak: false });
    });
    f.y += 50;
    table(f, [
      { h: 'Jour', w: 5, v: d => 'J' + d.n, b: 1 }, { h: 'Date', w: 9, v: d => fdate(d.date) }, { h: 'Effet', w: 7, v: d => d.mixed ? 'JOUR/NUIT' : d.night ? 'NUIT' : 'JOUR', fill: d => d.night ? C.in : C.ej },
      { h: 'Décor(s)', w: 18, v: d => [...new Set(d.sc.map(s => s.dk))].join('\n') }, { h: 'Séquences', w: 12, v: d => d.sc.map(s => s.num).join(', ') },
      { h: 'Pages', w: 5, v: d => fmtE(d.e) }, { h: 'Temps', w: 7, v: d => fmtMin(d.min) + (d.over ? ' !' : ''), color: d => d.over ? '#c4271c' : C.ink },
      { h: 'Rôles', w: 19, v: d => d.roles.map(r => r.name + (d.conflicts.includes(r.name) ? ' (indispo.)' : '')).join(', ') }, { h: 'Notes', w: 14, v: d => edits['pdt.' + d.n + '.note'] ?? (d.moves ? d.moves + ' déplacement(s)' : '') }
    ], P.days);
  }
  // ---------- Plan de travail classique : bandes verticales, format A3 paysage (modèle AFAR) ----------
  const classicPages = new Set();
  if (want.has('pdtc') && P.days.length) {
    const PW = 1190.55, PH = 841.89, m = 22, HB = 250, TOPH = 300, BOT = 54;
    const SC = { ij: '#ffffff', ej: '#ffe680', in: '#a8c8fb', en: '#a6e3a8' };
    const roles = P.roles.slice(0, 40);
    const EL = [['fig', 'Figuration'], ['cos', 'Costumes'], ['hmc', 'HMC'], ['acc', 'Accessoires'], ['veh', 'Véhicules'], ['ani', 'Animaux'], ['casc', 'Cascades'], ['sfx', 'Effets'], ['son', 'Son']];
    const elv = (sc, k) => (edits['bd.' + sc.k + '.' + k] ?? (sc.det[k] || '')).trim();
    const rowsTop = m + TOPH, rowsH = PH - m - BOT - rowsTop, rh = Math.min(16, rowsH / Math.max(1, roles.length + EL.length + 1)), elTop = rowsTop + (roles.length + 1) * rh;
    const cols = []; P.days.forEach(d => { d.sc.forEach(sc => cols.push({ sc })); cols.push({ day: d }); });
    const SW = 19, BW = 16;
    const header = () => {
      doc.addPage({ size: [PW, PH], margin: 0 }); classicPages.add(doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1);
      doc.rect(0, 0, PW, PH).fill('#ffffff');
      doc.rect(m, m, PW - 2 * m, PH - 2 * m).lineWidth(1.4).strokeColor('#1f3a8a').stroke();
      // bloc titre
      doc.rect(m, m, HB, TOPH).lineWidth(.8).strokeColor('#1f3a8a').stroke();
      let y = m + 14;
      doc.font('B').fontSize(8).fillColor('#555').text(T('PLAN DE TRAVAIL'), m + 10, y, { width: HB - 20, align: 'center', characterSpacing: 1.5 }); y += 16;
      doc.font('T').fontSize(18).fillColor('#c4271c').text(project.name.toUpperCase(), m + 10, y, { width: HB - 20, align: 'center' }); y = doc.y + 8;
      const info = [...(HC.length ? HC : [[T('Production'), set.prod], [T('Réalisation'), set.real]]), [T('Début'), fdate(P.days[0].date)], [T('Fin'), fdate(P.days[P.days.length - 1].date)], [T('Jours de tournage'), String(P.days.length)], [T('Séquences'), String(P.scenes.length)], [T('Pages'), fmtE(P.scenes.reduce((a, x) => a + x.e, 0))], [T('Édité le'), fdate(new Date())]].filter(r => r[1]);
      info.forEach(([k, v]) => { doc.font('R').fontSize(8).fillColor('#666').text(k, m + 14, y, { width: 100 }); doc.font('B').fontSize(8.5).fillColor('#111').text(v, m + 110, y - .5, { width: HB - 124 }); y += 14; });
      // légende des couleurs
      y = m + TOPH - 30; [['ij', 'INT JOUR'], ['ej', 'EXT JOUR'], ['in', 'INT NUIT'], ['en', 'EXT NUIT']].forEach(([k, l], i) => { const x = m + 12 + i * 58; doc.rect(x, y, 10, 10).fillAndStroke(SC[k], '#999'); doc.font('R').fontSize(6.5).fillColor('#333').text(T(l), x + 13, y + 2, { width: 46, lineBreak: false }); });
      // lignes des rôles
      doc.font('B').fontSize(7).fillColor('#1f3a8a').text(T('RÔLES'), m + 8, rowsTop - 12, { characterSpacing: 1 });
      roles.forEach((r, i) => {
        const yy = rowsTop + i * rh; if (i % 2) doc.rect(m, yy, PW - 2 * m, rh).fill('#f5f7fc');
        doc.font('B').fontSize(Math.min(8, rh - 4)).fillColor('#111').text(`${r.id}.`, m + 6, yy + (rh - 8) / 2 + .5, { width: 18, align: 'right', lineBreak: false });
        doc.font('R').text(r.name, m + 28, yy + (rh - 8) / 2 + .5, { width: HB - 36, lineBreak: false, ellipsis: true });
      });
      doc.font('B').fontSize(7).fillColor('#1f3a8a').text(T('ÉLÉMENTS'), m + 8, elTop - rh + (rh - 7) / 2, { characterSpacing: 1 });
      EL.forEach(([k, l], i) => { const yy = elTop + i * rh; if (i % 2) doc.rect(m, yy, PW - 2 * m, rh).fill('#f7f5ee'); doc.font('R').fontSize(Math.min(8, rh - 4)).fillColor('#333').text(T(l), m + 28, yy + (rh - 8) / 2 + .5, { width: HB - 36, lineBreak: false }); });
      doc.moveTo(m, elTop - rh).lineTo(PW - m, elTop - rh).lineWidth(.5).strokeColor('#b9c2dd').stroke();
      doc.moveTo(m, rowsTop).lineTo(PW - m, rowsTop).lineWidth(.8).strokeColor('#1f3a8a').stroke();
      doc.moveTo(m, PH - m - BOT).lineTo(PW - m, PH - m - BOT).stroke();
      doc.moveTo(m + HB, m).lineTo(m + HB, PH - m).stroke();
      doc.font('B').fontSize(7).fillColor('#1f3a8a').text(T('PAGES'), m + 8, PH - m - BOT + 8, { characterSpacing: 1 }); doc.text(T('TEMPS ESTIMÉ'), m + 8, PH - m - BOT + 30, { characterSpacing: 1 });
      return m + HB;
    };
    let x = header(), pageNo = 1;
    const vtext = (str, cx, top, len, size, font = 'R', color = '#111') => {
      doc.save(); doc.translate(cx, top + len); doc.rotate(-90); doc.font(font).fontSize(size).fillColor(color).text(String(str), 0, -size / 2 - 1, { width: len, lineBreak: false, ellipsis: true }); doc.restore();
    };
    cols.forEach(c => {
      const w = c.day ? BW : SW;
      if (x + w > PW - m) { x = header(); pageNo++; }
      if (c.day) {
        doc.rect(x, m, w, PH - 2 * m).fill('#1f3a8a');
        vtext(`${T('FIN DU JOUR')} ${c.day.n}  ·  ${fdate(c.day.date)}  ·  ${c.day.sc.length} ${T('séq.')}  ·  ${fmtE(c.day.e)} p.  ·  ${fmtMin(c.day.min)}`, x + w / 2, m + 6, PH - 2 * m - 12, 7.5, 'B', '#ffffff');
      } else {
        const sc = c.sc, k = cls(sc);
        doc.rect(x, m, w, PH - 2 * m).fill(SC[k] || '#fff');
        doc.rect(x, m, w, PH - 2 * m).lineWidth(.4).strokeColor('#8a94b8').stroke();
        // en-tête de bande : numéro, effet, décor, résumé (texte vertical)
        doc.font('B').fontSize(8).fillColor('#111').text(String(sc.num), x, m + 4, { width: w, align: 'center', lineBreak: false });
        vtext(`${sc.ie} ${T(sc.timeL)}  —  ${sc.decor}`, x + w / 2 - 4, m + 18, TOPH - 24, 6.6, 'B');
        vtext(sc.summary || '', x + w / 2 + 4.5, m + 18, TOPH - 24, 6, 'R', '#333');
        EL.forEach(([k], i) => { if (elv(sc, k)) { const yy = elTop + i * rh; doc.circle(x + w / 2, yy + rh / 2, Math.min(3, rh / 4)).fill('#111'); } });
        roles.forEach((r, i) => { if (sc.roles.includes(r)) { const yy = rowsTop + i * rh; doc.font('B').fontSize(Math.min(7.5, rh - 4)).fillColor('#111').text(String(r.id), x, yy + (rh - 7.5) / 2 + .5, { width: w, align: 'center', lineBreak: false }); } });
        vtext(fmtE(sc.e), x + w / 2, PH - m - BOT + 4, 20, 6.5, 'B');
        vtext(fmtMin(sc.est), x + w / 2, PH - m - BOT + 27, 24, 6, 'R', '#333');
      }
      x += w;
    });
  }
  // ---------- Découpage technique ----------
  const SH = project.shots || {};
  const withShots = P.scenes.filter(sc => (SH[sc.k] || []).length);
  if (want.has('dec') && withShots.length) {
    const rows = [];
    withShots.forEach(sc => { rows.push({ band: `${T('Sc.')} ${sc.num} · ${T(sc.ie + ' ' + sc.timeL)} · ${sc.decor} · ${(SH[sc.k] || []).length} ${T('Plans')}`.toUpperCase() }); (SH[sc.k] || []).forEach((x, i) => rows.push({ ...x, lab: shotLabel(sc, i) })); });
    table(new Flow('Découpage technique', 'Mise en scène'), [
      { h: 'Plan', w: 5, v: x => x.lab, b: 1 }, { h: 'Valeur', w: 11, v: x => x.size }, { h: 'Angle', w: 9, v: x => x.angle }, { h: 'Mouvement', w: 11, v: x => x.move },
      { h: 'Objectif', w: 7, v: x => x.lens }, { h: 'Action / description', w: 35, v: x => x.desc }, { h: 'Son / dialogue', w: 16, v: x => x.sound }, { h: 'Durée', w: 6, v: x => x.dur ? x.dur + ' s' : '' }
    ], rows, { size: 8.5 });
  }
  if (want.has('story')) {
    // Planche de storyboard : 6 cases par page, en-tête Scène / Plan / Format, valeur de plan en marge, légende manuscrite
    const frames = []; withShots.forEach(sc => (SH[sc.k] || []).forEach((x, i) => frames.push({ x, lab: shotLabel(sc, i), sc })));
    const ratio = set.ratio || '16:9', hand = t => AR.test(t || '') ? 'R' : 'H';
    for (let p0 = 0, pg = 1; p0 < frames.length; p0 += 6, pg++) {
      doc.addPage(); doc.rect(0, 0, W, H).fill('#ffffff');
      doc.font('T').fontSize(28).fillColor(C.ink).text(T('Storyboard').toUpperCase(), M, 26, { lineBreak: false, characterSpacing: 1 });
      const meta = (lab, val, xr, w) => { doc.font('B').fontSize(9).fillColor(C.ink).text(T(lab).toUpperCase() + ' :', xr - w - 70, 44, { width: 66, align: 'right', lineBreak: false }); doc.font(hand(val)).fontSize(17).fillColor(C.ink).text(val, xr - w, 36, { width: w, align: 'center', lineBreak: false, height: 20, ellipsis: true }); doc.moveTo(xr - w, 58).lineTo(xr, 58).lineWidth(.8).strokeColor(C.ink).stroke(); };
      meta('Page', String(pg), W - M, 40); meta('Projet', project.name, W - M - 130, 230);
      doc.moveTo(M, 70).lineTo(W - M, 70).lineWidth(1.6).strokeColor(C.ink).stroke();
      const g = 26, cw = (W - 2 * M - 2 * g) / 3, side = 16, iw = cw - side, ih = iw * 9 / 16, ch = 22;
      frames.slice(p0, p0 + 6).forEach((f, i) => {
        const x0 = M + (i % 3) * (cw + g), x = x0 + side, y = 84 + Math.floor(i / 3) * (ch + ih + 52);
        doc.lineWidth(1).strokeColor(C.ink);
        doc.rect(x, y, iw, ch).stroke(); [1, 2].forEach(k => doc.moveTo(x + iw * k / 3, y).lineTo(x + iw * k / 3, y + ch).stroke());
        [['Scène', f.sc.num], ['Plan', f.lab], ['Format', ratio]].forEach(([l, v], k) => {
          doc.font('B').fontSize(5.5).fillColor(C.mute).text(T(l).toUpperCase(), x + iw * k / 3, y + 2.5, { width: iw / 3, align: 'center', lineBreak: false });
          doc.font('H').fontSize(12).fillColor(C.ink).text(String(v), x + iw * k / 3, y + 8, { width: iw / 3, align: 'center', lineBreak: false });
        });
        const yi = y + ch;
        if (f.x.img) drawImg(f.x.img, x, yi, iw, ih, 'cover');
        doc.rect(x, yi, iw, ih).lineWidth(1).strokeColor(C.ink).stroke();
        if (f.x.size) { const sz = T(f.x.size); doc.save(); doc.rotate(-90, { origin: [x0, yi + ih] }); doc.font(hand(sz)).fontSize(11).fillColor('#333').text(sz, x0, yi + ih + 1, { width: ih, align: 'center', lineBreak: false }); doc.restore(); }
        if (f.x.move && f.x.move !== 'Fixe') { const mv = T(f.x.move) + ' →'; doc.font(hand(mv)).fontSize(11); const mw = doc.widthOfString(mv) + 8; doc.save().rect(x + iw - mw - 4, yi + 4, mw, 15).fill('#ffffff').restore(); doc.fillColor(C.ink).text(mv, x + iw - mw, yi + 5, { lineBreak: false }); }
        const yc = yi + ih + 4;
        [1, 2].forEach(k => doc.moveTo(x, yc + k * 16).lineTo(x + iw, yc + k * 16).lineWidth(.6).strokeColor('#333').stroke());
        const cap = [f.x.desc, [f.x.angle && T(f.x.angle), f.x.lens, f.x.dur ? f.x.dur + ' s' : ''].filter(Boolean).join(' · ')].filter(Boolean).join(' — ');
        if (cap) doc.font(hand(cap)).fontSize(12).fillColor(C.ink).text(cap, x + 1, yc + 1, { width: iw - 2, height: 32, lineGap: 1.2, ellipsis: true });
      });
    }
  }
  // ---------- Stripboard ----------
  if (want.has('strip') && P.days.length) {
    const rows = []; P.days.forEach(d => { d.sc.forEach(s => rows.push(s)); rows.push({ band: `${T('Fin du jour')} ${d.n} · ${fdate(d.date)} · ${d.sc.length} ${T('Séq.')} · ${fmtMin(d.min)}`.toUpperCase() }); });
    table(new Flow('Stripboard', 'Production'), [
      { h: 'N°', w: 5, v: s => s.num, b: 1 }, { h: 'Effet', w: 9, v: s => T(`${s.ie} ${s.timeL}`) }, { h: 'Décor', w: 19, v: s => s.decor, b: 1 },
      { h: 'Résumé', w: 34, v: s => s.summary }, { h: 'Rôles', w: 9, v: s => s.roles.map(r => r.id).join(' · ') }, { h: 'Pages', w: 5, v: s => fmtE(s.e) }, { h: 'Temps', w: 6, v: s => fmtMin(s.est) }
    ], rows.map(r => r.band ? r : Object.assign(Object.create(r), { _bg: C[cls(r)] })), { size: 9 });
  }
  // ---------- Budget ----------
  if (want.has('bud') && P.scenes.length) {
    const B = computeBudget(project, P), b = B.b, loc = LOCALES[lang] || 'fr-FR', m = (v, c = b.cur) => money(v, c, loc);
    const inMain = tnd => b.cur === 'TND' ? tnd : (+b.fx[b.cur] > 0 ? tnd / +b.fx[b.cur] : null);
    const pc = v => B.totalTND ? Math.round(v / B.totalTND * 100) + ' %' : '—';
    const rows = B.cats.map(c => ({ l: T(c.label), v: m(inMain(c.totTND)), p: pc(c.totTND) }));
    rows.push({ l: T('Sous-total'), v: m(B.sub[b.cur]), p: pc(B.subTND), _bg: C.soft }, { l: `${T('Imprévus')} (${+b.cont || 0} %)`, v: m(B.cont[b.cur]), p: pc(B.contTND) });
    CURRENCIES.forEach(c => rows.push({ l: `${T('Total')} ${c}`, v: B.total[c] != null ? m(B.total[c], c) : T('taux à saisir'), p: c === b.cur ? '100 %' : '', _bg: c === b.cur ? '#fff1dc' : null }));
    const f = new Flow('Budget', 'Production');
    doc.font('B').fontSize(9).fillColor(C.mute).text(`${B.ai ? B.shots + ' ' + T('plans') : B.days + ' ' + T('jours de tournage')} · ${T('Devise principale')} : ${b.cur}${CURRENCIES.filter(c => c !== 'TND' && +b.fx[c] > 0).map(c => ` · 1 ${c} = ${b.fx[c]} TND`).join('')}`, M, f.y, { width: W - 2 * M }); f.y += 20;
    table(f, [{ h: T('Poste'), w: 30, v: r => r.l, b: 1 }, { h: b.cur, w: 12, v: r => r.v, a: 'right' }, { h: '%', w: 6, v: r => r.p, a: 'right' }], rows, { size: 9.5, w: 520 });
    const det = []; B.cats.forEach(c => { if (!c.rows.some(r => r.qty || r.rate)) return; det.push({ band: T(c.label).toUpperCase() + '  ·  ' + m(inMain(c.totTND)) }); c.rows.filter(r => r.qty || r.rate).forEach(r => det.push(r)); });
    if (det.length) table(new Flow(T('Budget détaillé'), 'Production'), [
      { h: T('Ligne'), w: 26, v: r => r.auto && (r.key === 'int.fig' || !/^(int|lieux)\./.test(r.key)) ? T(r.label) : r.label, b: 1 }, { h: T('Qté'), w: 6, v: r => r.qty, a: 'right' }, { h: T('Unité'), w: 9, v: r => T(r.unit) },
      { h: T('Tarif'), w: 11, v: r => r.rate ? m(r.rate, r.c) : '—', a: 'right' }, { h: T('Total'), w: 12, v: r => r.tot ? m(r.tot, r.c) : '—', a: 'right' }, { h: b.cur, w: 12, v: r => r.tot ? m(r.totMain) : '—', a: 'right', b: 1 }
    ], det, { size: 8.5 });
  }
  // ---------- Post-production IA ----------
  if (want.has('post') && isAI(project) && P.scenes.length) {
    const a = project.ai || {}, list = shotPrompts(project, P), pp = postOf(a), S = postStats(a, list);
    const f = new Flow('Post-production IA', 'Studio IA');
    doc.font('B').fontSize(9).fillColor(C.mute).text(`${S.pct} % · ${S.valid}/${S.n} ${T('validés')} · ${pp.res} · ${pp.fps} i/s · ${pp.loud} LUFS`, M, f.y, { width: W - 2 * M }); f.y += 20;
    table(f, [{ h: T('Plan'), w: 8, v: x => x.label, b: 1 }, { h: T('Décor'), w: 20, v: x => x.s.decor }, { h: T('Étape'), w: 14, v: x => T((pp.st[x.key] || {}).stage || STAGES[0]), b: 1, color: x => ((pp.st[x.key] || {}).stage === STAGES[STAGES.length - 1] ? '#1f8a3b' : C.ink) },
      { h: T('Outil / modèle'), w: 16, v: x => (pp.st[x.key] || {}).tool || '' }, { h: T('Seed / version'), w: 12, v: x => (pp.st[x.key] || {}).seed || '' }, { h: T('Note'), w: 30, v: x => (pp.st[x.key] || {}).note || '' }], list, { size: 8.5 });
    const g = new Flow(T('Finitions, son, livrables et transparence'), 'Studio IA'), cw = (W - 2 * M - 30) / 2;
    let rowY = g.y, maxY = g.y;
    POST_GROUPS.forEach(([id, title, items], gi) => {
      if (gi === 2) rowY = maxY + 12;
      const x = M + (gi % 2) * (cw + 30);
      let y = rowY; doc.font('B').fontSize(10.5).fillColor(C.ink).text(T(title), x, y, { width: cw }); y += 18;
      items.forEach(([k, l]) => { const on = !!pp.chk[k]; doc.roundedRect(x, y + 1, 9, 9, 2).lineWidth(1).strokeColor(on ? '#1f8a3b' : '#c7c7cc').stroke(); if (on) doc.moveTo(x + 2, y + 6).lineTo(x + 4, y + 8).lineTo(x + 8, y + 3).strokeColor('#1f8a3b').stroke(); doc.font('R').fontSize(8.6).fillColor(on ? C.ink : C.mute).text(T(l), x + 16, y, { width: cw - 16 }); y = doc.y + 4; });
      maxY = Math.max(maxY, y);
    });
  }
  // ---------- Feuilles de service ----------
  if (want.has('fds')) P.days.forEach((_, i) => {
    const cs = callSheet(P, project, i), d = cs.d;
    const f = new Flow(`Feuille de service · J${d.n}/${P.days.length}`, fdateL(d.date));
    if (d.conflicts.length) { doc.roundedRect(M, f.y - 6, W - 2 * M, 20, 5).fill('#fff1f0'); doc.font('B').fontSize(9).fillColor('#c4271c').text(T('Indisponible ce jour') + ' : ' + d.conflicts.join(', '), M + 8, f.y - 1, { width: W - 2 * M - 16 }); f.y += 22; }
    const cw = (W - 2 * M) / 4;
    doc.font('T').fontSize(26).fillColor(C.ink).text(hm(cs.pat), M, f.y, { lineBreak: false });
    doc.font('B').fontSize(7).fillColor(C.mute).text((T('PAT') + ' · ' + T(d.night ? 'Tournage de nuit' : 'Tournage de jour')).toUpperCase(), M, f.y + 32, { characterSpacing: .8 });
    kv(M + cw, f.y, cw - 12, 'Fin prévue', hm(cs.end));
    kv(M + cw * 2, f.y, cw - 12, 'Météo', edits['fds.' + d.n + '.meteo']);
    kv(M + cw * 3, f.y, cw - 12, 'Soleil', edits['fds.' + d.n + '.sun']);
    f.y += 52;
    let yy = f.y;
    cs.decors.forEach((dc, j) => { const x = M + (j % 4) * cw; if (j && j % 4 === 0) yy = doc.y + 6; kv(x, yy, cw - 12, 'Décor · ' + dc.k, [dc.addr, dc.park].filter(Boolean).join(' · ')); });
    const ex = M + (cs.decors.length % 4) * cw;
    if (cs.decors.length % 4) kv(ex, yy, cw - 12, 'Hôpital le plus proche', edits['fds.hosp']);
    f.y = Math.max(doc.y, yy + 30) + 12;
    table(f, [
      { h: 'Heure', w: 6, v: r => r.atL || hm(r.at), b: 1 }, { h: 'Sc.', w: 4, v: r => r.s ? r.s.num : '', b: 1 }, { h: 'Effet', w: 9, v: r => r.s ? T(`${r.s.ie} ${r.s.timeL}`) : '', fill: r => r.s ? C[cls(r.s)] : null },
      { h: 'Décor / étape', w: 22, v: r => r.s ? r.s.decor : r.label }, { h: 'Résumé', w: 37, v: r => r.s ? r.s.summary : '' }, { h: 'Rôles', w: 8, v: r => r.s ? r.s.roles.map(x => x.id).join(', ') : '' }, { h: 'Pages', w: 5, v: r => r.s ? fmtE(r.s.e) : '' }
    ], cs.rows.map(r => r.s ? r : { ...r, _bg: C.soft }), { size: 9 });
    table(f, [
      { h: 'ID', w: 4, v: c => c.r.id, b: 1 }, { h: 'Rôle', w: 16, v: c => c.r.name, b: 1 }, { h: 'Comédien·ne', w: 22, v: c => c.actor || 'À compléter', color: c => c.actor ? C.ink : '#b07a00' },
      { h: 'Arrivée', w: 9, v: c => c.arriveL }, { h: 'HMC', w: 9, v: c => c.hmcL }, { h: 'Prêt plateau', w: 10, v: c => c.readyL, b: 1 }, { h: 'Scènes', w: 20, v: c => c.scenes.join(', ') }
    ], cs.cast, { size: 9 });
    if (cs.fig.length) table(f, [{ h: 'Figuration', w: 10, v: x => T('Sc.') + ' ' + x.s.num, b: 1 }, { h: 'Description', w: 50, v: x => x.text }, { h: 'Nombre · convocation', w: 40, v: x => x.note || 'À compléter' }], cs.fig);
    if (cs.needs.length) table(f, [{ h: 'Besoins', w: 18, v: x => x[1], b: 1 }, { h: 'Détail', w: 82, v: x => x[2] }], cs.needs);
    // Équipe (gauche) + contacts et lendemain (droite), sur la même hauteur
    f.ensure(150);
    const half = (W - 2 * M) / 2, rx = M + half + 24, rw = half - 24, y0 = f.y, nx = cs.next;
    let ry = y0;
    [['Production', edits['fds.cProd']], ['Régie', edits['fds.cReg']], ['1er assistant', edits['fds.c1er']]].forEach(([l, v]) => { ry = kv(rx, ry, rw, l, v) + 6; });
    doc.font('B').fontSize(7).fillColor(C.mute).text('PRÉVISIONS DU LENDEMAIN', rx, ry + 2, { characterSpacing: .6 });
    doc.font('R').fontSize(10).fillColor(C.ink).text(nx ? `J${nx.n} · ${fdateL(nx.date)} · ${nx.night ? 'NUIT' : 'JOUR'} · ${[...new Set(nx.sc.map(s => s.dk))].join(', ')} · Sc. ${nx.sc.map(s => s.num).join(', ')}` : 'Dernier jour de tournage.', rx, ry + 12, { width: rw });
    const rEnd = doc.y;
    f.y = y0;
    table(f, [{ h: 'Équipe', w: 45, v: x => x[0], b: 1 }, { h: 'Convocation', w: 55, v: x => x[1] }], cs.crew, { w: half });
    f.y = Math.max(f.y, rEnd + 12);
    const rem = edits['fds.' + d.n + '.rem'];
    if (rem) { f.ensure(40); doc.font('B').fontSize(7).fillColor(C.mute).text('REMARQUES', M, f.y); doc.font('R').fontSize(10).fillColor(C.ink).text(rem, M, f.y + 10, { width: W - 2 * M }); f.y = doc.y + 10; }
  });

  if (!doc.bufferedPageRange().count) { slide(project.name, 'Projet vide'); doc.font('R').fontSize(14).fillColor(C.mute).text('Ajoutez un scénario ou des éléments au canvas pour remplir cette présentation.', M, TOP + 20, { width: W - 2 * M }); }

  // ---------- Pieds de page ----------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    if (i === 0 && pages.cover) continue;
    doc.switchToPage(i);
    if (classicPages.has(i)) { doc.font('R').fontSize(7).fillColor('#666'); doc.text(`${project.name} · ${i + 1} / ${range.count}`, 22, doc.page.height - 16, { width: 400, lineBreak: false }); continue; }
    // En-tête : production, réalisation et équipe principale (onglet Équipe)
    if (HC.length) {
      let x = W - M; const y = 16; doc.fontSize(7.5);
      [...HC].reverse().forEach(([r, n], j) => {
        doc.font('B'); const wn = doc.widthOfString(n); doc.font('R'); const wr = doc.widthOfString(r + ' ');
        if (x - wn - wr < M + 160) return;
        doc.font('B').fillColor(C.ink).text(n, x - wn, y, { lineBreak: false }); doc.font('R').fillColor(C.mute).text(r + ' ', x - wn - wr, y, { lineBreak: false });
        x -= wn + wr + 14; if (j < HC.length - 1) doc.circle(x + 7, y + 4, 1).fill(C.mute);
      });
      doc.font('B').fontSize(7.5).fillColor(C.mute).text(project.name.toUpperCase(), M, 16, { width: 150, lineBreak: false, ellipsis: true, characterSpacing: .6 });
    }
    doc.moveTo(M, H - 34).lineTo(W - M, H - 34).lineWidth(.5).strokeColor(C.line).stroke();
    doc.font('I').fontSize(10).fillColor(C.mute).text(project.name, M, H - 27, { width: 400, lineBreak: false, ellipsis: true });
    doc.font('B').fontSize(7).fillColor(C.mute).text(`${String(i + 1).padStart(2, '0')}  /  ${String(range.count).padStart(2, '0')}`, W - M - 100, H - 25, { width: 100, align: 'right', lineBreak: false, characterSpacing: 1 });
  }
  doc.end();
  setDateLocale(LOCALES.fr);
  return doc;
}
