// Post-production IA : suivi de chaque plan généré jusqu'à la validation, finitions, son, livrables
// et transparence (mentions « contenu généré par IA »). Données dans project.ai.post.
import { esc } from './parser.js';
import { tr } from './i18n.js';

export const STAGES = ['À générer', 'Généré', 'Prise choisie', 'Composité', 'Upscalé', 'Étalonné', 'Son / lip-sync', 'Validé'];
export const POST_GROUPS = [
  ['fin', 'Finitions image', [
    ['sel', 'Garder seulement les secondes utilisables de chaque génération'],
    ['comp', 'Composites : nettoyer mains, visages, textes et objets qui changent'],
    ['up', 'Upscale avant l’étalonnage, jamais après'],
    ['grain', 'Léger grain et flou pour unifier les plans de modèles différents'],
    ['grade', 'Étalonnage et raccord couleur entre les plans'],
    ['interp', 'Interpolation d’images et stabilisation si besoin'],
    ['cont', 'Vérifier la continuité : visages, tenues, décors d’un plan à l’autre']]],
  ['snd', 'Son', [
    ['voice', 'Voix (comédien ou voix de synthèse autorisée)'],
    ['lip', 'Synchronisation labiale vérifiée'],
    ['music', 'Musique avec licence ou composée'],
    ['amb', 'Ambiances'],
    ['sfx', 'Bruitages et effets sonores'],
    ['mix', 'Mixage et niveau sonore cible respecté']]],
  ['out', 'Livrables', [
    ['r169', 'Version 16:9'], ['r916', 'Version 9:16 (Reels, TikTok, Shorts)'], ['r11', 'Version 1:1'], ['r45', 'Version 4:5'],
    ['srt', 'Sous-titres .srt synchronisés'], ['cs', 'Espace couleur Rec.709 vérifié'], ['master', 'Master haute qualité archivé']]],
  ['law', 'Transparence et droits', [
    ['label', 'Mention « contenu généré ou modifié par IA » sur les plateformes (YouTube, Meta, TikTok)'],
    ['eu', 'Diffusion dans l’UE : signaler clairement les deepfakes (AI Act, art. 50)'],
    ['meta', 'Ne pas effacer les métadonnées ou filigranes d’origine IA (C2PA)'],
    ['consent', 'Accord écrit des personnes dont le visage ou la voix est reproduit'],
    ['tos', 'Licences commerciales des outils IA utilisés vérifiées'],
    ['credits', 'Liste des outils et modèles utilisés remise au client']]]
];
const LOUD = [['-14', '−14 LUFS · web, réseaux'], ['-16', '−16 LUFS · podcasts, mobile'], ['-23', '−23 LUFS · télévision (EBU R128)'], ['-24', '−24 LKFS · télévision US (ATSC)']];
const RES = ['1920×1080', '3840×2160', '1080×1920', '1080×1080', '1080×1350'];
const FPS = ['24', '25', '30', '50', '60'];

export const postOf = a => { const p = a.post ||= {}; p.st ||= {}; p.chk ||= {}; p.loud ||= '-14'; p.res ||= '1920×1080'; p.fps ||= '24'; return p; };

export function postStats(a, list) {
  const p = postOf(a), n = list.length;
  const counts = STAGES.map(() => 0);
  list.forEach(x => counts[Math.max(0, STAGES.indexOf((p.st[x.key] || {}).stage || STAGES[0]))]++);
  const pct = n ? Math.round(list.reduce((s, x) => s + Math.max(0, STAGES.indexOf((p.st[x.key] || {}).stage || STAGES[0])), 0) / (n * (STAGES.length - 1)) * 100) : 0;
  const done = POST_GROUPS.map(([id, , items]) => [id, items.filter(([k]) => p.chk[k]).length, items.length]);
  return { counts, pct, done, valid: counts[STAGES.length - 1], n };
}

