// Samir, le réalisateur IA : petit robot assis dans une chaise de réalisateur, en bas à droite de chaque projet.
// Au repos : on voit le dos de la chaise (20 % d'opacité). Au clic : il se retourne en couleurs et ouvre la barre de demande.
// Changer d'onglet ferme la barre, mais la demande continue en arrière-plan ; Samir prévient quand c'est prêt.
import { tr } from './i18n.js';
import { DIR_CHIPS, context, system, snapshot, restore, apply } from './director.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NAME_KEY = 'goset.botName';
export const botName = () => { try { return (localStorage.getItem(NAME_KEY) || 'Samir').slice(0, 18); } catch { return 'Samir'; } };

// ---------- Dessin (original, 120 × 120) ----------
const Y = '#f3c234', Y2 = '#c9961a', INK = '#16171c', W = '#f4f6fa', W2 = '#c9d0db', CY = '#5ee6ff';
function chairLegs() {
  return `<g stroke="${INK}" stroke-width="8" stroke-linecap="round"><path d="M36 84 82 116M82 84 36 116M32 116h18M68 116h18"/></g>
    <g stroke="${Y}" stroke-width="5" stroke-linecap="round"><path d="M36 84 82 116M82 84 36 116"/></g>
    <g stroke="${Y2}" stroke-width="4" stroke-linecap="round"><path d="M32 116h18M68 116h18"/></g>
    <rect x="30" y="80" width="58" height="8" rx="2" fill="${INK}"/>`;
}
function front() {
  return `<svg viewBox="0 0 120 120" class="sm-svg">
    <rect x="28" y="30" width="62" height="30" rx="3" fill="${INK}"/><g stroke="${Y}" stroke-width="4.5" stroke-linecap="round"><path d="M30 30v56M88 30v56"/></g>
    ${chairLegs()}
    <g class="sm-body">
      <rect x="44" y="60" width="32" height="25" rx="10" fill="${W}" stroke="${W2}" stroke-width="1.5"/>
      <rect x="53" y="67" width="14" height="7" rx="2.5" fill="${Y}"/>
      <path d="M78 70q10 1 12 9" stroke="${W2}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="90" cy="80" r="4.5" fill="${W}" stroke="${W2}" stroke-width="1.2"/>
      <g class="sm-arm"><path d="M44 70q-9-2-13-12" stroke="${W2}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="31" cy="57" r="4.5" fill="${W}" stroke="${W2}" stroke-width="1.2"/>
        <g class="sm-mega"><path d="M30 55 12 44v26z" fill="${W}" stroke="${Y2}" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="12" cy="57" rx="4" ry="13" fill="${Y}" stroke="${Y2}" stroke-width="1.2"/><rect x="28" y="52" width="8" height="7" rx="2" fill="${Y}"/></g></g>
      <g class="sm-head">
        <circle cx="38" cy="38" r="5" fill="${W2}"/><circle cx="82" cy="38" r="5" fill="${W2}"/><circle cx="82" cy="38" r="2.6" fill="none" stroke="${CY}" stroke-width="1.6"/>
        <rect x="38" y="20" width="44" height="38" rx="13" fill="${W}" stroke="${W2}" stroke-width="1.5"/>
        <rect x="43" y="26" width="34" height="25" rx="9" fill="#0d1018"/>
        <g class="sm-eyes">
          <g class="e-idle"><rect class="blink" x="50" y="33" width="6" height="9" rx="3" fill="${CY}"/><rect class="blink" x="64" y="33" width="6" height="9" rx="3" fill="${CY}"/><path d="M55 45q5 3.5 10 0" stroke="${CY}" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>
          <g class="e-think"><rect x="53" y="31" width="6" height="8" rx="3" fill="${CY}"/><rect x="66" y="31" width="6" height="8" rx="3" fill="${CY}"/><path d="M57 46h7" stroke="${CY}" stroke-width="1.8" stroke-linecap="round"/></g>
          <g class="e-work"><g class="scan"><rect x="49" y="34" width="6" height="7" rx="3" fill="${CY}"/><rect x="63" y="34" width="6" height="7" rx="3" fill="${CY}"/></g><path d="M56 46q4 2 8 0" stroke="${CY}" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>
          <g class="e-happy"><path d="M49 39q4-6 8 0M63 39q4-6 8 0" stroke="${CY}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M54 44q6 5 12 0" stroke="${CY}" stroke-width="2" fill="none" stroke-linecap="round"/></g>
          <g class="e-wow"><circle cx="53" cy="37" r="4" fill="${CY}"/><circle cx="67" cy="37" r="4" fill="${CY}"/><circle cx="54.3" cy="35.7" r="1.2" fill="#fff"/><circle cx="68.3" cy="35.7" r="1.2" fill="#fff"/><ellipse cx="60" cy="46" rx="2.4" ry="2.8" fill="${CY}"/></g>
        </g>
        <path d="M36 22c2-11 46-13 50-2 1 4-4 5-8 4H40c-4 1-5 0-4-2z" fill="${INK}"/><circle cx="62" cy="11" r="2.6" fill="${INK}"/>
      </g>
    </g>
    <g class="sm-fx"><g class="dots"><circle cx="92" cy="18" r="2.4"/><circle cx="99" cy="12" r="2.8"/><circle cx="107" cy="5" r="3.2"/></g>
      <g class="spark"><path d="M98 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M18 22l1.4 3.4 3.4 1.4-3.4 1.4L18 31.6l-1.4-3.4-3.4-1.4 3.4-1.4z"/></g></g>
  </svg>`;
}
function back(name) {
  const n = esc(name.toUpperCase().slice(0, 9));
  return `<svg viewBox="0 0 120 120" class="sm-svg">
    <path d="M40 22c2-11 38-12 42-2 1 4-4 4-7 3H45c-4 1-6 0-5-1z" fill="${INK}"/><circle cx="61" cy="11" r="2.6" fill="${INK}"/>
    <rect x="44" y="20" width="34" height="14" rx="6" fill="${W2}"/>
    <rect x="26" y="30" width="68" height="32" rx="3" fill="${INK}"/>
    <path d="M60 36l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" fill="${Y}"/>
    <text x="60" y="58.5" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="8.5" letter-spacing=".8" fill="${Y}">${n}</text>
    <g stroke="${Y}" stroke-width="4.5" stroke-linecap="round"><path d="M28 30v56M92 30v56"/></g>
    <rect x="30" y="64" width="60" height="7" rx="2" fill="${Y2}"/>
    ${chairLegs()}
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
