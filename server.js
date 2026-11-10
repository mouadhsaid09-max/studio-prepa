// GOSET.ai — serveur local (Node 18+)
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import os from 'node:os';
import QRCode from 'qrcode';
import { buildPdf, SECTIONS } from './export-pdf.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// --- .env minimal (sans dépendance) ---
try {
  for (const line of fss.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* pas de .env */ }

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const P_DIR = path.join(DATA, 'projects');
const A_DIR = path.join(DATA, 'assets');
await fs.mkdir(P_DIR, { recursive: true });
await fs.mkdir(A_DIR, { recursive: true });

// --- Stockage JSON (écritures atomiques et sérialisées par fichier) ---
const queues = new Map();
async function readJSON(file, def) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return def; }
}
function writeJSON(file, data) {
  const prev = queues.get(file) || Promise.resolve();
  const next = prev.then(async () => {
    const tmp = file + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(data, null, 1));
    await fs.rename(tmp, file);
  }).catch(e => console.error('Écriture impossible', file, e.message));
  queues.set(file, next);
  return next;
}
const F_USERS = path.join(DATA, 'users.json');
const F_SESS = path.join(DATA, 'sessions.json');
const F_SET = path.join(DATA, 'settings.json');
const newId = (n = 12) => crypto.randomBytes(n).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, n) || newId(n);
const validId = id => typeof id === 'string' && /^[a-z0-9]{6,40}$/.test(id);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

// --- Mots de passe (scrypt intégré à Node) ---
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
function checkPw(pw, u) {
  const h = Buffer.from(crypto.scryptSync(pw, u.salt, 64).toString('hex'));
  const ref = Buffer.from(u.hash);
  return h.length === ref.length && crypto.timingSafeEqual(h, ref);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));

