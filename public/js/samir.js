// Samir, le réalisateur IA : petit robot assis dans une chaise de réalisateur, en bas à droite de chaque projet.
// Au repos : on voit le dos de la chaise (20 % d'opacité). Au clic : il se retourne en couleurs et ouvre la barre de demande.
// Changer d'onglet ferme la barre, mais la demande continue en arrière-plan ; Samir prévient quand c'est prêt.
import { tr } from './i18n.js';
import { DIR_CHIPS, context, system, snapshot, restore, apply } from './director.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NAME_KEY = 'goset.botName';
export const botName = () => { try { return (localStorage.getItem(NAME_KEY) || 'Samir').slice(0, 18); } catch { return 'Samir'; } };

// ---------- Dessin (original, 120 × 120) : rendu « jouet 3D » façon sticker ----------
// Plastique blanc ombré, visière laquée, yeux lumineux, béret en feutre, chaise en bois verni, contour noir épais.
const OL = '#121318';
const DEFS = `<defs>
  <radialGradient id="smr-disc" cx="42%" cy="34%" r="70%"><stop offset="0" stop-color="#ffe066"/><stop offset=".6" stop-color="#f6c22c"/><stop offset="1" stop-color="#d99a10"/></radialGradient>
  <radialGradient id="smr-plas" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e8edf4"/><stop offset="1" stop-color="#a9b4c4"/></radialGradient>
  <linearGradient id="smr-plas2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9c3d1"/></linearGradient>
  <linearGradient id="smr-visor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232a38"/><stop offset=".55" stop-color="#0c1018"/><stop offset="1" stop-color="#05070b"/></linearGradient>
  <radialGradient id="smr-beret" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#4a4e59"/><stop offset=".6" stop-color="#23252c"/><stop offset="1" stop-color="#0e0f13"/></radialGradient>
  <linearGradient id="smr-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset=".5" stop-color="#f4bd2a"/><stop offset="1" stop-color="#c88a0c"/></linearGradient>
  <linearGradient id="smr-canvas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3d46"/><stop offset="1" stop-color="#121318"/></linearGradient>
  <linearGradient id="smr-mega" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3e8ef"/><stop offset="1" stop-color="#a7b1c0"/></linearGradient>
  <radialGradient id="smr-cy" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#d9fbff"/><stop offset=".45" stop-color="#6ff0ff"/><stop offset="1" stop-color="#19b8d6"/></radialGradient>
  <filter id="smr-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="smr-felt" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .22 0" result="w"/><feComposite in="w" in2="SourceGraphic" operator="in"/></filter>
  <clipPath id="smr-clip"><circle cx="60" cy="61" r="52"/></clipPath>
  <filter id="smr-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.2" flood-color="#000" flood-opacity=".38"/></filter>
</defs>`;
const shine = (x, y, rx, ry, r = -20, o = .7) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})" fill="#fff" opacity="${o}"/>`;
function legs() {
  return `<g stroke="${OL}" stroke-width="7.5" stroke-linecap="round"><path d="M40 90 84 113M84 90 40 113M34 113h16M74 113h16"/></g>
    <g stroke="url(#smr-wood)" stroke-width="4.6" stroke-linecap="round"><path d="M40 90 84 113M84 90 40 113"/></g>
    <g stroke="#d69a12" stroke-width="4" stroke-linecap="round"><path d="M34 113h16M74 113h16"/></g>
    <path d="M42 91.5 82 112" stroke="#fff4c2" stroke-width="1" stroke-linecap="round" opacity=".7"/>`;
}
function front() {
  return `<svg viewBox="0 0 120 120" class="sm-svg">${DEFS}
    <circle cx="60" cy="61" r="54" fill="url(#smr-disc)"/>
    <path d="M22 40a42 42 0 0 1 56-27" stroke="#fff6c8" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>
    <g clip-path="url(#smr-clip)">
    <g filter="url(#smr-sh)">
      <rect x="74" y="42" width="22" height="26" rx="2.5" fill="url(#smr-canvas)" stroke="${OL}" stroke-width="2.2"/>
      <path d="M92 38v50" stroke="${OL}" stroke-width="7" stroke-linecap="round"/><path d="M92 38v50" stroke="url(#smr-wood)" stroke-width="4.2" stroke-linecap="round"/>
      ${legs()}
      <rect x="32" y="84" width="60" height="7" rx="2.5" fill="url(#smr-canvas)" stroke="${OL}" stroke-width="2.2"/>
      <path d="M33 74h59" stroke="${OL}" stroke-width="7.5" stroke-linecap="round"/><path d="M33 74h59" stroke="url(#smr-wood)" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M36 74v11M89 74v11" stroke="${OL}" stroke-width="6" stroke-linecap="round"/><path d="M36 74v11M89 74v11" stroke="url(#smr-wood)" stroke-width="3.2" stroke-linecap="round"/>
    </g>
    <g class="sm-body" filter="url(#smr-sh)">
      <rect x="47" y="60" width="32" height="26" rx="11" fill="url(#smr-plas)" stroke="${OL}" stroke-width="2.2"/>
      <rect x="55" y="68" width="15" height="7" rx="2.5" fill="url(#smr-wood)" stroke="${OL}" stroke-width="1.6"/>
      ${shine(53, 65, 4, 2, -25, .8)}
      <path d="M78 68q9 0 10 6" stroke="${OL}" stroke-width="6.5" fill="none" stroke-linecap="round"/><path d="M78 68q9 0 10 6" stroke="url(#smr-plas2)" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <circle cx="88" cy="75" r="5" fill="url(#smr-plas)" stroke="${OL}" stroke-width="2"/>
      <g class="sm-arm">
        <path d="M48 70q-9-1-13-11" stroke="${OL}" stroke-width="6.5" fill="none" stroke-linecap="round"/><path d="M48 70q-9-1-13-11" stroke="url(#smr-plas2)" stroke-width="3.6" fill="none" stroke-linecap="round"/>
        <g class="sm-mega">
          <rect x="31" y="51" width="7" height="10" rx="2" fill="url(#smr-wood)" stroke="${OL}" stroke-width="1.8"/>
          <path d="M37 50 14 39v25z" fill="url(#smr-mega)" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M37 50 25 44.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
          <ellipse cx="14" cy="51.5" rx="5" ry="13.5" fill="url(#smr-wood)" stroke="${OL}" stroke-width="2.2"/>
          <ellipse cx="14.6" cy="51.5" rx="2.6" ry="9.5" fill="#7a5508"/><ellipse cx="13" cy="46" rx="1.2" ry="3.4" fill="#fff4c2" opacity=".8"/>
          <path d="M37 47h3a2 2 0 0 1 0 6h-3" fill="url(#smr-wood)" stroke="${OL}" stroke-width="1.8"/>
        </g>
        <circle cx="35" cy="58" r="5" fill="url(#smr-plas)" stroke="${OL}" stroke-width="2"/>
      </g>
      <g class="sm-head">
        <circle cx="38" cy="40" r="6.2" fill="url(#smr-plas)" stroke="${OL}" stroke-width="2"/><circle cx="86" cy="40" r="6.2" fill="url(#smr-plas)" stroke="${OL}" stroke-width="2"/>
        <circle cx="86.6" cy="40" r="3.2" fill="none" stroke="#5ee6ff" stroke-width="1.8" filter="url(#smr-glow)"/>
        <rect x="39" y="21" width="46" height="39" rx="14" fill="url(#smr-plas)" stroke="${OL}" stroke-width="2.4"/>
        <rect x="44" y="27" width="36" height="27" rx="10" fill="url(#smr-visor)" stroke="${OL}" stroke-width="1.6"/>
        <path d="M48 30.5q14-3 28 0" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".22"/>
        ${shine(46, 25, 4, 1.6, -20, .9)}
        <g class="sm-eyes" filter="url(#smr-glow)" fill="url(#smr-cy)" stroke="none">
          <g class="e-idle"><rect class="blink" x="52" y="34" width="7" height="10" rx="3.5"/><rect class="blink" x="65" y="34" width="7" height="10" rx="3.5"/><path d="M57 47.5q5 3.5 10 0" stroke="#6ff0ff" stroke-width="2" fill="none" stroke-linecap="round"/></g>
          <g class="e-think"><rect x="55" y="32" width="6.5" height="8.5" rx="3.2"/><rect x="68" y="32" width="6.5" height="8.5" rx="3.2"/><path d="M59 47.5h7" stroke="#6ff0ff" stroke-width="2" stroke-linecap="round"/></g>
          <g class="e-work"><g class="scan"><rect x="51" y="35" width="7" height="8" rx="3.5"/><rect x="64" y="35" width="7" height="8" rx="3.5"/></g><path d="M58 47.5q4 2 8 0" stroke="#6ff0ff" stroke-width="2" fill="none" stroke-linecap="round"/></g>
          <g class="e-happy"><path d="M51.5 40.5q4-6.5 8 0M64.5 40.5q4-6.5 8 0" stroke="#6ff0ff" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M56 45.5q6 5.5 12 0" stroke="#6ff0ff" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>
          <g class="e-wow"><circle cx="55.5" cy="38.5" r="4.4"/><circle cx="68.5" cy="38.5" r="4.4"/><circle cx="57" cy="37" r="1.3" fill="#fff"/><circle cx="70" cy="37" r="1.3" fill="#fff"/><ellipse cx="62" cy="48" rx="2.4" ry="2.8"/></g>
        </g>
        <g class="sm-beret">
          <path d="M36 25c0-12 44-17 54-6 3 4-1 7-6 7H43c-5 1-7 0-7-1z" fill="url(#smr-beret)" stroke="${OL}" stroke-width="2.4"/>
          <path d="M36 25c0-12 44-17 54-6 3 4-1 7-6 7H43c-5 1-7 0-7-1z" filter="url(#smr-felt)" fill="#000"/>
          <path d="M43 15q12-6 28-5" stroke="#8b90a0" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".55"/>
          <path d="M60 10.5q1-4 4-4" stroke="${OL}" stroke-width="4.2" stroke-linecap="round" fill="none"/><path d="M60 10.5q1-4 4-4" stroke="#3b3e48" stroke-width="2" stroke-linecap="round" fill="none"/>
        </g>
      </g>
    </g>
    </g>
    <circle cx="60" cy="61" r="54" fill="none" stroke="${OL}" stroke-width="4"/>
    <g class="sm-fx"><g class="dots"><circle cx="94" cy="20" r="2.6"/><circle cx="101" cy="13" r="3"/><circle cx="109" cy="6" r="3.4"/></g>
      <g class="spark"><path d="M99 27l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M20 22l1.4 3.4 3.4 1.4-3.4 1.4L20 31.6l-1.4-3.4-3.4-1.4 3.4-1.4z"/></g></g>
  </svg>`;
}
function back(name) {
  const n = esc(name.toUpperCase().slice(0, 9));
  return `<svg viewBox="0 0 120 120" class="sm-svg">${DEFS}
    <g clip-path="url(#smr-clip)"><g filter="url(#smr-sh)">
      <path d="M38 24c0-12 42-16 50-5 3 4-1 7-6 7H44c-5 1-6 0-6-2z" fill="url(#smr-beret)" stroke="${OL}" stroke-width="2.4"/>
      <path d="M38 24c0-12 42-16 50-5 3 4-1 7-6 7H44c-5 1-6 0-6-2z" filter="url(#smr-felt)" fill="#000"/>
      <path d="M60 10.5q1-4 4-4" stroke="${OL}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
      <rect x="42" y="22" width="38" height="14" rx="6" fill="url(#smr-plas)" stroke="${OL}" stroke-width="2.2"/>
      ${legs()}
      <rect x="25" y="31" width="70" height="33" rx="3" fill="url(#smr-canvas)" stroke="${OL}" stroke-width="2.4"/>
      <path d="M28 34.5h64M28 60.5h64" stroke="#5a5e6a" stroke-width=".8" stroke-dasharray="1.6 1.4"/>
      <path d="M60 37l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8z" fill="url(#smr-wood)" stroke="${OL}" stroke-width="1.2"/>
      <text x="60" y="58.6" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="8.6" letter-spacing=".8" fill="#f6c22c">${n}</text>
      <path d="M27 28v62M93 28v62" stroke="${OL}" stroke-width="7.5" stroke-linecap="round"/><path d="M27 28v62M93 28v62" stroke="url(#smr-wood)" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M26 30v20M92 30v20" stroke="#fff4c2" stroke-width="1" stroke-linecap="round" opacity=".7"/>
      <rect x="29" y="66" width="62" height="7" rx="2.5" fill="url(#smr-wood)" stroke="${OL}" stroke-width="2"/>
    </g></g>
    <circle cx="60" cy="61" r="53" fill="none" stroke="${OL}" stroke-width="2" opacity=".5"/>
  </svg>`;
}