export function renderAIPost(a, list) {
  const p = postOf(a), S = postStats(a, list);
  const opt = (arr, v) => arr.map(x => Array.isArray(x) ? `<option value="${x[0]}" ${x[0] === v ? 'selected' : ''}>${tr(x[1])}</option>` : `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');
  return `<div class="aip">
    <div class="aip-top">
      <div class="aip-ring" style="--p:${S.pct}"><b>${S.pct}%</b><span>${tr('avancement')}</span></div>
      <div class="aip-flow">${STAGES.map((s, i) => `<div class="aip-st ${S.counts[i] ? 'on' : ''}"><b>${S.counts[i]}</b><span>${tr(s)}</span></div>`).join('<i></i>')}</div>
    </div>
    <p class="note">${tr('Ordre conseillé : choisir les meilleures secondes, composites, upscale, grain, étalonnage, interpolation, puis le son. Notez l’outil et le seed pour pouvoir régénérer un plan identique.')}</p>
    <h3>${tr('Plans')}</h3>
    ${list.length ? `<div class="tscroll"><table class="tbl aip-tab"><thead><tr><th>${tr('Plan')}</th><th>${tr('Étape')}</th><th>${tr('Outil / modèle')}</th><th>${tr('Seed / version')}</th><th>${tr('Note')}</th></tr></thead><tbody>
      ${list.map(x => { const s = p.st[x.key] || {}, k = esc(x.key), i = Math.max(0, STAGES.indexOf(s.stage || STAGES[0])); return `<tr class="${i === STAGES.length - 1 ? 'aip-ok' : ''}"><td><b>${esc(x.label)}</b><small data-nt>${esc(x.s.decor)}</small></td>
        <td><select class="aip-sel s${i}" data-aipo="${k}|stage">${opt(STAGES, STAGES[i])}</select></td>
        <td><input data-aipo="${k}|tool" value="${esc(s.tool || '')}" placeholder="Kling, Veo, Runway…"></td>
        <td><input data-aipo="${k}|seed" value="${esc(s.seed || '')}" placeholder="seed, v2…"></td>
        <td><input data-aipo="${k}|note" value="${esc(s.note || '')}" placeholder="${tr('Main à corriger…')}"></td></tr>`; }).join('')}</tbody></table></div>` : `<p class="note">${tr('Pas encore de scènes.')}</p>`}
    <div class="aip-set grid4">
      <label class="fl">${tr('Niveau sonore cible')}<select data-aipx="loud">${opt(LOUD, p.loud)}</select></label>
      <label class="fl">${tr('Résolution du master')}<select data-aipx="res">${opt(RES, p.res)}</select></label>
      <label class="fl">${tr('Images / seconde')}<select data-aipx="fps">${opt(FPS, p.fps)}</select></label>
    </div>
    <div class="aip-groups">${POST_GROUPS.map(([id, title, items], gi) => `<section class="aip-g ${id}"><div class="row between"><h3>${tr(title)}</h3><span class="aip-c">${S.done[gi][1]}/${S.done[gi][2]}</span></div>
      ${items.map(([k, l]) => `<label class="aip-ck"><input type="checkbox" data-aipc="${k}" ${p.chk[k] ? 'checked' : ''}><i></i><span>${tr(l)}</span></label>`).join('')}</section>`).join('')}</div>
    <p class="note">${tr('Ces repères ne remplacent pas un avis juridique : vérifiez les règles de chaque plateforme et du pays de diffusion.')}</p>
  </div>`;
}

export function onAIPostChange(a, e) {
  const d = e.target.dataset, p = postOf(a);
  if (d.aipo) { const j = d.aipo.lastIndexOf('|'), k = d.aipo.slice(0, j), f = d.aipo.slice(j + 1); (p.st[k] ||= {})[f] = e.target.value; return f === 'stage'; }
  if (d.aipc) { p.chk[d.aipc] = e.target.checked; return true; }
  if (d.aipx) { p[d.aipx] = e.target.value; return false; }
  return null;
}
