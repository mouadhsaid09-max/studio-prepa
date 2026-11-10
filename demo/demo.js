// Démo en ligne : remplace le serveur par un stockage dans le navigateur.
(function () {
  window.STUDIO_DEMO = true;
  const KEY = 'studio-prepa-demo.v1';
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
  if (!db) db = { users: [], me: null, projects: {} };
  let saveT;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* quota ou stockage indisponible : on garde en mémoire */ } }, 200); };
  const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const COLORS = ['#ff9f0a', '#0a84ff', '#30d158', '#bf5af2', '#ff375f', '#64d2ff'];
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  const pub = u => ({ id: u.id, name: u.name, email: u.email });
  const HEAD = /^\s*#?(?:(?:S[ÉE]Q(?:UENCE)?|SC(?:[ÈE]NE)?)\s*\.?\s*)?(?:\d+[A-Z]?)?\s*[.\-–—:)]?\s*(?:INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\/E|INT|EXT)(?![A-Za-zÀ-ÿ])/;
  function summary(p) {
    const strips = [];
    ((p.episodes && p.episodes.length) ? p.episodes.map(e => e.script || '').join('\n') : (p.script || '')).split('\n').forEach(l => { if (p.format === 'clip' ? /^\s*\[[^\]]{1,60}\]/.test(l) : HEAD.test(l)) strips.push((/EXT/.test(l.slice(0, 30)) ? 'e' : 'i') + (/NUIT|NIGHT|SOIR/i.test(l) ? 'n' : 'j')); });
    const images = ((p.canvas && p.canvas.items) || []).filter(i => i.type === 'image' && i.src).slice(-4).map(i => i.src);
    return { id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, openedAt: p.openedAt || p.updatedAt, favorite: !!p.favorite, deletedAt: p.deletedAt || null, color: p.color, sceneCount: strips.length, episodes: (p.episodes || []).length, format: p.format || null, shotCount: Object.values(p.shots || {}).reduce((a, l) => a + (l || []).length, 0), preview: { strips: strips.slice(0, 24), images, cover: p.cover || null, lines: ((p.episodes && p.episodes.length) ? (p.episodes.find(e => (e.script || '').trim()) || {}).script || '' : (p.script || '')).split('\n').map(l => l.trim()).filter(Boolean).slice(0, 16).map(l => l.slice(0, 48)), shots: Object.values(p.shots || {}).flat().map(x => x && x.img).filter(Boolean).slice(0, 4) } };
  }
  function newProject(owner, name, script, extra = {}) {
    const now = Date.now();
    const p = { id: id(), ownerId: owner, name, color: COLORS[Math.floor(Math.random() * COLORS.length)], createdAt: now, updatedAt: now, openedAt: now, script: script || '', settings: {}, edits: {}, canvas: { items: [], links: [], view: { x: 24, y: 90, z: 0.6 } }, ...extra };
    db.projects[p.id] = p; return p;
  }

  // Image d'aperçu (pas d'accès aux services d'images depuis la démo)
  function placeholder(prompt, w, h) {
    const sc = Math.min(1, 640 / Math.max(w, h)); w = Math.round(w * sc); h = Math.round(h * sc);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    let hs = 0; for (const ch of prompt) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0;
    const night = /night|nuit|soir|noir|dark|black/i.test(prompt), rain = /rain|pluie/i.test(prompt);
    const hue = night ? 215 + (hs % 30) : 20 + (hs % 40), hue2 = (hue + 40 + (hs % 60)) % 360;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, `hsl(${hue},${night ? 45 : 70}%,${night ? 14 : 62}%)`);
    grd.addColorStop(.62, `hsl(${hue2},${night ? 40 : 75}%,${night ? 26 : 70}%)`);
    grd.addColorStop(1, `hsl(${hue},30%,${night ? 8 : 30}%)`);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = night ? 'rgba(255,214,140,.9)' : 'rgba(255,240,200,.85)';
    g.beginPath(); g.arc(w * (.2 + (hs % 60) / 100), h * .38, h * (night ? .06 : .12), 0, 7); g.fill();
    g.fillStyle = `hsla(${hue},30%,${night ? 6 : 22}%,.85)`;
    g.beginPath(); g.moveTo(0, h * .72);
    for (let x = 0; x <= w; x += w / 12) g.lineTo(x, h * (.62 + ((hs >> (x % 7)) % 10) / 100));
    g.lineTo(w, h); g.lineTo(0, h); g.fill();
    if (rain) { g.strokeStyle = 'rgba(200,220,255,.25)'; g.lineWidth = 1; for (let i = 0; i < 160; i++) { const x = (i * 97 + hs) % w, y = (i * 53) % h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 14); g.stroke(); } }
    const v = g.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, w * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, h - 30, w, 30);
    g.fillStyle = '#fff'; g.font = `600 ${Math.round(h * .045)}px -apple-system,Segoe UI,sans-serif`;
    g.fillText('APERÇU DÉMO · ' + prompt.slice(0, 70) + (prompt.length > 70 ? '…' : ''), 12, h - 10);
    return c.toDataURL('image/jpeg', .82);
  }
  const fileToData = b => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(b); });

  function seed(owner) {
    const SAMPLE = window.__SAMPLE__ || '';
    const p = newProject(owner, 'Le Dernier Train', SAMPLE, { settings: { prod: 'Production démo', real: '' } });
    const items = p.canvas.items, links = p.canvas.links;
    const t = { id: id(), type: 'title', x: 0, y: -150, w: 520, text: 'Le Dernier Train — prépa' }; items.push(t);
    const n1 = { id: id(), type: 'note', x: 340, y: 600, w: 250, text: 'Intention : une gare comme un personnage. Lumière froide le jour, chaude la nuit.', color: '#fff3b0' };
    const n2 = { id: id(), type: 'note', x: 680, y: 560, w: 220, text: 'Caméra épaule sur Yasmine', color: '#ffffff' };
    const n3 = { id: id(), type: 'note', x: 680, y: 660, w: 220, text: 'Plans fixes pour Karim', color: '#ffffff' };
    items.push(n1, n2, n3); links.push({ id: id(), from: n1.id, to: n2.id }, { id: id(), from: n1.id, to: n3.id });
    const todo = { id: id(), type: 'todo', x: 980, y: 580, w: 250, title: 'Repérages', tasks: [{ t: 'Autorisation gare de Tunis', done: false }, { t: 'Café El Ali', done: true }, { t: 'Plage de la Marsa', done: false }] };
    items.push(todo);
    [['#1b2a4a', 'Bleu nuit'], ['#e8a33d', 'Ambre des quais'], ['#c9c2b5', 'Pierre de la médina']].forEach(([c, l], i) => items.push({ id: id(), type: 'swatch', x: 1290 + i * 180, y: 580, w: 160, color: c, label: l }));
    Object.assign(p.edits, {
      'film.genres': 'Drame,Romance', 'film.logline': 'À Tunis, une femme attend un homme qui ne vient pas, et rencontre celui qui l’a fait venir.',
      'film.style': 'Réalisme poétique, lumière naturelle, nuit chaude et pluvieuse', 'film.format': 'Court métrage', 'film.duree': '15 min',
      'bib.ch:r:YASMINE.age': '28 ans', 'bib.ch:r:YASMINE.height': '1,68 m', 'bib.ch:r:YASMINE.style': 'Mélancolique', 'bib.ch:r:YASMINE.look': 'Trench beige, valise vintage',
      'bib.ch:r:YASMINE.desc': 'Architecte, revenue de Paris pour un rendez-vous dont elle doute.',
      'bib.ch:r:OMAR.age': '30 ans', 'bib.ch:r:OMAR.height': '1,80 m', 'bib.ch:r:OMAR.style': 'Mystérieux',
      'bib.ch:r:KARIM.age': '60 ans', 'bib.ch:r:KARIM.style': 'Comique, bienveillant',
      'addr.GARE DE TUNIS': 'Place Barcelone, Tunis', 'bib.pl:d:GARE DE TUNIS.type': 'Intérieur et extérieur', 'bib.pl:d:GARE DE TUNIS.permit': 'Demandée', 'bib.pl:d:GARE DE TUNIS.style': 'Années 70, carrelage, néons',
      'bib.ob:a:valise.status': 'À trouver', 'bib.ob:a:valise.style': 'Cuir marron, années 60', 'bib.ob:a:lettre.status': 'Fabriqué', 'bib.ob:a:lettre.desc': 'Papier jauni, écriture à l’encre bleue'
    });
    return p;
  }

  async function handle(path, opts) {
    const m = (opts && opts.method) || 'GET';
    const body = () => { try { return JSON.parse(opts.body || '{}'); } catch (e) { return {}; } };
    const me = db.users.find(u => u.id === db.me);
    if (path === '/api/auth/status') return json({ hasUsers: db.users.length > 0 });
    if (path === '/api/auth/register' || path === '/api/auth/login') {
      const b = body(), em = String(b.email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(em)) return json({ error: 'E-mail invalide' }, 400);
      if (String(b.password || '').length < 6) return json({ error: 'Mot de passe : 6 caractères minimum' }, 400);
      let u = db.users.find(x => x.email === em);
      if (!u) { u = { id: id(), name: (b.name || '').trim() || em.split('@')[0], email: em }; db.users.push(u); seed(u.id); }
      db.me = u.id; save(); return json({ user: pub(u) });
    }
    if (path === '/api/auth/logout') { db.me = null; save(); return json({ ok: true }); }
    if (!me) return json({ error: 'Non connecté' }, 401);
    if (path === '/api/auth/me') return json({ user: pub(me) });
    if (path === '/api/settings') return json({ imageProvider: 'pollinations', pollinationsKey: '', cfAccountId: '', cfToken: '' });
    if (path === '/api/network') return json({ lan: [], qr: null, local: false });
    if (path === '/api/projects' && m === 'GET') return json({ projects: Object.values(db.projects).filter(p => p.ownerId === me.id).map(summary) });
    if (path === '/api/projects' && m === 'POST') { const b = body(); const p = newProject(me.id, String(b.name || 'Sans titre').slice(0, 120), b.script, { settings: b.settings || {}, ...(['film', 'series', 'pub', 'clip', 'ai-pub', 'ai-series'].includes(b.format) ? { format: b.format } : {}), ...(Array.isArray(b.episodes) && b.episodes.length ? { episodes: b.episodes } : {}) }); save(); return json({ project: p }); }
    const pm = path.match(/^\/api\/projects\/([a-z0-9]+)(\/[a-z.]+)?$/);
    if (pm) {
      const p = db.projects[pm[1]]; if (!p || p.ownerId !== me.id) return json({ error: 'Projet introuvable' }, 404);
      const sub = pm[2] || '';
      if (!sub && m === 'GET') { p.openedAt = Date.now(); save(); return json({ project: JSON.parse(JSON.stringify(p)) }); }
      if (!sub && m === 'PUT') {
        const b = body();
        ['name', 'script', 'settings', 'edits', 'canvas', 'bible', 'episodes', 'shots', 'favorite', 'color', 'cover', 'budget', 'ai', 'invoice', 'tags', 'format'].forEach(k => { if (k in b) p[k] = b[k]; });
        if ('deleted' in b) p.deletedAt = b.deleted ? Date.now() : null;
        p.updatedAt = Date.now(); save(); return json({ ok: true, updatedAt: p.updatedAt });
      }
      if (!sub && m === 'DELETE') { delete db.projects[p.id]; save(); return json({ ok: true }); }
      if (sub === '/duplicate') { const c = JSON.parse(JSON.stringify(p)); c.id = id(); c.name += ' (copie)'; c.createdAt = c.updatedAt = c.openedAt = Date.now(); c.deletedAt = null; c.favorite = false; db.projects[c.id] = c; save(); return json({ project: summary(c) }); }
      if (sub === '/assets') { const b = opts.body; if (!(b instanceof Blob) || !/^image\//.test(b.type)) return json({ error: 'Image non prise en charge' }, 400); return json({ url: await fileToData(b) }); }
      if (sub === '/generate') {
        const b = body(); const prompt = String(b.prompt || '').trim(); if (!prompt) return json({ error: 'Décrivez l’image à générer' }, 400);
        await new Promise(r => setTimeout(r, 500));
        return json({ url: placeholder(prompt, +b.width || 1024, +b.height || 576), provider: 'demo' });
      }
    }
    return json({ error: 'Non disponible dans la démo' }, 404);
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const u = typeof url === 'string' ? url : url.url;
    if (u.startsWith('/api/') && !u.startsWith('/api/assist')) return handle(u.split('?')[0], opts || {});
    return realFetch(url, opts);
  };
})();