// --- Sessions ---
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
async function auth(req, res, next) {
  const tok = cookies(req).sid;
  if (!tok) return res.status(401).json({ error: 'Non connecté' });
  const sess = await readJSON(F_SESS, {});
  const s = sess[sha(tok)];
  if (!s) return res.status(401).json({ error: 'Session expirée' });
  const users = await readJSON(F_USERS, []);
  const u = users.find(x => x.id === s.userId);
  if (!u) return res.status(401).json({ error: 'Compte introuvable' });
  req.user = u;
  next();
}
async function startSession(res, user) {
  const tok = crypto.randomBytes(32).toString('hex');
  const sess = await readJSON(F_SESS, {});
  sess[sha(tok)] = { userId: user.id, createdAt: Date.now() };
  await writeJSON(F_SESS, sess);
  res.setHeader('Set-Cookie', `sid=${tok}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
}
const pubUser = u => ({ id: u.id, name: u.name, email: u.email });

app.get('/api/auth/status', async (req, res) => {
  const users = await readJSON(F_USERS, []);
  res.json({ hasUsers: users.length > 0 });
});
app.post('/api/auth/register', async (req, res) => {
  if (limited(req)) return res.status(429).json({ error: 'Trop d’essais. Réessayez dans 10 minutes.' });
  failed(req);
  const { name = '', email = '', password = '' } = req.body || {};
  const em = String(email).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(em)) return res.status(400).json({ error: 'E-mail invalide' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
  const users = await readJSON(F_USERS, []);
  if (users.some(u => u.email === em)) return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail' });
  const u = { id: newId(), name: String(name).trim() || em.split('@')[0], email: em, ...hashPw(String(password)), createdAt: Date.now() };
  users.push(u);
  await writeJSON(F_USERS, users);
  await startSession(res, u);
  res.json({ user: pubUser(u) });
});
// Limite les essais de mot de passe (l'application est joignable sur le Wi-Fi)
const fails = new Map();
const ipOf = req => req.socket.remoteAddress || '?';
function limited(req) { const f = fails.get(ipOf(req)); return f && f.n >= 8 && Date.now() < f.until; }
function failed(req) { const ip = ipOf(req), f = fails.get(ip) || { n: 0 }; f.n++; f.until = Date.now() + 10 * 60 * 1000; fails.set(ip, f); }
app.post('/api/auth/login', async (req, res) => {
  if (limited(req)) return res.status(429).json({ error: 'Trop d’essais. Réessayez dans 10 minutes.' });
  const { email = '', password = '' } = req.body || {};
  const users = await readJSON(F_USERS, []);
  const u = users.find(x => x.email === String(email).trim().toLowerCase());
  if (!u || !checkPw(String(password), u)) { failed(req); return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' }); }
  fails.delete(ipOf(req));
  await startSession(res, u);
  res.json({ user: pubUser(u) });
});
app.post('/api/auth/logout', async (req, res) => {
  const tok = cookies(req).sid;
  if (tok) { const sess = await readJSON(F_SESS, {}); delete sess[sha(tok)]; await writeJSON(F_SESS, sess); }
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: pubUser(req.user) }));

// --- Projets ---
const pFile = id => path.join(P_DIR, id + '.json');
async function loadOwn(req, res) {
  const id = req.params.id;
  if (!validId(id)) { res.status(400).json({ error: 'Identifiant invalide' }); return null; }
  const p = await readJSON(pFile(id), null);
  if (!p || p.ownerId !== req.user.id) { res.status(404).json({ error: 'Projet introuvable' }); return null; }
  return p;
}
const HEAD_RE = /^\s*#?(?:(?:S[ÉE]Q(?:UENCE)?|SC(?:[ÈE]NE)?)\s*\.?\s*)?(?:\d+[A-Z]?)?\s*[.\-–—:)]?\s*(?:INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\/E|INT|EXT)(?![A-Za-zÀ-ÿ])/;
function summary(p) {
  const lines = ((p.episodes && p.episodes.length) ? p.episodes.map(e => e.script || '').join('\n') : (p.script || '')).split('\n');
  const strips = [];
  for (const l of lines) if (p.format === 'clip' ? /^\s*\[[^\]]{1,60}\]/.test(l) : HEAD_RE.test(l)) {
    const ext = /EXT/.test(l.slice(0, 30)), night = /NUIT|NIGHT|SOIR/i.test(l);
    strips.push((ext ? 'e' : 'i') + (night ? 'n' : 'j'));
  }
  const images = ((p.canvas && p.canvas.items) || []).filter(i => i.type === 'image' && i.src).slice(-4).map(i => i.src);
  return { id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, openedAt: p.openedAt || p.updatedAt,
    favorite: !!p.favorite, deletedAt: p.deletedAt || null, color: p.color, sceneCount: strips.length, episodes: (p.episodes || []).length, format: p.format || null,
    shotCount: Object.values(p.shots || {}).reduce((a, l) => a + (l || []).length, 0), preview: { strips: strips.slice(0, 24), images, cover: p.cover || null, lines: ((p.episodes && p.episodes.length) ? (p.episodes.find(e => (e.script || '').trim()) || {}).script || '' : (p.script || '')).split('\n').map(l => l.trim()).filter(Boolean).slice(0, 16).map(l => l.slice(0, 48)), shots: Object.values(p.shots || {}).flat().map(x => x && x.img).filter(Boolean).slice(0, 4) } };
}
app.get('/api/projects', auth, async (req, res) => {
  const out = [];
  for (const f of await fs.readdir(P_DIR)) {
    if (!f.endsWith('.json')) continue;
    const p = await readJSON(path.join(P_DIR, f), null);
    if (p && p.ownerId === req.user.id) out.push(summary(p));
  }
  res.json({ projects: out });
});
const COLORS = ['#ff9f0a', '#0a84ff', '#30d158', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a'];
app.post('/api/projects', auth, async (req, res) => {
  const b = req.body || {};
  const now = Date.now();
  const p = {
    id: newId(), ownerId: req.user.id, name: String(b.name || 'Sans titre').slice(0, 120),
    color: COLORS[Math.floor(Math.random() * COLORS.length)], createdAt: now, updatedAt: now, openedAt: now,
    script: typeof b.script === 'string' ? b.script : '',
    settings: b.settings || {}, edits: {}, canvas: { items: [], links: [], view: { x: 130, y: 90, z: 1 } }
  };
  if (['film', 'series', 'pub', 'clip', 'ai-pub', 'ai-series'].includes(b.format)) p.format = b.format;
  if (Array.isArray(b.episodes) && b.episodes.length) p.episodes = b.episodes.slice(0, 60).map((e, i) => ({ id: /^[a-z0-9]{4,16}$/.test(e.id) ? e.id : newId(6), name: String(e.name || 'Épisode ' + (i + 1)).slice(0, 120), script: typeof e.script === 'string' ? e.script : '' }));
  await writeJSON(pFile(p.id), p);
  res.json({ project: p });
});
app.get('/api/projects/:id', auth, async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  p.openedAt = Date.now(); await writeJSON(pFile(p.id), p);
  res.json({ project: p });
});
app.put('/api/projects/:id', auth, async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  const b = req.body || {};
  for (const k of ['name', 'script', 'settings', 'edits', 'canvas', 'bible', 'episodes', 'shots', 'favorite', 'color', 'cover', 'budget', 'ai', 'invoice', 'tags', 'found', 'brief', 'ignore', 'credits']) if (k in b) p[k] = b[k];
  if (['film', 'series', 'pub', 'clip', 'ai-pub', 'ai-series'].includes(b.format)) p.format = b.format;
  if ('deleted' in b) p.deletedAt = b.deleted ? Date.now() : null;
  p.name = String(p.name || 'Sans titre').slice(0, 120);
  p.updatedAt = Date.now();
  await writeJSON(pFile(p.id), p);
  res.json({ ok: true, updatedAt: p.updatedAt });
});
app.post('/api/projects/:id/duplicate', auth, async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  const now = Date.now();
  const c = { ...structuredClone(p), id: newId(), name: p.name + ' (copie)', createdAt: now, updatedAt: now, openedAt: now, deletedAt: null, favorite: false };
  // copie des images
  const src = path.join(A_DIR, p.id), dst = path.join(A_DIR, c.id);
  if (fss.existsSync(src)) {
    await fs.cp(src, dst, { recursive: true });
    const s = JSON.stringify(c.canvas).split(`/api/assets/${p.id}/`).join(`/api/assets/${c.id}/`);
    c.canvas = JSON.parse(s);
    if (c.cover) c.cover = c.cover.split(`/api/assets/${p.id}/`).join(`/api/assets/${c.id}/`);
    if (c.shots) c.shots = JSON.parse(JSON.stringify(c.shots).split(`/api/assets/${p.id}/`).join(`/api/assets/${c.id}/`));
  }
  await writeJSON(pFile(c.id), c);
  res.json({ project: summary(c) });
});
app.delete('/api/projects/:id', auth, async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  await fs.rm(pFile(p.id), { force: true });
  await fs.rm(path.join(A_DIR, p.id), { recursive: true, force: true });
  res.json({ ok: true });
});

// --- Images du projet ---
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
async function saveAsset(pid, buf, type) {
  const ext = EXT[type] || 'jpg';
  const dir = path.join(A_DIR, pid);
  await fs.mkdir(dir, { recursive: true });
  const name = newId(16) + '.' + ext;
  await fs.writeFile(path.join(dir, name), buf);
  return `/api/assets/${pid}/${name}`;
}
app.post('/api/projects/:id/assets', auth, express.raw({ type: 'image/*', limit: '25mb' }), async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  const type = (req.headers['content-type'] || '').split(';')[0];
  if (!EXT[type] || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Image non prise en charge (jpg, png, webp, gif)' });
  res.json({ url: await saveAsset(p.id, req.body, type) });
});
app.get('/api/assets/:pid/:file', auth, async (req, res) => {
  const { pid, file } = req.params;
  if (!validId(pid) || !/^[a-z0-9]+\.(jpg|png|webp|gif)$/.test(file)) return res.status(400).end();
  const p = await readJSON(pFile(pid), null);
  if (!p || p.ownerId !== req.user.id) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.sendFile(path.join(A_DIR, pid, file), err => { if (err && !res.headersSent) res.status(404).end(); });
});

// --- Réglages de génération d'images ---
async function getSettings() {
  const s = await readJSON(F_SET, {});
  return {
    imageProvider: s.imageProvider || process.env.IMAGE_PROVIDER || 'pollinations',
    pollinationsKey: s.pollinationsKey ?? process.env.POLLINATIONS_KEY ?? '',
    cfAccountId: s.cfAccountId ?? process.env.CF_ACCOUNT_ID ?? '',
    cfToken: s.cfToken ?? process.env.CF_API_TOKEN ?? ''
  };
}
const mask = v => v ? '••••' + String(v).slice(-4) : '';
app.get('/api/settings', auth, async (req, res) => {
  const s = await getSettings();
  res.json({ imageProvider: s.imageProvider, pollinationsKey: mask(s.pollinationsKey), cfAccountId: s.cfAccountId, cfToken: mask(s.cfToken) });
});
app.put('/api/settings', auth, async (req, res) => {
  const cur = await readJSON(F_SET, {});
  const b = req.body || {};
  if (['pollinations', 'cloudflare'].includes(b.imageProvider)) cur.imageProvider = b.imageProvider;
  for (const k of ['pollinationsKey', 'cfAccountId', 'cfToken']) {
    if (typeof b[k] === 'string' && !b[k].startsWith('••••')) cur[k] = b[k].trim();
  }
  await writeJSON(F_SET, cur);
  res.json({ ok: true });
});

async function fetchT(url, opts = {}, ms = 120000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}
app.post('/api/projects/:id/generate', auth, async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  const b = req.body || {};
  const prompt = String(b.prompt || '').trim().slice(0, 1500);
  if (!prompt) return res.status(400).json({ error: 'Décrivez l’image à générer' });
  const width = Math.min(1536, Math.max(256, +b.width || 1024));
  const height = Math.min(1536, Math.max(256, +b.height || 576));
  const seed = Number.isInteger(b.seed) ? b.seed : Math.floor(Math.random() * 2 ** 31);
  const s = await getSettings();
  try {
    let buf, type;
    if (s.imageProvider === 'cloudflare') {
      if (!s.cfAccountId || !s.cfToken) return res.status(400).json({ error: 'Cloudflare : ajoutez l’Account ID et le jeton API dans Réglages' });
      const r = await fetchT(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(s.cfAccountId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
        method: 'POST', headers: { Authorization: `Bearer ${s.cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, steps: 4, seed })
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.result?.image) return res.status(502).json({ error: 'Cloudflare : ' + (j?.errors?.[0]?.message || `erreur ${r.status}`) });
      buf = Buffer.from(j.result.image, 'base64'); type = 'image/jpeg';
    } else {
      const q = new URLSearchParams({ width, height, seed, model: 'flux', nologo: 'true' });
      const base = s.pollinationsKey ? 'https://gen.pollinations.ai/image/' : 'https://image.pollinations.ai/prompt/';
      const headers = s.pollinationsKey ? { Authorization: `Bearer ${s.pollinationsKey}` } : {};
      const r = await fetchT(base + encodeURIComponent(prompt) + '?' + q, { headers });
      type = (r.headers.get('content-type') || '').split(';')[0];
      if (!r.ok || !type.startsWith('image/')) {
        const txt = (await r.text().catch(() => '')).slice(0, 200);
        if (r.status === 429) return res.status(429).json({ error: 'Pollinations : trop de demandes, attendez 15 s (ou ajoutez une clé Pollinations)' });
        return res.status(502).json({ error: `Pollinations : erreur ${r.status} ${txt}` });
      }
      buf = Buffer.from(await r.arrayBuffer());
    }
    const url = await saveAsset(p.id, buf, type);
    res.json({ url, seed, provider: s.imageProvider });
  } catch (e) {
    res.status(502).json({ error: e.name === 'AbortError' ? 'Délai dépassé : le service d’images ne répond pas' : 'Service d’images injoignable (' + e.message + ')' });
  }
});

