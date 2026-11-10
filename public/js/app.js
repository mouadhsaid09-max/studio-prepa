import { esc, analyse, diff, SAMPLE, SAMPLE_CLIP, SAMPLE_AI, SAMPLE_AI_SETUP, DEFAULT_SETTINGS, fmtE, cls, isSeries, stripOrder, orderFromDays, unavail, fdate } from './parser.js';
import { renderDep, renderArt, renderPdt, renderFds, renderDec, renderBud, budgetCSV, fmtRange } from './production.js';
import { budgetDefaults } from './budget.js';
import { Board } from './canvas.js';
import { initBible, renderBible, bindBible, openEntity, openScene } from './bible.js';
import { bindStripboard } from './stripboard.js';
import { initPrepAI, mountButton, openAI, sketchShot, askVision, genImage, askAI, parseJSON } from './prepai.js';
import { openInk } from './ink.js';
import { glyph } from './glyphs.js';
import { icon } from './icons.js';
import { FORMATS, fmt, formatOf, isAI , unitWord, isPub } from './formats.js';
import { renderAIStudio, bindAIStudio } from './aistudio.js';
import { award, checkProject, renderProfile, setTitle, setUser, profile } from './badges.js';
import { openInvoice } from './invoice.js';
import { QUOTES } from './quotes.js';
import { startI18n, LANG, LANGS, LOCALES, setLang, tr } from './i18n.js';
import { setDateLocale, bible as bibleOf, MENTION_CATS, bibKey, offDays } from './parser.js';
import { attachMentions, projectItems, caretXY } from './mentions.js';
import { attachHighlight, termsOf, HL } from './highlight.js';
import { renderBrief, bindBrief } from './commercial.js';
import { renderTeam, bindTeam } from './team.js';
setDateLocale(LOCALES[LANG]);

const $ = s => document.querySelector(s);
const app = $('#app');
const DEMO = !!window.STUDIO_DEMO;
let memHash = '#/files';
const here = () => DEMO ? memHash : (location.hash || '#/files');
function nav(h) {
  if (DEMO) { memHash = h; route(); window.scrollTo?.(0, 0); return; }
  if (location.hash === h) route(); else location.hash = h;
}
if (DEMO) {
  document.documentElement.classList.add('demo');
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#/"]'); if (a) { e.preventDefault(); nav(a.getAttribute('href')); } });
} else window.addEventListener('hashchange', () => route());
const S = { me: null, list: [], filter: 'recent', view: localStorage.getItem('sp.view') || 'grid', sort: localStorage.getItem('sp.sort') || 'date', q: '', project: null, P: null, tab: 'canvas', day: 0, board: null };

