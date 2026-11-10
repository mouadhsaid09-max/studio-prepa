// Moodboard AI : un seul bouton pour l'analyse du scénario, les croquis de moodboard et le découpage technique
import { esc, bible, bibKey, GENRES, isSeries, SHOT, shotLabel } from './parser.js';
import { LANG, tr } from './i18n.js';
import { sketchSVG, HATCH_DEFS, seedOf } from './sketch.js';
const LNAME = { fr: 'français', en: 'anglais (English)', ar: 'arabe (العربية)' }[LANG] || 'français';

let X; // { modal, toast, project, P, save, refresh, demo, ep(), goto }
export function initPrepAI(ctx) { X = ctx; }
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* rien */ } } };

// ---------- Styles de croquis ----------
export const SK_STYLES = {
  board: { label: 'Storyboard', en: 'black and white storyboard panel, hand-drawn ink line art with flat grey marker shading, bold solid black shadows, loose energetic strokes, motion arrows, white paper, professional film storyboard', paper: '#ffffff', disp: 1.8, blur: 0, svg: 'contours à l’encre noire nerveux, aplats de marqueur gris (#d4d4d4, #a9a9a9, #707070) pour les volumes et le sol, grands noirs pleins (#151515) pour les ombres et les silhouettes à contre-jour, lignes de vitesse et une flèche épaisse pour le mouvement de caméra ou du personnage quand le plan bouge' },
  crayon: { label: 'Crayon', en: 'storyboard sketch, rough graphite pencil on paper, loose expressive lines, cross-hatching shadows, black and white', paper: '#f6f1e6', disp: 3.2, blur: 0, svg: 'traits de crayon gris foncé, hachures pour les ombres' },
  encre: { label: 'Encre', en: 'ink storyboard drawing, bold black brush-pen lines, high contrast, solid black shadows, white paper', paper: '#fbfaf7', disp: 1.4, blur: 0, svg: 'traits noirs épais et nets, aplats noirs pour les ombres' },
  fusain: { label: 'Fusain', en: 'charcoal sketch, smudged soft shading, rough strokes, grey toned paper, dramatic chiaroscuro', paper: '#e9e5dc', disp: 4.2, blur: 0.7, svg: 'traits larges et irréguliers, grandes masses de gris (#9a9a9a, #6d6d6d) pour les ombres' },
  aqua: { label: 'Aquarelle', en: 'watercolor storyboard sketch, light pencil underdrawing, loose transparent color washes', paper: '#fbf8f1', disp: 2.2, blur: 0.5, svg: 'contours au crayon fin, lavis de couleurs douces et transparentes (opacité 0.35 à 0.6) pour la lumière et l’ambiance' },
  real: { label: 'Réaliste', en: 'cinematic film still, photorealistic, 35mm lens, natural light, color graded', localOnly: true }
};
const RATIOS = { '16:9': [640, 360, 1024, 576], '2.39:1': [640, 268, 1216, 512], '4:3': [640, 480, 1024, 768], '1:1': [480, 480, 1024, 1024], '9:16': [360, 640, 576, 1024] };
const styleKey = () => { const k = LS.get('sp.skstyle'); return SK_STYLES[k] && !(SK_STYLES[k].localOnly && X.demo) ? k : 'board'; };

// ---------- IA texte ----------
let sampleFn;
async function claudeSample() {
  if (sampleFn !== undefined) return sampleFn;
  sampleFn = window.claude && window.claude.use ? await window.claude.use('sample').catch(() => null) : null;
  return sampleFn;
}
const MSG = {
  not_granted: 'Vous n’avez pas autorisé la démo à utiliser Claude.', rate_limited: 'Trop de demandes pour le moment : réessayez dans quelques minutes.',
  sampling_disabled: 'Claude n’est pas disponible pour ce compte.', session_expired: 'Reconnectez-vous à Claude.', cancelled: 'Arrêté.',
  refused: 'Claude a refusé cette demande.', prompt_too_large: 'Texte trop long pour une seule demande.', upstream_error: 'Service momentanément indisponible.'
};
export function parseJSON(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) { /* suite */ }
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch (e) { /* suite */ } }
  const a = Math.min(...['{', '['].map(c => { const i = t.indexOf(c); return i < 0 ? Infinity : i; })), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a < Infinity && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('réponse illisible');
}
async function askText(prompt, signal) {
  if (X.demo) {
    const s = await claudeSample();
    if (!s) throw Object.assign(new Error('Moodboard AI fonctionne dans l’app Claude : ouvrez la démo depuis Claude.'), { code: 'unavailable' });
    try { return (await s(prompt, { signal, modelTier: 'default', cache: false })).text; }
    catch (e) { throw Object.assign(new Error(MSG[e.code] || e.message || 'erreur'), { code: e.code }); }
  }
  const r = await fetch(`/api/projects/${X.project.id}/ai/text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || 'Erreur ' + r.status), { code: r.status === 429 ? 'rate_limited' : 'error' });
  return j.text;
}

// IA de vision : lit une image (note manuscrite) et renvoie du texte
export async function askVision(prompt, dataUrl, signal) {
  if (X.demo) {
    const s = await claudeSample();
    if (!s) throw Object.assign(new Error('La lecture de l’écriture fonctionne dans l’app Claude : ouvrez la démo depuis Claude.'), { code: 'unavailable' });
    const lim = await s.limits?.().catch(() => null);
    if (lim && !lim.images) throw new Error('Lecture d’image indisponible pour ce compte.');
    const blob = await (await fetch(dataUrl)).blob();
    try { return (await s(prompt, { signal, images: [blob], modelTier: 'default', cache: false })).text; }
    catch (e) { throw Object.assign(new Error(MSG[e.code] || e.message || 'erreur'), { code: e.code }); }
  }
  const r = await fetch(`/api/projects/${X.project.id}/ai/vision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, image: dataUrl }), signal });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || 'Erreur ' + r.status), { code: r.status === 429 ? 'rate_limited' : 'error' });
  return j.text;
}

