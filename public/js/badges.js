// Profil (titre de métier) et distinctions discrètes.
// Pas de points ni de classement : une poignée de jalons réels de préparation,
// chacun salué une seule fois par une petite carte « palmarès ».
import { tr } from './i18n.js';
import { bible } from './parser.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const WORK_TITLES = ['Réalisateur·rice', 'Producteur·rice', 'Producteur·rice exécutif·ve', '1er·e assistant·e réalisation', 'Scénariste', 'Directeur·rice de production', 'Régisseur·se', 'Chef·fe opérateur·rice', 'Studio IA', 'Étudiant·e en cinéma'];

// [id, nom, phrase, petit symbole]
export const BADGES = [
  ['first', 'Premier clap', 'Votre premier projet est ouvert. Silence sur le plateau.', '◐'],
  ['script', 'Nomination à l’Oscar du scénario', 'Un scénario de dix scènes ou plus, découpé et prêt à être lu.', '✦'],
  ['bible', 'Le monde existe', 'Dix entrées ou plus dans la Bible : personnages, lieux, objets.', '◈'],
  ['team', 'Générique de début', 'Cinq chefs de poste nommés dans l’équipe.', '❖'],
  ['dep', 'Dépouillement bouclé', 'Les éléments de presque toutes les scènes sont listés.', '▤'],
  ['pdt', 'Le plan tient la route', 'Une date de premier jour et un plan de travail calculé.', '▦'],
  ['ai', 'Prix de la photographie', 'Trois plans IA approuvés : le style se précise.', '◉'],
  ['pdf', 'Dossier envoyé', 'Votre premier dossier PDF est sorti.', '▣'],
  ['invoice', 'Bon pour accord', 'Première facture ou premier devis émis.', '✎'],
  ['series', 'Saison complète', 'Une série ou une campagne avec trois épisodes ou spots.', '❏']
];

const KEY = () => 'goset.profile.' + (window.__gosetUser || 'me');
export function profile() {
  try { return { title: '', badges: {}, seen: {}, ...JSON.parse(localStorage.getItem(KEY()) || '{}') }; } catch { return { title: '', badges: {}, seen: {} }; }
}
function saveProfile(p) { try { localStorage.setItem(KEY(), JSON.stringify(p)); } catch { /* stockage indisponible */ } }
export function setTitle(t) { const p = profile(); p.title = String(t || '').slice(0, 60); saveProfile(p); }
export function setUser(email) { window.__gosetUser = email || 'me'; }

// Une distinction ne se gagne qu’une fois, et au plus une carte toutes les 8 s pour rester discret
let lastShown = 0; const queue = [];
export function award(id, projectName) {
  const p = profile(); if (p.badges[id]) return false;
  const b = BADGES.find(x => x[0] === id); if (!b) return false;
  p.badges[id] = { at: Date.now(), project: projectName || '' }; saveProfile(p);
  queue.push(b); pump(); return true;
}
function pump() {
  if (!queue.length) return;
  const wait = Math.max(0, lastShown + 8000 - Date.now());
  clearTimeout(pump.t);
  // Plusieurs jalons d’un coup : une seule carte, les autres attendent dans le palmarès
  pump.t = setTimeout(() => {
    const b = queue.shift(); if (!b) return; const extra = queue.splice(0).length; lastShown = Date.now();
    document.querySelector('.laurel')?.remove();
    const el = document.createElement('div'); el.className = 'laurel'; el.setAttribute('role', 'status');
    const t = profile().title;
    el.innerHTML = `<span class="lg">${b[3]}</span><div><small>${esc(tr('Sélection officielle'))}${t ? ' · ' + esc(tr(t)) : ''}</small><b>${esc(tr(b[1]))}</b><p>${esc(tr(b[2]))}</p>${extra ? `<span class="more">${esc(tr('+ {n} autre(s) dans votre palmarès').replace('{n}', extra))}</span>` : ''}</div><button aria-label="${esc(tr('Fermer'))}">×</button>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); };
    el.querySelector('button').onclick = close; setTimeout(close, 6500);
  }, Math.max(wait, 600));
}

// Jalons calculés à partir de l’état du projet (appelé après chaque analyse)
export function checkProject(project, P) {
  if (!project) return;
  const n = project.name;
  award('first', n);
  const sc = P?.scenes?.length || 0;
  if (sc >= 10) award('script', n);
  let bc = 0; try { const B = bible(project, P); bc = B.ch.length + B.pl.length + B.ob.length; } catch { /* bible indisponible */ }
  if (bc >= 10) award('bible', n);
  const heads = (project.credits || []).filter(x => x.head && (x.name || '').trim()).length;
  if (heads >= 5) award('team', n);
  if (sc >= 3 && P.scenes.filter(s => Object.values(s.det || {}).some(v => String(v || '').trim())).length >= sc * 0.8) award('dep', n);
  if (project.settings?.start && P?.days?.length) award('pdt', n);
  const good = Object.values(project.ai?.fb || {}).filter(x => x.r === 1).length;
  if (good >= 3) award('ai', n);
  if ((project.episodes || 0) >= 3 || (Array.isArray(project.episodes) && project.episodes.length >= 3)) award('series', n);
}

export function renderProfile(me) {
  const p = profile(), got = BADGES.filter(b => p.badges[b[0]]);
  const opts = WORK_TITLES.map(t => `<option ${p.title === t ? 'selected' : ''}>${esc(tr(t))}</option>`).join('');
  return `<div class="prof">
    <div class="prof-h"><span class="av big">${esc((me?.name || '?').slice(0, 1).toUpperCase())}</span><div><h2>${esc(me?.name || '')}</h2><p class="mute">${esc(p.title ? tr(p.title) : tr('Ajoutez votre métier'))}</p></div></div>
    <label class="fld">${tr('Votre métier sur le plateau')}<input id="ptitle" list="ptitles" value="${esc(p.title)}" placeholder="${esc(tr('Réalisateur·rice, 1er·e assistant·e…'))}"><datalist id="ptitles">${opts}</datalist></label>
    <p class="mute sm">${tr('Le métier personnalise les distinctions. Elles saluent de vrais jalons de préparation, sans points ni classement.')}</p>
    <h3>${tr('Palmarès')} <small class="mute">${got.length} / ${BADGES.length}</small></h3>
    <div class="palm">${BADGES.map(b => { const g = p.badges[b[0]]; return `<div class="pb ${g ? 'on' : ''}"><span class="lg">${b[3]}</span><div><b>${esc(tr(b[1]))}</b><small>${esc(tr(b[2]))}${g?.project ? ' — ' + esc(g.project) : ''}</small></div></div>`; }).join('')}</div>
  </div>`;
}
