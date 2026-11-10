// Publicité : le brief de campagne, tout ce dont un réalisateur de pub a besoin avant la PPM.
// Données : project.brief = { client…, deliverables: [], dates: {}, ok: {} }
import { esc } from './parser.js';
import { tr } from './i18n.js';

export const BRIEF_FIELDS = [
  ['Client et agence', [['client', 'Annonceur'], ['brand', 'Marque'], ['product', 'Produit / service'], ['agency', 'Agence'], ['campaign', 'Nom de la campagne'], ['cd', 'Directeur·rice de création'], ['contact', 'Contact client'], ['producer', 'Producteur·rice']]],
  ['Le message', [['message', 'Message clé', 'ta'], ['target', 'Cible'], ['tone', 'Ton et émotion'], ['insight', 'Idée / insight', 'ta'], ['cta', 'Appel à l’action (fin du spot)'], ['refs', 'Références (liens, films, pubs)', 'ta']]],
  ['Contraintes', [['mandatory', 'Mentions obligatoires et légales', 'ta'], ['packshot', 'Packshot et logo (durée, fond, position)', 'ta'], ['music', 'Musique (création, licence, droits)'], ['rights', 'Droits des talents (durée, territoire, supports)'], ['budgetC', 'Budget client annoncé']]]
];
export const DURS = ['60', '45', '30', '20', '15', '10', '6'];
export const RATIOS = ['16:9', '9:16', '1:1', '4:5', '2.39:1'];
export const MEDIA = ['TV', 'Cinéma', 'YouTube', 'Instagram', 'TikTok', 'Facebook', 'Affichage digital', 'Site web'];
export const LANGS = ['FR', 'AR', 'Tounsi', 'EN'];
export const DATES = [['brief', 'Réception du brief'], ['tdr', 'Note d’intention / TDR'], ['ppm', 'PPM (réunion de pré-production)'], ['shoot', 'Tournage'], ['offline', 'Montage offline'], ['online', 'Étalonnage, son, VFX'], ['delivery', 'Livraison des masters'], ['onair', 'Première diffusion']];
export const APPROVALS = [['script', 'Script / storyboard validé'], ['casting', 'Casting validé'], ['locations', 'Décors validés'], ['wardrobe', 'Stylisme et accessoires validés'], ['product', 'Produit et packshot validés'], ['ppm', 'PPM validée et signée'], ['offline', 'Offline validé'], ['final', 'Version finale validée']];

const B = p => { const b = p.brief ||= {}; b.deliverables ||= []; b.dates ||= {}; b.ok ||= {}; return b; };
const did = () => Math.random().toString(36).slice(2, 8);
const opt = (arr, v, empty) => (empty ? `<option value="">${empty}</option>` : '') + arr.map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');

export function briefProgress(p) {
  const b = B(p), filled = BRIEF_FIELDS.flatMap(g => g[1]).filter(([k]) => (b[k] || '').trim()).length, all = BRIEF_FIELDS.flatMap(g => g[1]).length;
  return { filled, all, ok: APPROVALS.filter(([k]) => b.ok[k]).length, okAll: APPROVALS.length, dl: b.deliverables.length };
}