// ---------- Utilitaires ----------
async function api(path, opts = {}) {
  const o = { ...opts, headers: { ...(opts.body && !(opts.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) } };
  if (o.body && typeof o.body !== 'string' && !(o.body instanceof Blob)) o.body = JSON.stringify(o.body);
  const r = await fetch(path, o);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.startsWith('/api/auth')) { S.me = null; nav('#/login'); throw new Error('Non connecté'); }
  if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
  return j;
}
export function toast(msg, ms = 2600) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.innerHTML = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms);
}
function modal(html, onMount) {
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  onMount?.(bg, close);
  setTimeout(() => bg.querySelector('input,textarea,button.btn')?.focus(), 20);
  return close;
}
function confirmBox(title, text, ok = 'Confirmer', danger = false) {
  return new Promise(res => {
    modal(`<h3>${title}</h3><p class="note">${text}</p><div class="row end"><button class="btn ghost" data-close>Annuler</button><button class="btn ${danger ? 'danger' : ''}" id="ok">${ok}</button></div>`,
      (bg, close) => { bg.querySelector('#ok').onclick = () => { close(); res(true); }; bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) res(false); }); });
  });
}
const ago = t => {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'À l’instant'; if (d < 3600) return `Il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `Il y a ${Math.floor(d / 3600)} h`;
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};
const SLATE = `<svg viewBox="0 0 32 32" width="28" height="28"><rect x="3" y="12" width="26" height="16" rx="3" fill="currentColor"/><path d="M3 11l24-6 1.2 4.4L4.3 15.6z" fill="currentColor"/><path d="M8 9.7l3.5 4.2M14 8.2l3.5 4.2M20 6.7l3.5 4.2" stroke="var(--bg)" stroke-width="2"/></svg>`;

// ---------- Routeur ----------
async function route() {
  const h = here();
  if (S.board) { S.board.destroy(); S.board = null; }
  if (!S.me) {
    try { S.me = (await api('/api/auth/me')).user; } catch { S.me = null; }
  }
  if (!S.me) return renderLogin();
  if (h.startsWith('#/login')) { memHash = '#/files'; if (!DEMO) history.replaceState(null, '', '#/files'); return route(); }
  const m = h.match(/^#\/p\/([a-z0-9]+)(?:\/e\/([a-z0-9]+))?(?:\/(\w+))?/);
  if (m) return openProject(m[1], m[3] || '', m[2] || null);
  const f = h.match(/^#\/files(?:\/(\w+))?/);
  S.filter = (f && f[1]) || 'recent';
  if (S.project) { await flush(); S.project = null; S.P = null; }
  renderFiles();
}

// ---------- Connexion ----------
async function renderLogin() {
  let hasUsers = true; try { hasUsers = (await api('/api/auth/status')).hasUsers; } catch { }
  let mode = hasUsers ? 'login' : 'register';
  const draw = () => {
    app.innerHTML = `<div class="login"><div class="lcard">
      <select class="langsel" aria-label="Langue">${LANGS.map(([k, l]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${l}</option>`).join('')}</select><div class="logo">${SLATE}</div><h1>GOSET.ai</h1><p class="note">Du scénario aux feuilles de service.</p>
      <div class="seg wide"><button data-m="login" class="${mode === 'login' ? 'on' : ''}">Connexion</button><button data-m="register" class="${mode === 'register' ? 'on' : ''}">Créer un compte</button></div>
      <form id="lf">
        ${mode === 'register' ? '<input name="name" placeholder="Nom" autocomplete="name">' : ''}
        <input name="email" type="email" placeholder="E-mail" autocomplete="email" required>
        <input name="password" type="password" placeholder="Mot de passe${mode === 'register' ? ' (6 caractères min.)' : ''}" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" required>
        <div class="err" id="lerr"></div>
        <button class="btn block">${mode === 'login' ? 'Se connecter' : 'Créer le compte'}</button>
      </form>
      ${DEMO ? '<p class="note sm">Démo : n’importe quel e-mail et mot de passe (6 caractères) fonctionnent. Les projets restent dans ce navigateur.</p>' : !hasUsers ? '<p class="note sm">Premier lancement : créez votre compte. Tout reste sur cet ordinateur.</p>' : ''}
    </div></div>`;
    app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    $('#lf').onsubmit = async e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      try {
        S.me = (await api('/api/auth/' + mode, { method: 'POST', body: fd })).user;
        nav('#/files');
      } catch (err) { $('#lerr').textContent = err.message; }
    };
    app.querySelector('input')?.focus();
  };
  draw();
}

// ---------- Navigateur de projets (style Fichiers) ----------
async function loadList() { S.list = (await api('/api/projects')).projects; }
function visibleList() {
  let l = S.list.filter(p => S.filter === 'trash' ? p.deletedAt : !p.deletedAt);
  if (S.filter === 'fav') l = l.filter(p => p.favorite);
  if (S.q) l = l.filter(p => p.name.toLowerCase().includes(S.q.toLowerCase()));
  if (S.filter === 'recent') l = l.sort((a, b) => b.openedAt - a.openedAt).slice(0, 24);
  else if (S.sort === 'name') l = l.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  else l = l.sort((a, b) => b.updatedAt - a.updatedAt);
  return l;
}
// Dossier de projet : affiche au centre, scénario à gauche, découpage à droite, poche avant en verre
function folder(p) {
  const pv = p.preview || {}, F = fmt(formatOf(p)), serie = !!F.eps, clip = F.id === 'clip', SCN = clip ? tr('Paroles') : tr('Scénario'), lines = (pv.lines || []).slice(0, 15), shots = pv.shots || [];
  const lk = l => /^(\[|\d+[A-Z]?[.\s)]|INT|EXT|I\/E|SÉQ|SEQ|SC[ÈE]NE|داخلي|خارجي|مشهد)/i.test(l) ? 'h' : /^[A-ZÀ-Ý0-9'’ .()-]{2,30}$/.test(l) ? 'c' : '';
  const script = `<div class="fc fc-script"><i class="fc-lab">${SCN}</i><div data-nt dir="auto">${lines.length ? lines.map(l => `<span class="${lk(l)}">${esc(l)}</span>`).join('') : '<span class="ph"></span>'.repeat(10)}</div></div>`;
  const dec = `<div class="fc fc-dec"><i class="fc-lab">${tr('Découpage')}</i><div class="fc-grid">${[0, 1, 2, 3].map(i => shots[i] ? `<img src="${esc(shots[i])}" alt="" loading="lazy">` : '<b></b>').join('')}</div></div>`;
  const poster = `<div class="fc fc-poster">${pv.cover ? `<img src="${esc(pv.cover)}" alt="" loading="lazy">` : `<div class="fc-gen"><small>${esc(tr(F.short))}</small><b data-nt dir="auto">${esc(p.name)}</b></div>`}</div>`;
  const rows = [[SCN, `${p.sceneCount || 0} ${tr(clip ? (p.sceneCount === 1 ? 'section' : 'sections') : p.sceneCount === 1 ? 'scène' : 'scènes')}`], [tr('Découpage'), `${p.shotCount || 0} ${tr('plans')}`], serie ? [tr(F.label), `${p.episodes} ${tr('épisodes')}`] : [tr(F.label), ago(p.updatedAt)]];
  return `<div class="fold ${F.ai ? 'ai' : ''}" style="--fc:${esc(p.color || '#ff9f0a')}"><div class="fold-back"></div>${script}${dec}${poster}<div class="fold-front"><div class="ff-rows">${rows.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div><span class="ff-btn">${icon(F.icon, 30)}</span>${F.ai ? '<span class="ff-ai">IA</span>' : ''}</div></div>`;
}
function thumb(p) {
  if (p.preview?.cover) return `<div class="thumb cover"><img src="${esc(p.preview.cover)}" alt="" loading="lazy"></div>`;
  const imgs = p.preview?.images || [], strips = p.preview?.strips || [];
  if (imgs.length) return `<div class="thumb col${Math.min(imgs.length, 4)}">${imgs.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>`;
  if (p.episodes) return `<div class="thumb series" style="--c:${p.color}"><i></i><i></i><div>${[...Array(Math.min(p.episodes, 6))].map((_, i) => `<span>Ép. ${i + 1}</span>`).join('')}${p.episodes > 6 ? '<span>…</span>' : ''}</div></div>`;
  if (strips.length) return `<div class="thumb strips" style="--c:${p.color}">${strips.slice(0, 12).map(c => `<i class="sw ${c}"></i>`).join('')}</div>`;
  return `<div class="thumb blank" style="--c:${p.color}"><span>${esc(p.name.slice(0, 1).toUpperCase())}</span></div>`;
}
const TITLES = { recent: 'Récents', all: 'Tous les projets', fav: 'Favoris', trash: 'Corbeille' };
async function renderFiles() {
  document.title = 'GOSET.ai';
  app.innerHTML = `<div class="files">
    <aside class="side">
      <div class="brand">${SLATE}<b>GOSET.ai</b></div>
      <div class="grp">Projets</div>
      ${Object.entries(TITLES).map(([k, t]) => `<a href="#/files/${k}" class="${S.filter === k ? 'on' : ''}"><span class="ic ic-${k}"></span>${t}</a>`).join('')}
      <div class="grp">Réglages</div>
      <a href="#" data-settings><span class="ic ic-set"></span>IA (texte et images)</a>
      <a href="#" data-phone><span class="ic ic-phone"></span>Sur le téléphone</a>
      <div class="grp">Langue</div><div class="langrow"><select class="langsel" aria-label="Langue">${LANGS.map(([k, l]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="me"><button class="meb" data-profile title="${tr('Profil et palmarès')}"><span class="av">${esc((S.me.name || '?').slice(0, 1).toUpperCase())}</span><div><b>${esc(S.me.name)}</b><small>${esc((setUser(S.me.email), profile().title) ? tr(profile().title) : tr('Ajouter votre métier'))}</small></div></button><button class="link" data-logout>Déconnexion</button></div>
    </aside>
    <section class="fmain">
      <header class="ftool">
        <button class="menu-btn" data-side>☰</button>
        <h1>${TITLES[S.filter]}</h1>${DEMO ? '<span class="demob">Démo</span>' : ''}<div class="sp"></div>
        <input class="search" type="search" placeholder="Rechercher" value="${esc(S.q)}">
        <div class="seg"><button data-view="grid" class="${S.view === 'grid' ? 'on' : ''}" title="Icônes">▦</button><button data-view="list" class="${S.view === 'list' ? 'on' : ''}" title="Liste">☰</button></div>
        ${S.filter !== 'recent' ? `<select class="sort"><option value="date" ${S.sort === 'date' ? 'selected' : ''}>Date</option><option value="name" ${S.sort === 'name' ? 'selected' : ''}>Nom</option></select>` : ''}
        ${themeBtn()}${S.filter !== 'trash' ? '<button class="btn" data-new>+ Nouveau</button>' : ''}
      </header>
      <div id="fl" class="fl-${S.view}"><div class="note pad">Chargement…</div></div>
    </section></div>`;
  const fm = app.querySelector('.files');
  app.querySelector('[data-side]').onclick = () => fm.classList.toggle('sideopen');
  app.querySelector('.search').oninput = e => { S.q = e.target.value; drawList(); };
  app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { S.view = b.dataset.view; localStorage.setItem('sp.view', S.view); renderFiles(); });
  app.querySelector('.sort')?.addEventListener('change', e => { S.sort = e.target.value; localStorage.setItem('sp.sort', S.sort); drawList(); });
  app.querySelector('[data-new]')?.addEventListener('click', newProject);
  app.querySelector('[data-settings]').onclick = e => { e.preventDefault(); fm.classList.remove('sideopen'); openSettings(); };
  app.querySelector('[data-phone]').onclick = e => { e.preventDefault(); fm.classList.remove('sideopen'); openPhone(); };
  fm.addEventListener('click', e => { if (fm.classList.contains('sideopen') && !e.target.closest('.side') && !e.target.closest('[data-side]')) fm.classList.remove('sideopen'); });
  app.querySelector('[data-profile]').onclick = () => modal(`<div class="npg-head"><h3>${tr('Profil')}</h3><button class="x" data-close>✕</button></div>${renderProfile(S.me)}`, bg => {
    const i = bg.querySelector('#ptitle');
    i.addEventListener('change', () => { setTitle(i.value.trim()); bg.querySelector('.prof-h .mute').textContent = i.value.trim() || tr('Ajoutez votre métier'); const sm = app.querySelector('.meb small'); if (sm) sm.textContent = i.value.trim() || tr('Ajouter votre métier'); });
  });
  app.querySelector('[data-logout]').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); S.me = null; nav('#/login'); };
  try { await loadList(); } catch (e) { $('#fl').innerHTML = `<div class="note pad">${esc(e.message)}</div>`; return; }
  drawList();
}
function drawList() {
  const fl = $('#fl'); if (!fl) return;
  const l = visibleList();
  if (!l.length) {
    fl.innerHTML = S.filter === 'trash' ? `<div class="emptyf"><p>La corbeille est vide.</p></div>`
      : S.q ? `<div class="emptyf"><p>Aucun projet ne correspond à « ${esc(S.q)} ».</p></div>`
        : `<div class="emptyf">${SLATE}<h3>${S.filter === 'fav' ? 'Aucun favori' : 'Aucun projet'}</h3><p>Créez un projet, collez ou importez un scénario : canvas, dépouillement, plan de travail et feuilles de service se construisent tout seuls.</p>${S.filter !== 'fav' ? '<button class="btn" data-new2>+ Nouveau projet</button>' : ''}</div>`;
    fl.querySelector('[data-new2]')?.addEventListener('click', newProject);
    return;
  }
  if (S.view === 'grid') {
    fl.innerHTML = l.map(p => `<div class="tile" data-id="${p.id}" tabindex="0">${folder(p)}<div class="nm">${p.favorite ? '<span class="star">★</span>' : ''}${formatOf(p) !== 'film' ? `<span class="sbadge ${isAI(p) ? 'ai' : ''}">${esc(tr(fmt(formatOf(p)).short))}</span>` : ''}${esc(p.name)}</div><div class="meta">${p.episodes ? p.episodes + ' ép. · ' : ''}${ago(p.updatedAt)} · ${p.sceneCount} scène${p.sceneCount > 1 ? 's' : ''}</div><button class="more" title="Options">•••</button></div>`).join('');
  } else {
    fl.innerHTML = `<div class="lrow head"><span>Nom</span><span>Modifié</span><span>Scènes</span><span></span></div>` +
      l.map(p => `<div class="lrow" data-id="${p.id}" tabindex="0"><span class="ln"><i class="dotc" style="background:${p.color}"></i>${p.favorite ? '<span class="star">★</span>' : ''}${esc(p.name)}</span><span>${ago(p.updatedAt)}</span><span>${p.sceneCount}</span><button class="more" title="Options">•••</button></div>`).join('');
  }
  fl.querySelectorAll('[data-id]').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('click', e => { if (e.target.closest('.more')) return menu(e, id); if (S.filter !== 'trash') nav(`#/p/${id}`); else menu(e, id); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && S.filter !== 'trash') nav(`#/p/${id}`); });
    el.addEventListener('contextmenu', e => { e.preventDefault(); menu(e, id); });
  });
}
function menu(e, id) {
  document.querySelector('.pop')?.remove();
  const p = S.list.find(x => x.id === id);
  const items = p.deletedAt
    ? [['restore', 'Restaurer'], ['destroy', 'Supprimer définitivement', 'danger']]
    : [['open', 'Ouvrir'], ['rename', 'Renommer'], ['cover', 'Vignette et couleur'], ['dup', 'Dupliquer'], ['fav', p.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'], ['trash', 'Mettre à la corbeille', 'danger']];
  const pop = document.createElement('div'); pop.className = 'pop';
  pop.innerHTML = items.map(([a, l, c]) => `<button data-a="${a}" class="${c || ''}">${l}</button>`).join('');
  document.body.appendChild(pop);
  const x = Math.min(e.clientX, innerWidth - pop.offsetWidth - 8), y = Math.min(e.clientY, innerHeight - pop.offsetHeight - 8);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
  const off = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true));
  pop.onclick = async ev => {
    const a = ev.target.closest('button')?.dataset.a; if (!a) return; pop.remove();
    try {
      if (a === 'open') nav(`#/p/${id}`);
      if (a === 'rename') renameBox(p.name, async n => { await api('/api/projects/' + id, { method: 'PUT', body: { name: n } }); await loadList(); drawList(); });
      if (a === 'cover') return openCover(p);
      if (a === 'dup') { await api(`/api/projects/${id}/duplicate`, { method: 'POST' }); await loadList(); drawList(); toast('Projet dupliqué'); }
      if (a === 'fav') { await api('/api/projects/' + id, { method: 'PUT', body: { favorite: !p.favorite } }); await loadList(); drawList(); }
      if (a === 'trash') { await api('/api/projects/' + id, { method: 'PUT', body: { deleted: true } }); await loadList(); drawList(); toast('Déplacé dans la corbeille'); }
      if (a === 'restore') { await api('/api/projects/' + id, { method: 'PUT', body: { deleted: false } }); await loadList(); drawList(); toast('Projet restauré'); }
      if (a === 'destroy' && await confirmBox('Supprimer définitivement ?', `« ${esc(p.name)} » et ses images seront effacés. Cette action est irréversible.`, 'Supprimer', true)) { await api('/api/projects/' + id, { method: 'DELETE' }); await loadList(); drawList(); }
    } catch (err) { toast(esc(err.message)); }
  };
}
function renameBox(cur, cb) {
  modal(`<h3>Renommer</h3><input id="rn" value="${esc(cur)}"><div class="row end"><button class="btn ghost" data-close>Annuler</button><button class="btn" id="ok">Renommer</button></div>`,
    (bg, close) => { const i = bg.querySelector('#rn'); setTimeout(() => i.select(), 30); const go = () => { const v = i.value.trim(); if (v) { close(); cb(v); } }; bg.querySelector('#ok').onclick = go; i.onkeydown = e => { if (e.key === 'Enter') go(); }; });
}
const P_COLORS = ['#ff9f0a', '#ff375f', '#bf5af2', '#0a84ff', '#30d158', '#64d2ff', '#ffd60a'];
// Image → JPEG réduit (vignettes légères, démo comprise)
function shrinkImage(src, max = 720) {
  return new Promise((ok, ko) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { const r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.toBlob(b => b ? ok(b) : ko(new Error('image illisible')), 'image/jpeg', 0.86); };
    im.onerror = () => ko(new Error('image illisible')); im.src = src;
  });
}
async function uploadCover(pid, blobOrSrc) {
  const blob = typeof blobOrSrc === 'string' ? await shrinkImage(blobOrSrc) : await shrinkImage(URL.createObjectURL(blobOrSrc));
  const r = await fetch(`/api/projects/${pid}/assets`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'envoi impossible');
  return j.url;
}
const coverHTML = (src, color, name, kind) => src ? `<img src="${esc(src)}" alt="">` : `<div class="fc-gen" style="--fc:${color}"><small>${tr(fmt(kind).short)}</small><b data-nt dir="auto">${esc(name || tr('Sans titre'))}</b></div>`;
const EMO = n => glyph({ 'sparkles': 'blank', 'open-file-folder': 'import', 'popcorn': 'sample', 'framed-picture': 'image', 'clapper-board': 'film', 'television': 'series' }[n] || n);
// Panneau cinéma : clap 3D animé, citations de cinéastes
function cinemaPanel() {
  const today = new Date().toLocaleDateString(LOCALES[LANG] || 'fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const box = (cls, w, h, d, inner = '') => `<div class="cb ${cls}" style="--w:${w}px;--h:${h}px;--d:${d}px"><i class="f fr">${inner}</i><i class="f bk"></i><i class="f tp"></i><i class="f bt"></i><i class="f lf"></i><i class="f rt"></i></div>`;
  return `<aside class="npc"><div class="npc-glow"></div><div class="npc-grain"></div>
    <span class="npc-float a"><svg viewBox="0 0 60 60" width="60" height="60" fill="none"><circle cx="30" cy="30" r="22" stroke="#ff9f0a" stroke-width="1.2"/><circle cx="30" cy="30" r="3" fill="#ff9f0a"/></svg></span><span class="npc-float b"><svg viewBox="0 0 90 14" width="90" height="14" fill="rgba(255,255,255,.35)">${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 11.5}" y="2" width="7" height="10" rx="2"/>`).join('')}</svg></span><span class="npc-lines"></span>
    <div class="clap3d" aria-hidden="true"><div class="cl-rig">
      ${box('cl-body', 220, 150, 18, `<span class="cl-bar"></span><span class="cl-grid"><span class="cl-c w"><em>PROD.</em><b class="cl-title hand">—</b></span><span class="cl-c"><em class="cl-k1">SCÈNE</em><b class="cl-v1 hand">1</b></span><span class="cl-c"><em>PRISE</em><b class="cl-take hand">1</b></span><span class="cl-c"><em>DATE</em><b class="hand">${today}</b></span><span class="cl-c"><em>CAM</em><b class="hand">A</b></span></span>`)}
      <div class="cl-hinge">${box('cl-stick', 222, 26, 18)}</div>
    </div><div class="cl-shadow"></div></div>
    <figure class="npc-q"><blockquote id="nq" dir="auto" data-nt></blockquote><figcaption id="nqa"></figcaption></figure>
    <div class="npc-dots" id="nqd">${QUOTES.map((_, i) => `<i data-q="${i}"></i>`).join('')}</div></aside>`;
}
function runCinema(bg, st) {
  const q = s => bg.querySelector(s); let i = Math.floor(Math.random() * QUOTES.length), take = 1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = k => { i = (k + QUOTES.length) % QUOTES.length; const x = QUOTES[i], bq = q('#nq'), fa = q('#nqa'); bq.classList.remove('in'); fa.classList.remove('in'); setTimeout(() => { bq.textContent = '« ' + (x[LANG] || x.fr) + ' »'; if (LANG === 'en') bq.textContent = '“' + x.en + '”'; fa.innerHTML = `<b>${esc(x.by)}</b><span>${esc(tr(x.role))}</span>`; bq.classList.add('in'); fa.classList.add('in'); }, reduce ? 0 : 260); bg.querySelectorAll('#nqd i').forEach((d, j) => d.classList.toggle('on', j === i)); };
  const clap = () => { const r = q('.cl-rig'); if (!r) return; r.classList.remove('clap'); void r.offsetWidth; r.classList.add('clap'); setTimeout(() => { take++; const t = q('.cl-take'); if (t) t.textContent = take; }, 520); };
  show(i);
  q('#nqd').addEventListener('click', e => { const d = e.target.closest('[data-q]'); if (d) { clap(); show(+d.dataset.q); } });
  q('.clap3d').addEventListener('click', () => { clap(); show(i + 1); });
  const t = setInterval(() => { if (!bg.isConnected) return clearInterval(t); if (!document.hidden) { clap(); setTimeout(() => show(i + 1), reduce ? 0 : 480); } }, 7000);
  setTimeout(clap, 600);
  return () => { const n = q('#np').value.trim(); q('.cl-title').textContent = n || '—'; const F = fmt(st.kind); q('.cl-k1').textContent = tr(F.eps ? 'ÉP.' : st.kind.endsWith('pub') ? 'SPOT' : st.kind === 'clip' ? 'CLIP' : 'SCÈNE'); q('.cl-v1').textContent = F.eps ? '1/' + st.eps : '1'; q('.cl-take').closest('.clap3d')?.classList.toggle('ai', !!F.ai); };
}
function newProject() {
  const SRC = [['empty', 'blank', 'Canvas vierge', 'Partir de zéro : idées, mind map, moodboard'], ['file', 'import', 'Importer un scénario', 'PDF, Word, Final Draft, Fountain ou texte'], ['sample', 'sample', 'Exemple', '« Le Dernier Train », 8 scènes']];
  const st = { kind: 'film', eps: 3, src: 'empty', color: P_COLORS[0], cover: null, file: null };
  const card = f => `<div class="npk-o ${f.ai ? 'ai' : ''}" role="button" tabindex="0" data-kind="${f.id}">${icon(f.icon, f.ai ? 44 : 40)}<div class="npk-t"><b>${f.label}</b><span class="npk-sub">${f.sub}</span></div>${f.ai ? '<span class="ai-badge">IA</span>' : ''}</div>`;
  modal(`${cinemaPanel()}<div class="npg-main"><div class="npg-head"><div><span class="npg-kick">GOSET.ai · ${new Date().getFullYear()}</span><h3>Nouveau projet</h3></div><button class="x" data-close>✕</button></div>
    <div class="npg-lbl">Format</div>
    <div class="npk">${FORMATS.filter(f => !f.ai).map(card).join('')}</div>
    <div class="npg-lbl ai-l">Production IA <span>personnages, prompts, style</span></div>
    <div class="npk npk-ai">${FORMATS.filter(f => f.ai).map(card).join('')}</div>
    <div class="npk-eps" id="neps"><span id="nepl">Épisodes</span><button type="button" class="npk-st" data-ep="-1" aria-label="−">−</button><input id="nep" type="number" inputmode="numeric" min="1" max="40" value="3" aria-label="Nombre d’épisodes"><button type="button" class="npk-st" data-ep="1" aria-label="+">+</button></div>
    <label class="npg-lbl" for="np">Titre</label>
    <input id="np" class="npg-name" placeholder="Titre du film" autocomplete="off">
    <div class="npg-lbl">Point de départ</div>
    <div class="npg-list" id="nsrc"></div>
    <div class="npg-lbl">Affiche</div>
    <div class="npg-cover"><button class="npg-thumb" id="ncov" title="Changer la vignette"></button><div class="npg-cv"><span class="npg-hint">Une image, ou la couleur du dossier</span><div class="row"><button class="npg-chip" id="ncpick">${icon('image', 20)}Choisir une image</button><button class="npg-chip hidden" id="ncclr">Retirer</button></div><div class="npg-dots">${P_COLORS.map(c => `<button data-col="${c}" style="--c:${c}" title="${c}"></button>`).join('')}</div></div></div>
    <input type="file" id="nf" accept=".pdf,.docx,.fdx,.fountain,.txt" hidden><input type="file" id="ncf" accept="image/*" hidden>
    <div class="err" id="nerr"></div>
    <div class="npg-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn npg-go" id="ok">Créer le projet</button></div></div>`,
    (bg, close) => {
      bg.classList.add('npg-bg'); bg.querySelector('.modal').classList.add('npg', 'split');
      const q = x => bg.querySelector(x), nf = q('#nf'), ncf = q('#ncf'), nep = q('#nep');
      const slate = runCinema(bg, st);
      const PH = { film: 'Titre du film', series: 'Titre de la série', pub: 'Nom du spot ou de la marque', clip: 'Titre de la chanson', 'ai-pub': 'Nom du spot ou de la marque', 'ai-series': 'Titre de la mini-série' };
      const drawKind = () => {
        bg.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('on', b.dataset.kind === st.kind));
        const F = fmt(st.kind), multi = !!(F.eps || F.spots);
        nf.multiple = multi;
        if (st.lastKind !== st.kind) { st.lastKind = st.kind; setEps(F.spots ? 1 : 3); }
        q('#nepl').textContent = tr(F.spots ? 'Spots' : 'Épisodes');
        q('#neps').classList.toggle('show', multi);
        q('#np').placeholder = tr(PH[st.kind] || PH.film); drawSrc(); if (q('#ncov')) drawCover(); slate();
      };
      const drawSrc = () => {
        const clip = st.kind === 'clip';
        q('#nsrc').innerHTML = SRC.map(([v, ic, title, sub], i) => (clip && v === 'file' ? (title = 'Importer des paroles', sub = 'Texte ou Word, sections entre crochets') : (fmt(st.kind).eps || fmt(st.kind).spots) && v === 'file' ? (title = fmt(st.kind).spots ? 'Importer les scripts' : 'Importer les épisodes', sub = st.files && st.files.length > 1 ? `${st.files.length} fichiers : un par épisode, dans l’ordre des numéros` : 'Un ou plusieurs fichiers : chacun devient un épisode') : clip && v === 'sample' ? (title = 'Exemple', sub = '« Tunis la nuit », 8 sections') : fmt(st.kind).ai && v === 'sample' ? (title = 'Exemple IA', sub = '« Zahra », pub parfum, 6 scènes et 2 personnages') : 0, true) && `<button class="npg-row ${v === st.src ? 'on' : ''}" data-src="${v}"><span class="nr">0${i + 1}</span>${icon(ic, 30)}<span class="bd"><b>${v === 'file' && st.file ? esc(st.file.name) : title}</b><span>${v === 'file' && fmt(st.kind).eps && !st.file ? 'Le fichier devient l’épisode 1' : sub}</span></span><i class="rd"></i></button>`).join('');
      };
      const drawCover = () => { q('#ncov').innerHTML = coverHTML(st.cover, st.color, q('#np').value.trim(), st.kind); q('#ncclr').classList.toggle('hidden', !st.cover); bg.querySelectorAll('[data-col]').forEach(b => b.classList.toggle('on', b.dataset.col === st.color)); };
      const setEps = v => { st.eps = Math.max(1, Math.min(40, parseInt(v) || 1)); nep.value = st.eps; slate(); };
      drawKind(); drawCover();
      bg.querySelectorAll('.npk').forEach(g => {
        g.addEventListener('click', e => { const k = e.target.closest('[data-kind]'); if (!k) return; st.kind = k.dataset.kind; drawKind(); if (fmt(st.kind).eps || fmt(st.kind).spots) { nep.focus(); nep.select(); } });
        g.addEventListener('keydown', e => { const k = e.target.closest('.npk-o'); if (k && e.target === k && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); k.click(); } });
      });
      q('#neps').addEventListener('click', e => { const stp = e.target.closest('[data-ep]'); if (stp) setEps(st.eps + +stp.dataset.ep); });
      nep.addEventListener('input', () => { if (nep.value !== '') st.eps = Math.max(1, Math.min(40, parseInt(nep.value) || 1)); slate(); });
      nep.addEventListener('change', () => setEps(nep.value));
      nep.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); q('#np').focus(); } });
      q('#nsrc').addEventListener('click', e => { const b = e.target.closest('[data-src]'); if (!b) return; const again = st.src === b.dataset.src; st.src = b.dataset.src; drawSrc(); if (st.src === 'file' && (!st.file || again)) nf.click(); });
      nf.onchange = () => {
        if (nf.files.length) { st.files = [...nf.files]; st.file = st.files[0]; }
        if (st.files && st.files.length > 1 && (fmt(st.kind).eps || fmt(st.kind).spots)) setEps(Math.max(st.eps, st.files.length));
        if (st.file && !(st.files && st.files.length > 1)) { const n = q('#np'); if (!n.value) n.value = st.file.name.replace(/\.[^.]+$/, ''); }
        drawCover(); drawSrc();
      };
      q('#ncov').onclick = q('#ncpick').onclick = () => ncf.click();
      ncf.onchange = () => { const f = ncf.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { st.cover = r.result; drawCover(); }; r.readAsDataURL(f); };
      q('#ncclr').onclick = () => { st.cover = null; drawCover(); };
      bg.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { st.color = b.dataset.col; drawCover(); });
      q('#np').addEventListener('input', () => { drawCover(); slate(); });
      q('#ok').onclick = async () => {
        let name = q('#np').value.trim(), script = ''; setEps(nep.value);
        try {
          if (st.src === 'sample') { if (st.kind === 'clip') { script = SAMPLE_CLIP; name ||= 'Tunis la nuit'; } else if (fmt(st.kind).ai) { script = SAMPLE_AI; name ||= 'Zahra — eau de parfum'; } else { script = SAMPLE; name ||= 'Le Dernier Train'; } }
          let many = null;
          if (st.src === 'file') {
            if (!st.file) { nf.click(); return; }
            if ((fmt(st.kind).eps || fmt(st.kind).spots) && st.files && st.files.length > 1) many = await readEpisodes(st.files, (i, n) => { q('#ok').textContent = `${tr('Lecture')} ${i}/${n}…`; });
            else { q('#ok').textContent = tr('Lecture…'); script = await readFile(st.file); }
          }
          const body = { name: name || tr('Sans titre'), script, settings: DEFAULT_SETTINGS(), format: st.kind };
          const multiEp = fmt(st.kind).eps || (fmt(st.kind).spots && (st.eps > 1 || (many && many.length > 1)));
          if (multiEp) { const n = Math.max(st.eps, many ? many.length : 0); body.episodes = [...Array(n)].map((_, i) => ({ id: epId(), name: tr((fmt(st.kind).spots ? 'Spot ' : 'Épisode ') + (i + 1)), script: many ? (many[i]?.script || '') : (i === 0 ? script : '') })); body.script = ''; }
          q('#ok').disabled = true;
          const p = (await api('/api/projects', { method: 'POST', body })).project;
          const extra = { color: st.color, format: st.kind };
          if (st.src === 'sample' && fmt(st.kind).ai) { const X0 = JSON.parse(JSON.stringify(SAMPLE_AI_SETUP)); extra.tags = X0.tags; extra.ai = X0.ai; if (!multiEp) extra.shots = X0.shots; }
          if (st.cover) { try { extra.cover = await uploadCover(p.id, st.cover); } catch (e) { /* vignette ignorée */ } }
          await api('/api/projects/' + p.id, { method: 'PUT', body: extra });
          close(); nav(`#/p/${p.id}` + (fmt(st.kind).ai && !multiEp ? '/ai' : ''));
        } catch (err) { q('#nerr').textContent = err.message; q('#ok').textContent = tr('Créer le projet'); q('#ok').disabled = false; }
      };
      q('#np').onkeydown = e => { if (e.key === 'Enter') q('#ok').click(); };
    });
}
// Vignette d'un projet existant : image importée, image du projet, couleur, ou automatique
async function openCover(p0) {
  let full; try { full = (await api('/api/projects/' + p0.id)).project; } catch (e) { return toast(esc(e.message)); }
  const imgs = [...new Set([...((full.canvas || {}).items || []).filter(i => i.type === 'image' && i.src).map(i => i.src), ...Object.values(full.shots || {}).flat().map(x => x.img).filter(Boolean)])].slice(-24).reverse();
  let cover = full.cover || null, color = full.color;
  modal(`<div class="npg-head"><h3>Changer la vignette</h3><button class="x" data-close>✕</button></div>
    <div class="npg-cover big"><div class="npg-thumb" id="cv"></div><div class="npg-cv"><b data-nt>${esc(full.name)}</b><div class="row"><button class="npg-chip" id="cpick">${EMO('framed-picture')}Importer une image</button><button class="npg-chip" id="cauto">Automatique</button></div><div class="npg-dots">${P_COLORS.map(c => `<button data-col="${c}" style="--c:${c}"></button>`).join('')}</div></div></div>
    <div class="lbl">Images du projet</div>
    <div class="cvgrid">${imgs.length ? imgs.map(u => `<button data-img="${esc(u)}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('') : '<p class="note">Aucune image dans ce projet pour l’instant.</p>'}</div>
    <input type="file" id="cf" accept="image/*" hidden><div class="err" id="cerr"></div>
    <div class="npg-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`, (bg, close) => {
    bg.classList.add('npg-bg'); bg.querySelector('.modal').classList.add('npg');
    const q = x => bg.querySelector(x);
    const draw = () => { q('#cv').innerHTML = coverHTML(cover, color, full.name, formatOf(full)); bg.querySelectorAll('[data-col]').forEach(b => b.classList.toggle('on', b.dataset.col === color)); bg.querySelectorAll('[data-img]').forEach(b => b.classList.toggle('on', b.dataset.img === cover)); };
    draw();
    q('#cpick').onclick = () => q('#cf').click();
    q('#cf').onchange = () => { const f = q('#cf').files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { cover = r.result; draw(); }; r.readAsDataURL(f); };
    q('#cauto').onclick = () => { cover = null; draw(); };
    bg.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { color = b.dataset.col; draw(); });
    bg.querySelectorAll('[data-img]').forEach(b => b.onclick = () => { cover = b.dataset.img; draw(); });
    q('#ok').onclick = async () => {
      q('#ok').disabled = true;
      try {
        let url = cover;
        if (cover && cover.startsWith('data:')) url = await uploadCover(full.id, cover);
        await api('/api/projects/' + full.id, { method: 'PUT', body: { cover: url, color } });
        close(); await loadList(); drawList(); toast('Vignette mise à jour');
      } catch (e) { q('#cerr').textContent = e.message; q('#ok').disabled = false; }
    };
  });
}
async function openSettings() {
  if (DEMO) return demoNote('Génération d’images', 'Dans la démo, « Moodboard IA » crée des aperçus de couleur à la place des vraies images. La version locale génère de vraies images gratuitement (Pollinations ou Cloudflare Workers AI).');
  let s; try { s = await api('/api/settings'); } catch (e) { return toast(esc(e.message)); }
  modal(`<h3>IA : texte et images</h3>
    <div class="choices">
      <label class="choice"><input type="radio" name="pv" value="pollinations" ${s.imageProvider === 'pollinations' ? 'checked' : ''}><b>Pollinations</b><span>Gratuit, sans compte. Limité à ~1 image / 15 s, filigrane possible. Une clé gratuite (enter.pollinations.ai) lève ces limites.</span></label>
      <label class="choice"><input type="radio" name="pv" value="cloudflare" ${s.imageProvider === 'cloudflare' ? 'checked' : ''}><b>Cloudflare Workers AI · FLUX.1 schnell</b><span>Compte gratuit : 10 000 neurones / jour (environ 200 images). Images carrées 1024 px.</span></label>
    </div>
    <label class="fl">Clé Pollinations (optionnelle)<input id="pk" value="${esc(s.pollinationsKey)}" placeholder="sk_…"></label>
    <label class="fl">Cloudflare Account ID<input id="ca" value="${esc(s.cfAccountId)}"></label>
    <label class="fl">Cloudflare jeton API (Workers AI)<input id="ct" value="${esc(s.cfToken)}" placeholder="Jeton avec la permission Workers AI"></label>
    <p class="note sm">Prep AI utilise le même service pour le texte : Pollinations (modèle « openai », gratuit, plus rapide avec une clé) ou Cloudflare (Llama 3.3). Les clés restent sur cet ordinateur (data/settings.json).</p>
    <div class="row end"><button class="btn ghost" data-close>Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`,
    (bg, close) => {
      bg.querySelector('#ok').onclick = async () => {
        await api('/api/settings', { method: 'PUT', body: { imageProvider: bg.querySelector('input[name=pv]:checked').value, pollinationsKey: bg.querySelector('#pk').value, cfAccountId: bg.querySelector('#ca').value, cfToken: bg.querySelector('#ct').value } });
        close(); toast('Réglages enregistrés');
      };
    });
}