// --- Export PDF ---
app.get('/api/export/sections', auth, (req, res) => res.json({ sections: SECTIONS }));
app.get('/api/projects/:id/export.pdf', auth, async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  const sections = String(req.query.s || '').split(',').filter(Boolean);
  const fileOf = src => { const m = String(src).match(/^\/api\/assets\/([a-z0-9]+)\/([a-z0-9]+\.(?:jpg|png|webp|gif))$/); return m && m[1] === p.id ? path.join(A_DIR, m[1], m[2]) : null; };
  try {
    const doc = buildPdf(p, sections, fileOf, ['fr', 'en', 'ar'].includes(req.query.lang) ? req.query.lang : 'fr');
    const name = (p.name || 'projet').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.view ? 'inline' : 'attachment'}; filename="presentation.pdf"; filename*=UTF-8''${encodeURIComponent(name + ' - présentation.pdf')}`);
    doc.pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: 'Export impossible : ' + e.message }); }
});

// --- Accès depuis le téléphone ---
function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) {
    if (n.family === 'IPv4' && !n.internal && !/^169\.254\./.test(n.address)) out.push(`http://${n.address}:${PORT}`);
  }
  return out;
}
app.get('/api/network', auth, async (req, res) => {
  const lan = HOST === '0.0.0.0' || HOST === '::' ? lanUrls() : [];
  const qr = lan[0] ? await QRCode.toDataURL(lan[0], { margin: 1, width: 360 }) : null;
  res.json({ lan, qr, local: HOST === '127.0.0.1' || HOST === 'localhost' });
});

