// Assistant GOSET (gratuit) : aide personnelle dans le Studio IA.
// Il améliore les prompts, écrit des notes de production et répond aux questions sur le projet.
// Données : project.ai.chat (derniers échanges) et project.ai.notes (notes gardées).
import { esc } from './parser.js';
import { tr } from './i18n.js';

export const ACTIONS = [
  ['enhance', 'Améliorer tous les prompts'],
  ['continuity', 'Notes de continuité'],
  ['chars', 'Vérifier les personnages'],
  ['ideas', 'Idées de plans'],
  ['post', 'Plan de post-production']
];
const ASK = {
  continuity: 'Écris des notes de continuité pour ce projet : pour chaque personnage, ce qui doit rester identique d’un plan à l’autre (visage, tenue, accessoires), et les risques de changement entre les plans générés. Liste courte et concrète.',
  chars: 'Vérifie les fiches personnages : signale ce qui manque ou reste vague pour garder le même visage d’un plan à l’autre, et propose une description plus précise (en anglais) pour chacun.',
  ideas: 'Propose 5 idées de plans forts pour ce projet (valeur de plan, mouvement, lumière), adaptés à la génération vidéo IA. Une ligne par idée.',
  post: 'Propose un plan de post-production court pour ce projet : ordre des étapes, outils possibles, points de vigilance (mains, visages, textes), son et livrables.'
};

const A = p => { const a = p.ai ||= {}; a.chat ||= []; a.notes ||= []; return a; };

// Contexte court envoyé à l'IA : jamais le scénario entier
export function context(project, P, list) {
  const a = project.ai || {}, ch = a.chars || {};
  const chars = P.roles.slice(0, 12).map(r => { const c = ch[r.name] || {}; return `- ${r.name}: ${[c.look, c.outfit, c.voice].filter(Boolean).join(' / ') || '(fiche vide)'}`; }).join('\n');
  const shots = list.slice(0, 30).map(x => `- ${x.label} (${x.s.ie} ${x.s.timeL}, ${x.s.decor}): ${(x.x.desc || x.s.summary || '').slice(0, 140)}`).join('\n');
  const skills = (a.skills || []).filter(s => s.on).map(s => s.name).join(', ');
  return `Tu es l’assistant GOSET, un assistant de production pour la réalisation avec l’IA (images et vidéo). Tu réponds dans la langue de l’utilisateur, de façon courte, concrète et professionnelle. Les prompts pour les générateurs sont toujours en anglais.
PROJET : ${project.name} (${project.format || 'film'})
STYLE : format ${(a.style || {}).ratio || '16:9'}${(a.style || {}).light ? ', lumière ' + a.style.light : ''}${(a.style || {}).palette ? ', palette ' + a.style.palette : ''}${skills ? ', compétences : ' + skills : ''}
PERSONNAGES :
${chars || '(aucun)'}
PLANS :
${shots || '(aucun)'}`;
}

// Rendu simple : échappement, gras **…**, listes, retours à la ligne
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n').map(l => /^\s*[-•*] /.test(l) ? `<span class="li">${l.replace(/^\s*[-•*] /, '')}</span>` : l + '<br>').join('').replace(/(<br>)+$/, '');

export function renderAssist(project, busy) {
  const a = A(project);
  return `<div class="asst">
    <div class="asst-main">
      <div class="asst-log" id="asstlog">${a.chat.length ? a.chat.map((m, i) => `<div class="msg ${m.role}"><div class="bub" ${m.role === 'assistant' ? 'dir="auto"' : ''}>${md(m.content)}</div>${m.role === 'assistant' ? `<div class="msg-act"><button class="link" data-anote="${i}">${tr('Garder en note')}</button><button class="link" data-acopy="${i}">${tr('Copier')}</button></div>` : ''}</div>`).join('') : `<div class="asst-empty"><b>${tr('Bonjour, je suis votre assistant.')}</b><p>${tr('Je connais vos personnages, vos plans et votre style. Demandez-moi un prompt, une idée de plan ou une note de production.')}</p></div>`}
        ${busy ? `<div class="msg assistant"><div class="bub typing"><i></i><i></i><i></i></div></div>` : ''}</div>
      <div class="asst-chips">${ACTIONS.map(([k, l]) => `<button class="chip ai" data-aact="${k}" ${busy ? 'disabled' : ''}>✦ ${tr(l)}</button>`).join('')}</div>
      <form class="asst-in" id="asstf"><textarea id="asstq" rows="2" placeholder="${tr('Écrivez votre question…')}" ${busy ? 'disabled' : ''}></textarea><button class="btn" ${busy ? 'disabled' : ''}>${tr('Envoyer')}</button></form>
      <p class="note">${tr('Gratuit. Seuls les noms, fiches et résumés des plans sont envoyés au service IA, jamais le scénario complet.')}${a.chat.length ? ` <button class="link" data-aclear>${tr('Effacer la conversation')}</button>` : ''}</p>
    </div>
    <aside class="asst-notes"><h3>${tr('Notes')}</h3>
      ${a.notes.length ? a.notes.map((n, i) => `<div class="anote"><div class="row between"><b>${esc(n.title)}</b><button class="bx" data-andel="${i}" title="${tr('Supprimer')}">✕</button></div><div class="anote-t">${md(n.text)}</div></div>`).join('') : `<p class="note">${tr('Gardez ici les réponses utiles : elles restent dans le projet.')}</p>`}
    </aside>
  </div>`;
}

