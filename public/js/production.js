// Onglets de production : dépouillement, liste artistique, plan de travail, feuilles de service
import { esc, fmtE, fdate, fdateL, hm, cls, callSheet, CREW, COLS_ALL, bibKey, fmtMin, unavail, isUnavail, DEFAULT_SETTINGS, LIGHT_ORDER, SHOT, shotLabel } from './parser.js';

export const COLS = COLS_ALL;
export const legend = `<div class="legend"><span><i class="sw ij"></i>INT JOUR</span><span><i class="sw ej"></i>EXT JOUR</span><span><i class="sw in"></i>INT NUIT</span><span><i class="sw en"></i>EXT NUIT</span></div>`;

export function makeEd(project) {
  return (k, def = '', tag = 'td', ph = '') => {
    const v = project.edits[k] ?? def;
    return `<${tag} class="ed" contenteditable="true" spellcheck="false" data-k="${esc(k)}" data-ph="${esc(ph)}">${esc(v)}</${tag}>`;
  };
}
const roleTag = (r, s) => `<span class="rid">${r.id}</span>${r.speak.has(s.idx) ? esc(r.name) : '<span class="mutey">' + esc(r.name) + '</span>'}`;
const tools = (id, extra = '') => `<div class="row"><button class="btn sm ghost" data-copy="${id}">Copier pour Excel / Sheets</button><button class="btn sm ghost" data-print>Imprimer / PDF</button>${extra}</div>`;
const empty = `<div class="empty"><h3>Aucune scène</h3><p>Écrivez ou importez le scénario dans l’onglet <b>Scénario</b>. Les en-têtes doivent ressembler à « 1. INT. CUISINE - JOUR ».</p></div>`;

export function renderDep(P, project, epf) {
  if (!P.scenes.length) return empty;
  const ed = makeEd(project);
  const list = P.series && epf ? P.scenes.filter(x => x.epId === epf) : P.scenes;
  const epBar = P.series ? `<div class="pills epf"><button class="pill ${epf ? '' : 'on'}" data-epf="">Tous les épisodes</button>${P.episodes.map(e => `<button class="pill ${epf === e.id ? 'on' : ''}" data-epf="${e.id}">${e.n}. ${esc(e.name)}</button>`).join('')}</div>` : '';
  return `<div class="panel"><div class="row between"><h2>Dépouillement</h2>${tools('tDep')}</div>
  ${epBar}${legend}<p class="note">Tout est modifiable : touchez une cellule pour écrire, ou le numéro de scène pour ouvrir sa fiche (effet, moment, jour de tournage…). Les éléments pré-remplis viennent d’une détection par mots-clés : vérifiez-les. Rôles en italique = présents sans dialogue.</p>
  <div class="tw"><table id="tDep"><thead><tr>${P.series ? '<th>Ép.</th>' : ''}<th class="num">N°</th><th>Effet</th><th>Décor</th><th>Résumé</th><th>Durée</th><th>Temps</th><th>Jour</th><th>Rôles</th>${COLS.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>
  ${list.map(s => `<tr class="${cls(s)}" id="dep-${esc(s.k)}">${P.series ? `<td class="num">${s.ep}</td>` : ''}<td class="fx num"><button class="scn" data-scene="${esc(s.k)}" title="Modifier la scène">${esc(s.num)}${s.ovr ? '<i>•</i>' : ''}</button></td><td class="fx"><button class="scn t" data-scene="${esc(s.k)}">${s.ie} ${esc(s.timeL)}</button></td>${ed('ov.' + s.k + '.decor', s.decor)}${ed('ov.' + s.k + '.summary', s.summary, 'td', 'Résumé')}${ed('bd.' + s.k + '.e', fmtE(s.autoE))}${ed('est.' + s.k, String(s.est), 'td')}<td class="num"><button class="scn t" data-scene="${esc(s.k)}">J${s.day}</button></td><td>${s.roles.map(r => roleTag(r, s)).join('<br>') || '<span class="mutey">—</span>'}</td>${COLS.map(c => ed('bd.' + s.k + '.' + c[0], s.det[c[0]] || '')).join('')}</tr>`).join('')}
  </tbody></table></div></div>`;
}

