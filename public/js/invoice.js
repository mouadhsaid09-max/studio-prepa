// Générateur de facture / devis / pro forma depuis le budget (production ou post-production IA).
// Profil de l'émetteur (logo, signature, cachet, matricule fiscal, RIB) mémorisé dans ce navigateur et dans le projet.
import { esc } from './parser.js';
import { tr, LANG } from './i18n.js';
import { computeBudget, fromTND, toTND, CURRENCIES } from './budget.js';
import { invTotals, amountWords, DEC } from './invoice-calc.js';
import { icon } from './icons.js';

const LSK = 'sp.issuer';
const lsGet = () => { try { return JSON.parse(localStorage.getItem(LSK) || 'null'); } catch (e) { return null; } };
const lsSet = v => { try { localStorage.setItem(LSK, JSON.stringify(v)); } catch (e) { /* stockage plein : on garde la copie du projet */ } };
const today = (d = 0) => { const x = new Date(Date.now() + d * 864e5); return x.toISOString().slice(0, 10); };
const PREFIX = { facture: 'FAC', devis: 'DEV', proforma: 'PRO', avoir: 'AV' };
const TYPES = [['facture', 'Facture'], ['devis', 'Devis'], ['proforma', 'Pro forma'], ['avoir', 'Avoir']];
const AI_TPL = ['Génération des plans IA (images et vidéo)', 'Sélection des prises et composites', 'Upscale et finitions (grain, stabilisation)', 'Étalonnage et raccord couleur', 'Voix, musique, bruitages et mixage', 'Livrables multi-formats (16:9, 9:16, 1:1) et sous-titres'];
const nextNum = (iss, type) => { const y = new Date().getFullYear(), s = ((iss.seq || {})[type + y]) || 1; return `${PREFIX[type] || 'FAC'}-${y}-${String(s).padStart(3, '0')}`; };
const lid = () => Math.random().toString(36).slice(2, 9);

export function invoiceData(project) {
  const iss = { ...(project.invoice && project.invoice.issuer || {}), ...(lsGet() || {}) };
  const inv = project.invoice ||= {};
  inv.issuer = iss;
  inv.type ||= 'facture'; inv.cur ||= (project.budget && project.budget.cur) || 'TND'; inv.lang ||= LANG === 'en' ? 'en' : 'fr';
  inv.date ||= today(); inv.due ||= today(30);
  if (inv.vat == null) inv.vat = 19; if (inv.stamp == null) inv.stamp = 1; if (inv.wh == null) inv.wh = 0;
  inv.client ||= {}; inv.lines ||= [];
  if (inv.terms == null) inv.terms = tr('Paiement à 30 jours par virement bancaire.');
  if (!inv.num) inv.num = nextNum(iss, inv.type);
  return inv;
}

// Lignes à partir du budget : récapitulatif par poste ou détail
function fromBudget(project, P, mode, cur) {
  const B = computeBudget(project, P), b = B.b;
  if (cur !== 'TND' && !(+b.fx[cur] > 0)) return { err: tr('Saisissez le taux de change pour') + ' ' + cur };
  const conv = tnd => fromTND(b, tnd, cur) || 0;
  if (mode === 'sum') {
    const out = B.cats.filter(c => c.totTND > 0).map(c => ({ id: lid(), desc: tr(c.label), qty: 1, unit: '', price: conv(c.totTND) }));
    if (B.contTND > 0) out.push({ id: lid(), desc: `${tr('Imprévus')} (${+b.cont || 0} %)`, qty: 1, unit: '', price: conv(B.contTND) });
    return { lines: out };
  }
  const out = [];
  B.cats.forEach(c => c.rows.filter(r => r.tot > 0).forEach(r => out.push({ id: lid(), desc: `${tr(c.label)} · ${r.auto && (r.key === 'int.fig' || !/^(int|lieux)\./.test(r.key)) ? tr(r.label) : r.label}`, qty: r.qty, unit: tr(r.unit), price: conv(toTND(b, r.rate, r.c)) })));
  return { lines: out };
}