// Amélioration d'un prompt de plan : renvoie { image, motion }
export async function enhanceShot(ask, project, P, list, shot, parseJSON) {
  const msg = [{ role: 'system', content: context(project, P, list) },
    { role: 'user', content: `Améliore les prompts de ce plan pour un générateur d’images et de vidéo. Garde les personnages identiques (jetons et descriptions), précise la composition, la lumière, l’objectif et le mouvement. Réponds uniquement en JSON : {"image": "...", "motion": "..."} (en anglais).
PLAN ${shot.label} — ${shot.s.ie} ${shot.s.timeL} — ${shot.s.decor}
IMAGE ACTUEL : ${shot.image}
MOUVEMENT ACTUEL : ${shot.motion}` }];
  const j = parseJSON(await ask(msg));
  if (!j || !j.image) throw new Error(tr('Réponse illisible, réessayez.'));
  return { image: String(j.image).trim(), motion: String(j.motion || shot.motion).trim() };
}

// o : { project, P, list(), ask(messages, signal), parseJSON, save, refresh(), toast, copy }
export function bindAssist(root, o) {
  let busy = false;
  const a = () => A(o.project);
  const scroll = () => setTimeout(() => { const l = root.querySelector('#asstlog'); if (l) l.scrollTop = l.scrollHeight; }, 0);
  const send = async (text, label) => {
    if (busy || !text.trim()) return;
    const c = a().chat; c.push({ role: 'user', content: label || text });
    busy = true; o.refresh(true); scroll();
    try {
      const msgs = [{ role: 'system', content: context(o.project, o.P, o.list()) }, ...c.slice(-10, -1), { role: 'user', content: text }];
      const r = await o.ask(msgs);
      c.push({ role: 'assistant', content: String(r || '').trim() || tr('Pas de réponse.') });
    } catch (e) { c.push({ role: 'assistant', content: '⚠ ' + (e.message || tr('Service IA indisponible.')) }); }
    if (c.length > 40) c.splice(0, c.length - 40);
    busy = false; o.save(); o.refresh(false); scroll();
  };
  const enhanceAll = async () => {
    const list = o.list().filter(x => !x.edited).slice(0, 12);
    if (!list.length) return o.toast(tr('Tous les prompts sont déjà personnalisés.'));
    busy = true; const c = a().chat; c.push({ role: 'user', content: '✦ ' + tr('Améliorer tous les prompts') }); o.refresh(true); scroll();
    let ok = 0;
    for (const x of list) {
      try { const r = await enhanceShot(o.ask, o.project, o.P, o.list(), x, o.parseJSON); const ov = (o.project.ai.shots ||= {})[x.key] ||= {}; ov.image = r.image; ov.motion = r.motion; ok++; o.save(); }
      catch (e) { /* plan suivant */ }
    }
    c.push({ role: 'assistant', content: ok ? `${ok} ${tr('prompts améliorés. Retrouvez-les dans « Prompts des plans » : « Rétablir l’automatique » annule un plan.')}` : '⚠ ' + tr('Service IA indisponible.') });
    busy = false; o.save(); o.refresh(false); scroll();
  };
  root.addEventListener('submit', e => { if (e.target.id !== 'asstf') return; e.preventDefault(); const q = root.querySelector('#asstq'); const t = q.value; q.value = ''; send(t); });
  root.addEventListener('keydown', e => { if (e.target.id === 'asstq' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); root.querySelector('#asstf').requestSubmit(); } });
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.querySelector('.asst')) return;
    if (b.dataset.aact) { const k = b.dataset.aact; return k === 'enhance' ? enhanceAll() : send(ASK[k], '✦ ' + tr(ACTIONS.find(x => x[0] === k)[1])); }
    if (b.dataset.anote != null) { const m = a().chat[+b.dataset.anote], q = a().chat[+b.dataset.anote - 1]; if (m) { a().notes.unshift({ title: (q ? q.content : tr('Note')).replace(/^✦ /, '').slice(0, 60), text: m.content, at: Date.now() }); o.save(); o.refresh(false); o.toast(tr('Note gardée')); } return; }
    if (b.dataset.acopy != null) { const m = a().chat[+b.dataset.acopy]; if (m) o.copy(m.content); return; }
    if (b.dataset.andel != null) { a().notes.splice(+b.dataset.andel, 1); o.save(); return o.refresh(false); }
    if (b.hasAttribute('data-aclear')) { a().chat = []; o.save(); return o.refresh(false); }
  });
  return { busy: () => busy, scroll };
}
