// Facture / devis / pro forma en PDF A4 (pdfkit). Partagé navigateur (démo et app locale).
import { invTotals, amountWords, DEC } from './invoice-calc.js';

const L = {
  fr: { facture: 'FACTURE', devis: 'DEVIS', proforma: 'FACTURE PRO FORMA', avoir: 'AVOIR', no: 'N°', date: 'Date', due: 'Échéance', valid: 'Valable jusqu’au', to: 'Facturé à', toQ: 'Client', project: 'Projet', desc: 'Désignation', qty: 'Qté', pu: 'P.U. HT', tot: 'Total HT', ht: 'Total HT', vat: 'TVA', ttc: 'Total TTC', stamp: 'Droit de timbre', wh: 'Retenue à la source', net: 'Net à payer', words: 'Arrêté(e) la présente {d} à la somme de :', wf: 'facture', wd: 'devis', wp: 'facture pro forma', wa: 'facture d’avoir', fx: 'Taux de change appliqué', cv: 'Contre-valeur', pay: 'Conditions de paiement', bank: 'Banque', rib: 'RIB / IBAN', sign: 'Cachet et signature', ok: 'Bon pour accord (date, signature du client)', mf: 'MF', rne: 'RNE', tel: 'Tél.', page: 'Page', notes: 'Notes', tva0: 'Exonéré de TVA' },
  en: { facture: 'INVOICE', devis: 'QUOTE', proforma: 'PRO FORMA INVOICE', avoir: 'CREDIT NOTE', no: 'No.', date: 'Date', due: 'Due date', valid: 'Valid until', to: 'Bill to', toQ: 'Client', project: 'Project', desc: 'Description', qty: 'Qty', pu: 'Unit price', tot: 'Amount', ht: 'Subtotal (excl. tax)', vat: 'VAT', ttc: 'Total incl. tax', stamp: 'Stamp duty', wh: 'Withholding tax', net: 'Amount due', words: 'This {d} is set at the sum of:', wf: 'invoice', wd: 'quote', wp: 'pro forma invoice', wa: 'credit note', fx: 'Exchange rate applied', cv: 'Equivalent', pay: 'Payment terms', bank: 'Bank', rib: 'IBAN / RIB', sign: 'Stamp and signature', ok: 'Approved (date, client signature)', mf: 'Tax ID', rne: 'Reg. no.', tel: 'Tel.', page: 'Page', notes: 'Notes', tva0: 'VAT exempt' }
};