export const CAST_STATUS = [
  ['contract', 'Contrat', ['', 'Signé', 'Non signé', 'En cours']],
  ['cos', 'Essayage costume', ['', 'À faire', 'Prévu', 'Fait']],
  ['mak', 'Essai maquillage', ['', 'À faire', 'Prévu', 'Fait']],
  ['read', 'Scénario remis', ['', 'Non', 'Papier', 'Numérique', 'Papier + numérique']]
];
const sel = (k, opts, v) => `<select class="csel st-${esc((v || 'none').toLowerCase().replace(/[^a-z]/g, ''))}" data-sel="${esc(k)}">${opts.map(o => `<option value="${esc(o)}" ${o === (v || '') ? 'selected' : ''}>${o || '—'}</option>`).join('')}</select>`;
export const fmtRange = r => { const f = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); return r.to && r.to !== r.from ? f(r.from) + ' → ' + f(r.to) : f(r.from); };
export function renderArt(P, project) {
  if (!P.scenes.length) return empty;
  const ed = makeEd(project), e = project.edits, nd = P.days.length;
  const st = (r, j) => { const un = isUnavail(e, r.name, P.days[j].date), w = r.days.includes(j); if (un && w) return '!'; if (un) return 'X'; if (!r.days.length) return ''; const f = r.days[0], l = r.days[r.days.length - 1]; if (j < f || j > l) return ''; if (!w) return 'A'; if (f === l) return 'DF'; return j === f ? 'D' : j === l ? 'F' : 'T'; };
  const conflicts = P.days.flatMap(d => d.conflicts.map(n => `<b>${esc(n)}</b> est indisponible le ${fdate(d.date)} (J${d.n})`));
  return `<div class="panel"><div class="row between"><h2>Liste artistique</h2>${tools('tArt')}</div>
  <p class="note">Tout est modifiable. Touchez un nom pour ouvrir la fiche du personnage, et « Indisponibilités » pour noter les dates où un comédien ne peut pas tourner : le plan de travail les signale.</p>
  ${conflicts.length ? `<div class="alert">⚠ ${conflicts.join('<br>⚠ ')}</div>` : ''}
  <div class="tw"><table id="tArt"><thead><tr><th class="num">N°</th><th>Rôle</th><th>Catégorie</th><th>Comédien·ne</th><th class="num">Séq.</th><th class="num">Jours</th>${CAST_STATUS.map(c => `<th>${c[1]}</th>`).join('')}<th>Indisponibilités</th><th>Contact</th></tr></thead><tbody>
  ${P.roles.map(r => { const u = unavail(e, r.name), bad = P.days.some(d => d.conflicts.includes(r.name)); return `<tr><td class="num"><span class="rid">${r.id}</span></td><td><button class="lnk" data-ent="ch:r:${esc(r.name)}">${esc(r.name)}</button></td><td><select class="csel" data-cat="${esc(r.name)}">${['Principal', 'Secondaire', 'Silhouette', 'Figuration'].map(c => `<option ${r.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>${ed('cast.' + r.name + '.n', '', 'td', 'À compléter')}<td class="num">${r.all.length}</td><td class="num">${r.days.length}</td>${CAST_STATUS.map(([f, , o]) => `<td>${sel('cs.' + r.name + '.' + f, o, e['cs.' + r.name + '.' + f])}</td>`).join('')}<td><button class="unavb ${bad ? 'bad' : ''}" data-unav="${esc(r.name)}">${u.length ? u.map(fmtRange).join(', ') : '+ Dates'}</button></td>${ed('cast.' + r.name + '.c', '', 'td', 'Tél. / e-mail')}</tr>`; }).join('')}
  </tbody></table></div></div>
  <div class="panel"><div class="row between"><h2>Jours par rôle</h2>${tools('tDood')}</div><p class="note">D = début · T = travail · F = fin · DF = un seul jour · A = attente · X = indisponible · <b class="bad">!</b> = convoqué un jour d’indisponibilité</p>
  <div class="tw"><table class="dood" id="tDood"><thead><tr><th>Rôle</th>${P.days.map(d => `<th class="num">J${d.n}<br><span class="thin">${fdate(d.date)}</span></th>`).join('')}<th class="num">Trav.</th><th class="num">Att.</th></tr></thead><tbody>
  ${P.roles.map(r => { const c = [...Array(nd)].map((_, j) => st(r, j)); return `<tr><td class="n"><span class="rid">${r.id}</span>${esc(r.name)}</td>${c.map(x => `<td class="${x === '!' ? 'C' : x === 'X' ? 'U' : x}">${x}</td>`).join('')}<td>${r.days.length}</td><td>${c.filter(x => x === 'A').length}</td></tr>`; }).join('')}
  </tbody></table></div></div>`;
}

export function renderPdt(P, project) {
  if (!P.scenes.length) return empty;
  const ed = makeEd(project), set = { ...DEFAULT_SETTINGS(), ...(project.settings || {}) };
  const tot = P.scenes.reduce((a, s) => a + s.e, 0), totMin = P.days.reduce((a, d) => a + d.min, 0);
  const conflicts = P.days.flatMap(d => d.conflicts.map(n => `<b>${esc(n)}</b> indisponible le ${fdate(d.date)} (J${d.n})`));
  const over = P.days.filter(d => d.over).map(d => 'J' + d.n);
  const strip = s => `<div class="sb-item strip ${cls(s)}" data-k="${esc(s.k)}"><span class="dh" title="Glisser">⠿</span><b>${esc(s.num)}</b><span class="ef">${s.ie} ${esc(s.timeL)}</span><span class="d">${esc(s.decor)}</span><span class="p">${fmtE(s.e)} · ${fmtMin(s.est)}</span><span class="r">${s.roles.map(r => r.id).join(' · ')}${s.summary ? ' — ' + esc(s.summary) : ''}</span></div>`;
  const head = (d, i) => `<div class="${i ? 'sb-item sb-break' : 'sb-head'} ${d.over ? 'over' : ''}" ${i ? 'data-break="1"' : ''}>${i ? '<span class="dh" title="Glisser la fin de journée">⠿</span>' : ''}<b>JOUR ${d.n}</b><span>${fdate(d.date)}${d.mixed ? ' · jour / nuit' : d.night ? ' · nuit' : ''}</span><span class="dm">${d.sc.length} séq. · ${fmtMin(d.min)} / ${fmtMin(P.cap)}${d.moves ? ' · ' + d.moves + ' dépl.' : ''}</span>${d.conflicts.length ? `<em class="cf">⚠ ${d.conflicts.map(esc).join(', ')}</em>` : ''}${i ? '<button class="sb-x" data-unbreak title="Fusionner avec la journée précédente">✕</button>' : ''}</div>`;
  return `<div class="panel"><div class="row between"><h2>Plan de travail</h2>${tools('tPdt')}</div>
  <div class="stats"><div class="stat"><b>${P.days.length}</b><span>Jours</span></div><div class="stat"><b>${P.scenes.length}</b><span>Séquences</span></div><div class="stat"><b>≈ ${P.quota}</b><span>Séq. / jour possibles</span></div><div class="stat"><b>${fmtMin(totMin / Math.max(1, P.days.length))}</b><span>Moy. / jour</span></div><div class="stat"><b>${fmtE(tot)}</b><span>Pages</span></div></div>
  <details class="more-f"><summary>Réglages du calcul (journée, temps par page, dates)</summary><div class="grid4">
    <label class="fl">1er jour<input type="date" data-s="start" value="${esc(set.start)}"></label>
    <label class="fl">Jours / semaine<select data-s="dpw">${[5, 6, 7].map(n => `<option ${+set.dpw === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="fl">Journée de travail (h)<input type="number" min="4" max="16" step="0.5" data-s="hpd" value="${esc(set.hpd)}"></label>
    <label class="fl">Minutes par page<input type="number" min="10" max="300" step="5" data-s="mpp" value="${esc(set.mpp)}"></label>
    <label class="fl">Installation par séquence (min)<input type="number" min="0" max="180" step="5" data-s="setup" value="${esc(set.setup)}"></label>
    <label class="fl">Déplacement entre décors (min)<input type="number" min="0" max="240" step="5" data-s="move" value="${esc(set.move)}"></label>
    <label class="fl">Minutes par plan (si découpage)<input type="number" min="3" max="120" step="1" data-s="shotMin" value="${esc(set.shotMin)}"></label>
    <label class="fl">PAT jour<input type="time" data-s="pat" value="${esc(set.pat)}"></label>
    <label class="fl">PAT nuit<input type="time" data-s="patN" value="${esc(set.patN)}"></label>
  </div><p class="note sm">Temps d’une séquence = installation + pages × minutes par page (ou nombre de plans × minutes par plan si la scène a un découpage), + 45 min si cascade, + 30 min si SFX, véhicule ou animal, + 20 min si figuration, + 15 % la nuit. Une journée compte ${fmtMin(P.cap)} de tournage (journée moins 1 h de repas). Chaque temps se corrige dans la fiche scène.</p></details>
  <p class="note">${P.manual ? '<b>Ordre manuel.</b> ' : '<b>Ordre automatique :</b> EXT jour → INT jour → INT nuit → EXT nuit, séquences d’un même décor regroupées, journées remplies selon le temps estimé. '}Glissez les bandes avec ⠿ pour changer l’ordre, glissez une « fin de journée » pour déplacer la coupure, touchez une bande pour modifier la scène.</p>
  ${conflicts.length ? `<div class="alert">⚠ ${conflicts.join('<br>⚠ ')}</div>` : ''}${over.length ? `<div class="alert soft">Journées trop chargées : ${over.join(', ')} (au-delà de ${fmtMin(P.cap)}).</div>` : ''}
  <div class="row"><button class="btn sm ghost" data-addbreak>+ Ajouter une journée</button>${P.manual ? '<button class="btn sm ghost" data-autoplan>Revenir au calcul automatique</button>' : ''}</div>
  <div class="sb" id="sb">${legend}${P.days.map((d, i) => head(d, i) + d.sc.map(strip).join('')).join('')}${P.days[P.days.length - 1] && !P.days[P.days.length - 1].sc.length ? '<div class="sb-empty">Journée vide : glissez des séquences ici</div>' : ''}</div></div>
  <div class="panel"><h2>Résumé par journée</h2><div class="tw"><table id="tPdt"><thead><tr><th>Jour</th><th>Date</th><th>Effet</th><th>Décor(s)</th><th>Séquences</th><th>Pages</th><th>Temps</th><th>Rôles</th><th>Notes</th></tr></thead><tbody>
  ${P.days.map(d => `<tr class="${d.over ? 'overrow' : ''}"><td><b>J${d.n}</b></td><td class="nw">${fdate(d.date)}</td><td>${d.mixed ? 'JOUR / NUIT' : d.night ? 'NUIT' : 'JOUR'}</td><td>${[...new Set(d.sc.map(s => s.dk))].map(esc).join('<br>')}</td><td>${d.sc.map(s => `<button class="scn chipb" data-scene="${esc(s.k)}">${esc(s.num)}</button>`).join(' ')}</td><td>${fmtE(d.e)}</td><td class="nw">${fmtMin(d.min)}</td><td>${d.roles.map(r => `<span class="rid ${d.conflicts.includes(r.name) ? 'bad' : ''}">${r.id}</span>`).join('')}</td>${ed('pdt.' + d.n + '.note', d.moves ? d.moves + ' déplacement(s)' : '')}</tr>`).join('')}
  </tbody></table></div></div>`;
}

export function renderFds(P, project, dayIdx) {
  if (!P.scenes.length) return empty;
  const ed = makeEd(project);
  if (dayIdx >= P.days.length) dayIdx = 0;
  const cs = callSheet(P, project, dayIdx), { d, set, pat, rows, end, cast, needs, fig, decors, next: nx } = cs;
  const ph = 'À compléter';
  return `<div class="panel noprint"><div class="row between"><div class="row"><select id="daySel">${P.days.map((x, i) => `<option value="${i}" ${i === dayIdx ? 'selected' : ''}>J${x.n} — ${fdate(x.date)} — ${x.mixed ? 'JOUR / NUIT' : x.night ? 'NUIT' : 'JOUR'}</option>`).join('')}</select>
  <button class="btn sm ghost" data-day="${dayIdx - 1}" ${dayIdx ? '' : 'disabled'}>←</button><button class="btn sm ghost" data-day="${dayIdx + 1}" ${nx ? '' : 'disabled'}>→</button></div>
  <div class="row"><button class="btn sm ghost" data-copytext="sheet">Copier le texte</button><button class="btn sm" data-print>Imprimer</button></div></div>
  <p class="note">Tout est modifiable : PAT, horaires, noms, adresses… Les horaires suivent le temps estimé de chaque séquence (réglages dans le Plan de travail) ; changer la PAT recalcule la journée.</p></div>
  <div class="sheet" id="sheet">
   ${d.conflicts.length ? `<div class="alert">⚠ Indisponible ce jour : ${d.conflicts.map(esc).join(', ')}</div>` : ''}<div class="hd"><div><h3>${esc(project.name)}</h3><div>Feuille de service · ${esc(set.prod) || ed('fds.prod', '', 'span', 'Production')} · Réal. ${esc(set.real) || ed('fds.real', '', 'span', 'Réalisation')}</div><div>${fdateL(d.date)}</div></div>
   <div class="ar"><div class="big">J${d.n}/${P.days.length}</div><div>${d.night ? 'Tournage de nuit' : 'Tournage de jour'}</div></div></div>
   <div class="kv">
    <div><b>PAT (prêt à tourner)</b><input class="patin" type="time" data-pat="${d.n}" value="${hm(pat).replace('h', ':')}"></div>
    <div><b>Fin prévue</b>${hm(end)}</div>
    <div><b>Météo</b>${ed('fds.' + d.n + '.meteo', '', 'span', ph)}</div>
    <div><b>Lever / coucher du soleil</b>${ed('fds.' + d.n + '.sun', '', 'span', ph)}</div>
    ${decors.map(({ k }) => `<div><b>Décor · ${esc(k)}</b>${ed('addr.' + k, '', 'span', 'Adresse')}<br>${ed('park.' + k, '', 'span', 'Parking / cantine')}</div>`).join('')}
    <div><b>Hôpital le plus proche</b>${ed('fds.hosp', '', 'span', ph)}</div>
    <div><b>Production</b>${ed('fds.cProd', '', 'span', 'Nom · tél.')}</div>
    <div><b>Régie</b>${ed('fds.cReg', '', 'span', 'Nom · tél.')}</div>
    <div><b>1er assistant</b>${ed('fds.c1er', '', 'span', 'Nom · tél.')}</div>
   </div>
   <h4>Séquences du jour</h4>
   <div class="tw2"><table><thead><tr><th>Heure</th><th>Sc.</th><th>Effet</th><th>Décor</th><th>Résumé</th><th>Rôles</th><th>Pages</th></tr></thead><tbody>
   ${rows.map(r => r.type === 'scene' ? `<tr>${ed(r.key, r.atL)}<td><button class="scn" data-scene="${esc(r.s.k)}">${esc(r.s.num)}</button></td><td>${r.s.ie} ${esc(r.s.timeL)}</td><td>${esc(r.s.decor)}</td><td>${esc(r.s.summary)}</td><td>${r.s.roles.map(x => x.id).join(', ')}</td><td>${fmtE(r.s.e)}</td></tr>` : `<tr class="${r.type}"><td>${hm(r.at)}</td><td colspan="6">${esc(r.label)}</td></tr>`).join('')}
   <tr><td colspan="6"><b>Total</b></td><td><b>${fmtE(d.e)}</b></td></tr></tbody></table></div>
   <h4>Comédiens</h4>
   <div class="tw2"><table><thead><tr><th>ID</th><th>Rôle</th><th>Comédien·ne</th><th>Arrivée</th><th>HMC</th><th>Prêt plateau</th><th>Scènes</th></tr></thead><tbody>
   ${cast.map(c => `<tr><td>${c.r.id}</td><td><button class="lnk" data-ent="ch:r:${esc(c.r.name)}">${esc(c.r.name)}</button></td>${ed('cast.' + c.r.name + '.n', '', 'td', 'à compléter')}${ed(c.ck('arr'), c.arriveL)}${ed(c.ck('hmc'), c.hmcL)}${ed(c.ck('ready'), c.readyL)}<td>${c.scenes.join(', ')}</td></tr>`).join('')}
   </tbody></table></div>
   ${fig.length ? `<h4>Silhouettes / figuration</h4><table><tbody>${fig.map(f => `<tr><td class="w60">Sc. ${esc(f.s.num)}</td><td>${esc(f.text)}</td>${ed('fds.' + d.n + '.fig.' + f.s.k, '', 'td', 'Nombre · convocation')}</tr>`).join('')}</tbody></table>` : ''}
   <h4>Besoins particuliers</h4>
   <table><tbody>${needs.map(([k, l, v]) => `<tr><td class="w130"><b>${l}</b></td><td>${esc(v)}</td></tr>`).join('') || '<tr><td>Rien de signalé dans le dépouillement.</td></tr>'}</tbody></table>
   <h4>Équipe technique</h4>
   <table><thead><tr><th>Département</th><th>Convocation</th></tr></thead><tbody>
   ${CREW.map(([n, o]) => `<tr><td>${n}</td>${ed('fds.' + d.n + '.crew.' + n, hm(pat + o))}</tr>`).join('')}
   </tbody></table>
   <h4>Remarques</h4><p>${ed('fds.' + d.n + '.rem', '', 'span', 'Consignes, sécurité, autorisations de tournage…')}</p>
   <h4>Prévisions du lendemain</h4>
   <p>${nx ? `J${nx.n} · ${fdateL(nx.date)} · ${nx.night ? 'NUIT' : 'JOUR'} · ${[...new Set(nx.sc.map(s => s.dk))].map(esc).join(', ')} · Sc. ${nx.sc.map(s => s.num).join(', ')}` : 'Dernier jour de tournage.'}</p>
  </div>`;
}

// ---------- Découpage technique (liste des plans) ----------
// Planche de storyboard : cases 16:9, en-tête Scène / Plan / Format, valeur de plan sur le côté, légende manuscrite
function decBoard(P, project, list) {
  const shots = project.shots || {}, ratio = (project.settings || {}).ratio || '16:9';
  let page = 0;
  return list.map(s => { const sh = shots[s.k] || []; page++; return `<section class="sbpage" id="dec-${esc(s.k)}">
    <div class="sbp-h"><h2>Storyboard</h2><div class="sbp-meta"><span>Projet</span><b class="hand" data-nt>${esc(project.name)}</b><span>Page</span><b class="hand">${page}</b></div></div>
    <div class="sbp-sub"><span class="fxp ${cls(s)}">${esc(s.num)}</span>${s.ie} ${esc(s.timeL)} · ${esc(s.decor)}<span class="sp"></span><button class="btn sm ghost" data-dadd="${esc(s.k)}">+ Plan</button><button class="btn sm ghost" data-dai="${esc(s.k)}">✦ IA</button></div>
    <div class="sbgrid">${sh.map((x, i) => `<div class="sbp">
      <div class="sbp-cells"><span><i>Scène</i>${esc(s.num)}</span><span><i>Plan</i>${shotLabel(s, i)}</span><span><i>Format</i>${esc(ratio)}</span></div>
      <div class="sbp-frame"><em class="sbp-side hand">${esc(x.size || '')}</em>${x.img ? `<button class="sbp-img" data-dsketch="${esc(s.k)}|${x.id}" title="Redessiner"><img src="${esc(x.img)}" alt=""></button>` : `<button class="sbp-empty" data-dsketch="${esc(s.k)}|${x.id}">✎ Dessiner ce plan</button>`}${x.move && x.move !== 'Fixe' ? `<span class="sbp-move hand">${esc(x.move)} →</span>` : ''}</div>
      <div class="sbp-cap hand" dir="auto" contenteditable="true" spellcheck="false" data-shot="${esc(s.k)}|${x.id}|desc" data-ph="Ce que l’on voit">${esc(x.desc || '')}</div>
      <div class="sbp-sub2 hand" dir="auto">${esc([x.angle, x.lens, x.dur ? x.dur + ' s' : ''].filter(Boolean).join(' · '))}</div></div>`).join('') || `<p class="note">Pas encore de plans : « + Plan » ou « ✦ IA ».</p>`}</div></section>`; }).join('');
}
export function renderDec(P, project, epf) {
  if (!P.scenes.length) return empty;
  const view = (() => { try { return localStorage.getItem('sp.decview') || 'table'; } catch (e) { return 'table'; } })();
  const shots = project.shots || {};
  const list = P.series && epf ? P.scenes.filter(x => x.epId === epf) : P.scenes;
  const total = list.reduce((a, s) => a + (shots[s.k] || []).length, 0), done = list.filter(s => (shots[s.k] || []).length).length;
  const secs = list.reduce((a, s) => a + (shots[s.k] || []).reduce((b, x) => b + (parseFloat(x.dur) || 0), 0), 0);
  const sel = (k, id, f, v) => `<select class="csel" data-shot="${esc(k)}|${id}|${f}">${SHOT[f].map(o => `<option ${o === (v || '') ? 'selected' : ''} value="${esc(o)}">${o || '—'}</option>`).join('')}</select>`;
  const txt = (k, id, f, v, ph) => `<td class="ed" contenteditable="true" spellcheck="false" data-shot="${esc(k)}|${id}|${f}" data-ph="${esc(ph)}">${esc(v || '')}</td>`;
  const epBar = P.series ? `<div class="pills epf">${[['', 'Tous les épisodes'], ...P.episodes.map(e => [e.id, e.n + '. ' + e.name])].map(([id, l]) => `<button class="pill ${(epf || '') === id ? 'on' : ''}" data-epf="${id}">${esc(l)}</button>`).join('')}</div>` : '';
  return `<div class="panel"><div class="row between"><h2>Découpage technique</h2><div class="row"><button class="btn sm" data-dai="">✦ Découper avec Moodboard AI</button><div class="seg"><button data-dview="table" class="${view === 'table' ? 'on' : ''}">Tableau</button><button data-dview="board" class="${view === 'board' ? 'on' : ''}">Planche</button></div><button class="btn sm ghost" data-print>Imprimer</button></div></div>
  <div class="stats"><div class="stat"><b>${total}</b><span>Plans</span></div><div class="stat"><b>${done}/${list.length}</b><span>Scènes découpées</span></div><div class="stat"><b>${secs ? fmtMin(secs / 60) : '—'}</b><span>Durée à l’écran</span></div></div>
  ${epBar}<p class="note">Pour chaque scène : valeur de plan, angle, mouvement, objectif, action et son. Touchez « ✎ croquis » pour dessiner le plan. Quand une scène a un découpage, son temps de tournage est calculé d’après le nombre de plans.</p></div>
  ${view === 'board' ? decBoard(P, project, list) : list.map(s => { const sh = shots[s.k] || []; return `<section class="panel dsc" id="dec-${esc(s.k)}">
    <div class="dsh"><span class="fxp ${cls(s)}">${esc(s.num)}</span><b>${s.ie} ${esc(s.timeL)} · ${esc(s.decor)}</b><span class="m">${esc(s.summary || '')}</span>
      <span class="sp"></span><small>${sh.length} plan${sh.length > 1 ? 's' : ''} · ${fmtMin(s.est)}</small><button class="btn sm ghost" data-dadd="${esc(s.k)}">+ Plan</button><button class="btn sm ghost" data-dai="${esc(s.k)}">✦ IA</button></div>
    ${sh.length ? `<div class="tw"><table class="dect"><thead><tr><th>Plan</th><th>Croquis</th><th>Valeur</th><th>Angle</th><th>Mouvement</th><th>Objectif</th><th>Action / description</th><th>Son / dialogue</th><th>Durée (s)</th><th></th></tr></thead><tbody>
    ${sh.map((x, i) => `<tr><td class="nw"><b>${shotLabel(s, i)}</b></td><td class="thumbc">${x.img ? `<button class="shimg" data-dsketch="${esc(s.k)}|${x.id}" title="Redessiner"><img src="${esc(x.img)}" alt=""></button>` : `<button class="link" data-dsketch="${esc(s.k)}|${x.id}">✎ croquis</button>`}</td>
      <td>${sel(s.k, x.id, 'size', x.size)}</td><td>${sel(s.k, x.id, 'angle', x.angle)}</td><td>${sel(s.k, x.id, 'move', x.move)}</td>${txt(s.k, x.id, 'lens', x.lens, '35 mm')}${txt(s.k, x.id, 'desc', x.desc, 'Ce que l’on voit')}${txt(s.k, x.id, 'sound', x.sound, 'Dialogue, son')}${txt(s.k, x.id, 'dur', x.dur, '5')}
      <td class="nw acts"><button data-dmv="${esc(s.k)}|${x.id}|-1" ${i ? '' : 'disabled'}>↑</button><button data-dmv="${esc(s.k)}|${x.id}|1" ${i < sh.length - 1 ? '' : 'disabled'}>↓</button><button data-ddel="${esc(s.k)}|${x.id}">✕</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="note">Pas encore de plans.</p>'}</section>`; }).join('')}`;
}

// ---------- Budget ----------
import { computeBudget, CURRENCIES, UNITS, money } from './budget.js';
import { LANG, LOCALES, tr } from './i18n.js';
export function renderBud(P, project) {
  const B = computeBudget(project, P), b = B.b, loc = LOCALES[LANG] || 'fr-FR', m = (v, c = b.cur, ex) => money(v, c, loc, ex);
  const curSel = (attr, v) => `<select ${attr}>${CURRENCIES.map(c => `<option ${c === v ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
  const unitSel = (attr, v) => `<select ${attr}>${UNITS.map(u => `<option value="${u}" ${u === v ? 'selected' : ''}>${u}</option>`).join('')}</select>`;
  const row = r => {
    const id = r.auto ? `a:${esc(r.key)}` : `l:${esc(r.id)}`;
    return `<tr class="${r.auto ? 'auto' : ''}">
      <td>${r.auto ? `<span class="bl" data-nt>${esc(r.key === 'int.fig' || !/^(int|lieux)\./.test(r.key) ? tr(r.label) : r.label)}</span>` : `<input class="bi" data-bl="${id}|label" value="${esc(r.label)}" placeholder="Libellé">`}${r.auto && r.qty !== r.sugg ? `<small class="bsg">${tr('calculé')} : ${r.sugg}</small>` : ''}</td>
      <td><input class="bn" type="number" min="0" step="any" inputmode="decimal" data-bl="${id}|qty" value="${r.qty}"></td>
      <td>${unitSel(`data-bl="${id}|unit"`, r.unit)}</td>
      <td><input class="bn r" type="number" min="0" step="any" inputmode="decimal" data-bl="${id}|rate" value="${r.rate || ''}" placeholder="0"></td>
      <td>${curSel(`data-bl="${id}|c"`, r.c)}</td>
      <td class="btot">${r.tot ? (r.c === b.cur ? m(r.tot) : `${m(r.totMain)}<small>${m(r.tot, r.c)}</small>`) : '<span class="muted">—</span>'}</td>
      <td><button class="bx" data-bdel="${id}" title="${r.auto ? 'Masquer la ligne' : 'Supprimer'}">✕</button></td></tr>`;
  };
  const hidden = Object.entries(b.auto).filter(([, o]) => o && o.off).length;
  const pct = v => B.totalTND ? Math.round(v / B.totalTND * 100) + ' %' : '—';
  return `<div class="panel bud"><div class="row between"><h2>Budget</h2><div class="row"><button class="btn sm inv-btn" data-binv>Facture / devis PDF</button><button class="btn sm ghost" data-bcsv>Exporter (Excel)</button><button class="btn sm ghost" data-print>Imprimer</button></div></div>
  <div class="bud-top">
    <div class="bud-total"><span>${tr('Total')} (${b.cur})</span><b>${m(B.total[b.cur])}</b><em>${CURRENCIES.filter(c => c !== b.cur).map(c => B.total[c] != null ? m(B.total[c], c) : `<span class="muted">${c} : ${tr('taux à saisir')}</span>`).join(' · ')}</em></div>
    ${B.ai ? `<div class="stat"><b>${B.shots}</b><span>Plans à générer</span></div>` : `<div class="stat"><b>${B.days}</b><span>Jours de tournage</span></div>`}
    <div class="stat"><b>${m(B.sub[b.cur])}</b><span>Sous-total</span></div>
    <div class="stat"><b>${m(B.cont[b.cur])}</b><span>Imprévus (${+b.cont || 0} %)</span></div>
  </div>
  ${B.missing.length ? `<p class="warn">⚠ ${tr('Saisissez le taux de change pour')} ${B.missing.join(', ')}.</p>` : ''}
  <details class="more-f" open><summary>Devises et réglages</summary><div class="grid4">
    <label class="fl">Devise principale${curSel('data-bs="cur"', b.cur)}</label>
    <label class="fl">1 EUR = … TND<input type="number" min="0" step="any" inputmode="decimal" data-bs="fx.EUR" value="${+b.fx.EUR || ''}" placeholder="taux du jour"></label>
    <label class="fl">1 USD = … TND<input type="number" min="0" step="any" inputmode="decimal" data-bs="fx.USD" value="${+b.fx.USD || ''}" placeholder="taux du jour"></label>
    <label class="fl">Imprévus (%)<input type="number" min="0" max="50" step="1" data-bs="cont" value="${+b.cont || 0}"></label>
    ${B.ai ? '' : `<label class="fl">Préparation (semaines)<input type="number" min="0" step="1" data-bs="prepW" value="${+b.prepW || 0}"></label>`}
    <label class="fl">Post-production (semaines)<input type="number" min="0" step="1" data-bs="postW" value="${+b.postW || 0}"></label>
    ${B.ai ? '' : `<label class="fl">Équipe sur le plateau (pers.)<input type="number" min="0" step="1" data-bs="crew" value="${+b.crew || 0}"></label>`}
  </div><p class="note"><span>Les taux restent ceux que vous saisissez : le budget ne change pas tout seul.</span> <span>${B.ai ? 'Les quantités sont calculées depuis le nombre de plans du découpage ; vous pouvez les modifier.' : 'Les quantités sont calculées depuis le plan de travail et la liste artistique ; vous pouvez les modifier.'}</span></p></details>
  <div class="bud-sum"><h3>Récapitulatif</h3><table class="tbl"><thead><tr><th>Poste</th><th class="r">${b.cur}</th><th class="r">%</th></tr></thead><tbody>
    ${B.cats.map(c => `<tr><td>${esc(tr(c.label))}</td><td class="r">${m(fromMain(B, c.totTND))}</td><td class="r">${pct(c.totTND)}</td></tr>`).join('')}
    <tr class="sub"><td>Sous-total</td><td class="r">${m(B.sub[b.cur])}</td><td class="r">${pct(B.subTND)}</td></tr>
    <tr><td>Imprévus (${+b.cont || 0} %)</td><td class="r">${m(B.cont[b.cur])}</td><td class="r">${pct(B.contTND)}</td></tr>
    <tr class="grand"><td>Total</td><td class="r">${m(B.total[b.cur])}</td><td class="r">100 %</td></tr></tbody></table></div>
  ${B.cats.map(c => `<section class="bud-cat"><div class="row between"><h3>${esc(tr(c.label))}</h3><span class="bud-st">${m(fromMain(B, c.totTND))}</span></div>
    <div class="tscroll"><table class="tbl btab"><thead><tr><th>Ligne</th><th>Qté</th><th>Unité</th><th>Tarif</th><th>Devise</th><th class="r">Total</th><th></th></tr></thead><tbody>${c.rows.map(row).join('')}</tbody></table></div>
    <button class="link" data-badd="${c.id}">+ Ajouter une ligne</button></section>`).join('')}
  ${hidden ? `<p class="note">${hidden} ${tr('ligne(s) masquée(s)')} · <button class="link" data-bshow>${tr('Tout réafficher')}</button></p>` : ''}
  </div>`;
}
const fromMain = (B, tnd) => { const b = B.b; return b.cur === 'TND' ? tnd : (+b.fx[b.cur] > 0 ? tnd / +b.fx[b.cur] : null); };
export function budgetCSV(P, project) {
  const B = computeBudget(project, P), b = B.b, q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"', n = v => v == null ? '' : String(Math.round(v * 1000) / 1000);
  const L = [[tr('Poste'), tr('Ligne'), tr('Qté'), tr('Unité'), tr('Tarif'), tr('Devise'), tr('Total ligne'), `${tr('Total')} ${b.cur}`].map(q).join(';')];
  B.cats.forEach(c => c.rows.forEach(r => L.push([tr(c.label), r.label, n(r.qty), tr(r.unit), n(r.rate), r.c, n(r.tot), n(r.totMain)].map(q).join(';'))));
  L.push(''); L.push([tr('Sous-total'), '', '', '', '', '', '', n(B.sub[b.cur])].map(q).join(';'));
  L.push([`${tr('Imprévus')} ${+b.cont || 0} %`, '', '', '', '', '', '', n(B.cont[b.cur])].map(q).join(';'));
  CURRENCIES.forEach(c => L.push([`${tr('Total')} ${c}`, '', '', '', '', '', '', n(B.total[c])].map(q).join(';')));
  return '﻿' + L.join('\r\n');
}