const demoNote = (title, text) => modal(`<div class="row between"><h3>${title}</h3><button class="x" data-close>✕</button></div><p class="note">${text}</p><div class="row end"><button class="btn" data-close>Compris</button></div>`);
async function openPhone() {
  if (DEMO) return demoNote('Version démo', 'Vous êtes sur la démo en ligne : elle fonctionne déjà sur le téléphone. La version locale (Studio-Prepa.zip) se lance sur l’ordinateur et s’ouvre sur le téléphone par QR code, avec vos vrais projets.');
  let n; try { n = await api('/api/network'); } catch (e) { return toast(esc(e.message)); }
  const url = n.lan[0];
  modal(`<div class="row between"><h3>Ouvrir sur le téléphone</h3><button class="x" data-close>✕</button></div>
    ${url ? `<p class="note">Le téléphone doit être sur le <b>même Wi-Fi</b> que cet ordinateur. Scannez le code avec l’appareil photo :</p>
      <div class="qr"><img src="${n.qr}" alt="QR code"><div class="qurl">${n.lan.map(u => `<code>${esc(u)}</code>`).join('')}</div></div>
      <div class="howto"><div><b>iPhone / iPad</b><span>Ouvrez le lien dans Safari → bouton Partager → « Sur l’écran d’accueil ».</span></div>
      <div><b>Android</b><span>Ouvrez le lien dans Chrome → menu ⋮ → « Ajouter à l’écran d’accueil ».</span></div></div>
      <p class="note sm">Connectez-vous avec le même compte. Sous Windows, autorisez Node.js sur les « réseaux privés » si le pare-feu le demande. Si le lien ne s’ouvre pas, vérifiez que le Wi-Fi n’isole pas les appareils (réseaux invités).</p>`
      : n.local ? `<p class="note">L’application est limitée à cet ordinateur (HOST=127.0.0.1 dans le fichier .env). Mettez <code>HOST=0.0.0.0</code>, puis relancez l’application.</p>`
        : `<p class="note">Aucun réseau Wi-Fi détecté sur cet ordinateur. Connectez-le au même Wi-Fi que le téléphone, puis rouvrez cette fenêtre.</p>`}`);
}
// Téléchargement d'un fichier texte (démo : via Claude ; local : lien direct)
// Téléchargement : dans la démo, via la permission « téléchargements » de Claude ; sinon lien classique.
// Si le lecteur ne permet pas de télécharger (lien ouvert hors de Claude, permission absente), on l'explique au lieu de ne rien faire.
let dlP = null;
const getDL = () => dlP ||= (DEMO && window.claude && window.claude.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null));
if (DEMO) setTimeout(getDL, 0);
async function saveFile(name, blob) {
  const dl = await getDL();
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); toast(tr('Fichier prêt')); return true; }
    catch (err) { if (err && err.code === 'declined') return false; }
  }
  const url = URL.createObjectURL(blob);
  if (!DEMO || !(window.claude && window.claude.use)) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return true; }
  modal(`<div class="row between"><h3>${tr('Téléchargement bloqué ici')}</h3><button class="x" data-close>✕</button></div>
    <p class="note">${tr('Le fichier est prêt, mais cette fenêtre n’autorise pas les téléchargements. Ouvrez la démo depuis Claude (connecté à votre compte) et acceptez la demande de téléchargement, ou utilisez l’application installée sur l’ordinateur.')}</p>
    <p class="note"><b data-nt>${esc(name)}</b> · ${Math.max(1, Math.round(blob.size / 1024))} Ko</p>
    <div class="row end"><button class="btn ghost" data-close>${tr('Fermer')}</button><a class="btn" href="${url}" download="${esc(name)}" target="_blank" rel="noopener">${tr('Essayer quand même')}</a></div>`);
  return false;
}
async function downloadText(name, text, type) {
  const blob = text instanceof Blob ? text : new Blob([text], { type: type + ';charset=utf-8' });
  return saveFile(name, blob);
}
const pdtStyle = () => { try { return localStorage.getItem('goset.pdtstyle') || 'goset'; } catch (e) { return 'goset'; } };
const EXPORT_SECTIONS = [['ppm', 'Brief et PPM'], ['cover', 'Couverture'], ['film', 'Le film / épisodes'], ['chars', 'Personnages'], ['places', 'Lieux'], ['objects', 'Objets'], ['dec', 'Découpage technique'], ['story', 'Storyboard des plans'], ['canvas', 'Vue d’ensemble du canvas'], ['mood', 'Moodboards par scène'], ['notes', 'Notes et mind maps'], ['palette', 'Palette de couleurs'], ['dep', 'Dépouillement'], ['art', 'Liste artistique'], ['pdt', 'Plan de travail'], ['strip', 'Stripboard'], ['fds', 'Feuilles de service'], ['bud', 'Budget'], ['post', 'Post-production IA']];
function openExport() {
  const saved0 = (() => { try { return JSON.parse(localStorage.getItem('sp.export2') || 'null'); } catch { return null; } })(); const saved = saved0 ? [...saved0, ...['film', 'chars', 'places', 'objects', 'bud', 'post', 'ppm'].filter(k => !saved0.includes('_' + k) && !saved0.includes(k))] : EXPORT_SECTIONS.map(x => x[0]);
  modal(`<div class="row between"><h3>Exporter en présentation PDF</h3><button class="x" data-close>✕</button></div>
    <p class="note">Diapositives 16:9, prêtes à projeter, imprimer ou envoyer.</p>
    <div class="checks">${EXPORT_SECTIONS.filter(([k]) => !(isAI(S.project) && ['dep', 'art', 'pdt', 'strip', 'fds'].includes(k)) && !(k === 'post' && !isAI(S.project)) && !(k === 'ppm' && !isPub(S.project))).map(([k, l]) => `<label><input type="checkbox" value="${k}" ${saved.includes(k) ? 'checked' : ''}>${l}</label>`).join('')}</div>
    <div class="row"><button class="link" data-all>Tout cocher</button><button class="link" data-none>Tout décocher</button></div>
    ${isAI(S.project) ? '' : `<div class="xstyle"><b>${tr('Style du plan de travail')}</b><div class="xs-opts">
      <label class="xs ${pdtStyle() === 'goset' ? 'on' : ''}"><input type="radio" name="pdts" value="goset" ${pdtStyle() === 'goset' ? 'checked' : ''}><span class="xs-pv goset"><i></i><i></i><i></i><i></i></span><span><b>GOSET</b><small>${tr('Tableau moderne par journée, format 16:9')}</small></span></label>
      <label class="xs ${pdtStyle() === 'classic' ? 'on' : ''}"><input type="radio" name="pdts" value="classic" ${pdtStyle() === 'classic' ? 'checked' : ''}><span class="xs-pv classic"><i></i><i></i><i></i><i></i><i></i></span><span><b>${tr('Classique')}</b><small>${tr('Bandes verticales et rôles en lignes, A3 paysage (modèle AFAR)')}</small></span></label></div></div>`}
    <div class="err" id="xerr"></div>
    <div class="row end"><a class="btn ghost hidden" id="xopen" target="_blank" rel="noopener">Ouvrir</a><button class="btn" id="xgo">Créer le PDF</button></div>`,
    (bg) => {
      const boxes = () => [...bg.querySelectorAll('.checks input')];
      bg.querySelectorAll('[name=pdts]').forEach(r => r.onchange = () => bg.querySelectorAll('.xs').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)));
      bg.querySelector('[data-all]').onclick = () => boxes().forEach(b => b.checked = true);
      bg.querySelector('[data-none]').onclick = () => boxes().forEach(b => b.checked = false);
      bg.querySelector('#xgo').onclick = async () => {
        let sel = boxes().filter(b => b.checked).map(b => b.value);
        const sty = bg.querySelector('[name=pdts]:checked')?.value || 'goset'; try { localStorage.setItem('goset.pdtstyle', sty); } catch (e) { /* rien */ }
        if (sty === 'classic') sel = sel.map(k => k === 'pdt' ? 'pdtc' : k);
        if (!sel.length) { bg.querySelector('#xerr').textContent = 'Choisissez au moins une partie.'; return; }
        localStorage.setItem('sp.export2', JSON.stringify(sel));
        const btn = bg.querySelector('#xgo'); btn.disabled = true; btn.textContent = 'Création…'; bg.querySelector('#xerr').textContent = '';
        try {
          if (S.board) S.board.measure();
          dirty = true; await flush();
          const name = (S.project.name || 'projet').replace(/[\\/:*?"<>|]+/g, '-') + ' - présentation.pdf';
          let blob;
          if (DEMO) {
            // Démo : le PDF est fabriqué dans le navigateur, puis proposé au téléchargement par Claude
            btn.textContent = 'Mise en page…';
            const { buildPdfBlob } = await import('./pdf-browser.js');
            blob = await buildPdfBlob(S.project, sel, LANG);
            const ok = await saveFile(name, blob);
            if (!ok) { btn.disabled = false; btn.textContent = 'Créer le PDF'; return; }
            award('pdf', S.project.name);
          } else {
            const url = `/api/projects/${S.project.id}/export.pdf?lang=${LANG}&s=${sel.join(',')}`;
            const r = await fetch(url); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur ' + r.status);
            blob = await r.blob();
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
            const o = bg.querySelector('#xopen'); o.href = url + '&view=1'; o.classList.remove('hidden');
            award('pdf', S.project.name);
          }
          btn.textContent = 'Télécharger à nouveau'; toast(`PDF prêt (${Math.max(1, Math.round(blob.size / 1024))} Ko)`);
        } catch (e) { bg.querySelector('#xerr').textContent = 'Export impossible : ' + e.message; btn.textContent = 'Créer le PDF'; }
        btn.disabled = false;
      };
    });
}