// ---------- Contexte : portée, personnages ----------
function scope() { const P = X.P(), ep = X.ep(); return ep ? P.scenes.filter(s => s.epId === ep) : P.scenes; }
function scriptText(max = 110000) {
  const p = X.project, ep = X.ep();
  let t;
  if (!isSeries(p)) t = p.script || '';
  else t = p.episodes.filter(e => !ep || e.id === ep).map(e => `=== ÉPISODE ${p.episodes.indexOf(e) + 1} : ${e.name || ''} ===\n${e.script || ''}`).join('\n\n');
  return t.length > max ? t.slice(0, max) + '\n[…texte coupé…]' : t;
}
// Description des personnages présents (pour que chaque croquis les dessine pareil)
function castOf(s) {
  const B = bible(X.project, X.P());
  return (s ? s.roles : []).map(r => {
    const v = f => B.val('ch:r:' + r.name, f);
    const bits = [v('age'), v('height'), v('look'), (v('desc') || '').split(/[.!?]/)[0]].filter(Boolean).join(', ');
    return bits ? `${r.name} (${bits})` : r.name;
  }).join('; ');
}
const sceneText = s => (s.actText + ' ' + s.dialog.join(' ')).slice(0, 1400);
export const scenePrompt = s => `${s.ie === 'INT' ? 'Interior' : 'Exterior'}, ${s.night ? 'night' : 'day'}. ${s.decor.toLowerCase()}. ${s.summary || ''}${castOf(s) ? ' Characters: ' + castOf(s) + '.' : ''}`.trim();

// ---------- Fabrication des images ----------
function rasterize(inner, seed, style, ratio) {
  const [w, h] = RATIOS[ratio] || RATIOS['16:9'], st = SK_STYLES[style] || SK_STYLES.board;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>${HATCH_DEFS}<filter id="p" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${st.disp}" xChannelSelector="R" yChannelSelector="G" result="d"/>${st.blur ? `<feGaussianBlur in="d" stdDeviation="${st.blur}"/>` : ''}</filter>
<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${seed + 7}"/><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.32  0 0 0 0 0.28  0 0 0 ${style === 'fusain' ? 0.18 : 0.10} 0"/></filter></defs>
<rect width="${w}" height="${h}" fill="${st.paper}"/><rect width="${w}" height="${h}" filter="url(#g)"/>
<clipPath id="cl"><rect x="${w * .03}" y="${h * .045}" width="${w * .94}" height="${h * .91}"/></clipPath><g clip-path="url(#cl)"><g filter="url(#p)" opacity="0.95" transform="translate(${w * .03} ${h * .045}) scale(.94 .91)">${inner}</g></g>
<rect x="${w * .03}" y="${h * .045}" width="${w * .94}" height="${h * .91}" fill="none" stroke="#2b2b2b" stroke-width="2"/></svg>`;
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = w * 1.5; c.height = h * 1.5; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82)); };
    im.onerror = () => { URL.revokeObjectURL(url); ko(new Error('dessin illisible')); };
    im.src = url;
  });
}
// frames : [{prompt (anglais), shot, ...}] → onImage(frame, src)
async function makeImages(frames, { style, ratio = '16:9', signal, onImage, onStatus }) {
  if (X.demo) {
    // Démo : croquis dessinés dans le navigateur, gratuits et hors ligne (aucune IA d'image)
    const [w, h] = RATIOS[ratio] || RATIOS['16:9'], P = X.P();
    for (let i = 0; i < frames.length; i++) {
      if (signal.aborted) return;
      const f = frames[i], s = P.scenes.find(x => x.k === f.k) || P.scenes.find(x => String(x.num) === String(f.num)) || {};
      onStatus(`Croquis ${i + 1} sur ${frames.length}…`);
      const pick = list => list.filter(Boolean).find(o => (f.shot || '').toLowerCase().includes(o.toLowerCase())) || '';
      const size = pick(SHOT.size) || (i % 3 === 0 ? 'Plan large' : i % 3 === 1 ? 'Plan moyen' : 'Gros plan');
      const inner = sketchSVG({ w, h, style: style === 'real' ? 'board' : style, size, angle: pick(SHOT.angle), move: pick(SHOT.move), ie: s.ie === 'EXT' ? 'EXT' : 'INT', night: !!s.night, people: (s.roles || []).length, text: [s.decor, s.summary, s.actText, f.prompt].join(' '), seed: seedOf((f.prompt || '') + i + (f.id || '')) });
      try { onImage(f, await rasterize(inner, i * 13 + 3, style, ratio)); } catch (e) { onStatus('Croquis ' + (i + 1) + ' : ' + e.message); }
      await new Promise(r => setTimeout(r, 60));
    }
    return;
  }
  const [, , W, H] = RATIOS[ratio] || RATIOS['16:9'], st = SK_STYLES[style] || SK_STYLES.board;
  for (let i = 0; i < frames.length && !signal.aborted; i++) {
    onStatus(`Image ${i + 1} sur ${frames.length}…`);
    for (let tries = 0; tries < 4 && !signal.aborted; tries++) {
      const r = await fetch(`/api/projects/${X.project.id}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: JSON.stringify({ prompt: `${frames[i].shot ? frames[i].shot + '. ' : ''}${frames[i].prompt}. ${st.en}`, width: W, height: H }) }).catch(e => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }));
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) { for (let s = 16; s > 0 && !signal.aborted; s--) { onStatus(`Limite gratuite : image ${i + 1} dans ${s} s…`); await new Promise(z => setTimeout(z, 1000)); } continue; }
      if (!r.ok) { onStatus('Image ' + (i + 1) + ' : ' + (j.error || 'échec')); break; }
      onImage(frames[i], j.url); break;
    }
  }
}

