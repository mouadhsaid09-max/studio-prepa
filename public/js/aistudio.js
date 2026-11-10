// Studio IA : pour les publicités et mini-séries générées avec l'IA.
// Fiches personnages (apparence, tenue, jeton de cohérence, image de référence), compétences de prompt
// (blocs de style réutilisables), et prompts image + mouvement pour chaque plan, prêts à copier ou exporter.
import { esc, shotLabel } from './parser.js';
import { tr } from './i18n.js';
import { icon } from './icons.js';
import { renderAIPost, onAIPostChange } from './aipost.js';
import { renderAssist, bindAssist, enhanceShot } from './aiassist.js';
let ASSIST_BUSY = false;

const EN = {
  'Plan d’ensemble': 'extreme wide shot', 'Plan large': 'wide shot', 'Plan moyen': 'medium shot', 'Plan américain': 'cowboy shot', 'Plan rapproché': 'medium close-up', 'Gros plan': 'close-up', 'Très gros plan': 'extreme close-up', 'Insert': 'insert detail shot',
  'Face': 'frontal angle', 'Profil': 'profile angle', 'Trois-quarts': 'three-quarter angle', 'Plongée': 'high angle', 'Contre-plongée': 'low angle', 'Subjective': 'point-of-view shot', 'Vue aérienne': 'aerial view', 'Champ': 'over-the-shoulder shot', 'Contrechamp': 'reverse over-the-shoulder shot', 'Amorce': 'foreground framing',
  'Fixe': 'static camera', 'Panoramique': 'slow pan', 'Travelling avant': 'dolly in', 'Travelling arrière': 'dolly out', 'Travelling latéral': 'lateral tracking shot', 'Steadicam': 'smooth steadicam follow', 'Caméra épaule': 'handheld camera', 'Grue': 'crane move', 'Drone': 'drone flyover', 'Zoom': 'slow zoom'
};
export const SKILL_PRESETS = [
  { id: 'cine35', name: 'Cinéma 35 mm', text: 'cinematic film still, shot on 35mm film, anamorphic lens, natural film grain, shallow depth of field, motivated lighting' },
  { id: 'pubstudio', name: 'Pub produit studio', text: 'premium commercial look, clean studio lighting, glossy reflections, product hero framing, high-end advertising photography' },
  { id: 'clipneon', name: 'Clip néon', text: 'music video aesthetic, neon colour accents, haze, strong backlight, bold contrast, stylish framing' },
  { id: 'docu', name: 'Réalisme documentaire', text: 'documentary realism, available light, handheld feel, authentic textures, muted colours' },
  { id: 'anim3d', name: 'Animation 3D', text: 'stylised 3D animation, soft global illumination, rounded shapes, expressive characters, rich colour palette' },
  { id: 'noir', name: 'Film noir', text: 'black and white film noir, hard shadows, venetian blind light, high contrast, smoky atmosphere' }
];
const RATIOS = ['16:9', '9:16', '1:1', '4:5', '2.39:1'];
export const aiDefaults = () => ({ style: { ratio: '16:9', light: '', palette: '', neg: 'blurry, distorted faces, extra fingers, text, watermark, logo' }, skills: [{ ...SKILL_PRESETS[0], on: true }], chars: {}, shots: {} });
const A = p => { const a = p.ai ||= aiDefaults(); a.style ||= aiDefaults().style; a.skills ||= []; a.chars ||= {}; a.shots ||= {}; return a; };