export function renderBrief(p, spots) {
  const b = B(p), pr = briefProgress(p);
  const spotName = id => { const i = spots.findIndex(s => s.id === id); return i >= 0 ? `${i + 1}. ${spots[i].name || 'Spot ' + (i + 1)}` : tr('Campagne'); };
  return `<div class="brief">
    <div class="br-top"><div><h2>${tr('Brief de campagne')}</h2><p class="note">${tr('Tout ce qu’il faut pour la note d’intention, la PPM et la livraison. Exportable en PDF (« Brief et PPM »).')}</p></div>
      <div class="br-kpi"><span><b>${pr.filled}/${pr.all}</b>${tr('champs remplis')}</span><span><b>${pr.dl}</b>${tr('livrables')}</span><span><b>${pr.ok}/${pr.okAll}</b>${tr('validations client')}</span></div></div>
    <div class="br-grid">
      ${BRIEF_FIELDS.map(([title, fields]) => `<section class="br-card"><h3>${tr(title)}</h3><div class="br-f">${fields.map(([k, l, t]) => t === 'ta'
        ? `<label class="fl wide">${tr(l)}<textarea rows="2" data-bf="${k}">${esc(b[k] || '')}</textarea></label>`
        : `<label class="fl">${tr(l)}<input data-bf="${k}" value="${esc(b[k] || '')}"></label>`).join('')}</div></section>`).join('')}
    </div>

    <section class="br-card"><div class="row between"><h3>${tr('Livrables')}</h3><div class="row wrap">
      <button class="chip" data-dlp="tv">${tr('Pack TV')} : 30″ + 15″</button><button class="chip" data-dlp="social">${tr('Pack réseaux')} : 15″ + 6″ · 9:16, 1:1</button><button class="chip" data-dlp="full">${tr('Pack complet')}</button><button class="btn sm ghost" data-dladd>+ ${tr('Ligne')}</button></div></div>
      ${b.deliverables.length ? `<div class="tscroll"><table class="tbl br-dl"><thead><tr><th>${tr('Spot')}</th><th>${tr('Durée')}</th><th>${tr('Format')}</th><th>${tr('Diffusion')}</th><th>${tr('Langue')}</th><th>${tr('Sous-titres')}</th><th>${tr('À livrer le')}</th><th></th></tr></thead><tbody>
        ${b.deliverables.map(d => `<tr><td><select data-dl="${d.id}|spot">${spots.length > 1 ? `<option value="">${tr('Toute la campagne')}</option>` + spots.map((s, i) => `<option value="${s.id}" ${d.spot === s.id ? 'selected' : ''}>${esc(spotName(s.id))}</option>`).join('') : `<option value="">${tr('Spot principal')}</option>`}</select></td>
          <td><select data-dl="${d.id}|dur">${opt(DURS.map(x => x + '″'), d.dur + '″')}</select></td><td><select data-dl="${d.id}|ratio">${opt(RATIOS, d.ratio)}</select></td>
          <td><select data-dl="${d.id}|media">${opt(MEDIA, d.media)}</select></td><td><select data-dl="${d.id}|lang">${opt(LANGS, d.lang)}</select></td>
          <td class="c"><input type="checkbox" data-dl="${d.id}|subs" ${d.subs ? 'checked' : ''}></td><td><input type="date" data-dl="${d.id}|due" value="${esc(d.due || '')}"></td><td><button class="bx" data-dldel="${d.id}">✕</button></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="note">${tr('Ajoutez les versions à livrer : durée, format, diffusion, langue. Les packs remplissent les cas les plus courants.')}</p>`}
    </section>

    <div class="br-grid two">
      <section class="br-card"><h3>${tr('Planning de la campagne')}</h3><div class="br-dates">${DATES.map(([k, l]) => `<label class="br-d"><span>${tr(l)}</span><input type="date" data-bd="${k}" value="${esc(b.dates[k] || '')}"></label>`).join('')}</div></section>
      <section class="br-card"><h3>${tr('Validations client')}</h3><div class="br-ok">${APPROVALS.map(([k, l]) => `<label class="aip-ck"><input type="checkbox" data-bok="${k}" ${b.ok[k] ? 'checked' : ''}><i></i><span>${tr(l)}${b.ok[k] && typeof b.ok[k] === 'string' ? ` <small>${esc(new Date(b.ok[k]).toLocaleDateString())}</small>` : ''}</span></label>`).join('')}</div></section>
    </div>
  </div>`;
}

const PACKS = {
  tv: [['30', '16:9', 'TV'], ['15', '16:9', 'TV']],
  social: [['15', '9:16', 'Instagram'], ['15', '1:1', 'Facebook'], ['6', '9:16', 'TikTok'], ['6', '16:9', 'YouTube']],
  full: [['30', '16:9', 'TV'], ['15', '16:9', 'TV'], ['30', '16:9', 'YouTube'], ['15', '9:16', 'Instagram'], ['15', '1:1', 'Facebook'], ['6', '9:16', 'TikTok'], ['6', '16:9', 'YouTube']]
};

// o : { project, save(), refresh() }
export function bindBrief(root, o) {
  const b = () => B(o.project);
  root.addEventListener('input', e => {
    if (!root.querySelector('.brief')) return;
    const d = e.target.dataset;
    if (d.bf) { b()[d.bf] = e.target.value; o.save(); }
  });
  root.addEventListener('change', e => {
    if (!root.querySelector('.brief')) return;
    const d = e.target.dataset;
    if (d.bd) { b().dates[d.bd] = e.target.value; o.save(); return; }
    if (d.bok) { b().ok[d.bok] = e.target.checked ? new Date().toISOString() : false; o.save(); return o.refresh(); }
    if (d.dl) { const [id, f] = d.dl.split('|'), row = b().deliverables.find(x => x.id === id); if (!row) return; row[f] = e.target.type === 'checkbox' ? e.target.checked : f === 'dur' ? e.target.value.replace('″', '') : e.target.value; o.save(); }
  });
  root.addEventListener('click', e => {
    if (!root.querySelector('.brief')) return;
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-dladd')) { b().deliverables.push({ id: did(), spot: '', dur: '30', ratio: '16:9', media: 'TV', lang: 'FR', subs: false, due: b().dates.delivery || '' }); o.save(); return o.refresh(); }
    if (t.dataset.dldel) { b().deliverables = b().deliverables.filter(x => x.id !== t.dataset.dldel); o.save(); return o.refresh(); }
    if (t.dataset.dlp) { PACKS[t.dataset.dlp].forEach(([dur, ratio, media]) => b().deliverables.push({ id: did(), spot: '', dur, ratio, media, lang: 'FR', subs: media !== 'TV', due: b().dates.delivery || '' })); o.save(); return o.refresh(); }
  });
}