// ---------- Canvas : placement ----------
const hOf = it => it.h || ({ scene: 160, note: 80, title: 60, todo: 120, swatch: 160 }[it.type] || Math.round((it.w || 300) * 0.62));
function freeSpot(items, x, y, w, h) {
  const hit = (px, py) => items.some(it => it.x < px + w && it.x + (it.w || 240) > px && it.y < py + h && it.y + hOf(it) > py);
  for (let i = 0; i < 200; i++) { const px = x + (i % 2) * (w + 24), py = y + Math.floor(i / 2) * (h + 24); if (!hit(px, py)) return { x: px, y: py }; }
  return { x, y };
}
function placeNear(anchor, list) {
  const c = X.project.canvas ||= {}; c.items ||= []; c.links ||= [];
  list.forEach(m => {
    const w = 300, h = 210, a = anchor || c.items.find(x => x.type === 'scene' && x.sceneKey === m.k);
    const base = a ? { x: a.x + (a.w || 260) + 60, y: a.y } : { x: 0, y: Math.max(0, ...c.items.map(x => x.y + hOf(x))) + 80 };
    const p = freeSpot(c.items, base.x, base.y, w, h);
    const it = { id: uid(), type: 'image', x: p.x, y: p.y, w, src: m.src, caption: m.caption || '', prompt: m.f.prompt, style: m.style };
    c.items.push(it); if (a) c.links.push({ id: uid(), from: a.id, to: it.id });
  });
  X.save();
}
function placeBoard(list, title) {
  const c = X.project.canvas ||= {}; c.items ||= []; c.links ||= [];
  const items = c.items, minX = items.length ? Math.min(...items.map(i => i.x)) : 0, maxY = items.length ? Math.max(...items.map(i => i.y + hOf(i))) : 0;
  const y0 = maxY + 120, cols = innerWidth < 600 ? 2 : 4;
  items.push({ id: uid(), type: 'title', x: minX, y: y0, w: 560, text: title });
  list.forEach((m, i) => {
    const it = { id: uid(), type: 'image', x: minX + (i % cols) * 330, y: y0 + 80 + Math.floor(i / cols) * 240, w: 300, src: m.src, caption: m.caption || '', prompt: m.f.prompt, style: m.style };
    items.push(it);
    const card = items.find(x => x.type === 'scene' && x.sceneKey === m.k); if (card) c.links.push({ id: uid(), from: card.id, to: it.id });
  });
  X.save();
}