const clean = t => String(t || '').trim().replace(/[.;,\s]+$/, '');
const charOf = (a, name) => a.chars[name] || {};
const token = (name, c) => (c.token || ('@' + name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')));
const charLine = (a, name) => { const c = charOf(a, name); return [token(name, c), c.look, c.outfit].filter(Boolean).join(', '); };
const skillsText = a => a.skills.filter(s => s.on && s.text).map(s => s.text).join(', ');

export function shotPrompts(project, P) {
  const a = A(project), shots = project.shots || {}, out = [];
  P.scenes.forEach(s => {
    const list = (shots[s.k] || []).length ? shots[s.k] : [{ id: '_', size: s.roles.length ? 'Plan moyen' : 'Plan large', desc: s.summary || '' }];
    list.forEach((x, i) => {
      const key = s.k + '|' + x.id, ov = a.shots[key] || {};
      const chars = s.roles.map(r => charLine(a, r.name)).filter(Boolean);
      const image = [
        [EN[x.size], EN[x.angle]].filter(Boolean).join(', '),
        clean(x.desc || s.summary),
        chars.length ? 'Characters: ' + chars.join(' | ') : '',
        `Setting: ${s.ie === 'INT' ? 'interior' : 'exterior'}, ${s.night ? 'night' : 'day'}, ${s.decor.toLowerCase()}`,
        skillsText(a), a.style.light ? 'Lighting: ' + a.style.light : '', a.style.palette ? 'Colour palette: ' + a.style.palette : '',
        x.lens ? x.lens + ' lens' : '', `aspect ratio ${a.style.ratio || '16:9'}`
      ].map(clean).filter(Boolean).join('. ') + '.';
      const motion = [EN[x.move] || 'subtle camera movement', clean(x.desc || s.summary), x.sound ? 'sound: ' + x.sound : '', x.dur ? `duration ${x.dur} seconds` : 'duration 5 seconds'].filter(Boolean).join(', ');
      out.push({ key, s, x, label: x.id === '_' ? s.num : shotLabel(s, i), image: ov.image || image, motion: ov.motion || motion, edited: !!(ov.image || ov.motion), neg: a.style.neg || '' });
    });
  });
  return out;
}

export function renderAIStudio(project, P, sub = 'chars') {
  const a = A(project), roles = P.roles;
  const tabs = [['chars', 'Personnages', 'person'], ['skills', 'Compétences de prompt', 'style'], ['shots', 'Prompts des plans', 'prompt'], ['post', 'Post-production', 'post'], ['help', 'Assistant', 'assist']];
  let body = '';
  if (sub === 'chars') {
    body = roles.length ? `<div class="ais-grid">${roles.map(r => {
      const c = charOf(a, r.name), k = esc(r.name);
      return `<article class="ais-char"><div class="ais-ref">${c.ref ? `<img src="${esc(c.ref)}" alt="">` : `<div class="ais-ph">${icon('person', 56)}</div>`}<div class="ais-refb"><button class="btn sm ghost" data-airef="${k}">${tr('Importer')}</button><button class="btn sm" data-aigen="${k}">✦ ${tr('Fiche de référence')}</button></div></div>
        <div class="ais-cf"><div class="row between"><h3 data-nt>${esc(r.name)}</h3><code class="ais-tok" data-nt>${esc(token(r.name, c))}</code></div>
        <label class="fl">${tr('Jeton de cohérence')}<input data-aic="${k}|token" value="${esc(c.token || '')}" placeholder="${esc(token(r.name, {}))}"></label>
        <label class="fl">${tr('Apparence')}<textarea rows="2" data-aic="${k}|look" placeholder="${tr('Âge, visage, cheveux, morphologie…')}">${esc(c.look || '')}</textarea></label>
        <label class="fl">${tr('Tenue')}<textarea rows="2" data-aic="${k}|outfit" placeholder="${tr('Vêtements, couleurs, accessoires')}">${esc(c.outfit || '')}</textarea></label>
        <label class="fl">${tr('Voix')}<input data-aic="${k}|voice" value="${esc(c.voice || '')}" placeholder="${tr('Timbre, accent, rythme (pour la voix de synthèse)')}"></label>
        <p class="ais-line"><b>Prompt</b> <span data-nt>${esc(charLine(a, r.name))}</span> <button class="link" data-aicopy="${esc(charLine(a, r.name))}">${tr('Copier')}</button></p></div></article>`;
    }).join('')}</div>` : `<p class="note pad">${tr('Ajoutez des personnages au scénario (noms en MAJUSCULES avant les dialogues) pour créer leurs fiches.')}</p>`;
  } else if (sub === 'skills') {
    const have = new Set(a.skills.map(s => s.id));
    body = `<div class="ais-style grid4">
        <label class="fl">${tr('Format d’image')}<select data-ais="ratio">${RATIOS.map(r => `<option ${r === a.style.ratio ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="fl">${tr('Lumière')}<input data-ais="light" value="${esc(a.style.light || '')}" placeholder="golden hour, soft key light…"></label>
        <label class="fl">${tr('Palette')}<input data-ais="palette" value="${esc(a.style.palette || '')}" placeholder="teal and orange, pastel…"></label>
        <label class="fl">${tr('Prompt négatif')}<input data-ais="neg" value="${esc(a.style.neg || '')}"></label></div>
      <p class="note">${tr('Les compétences sont des blocs de prompt réutilisables. Celles qui sont activées sont ajoutées à tous les prompts des plans.')}</p>
      <div class="ais-skills">${a.skills.map((s, i) => `<div class="ais-skill ${s.on ? 'on' : ''}"><label class="sw-t"><input type="checkbox" data-aisk="${i}|on" ${s.on ? 'checked' : ''}><i></i></label><div class="ais-sk"><input class="ais-skn" data-aisk="${i}|name" value="${esc(s.name)}" placeholder="${tr('Nom')}"><textarea rows="2" data-aisk="${i}|text" placeholder="${tr('Texte du prompt (en anglais de préférence)')}">${esc(s.text || '')}</textarea></div><button class="bx" data-aiskdel="${i}">✕</button></div>`).join('')}</div>
      <div class="row wrap"><button class="btn sm ghost" data-aiskadd>+ ${tr('Nouvelle compétence')}</button>${SKILL_PRESETS.filter(p => !have.has(p.id)).map(p => `<button class="chip" data-aipre="${p.id}">+ ${esc(tr(p.name))}</button>`).join('')}</div>`;
  } else if (sub === 'help') {
    body = renderAssist(project, ASSIST_BUSY);
  } else if (sub === 'post') {
    body = renderAIPost(a, shotPrompts(project, P));
  } else {
    const list = shotPrompts(project, P);
    body = `<div class="row between ais-bar"><p class="note">${list.length} ${tr('plans')} · ${tr('Les prompts sont composés à partir du découpage, des fiches personnages et des compétences actives. Modifiez-les librement.')}</p><div class="row"><button class="btn sm ghost" data-aiexp="txt">${tr('Exporter')} .txt</button><button class="btn sm ghost" data-aiexp="json">JSON</button><button class="btn sm" data-aiall>${tr('Tout copier')}</button></div></div>
      ${list.length ? list.map(p => `<article class="ais-shot"><div class="ais-sh"><b>${esc(p.label)}</b><span>${esc(p.s.ie)} ${esc(p.s.timeL)} · <span data-nt>${esc(p.s.decor)}</span></span>${p.x.id !== '_' ? `<span class="muted">${esc(tr(p.x.size || ''))}</span>` : ''}${p.edited ? `<button class="link" data-aireset="${esc(p.key)}">${tr('Rétablir l’automatique')}</button>` : ''}</div>
        <div class="ais-pr"><div class="ais-th">${p.x.img ? `<img src="${esc(p.x.img)}" alt="">` : p.x.id !== '_' ? `<button class="sbp-empty" data-dsketch="${esc(p.s.k)}|${esc(p.x.id)}">✎ ${tr('Croquis')}</button>` : `<button class="sbp-empty" data-dai="${esc(p.s.k)}">✦ ${tr('Découper la scène')}</button>`}</div>
        <label class="fl">${tr('Prompt image')}<textarea rows="5" data-aip="${esc(p.key)}|image" dir="ltr">${esc(p.image)}</textarea></label>
        <label class="fl">${tr('Prompt mouvement (vidéo)')}<textarea rows="5" data-aip="${esc(p.key)}|motion" dir="ltr">${esc(p.motion)}</textarea></label>
        <div class="ais-act"><button class="link ai" data-aienh="${esc(p.key)}">✦ ${tr('Améliorer avec l’assistant')}</button><button class="link" data-aicopy="${esc(p.image)}">${tr('Copier l’image')}</button><button class="link" data-aicopy="${esc(p.motion)}">${tr('Copier le mouvement')}</button></div></div></article>`).join('') : `<p class="note">${tr('Pas encore de scènes.')}</p>`}`;
  }
  return `<div class="ais"><header class="ais-hero"><div><span class="ais-kick">✦ ${tr('Studio IA')}</span><h2>${tr('Personnages, prompts et style')}</h2><p>${tr('Gardez les mêmes visages, le même style et les mêmes réglages d’un plan à l’autre, puis copiez les prompts dans votre générateur d’images ou de vidéo.')}</p></div></header>
    <nav class="ais-tabs">${tabs.map(([k, l, ic]) => `<button data-aisub="${k}" class="${k === sub ? 'on' : ''}">${icon(ic, 26)}<span>${tr(l)}</span></button>`).join('')}</nav>
    <div class="ais-body">${body}</div></div>`;
}

// Événements (o : { project, P, save, refresh, toast, copy, download, genImage, upload })
export function bindAIStudio(root, o) {
  const a = A(o.project);
  if (o.ask) bindAssist(root, { project: o.project, get P() { return o.P; }, list: () => shotPrompts(o.project, o.P), ask: o.ask, parseJSON: o.parseJSON, save: o.save, toast: o.toast, copy: o.copy,
    refresh: busy => { ASSIST_BUSY = !!busy; o.refresh('help'); } });
  root.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.aisub) return o.refresh(t.dataset.aisub);
    if (t.dataset.aicopy != null) return o.copy(t.dataset.aicopy);
    if (t.hasAttribute('data-aiskadd')) { a.skills.push({ id: 's' + Date.now().toString(36), name: '', text: '', on: true }); o.save(); return o.refresh(); }
    if (t.dataset.aipre) { const p = SKILL_PRESETS.find(x => x.id === t.dataset.aipre); if (p) { a.skills.push({ ...p, name: tr(p.name), on: true }); o.save(); o.refresh(); } return; }
    if (t.dataset.aiskdel != null) { a.skills.splice(+t.dataset.aiskdel, 1); o.save(); return o.refresh(); }
    if (t.dataset.aienh) {
      if (!o.ask) return;
      const shot = shotPrompts(o.project, o.P).find(x => x.key === t.dataset.aienh); if (!shot) return;
      t.disabled = true; t.textContent = tr('Amélioration…');
      try { const r = await enhanceShot(o.ask, o.project, o.P, shotPrompts(o.project, o.P), shot, o.parseJSON); const ov = a.shots[shot.key] ||= {}; ov.image = r.image; ov.motion = r.motion; o.save(); o.toast(tr('Prompts améliorés')); }
      catch (er) { o.toast(esc(er.message || tr('Service IA indisponible.'))); }
      return o.refresh();
    }
    if (t.dataset.aireset) { delete a.shots[t.dataset.aireset]; o.save(); return o.refresh(); }
    if (t.hasAttribute('data-aiall') || t.dataset.aiexp) {
      const list = shotPrompts(o.project, o.P);
      const txt = list.map(p => `# ${p.label} — ${p.s.ie} ${p.s.timeL} — ${p.s.decor}\nIMAGE: ${p.image}\nMOTION: ${p.motion}${p.neg ? '\nNEGATIVE: ' + p.neg : ''}`).join('\n\n');
      if (t.hasAttribute('data-aiall')) return o.copy(txt);
      const name = (o.project.name || 'projet') + ' - prompts.' + t.dataset.aiexp;
      if (t.dataset.aiexp === 'txt') return o.download(name, txt, 'text/plain');
      const chars = Object.fromEntries(o.P.roles.map(r => [r.name, { token: token(r.name, charOf(a, r.name)), ...charOf(a, r.name) }]));
      return o.download(name, JSON.stringify({ project: o.project.name, style: a.style, skills: a.skills.filter(s => s.on), characters: chars, shots: list.map(p => ({ id: p.label, scene: p.s.num, setting: `${p.s.ie} ${p.s.timeL} ${p.s.decor}`, image: p.image, motion: p.motion, negative: p.neg })) }, null, 2), 'application/json');
    }
    if (t.dataset.airef) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { (a.chars[t.dataset.airef] ||= {}).ref = await o.upload(f); o.save(); o.refresh(); } catch (er) { o.toast(esc(er.message)); } }; inp.click(); return; }
    if (t.dataset.aigen) {
      const name = t.dataset.aigen, c = a.chars[name] ||= {};
      t.disabled = true; t.textContent = tr('Génération…');
      try {
        const url = await o.genImage(`character reference sheet, full body front view, side view and back view of the same person, neutral grey background, ${charLine(a, name)}. ${skillsText(a)}`, '16:9', { roles: 1, size: 'Plan large' });
        if (url) { c.ref = url; o.save(); }
        else o.toast(tr('L’image n’a pas pu être générée.'));
      } catch (er) { o.toast(esc(er.message || 'erreur')); }
      o.refresh();
    }
  });
  root.addEventListener('change', e => {
    const d = e.target.dataset;
    const pc = onAIPostChange(a, e); if (pc !== null) { o.save(); if (pc) o.refresh(); return; }
    if (d.aic) { const [n, f] = d.aic.split('|'); (a.chars[n] ||= {})[f] = e.target.value; o.save(); o.refresh(); }
    if (d.ais) { a.style[d.ais] = e.target.value; o.save(); }
    if (d.aisk) { const [i, f] = d.aisk.split('|'); const s = a.skills[+i]; if (s) { s[f] = f === 'on' ? e.target.checked : e.target.value; o.save(); if (f === 'on') o.refresh(); } }
    if (d.aip) { const [k, f] = [d.aip.slice(0, d.aip.lastIndexOf('|')), d.aip.slice(d.aip.lastIndexOf('|') + 1)]; (a.shots[k] ||= {})[f] = e.target.value; o.save(); }
  });
}