// ---------- Composant ----------
export function createSamir(o) {
  const root = document.createElement('div'); root.className = 'samir'; root.dataset.mood = 'idle'; root.hidden = true;
  let name = botName(), job = null, unread = 0, lastTab = null;
  root.innerHTML = `
    <section class="sm-panel" role="dialog" aria-label="${esc(name)}" hidden>
      <header class="sm-h"><div><b class="sm-n">${esc(name)}</b><small>${esc(tr('Votre réalisateur IA · lit tout le projet'))}</small></div>
        <button type="button" class="sm-ren" title="${esc(tr('Renommer'))}" aria-label="${esc(tr('Renommer'))}">✎</button><button type="button" class="sm-x" aria-label="${esc(tr('Fermer'))}">×</button></header>
      <div class="sm-log"></div>
      <div class="sm-chips"></div>
      <form class="sm-f"><textarea rows="1" data-nomention placeholder=""></textarea><button class="sm-go" type="submit">${esc(tr('Envoyer'))}</button></form>
    </section>
    <button type="button" class="sm-bot" aria-label="${esc(tr('Parler à {n}').replace('{n}', name))}">
      <span class="sm-flip"><span class="sm-face sm-back">${back(name)}</span><span class="sm-face sm-front">${front()}</span></span>
      <span class="sm-ring"></span><span class="sm-badge" hidden></span>
    </button>`;
  document.body.appendChild(root);
  const panel = root.querySelector('.sm-panel'), log = root.querySelector('.sm-log'), ta = root.querySelector('textarea'), go = root.querySelector('.sm-go'), form = root.querySelector('form'), bot = root.querySelector('.sm-bot'), badge = root.querySelector('.sm-badge');
  const mood = m => { root.dataset.mood = m; };
  const isOpen = () => !panel.hidden;
  const placeholder = () => { ta.placeholder = tr('Dites à {n} ce qu’il faut faire : fiche de Yasmine, découpe la scène 3, écris la suite…').replace('{n}', name); };
  const chips = () => {
    const extra = o.tab() === 'canvas' ? [['Moodboard AI', '', 'mood']] : [];
    root.querySelector('.sm-chips').innerHTML = [...DIR_CHIPS, ...extra].map(([l, q, k]) => `<button type="button" ${k ? `data-k="${k}"` : `data-q="${esc(tr(q))}"`}>${esc(tr(l))}</button>`).join('');
  };
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; };
  const say = html => { log.insertAdjacentHTML('beforeend', html); log.scrollTop = log.scrollHeight; };
  const greet = () => { if (!log.children.length) say(`<div class="sm-a"><p>${esc(tr('Bonjour, je suis {n}. Je connais votre scénario, vos personnages et vos plans. Dites-moi ce qu’on prépare.').replace('{n}', name))}</p></div>`); };

  function open() {
    if (isOpen()) return; chips(); placeholder(); greet();
    panel.hidden = false; root.classList.add('on'); unread = 0; badge.hidden = true;
    if (!job) mood('wow'), setTimeout(() => { if (!job && isOpen()) mood('idle'); }, 1100);
    setTimeout(() => ta.focus(), 260);
  }
  function close() { panel.hidden = true; if (!job) { root.classList.remove('on'); mood('idle'); } }
  bot.onclick = () => isOpen() ? close() : open();
  root.querySelector('.sm-x').onclick = close;
  root.querySelector('.sm-ren').onclick = () => {
    const n = (prompt(tr('Nom de votre réalisateur IA'), name) || '').trim().slice(0, 18); if (!n) return;
    name = n; try { localStorage.setItem(NAME_KEY, n); } catch { /* stockage indisponible */ }
    root.querySelector('.sm-n').textContent = n; root.querySelector('.sm-back').innerHTML = back(n); placeholder();
  };
  root.querySelector('.sm-chips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k === 'mood') { close(); return o.moodboard(); }
    ta.value = b.dataset.q; grow(); ta.focus();
  });
  ta.addEventListener('input', () => { grow(); if (!job) mood(ta.value ? 'think' : 'idle'); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } e.stopPropagation(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) close(); });
  window.addEventListener('goset:aiwait', e => { const s = job && log.querySelector('.sm-a.pending .sm-st'); if (s) s.textContent = e.detail ? tr('Les IA gratuites sont saturées · nouvel essai dans {n} s').replace('{n}', e.detail) : tr('{n} lit le projet…').replace('{n}', name); });

  form.onsubmit = async e => {
    e.preventDefault();
    if (job) { job.ac.abort(); return; }
    const q = ta.value.trim(); if (!q) return;
    const project = o.project(), P = o.P(), ep = o.ep();
    ta.value = ''; grow(); log.querySelectorAll('.sm-undo').forEach(b => b.remove());
    say(`<div class="sm-q">${esc(q)}</div><div class="sm-a pending"><span class="sm-st">${esc(tr('{n} lit le projet…').replace('{n}', name))}</span> <span class="spin"></span></div>`);
    const a = log.lastElementChild; job = { ac: new AbortController(), project }; mood('work'); root.classList.add('busy'); go.textContent = tr('Arrêter');
    const hist = (project.ai?.dir || []).slice(-3).flatMap(h => [{ role: 'user', content: h.q }, { role: 'assistant', content: JSON.stringify({ reply: h.reply }) }]);
    const t0 = Date.now();
    try {
      const raw = await o.ask([{ role: 'system', content: system(o.lang(), name) + '\n\n' + context(project, P, ep) }, ...hist, { role: 'user', content: q }], job.ac.signal, { json: true });
      let out; try { out = o.parseJSON(raw); } catch { out = { reply: String(raw || '').slice(0, 1200), actions: [] }; }
      if (Array.isArray(out)) out = { reply: '', actions: out };
      const here = o.project() === project, snap = snapshot(project);
      const done = apply(project, P, out.actions, { board: here && o.tab() === 'canvas' ? o.board() : null, ep });
      (project.ai ||= {}).dir = [...(project.ai.dir || []), { q: q.slice(0, 400), reply: String(out.reply || '').slice(0, 600), n: done.length, at: Date.now() }].slice(-12);
      o.save(project); if (done.length && here) o.changed(done);
      const sec = Math.round((Date.now() - t0) / 100) / 10;
      a.classList.remove('pending');
      a.innerHTML = `${out.reply ? `<p>${esc(out.reply)}</p>` : ''}${done.length ? `<ul class="sm-done">${done.map(d => `<li>✓ ${esc(d)}</li>`).join('')}</ul>` : ''}
        <div class="sm-meta"><span>${sec} s${o.provider() ? ' · ' + esc(o.provider()) : ''}</span>${done.length ? `<button class="link sm-undo" type="button">${esc(tr('Annuler ces changements'))}</button>` : ''}</div>`;
      a.querySelector('.sm-undo')?.addEventListener('click', ev => { restore(project, snap); o.save(project); if (o.project() === project) o.changed([]); ev.target.replaceWith(Object.assign(document.createElement('span'), { textContent: tr('Annulé') })); });
      mood(done.length ? 'happy' : 'idle');
      if (!isOpen()) {
        unread++; badge.textContent = unread; badge.hidden = false;
        o.toast(`<b>${esc(name)}</b> · ${esc(done.length ? tr('{k} changement(s) prêt(s)').replace('{k}', done.length) : tr('réponse prête'))}${done.length ? ' — ' + esc(done.slice(0, 2).join(', ')) : ''}`, 4200);
      }
      setTimeout(() => { if (!job) { mood('idle'); if (!isOpen()) root.classList.remove('on'); } }, 3200);
    } catch (err) {
      a.classList.remove('pending');
      a.innerHTML = `<p class="sm-err">${esc(err.code === 'cancelled' || job?.ac.signal.aborted ? tr('Arrêté.') : (err.message || 'erreur'))}</p>`;
      mood('idle'); if (!isOpen()) root.classList.remove('on');
    } finally { job = null; root.classList.remove('busy'); go.textContent = tr('Envoyer'); }
  };

  return {
    // Appelé à chaque changement de page : visible dans un projet, barre refermée si on change d'onglet
    route(inProject, tab) {
      root.hidden = !inProject;
      if (tab !== lastTab && isOpen()) close();
      lastTab = tab;
      if (job) root.classList.add('on');
    },
    open, close, el: root
  };
}