// ---------- Mode 1 : tout préparer ----------
function analysisPrompt(scenes, nFrames) {
  const P = X.P(), B = bible(X.project, P);
  const roles = P.roles.filter(r => scenes.some(s => s.roles.includes(r)));
  const places = [...new Set(scenes.map(s => s.dk))];
  return `Tu es premier assistant réalisateur et directeur artistique. Analyse ce scénario pour préparer le tournage. Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour. Écris les textes en ${LNAME} (sauf "prompt" en anglais, et garde les noms exacts des listes).

Format exact :
{"film":{"logline":"1-2 phrases","synopsis":"5-8 phrases","genres":["parmi : ${GENRES.join(', ')}"],"style":"style visuel / ton, lumière, caméra, 1-2 phrases"},
"characters":[{"name":"NOM EXACT de la liste","age":"ex. 28 ans","height":"ex. 1,70 m (estimation)","style":"registre en 1-3 mots, ex. comique, inquiétant","look":"costume, coiffure, accessoires","desc":"physique, personnalité, arc, 2-3 phrases"}],
"places":[{"name":"NOM EXACT de la liste","type":"Intérieur | Extérieur | Intérieur et extérieur","style":"ambiance / époque","desc":"ce qu'on y voit, ce qu'il faut préparer, 1-2 phrases"}],
"objects":[{"name":"nom court","style":"style / époque","desc":"description utile à l'accessoiriste","scenes":"numéros, ex. 2, 5"}],
"scenes":[{"num":"numéro exact","summary":"résumé en 1 phrase","notes":"intention de mise en scène et cadrage, 1 phrase","cos":"costumes notables ou vide","hmc":"maquillage/coiffure notables ou vide"}],
"moodboard":[{"num":"numéro de scène","shot":"type de plan, ex. Plan large","prompt":"English visual description of the frame: setting, characters with their look, action, light, composition (30-50 words)"}]}

Règles : "characters" = exactement les rôles de la liste ; "places" = exactement les décors de la liste ; "objects" = 4 à 10 objets importants pour l'histoire ; "scenes" = toutes les scènes listées ; "moodboard" = exactement ${nFrames} images, choisies parmi les scènes les plus fortes visuellement, dans l'ordre du récit ; dans chaque "prompt", décris les personnages avec le même look que dans "characters". N'invente pas de faits contraires au scénario ; les âges et tailles sont des estimations plausibles.

Rôles : ${roles.map(r => r.name).join(', ') || '(aucun)'}
Décors : ${places.join(', ') || '(aucun)'}
Scènes : ${scenes.map(s => `${s.num} ${s.ie} ${s.timeL} ${s.decor}`).join(' | ')}
${B.film.genres.length ? 'Genres déjà choisis : ' + B.film.genres.join(', ') + '\n' : ''}
SCÉNARIO :
${scriptText()}`;
}
function applyAnalysis(data, keep) {
  const p = X.project, e = p.edits, P = X.P(), B = bible(p, P);
  const set = (k, v) => { v = (v == null ? '' : String(v)).trim(); if (!v) return 0; if (keep && (e[k] || '').trim()) return 0; e[k] = v; return 1; };
  const n = { film: 0, ch: 0, pl: 0, ob: 0, sc: 0 };
  if (data.film) {
    const f = data.film; n.film += set('film.logline', f.logline) + set('film.synopsis', f.synopsis) + set('film.style', f.style);
    const g = (f.genres || []).map(x => String(x).trim()).filter(Boolean);
    if (g.length && !(keep && e['film.genres'])) { e['film.genres'] = g.join(','); n.film++; }
  }
  const norm = s => String(s || '').trim().toUpperCase();
  (data.characters || []).forEach(c => { const x = B.ch.find(y => norm(y.name) === norm(c.name)); if (!x) return; let k = 0; ['age', 'height', 'style', 'look', 'desc'].forEach(fl => { k += set(bibKey(x.key, fl), c[fl]); }); if (k) n.ch++; });
  (data.places || []).forEach(c => { const x = B.pl.find(y => norm(y.name) === norm(c.name)); if (!x) return; let k = 0; ['type', 'style', 'desc'].forEach(fl => { k += set(bibKey(x.key, fl), c[fl]); }); if (k) n.pl++; });
  (data.objects || []).slice(0, 12).forEach(c => {
    const name = String(c.name || '').trim(); if (!name) return;
    let x = B.ob.find(y => y.name.toLowerCase() === name.toLowerCase());
    if (!x) { const b = p.bible ||= {}; const id = uid(); (b.objects ||= []).push({ id }); x = { key: 'ob:c:' + id }; e[bibKey(x.key, 'name')] = name.charAt(0).toUpperCase() + name.slice(1); }
    let k = 0; ['style', 'desc', 'scenes'].forEach(fl => { k += set(bibKey(x.key, fl), c[fl]); }); if (k) n.ob++;
  });
  (data.scenes || []).forEach(c => {
    const s = P.scenes.find(y => String(y.num) === String(c.num).trim()); if (!s) return;
    let k = 0;
    if (c.summary && e['ov.' + s.k + '.summary'] == null) { e['ov.' + s.k + '.summary'] = String(c.summary).trim(); k++; }
    k += set('bd.' + s.k + '.rem', c.notes) + set('bd.' + s.k + '.cos', c.cos) + set('bd.' + s.k + '.hmc', c.hmc);
    if (k) n.sc++;
  });
  X.save(); return n;
}