// ---------- Contexte partagé avec la Bible et les fiches ----------
initBible({
  modal, toast,
  get project() { return S.project; },
  P: () => S.P,
  save: () => scheduleSave(),
  refresh: soft => { reanalyse(false); if (!soft) renderTab(); },
  upload: async f => {
    const r = await fetch(`/api/projects/${S.project.id}/assets`, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Erreur'); return j.url;
  },
  gotoScene: k => { const sc = S.P.scenes.find(x => x.k === k); S.gotoScene = k; nav(`#/p/${S.project.id}` + (sc && sc.epId ? `/e/${sc.epId}` : '') + '/script'); },
  onTitle: () => { const pn = document.querySelector('.pname'); if (pn) pn.value = S.project.name; document.title = S.project.name + ' · GOSET.ai'; }
});

initPrepAI({
  modal, toast, demo: DEMO,
  get project() { return S.project; },
  P: () => S.P,
  save: () => scheduleSave(),
  refresh: soft => { reanalyse(false); if (!soft && S.project) renderTab(); },
  ep: () => S.ep,
  goto: tab => nav(pbase() + '/' + tab)
});

// ---------- Projet ----------
const AI_SKIP = new Set(['dep', 'art', 'pdt', 'fds']);
const tabsFor = p => {
  if (isAI(p)) return [TABS[0], ['ai', 'Studio IA'], ...(isPub(p) ? [['brief', 'Brief']] : []), ...TABS.slice(1).filter(t => !AI_SKIP.has(t[0]))];
  if (isPub(p)) return [TABS[0], ['brief', 'Brief'], ...TABS.slice(1)];
  if (formatOf(p) === 'clip') return TABS.map(t => t[0] === 'script' ? ['script', 'Paroles'] : t);
  return TABS;
};
const TABS = [['canvas', 'Canvas'], ['script', 'Scénario'], ['bible', 'Bible'], ['team', 'Équipe'], ['dec', 'Découpage'], ['dep', 'Dépouillement'], ['art', 'Liste artistique'], ['pdt', 'Plan de travail'], ['fds', 'Feuilles de service'], ['bud', 'Budget']];
let saveT = null, dirty = false;
function setStatus(t) { const s = $('#pstat'); if (s) s.textContent = t; }
function scheduleSave() { dirty = true; setStatus('Modifié…'); clearTimeout(saveT); saveT = setTimeout(flush, 700); }
async function flush() {
  clearTimeout(saveT); if (!dirty || !S.project) return; dirty = false;
  const p = S.project; setStatus('Enregistrement…');
  try { await api('/api/projects/' + p.id, { method: 'PUT', body: { name: p.name, script: p.script, settings: p.settings, edits: p.edits, canvas: p.canvas, bible: p.bible || {}, episodes: p.episodes || null, shots: p.shots || {}, budget: p.budget || null, ai: p.ai || null, invoice: p.invoice || null, tags: p.tags || null, found: p.found || null, ignore: p.ignore || null, brief: p.brief || null, credits: p.credits || null, format: p.format || undefined } }); setStatus('Enregistré'); }
  catch (e) { dirty = true; setStatus('Non enregistré'); toast('Enregistrement impossible : ' + esc(e.message)); }
}
window.addEventListener('pagehide', () => { if (dirty && S.project) { const p = S.project; fetch('/api/projects/' + p.id, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: p.name, script: p.script, settings: p.settings, edits: p.edits, canvas: p.canvas, bible: p.bible || {}, episodes: p.episodes || null, shots: p.shots || {}, budget: p.budget || null, ai: p.ai || null, tags: p.tags || null, credits: p.credits || null, format: p.format || undefined }) }); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

const mentionItems = () => projectItems(S.P, bibleOf(S.project, S.P), S.project.tags);
// Nouveau nom via « @ » : catégorie retenue + fiche dans la Bible (si elle n'existe pas déjà)
function mentionCreate(name, cat) {
  const p = S.project; (p.tags ||= {})[name.toLowerCase()] = cat;
  const kind = cat === 'ch' ? 'ch' : cat === 'pl' ? 'pl' : 'ob', B = bibleOf(p, S.P);
  const ex = (p.bible?.objects || []).find(c => (p.edits?.[bibKey('ob:c:' + c.id, 'name')] || '').toLowerCase() === name.toLowerCase());
  if (kind === 'ob' && ex) p.edits[bibKey('ob:c:' + ex.id, 'cat')] = (MENTION_CATS.find(x => x[0] === cat) || [, 'Accessoire'])[1];
  else if (!B[kind].some(x => x.name.toLowerCase() === name.toLowerCase())) {
    const b = p.bible ||= {}, id = Math.random().toString(36).slice(2, 9), key = kind + ':c:' + id;
    (b[{ ch: 'chars', pl: 'places', ob: 'objects' }[kind]] ||= []).push({ id });
    p.edits ||= {}; p.edits[bibKey(key, 'name')] = kind === 'ch' ? name.toUpperCase() : name.charAt(0).toUpperCase() + name.slice(1);
    if (kind === 'ob') p.edits[bibKey(key, 'cat')] = (MENTION_CATS.find(x => x[0] === cat) || [, 'Accessoire'])[1];
  }
  scheduleSave(); reanalyse(false);
  toast(`« ${esc(name)} » ${tr('ajouté à la Bible')} · ${tr((MENTION_CATS.find(x => x[0] === cat) || [, ''])[1])}`);
}
// « @ » partout dans le projet : tout champ texte (sauf le titre et les champs chiffrés)
const slugTok = n => '@' + n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
document.addEventListener('focusin', e => {
  const el = e.target;
  if (!S.project || !el.closest || !el.closest('.proj, .modal, .shome')) return;
  if (!(el.tagName === 'TEXTAREA' || el.isContentEditable || (el.tagName === 'INPUT' && /^(text|search|)$/.test(el.type || '')))) return;
  if (el.matches('.pname, [data-nomention], #np, .bn, [type=number]') || el.closest('.inv, .ink-res')) return;
  attachMentions(el, { items: mentionItems, create: mentionCreate, token: el.matches('textarea[data-aip]') ? i => i.cat === 'ch' ? ((S.project.ai?.chars?.[i.name]?.token) || slugTok(i.name)) : i.name : undefined });
});
function reanalyse(announce) {
  const prev = S.P; S.P = analyse(S.project);
  setTimeout(() => { try { setUser(S.me?.email); checkProject(S.project, S.P); } catch { /* distinctions facultatives */ } }, 900);
  if (announce) {
    const d = diff(prev, S.P);
    if (d) {
      const parts = [];
      if (d.add) parts.push(`+${d.add} scène${d.add > 1 ? 's' : ''}`);
      if (d.del) parts.push(`−${d.del} scène${d.del > 1 ? 's' : ''}`);
      if (d.chg) parts.push(`${d.chg} modifiée${d.chg > 1 ? 's' : ''}`);
      if (d.newRoles.length) parts.push(`nouveau rôle : ${d.newRoles.map(esc).join(', ')}`);
      if (d.goneRoles.length) parts.push(`rôle retiré : ${d.goneRoles.map(esc).join(', ')}`);
      parts.push(`plan : ${d.days} jour${d.days > 1 ? 's' : ''}${d.dayDelta ? ` (${d.dayDelta > 0 ? '+' : ''}${d.dayDelta})` : ''}`);
      toast('<b>Scénario mis à jour</b> · ' + parts.join(' · ') + '<br><small>Canvas, dépouillement, liste artistique, plan de travail et feuilles de service suivent.</small>', 4200);
    }
  }
  return S.P;
}
const pbase = () => `#/p/${S.project.id}` + (S.ep ? `/e/${S.ep}` : '');
async function openProject(id, tab, ep) {
  if (!S.project || S.project.id !== id) {
    await flush();
    app.innerHTML = '<div class="note pad">Ouverture…</div>';
    try { S.project = (await api('/api/projects/' + id)).project; } catch (e) { app.innerHTML = `<div class="pad"><p>${esc(e.message)}</p><a href="#/files">← Projets</a></div>`; return; }
    S.project.settings = { ...DEFAULT_SETTINGS(), ...(S.project.settings || {}) };
    S.project.edits ||= {}; S.P = null; S.day = 0; S.shell = null; reanalyse(false);
  }
  const p = S.project, series = isSeries(p);
  if (ep && !(series && p.episodes.some(e => e.id === ep))) ep = null;
  if (ep !== S.ep) { S.ep = ep; S.epf = undefined; }
  if (series && !tab && !ep) return renderSeriesHome();
  if (!tab) tab = ep ? 'script' : 'canvas';
  if (S.shell !== 'work:' + (S.ep || '')) {
    S.shell = 'work:' + (S.ep || '');
    const epObj = series && S.ep ? p.episodes.find(e => e.id === S.ep) : null, epN = epObj ? p.episodes.indexOf(epObj) + 1 : 0;
    app.innerHTML = `<div class="proj">
      <header class="ptop">
        <a class="back" href="${series ? `#/p/${id}` : '#/files'}">‹ ${series ? tr(isPub(p) ? 'Campagne' : 'Série') : 'Projets'}</a>
        <input class="pname" value="${esc(p.name)}" spellcheck="false">
        ${series ? `<select class="epsel" title="${tr(unitWord(p))}"><option value="">${tr(isPub(p) ? 'Toute la campagne' : 'Toute la série')}</option>${p.episodes.map((e, i) => `<option value="${e.id}" ${e.id === S.ep ? 'selected' : ''}>${isPub(p) ? 'Spot' : 'Ép.'} ${i + 1} · ${esc(e.name || '')}</option>`).join('')}</select>` : ''}
        <nav class="ptabs">${tabsFor(p).map(([k, l]) => `<a href="${pbase()}/${k}" data-t="${k}" class="${k === 'ai' ? 'ai-tab' : ''}">${k === 'ai' ? '✦ ' : ''}${l}</a>`).join('')}</nav>
        <span class="pstat" id="pstat">Enregistré</span>${themeBtn()}
        <button class="btn sm" id="pexport" title="Exporter la présentation PDF">Exporter PDF</button>
      </header>
      ${epObj ? `<div class="epbar">Ép. ${epN} · <b>${esc(epObj.name || '')}</b><span>Scénario, dépouillement et découpage de cet épisode · plan de travail commun à la série</span></div>` : ''}
      <div class="pbody" id="pbody"></div></div>`;
    mountButton(app.querySelector('.proj'));
    const pn = app.querySelector('.pname');
    pn.oninput = () => { S.project.name = pn.value || 'Sans titre'; document.title = S.project.name + ' · GOSET.ai'; scheduleSave(); };
    pn.onkeydown = e => { if (e.key === 'Enter') pn.blur(); };
    app.querySelector('.epsel')?.addEventListener('change', e => { const v = e.target.value; nav(`#/p/${id}` + (v ? `/e/${v}` : '') + '/' + S.tab); });
    app.querySelector('#pexport').onclick = openExport;
    bindProdEvents();
  }
  document.title = p.name + ' · GOSET.ai';
  S.tab = tabsFor(p).some(t => t[0] === tab) ? tab : 'canvas';
  app.querySelectorAll('.ptabs a').forEach(a => a.classList.toggle('on', a.dataset.t === S.tab));
  const fab = app.querySelector('.prepai-fab'); if (fab) fab.style.display = S.tab === 'canvas' ? '' : 'none'; // Moodboard AI : seulement sur le canvas
  app.querySelector('.ptabs a.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  renderTab();
}
// ---------- Accueil d'une série : les épisodes comme des sous-dossiers ----------
function renderSeriesHome() {
  const p = S.project, P = S.P; S.shell = 'home'; S.ep = null;
  if (S.board) { S.board.destroy(); S.board = null; }
  document.title = p.name + ' · GOSET.ai';
  const epTile = (e, i) => {
    const sc = P.scenes.filter(x => x.epId === e.id), mins = sc.reduce((a, x) => a + x.est, 0);
    return `<div class="tile eptile" data-ep="${e.id}" tabindex="0"><div class="thumb strips" style="--c:${p.color}">${sc.slice(0, 12).map(x => `<i class="sw ${cls(x)}"></i>`).join('') || '<span class="emptyep">Vide</span>'}</div>
      <div class="nm"><span class="epn">${isPub(p) ? 'Spot' : 'Ép.'} ${i + 1}</span>${esc(e.name || '')}</div><div class="meta">${sc.length} scène${sc.length > 1 ? 's' : ''}${mins ? ' · ' + Math.round(mins / 60 * 10) / 10 + ' h de tournage' : ''}</div><button class="more" data-epmenu="${e.id}" title="Options">•••</button></div>`;
  };
  const SER = [...(isPub(p) ? [['brief', 'Brief', 'Client, message, livrables, PPM']] : []), ['canvas', 'Canvas', 'Moodboard et mind map de la série'], ['bible', 'Bible', 'Personnages, lieux, objets'], ['team', 'Équipe', 'Production, réalisation, chefs de poste'], ['pdt', 'Plan de travail', 'Toute la série, glisser-déposer'], ['art', 'Liste artistique', 'Comédiens, contrats, dispos'], ['dep', 'Dépouillement', 'Tous les épisodes'], ['dec', 'Découpage', 'Plans de toute la série'], ['fds', 'Feuilles de service', 'Une par jour de tournage']];
  app.innerHTML = `<div class="shome"><header class="ftool"><a class="back" href="#/files">‹ Projets</a><h1>${esc(p.name)}</h1><span class="sbadge">${isPub(p) ? tr('Campagne') : 'Série'}</span><div class="sp"></div>${themeBtn()}<button class="btn sm ghost" id="pexport">Exporter PDF</button></header>
    <section class="pad2"><h2 class="sh">${tr(unitWord(p, true))} <small>${p.episodes.length}</small></h2>
      <div class="fl-grid eps">${p.episodes.map(epTile).join('')}<button class="tile addep" data-epadd><div class="thumb blank2"><span>+</span></div><div class="nm">${tr(isPub(p) ? 'Nouveau spot' : 'Nouvel épisode')}</div></button><label class="tile addep" title="${tr('Chaque fichier devient un épisode, dans l’ordre des numéros')}"><div class="thumb blank2"><span>⇪</span></div><div class="nm">${tr(isPub(p) ? 'Importer plusieurs spots' : 'Importer plusieurs épisodes')}</div><input type="file" id="epfiles" multiple accept=".pdf,.docx,.fdx,.fountain,.txt" hidden></label></div>
      <h2 class="sh">${tr(isPub(p) ? 'Toute la campagne' : 'Toute la série')}</h2>
      <div class="sgrid">${SER.map(([k, l, d]) => `<a class="scard" href="#/p/${p.id}/${k}"><b>${l}</b><span>${d}</span></a>`).join('')}</div>
      <p class="note">${P.scenes.length} scènes · ${P.roles.length} rôles · ${P.days.length} jours de tournage pour toute la série.</p></section></div>`;
  app.querySelector('#pexport').onclick = openExport;
  app.querySelector('#epfiles').onchange = async ev => {
    const files = [...ev.target.files]; if (!files.length) return;
    try {
      const list = await readEpisodes(files, (i, n) => toast(`${tr('Lecture')} ${i}/${n}…`, 1200));
      // Remplit d'abord les épisodes vides, puis ajoute les suivants
      let k = 0;
      p.episodes.forEach(e => { if (k < list.length && !(e.script || '').trim()) e.script = list[k++].script; });
      while (k < list.length) p.episodes.push({ id: epId(), name: tr(unitWord(p) + ' ' + (p.episodes.length + 1)), script: list[k++].script });
      scheduleSave(); reanalyse(false); renderSeriesHome();
      toast(`${list.length} ${tr(isPub(p) ? 'spot(s) importé(s)' : 'épisode(s) importé(s)')}`);
    } catch (e) { toast(esc(e.message)); }
  };
  const root = app.querySelector('.shome');
  root.addEventListener('click', async ev => {
    const m = ev.target.closest('[data-epmenu]'); if (m) { ev.stopPropagation(); return epMenu(ev, m.dataset.epmenu); }
    if (ev.target.closest('[data-epadd]')) { p.episodes.push({ id: epId(), name: tr(unitWord(p) + ' ' + (p.episodes.length + 1)), script: '' }); scheduleSave(); reanalyse(false); return renderSeriesHome(); }
    const t = ev.target.closest('.eptile'); if (t) nav(`#/p/${p.id}/e/${t.dataset.ep}`);
  });
  root.addEventListener('contextmenu', ev => { const t = ev.target.closest('.eptile'); if (t) { ev.preventDefault(); epMenu(ev, t.dataset.ep); } });
}
function epMenu(ev, id) {
  document.querySelector('.pop')?.remove();
  const p = S.project, i = p.episodes.findIndex(e => e.id === id), e2 = p.episodes[i];
  const pop = document.createElement('div'); pop.className = 'pop';
  pop.innerHTML = [['open', 'Ouvrir'], ['ren', 'Renommer'], ['up', 'Monter', !i], ['down', 'Descendre', i === p.episodes.length - 1], ['del', 'Supprimer', p.episodes.length === 1, 'danger']].map(([a, l, dis, c]) => `<button data-a="${a}" class="${c || ''}" ${dis ? 'disabled' : ''}>${l}</button>`).join('');
  document.body.appendChild(pop);
  pop.style.left = Math.min(ev.clientX, innerWidth - pop.offsetWidth - 8) + 'px'; pop.style.top = Math.min(ev.clientY, innerHeight - pop.offsetHeight - 8) + 'px';
  const off = x => { if (!pop.contains(x.target)) { pop.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true));
  pop.onclick = async x => {
    const a = x.target.closest('button')?.dataset.a; if (!a) return; pop.remove();
    if (a === 'open') return nav(`#/p/${p.id}/e/${id}`);
    if (a === 'ren') return renameBox(e2.name || '', n => { e2.name = n; scheduleSave(); reanalyse(false); renderSeriesHome(); });
    if (a === 'up' || a === 'down') { const j = i + (a === 'up' ? -1 : 1); [p.episodes[i], p.episodes[j]] = [p.episodes[j], p.episodes[i]]; scheduleSave(); reanalyse(false); return renderSeriesHome(); }
    if (a === 'del' && await confirmBox('Supprimer l’épisode ?', `« ${esc(e2.name)} » et son texte seront supprimés. Ses scènes disparaissent du plan de travail.`, 'Supprimer', true)) { p.episodes.splice(i, 1); scheduleSave(); reanalyse(false); renderSeriesHome(); }
  };
}
function renderTab() {
  const body = $('#pbody'); const p = S.project, P = S.P;
  body.className = 'pbody tab-' + S.tab;
  if (S.board) { S.board.destroy(); S.board = null; }
  if (S.tab === 'canvas') {
    S.board = new Board(body, {
      project: p, getP: () => S.P, onChange: scheduleSave, toast,
      gotoScene: k => { const sc = S.P.scenes.find(x => x.k === k); S.gotoScene = k; nav(`#/p/${p.id}` + (sc && sc.epId ? `/e/${sc.epId}` : '') + '/script'); },
      editScene: k => openScene(k),
      openAI: o => openAI(o),
      openInk: cb => openInk({ modal, toast, vision: askVision, onAdd: cb })
    });
    return;
  }
  if (S.tab === 'bible') {
    const draw = sub => { S.bsub = sub; body.innerHTML = `<div class="bwrap">${renderBible(sub)}</div>`; bindBible(body.firstElementChild, sub, draw); };
    return draw(S.bsub || 'film');
  }
  if (S.tab === 'script') return renderScript(body);
  if (S.tab === 'team') {
    const t0 = body.scrollTop, draw = () => { body.innerHTML = renderTeam(p); };
    draw(); body.scrollTop = t0;
    if (!body.dataset.tmb) { body.dataset.tmb = '1'; bindTeam(body, { project: p, save: scheduleSave, refresh: () => setTimeout(() => { if (S.tab === 'team') { const t1 = body.scrollTop, f = document.activeElement?.dataset?.cr; draw(); body.scrollTop = t1; if (f) body.querySelector(`[data-cr="${f}"]`)?.focus(); } }, 0) }); }
    return;
  }
  if (S.tab === 'brief') {
    const t0 = body.scrollTop, draw = () => { body.innerHTML = renderBrief(p, isSeriesP(p) ? p.episodes : []); };
    draw(); body.scrollTop = t0;
    if (!body.dataset.brb) { body.dataset.brb = '1'; bindBrief(body, { project: p, save: scheduleSave, refresh: () => setTimeout(() => { if (S.tab === 'brief') { const t1 = body.scrollTop; draw(); body.scrollTop = t1; } }, 0) }); }
    return;
  }
  if (S.tab === 'ai') {
    const top0 = body.scrollTop;
    const draw = sub => { if (sub) S.aisub = sub; const t0 = body.scrollTop; body.innerHTML = renderAIStudio(p, S.P, S.aisub || 'chars'); body.scrollTop = sub ? 0 : t0; };
    draw(); body.scrollTop = top0;
    if (!body.dataset.aib) {
      body.dataset.aib = '1';
      bindAIStudio(body, { project: p, get P() { return S.P; }, ask: (m, sig) => askAI(m, sig), parseJSON, save: scheduleSave, refresh: sub => setTimeout(() => { if (S.tab === 'ai') draw(sub); }, 0), toast, copy: t => copyText(t), download: downloadText,
        genImage: (pr, r, h) => genImage(pr, r, h), upload: f => uploadCover(p.id, f) });
    }
    return;
  }
  const top = body.scrollTop;
  const epf = S.epf !== undefined ? S.epf : S.ep;
  body.innerHTML = `<div class="prod">${S.tab === 'dec' ? renderDec(P, p, epf) : S.tab === 'dep' ? renderDep(P, p, epf) : S.tab === 'art' ? renderArt(P, p) : S.tab === 'pdt' ? renderPdt(P, p) : S.tab === 'bud' ? renderBud(P, p) : renderFds(P, p, S.day)}</div>`;
  if (S.keepScroll) { body.scrollTop = top; S.keepScroll = false; }
  if (S.tab === 'pdt') bindStripboard(body.querySelector('#sb'), body, tokens => setOrder(tokens, 'Ordre du plan de travail enregistré'));
  if (S.gotoScene && S.tab === 'dec') { document.getElementById('dec-' + S.gotoScene)?.scrollIntoView({ block: 'start' }); S.gotoScene = null; }
  if (S.gotoScene && S.tab === 'dep') { document.getElementById('dep-' + S.gotoScene)?.scrollIntoView({ block: 'center' }); S.gotoScene = null; }
}
function setOrder(tokens, msg) {
  // Retire les coupures en double au début / à la fin seulement si elles n'ont pas été voulues : on garde tout tel quel
  S.project.edits['strip.order'] = JSON.stringify(tokens);
  Object.keys(S.project.edits).filter(k => k.startsWith('day.')).forEach(k => delete S.project.edits[k]);
  scheduleSave(); reanalyse(false); S.keepScroll = true; renderTab(); if (msg) toast(msg);
}
function openUnavail(name) {
  const e = S.project.edits;
  const draw = bg => {
    const list = unavail(e, name), P = S.P;
    const hits = P.days.filter(d => d.conflicts.includes(name));
    bg.querySelector('#ulist').innerHTML = list.length ? list.map((r, i) => `<div class="urow"><span>${fmtRange(r)}</span><button class="link" data-urm="${i}">Retirer</button></div>`).join('') : '<p class="note">Aucune date pour l’instant.</p>';
    bg.querySelector('#uwarn').innerHTML = hits.length ? `<div class="alert">⚠ Convoqué pendant une indisponibilité : ${hits.map(d => 'J' + d.n + ' (' + fdate(d.date) + ')').join(', ')}. Déplacez ses séquences dans le plan de travail.</div>` : '';
  };
  modal(`<div class="row between"><h3>Indisponibilités · ${esc(name)}</h3><button class="x" data-close>✕</button></div>
    <p class="note">Dates où le comédien ne peut pas tourner. Le plan de travail, la liste artistique et les feuilles de service signalent les conflits.</p>
    <div id="ulist"></div>
    <div class="row gap2"><label class="fl">Du<input type="date" id="ufrom"></label><label class="fl">Au (facultatif)<input type="date" id="uto"></label></div>
    <div id="uwarn"></div>
    <div class="row between ebtm"><button class="btn ghost" id="uadd">Ajouter ces dates</button><button class="btn" data-close>OK</button></div>`, (bg) => {
    draw(bg);
    bg.querySelector('#uadd').onclick = () => {
      const from = bg.querySelector('#ufrom').value, to = bg.querySelector('#uto').value || from; if (!from) return bg.querySelector('#ufrom').focus();
      const list = unavail(e, name); list.push({ from: from <= to ? from : to, to: from <= to ? to : from }); list.sort((a, b) => a.from.localeCompare(b.from));
      e['unav.' + name] = JSON.stringify(list); scheduleSave(); reanalyse(false); draw(bg); bg.querySelector('#ufrom').value = bg.querySelector('#uto').value = '';
    };
    bg.querySelector('#ulist').addEventListener('click', ev => { const b = ev.target.closest('[data-urm]'); if (!b) return; const list = unavail(e, name); list.splice(+b.dataset.urm, 1); e['unav.' + name] = JSON.stringify(list); scheduleSave(); reanalyse(false); draw(bg); });
    bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-close]')) { S.keepScroll = true; renderTab(); } });
  });
}
function bindProdEvents() {
  const body = $('#pbody');
  body.addEventListener('input', e => {
    const so = e.target.closest('[data-shot]');
    if (so && so.isContentEditable) { const [k, id, f] = so.dataset.shot.split('|'); const x = (S.project.shots?.[k] || []).find(y => y.id === id); if (x) { x[f] = so.innerText.replace(/\n+$/, ''); scheduleSave(); } return; }
    const el = e.target.closest('[data-k]'); if (!el) return;
    if (!el.innerText.trim() && el.innerHTML !== '') el.innerHTML = '';
    S.project.edits[el.dataset.k] = el.innerText.replace(/\n+$/, '');
    if (/\.e$|^ov\.|^est\./.test(el.dataset.k)) reanalyse(false);
    scheduleSave();
  });
  body.addEventListener('click', e => {
    if (S.tab === 'bible' || S.tab === 'canvas') return;
    const sc = e.target.closest('[data-scene]'); if (sc) return openScene(sc.dataset.scene);
    const stp = e.target.closest('.sb-item.strip'); if (stp && !e.target.closest('.dh')) return openScene(stp.dataset.k);
    if (e.target.closest('[data-unbreak]')) { const br = e.target.closest('.sb-break'), toks = [...body.querySelectorAll('.sb-item')].filter(x => x !== br).map(x => x.dataset.break ? '|' : x.dataset.k); return setOrder(toks, 'Journées fusionnées'); }
    if (e.target.closest('[data-addbreak]')) return setOrder([...(stripOrder(S.project.edits) || orderFromDays(S.P.days)), '|'], 'Journée ajoutée : glissez-y des séquences');
    if (e.target.closest('[data-autoplan]')) { delete S.project.edits['strip.order']; Object.keys(S.project.edits).filter(k => k.startsWith('day.')).forEach(k => delete S.project.edits[k]); scheduleSave(); reanalyse(false); renderTab(); return toast('Plan recalculé automatiquement'); }
    const ef = e.target.closest('[data-epf]'); if (ef) { S.epf = ef.dataset.epf || null; return renderTab(); }
    const un = e.target.closest('[data-unav]'); if (un) return openUnavail(un.dataset.unav);
    const sh = S.project.shots ||= {};
    const da = e.target.closest('[data-dadd]'); if (da) { const k = da.dataset.dadd; (sh[k] ||= []).push({ id: epId(), size: '', angle: '', move: '', lens: '', desc: '', sound: '', dur: '' }); scheduleSave(); reanalyse(false); S.keepScroll = true; return renderTab(); }
    const dm = e.target.closest('[data-dmv]'); if (dm) { const [k, id, d] = dm.dataset.dmv.split('|'); const a = sh[k] || [], i = a.findIndex(x => x.id === id), j = i + +d; if (i >= 0 && j >= 0 && j < a.length) { [a[i], a[j]] = [a[j], a[i]]; scheduleSave(); S.keepScroll = true; renderTab(); } return; }
    const dd = e.target.closest('[data-ddel]'); if (dd) { const [k, id] = dd.dataset.ddel.split('|'); sh[k] = (sh[k] || []).filter(x => x.id !== id); if (!sh[k].length) delete sh[k]; scheduleSave(); reanalyse(false); S.keepScroll = true; return renderTab(); }
    const ds = e.target.closest('[data-dsketch]'); if (ds) { const [k, id] = ds.dataset.dsketch.split('|'); return sketchShot(k, id); }
    const dv = e.target.closest('[data-dview]'); if (dv) { try { localStorage.setItem('sp.decview', dv.dataset.dview); } catch (er) { /* rien */ } S.keepScroll = true; return renderTab(); }
    const dai = e.target.closest('[data-dai]'); if (dai) return openAI({ mode: 'dec', sceneKey: dai.dataset.dai || null });
    const en = e.target.closest('[data-ent]'); if (en) return openEntity(en.dataset.ent, () => { reanalyse(false); renderTab(); });
    const c = e.target.closest('[data-copy]'); if (c) return copyTable(c.dataset.copy);
    const ct = e.target.closest('[data-copytext]'); if (ct) return copyText(document.getElementById(ct.dataset.copytext).innerText);
    if (e.target.closest('[data-aidep]')) return aiBreakdown();
    if (e.target.closest('[data-xoadd]')) { const st = S.project.settings; (st.extraOff ||= []).push({ d: st.start || '', l: '' }); scheduleSave(); S.keepScroll = true; return renderTab(); }
    const xd = e.target.closest('[data-xodel]'); if (xd) { S.project.settings.extraOff.splice(+xd.dataset.xodel, 1); scheduleSave(); reanalyse(false); S.keepScroll = true; return renderTab(); }
    if (S.tab === 'bud') {
      const B = S.project.budget ||= budgetDefaults(); B.auto ||= {}; B.lines ||= [];
      const ba = e.target.closest('[data-badd]'); if (ba) { B.lines.push({ id: epId(), cat: ba.dataset.badd, label: '', qty: 1, unit: 'forfait', rate: 0, c: B.cur || 'TND' }); scheduleSave(); S.keepScroll = true; renderTab(); setTimeout(() => { const l = [...body.querySelectorAll('input.bi')].pop(); l?.focus(); }, 30); return; }
      const bd = e.target.closest('[data-bdel]'); if (bd) { const [t, id] = [bd.dataset.bdel.slice(0, 1), bd.dataset.bdel.slice(2)]; if (t === 'a') (B.auto[id] ||= {}).off = true; else B.lines = B.lines.filter(l => l.id !== id); scheduleSave(); S.keepScroll = true; return renderTab(); }
      if (e.target.closest('[data-bshow]')) { Object.values(B.auto).forEach(o => { if (o) delete o.off; }); scheduleSave(); S.keepScroll = true; return renderTab(); }
      if (e.target.closest('[data-binv]')) return openInvoice({ project: S.project, P: S.P, modal, toast, save: scheduleSave, download: (n, b) => downloadText(n, b, 'application/pdf') });
      if (e.target.closest('[data-bcsv]')) { const data = budgetCSV(S.P, S.project), name = (S.project.name || 'budget').replace(/[^\w\u00C0-\u024F\u0600-\u06FF -]+/g, '').trim() + ' - budget.csv'; return downloadText(name, data, 'text/csv'); }
    }
    if (e.target.closest('[data-print]')) return window.print();
    const d = e.target.closest('[data-day]'); if (d && !d.disabled) { S.day = +d.dataset.day; renderTab(); }
  });
  body.addEventListener('change', e => {
    if (e.target.id === 'daySel') { S.day = +e.target.value; renderTab(); }
    if (S.tab === 'bud' && e.target.matches('[data-bl],[data-bs]')) {
      const B = S.project.budget ||= budgetDefaults(); B.auto ||= {}; B.lines ||= []; B.fx ||= {};
      const v = e.target.type === 'number' ? (e.target.value === '' ? '' : Math.max(0, +e.target.value)) : e.target.value;
      if (e.target.dataset.bs) { const f = e.target.dataset.bs; if (f.startsWith('fx.')) B.fx[f.slice(3)] = v === '' ? 0 : v; else B[f] = v; }
      else { const [id, f] = e.target.dataset.bl.split('|'), t = id.slice(0, 1), key = id.slice(2); if (t === 'a') (B.auto[key] ||= {})[f] = v; else { const l = B.lines.find(x => x.id === key); if (l) l[f] = v; } }
      scheduleSave();
      clearTimeout(S.budT); S.budT = setTimeout(() => {
        const a = document.activeElement, sel = a && a.dataset && (a.dataset.bl ? `[data-bl="${a.dataset.bl}"]` : a.dataset.bs ? `[data-bs="${a.dataset.bs}"]` : null);
        S.keepScroll = true; renderTab();
        if (sel) { const n = body.querySelector(sel); if (n) { n.focus(); if (n.select && n.type !== 'number') try { n.select(); } catch (er) { /* rien */ } } }
      }, 0);
    }
    if (e.target.matches('[data-cat]') && S.tab !== 'bible') { S.project.edits['cat.' + e.target.dataset.cat] = e.target.value; scheduleSave(); reanalyse(false); renderTab(); }
    if (e.target.matches('select[data-shot]')) { const [k, id, f] = e.target.dataset.shot.split('|'); const x = (S.project.shots?.[k] || []).find(y => y.id === id); if (x) { x[f] = e.target.value; scheduleSave(); } }
    if (e.target.matches('[data-sel]')) { S.project.edits[e.target.dataset.sel] = e.target.value; e.target.className = 'csel st-' + (e.target.value || 'none').toLowerCase().replace(/[^a-z]/g, ''); scheduleSave(); }
    if (S.tab === 'pdt' && (e.target.dataset.off != null || e.target.dataset.xo != null)) {
      const st = S.project.settings;
      if (e.target.dataset.off != null) { const cur = new Set(offDays(st)); const n = +e.target.dataset.off; e.target.checked ? cur.add(n) : cur.delete(n); if (cur.size >= 7) { toast(tr('Il faut au moins un jour de tournage par semaine.')); return renderTab(); } st.off = [...cur]; }
      else { const [i, f] = e.target.dataset.xo.split('|'); const xo = st.extraOff ||= []; if (xo[+i]) xo[+i][f] = e.target.value; }
      scheduleSave(); reanalyse(false); S.keepScroll = true; setTimeout(renderTab, 0); toast(tr('Plan de travail recalculé')); return;
    }
    if (e.target.matches('[data-s]') && S.tab === 'pdt') { S.project.settings[e.target.dataset.s] = e.target.value; scheduleSave(); reanalyse(false); S.keepScroll = true; setTimeout(renderTab, 0); toast('Plan de travail recalculé'); }
    if (e.target.matches('[data-pat]')) { const k = 'fds.' + e.target.dataset.pat + '.pat'; if (e.target.value) S.project.edits[k] = e.target.value; else delete S.project.edits[k]; scheduleSave(); reanalyse(false); renderTab(); toast('Horaires de la journée recalculés'); }
  });
  body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.strip[data-scene]')) openScene(e.target.dataset.scene); });
  body.addEventListener('focusout', e => {
    const k = e.target.closest?.('[data-k]')?.dataset.k;
    if (k && /\.e$|^ov\.|^est\./.test(k) && S.tab === 'dep') { reanalyse(false); setTimeout(() => { if (!document.activeElement?.closest?.('[data-k]')) renderTab(); }, 0); }
  });
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copié'); } catch { toast('Copie refusée par le navigateur'); } }
function copyTable(id) { const t = document.getElementById(id); if (t) copyText([...t.rows].map(r => [...r.cells].map(c => c.innerText.replace(/[\t\n]+/g, ' ').trim()).join('\t')).join('\n')); }

// ---------- Onglet Scénario ----------
const epId = () => Math.random().toString(36).slice(2, 8);
// Thème : sombre (par défaut) ou clair, gardé dans le navigateur
function isDark() { return document.documentElement.dataset.theme === 'dark'; }
function themeBtn() { return `<button class="thm" data-themetog title="${tr(isDark() ? 'Passer en mode clair' : 'Passer en mode sombre')}" aria-label="${tr(isDark() ? 'Passer en mode clair' : 'Passer en mode sombre')}">${isDark() ? '☀' : '☾'}</button>`; }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-themetog]'); if (!b) return;
  const d = !isDark(); document.documentElement.dataset.theme = d ? 'dark' : 'light';
  try { localStorage.setItem('goset.theme', d ? 'dark' : 'light'); } catch (er) { /* rien */ }
  document.querySelectorAll('[data-themetog]').forEach(x => { x.textContent = d ? '☀' : '☾'; x.title = tr(d ? 'Passer en mode clair' : 'Passer en mode sombre'); });
});
const isSeriesP = p => Array.isArray(p.episodes) && p.episodes.length > 0;
// Dépouillement complété par l'IA : le texte d'action des scènes est envoyé (avec accord) au service IA gratuit
function aiBreakdown() {
  const p = S.project, P = S.P;
  modal(`<div class="row between"><h3>✦ ${tr('Compléter le dépouillement avec l’IA')}</h3><button class="x" data-close>✕</button></div>
    <p class="note">${tr('L’IA lit les descriptions des scènes (sans les dialogues) et ajoute les accessoires, costumes, maquillage, véhicules, animaux, effets et figurants oubliés par la détection automatique. Vous pourrez tout corriger dans le tableau.')}</p>
    <p class="note">${tr('Le texte des scènes est envoyé au service IA gratuit. N’utilisez pas cette option pour un scénario confidentiel.')}</p>
    <div class="err" id="aiderr"></div>
    <div class="row end"><button class="btn ghost" data-close>${tr('Annuler')}</button><button class="btn ai-grad" id="aidgo">${tr('Lancer')} (${P.scenes.length} ${tr('scènes')})</button></div>`, (bg, close) => {
    bg.querySelector('#aidgo').onclick = async () => {
      const b = bg.querySelector('#aidgo'); b.disabled = true;
      const chunks = []; let cur = [], size = 0;
      P.scenes.forEach(sc => { const t = `[${sc.k}] ${sc.ie} ${sc.decor} - ${sc.timeL}: ${sc.action.join(' ').slice(0, 1500)}`; if (size + t.length > 6000 && cur.length) { chunks.push(cur); cur = []; size = 0; } cur.push(t); size += t.length; });
      if (cur.length) chunks.push(cur);
      let added = 0;
      try {
        for (let i = 0; i < chunks.length; i++) {
          b.textContent = `${tr('Analyse')} ${i + 1}/${chunks.length}…`;
          const r = await askAI([{ role: 'system', content: 'You are a film first assistant director doing a script breakdown. Answer only with JSON.' },
            { role: 'user', content: `For each scene below (key in brackets), list the physical elements a production must prepare, in the language of the script, short nouns with their key detail (e.g. "bouteille de vin rouge", "pinceau"). Categories: acc (props), cos (costumes/wardrobe), hmc (hair, make-up, special make-up), veh (vehicles), ani (animals), fig (extras/background), casc (stunts), sfx (special/visual effects), son (sound/music played on set). Do not list characters. JSON: {"scenes":{"KEY":{"acc":[],"cos":[],"hmc":[],"veh":[],"ani":[],"fig":[],"casc":[],"sfx":[],"son":[]}}}\n\n` + chunks[i].join('\n') }]);
          const j = parseJSON(r); const sc = j && (j.scenes || j);
          if (sc && typeof sc === 'object') Object.entries(sc).forEach(([k, f]) => { if (!P.scenes.some(x => x.k === k) || !f) return; const o = ((p.found ||= {})[k] ||= {}); Object.entries(f).forEach(([c, list]) => { if (!Array.isArray(list)) return; o[c] = [...new Set([...(o[c] || []), ...list.map(x => String(x).toLowerCase().trim()).filter(Boolean)])]; added += list.length; }); });
        }
        scheduleSave(); reanalyse(false); close(); renderTab();
        toast(added ? `${added} ${tr('éléments ajoutés au dépouillement')}` : tr('Rien de nouveau trouvé.'));
      } catch (e) { bg.querySelector('#aiderr').textContent = e.message || tr('Service IA indisponible.'); b.disabled = false; b.textContent = tr('Réessayer'); }
    };
  });
}
// Plusieurs fichiers d'épisodes : rangés par numéro d'épisode trouvé dans le nom (Ep 2, E03, Épisode_4, 1x05…), sinon par nom
export function episodeOrder(files) {
  const num = f => { const n = f.name.replace(/\.[^.]+$/, ''); const m = n.match(/(?:[ée]pisode|ep|e|x)\s*[-_.#]?\s*(\d{1,3})(?!\d)/i) || n.match(/(\d{1,3})(?!.*\d)/); return m ? +m[1] : 1e9; };
  return [...files].sort((a, b) => num(a) - num(b) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}
async function readEpisodes(files, onStep) {
  const out = []; let i = 0;
  for (const f of episodeOrder(files)) { onStep && onStep(++i, files.length); out.push({ name: f.name.replace(/\.[^.]+$/, ''), script: await readFile(f) }); }
  return out;
}
// Film → série : le scénario devient l'épisode 1 et toutes les modifications suivent (clés de scène renommées)
function toSeries() {
  const p = S.project, id = epId(), old = analyse(p);
  p.episodes = [{ id, name: tr('Épisode 1'), script: p.script || '' }];
  const map = new Map(old.scenes.map(sc => [sc.k, id + ':' + sc.k]));
  const e = p.edits, out = {};
  Object.entries(e).forEach(([k, v]) => {
    let nk = k;
    for (const [o, n] of map) {
      if (k.startsWith('bd.' + o + '.')) { nk = 'bd.' + n + k.slice(3 + o.length); break; }
      if (k.startsWith('ov.' + o + '.')) { nk = 'ov.' + n + k.slice(3 + o.length); break; }
      if (k === 'day.' + o) { nk = 'day.' + n; break; }
      if (k === 'est.' + o) { nk = 'est.' + n; break; }
      const m = k.match(/^(fds\.\d+\.t\.)(.+)$/); if (m && m[2] === o) { nk = m[1] + n; break; }
    }
    out[nk] = v;
  });
  const ord = stripOrder(e); if (ord) out['strip.order'] = JSON.stringify(ord.map(t => map.get(t) || t));
  p.edits = out;
  (p.canvas?.items || []).forEach(it => { if (it.type === 'scene' && map.has(it.sceneKey)) it.sceneKey = map.get(it.sceneKey); });
  S.ep = id; scheduleSave(); reanalyse(false);
}
function renderScript(body) {
  const p = S.project, series = isSeries(p), clip = formatOf(p) === 'clip';
  if (series && !S.ep) {
    // Niveau série : choisir l'épisode à écrire
    body.innerHTML = `<div class="prod"><div class="panel"><h2>Quel épisode ?</h2><p class="note">Le scénario s’écrit épisode par épisode.</p>
      <div class="sgrid">${p.episodes.map((e, i) => `<a class="scard" href="#/p/${p.id}/e/${e.id}/script"><b>Ép. ${i + 1} · ${esc(e.name || '')}</b><span>${S.P.scenes.filter(x => x.epId === e.id).length} scènes</span></a>`).join('')}</div></div></div>`;
    return;
  }
  const ep = series ? p.episodes.find(e => e.id === S.ep) : null;
  const text = series ? ep.script : p.script;
  body.innerHTML = `<div class="scr">
    <aside class="snav">
      <div class="panel"><div class="row between"><h2>Projet</h2>${['film', 'series'].includes(formatOf(p)) ? `<div class="seg"><button data-mode="film" class="${series ? '' : 'on'}">Film</button><button data-mode="series" class="${series ? 'on' : ''}">Série</button></div>` : `<span class="sbadge ${isAI(p) ? 'ai' : ''}">${esc(tr(fmt(formatOf(p)).short))}</span>`}</div>
      ${series ? `<div class="eplist">${p.episodes.map((e, i) => `<div class="eprow ${e.id === S.ep ? 'on' : ''}" data-ep="${e.id}"><button class="epname" data-epsel="${e.id}"><b>${i + 1}</b><span>${esc(e.name || 'Épisode ' + (i + 1))}</span><small>${S.P.scenes.filter(sc => sc.epId === e.id).length} sc.</small></button>
          <span class="epact"><button title="Monter" data-epup="${e.id}" ${i ? '' : 'disabled'}>↑</button><button title="Descendre" data-epdown="${e.id}" ${i < p.episodes.length - 1 ? '' : 'disabled'}>↓</button><button title="Renommer" data-epren="${e.id}">✎</button><button title="Supprimer" data-epdel="${e.id}">✕</button></span></div>`).join('')}</div>
        <button class="btn sm ghost block2" data-epadd>+ Ajouter un épisode</button>
        <p class="note sm">Le plan de travail, le dépouillement et les feuilles de service regroupent tous les épisodes. Scènes numérotées « épisode.scène » (ex. 2.14).</p>`
        : clip ? `<p class="note sm cliphelp"><span>Une section par partie de la chanson :</span><code>[Refrain 0:52] EXT. PLACE - NUIT</code><span>(entre parenthèses) : ce que l’on voit</span><code>Avec : Amina, Danseurs</code><span>Le reste : les paroles. Sans lieu, une section reprend le lieu précédent.</span></p>${!text.trim() ? '<button class="btn sm ghost block2" data-cliptpl>Insérer la structure d’une chanson</button>' : ''}`
        : ['film', 'series'].includes(formatOf(p)) ? `<p class="note sm">Passez en « Série » pour organiser plusieurs épisodes dans ce projet, avec un plan de travail commun.</p>` : ''}
      </div>
      <div class="panel mntp" id="smnt"></div>
      <details class="panel" ${innerWidth > 820 ? 'open' : ''}><summary><h2>${clip ? 'Sections' : 'Scènes'}${series ? ' · ' + esc(ep.name || '') : ''}</h2></summary><div id="slist"></div></details>
    </aside>
    <section class="sed">
      <div class="row between"><div class="note" id="sstat"></div>
        <div class="row"><button class="btn sm ghost hltog" id="hltog" aria-pressed="true">${tr('Surligner')}</button><label class="btn sm ghost">Importer${series ? ' dans cet épisode' : ''}…<input type="file" id="sfile" accept=".pdf,.docx,.fdx,.fountain,.txt" hidden></label></div></div>
      <div class="hlleg" id="hlleg" title="${tr('Sélectionnez un mot dans le texte, puis choisissez sa catégorie')}">${HL.map(([c, l]) => `<button type="button" class="hl-${c}" data-hlcat="${c}">${tr(l)}</button>`).join('')}</div>
      <textarea id="stxt" data-nomention spellcheck="false" placeholder="${clip ? 'Collez ou écrivez les paroles ici.&#10;&#10;[Intro 0:00] EXT. TOIT - NUIT&#10;(Ce que l’on voit)&#10;Avec : Artiste&#10;&#10;[Couplet 1 0:15] INT. STUDIO - JOUR&#10;Paroles…&#10;&#10;[Refrain 0:45]&#10;Paroles…' : 'Collez ou écrivez le scénario' + (series ? ' de cet épisode' : '') + ' ici.&#10;&#10;1. INT. CUISINE - JOUR&#10;&#10;Action…&#10;&#10;PERSONNAGE&#10;Dialogue…'}" dir="auto">${esc(text)}</textarea>
    </section></div>`;
  const tx = $('#stxt'); let t = null;
  const setText = v => { if (series) ep.script = v; else p.script = v; };
  const refreshSide = () => {
    const P = S.P, mine = series ? P.scenes.filter(sc => sc.epId === ep.id) : P.scenes;
    $('#sstat').innerHTML = `${series ? `<b>${esc(ep.name)}</b> : ${mine.length} scènes · Série : ` : ''}${P.scenes.length} ${clip ? 'sections' : 'scènes'} · ${P.roles.length} rôles · ${P.days.length} jours — <b class="ok">synchronisé</b>${P.warns.length ? ` · <span class="warn" title="${esc(P.warns.join('\n'))}">${P.warns.length} remarque${P.warns.length > 1 ? 's' : ''}</span>` : ''}`;
    const un = P.untagged || [], nt = Object.keys(p.tags || {}).length;
    const ignl = p.ignore || [];
    $('#smnt').innerHTML = `<h2>${tr('Éléments')}</h2><p class="note sm">${tr('Sélectionnez un mot ou un groupe de mots dans le texte, puis choisissez sa catégorie : il est surligné et ajouté à la Bible. Touchez un mot surligné pour changer sa catégorie ou le retirer.')}</p>`
      + (un.length ? `<p class="mnt-warn">${tr('À classer')} :</p>${un.map(n => `<label class="mnt-row"><b data-nt>@${esc(n)}</b><select data-mtag="${esc(n)}"><option value="">${tr('Catégorie…')}</option>${MENTION_CATS.map(([c, l]) => `<option value="${c}">${tr(l)}</option>`).join('')}</select></label>`).join('')}` : '')
      + (ignl.length ? `<details class="mnt-list"><summary>${ignl.length} ${tr('mot(s) retiré(s)')}</summary>${ignl.map(n => `<div class="mnt-row"><b data-nt>${esc(n)}</b><button class="link" data-unign="${esc(n)}">${tr('Rétablir')}</button></div>`).join('')}</details>` : '')
      + (nt ? `<details class="mnt-list"><summary>${nt} ${tr('élément(s) classé(s)')}</summary>${Object.entries(p.tags).map(([n, c]) => `<label class="mnt-row"><b data-nt>${esc(n)}</b><select data-mtag="${esc(n)}">${MENTION_CATS.map(([k, l]) => `<option value="${k}" ${k === c ? 'selected' : ''}>${tr(l)}</option>`).join('')}<option value="-">${tr('Retirer')}</option></select></label>`).join('')}</details>` : '');
    if (series) document.querySelectorAll('.eprow').forEach(r => { const n = P.scenes.filter(sc => sc.epId === r.dataset.ep).length; const sm = r.querySelector('small'); if (sm) sm.textContent = n + ' sc.'; });
    $('#slist').innerHTML = mine.length ? mine.map(sc => `<button class="sitem" data-line="${sc.line}" data-k="${esc(sc.k)}"><i class="sw ${cls(sc)}"></i><b>${esc(sc.sec ? sc.num : sc.num)}</b><span>${sc.sec ? `<em class="secl">${esc(sc.sec)}${sc.tc ? ' · ' + esc(sc.tc) : ''}</em> ` : ''}${esc(sc.decor)}</span><small>J${sc.day}</small></button>`).join('') : '<p class="note">Aucune scène détectée. Format attendu : « 1. INT. CUISINE - JOUR ».</p>';
  };
  refreshSide();
  // « @ » : appeler un personnage, un lieu ou un objet ; un nouveau nom reçoit la catégorie choisie
  // Surlignage des éléments (rôles, accessoires, costumes…) : réglage gardé dans le navigateur
  const hl = attachHighlight(tx, () => termsOf(S.P, p));
  const hlOn = (() => { try { return localStorage.getItem('goset.hl') !== '0'; } catch (e) { return true; } })();
  const setHl = v => { hl.toggle(v); $('#hltog').setAttribute('aria-pressed', v); $('#hlleg').classList.toggle('hidden', !v); try { localStorage.setItem('goset.hl', v ? '1' : '0'); } catch (e) { /* rien */ } };
  setHl(hlOn); $('#hltog').onclick = () => setHl(!hl.on);
  // ---------- Classer en sélectionnant : la sélection reçoit une catégorie (couleur + Bible), ou un mot surligné est retiré ----------
  let selT = null, lastSel = null;
  const CATN = Object.fromEntries(HL), cleanSel = t => { let x = t.replace(/[\s.,;:!?«»"()\[\]…]+$/g, '').replace(/^[\s.,;:!?«»"()\[\]…]+/g, '').replace(/[’]/g, "'"); const w = x.split(/\s+/); if (w.length > 1 && /^(le|la|les|l'|un|une|des|du|de|d'|the|a|an|son|sa|ses)$/i.test(w[0])) x = w.slice(1).join(' '); return x.replace(/^(l'|d')/i, '').trim(); };
  const hideSel = () => { selT?.remove(); selT = null; };
  const showSel = () => {
    hideSel(); if (!hl.on) return;
    const a = tx.selectionStart, b = tx.selectionEnd;
    let it;
    if (b > a) { const raw = tx.value.slice(a, b); if (raw.includes('\n') || raw.trim().length < 2 || raw.length > 60) return; const name = cleanSel(raw); const t = hl.termAt(a); it = { name, cur: t && t.start <= a && t.end >= b && cleanSel(t.text).toLowerCase() === name.toLowerCase() ? t.cat : null, pos: b }; }
    else { const t = hl.termAt(a); if (!t || t.cat === 'mnt') return; it = { name: cleanSel(t.text), cur: t.cat, pos: t.end }; }
    if (!it.name) return;
    lastSel = it;
    selT = document.createElement('div'); selT.className = 'seltool'; selT.setAttribute('role', 'toolbar');
    selT.innerHTML = `<span class="st-n" data-nt>${esc(it.name)}</span>${HL.map(([c, l]) => `<button type="button" class="hl-${c} ${it.cur === c ? 'on' : ''}" data-selcat="${c}">${tr(l)}</button>`).join('')}${it.cur ? `<button type="button" class="st-x" data-selx>✕ ${tr('Retirer')}</button>` : ''}`;
    document.body.appendChild(selT);
    const pt = caretXY(tx, it.pos); selT.style.left = Math.max(8, Math.min(pt.x - 40, innerWidth - selT.offsetWidth - 8)) + 'px'; selT.style.top = (pt.y + 6 + selT.offsetHeight > innerHeight ? pt.y - selT.offsetHeight - 26 : pt.y + 6) + 'px';
    selT.addEventListener('mousedown', e => e.preventDefault());
    selT.addEventListener('click', e => { const bt = e.target.closest('button'); if (!bt) return; bt.dataset.selcat ? applyCat(it.name, bt.dataset.selcat) : unTag(it.name); hideSel(); });
  };
  const applyCat = (name, cat) => {
    const k = name.toLowerCase(); p.ignore = (p.ignore || []).filter(x => x !== k);
    mentionCreate(name, cat); refreshSide(); hl.refresh();
  };
  const unTag = name => {
    const k = name.toLowerCase(); p.tags ||= {};
    delete p.tags[k];
    if (!(p.ignore ||= []).includes(k)) p.ignore.push(k);
    // fiche de Bible créée seulement pour ce mot (nom et catégorie, rien d'autre) : retirée aussi
    const b = p.bible || {}, ed = p.edits || {};
    [['chars', 'ch'], ['places', 'pl'], ['objects', 'ob']].forEach(([lk, kind]) => { b[lk] = (b[lk] || []).filter(c => { const key = kind + ':c:' + c.id, nm = (ed[bibKey(key, 'name')] || '').toLowerCase(); const own = Object.keys(ed).filter(x => x.startsWith('bib.' + key + '.')); if (nm === k && own.every(x => /\.(name|cat)$/.test(x))) { own.forEach(x => delete ed[x]); return false; } return true; }); });
    scheduleSave(); reanalyse(false); refreshSide(); hl.refresh();
    toast(`« ${esc(name)} » ${tr('n’est plus surligné')}`);
  };
  let selTimer = null;
  const later = () => { clearTimeout(selTimer); selTimer = setTimeout(showSel, 60); };
  tx.addEventListener('mouseup', later); tx.addEventListener('touchend', later);
  tx.addEventListener('keyup', e => { if (e.shiftKey || /Arrow|Home|End/.test(e.key)) later(); else hideSel(); });
  tx.addEventListener('scroll', hideSel); tx.addEventListener('input', hideSel);
  tx.addEventListener('blur', () => setTimeout(() => { if (!selT?.matches(':hover')) hideSel(); }, 150));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideSel(); });
  // Les pastilles de la légende classent aussi la dernière sélection
  $('#hlleg').addEventListener('mousedown', e => e.preventDefault());
  $('#hlleg').addEventListener('click', e => { const bt = e.target.closest('[data-hlcat]'); if (!bt) return; if (!lastSel || !lastSel.name) return toast(tr('Sélectionnez d’abord un mot dans le texte.')); applyCat(lastSel.name, bt.dataset.hlcat); hideSel(); lastSel = null; });
  tx.addEventListener('input', () => {
    setText(tx.value); scheduleSave(); $('#sstat').innerHTML = 'Analyse…';
    clearTimeout(t); t = setTimeout(() => { reanalyse(true); refreshSide(); hl.refresh(); }, 600);
  });
  $('#slist').addEventListener('click', e => { const b = e.target.closest('.sitem'); if (b) goLine(+b.dataset.line); });
  $('#smnt').addEventListener('click', e => { const u = e.target.closest('[data-unign]'); if (!u) return; p.ignore = (p.ignore || []).filter(x => x !== u.dataset.unign); scheduleSave(); reanalyse(false); refreshSide(); hl.refresh(); });
  $('#smnt').addEventListener('change', e => { const n = e.target.dataset.mtag; if (n == null) return; const v = e.target.value; p.tags ||= {}; if (v === '-' || !v) delete p.tags[n.toLowerCase()]; else p.tags[n.toLowerCase()] = v; scheduleSave(); reanalyse(false); refreshSide(); hl.refresh(); });
  body.querySelector('.snav').addEventListener('click', async e => {
    if (e.target.closest('[data-cliptpl]')) { tx.value = '[Intro 0:00] EXT. LIEU - NUIT\n(Ce que l’on voit)\nAvec : Artiste\n\n[Couplet 1 0:15] INT. LIEU - JOUR\n\n\n[Refrain 0:45]\n\n\n[Couplet 2 1:15]\n\n\n[Refrain 1:45]\n\n\n[Pont 2:15]\n\n\n[Refrain final 2:35]\n\n\n[Outro 3:00]\n'; tx.dispatchEvent(new Event('input')); e.target.closest('[data-cliptpl]').remove(); tx.focus(); return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode === 'series' && !series) { toSeries(); S.shell = null; toast('Projet transformé en série : le scénario est devenu l’épisode 1'); return nav(`#/p/${p.id}/e/${S.ep}/script`); }
    if (b.dataset.mode === 'film' && series) {
      if (p.episodes.length > 1) return toast('Pour revenir à un film, gardez un seul épisode.');
      return toast('Le projet reste organisé en série avec un épisode. Les deux fonctionnent pareil.');
    }
    if ('epadd' in b.dataset) { const id = epId(); p.episodes.push({ id, name: tr('Épisode ' + (p.episodes.length + 1)), script: '' }); scheduleSave(); reanalyse(false); S.shell = null; return nav(`#/p/${p.id}/e/${id}/script`); }
    const sel = b.dataset.epsel; if (sel) { S.shell = null; return nav(`#/p/${p.id}/e/${sel}/script`); }
    const mv = (id, d) => { const i = p.episodes.findIndex(x => x.id === id), j = i + d; if (j < 0 || j >= p.episodes.length) return; [p.episodes[i], p.episodes[j]] = [p.episodes[j], p.episodes[i]]; scheduleSave(); reanalyse(false); S.shell = null; openProject(p.id, 'script', S.ep); };
    if (b.dataset.epup) return mv(b.dataset.epup, -1);
    if (b.dataset.epdown) return mv(b.dataset.epdown, 1);
    if (b.dataset.epren) { const e2 = p.episodes.find(x => x.id === b.dataset.epren); return renameBox(e2.name || '', n => { e2.name = n; scheduleSave(); reanalyse(false); S.shell = null; openProject(p.id, 'script', S.ep); }); }
    if (b.dataset.epdel) {
      const e2 = p.episodes.find(x => x.id === b.dataset.epdel);
      if (p.episodes.length === 1) return toast('Une série garde au moins un épisode.');
      if (await confirmBox('Supprimer l’épisode ?', `« ${esc(e2.name)} » et son texte seront supprimés. Ses scènes disparaissent du plan de travail.`, 'Supprimer', true)) {
        p.episodes = p.episodes.filter(x => x !== e2); scheduleSave(); reanalyse(false); S.shell = null; return nav(`#/p/${p.id}/e/${S.ep === e2.id ? p.episodes[0].id : S.ep}/script`);
      }
    }
  });
  $('#sfile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const txt = await readFile(f);
      if (text.trim() && !(await confirmBox('Remplacer le texte ?', `Le texte actuel${series ? ' de cet épisode' : ''} sera remplacé par « ${esc(f.name)} ». Les cartes scènes, le dépouillement et le plan suivront ; vos notes et images restent sur le canvas.`, 'Remplacer'))) return;
      setText(txt); tx.value = txt; scheduleSave(); reanalyse(true); refreshSide();
    } catch (err) { toast('Lecture impossible : ' + esc(err.message) + '. Collez le texte à la place.'); }
  };
  function goLine(line) {
    const lines = tx.value.split('\n'); let pos = 0; for (let i = 0; i < line && i < lines.length; i++) pos += lines[i].length + 1;
    tx.focus(); tx.setSelectionRange(pos, pos + (lines[line] || '').length);
    const lh = parseFloat(getComputedStyle(tx).lineHeight) || 20; tx.scrollTop = Math.max(0, line * lh - 60);
  }
  if (S.gotoScene) {
    const sc = S.P.scenes.find(x => x.k === S.gotoScene); S.gotoScene = null;
    if (sc) { if (series && sc.epId !== S.ep) { S.gotoScene = sc.k; return nav(`#/p/${p.id}/e/${sc.epId}/script`); } setTimeout(() => goLine(sc.line), 30); }
  }
}

// ---------- Import de fichiers ----------
function loadScript(src) { return new Promise((ok, ko) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('bibliothèque non chargée (connexion internet ?)')); document.head.appendChild(s); }); }
export async function readFile(f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return readPdf(f);
  if (ext === 'docx') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    const r = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() }); return r.value.replace(/\n{3,}/g, '\n\n');
  }
  const txt = await f.text();
  if (ext === 'fdx') return readFdx(txt);
  return txt;
}
function readFdx(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml'); const out = [];
  doc.querySelectorAll('Content > Paragraph').forEach(p => {
    const ty = p.getAttribute('Type') || '', n = p.getAttribute('Number');
    const t = [...p.querySelectorAll('Text')].map(x => x.textContent).join('').trim(); if (!t) return;
    if (ty === 'Scene Heading') out.push('', (n ? n + '. ' : '') + t.toUpperCase(), '');
    else if (ty === 'Character') out.push(t.toUpperCase());
    else if (ty === 'Parenthetical') out.push(t);
    else out.push(t, '');
  });
  return out.join('\n');
}
async function readPdf(f) {
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  await loadScript(base + 'pdf.min.js');
  const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
  const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent(); const rows = new Map();
    tc.items.forEach(it => { if (!it.str) return; const y = Math.round(it.transform[5] / 3) * 3; if (!rows.has(y)) rows.set(y, []); rows.get(y).push(it); });
    let prev = null;
    [...rows.keys()].sort((a, b) => b - a).forEach(y => {
      const line = rows.get(y).sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (/^\d+\.?$/.test(line) && prev === null) return;
      if (prev !== null && prev - y > 18) out.push('');
      if (line) out.push(line); prev = y;
    });
    out.push('');
  }
  return out.join('\n');
}

document.addEventListener('change', e => { if (e.target.matches('.langsel')) { setLang(e.target.value); location.reload(); } });
startI18n();
route();