// Petite image (logo, signature, cachet) : PNG réduit, transparence conservée
const shrink = (file, max = 640) => new Promise((ok, ko) => {
  const fr = new FileReader(); fr.onerror = () => ko(new Error('lecture impossible'));
  fr.onload = () => { const im = new Image(); im.onerror = () => ko(new Error(tr('Image non prise en charge'))); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/png')); }; im.src = fr.result; };
  fr.readAsDataURL(file);
});
const pick = () => new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/webp'; i.onchange = () => ok(i.files[0] || null); i.click(); });

// Pavé de signature : trait lissé, recadré sur l'encre
function sigPad(cv) {
  const ctx = cv.getContext('2d'); let pts = null, any = false;
  const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(3, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14213d'; any = false; };
  fit();
  const P = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' ? (e.pressure || .5) : .5]; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); pts = [P(e)]; any = true; });
  cv.addEventListener('pointermove', e => { if (!pts) return; const p = P(e), q = pts[pts.length - 1]; ctx.lineWidth = 1.2 + 2.6 * p[2]; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); pts.push(p); });
  const end = () => { pts = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  return {
    clear: fit, empty: () => !any,
    png: () => { // recadrage sur la zone dessinée
      const { width: w, height: h } = cv, d = ctx.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 <= x0) return null; const pad = 8; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
      const o = document.createElement('canvas'); o.width = x1 - x0; o.height = y1 - y0; o.getContext('2d').drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o.toDataURL('image/png');
    }
  };
}

// o : { project, P, modal, save, toast, download(name, blob), isAI }
export function openInvoice(o) {
  const p = o.project, inv = invoiceData(p), iss = inv.issuer;
  const persist = () => { p.invoice = inv; inv.issuer = iss; lsSet(iss); o.save(); };
  const num = (v, dd) => Number.isFinite(+v) ? (+v).toFixed(dd) : '';
  const fmtN = (v, dd) => new Intl.NumberFormat(inv.lang === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: dd, maximumFractionDigits: dd }).format(+v || 0);
  o.modal(`<div class="inv">
    <div class="row between inv-hd"><div class="row">${icon('invoice', 34)}<div><h3>${tr('Facture et devis')}</h3><p class="note">${tr('PDF propre pour le client, avec logo, cachet et signature.')}</p></div></div><button class="x" data-close>✕</button></div>
    <div class="inv-body">
      <section class="inv-s"><h4>${tr('Document')}</h4>
        <div class="seg inv-type">${TYPES.map(([k, l]) => `<button data-ity="${k}" class="${inv.type === k ? 'on' : ''}">${tr(l)}</button>`).join('')}</div>
        <div class="grid4">
          <label class="fl">${tr('Numéro')}<input data-iv="num" value="${esc(inv.num)}"></label>
          <label class="fl">${tr('Date')}<input type="date" data-iv="date" value="${esc(inv.date)}"></label>
          <label class="fl" id="idue">${inv.type === 'devis' ? tr('Valable jusqu’au') : tr('Échéance')}<input type="date" data-iv="due" value="${esc(inv.due)}"></label>
          <label class="fl">${tr('Langue du PDF')}<select data-iv="lang"><option value="fr" ${inv.lang === 'fr' ? 'selected' : ''}>Français</option><option value="en" ${inv.lang === 'en' ? 'selected' : ''}>English</option></select></label>
          <label class="fl">${tr('Devise')}<select data-iv="cur">${CURRENCIES.map(c => `<option ${c === inv.cur ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="fl ${inv.cur === 'TND' ? 'hidden' : ''}" id="ifx">1 <span id="ifxc">${inv.cur}</span> = … TND<input type="number" step="any" min="0" data-iv="fx" value="${esc(inv.fx || '')}" placeholder="${tr('taux du jour')}"></label>
          <label class="fl">${tr('Réf. projet')}<input data-iv="ref" value="${esc(inv.ref || '')}" placeholder="${esc(p.name || '')}"></label>
        </div></section>

      <div class="inv-2">
      <section class="inv-s"><h4>${tr('Émetteur')} <small>${tr('(mémorisé pour vos prochains documents)')}</small></h4>
        <div class="inv-logo"><div class="inv-img" id="ilogo">${iss.logo ? `<img src="${iss.logo}" alt="">` : `<span>${tr('Logo')}</span>`}</div><div class="col"><button class="btn sm ghost" data-ipick="logo">${tr('Importer le logo')}</button>${iss.logo ? `<button class="link" data-idel="logo">${tr('Retirer')}</button>` : ''}<label class="fl">${tr('Couleur')}<input type="color" data-is="accent" value="${esc(iss.accent || '#ff7a1a')}"></label></div></div>
        <label class="fl">${tr('Société / nom')}<input data-is="name" value="${esc(iss.name || '')}" placeholder="Atlas Films SARL"></label>
        <label class="fl">${tr('Adresse')}<textarea rows="2" data-is="addr">${esc(iss.addr || '')}</textarea></label>
        <div class="grid2"><label class="fl">${tr('Matricule fiscal')}<input data-is="mf" value="${esc(iss.mf || '')}" placeholder="1234567/A/M/000"></label><label class="fl">${tr('N° RNE')}<input data-is="rne" value="${esc(iss.rne || '')}"></label>
        <label class="fl">${tr('Téléphone')}<input data-is="tel" value="${esc(iss.tel || '')}"></label><label class="fl">E-mail<input data-is="email" value="${esc(iss.email || '')}"></label>
        <label class="fl">${tr('Banque')}<input data-is="bank" value="${esc(iss.bank || '')}"></label><label class="fl">RIB / IBAN<input data-is="rib" value="${esc(iss.rib || '')}"></label></div>
      </section>
      <section class="inv-s"><h4>${tr('Client')}</h4>
        <label class="fl">${tr('Nom ou société')}<input data-ic="name" value="${esc(inv.client.name || '')}"></label>
        <label class="fl">${tr('Adresse')}<textarea rows="2" data-ic="addr">${esc(inv.client.addr || '')}</textarea></label>
        <div class="grid2"><label class="fl">${tr('Matricule fiscal')}<input data-ic="mf" value="${esc(inv.client.mf || '')}"></label><label class="fl">E-mail<input data-ic="email" value="${esc(inv.client.email || '')}"></label></div>
        <h4 class="mt">${tr('Signature et cachet')}</h4>
        <div class="inv-sig"><div class="inv-pad"><canvas id="isig"></canvas><div class="inv-sigimg" id="isigimg">${iss.sig ? `<img src="${iss.sig}" alt="">` : ''}</div><span class="inv-ph ${iss.sig ? 'hidden' : ''}">${tr('Signez ici')}</span></div>
          <div class="col"><button class="btn sm" data-isig>${tr('Garder la signature')}</button><button class="btn sm ghost" data-iclr>${tr('Effacer')}</button><button class="link" data-ipick="sig">${tr('Importer une image')}</button></div></div>
        <div class="inv-logo sm"><div class="inv-img" id="istamp">${iss.stamp ? `<img src="${iss.stamp}" alt="">` : `<span>${tr('Cachet')}</span>`}</div><div class="col"><button class="btn sm ghost" data-ipick="stamp">${tr('Importer le cachet')}</button>${iss.stamp ? `<button class="link" data-idel="stamp">${tr('Retirer')}</button>` : ''}</div>
          <label class="fl">${tr('Signataire')}<input data-is="signer" value="${esc(iss.signer || '')}" placeholder="${tr('Nom, fonction')}"></label></div>
      </section></div>

      <section class="inv-s"><div class="row between"><h4>${tr('Lignes')}</h4><div class="row wrap">
        <button class="chip" data-ifill="sum">${tr('Budget : récapitulatif')}</button><button class="chip" data-ifill="det">${tr('Budget : détaillé')}</button><button class="chip ai" data-ifill="ai">✦ ${tr('Post-production IA')}</button></div></div>
        <div class="tscroll"><table class="tbl inv-tab"><thead><tr><th>${tr('Désignation')}</th><th>${tr('Qté')}</th><th>${tr('P.U. HT')}</th><th class="r">${tr('Total HT')}</th><th></th></tr></thead><tbody id="ilines"></tbody></table></div>
        <button class="link" data-iadd>+ ${tr('Ajouter une ligne')}</button>
        <div class="inv-tot">
          <div class="grid4">
            <label class="fl">${tr('TVA (%)')}<input type="number" step="any" min="0" data-iv="vat" value="${esc(inv.vat)}"></label>
            <label class="fl ${inv.cur === 'TND' ? '' : 'hidden'}" id="istp">${tr('Droit de timbre (TND)')}<input type="number" step="0.001" min="0" data-iv="stamp" value="${esc(inv.stamp)}"></label>
            <label class="fl">${tr('Retenue à la source (%)')}<input type="number" step="any" min="0" data-iv="wh" value="${esc(inv.wh)}"></label>
            <label class="chk"><input type="checkbox" data-iv="words" ${inv.words !== false ? 'checked' : ''}> ${tr('Montant en lettres')}</label>
          </div>
          <div class="inv-sum" id="isum"></div>
        </div>
        <div class="grid2"><label class="fl">${tr('Conditions de paiement')}<textarea rows="2" data-iv="terms">${esc(inv.terms || '')}</textarea></label><label class="fl">${tr('Notes')}<textarea rows="2" data-iv="notes">${esc(inv.notes || '')}</textarea></label></div>
      </section>
      <p class="inv-legal">${tr('En Tunisie, la facture électronique officielle passe par la plateforme El Fatoora (TTN) avec une signature électronique qualifiée. Ce PDF sert de devis, de pro forma ou de copie de facture : vérifiez les mentions obligatoires avec votre comptable.')}</p>
    </div>
    <div class="err" id="ierr"></div>
    <div class="row end inv-ft"><span class="inv-net" id="inet"></span><button class="btn ghost" data-close>${tr('Fermer')}</button><button class="btn" id="igo">${icon('invoice', 20)} ${tr('Télécharger le PDF')}</button></div>
  </div>`, (bg, close) => {
    bg.querySelector('.modal').classList.add('invm');
    const q = s => bg.querySelector(s), pad = sigPad(q('#isig'));
    const dd = () => DEC[inv.cur] ?? 2;
    const drawLines = () => {
      q('#ilines').innerHTML = inv.lines.map(l => `<tr data-lid="${l.id}"><td><textarea rows="1" data-il="desc">${esc(l.desc || '')}</textarea></td><td><input class="bn" type="number" step="any" min="0" data-il="qty" value="${esc(l.qty ?? '')}"></td><td><input class="bn r" type="number" step="any" data-il="price" value="${l.price === '' || l.price == null ? '' : num(l.price, dd())}"></td><td class="r btot">${fmtN((+l.qty || 0) * (+l.price || 0), dd())}</td><td><button class="bx" data-ldel="${l.id}">✕</button></td></tr>`).join('') || `<tr><td colspan="5" class="muted">${tr('Ajoutez des lignes ou importez le budget.')}</td></tr>`;
      sums();
    };
    const sums = () => {
      const T = invTotals(inv), f = v => fmtN(v, dd()) + ' ' + inv.cur;
      q('#isum').innerHTML = `<div><span>${tr('Total HT')}</span><b>${f(T.ht)}</b></div><div><span>${tr('TVA')} ${+inv.vat || 0} %</span><b>${f(T.vat)}</b></div><div><span>${tr('Total TTC')}</span><b>${f(T.ttc)}</b></div>${T.stamp ? `<div><span>${tr('Droit de timbre')}</span><b>${f(T.stamp)}</b></div>` : ''}${T.wh ? `<div><span>${tr('Retenue à la source')}</span><b>−${f(T.wh)}</b></div>` : ''}<div class="g"><span>${tr('Net à payer')}</span><b>${f(T.net)}</b></div>${inv.words !== false ? `<em>${esc(amountWords(T.net, inv.cur, inv.lang))}</em>` : ''}`;
      q('#inet').textContent = f(T.net);
    };
    const setImg = (k, src) => { iss[k] = src; persist(); const box = q(k === 'logo' ? '#ilogo' : k === 'stamp' ? '#istamp' : '#isigimg'); if (box) box.innerHTML = src ? `<img src="${src}" alt="">` : k === 'sig' ? '' : `<span>${tr(k === 'logo' ? 'Logo' : 'Cachet')}</span>`; if (k === 'sig') q('.inv-ph').classList.toggle('hidden', !!src); };
    drawLines();
    q('#isig').addEventListener('pointerdown', () => { q('.inv-ph').classList.add('hidden'); q('#isigimg').innerHTML = ''; });

    bg.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.ity) {
        const was = inv.num === nextNum(iss, inv.type); inv.type = b.dataset.ity; if (was) { inv.num = nextNum(iss, inv.type); q('[data-iv=num]').value = inv.num; }
        bg.querySelectorAll('[data-ity]').forEach(x => x.classList.toggle('on', x === b));
        q('#idue').firstChild.textContent = inv.type === 'devis' ? tr('Valable jusqu’au') : tr('Échéance'); persist(); return;
      }
      if (b.dataset.ifill) {
        let lines;
        if (b.dataset.ifill === 'ai') lines = AI_TPL.map(d => ({ id: lid(), desc: tr(d), qty: 1, unit: '', price: '' }));
        else { const r = fromBudget(p, o.P, b.dataset.ifill, inv.cur); if (r.err) return o.toast(esc(r.err)); lines = r.lines; if (!lines.length) return o.toast(tr('Le budget est vide pour l’instant.')); }
        inv.lines = inv.lines.filter(l => (l.desc || '').trim() || +l.price).concat(lines); persist(); return drawLines();
      }
      if (b.hasAttribute('data-iadd')) { inv.lines.push({ id: lid(), desc: '', qty: 1, unit: '', price: '' }); persist(); drawLines(); return q(`[data-lid="${inv.lines[inv.lines.length - 1].id}"] textarea`)?.focus(); }
      if (b.dataset.ldel) { inv.lines = inv.lines.filter(l => l.id !== b.dataset.ldel); persist(); return drawLines(); }
      if (b.dataset.ipick) { const f = await pick(); if (!f) return; try { setImg(b.dataset.ipick, await shrink(f, b.dataset.ipick === 'sig' ? 800 : 640)); } catch (er) { o.toast(esc(er.message)); } return; }
      if (b.dataset.idel) { setImg(b.dataset.idel, ''); b.remove(); return; }
      if (b.hasAttribute('data-iclr')) { pad.clear(); setImg('sig', ''); return; }
      if (b.hasAttribute('data-isig')) { if (pad.empty()) return o.toast(tr('Signez d’abord dans le cadre.')); const png = pad.png(); if (png) { setImg('sig', png); pad.clear(); o.toast(tr('Signature enregistrée')); } return; }
      if (b.id === 'igo') {
        const err = q('#ierr'); err.textContent = '';
        if (!pad.empty()) { const png = pad.png(); if (png) { setImg('sig', png); pad.clear(); } }
        if (!inv.lines.some(l => +l.qty && +l.price)) { err.textContent = tr('Ajoutez au moins une ligne avec un prix.'); return; }
        if (!iss.name) { err.textContent = tr('Indiquez le nom de l’émetteur.'); return; }
        if (inv.cur !== 'TND' && !(+inv.fx > 0)) { err.textContent = tr('Indiquez le taux de change : il doit figurer sur une facture en devises.'); return; }
        b.disabled = true; const lbl = b.innerHTML; b.textContent = tr('Création…');
        try {
          const [{ load }, { buildInvoicePdf }] = await Promise.all([import('./pdf-browser.js'), import('./invoice-pdf.js')]);
          const lib = await load();
          const doc = buildInvoicePdf(lib, inv, iss, p);
          const blob = await new Promise((ok, ko) => { const ch = []; doc.on('data', c => ch.push(c)); doc.on('end', () => ok(new Blob(ch, { type: 'application/pdf' }))); doc.on('error', ko); });
          const name = `${inv.num || tr('Facture')} - ${(inv.client.name || p.name || '').replace(/[\\/:*?"<>|]+/g, '-')}.pdf`.replace(/ - \.pdf$/, '.pdf');
          const saved = await o.download(name, blob);
          if (saved) import('./badges.js').then(m => m.award('invoice', p.name)).catch(() => {});
          if (saved !== false && inv.num === nextNum(iss, inv.type)) { const y = new Date().getFullYear(); (iss.seq ||= {})[inv.type + y] = ((iss.seq[inv.type + y]) || 1) + 1; }
          persist();
        } catch (er) { err.textContent = tr('Export impossible') + ' : ' + esc(er.message || ''); }
        b.disabled = false; b.innerHTML = lbl;
      }
    });
    const onEdit = e => {
      const t = e.target, d = t.dataset;
      if (d.iv) {
        const v = t.type === 'checkbox' ? t.checked : t.value; inv[d.iv] = t.type === 'number' ? (t.value === '' ? '' : +t.value) : v;
        if (d.iv === 'cur') { q('#ifx').classList.toggle('hidden', v === 'TND'); q('#istp').classList.toggle('hidden', v !== 'TND'); q('#ifxc').textContent = v; if (e.type === 'change') drawLines(); }
        persist(); if (['vat', 'stamp', 'wh', 'words', 'lang'].includes(d.iv)) sums(); return;
      }
      if (d.is) { iss[d.is] = t.value; persist(); return; }
      if (d.ic) { inv.client[d.ic] = t.value; persist(); return; }
      if (d.il) {
        const l = inv.lines.find(x => x.id === t.closest('tr').dataset.lid); if (!l) return;
        l[d.il] = d.il === 'desc' ? t.value : (t.value === '' ? '' : +t.value); persist();
        t.closest('tr').querySelector('.btot').textContent = fmtN((+l.qty || 0) * (+l.price || 0), dd()); sums();
        if (d.il === 'desc') { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
      }
    };
    bg.addEventListener('input', onEdit); bg.addEventListener('change', onEdit);
  });
}