// ---------- Mode 3 : découpage ----------
function decPrompt(scenes) {
  return `Tu es réalisateur. Propose le découpage technique (liste des plans) de chaque scène ci-dessous. Réponds UNIQUEMENT avec un objet JSON :
{"scenes":[{"num":"numéro exact","shots":[{"size":"${SHOT.size.filter(Boolean).join(' | ')}","angle":"${SHOT.angle.filter(Boolean).join(' | ')}","move":"${SHOT.move.filter(Boolean).join(' | ')}","lens":"ex. 35 mm","desc":"ce que l'on voit, en ${LNAME}, 1 phrase","sound":"réplique ou son, court","dur":"durée à l'écran en secondes","prompt":"English visual description of this exact frame, with characters' look, 25-40 words"}]}]}
Utilise exactement ces valeurs pour size, angle et move. 3 à 8 plans par scène selon sa longueur et son intensité ; couvre toute l'action ; varie les valeurs de plan avec intention.

Personnages : ${X.P().roles.map(r => { const c = castOf({ roles: [r] }); return c; }).join('; ')}

${scenes.map(s => `SCÈNE ${s.num} — ${s.ie} ${s.timeL} — ${s.decor}\n${sceneText(s)}`).join('\n\n')}`;
}

// Découpage de base sans IA : installation, plan moyen, champ / contrechamp, insert
function basicCoverage(s) {
  const r = s.roles.map(x => x.name), sh = [];
  sh.push({ size: s.ie === 'EXT' ? 'Plan d’ensemble' : 'Plan large', angle: 'Face', move: 'Fixe', lens: '24 mm', desc: `${s.decor} : ${tr('installation')}${r.length ? ', ' + r.join(', ') : ''}`, sound: '', dur: '5' });
  if (r.length) sh.push({ size: 'Plan moyen', angle: 'Trois-quarts', move: r.length > 1 ? 'Travelling latéral' : 'Panoramique', lens: '35 mm', desc: r.slice(0, 3).join(', '), sound: s.dialog[0] ? s.dialog[0].slice(0, 60) : '', dur: '8' });
  if (r.length > 1 && s.dialog.length) { sh.push({ size: 'Plan rapproché', angle: 'Champ', move: 'Fixe', lens: '50 mm', desc: r[0], sound: '', dur: '6' }); sh.push({ size: 'Plan rapproché', angle: 'Contrechamp', move: 'Fixe', lens: '50 mm', desc: r[1], sound: '', dur: '6' }); }
  else if (r.length) sh.push({ size: 'Gros plan', angle: 'Profil', move: 'Fixe', lens: '85 mm', desc: r[0], sound: '', dur: '4' });
  if (s.e >= 1) sh.push({ size: 'Insert', angle: 'Plongée', move: 'Fixe', lens: '100 mm', desc: tr('Détail'), sound: '', dur: '2' });
  return { num: s.num, shots: sh };
}