export function buildInvoicePdf({ PDFDocument, fonts }, inv, issuer, project) {
  const lang = inv.lang === 'en' ? 'en' : 'fr', t = L[lang], cur = inv.cur || 'TND', d = DEC[cur] ?? 2;
  const loc = lang === 'en' ? 'en-GB' : 'fr-FR';
  const nf = (v, dec = d) => new Intl.NumberFormat(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v || 0);
  const m = v => nf(v) + ' ' + cur;
  const T = invTotals(inv);
  const W = 595.28, H = 841.89, M = 42, ink = '#1d1d1f', mute = '#6e6e73', line = '#e3e3e8', soft = '#f6f6f8', acc = issuer.accent || '#ff7a1a';
  const title = t[inv.type] || t.facture;
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, bufferPages: true, info: { Title: `${title} ${inv.num || ''}`.trim(), Author: issuer.name || '', Creator: 'GOSET.ai' } });
  doc.registerFont('R', fonts.R); doc.registerFont('B', fonts.B); doc.registerFont('T', fonts.T);
  doc.registerFont('AR', fonts.AR || fonts.R); doc.registerFont('ARB', fonts.ARB || fonts.B);
  // Chiffres alignés pour la police de titre ; arabe et symboles avec DejaVu
  { let cur = 'R'; const _f = doc.font.bind(doc), _t = doc.text.bind(doc), FB = /[؀-ۿﭐ-﷿ﹰ-﻿✓✔⚠]/;
    doc.font = (n, ...a) => { cur = n; return _f(n, ...a); };
    doc.text = (s, x, y, o) => { if (x && typeof x === 'object') { o = x; x = undefined; } o = o || {}; if (cur === 'T') o = { ...o, features: ['lnum', 'kern'] };
      const alt = FB.test(String(s ?? '')) ? (cur === 'R' ? 'AR' : 'ARB') : null; if (alt) _f(alt);
      const r = x === undefined ? _t(s, o) : _t(s, x, y, o); if (alt) _f(cur); return r; }; }
  const fmtD = s => { if (!s) return ''; const x = new Date(s + 'T12:00:00'); return isNaN(x) ? s : x.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const img = (src, x, y, w, h, align = 'left') => { if (!src || !/^data:image\/(png|jpe?g);base64,/.test(src)) return 0; try { const o = doc.openImage(src), k = Math.min(w / o.width, h / o.height, 1), iw = o.width * k, ih = o.height * k; doc.image(o, align === 'right' ? x + w - iw : align === 'center' ? x + (w - iw) / 2 : x, y + (h - ih) / 2, { width: iw, height: ih }); return iw; } catch (e) { return 0; } };

  let y;
  const newPage = first => {
    doc.addPage({ size: 'A4', margin: 0 });
    doc.rect(0, 0, W, 5).fill(acc);
    y = first ? M : M + 10;
  };
  newPage(true);

  // ---------- En-tête : logo + émetteur à gauche, titre à droite ----------
  const lw = img(issuer.logo, M, y, 170, 62);
  let iy = y + (lw ? 72 : 0);
  if (!lw && issuer.name) { doc.font('T').fontSize(17).fillColor(ink).text(issuer.name, M, iy, { width: 260 }); iy = doc.y + 4; }
  else if (issuer.name) { doc.font('B').fontSize(10.5).fillColor(ink).text(issuer.name, M, iy, { width: 260 }); iy = doc.y + 1; }
  doc.font('R').fontSize(8.6).fillColor(mute);
  [issuer.addr, [issuer.mf && `${t.mf} : ${issuer.mf}`, issuer.rne && `${t.rne} : ${issuer.rne}`].filter(Boolean).join('  ·  '), [issuer.tel && `${t.tel} ${issuer.tel}`, issuer.email, issuer.web].filter(Boolean).join('  ·  ')]
    .filter(Boolean).forEach(s => { doc.text(s, M, iy, { width: 270, lineGap: 1 }); iy = doc.y + 1; });

  const rx = W - M - 220;
  doc.font('T').fontSize(inv.type === 'proforma' ? 19 : 25).fillColor(ink).text(title, rx, y, { width: 220, align: 'right' });
  let ry = doc.y + 8;
  const meta = [[t.no, inv.num], [t.date, fmtD(inv.date)], [inv.type === 'devis' ? t.valid : t.due, fmtD(inv.due)]].filter(r => r[1]);
  meta.forEach(([k, v]) => { doc.font('R').fontSize(8.6).fillColor(mute).text(k, rx, ry, { width: 100 }); doc.font('B').fontSize(9.5).fillColor(ink).text(v, rx + 90, ry - 1, { width: 130, align: 'right' }); ry += 16; });

  // ---------- Client ----------
  y = Math.max(iy, ry) + 16;
  const c = inv.client || {}, cw = 250, cx = W - M - cw;
  const cl = [[c.addr, 'R', 9], [[c.mf && `${t.mf} : ${c.mf}`, c.email].filter(Boolean).join('  ·  '), 'R', 8.6]].filter(r => r[0]);
  doc.font('B').fontSize(10.5); let ch = 30 + doc.heightOfString(c.name || '—', { width: cw - 28 });
  cl.forEach(([s, f, z]) => { doc.font(f).fontSize(z); ch += doc.heightOfString(s, { width: cw - 28 }) + 2; });
  doc.roundedRect(cx, y, cw, ch + 6, 8).fill(soft);
  doc.font('B').fontSize(7.2).fillColor(acc).text((inv.type === 'devis' ? t.toQ : t.to).toUpperCase(), cx + 14, y + 11, { characterSpacing: 1 });
  doc.font('B').fontSize(10.5).fillColor(ink).text(c.name || '—', cx + 14, y + 25, { width: cw - 28 });
  cl.forEach(([s, f, z]) => { doc.font(f).fontSize(z).fillColor(f === 'R' ? '#3a3a3c' : ink).text(s, cx + 14, doc.y + 2, { width: cw - 28 }); });
  if (inv.ref || project?.name) {
    doc.font('B').fontSize(7.2).fillColor(mute).text(t.project.toUpperCase(), M, y + 11, { characterSpacing: 1 });
    doc.font('B').fontSize(11).fillColor(ink).text(inv.ref || project.name, M, y + 25, { width: cx - M - 20 });
  }
  y += ch + 26;

  // ---------- Lignes ----------
  const cols = [{ k: 'desc', w: 0.52, a: 'left' }, { k: 'qty', w: 0.1, a: 'right' }, { k: 'pu', w: 0.18, a: 'right' }, { k: 'tot', w: 0.2, a: 'right' }];
  const TW = W - 2 * M; let cxs = M; cols.forEach(o => { o.x = cxs; o.ww = o.w * TW; cxs += o.ww; });
  const head = () => {
    doc.roundedRect(M, y, TW, 22, 5).fill(ink);
    cols.forEach(o => doc.font('B').fontSize(7.8).fillColor('#fff').text(t[o.k].toUpperCase(), o.x + 9, y + 7.5, { width: o.ww - 18, align: o.a, characterSpacing: .6 }));
    y += 26;
  };
  head();
  const lines = (inv.lines || []).filter(l => (l.desc || '').trim() || +l.qty || +l.price);
  lines.forEach((l, i) => {
    const qty = +l.qty || 0, pu = +l.price || 0;
    doc.font('R').fontSize(9.2); const h = Math.max(14, doc.heightOfString(l.desc || '', { width: cols[0].ww - 18 })) + 10;
    if (y + h > H - 120) { newPage(); head(); }
    if (i % 2) doc.rect(M, y - 3, TW, h).fill('#fafafb');
    doc.font(l.band ? 'B' : 'R').fontSize(9.2).fillColor(ink).text(l.desc || '', cols[0].x + 9, y + 2, { width: cols[0].ww - 18 });
    doc.font('R').fontSize(9.2).fillColor('#3a3a3c');
    doc.text(nf(qty, qty % 1 ? 2 : 0) + (l.unit ? ' ' + l.unit : ''), cols[1].x + 4, y + 2, { width: cols[1].ww - 13, align: 'right' });
    doc.text(nf(pu), cols[2].x + 9, y + 2, { width: cols[2].ww - 18, align: 'right' });
    doc.font('B').fillColor(ink).text(nf(qty * pu), cols[3].x + 9, y + 2, { width: cols[3].ww - 18, align: 'right' });
    y += h; doc.moveTo(M, y - 3).lineTo(M + TW, y - 3).lineWidth(.5).strokeColor(line).stroke();
  });

  // ---------- Totaux ----------
  const rows = [[t.ht, T.ht], [+inv.vat ? `${t.vat} ${nf(+inv.vat, +inv.vat % 1 ? 1 : 0)} %` : t.tva0, T.vat], [t.ttc, T.ttc, 1]];
  if (T.stamp) rows.push([t.stamp, T.stamp]);
  if (T.wh) rows.push([`${t.wh} ${nf(+inv.wh, +inv.wh % 1 ? 1 : 0)} %`, -T.wh]);
  const need = rows.length * 19 + 40 + 60;
  if (y + need > H - 120) newPage();
  y += 10;
  const tx = W - M - 250;
  rows.forEach(([k, v, b]) => { doc.font(b ? 'B' : 'R').fontSize(9.4).fillColor(b ? ink : '#3a3a3c').text(k, tx, y, { width: 140 }); doc.font(b ? 'B' : 'R').text(m(v), tx + 120, y, { width: 130, align: 'right' }); y += 19; });
  doc.roundedRect(tx - 10, y, 260, 34, 8).fill(acc);
  doc.font('B').fontSize(8).fillColor('#fff').text(t.net.toUpperCase(), tx + 2, y + 13, { characterSpacing: 1 });
  doc.font('T').fontSize(15).fillColor('#fff').text(m(T.net), tx + 90, y + 9, { width: 150, align: 'right' });
  const wy0 = y - rows.length * 19;
  // Montant en lettres + change, à gauche des totaux
  let ly = wy0;
  if (inv.words !== false) {
    const w = amountWords(T.net, cur, lang);
    if (w) {
      doc.font('R').fontSize(8.2).fillColor(mute).text(t.words.replace('{d}', t[{ facture: 'wf', devis: 'wd', proforma: 'wp', avoir: 'wa' }[inv.type] || 'wf']), M, ly, { width: tx - M - 30 });
      doc.font('B').fontSize(9).fillColor(ink).text(w, M, doc.y + 2, { width: tx - M - 30 }); ly = doc.y + 10;
    }
  }
  if (cur !== 'TND' && +inv.fx > 0) {
    doc.font('R').fontSize(8.2).fillColor(mute).text(`${t.fx} : 1 ${cur} = ${nf(+inv.fx, 3)} TND${inv.fxDate ? ' (' + fmtD(inv.fxDate) + ')' : ''}`, M, ly, { width: tx - M - 30 });
    doc.text(`${t.cv} : ${nf(T.net * +inv.fx, 3)} TND`, M, doc.y + 1, { width: tx - M - 30 }); ly = doc.y + 10;
  }
  y = Math.max(y + 50, ly + 6);

  // ---------- Paiement et notes (gauche), cachet et signature (droite) ----------
  const info = [[t.pay, inv.terms], [t.bank, issuer.bank], [t.rib, issuer.rib], [t.notes, inv.notes]].filter(r => (r[1] || '').trim());
  const sw = 210, sx = W - M - sw, iw = sx - M - 24, lw2 = 92;
  const ok = inv.type === 'devis' || inv.type === 'proforma';
  let infoH = 0; info.forEach(([, v]) => { doc.font('R').fontSize(8.8); infoH += doc.heightOfString(v, { width: iw - lw2 }) + 7; });
  const blockH = Math.max(112, infoH + (ok ? 122 : 0));
  if (y + blockH > H - 48) newPage();
  let ly2 = y;
  info.forEach(([k, v]) => { doc.font('B').fontSize(6.8).fillColor(mute).text(k.toUpperCase(), M, ly2 + 1, { characterSpacing: .6, width: lw2 - 8 }); const lb = doc.y; doc.font('R').fontSize(8.8).fillColor(ink).text(v, M + lw2, ly2, { width: iw - lw2 }); ly2 = Math.max(doc.y, lb, ly2 + 12) + 7; });
  doc.font('B').fontSize(7.2).fillColor(mute).text(t.sign.toUpperCase(), sx, y, { width: sw, characterSpacing: .8 });
  doc.roundedRect(sx, y + 14, sw, 96, 8).lineWidth(.7).strokeColor(line).stroke();
  if (inv.sign !== false) {
    img(issuer.stamp, sx + 6, y + 18, 88, 88, 'left');
    img(issuer.sig, sx + 50, y + 20, sw - 60, 70, 'right');
  }
  if (issuer.signer) doc.font('R').fontSize(8.4).fillColor('#3a3a3c').text(issuer.signer, sx + 10, y + 94, { width: sw - 20, align: 'right' });
  if (ok) {
    const oy = info.length ? ly2 + 6 : y;
    doc.font('B').fontSize(7.2).fillColor(mute).text(t.ok.toUpperCase(), M, oy, { width: iw, characterSpacing: .8 });
    doc.roundedRect(M, oy + 14, Math.min(iw, 260), 96, 8).dash(3, { space: 3 }).lineWidth(.7).strokeColor('#c7c7cc').stroke().undash();
  }

  // ---------- Pied de page ----------
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const foot = [issuer.name, issuer.mf && `${t.mf} ${issuer.mf}`, issuer.rne && `${t.rne} ${issuer.rne}`, issuer.addr && issuer.addr.split('\n')[0]].filter(Boolean).join('  ·  ');
    doc.moveTo(M, H - 34).lineTo(W - M, H - 34).lineWidth(.5).strokeColor(line).stroke();
    doc.font('R').fontSize(7).fillColor(mute).text(foot, M, H - 26, { width: W - 2 * M - 70, lineBreak: false, height: 10 });
    doc.text(`${t.page} ${i + 1}/${range.count}`, W - M - 60, H - 26, { width: 60, align: 'right', lineBreak: false });
  }
  doc.flushPages();
  doc.end();
  return doc;
}
