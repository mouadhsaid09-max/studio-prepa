// Réalisateur IA : barre de commande en bas du canvas.
// L'utilisateur écrit une demande ; l'IA lit tout le projet (scénario, Bible, plans, style) et renvoie
// des actions structurées que l'app applique : fiche personnage, scénario, plans avec prompts image/vidéo,
// notes, palette. Chaque envoi peut être annulé d'un clic.
import { tr } from './i18n.js';
import { bible, bibKey, SHOT } from './parser.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export const DIR_CHIPS = [
  ['Fiche personnage', 'Fais la fiche complète du personnage principal : âge, look, costume, personnalité, voix, et son prompt visuel.'],
  ['Découper en plans', 'Découpe la scène 1 en plans de cinéma, avec un prompt image et un prompt vidéo pour chaque plan.'],
  ['Écrire une scène', 'Écris une nouvelle scène qui suit la dernière, au même ton.'],
  ['Palette', 'Propose une palette de couleurs cinéma pour le film, avec une intention de lumière.'],
  ['Scénario complet', 'Écris un court scénario complet de 6 à 8 scènes à partir de mes notes et de la logline.']
];

// ---------- Contexte : un résumé compact de tout le projet ----------
function context(project, P, ep) {
  const e = project.edits || {}, a = project.ai || {}, B = bible(project, P);
  const field = (k, f) => e[bibKey(k, f)] || '';
  const film = ['logline', 'genres', 'synopsis', 'style', 'format', 'duration'].map(f => e['film.' + f] ? `${f}: ${cut(e['film.' + f], 300)}` : '').filter(Boolean).join('\n');
  const chars = B.ch.slice(0, 14).map(c => {
    const ac = a.chars?.[c.name] || {};
    return `- ${c.name}` + [field(c.key, 'age') && 'âge ' + field(c.key, 'age'), field(c.key, 'look') && 'look ' + cut(field(c.key, 'look'), 90), field(c.key, 'desc') && cut(field(c.key, 'desc'), 120), ac.token && 'token ' + ac.token].filter(Boolean).map(x => ' · ' + x).join('');
  }).join('\n');
  const places = B.pl.slice(0, 12).map(p => '- ' + p.name).join('\n');
  const scenes = P.scenes.slice(0, 40).map(s => `${s.num}. ${s.ie} ${s.decor} - ${s.timeL || (s.night ? 'NUIT' : 'JOUR')} | ${cut(s.summary, 110)} | rôles: ${s.roles.map(r => r.name).join(', ') || '—'} | plans: ${(project.shots?.[s.k] || []).length}`).join('\n');
  const script = ep ? (project.episodes || []).find(x => x.id === ep)?.script || '' : project.script || (project.episodes || []).map(x => x.script).join('\n\n');
  const style = [a.style?.ratio && 'ratio ' + a.style.ratio, a.style?.light && 'lumière ' + a.style.light, a.style?.palette && 'palette ' + a.style.palette, (a.skills || []).filter(s => s.on && s.text).map(s => s.text).join(', ')].filter(Boolean).join(' · ');
  const notes = (project.canvas?.items || []).filter(i => (i.type === 'note' || i.type === 'title') && i.text).slice(0, 12).map(i => '- ' + cut(i.text, 160)).join('\n');
  const learned = (a.lessons || []).slice(0, 6).map(l => '- ' + cut(l, 140)).join('\n');
  return [`PROJET : ${project.name} (${project.format || 'film'})`, film, style && 'STYLE VISUEL : ' + style,
    chars && 'PERSONNAGES :\n' + chars, places && 'LIEUX :\n' + places, scenes && 'SCÈNES :\n' + scenes,
    notes && 'NOTES DU CANVAS :\n' + notes, learned && 'CE QUI A BIEN MARCHÉ AVANT :\n' + learned,
    script && 'SCÉNARIO (début) :\n' + script.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').slice(0, 5500)].filter(Boolean).join('\n\n');
}

function system(lang) {
  const L = { fr: 'français', en: 'English', ar: 'العربية' }[lang] || 'français';
  return `Tu es le réalisateur IA de GOSET.ai, un assistant de préparation de film. Tu as l'œil d'un chef opérateur et la rigueur d'un 1er assistant.
Tu lis le projet ci-dessous et tu réponds UNIQUEMENT par un objet JSON :
{"reply":"réponse courte (1 à 3 phrases) en ${L}","actions":[ ... ]}
Actions possibles (n'en mets que si la demande l'appelle) :
- {"type":"character","name":"NOM EN MAJUSCULES","age":"","style":"registre de jeu","look":"physique et costume précis","desc":"personnalité, histoire, enjeu","voice":"voix","token":"@nom_court","prompt":"English visual description for image models, consistent identity"}
- {"type":"place","name":"","style":"","desc":""}
- {"type":"script","mode":"append" ou "replace","text":"scénario au format : '1. EXT. LIEU - JOUR' puis action, puis NOM DU PERSONNAGE en majuscules sur sa ligne, puis la réplique"}
- {"type":"shots","scene":"numéro de scène existant","shots":[{"size":"","angle":"","move":"","lens":"ex. 35 mm","dur":"secondes","desc":"ce qu'on voit, en ${L}","image":"English image prompt: shot size, subject, action, setting, light, lens, mood","motion":"English video prompt: camera move, action, duration"}]}
- {"type":"note","title":"","text":""}
- {"type":"palette","colors":[{"hex":"#RRGGBB","label":"nom"}]}
Valeurs autorisées — size : ${SHOT.size.filter(Boolean).join(' | ')} ; angle : ${SHOT.angle.filter(Boolean).join(' | ')} ; move : ${SHOT.move.filter(Boolean).join(' | ')}.
Règles : reste fidèle au projet (noms, lieux, ton, style). Dans les prompts image, décris chaque personnage avec les mêmes traits à chaque plan. Pas de nom d'acteur réel, pas de marque. Plans : 4 à 10 par scène, une vraie grammaire de cinéma (installation, valeurs qui se resserrent, inserts). Si la demande est floue, fais le choix le plus utile et dis-le dans "reply".`;
}

// ---------- Application des actions ----------
function snapshot(p) { return JSON.stringify({ script: p.script, episodes: p.episodes, bible: p.bible, edits: p.edits, shots: p.shots, ai: p.ai, canvas: p.canvas }); }
export function restore(p, snap) {
  const { canvas, ...rest } = JSON.parse(snap); Object.assign(p, rest);
  // le canvas ouvert garde le même objet : on remplace son contenu
  if (p.canvas && canvas) { p.canvas.items = canvas.items || []; p.canvas.links = canvas.links || []; } else p.canvas = canvas;
}

function findOrCreate(p, P, kind, name) {
  const B = bible(p, P), ex = B[kind].find(x => x.name.toLowerCase() === name.toLowerCase());
  if (ex) return ex.key;
  const b = p.bible ||= {}, id = uid().slice(0, 7), key = kind + ':c:' + id;
  (b[{ ch: 'chars', pl: 'places', ob: 'objects' }[kind]] ||= []).push({ id });
  (p.edits ||= {})[bibKey(key, 'name')] = kind === 'ch' ? name.toUpperCase() : name;
  return key;
}
const pick = (list, v) => list.includes(v) ? v : (list.find(o => o && v && o.toLowerCase() === String(v).toLowerCase()) || '');

export function apply(p, P, actions, o) {
  const done = [], cards = [];
  const ed = p.edits ||= {}, ai = p.ai ||= {}; ai.chars ||= {}; ai.shots ||= {};
  for (const a of (Array.isArray(actions) ? actions : []).slice(0, 24)) {
    try {
      if (a.type === 'character' && a.name) {
        const name = String(a.name).trim().toUpperCase().slice(0, 40), key = findOrCreate(p, P, 'ch', name);
        [['age', a.age], ['style', a.style], ['look', a.look], ['desc', a.desc]].forEach(([f, v]) => { if (v) ed[bibKey(key, f)] = String(v).slice(0, 1200); });
        const c = ai.chars[name] ||= {};
        if (a.token) c.token = String(a.token).replace(/\s+/g, '_').slice(0, 30);
        if (a.prompt || a.look) c.look = String(a.prompt || a.look).slice(0, 600);
        if (a.voice) c.voice = String(a.voice).slice(0, 200);
        cards.push({ type: 'note', color: '#2c2c2e', w: 300, text: `${name}${a.age ? ' — ' + a.age : ''}\n${a.look ? '\nLook : ' + a.look : ''}${a.desc ? '\n\n' + a.desc : ''}${a.voice ? '\n\nVoix : ' + a.voice : ''}` });
        done.push(tr('Fiche personnage') + ' : ' + name);
      } else if (a.type === 'place' && a.name) {
        const key = findOrCreate(p, P, 'pl', String(a.name).trim().slice(0, 60));
        [['style', a.style], ['desc', a.desc]].forEach(([f, v]) => { if (v) ed[bibKey(key, f)] = String(v).slice(0, 1200); });
        done.push(tr('Lieu') + ' : ' + a.name);
      } else if (a.type === 'script' && a.text) {
        const text = String(a.text).replace(/\r/g, '').trim(), ep = o.ep && (p.episodes || []).find(x => x.id === o.ep);
        if (ep) ep.script = a.mode === 'replace' ? text : (ep.script || '').trimEnd() + '\n\n' + text;
        else if (Array.isArray(p.episodes) && p.episodes.length) p.episodes.push({ id: 'e' + uid(), name: tr('Épisode') + ' ' + (p.episodes.length + 1), script: text });
        else p.script = a.mode === 'replace' || !(p.script || '').trim() ? text : p.script.trimEnd() + '\n\n' + text;
        done.push(a.mode === 'replace' ? tr('Scénario réécrit') : tr('Scénario complété'));
      } else if (a.type === 'shots' && Array.isArray(a.shots)) {
        const s = P.scenes.find(x => x.num === String(a.scene).trim()) || (P.scenes.length === 1 ? P.scenes[0] : null); if (!s) continue;
        const shots = p.shots ||= {};
        shots[s.k] = a.shots.slice(0, 14).map(x => {
          const id = uid();
          ai.shots[s.k + '|' + id] = { image: String(x.image || '').slice(0, 1500), motion: String(x.motion || '').slice(0, 800) };
          return { id, size: pick(SHOT.size, x.size), angle: pick(SHOT.angle, x.angle), move: pick(SHOT.move, x.move), lens: String(x.lens || '').slice(0, 20), desc: String(x.desc || '').slice(0, 400), sound: '', dur: String(x.dur || '').replace(/[^\d.,]/g, '').slice(0, 4), prompt: String(x.image || '').slice(0, 1500) };
        });
        cards.push({ type: 'note', color: '#2c2c2e', w: 320, text: `Sc. ${s.num} — ${s.decor}\n` + shots[s.k].map((x, i) => `${i + 1}. ${[x.size, x.move].filter(Boolean).join(' · ')}${x.dur ? ' · ' + x.dur + ' s' : ''}\n   ${x.desc}`).join('\n') });
        done.push(`${tr('Plans')} : sc. ${s.num} (${shots[s.k].length})`);
      } else if (a.type === 'note' && (a.text || a.title)) {
        cards.push({ type: 'note', color: '#ffffff', w: 280, text: [a.title, a.text].filter(Boolean).join('\n\n').slice(0, 3000) });
        done.push(tr('Note') + (a.title ? ' : ' + cut(a.title, 40) : ''));
      } else if (a.type === 'palette' && Array.isArray(a.colors)) {
        const ok = a.colors.filter(c => /^#[0-9a-f]{6}$/i.test(c?.hex)).slice(0, 8);
        ok.forEach(c => cards.push({ type: 'swatch', w: 160, color: c.hex, label: String(c.label || '').slice(0, 40) }));
        if (ok.length) { ai.style ||= {}; ai.style.palette = ok.map(c => c.label || c.hex).join(', '); done.push(tr('Palette') + ` (${ok.length})`); }
      }
    } catch { /* action illisible : ignorée */ }
  }
  // Cartes posées sur le canvas, regroupées près du centre de la vue
  if (cards.length) {
    const c = p.canvas ||= {}; c.items ||= [];
    const B = o.board, base = B ? B.center() : { x: 200, y: 200 };
    let x0 = base.x - 340, y0 = base.y - 120, col = 0, rowH = 0;
    cards.forEach(cd => {
      const w = cd.w || 260, h = cd.type === 'swatch' ? 150 : 220;
      const pos = B ? B.freeSpot(x0 + col, y0, w, h) : { x: x0 + col, y: y0 };
      c.items.push({ id: uid(), x: Math.round(pos.x), y: Math.round(pos.y), ...cd, ai: true });
      col += w + 30; rowH = Math.max(rowH, h); if (col > 1100) { col = 0; y0 += rowH + 30; rowH = 0; }
    });
  }
  return done;
}

// ---------- Interface ----------
export function mountDirector(host, o) {
  const bar = document.createElement('div'); bar.className = 'dirbar';
  bar.innerHTML = `<div class="dir-log" hidden></div>
    <div class="dir-chips">${DIR_CHIPS.map(([l, q]) => `<button type="button" data-q="${esc(tr(q))}">${esc(tr(l))}</button>`).join('')}</div>
    <form class="dir-f"><span class="dir-ic" aria-hidden="true">✦</span><textarea rows="1" data-nomention aria-label="${esc(tr('Demande au réalisateur IA'))}" placeholder="${esc(tr('Demandez au réalisateur IA : fiche de Yasmine, découpe la scène 3, écris la scène suivante…'))}"></textarea><button class="dir-go" type="submit">${esc(tr('Envoyer'))}</button></form>`;
  host.appendChild(bar);
  const log = bar.querySelector('.dir-log'), ta = bar.querySelector('textarea'), go = bar.querySelector('.dir-go'), form = bar.querySelector('form');
  let busy = null;
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } e.stopPropagation(); });
  ta.addEventListener('focus', () => bar.classList.add('open'));
  bar.addEventListener('focusout', () => setTimeout(() => { if (!bar.contains(document.activeElement) && !ta.value) bar.classList.remove('open'); }, 150));
  bar.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { ta.value = b.dataset.q; grow(); ta.focus(); });
  const onWait = e => { const s = busy && log.querySelector('.dir-st'); if (s) s.textContent = e.detail ? tr('Les IA gratuites sont saturées · nouvel essai dans {n} s').replace('{n}', e.detail) : tr('Le réalisateur IA lit le projet…'); };
  window.addEventListener('goset:aiwait', onWait);
  const say = html => {
    if (log.hidden) { log.hidden = false; if (!log.querySelector('.dir-x')) log.insertAdjacentHTML('afterbegin', `<button type="button" class="dir-x" aria-label="${esc(tr('Fermer'))}">×</button>`); }
    log.insertAdjacentHTML('beforeend', html); log.scrollTop = log.scrollHeight;
  };
  log.addEventListener('click', e => { if (e.target.closest('.dir-x')) log.hidden = true; });

  form.onsubmit = async e => {
    e.preventDefault();
    if (busy) { busy.abort(); return; }
    const q = ta.value.trim(); if (!q) return;
    const project = o.project(), P = o.P();
    ta.value = ''; grow(); log.querySelectorAll('.dir-undo').forEach(b => b.remove());
    say(`<div class="dir-q">${esc(q)}</div><div class="dir-a"><span class="dir-st">${esc(tr('Le réalisateur IA lit le projet…'))}</span> <span class="spin"></span></div>`);
    const a = log.lastElementChild; busy = new AbortController(); go.textContent = tr('Arrêter'); bar.classList.add('busy');
    const hist = (project.ai?.dir || []).slice(-3).flatMap(h => [{ role: 'user', content: h.q }, { role: 'assistant', content: JSON.stringify({ reply: h.reply }) }]);
    const t0 = Date.now();
    try {
      const raw = await o.ask([{ role: 'system', content: system(o.lang()) + '\n\n' + context(project, P, o.ep()) }, ...hist, { role: 'user', content: q }], busy.signal, { json: true });
      let out; try { out = o.parseJSON(raw); } catch { out = { reply: String(raw || '').slice(0, 1200), actions: [] }; }
      if (Array.isArray(out)) out = { reply: '', actions: out };
      const snap = snapshot(project), done = apply(project, P, out.actions, { board: o.board(), ep: o.ep() });
      (project.ai ||= {}).dir = [...(project.ai.dir || []), { q: q.slice(0, 400), reply: String(out.reply || '').slice(0, 600), n: done.length, at: Date.now() }].slice(-12);
      o.save(); if (done.length) o.changed(done);
      const sec = Math.round((Date.now() - t0) / 100) / 10;
      a.innerHTML = `${out.reply ? `<p>${esc(out.reply)}</p>` : ''}${done.length ? `<ul class="dir-done">${done.map(d => `<li>✓ ${esc(d)}</li>`).join('')}</ul>` : ''}
        <div class="dir-meta"><span>${sec} s${o.provider() ? ' · ' + esc(o.provider()) : ''}</span>${done.length ? `<button class="link dir-undo" type="button">${esc(tr('Annuler ces changements'))}</button>` : ''}</div>`;
      a.querySelector('.dir-undo')?.addEventListener('click', ev => { restore(project, snap); o.save(); o.changed([]); ev.target.replaceWith(Object.assign(document.createElement('span'), { textContent: tr('Annulé') })); });
    } catch (err) {
      a.innerHTML = `<p class="dir-err">${esc(err.code === 'cancelled' || busy?.signal.aborted ? tr('Arrêté.') : (err.message || 'erreur'))}</p>`;
    } finally { busy = null; go.textContent = tr('Envoyer'); bar.classList.remove('busy'); log.scrollTop = log.scrollHeight; }
  };
  return { destroy() { window.removeEventListener('goset:aiwait', onWait); busy?.abort(); bar.remove(); } };
}