// ---------- Interface ----------
export function mountButton(root) {
  const b = document.createElement('button');
  b.className = 'prepai-fab'; b.innerHTML = '<span>✦</span> Moodboard AI'; b.onclick = () => openAI({});
  root.appendChild(b);
}
let running = null;
const pills = (name, opts, cur) => `<div class="pills" data-pills="${name}">${opts.map(([v, l]) => `<button class="pill ${v === cur ? 'on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
export function openAI(opts = {}) {
  if (running) return X.toast('Moodboard AI travaille déjà…');
  const P = X.P(), sc = scope();
  if (!P.scenes.length) return X.toast('Ajoutez d’abord un scénario (onglet Scénario).');
  let mode = opts.mode || (opts.sceneKey ? 'scene' : 'prep');
  const styles = Object.entries(SK_STYLES).filter(([, v]) => !(v.localOnly && X.demo)).map(([k, v]) => [k, v.label]);
  const ep = X.ep(), epName = ep && isSeries(X.project) ? (X.project.episodes.find(e => e.id === ep) || {}).name : '';
  const sceneOpts = sc.map(s => `<option value="${esc(s.k)}" ${s.k === opts.sceneKey ? 'selected' : ''}>${esc(s.num)} · ${s.ie} ${esc(s.timeL)} · ${esc(s.decor)}</option>`).join('');
  const first = sc.find(s => s.k === opts.sceneKey) || sc[0];
  X.modal(`<div class="row between"><h3>✦ Moodboard AI${epName ? ' · ' + esc(epName) : ''}</h3><button class="x" data-close>✕</button></div>
    <div class="seg wide aimode"><button data-m="prep">Tout préparer</button><button data-m="scene">Une scène</button><button data-m="dec">Découpage</button></div>
    <div data-pane="prep"><p class="note">Lit ${epName ? 'l’épisode' : 'le scénario'}, écrit les fiches et dessine un moodboard de croquis, relié aux scènes sur le canvas.</p>
      <div class="checks">
        <label><input type="checkbox" value="film" checked>Film : logline, synopsis, genre, style</label>
        <label><input type="checkbox" value="ch" checked>Personnages : âge, taille, style, look, description</label>
        <label><input type="checkbox" value="pl" checked>Lieux : type, ambiance, description</label>
        <label><input type="checkbox" value="ob" checked>Objets principaux</label>
        <label><input type="checkbox" value="sc" checked>Scènes : résumé, intention, costumes, HMC</label>
        <label><input type="checkbox" value="img" checked>Moodboard de croquis</label>
      </div>
      <div class="slider"><label>Nombre de croquis : <b class="nv">8</b></label><input type="range" class="rn" min="6" max="13" value="8"></div></div>
    <div data-pane="scene"><label class="fl">Scène<select id="asc">${sceneOpts}</select></label>
      <label class="fl">Description de l’image<textarea id="ap" rows="4">${esc(opts.prompt || (first ? scenePrompt(first) : ''))}</textarea></label>
      <p class="note sm">Les personnages sont décrits avec leur look de la Bible, pour qu’ils se ressemblent d’une image à l’autre.</p>
      <div class="row gap"><div><div class="lbl">Format</div>${pills('ratio', Object.keys(RATIOS).map(r => [r, r]), '16:9')}</div><div><div class="lbl">Nombre</div>${pills('n', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], '2')}</div></div></div>
    <div data-pane="dec"><p class="note">Propose la liste des plans (valeur, angle, mouvement, objectif, action, son, durée) et peut dessiner chaque plan.</p>
      <label class="fl">Scènes<select id="ads">${opts.sceneKey ? `<option value="one">Scène ${esc((sc.find(s => s.k === opts.sceneKey) || {}).num || '')} seulement</option>` : ''}<option value="todo">Scènes sans découpage (${sc.filter(s => !(X.project.shots || {})[s.k]?.length).length})</option><option value="all">Toutes les scènes${epName ? ' de l’épisode' : ''} (${sc.length})</option></select></label>
      <label class="chk"><input type="checkbox" id="adraw" checked> Dessiner les plans</label>
      <div class="slider"><label>Croquis au maximum : <b class="nv2">8</b></label><input type="range" class="rn2" min="6" max="13" value="8"></div></div>
    <div class="lbl">Style des croquis</div>${pills('style', styles, styleKey())}
    <label class="chk"><input type="checkbox" id="pkeep" checked> Garder ce que j’ai déjà écrit (remplir seulement ce qui est vide)</label>
    <p class="note sm">${X.demo ? 'Croquis dessinés dans le navigateur : gratuits, hors ligne, sans IA d’image. Les textes (fiches, découpage détaillé) utilisent Claude si vous l’autorisez ; sinon un découpage de base est proposé.' : 'Texte : Pollinations ou Cloudflare (Réglages → IA). Images : votre générateur gratuit.'}</p>
    <div id="plog" class="plog hidden"></div>
    <div class="row between ebtm"><button class="btn ghost hidden" id="pstop">Arrêter</button><span></span><button class="btn" id="pgo">Lancer</button></div>`,
    (bg, close) => {
      const q = s => bg.querySelector(s);
      const setMode = m => { mode = m; bg.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === m)); bg.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== m)); q('#pkeep').parentElement.classList.toggle('hidden', m === 'scene'); };
      setMode(mode);
      bg.querySelectorAll('[data-m]').forEach(b => b.onclick = () => setMode(b.dataset.m));
      bg.querySelectorAll('[data-pills]').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('.pill'); if (!b) return; g.querySelectorAll('.pill').forEach(x => x.classList.toggle('on', x === b)); }));
      q('.rn').oninput = e => { q('.nv').textContent = e.target.value; }; q('.rn2').oninput = e => { q('.nv2').textContent = e.target.value; };
      q('#asc').onchange = e => { const s = X.P().scenes.find(x => x.k === e.target.value); if (s) q('#ap').value = scenePrompt(s); };
      q('#pgo').onclick = () => run(bg, close, () => mode, opts);
    });
}
async function run(bg, close, getMode, opts) {
  const q = s => bg.querySelector(s), mode = getMode();
  const pv = n => (bg.querySelector(`[data-pills="${n}"] .on`) || {}).dataset?.v;
  const style = pv('style') || 'board'; LS.set('sp.skstyle', style);
  const keep = q('#pkeep').checked;
  const ctl = new AbortController(), signal = ctl.signal;
  const log = q('#plog'); log.classList.remove('hidden'); log.innerHTML = '';
  setTimeout(() => log.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  const line = (t, c = '') => { const d = document.createElement('div'); d.className = 'pl ' + c; d.innerHTML = t; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  const grid = () => { const g = document.createElement('div'); g.className = 'gprev'; log.appendChild(g); return g; };
  const lock = on => { bg.querySelectorAll('.aimode button, [data-pane] input, [data-pane] select, [data-pane] textarea, #pkeep, .pill').forEach(i => i.disabled = on); q('#pgo').disabled = on; q('#pgo').textContent = on ? 'En cours…' : 'Relancer'; q('#pstop').classList.toggle('hidden', !on); };
  q('#pstop').onclick = () => { ctl.abort(); line('Arrêt demandé.', 'muted'); };
  lock(true); running = true;
  const placed = [];
  try {
    if (mode === 'prep') {
      const want = new Set([...bg.querySelectorAll('[data-pane="prep"] .checks input:checked')].map(i => i.value));
      const nFrames = +q('.rn').value, sc = scope();
      let data = {};
      if (['film', 'ch', 'pl', 'ob', 'sc'].some(k => want.has(k))) {
        const st = line('Lecture et analyse du scénario… <span class="spin"></span>');
        try {
          data = parseJSON(await askText(analysisPrompt(sc, nFrames), signal));
          st.innerHTML = 'Analyse terminée ✓';
          const n = applyAnalysis({ film: want.has('film') ? data.film : null, characters: want.has('ch') ? data.characters : [], places: want.has('pl') ? data.places : [], objects: want.has('ob') ? data.objects : [], scenes: want.has('sc') ? data.scenes : [] }, keep);
          X.refresh(true);
          line(`${tr('Écrit')} : ${[want.has('film') && `film (${n.film})`, want.has('ch') && `${n.ch} personnages`, want.has('pl') && `${n.pl} lieux`, want.has('ob') && `${n.ob} objets`, want.has('sc') && `${n.sc} scènes`].filter(Boolean).join(' · ')}`, 'ok');
        } catch (e) { if (signal.aborted) throw e; st.innerHTML = esc(tr('Textes non écrits') + ' : ' + (e.message || 'erreur')); st.className = 'pl muted'; data = {}; }
      }
      if (want.has('img') && !signal.aborted) {
        const P2 = X.P(), sc2 = scope();
        let frames = (data.moodboard || []).map(m => ({ ...m, num: String(m.num || '').trim() })).filter(m => m.prompt && sc2.some(s => s.num === m.num));
        for (const s of sc2) { if (frames.length >= nFrames) break; if (!frames.some(f => f.num === s.num)) frames.push({ num: s.num, shot: 'Plan large', prompt: scenePrompt(s) }); }
        frames = frames.slice(0, nFrames);
        const s2 = line('Croquis… <span class="spin"></span>'), g = grid(), imgs = [];
        await makeImages(frames, { style, signal, onStatus: t => { s2.innerHTML = esc(t) + ' <span class="spin"></span>'; }, onImage: (f, src) => { const s = P2.scenes.find(x => x.num === f.num); imgs.push({ f, src, k: s && s.k, style, caption: `Sc. ${f.num} · ${f.shot || ''}`.trim() }); g.insertAdjacentHTML('beforeend', `<img src="${esc(src)}" alt="">`); } });
        s2.innerHTML = `${imgs.length} croquis sur ${frames.length} ✓`;
        if (imgs.length) { placeBoard(imgs, `Moodboard AI · ${SK_STYLES[style].label.toLowerCase()}`); placed.push(...imgs); line('Croquis ajoutés au canvas, reliés à leur scène.', 'ok'); }
      }
    } else if (mode === 'scene') {
      const k = q('#asc').value, s = X.P().scenes.find(x => x.k === k), prompt = q('#ap').value.trim();
      if (!prompt) throw new Error('Décrivez l’image.');
      const ratio = pv('ratio') || '16:9', n = +(pv('n') || 2);
      const frames = [...Array(n)].map((_, i) => ({ num: s.num, shot: '', prompt: prompt + (n > 1 && i ? ` (variation ${i + 1}: different camera angle)` : '') }));
      const st = line('Images… <span class="spin"></span>'), g = grid(), imgs = [];
      await makeImages(frames, { style, ratio, signal, onStatus: t => { st.innerHTML = esc(t) + ' <span class="spin"></span>'; }, onImage: (f, src) => { imgs.push({ f: { ...f, prompt }, src, k, style, caption: `Sc. ${s.num}` }); g.insertAdjacentHTML('beforeend', `<img src="${esc(src)}" alt="">`); } });
      st.innerHTML = `${imgs.length} image${imgs.length > 1 ? 's' : ''} ✓`;
      if (imgs.length) { const c = X.project.canvas || {}; placeNear(opts.anchorId ? (c.items || []).find(x => x.id === opts.anchorId) : null, imgs); placed.push(...imgs); line('Ajoutées au canvas à côté de la scène.', 'ok'); }
    } else {
      const which = q('#ads').value, all = scope(), shots = X.project.shots ||= {};
      const sel = which === 'one' ? all.filter(s => s.k === opts.sceneKey) : which === 'todo' ? all.filter(s => !(shots[s.k] || []).length) : all;
      if (!sel.length) throw new Error('Aucune scène à découper.');
      const per = 6; let done = 0; const fresh = [];
      for (let i = 0; i < sel.length && !signal.aborted; i += per) {
        const batch = sel.slice(i, i + per);
        const st = line(`${tr('Découpage')} · ${tr('Scènes')} ${batch.map(s => s.num).join(', ')}… <span class="spin"></span>`);
        let data; try { data = parseJSON(await askText(decPrompt(batch), signal)); } catch (e) { if (signal.aborted) break; data = { scenes: batch.map(basicCoverage) }; st.innerHTML = esc(tr('Découpage de base (sans IA)') + ' · ' + tr('Scènes') + ' ' + batch.map(s => s.num).join(', ')) + ' ✓'; }
        (data.scenes || []).forEach(c => {
          const s = batch.find(x => x.num === String(c.num).trim()); if (!s || !Array.isArray(c.shots) || !c.shots.length) return;
          if (keep && (shots[s.k] || []).length) return;
          const pick = (list, v) => list.includes(v) ? v : (list.find(o => o && v && o.toLowerCase() === String(v).toLowerCase()) || '');
          shots[s.k] = c.shots.slice(0, 14).map(x => ({ id: uid(), size: pick(SHOT.size, x.size), angle: pick(SHOT.angle, x.angle), move: pick(SHOT.move, x.move), lens: String(x.lens || ''), desc: String(x.desc || ''), sound: String(x.sound || ''), dur: String(x.dur || '').replace(/[^\d.,]/g, ''), prompt: String(x.prompt || '') }));
          done++; fresh.push(s);
        });
        st.innerHTML = `${tr('Scènes')} ${batch.map(s => s.num).join(', ')} ✓`;
      }
      X.save(); X.refresh(true);
      line(`${done} scène${done > 1 ? 's' : ''} découpée${done > 1 ? 's' : ''}.`, 'ok');
      if (q('#adraw').checked && !signal.aborted && fresh.length) {
        const max = +q('.rn2').value, frames = [];
        // Un plan par scène d'abord, puis les suivants, jusqu'au maximum
        for (let r = 0; frames.length < max && r < 14; r++) fresh.forEach(s => { const x = (shots[s.k] || [])[r]; if (x && frames.length < max) frames.push({ k: s.k, id: x.id, num: s.num, shot: [x.size, x.angle, x.move].filter(Boolean).join(', '), prompt: (x.prompt || x.desc) + (castOf(s) ? '. Characters: ' + castOf(s) : '') }); });
        const st = line('Croquis des plans… <span class="spin"></span>'), g = grid(); let n = 0;
        await makeImages(frames, { style, signal, onStatus: t => { st.innerHTML = esc(t) + ' <span class="spin"></span>'; }, onImage: (f, src) => { const x = (shots[f.k] || []).find(y => y.id === f.id); if (x) { x.img = src; n++; X.save(); } g.insertAdjacentHTML('beforeend', `<img src="${esc(src)}" alt="">`); } });
        st.innerHTML = `${n} plan${n > 1 ? 's' : ''} dessiné${n > 1 ? 's' : ''} ✓`;
      }
    }
    line(`Terminé. ${mode === 'dec' ? '<button class="link" data-goto="dec">Voir le découpage</button>' : '<button class="link" data-goto="canvas">Voir le canvas</button> · <button class="link" data-goto="bible">Voir la Bible</button>'}`, 'ok');
  } catch (e) {
    line(esc(e.code === 'cancelled' || signal.aborted ? 'Arrêté.' : 'Moodboard AI n’a pas pu terminer : ' + (e.message || 'erreur')), 'bad');
  } finally {
    running = null; lock(false);
    if (bg.isConnected) X.refresh(true); else X.refresh();
    log.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { close(); X.goto(b.dataset.goto); });
    bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-close]')) X.refresh(); });
  }
}

