// Profil (titre de métier) et distinctions discrètes.
// Pas de points ni de classement : une poignée de jalons réels de préparation,
// chacun salué une seule fois par une petite carte « palmarès ».
import { tr } from './i18n.js';
import { bible } from './parser.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const WORK_TITLES = ['Réalisateur·rice', 'Producteur·rice', 'Producteur·rice exécutif·ve', '1er·e assistant·e réalisation', 'Scénariste', 'Directeur·rice de production', 'Régisseur·se', 'Chef·fe opérateur·rice', 'Studio IA', 'Étudiant·e en cinéma'];

// [id, nom, phrase, icône, rang] — rang : bronze, silver (argent) ou gold (or)
export const BADGES = [
  ['first', 'Premier clap', 'Votre premier projet est ouvert. Silence sur le plateau.', 'clap', 'bronze'],
  ['dep', 'Dépouillement bouclé', 'Les éléments de presque toutes les scènes sont listés.', 'list', 'bronze'],
  ['pdf', 'Dossier envoyé', 'Votre premier dossier PDF est sorti.', 'ticket', 'bronze'],
  ['invoice', 'Bon pour accord', 'Première facture ou premier devis émis.', 'quill', 'bronze'],
  ['bible', 'Le monde existe', 'Dix entrées ou plus dans la Bible : personnages, lieux, objets.', 'globe', 'silver'],
  ['team', 'Générique de début', 'Cinq chefs de poste nommés dans l’équipe.', 'laurel', 'silver'],
  ['pdt', 'Le plan tient la route', 'Une date de premier jour et un plan de travail calculé.', 'reel', 'silver'],
  ['script', 'Nomination au meilleur scénario', 'Un scénario de dix scènes ou plus, découpé et prêt à être lu.', 'star', 'gold'],
  ['ai', 'Prix de la photographie', 'Trois plans IA approuvés : le style se précise.', 'lens', 'gold'],
  ['series', 'Saison complète', 'Une série ou une campagne avec trois épisodes ou spots.', 'cup', 'gold']
];
export const TIER = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };

// Icônes simples dessinées sur une grille 24 × 24 (rien de copié d’un trophée existant)
const ICON = {
  clap: '<path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 10 3.4 6.6a1 1 0 0 1 .8-1.2l13.8-2.4a1 1 0 0 1 1.2.8L19.6 7 4 10z" opacity=".85"/><path d="M7.5 5.7 9.6 9M12 4.9l2.1 3.3M16.4 4.1l1.6 2.6" stroke="currentColor" stroke-width="1.3" fill="none" opacity=".5"/>',
  list: '<rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  ticket: '<path d="M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15 7v10" stroke="currentColor" stroke-width="1.6" stroke-dasharray="1.8 1.6" fill="none"/>',
  quill: '<path d="M19.5 3.5C12 4.5 7.5 9.5 6 17l1.8.6C9 12.8 12 9 16.5 7 13.3 10 11 13.2 9.6 17.4c4.6-.9 8.2-5.3 9.9-13.9z"/><path d="M4 20.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  globe: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M3.5 12h17M12 3.5c2.8 2.6 2.8 14.4 0 17M12 3.5c-2.8 2.6-2.8 14.4 0 17" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  laurel: '<path d="M12 20c-4.5-1.5-7-5.5-7-11" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M12 20c4.5-1.5 7-5.5 7-11" stroke="currentColor" stroke-width="1.4" fill="none"/><g><ellipse cx="5.6" cy="9.5" rx="1.3" ry="2.4" transform="rotate(-20 5.6 9.5)"/><ellipse cx="6.4" cy="13.6" rx="1.3" ry="2.4" transform="rotate(-45 6.4 13.6)"/><ellipse cx="8.8" cy="17.2" rx="1.3" ry="2.4" transform="rotate(-65 8.8 17.2)"/><ellipse cx="18.4" cy="9.5" rx="1.3" ry="2.4" transform="rotate(20 18.4 9.5)"/><ellipse cx="17.6" cy="13.6" rx="1.3" ry="2.4" transform="rotate(45 17.6 13.6)"/><ellipse cx="15.2" cy="17.2" rx="1.3" ry="2.4" transform="rotate(65 15.2 17.2)"/></g><circle cx="12" cy="10" r="2.2"/>',
  reel: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7.4" r="2"/><circle cx="12" cy="16.6" r="2"/><circle cx="7.4" cy="12" r="2"/><circle cx="16.6" cy="12" r="2"/><circle cx="12" cy="12" r="1"/>',
  star: '<path d="M12 2.8l2.75 5.95 6.5.75-4.83 4.42 1.33 6.4L12 17.1l-5.75 3.22 1.33-6.4L2.75 9.5l6.5-.75z"/>',
  lens: '<rect x="2.5" y="7" width="13" height="10" rx="2"/><path d="M15.5 10.5l5.5-3v9l-5.5-3z"/><circle cx="9" cy="12" r="2.6" opacity=".5"/>',
  cup: '<path d="M7 3.5h10v4.5a5 5 0 0 1-10 0z"/><path d="M7 5H4.5v1.5A3 3 0 0 0 7.4 9.5M17 5h2.5v1.5a3 3 0 0 1-2.9 3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M11 12.6h2V16h-2z"/><path d="M8 20.5a4 4 0 0 1 8 0z"/>'
};
let mid = 0;
export function medal(b, size = 44, locked = false) {
  const t = locked ? 'off' : b[4], id = 'md' + (++mid);
  return `<span class="medal ${t}" style="--s:${size}px" aria-hidden="true"><svg viewBox="0 0 48 48" width="${size}" height="${size}">
    <defs><radialGradient id="${id}" cx="35%" cy="28%" r="75%"><stop offset="0" class="m0"/><stop offset=".55" class="m1"/><stop offset="1" class="m2"/></radialGradient></defs>
    <circle cx="24" cy="24" r="22.5" class="ring"/><circle cx="24" cy="24" r="19" fill="url(#${id})"/>
    <svg x="10" y="10" width="28" height="28" viewBox="0 0 24 24" class="ic">${ICON[b[3]] || ICON.star}</svg>
    <ellipse cx="19" cy="13" rx="12" ry="6.5" class="gloss" transform="rotate(-24 19 13)"/></svg></span>`;
}

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
    el.innerHTML = `${medal(b, 46)}<div><small>${esc(tr('Sélection officielle'))} · ${esc(tr(TIER[b[4]]))}${t ? ' · ' + esc(tr(t)) : ''}</small><b>${esc(tr(b[1]))}</b><p>${esc(tr(b[2]))}</p>${extra ? `<span class="more">${esc(tr('+ {n} autre(s) dans votre palmarès').replace('{n}', extra))}</span>` : ''}</div><button aria-label="${esc(tr('Fermer'))}">×</button>`;
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
    <div class="palm">${BADGES.map(b => { const g = p.badges[b[0]]; return `<div class="pb ${g ? 'on ' + b[4] : ''}">${medal(b, 44, !g)}<div><b>${esc(tr(b[1]))}</b><small>${esc(tr(b[2]))}${g?.project ? ' — ' + esc(g.project) : ''}</small></div></div>`; }).join('')}</div>
  </div>`;
}