// --- IA texte (Prep AI) ---
app.post('/api/projects/:id/ai/text', auth, async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  const prompt = String((req.body || {}).prompt || '').slice(0, 200000);
  if (!prompt.trim()) return res.status(400).json({ error: 'Demande vide' });
  const s = await getSettings();
  try {
    let text = '';
    if (s.imageProvider === 'cloudflare' && s.cfAccountId && s.cfToken) {
      const r = await fetchT(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(s.cfAccountId)}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`, {
        method: 'POST', headers: { Authorization: `Bearer ${s.cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 8000 })
      }, 240000);
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.result) return res.status(502).json({ error: 'Cloudflare : ' + (j?.errors?.[0]?.message || `erreur ${r.status}`) });
      text = j.result.response || '';
    } else {
      const keyed = !!s.pollinationsKey;
      const url = keyed ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai';
      const r = await fetchT(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(keyed ? { Authorization: `Bearer ${s.pollinationsKey}` } : {}) },
        body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: prompt }], seed: Math.floor(Math.random() * 1e6) })
      }, 240000);
      if (r.status === 429) return res.status(429).json({ error: 'Pollinations : trop de demandes, réessayez dans une minute (ou ajoutez une clé gratuite dans Réglages)' });
      const j = await r.json().catch(() => null);
      text = j?.choices?.[0]?.message?.content || '';
      if (!r.ok || !text) return res.status(502).json({ error: `Pollinations : ${j?.error?.message || j?.error || 'erreur ' + r.status}${keyed ? '' : ' (une clé gratuite sur enter.pollinations.ai peut être nécessaire)'}` });
    }
    res.json({ text });
  } catch (e) {
    res.status(502).json({ error: e.name === 'AbortError' ? 'Délai dépassé : le service IA ne répond pas' : 'Service IA injoignable (' + e.message + ')' });
  }
});