// ---------- Croquis d'un seul plan (bouton « ✎ croquis » du découpage) ----------
// Une image à partir d'un prompt libre (fiches personnages du Studio IA)
export async function genImage(prompt, ratio = '16:9', hint = {}) {
  let out = null; const ctl = new AbortController();
  await makeImages([{ num: '', k: null, shot: hint.size || 'Plan large', prompt }], { style: styleKey(), ratio, signal: ctl.signal, onStatus: () => { }, onImage: (f, src) => { out = src; } });
  return out;
}
export async function sketchShot(k, id) {
  const s = X.P().scenes.find(x => x.k === k), x = ((X.project.shots || {})[k] || []).find(y => y.id === id);
  if (!s || !x) return;
  if (running) return X.toast('Moodboard AI travaille déjà…');
  const style = styleKey(), ctl = new AbortController(); running = true;
  const i = X.project.shots[k].indexOf(x);
  X.toast(`Croquis du plan ${shotLabel(s, i)} en cours…`, 60000);
  let got = false;
  try {
    const desc = x.prompt || [x.size, x.angle, x.move, x.desc].filter(Boolean).join(', ');
    await makeImages([{ num: s.num, shot: [x.size, x.angle, x.move].filter(Boolean).join(', '), prompt: `${desc}. Setting: ${s.ie === 'INT' ? 'interior' : 'exterior'} ${s.night ? 'night' : 'day'}, ${s.decor.toLowerCase()}.${castOf(s) ? ' Characters: ' + castOf(s) : ''}` }], { style, signal: ctl.signal, onStatus: () => { }, onImage: (f, src) => { x.img = src; got = true; X.save(); } });
    X.toast(got ? `Plan ${shotLabel(s, i)} dessiné` : 'Le croquis n’a pas pu être fait.');
  } catch (e) { X.toast('Croquis impossible : ' + esc(e.message || '')); }
  finally { running = null; X.refresh(); }
}
