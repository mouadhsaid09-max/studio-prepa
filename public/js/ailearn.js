// Apprentissage de l'assistant : il étudie les résultats notés par l'utilisateur
// (bon résultat / à refaire, plan validé en post-production) et en tire des règles
// qu'il applique ensuite pour améliorer les autres prompts.
// Données : project.ai.fb[clé] = { r: 1 | -1, note, image, motion, tool, at } ; project.ai.lessons = [texte] ; project.ai.learnedAt
// Habitudes partagées entre les projets de ce navigateur : localStorage « goset.lessons ».
import { esc } from './parser.js';
import { tr } from './i18n.js';

const LS = 'goset.lessons';
const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
const lsSet = v => { try { localStorage.setItem(LS, JSON.stringify(v.slice(0, 12))); } catch (e) { /* rien */ } };

const A = p => { const a = p.ai ||= {}; a.fb ||= {}; a.lessons ||= []; return a; };

// Notation d'un plan (snapshot du prompt au moment de la note)
export function rate(project, shot, r) {
  const a = A(project), cur = a.fb[shot.key];
  if (cur && cur.r === r) { delete a.fb[shot.key]; return null; } // re-clic = annuler
  const tool = ((a.post || {}).st || {})[shot.key]?.tool || '';
  a.fb[shot.key] = { r, note: cur?.note || '', image: shot.image, motion: shot.motion, tool, at: Date.now() };
  return a.fb[shot.key];
}

// Résultats : notes explicites + plans validés en post-production
export function results(project, list) {
  const a = A(project), st = (a.post || {}).st || {};
  const good = [], bad = [];
  list.forEach(x => {
    const f = a.fb[x.key], valid = st[x.key]?.stage === 'Validé';
    if (f?.r === 1 || (valid && !f)) good.push({ label: x.label, image: f?.image || x.image, motion: f?.motion || x.motion, note: f?.note || '', tool: f?.tool || st[x.key]?.tool || '' });
    else if (f?.r === -1) bad.push({ label: x.label, image: f.image, motion: f.motion, note: f.note, tool: f.tool });
  });
  return { good, bad, fresh: Object.values(a.fb).filter(f => f.at > (a.learnedAt || 0)).length };
}

// Ce qui est ajouté au contexte de l'assistant : règles apprises + meilleurs exemples
export function lessonsBlock(project, list) {
  const a = A(project), glob = lsGet().filter(l => !a.lessons.includes(l));
  const { good } = results(project, list);
  const ex = good.slice(0, 2).map(g => `- ${g.label}${g.tool ? ' (' + g.tool + ')' : ''}: ${g.image.slice(0, 400)}`).join('\n');
  if (!a.lessons.length && !glob.length && !ex) return '';
  return `\nCE QUI MARCHE POUR CET UTILISATEUR (à appliquer à chaque prompt) :
${[...a.lessons, ...glob.slice(0, 6)].map(l => '- ' + l).join('\n') || '- (pas encore de règle)'}
${ex ? 'EXEMPLES DE PROMPTS QUI ONT DONNÉ DE BONS RÉSULTATS :\n' + ex : ''}`;
}

// Étude des résultats : renvoie { feedback, lessons[] }
export async function learn(ask, parseJSON, project, list, contextText) {
  const { good, bad } = results(project, list);
  if (good.length + bad.length < 2) throw new Error(tr('Notez au moins 2 plans (bon résultat ou à refaire) pour que l’assistant apprenne.'));
  const fmt = arr => arr.slice(0, 8).map(x => `- ${x.label}${x.tool ? ' [' + x.tool + ']' : ''}\n  IMAGE: ${x.image.slice(0, 500)}\n  MOTION: ${x.motion.slice(0, 200)}${x.note ? '\n  NOTE DE L’UTILISATEUR: ' + x.note : ''}`).join('\n');
  const msg = [{ role: 'system', content: contextText },
    { role: 'user', content: `Étudie mes résultats de génération. Compare les prompts qui ont donné de bons résultats à ceux qui sont à refaire, et trouve ce qui fait la différence (vocabulaire, ordre, précision des personnages, lumière, objectif, mouvement, longueur, outil).
BONS RÉSULTATS :
${fmt(good) || '(aucun)'}
À REFAIRE :
${fmt(bad) || '(aucun)'}
Réponds uniquement en JSON : {"feedback": "3 à 5 phrases courtes en français pour l’utilisateur : ce qui marche, ce qui ne marche pas, quoi changer", "lessons": ["règle courte et concrète en anglais à appliquer aux prochains prompts", "..."]} avec 3 à 6 règles.` }];
  const j = parseJSON(await ask(msg));
  const lessons = (Array.isArray(j?.lessons) ? j.lessons : []).map(x => String(x).trim()).filter(Boolean).slice(0, 6);
  if (!lessons.length) throw new Error(tr('Réponse illisible, réessayez.'));
  const a = A(project); a.lessons = lessons; a.learnedAt = Date.now();
  lsSet([...lessons, ...lsGet().filter(l => !lessons.includes(l))]);
  return { feedback: String(j.feedback || '').trim(), lessons };
}

// Encadré « Ce que l'assistant a appris » (dans l'onglet Assistant)
export function renderLearn(project, list) {
  const a = A(project), R = results(project, list);
  return `<div class="alearn">
    <div class="row between"><h3>${tr('Ce que l’assistant a appris')}</h3><span class="aln-c"><b class="g">${R.good.length}</b> ${tr('bons')} · <b class="b">${R.bad.length}</b> ${tr('à refaire')}</span></div>
    ${a.lessons.length ? `<ul class="aln-l">${a.lessons.map((l, i) => `<li><span dir="ltr">${esc(l)}</span><button class="bx" data-alndel="${i}" title="${tr('Supprimer')}">✕</button></li>`).join('')}</ul>` : `<p class="note">${tr('Notez vos plans dans « Prompts des plans » (bon résultat ou à refaire), puis demandez à l’assistant d’étudier vos résultats. Il appliquera ce qui marche à tous vos prompts.')}</p>`}
    <div class="row wrap"><button class="btn sm ai-grad" data-alearn ${R.good.length + R.bad.length < 2 ? 'disabled' : ''}>✦ ${a.lessons.length ? tr('Mettre à jour avec mes résultats') : tr('Étudier mes résultats')}</button>${R.fresh && a.learnedAt ? `<span class="aln-new">${R.fresh} ${tr('nouveau(x) résultat(s)')}</span>` : ''}</div>
  </div>`;
}

// Notation sous chaque plan (dans « Prompts des plans »)
export function renderRate(project, shot) {
  const f = A(project).fb[shot.key];
  return `<div class="arate"><span>${tr('Résultat')}</span>
    <button class="ar ${f?.r === 1 ? 'on g' : ''}" data-arate="${esc(shot.key)}|1" aria-pressed="${f?.r === 1}">👍 ${tr('Bon résultat')}</button>
    <button class="ar ${f?.r === -1 ? 'on b' : ''}" data-arate="${esc(shot.key)}|-1" aria-pressed="${f?.r === -1}">👎 ${tr('À refaire')}</button>
    ${f ? `<input class="ar-note" data-arnote="${esc(shot.key)}" value="${esc(f.note || '')}" placeholder="${tr('Pourquoi ? (visage changé, mains, lumière…)')}">` : ''}</div>`;
}
export function removeLesson(project, i) { const a = A(project); const l = a.lessons.splice(i, 1)[0]; lsSet(lsGet().filter(x => x !== l)); }
export function setNote(project, key, v) { const f = A(project).fb[key]; if (f) f.note = v; }