// --- IA de vision : lecture d'une note manuscrite ---
app.post('/api/projects/:id/ai/vision', auth, async (req, res) => {
  const p = await loadOwn(req, res); if (!p) return;
  const b = req.body || {}, prompt = String(b.prompt || '').slice(0, 8000), image = String(b.image || '');
  const m = image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || image.length > 12e6) return res.status(400).json({ error: 'Image manquante ou trop lourde' });
  const s = await getSettings();
  try {
    let text = '';
    if (s.imageProvider === 'cloudflare' && s.cfAccountId && s.cfToken) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(s.cfAccountId)}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`;
      const call = body => fetchT(url, { method: 'POST', headers: { Authorization: `Bearer ${s.cfToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 180000).then(async r => ({ r, j: await r.json().catch(() => null) }));
      const body = { messages: [{ role: 'user', content: prompt }], image: [...Buffer.from(m[2], 'base64')], max_tokens: 2000 };
      let { r, j } = await call(body);
      if (!r.ok && /agree/i.test(JSON.stringify(j || ''))) { await call({ prompt: 'agree' }); ({ r, j } = await call(body)); } // licence Llama 3.2 à accepter une fois
      if (!r.ok || !j?.result) return res.status(502).json({ error: 'Cloudflare : ' + (j?.errors?.[0]?.message || `erreur ${r.status}`) });
      text = j.result.response || '';
    } else {
      const keyed = !!s.pollinationsKey;
      const url = keyed ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai';
      const r = await fetchT(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(keyed ? { Authorization: `Bearer ${s.pollinationsKey}` } : {}) },
        body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }], seed: Math.floor(Math.random() * 1e6) })
      }, 180000);
      if (r.status === 429) return res.status(429).json({ error: 'Pollinations : trop de demandes, réessayez dans une minute (ou ajoutez une clé gratuite dans Réglages)' });
      const j = await r.json().catch(() => null);
      text = j?.choices?.[0]?.message?.content || '';
      if (!r.ok || !text) return res.status(502).json({ error: `Pollinations : ${j?.error?.message || j?.error || 'erreur ' + r.status}${keyed ? '' : ' (une clé gratuite sur enter.pollinations.ai peut être nécessaire)'}` });
    }
    res.json({ text });
  } catch (e) {
    res.status(502).json({ error: e.name === 'AbortError' ? 'Délai dépassé : le service IA ne répond pas' : 'Service IA injoignable (' + e.message + ')' });
  }
});

// --- Front-end ---
// Bibliothèque PDF et polices pour les documents fabriqués dans le navigateur (factures, devis)
app.get('/vendor/pdfkit.standalone.js', (req, res) => res.sendFile(path.join(ROOT, 'node_modules', 'pdfkit', 'js', 'pdfkit.standalone.js')));
app.get(/^\/fonts\/(DejaVuSansCondensed(?:-Bold)?|DejaVuSans-Bold)\.ttf$/, (req, res) => res.sendFile(path.join(ROOT, 'node_modules', 'dejavu-fonts-ttf', 'ttf', req.params[0] + '.ttf')));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

app.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  const lan = HOST === '0.0.0.0' ? lanUrls() : [];
  console.log(`\n  🎬  GOSET.ai est lancé : ${url}`);
  if (lan.length) console.log(`  📱  Sur le téléphone (même Wi-Fi) : ${lan.join('  ou  ')}`);
  console.log('  (Ctrl+C pour arrêter)\n');
  if (process.env.OPEN_BROWSER !== '0') {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
});
