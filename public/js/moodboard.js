// Moodboard de scènes (onglet Découpage) : pour chaque scène, une planche d'images cinéma réalistes,
// une palette et une intention de lumière. Les personnages gardent la même apparence d'une image à l'autre :
// une « carte d'identité visuelle » fixe par personnage, la même graine par scène, et la fiche personnage
// en image de référence quand le service le permet (Gemini).
import { tr } from './i18n.js';
import { bible, SHOT } from './parser.js';
import { makeImage, imageInfo } from './imagegen.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h) % 1000000; };

export const LOOKS = {
  real: { label: 'Photo cinéma réaliste', en: 'photorealistic cinematic film still, shot on ARRI Alexa with anamorphic lens, natural skin texture, realistic faces, shallow depth of field, subtle film grain, professional color grading, 8k detail' },
  board: { label: 'Storyboard dessiné', en: 'professional film storyboard panel, black ink line art with grey marker shading, clean composition, white background' },
  paint: { label: 'Concept art', en: 'cinematic concept art, painterly digital matte painting, dramatic light, rich atmosphere' }
};
const ratioOf = p => ({ '2.39:1': '2.39:1', '2.35:1': '2.39:1', '4:3': '4:3', '1:1': '1:1', '9:16': '9:16' }[p.ai?.style?.ratio] || '16:9');
const sceneText = s => cut([...(s.action || []), ...(s.dialog || [])].join(' '), 1100);

// ---------- Affichage dans le découpage ----------
export function moodStrip(project, s) {
  const m = project.ai?.mood?.[s.k], sh = (project.shots?.[s.k] || []).filter(x => x.img);
  if (!sh.length && !m) return '';
  return `<div class="mood">
    ${m ? `<div class="mood-h">${(m.palette || []).map(c => `<span class="mchip" style="--c:${esc(c.hex)}" title="${esc(c.label || c.hex)}"></span>`).join('')}<span class="mlight">${esc(m.lightFr || m.light || '')}</span></div>` : ''}
    ${sh.length ? `<div class="mgrid">${sh.map(x => `<figure><a href="${esc(x.img)}" target="_blank" rel="noopener"><img src="${esc(x.img)}" alt="${esc(x.desc || '')}" loading="lazy"></a><figcaption><b>${esc(x.size || '')}</b> ${esc(cut(x.desc, 80))}</figcaption></figure>`).join('')}</div>` : ''}
  </div>`;
}

// ---------- Fenêtre de génération ----------
export function openMoodboard(X, sceneKey) {
  const P = X.P(), project = X.project(), list = X.scenes();
  if (!list.length) return X.toast(tr('Ajoutez d’abord un scénario (onglet Scénario).'));
  const opts = list.map(s => `<option value="${esc(s.k)}" ${s.k === sceneKey ? 'selected' : ''}>${esc(s.num)} · ${s.ie} ${esc(s.timeL)} · ${esc(cut(s.decor, 40))}</option>`).join('');
  X.modal(`<div class="npg-head"><h3>${tr('Moodboard de scène')}</h3><button class="x" data-close>✕</button></div>
    <p class="note">${tr('Des images de cinéma pour chaque scène, avec palette et lumière. Les personnages gardent le même visage et le même costume d’une image à l’autre.')}</p>
    <label class="fl">${tr('Scènes')}<select id="mbs"><option value="one">${tr('Cette scène')}</option><option value="todo" ${sceneKey ? '' : 'selected'}>${tr('Scènes sans images')}</option><option value="all">${tr('Toutes les scènes')}</option></select></label>
    <label class="fl" id="mbone">${tr('Scène')}<select id="mbk">${opts}</select></label>
    <div class="lbl">${tr('Rendu')}</div><div class="pills" id="mbl">${Object.entries(LOOKS).map(([k, v], i) => `<button class="pill ${i ? '' : 'on'}" data-v="${k}">${esc(tr(v.label))}</button>`).join('')}</div>
    <div class="lbl">${tr('Images par scène')}</div><div class="pills" id="mbn"><button class="pill on" data-v="shots">${tr('Un par plan du découpage')}</button><button class="pill" data-v="4">4</button><button class="pill" data-v="6">6</button></div>
    <p class="note sm" id="mbinfo"></p>
    <div class="mb-log" hidden></div>
    <div class="row end gap"><button class="btn ghost" data-close>${tr('Fermer')}</button><button class="btn" id="mbgo">${tr('Créer le moodboard')}</button></div>`, bg => {
    const sel = bg.querySelector('#mbs'), one = bg.querySelector('#mbone'), log = bg.querySelector('.mb-log'), go = bg.querySelector('#mbgo');
    if (sceneKey) sel.value = 'one';
    const sync = () => { one.hidden = sel.value !== 'one'; }; sel.onchange = sync; sync();
    bg.querySelectorAll('.pills').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('.pill'); if (!b) return; g.querySelectorAll('.pill').forEach(x => x.classList.toggle('on', x === b)); }));
    imageInfo().then(i => { bg.querySelector('#mbinfo').textContent = i.providers?.length ? tr('Service d’images : {p}').replace('{p}', i.providers.join(' → ')) : tr('Service d’images gratuit (Pollinations). Ajoutez une clé Cloudflare dans Vercel pour des images plus rapides et plus nettes.'); });
    let ac = null;
    go.onclick = async () => {
      if (ac) { ac.abort(); return; }
      const mode = sel.value, look = bg.querySelector('#mbl .on').dataset.v, n = bg.querySelector('#mbn .on').dataset.v;
      const scenes = mode === 'one' ? list.filter(s => s.k === bg.querySelector('#mbk').value) : mode === 'todo' ? list.filter(s => !(project.shots?.[s.k] || []).some(x => x.img)) : list;
      if (!scenes.length) return X.toast(tr('Toutes les scènes ont déjà des images.'));
      ac = new AbortController(); go.textContent = tr('Arrêter'); log.hidden = false; log.innerHTML = '';
      const line = t => { log.insertAdjacentHTML('beforeend', `<div>${t}</div>`); log.scrollTop = log.scrollHeight; return log.lastElementChild; };
      try { await run(X, project, P, scenes, { look, n, signal: ac.signal, line }); line(`<b>✓ ${esc(tr('Moodboard prêt.'))}</b>`); }
      catch (e) { line(`<span class="err">${esc(e.code === 'cancelled' ? tr('Arrêté.') : e.message)}</span>`); }
      finally { ac = null; go.textContent = tr('Créer le moodboard'); X.save(); X.refresh(); }
    };
  });
}

// ---------- 1. Le directeur photo écrit les images (texte), 2. on les fabrique une à une ----------
async function plan(X, project, P, scenes, n, signal) {
  const B = bible(project, P), a = project.ai || {}, e = project.edits || {};
  const names = [...new Set(scenes.flatMap(s => s.roles.map(r => r.name)))].slice(0, 12);
  const chars = names.map(nm => {
    const c = B.ch.find(x => x.name === nm), v = f => c ? B.val(c.key, f) : '';
    return `- ${nm}: ${[v('age'), v('height'), v('style'), v('look'), cut(v('desc'), 160), a.chars?.[nm]?.look, a.chars?.[nm]?.outfit].filter(Boolean).join(' · ') || '(pas de fiche)'}`;
  }).join('\n');
  const style = [e['film.style'], e['film.genres'], a.style?.light, a.style?.palette, (a.skills || []).filter(s => s.on && s.text).map(s => s.text).join(', ')].filter(Boolean).join(' · ');
  const sc = scenes.map(s => {
    const shots = (project.shots?.[s.k] || []);
    return `### k=${s.k} | ${s.num}. ${s.ie} ${s.decor} - ${s.timeL} | rôles: ${s.roles.map(r => r.name).join(', ') || '—'}
${sceneText(s)}
${n === 'shots' && shots.length ? 'PLANS (une image par plan, dans l’ordre) :\n' + shots.map((x, i) => `${i + 1}. ${[x.size, x.angle, x.move, x.lens].filter(Boolean).join(', ')} — ${x.desc || ''}`).join('\n') : `IMAGES CLÉS : ${n === 'shots' ? 6 : n}`}`;
  }).join('\n\n');
  const sys = `Tu es directeur de la photographie et storyboarder. Tu prépares le moodboard visuel de scènes de film.
Réponds UNIQUEMENT en JSON :
{"characters":{"NOM":"fixed English visual identity, 25-45 words: apparent age, gender, skin tone, face, hair, build, exact costume and colors, props"},
 "scenes":[{"k":"clé de scène","light":"English lighting intent","lightFr":"intention de lumière en français, courte","palette":[{"hex":"#RRGGBB","label":"nom en français"}],
   "frames":[{"size":"valeur de plan","angle":"","desc":"légende courte en français","prompt":"English: precise composition, who is in frame (use the character NAME), action, expression, setting details, foreground/background, camera height, lens"}]}]}
Règles : identité des personnages déduite de leur fiche et du scénario, identique dans toutes les images. Une vraie grammaire de cinéma (plan d'ensemble, plans moyens, gros plans, inserts). Si des PLANS sont donnés, une image par plan dans le même ordre. Palette de 4 à 5 couleurs. Pas de nom d'acteur réel ni de marque.
Valeurs de plan : ${SHOT.size.filter(Boolean).join(' | ')} ; angles : ${SHOT.angle.filter(Boolean).join(' | ')}.`;
  const user = `FILM : ${project.name}${style ? '\nSTYLE : ' + style : ''}\nPERSONNAGES :\n${chars || '—'}\n\nSCÈNES :\n${sc}`;
  const raw = await X.ask([{ role: 'system', content: sys }, { role: 'user', content: user }], signal, { json: true });
  const out = X.parseJSON(raw);
  return { characters: out.characters || {}, scenes: Array.isArray(out.scenes) ? out.scenes : [] };
}

function fallbackPlan(project, s, n) {
  const shots = project.shots?.[s.k] || [];
  const frames = (n === 'shots' && shots.length ? shots : [{ size: 'Plan d’ensemble' }, { size: 'Plan moyen' }, { size: 'Gros plan' }, { size: 'Insert' }].slice(0, +n || 4)).map(x => ({ size: x.size, angle: x.angle, desc: x.desc || s.summary, prompt: `${x.desc || s.summary || ''}` }));
  return { k: s.k, light: s.night ? 'night, practical lights, deep shadows' : 'soft natural daylight', frames };
}

async function run(X, project, P, scenes, o) {
  const look = LOOKS[o.look] || LOOKS.real, ratio = ratioOf(project), a = project.ai ||= {}; a.mood ||= {};
  o.line(esc(tr('Le directeur photo lit les scènes et les fiches…')));
  let pl = { characters: {}, scenes: [] };
  for (let i = 0; i < scenes.length; i += 4) {
    try { const r = await plan(X, project, P, scenes.slice(i, i + 4), o.n, o.signal); Object.assign(pl.characters, r.characters); pl.scenes.push(...r.scenes); }
    catch (e) { if (e.code === 'cancelled' || o.signal.aborted) throw e; o.line(esc(tr('Plan texte indisponible, images faites à partir du découpage.'))); }
  }
  // Mémoriser l'identité visuelle des personnages pour toutes les images à venir (Studio IA)
  a.chars ||= {}; Object.entries(pl.characters).forEach(([nm, v]) => { const c = a.chars[nm.toUpperCase()] ||= {}; if (!c.look && v) c.look = String(v).slice(0, 400); });
  for (const s of scenes) {
    if (o.signal.aborted) throw Object.assign(new Error('Arrêté.'), { code: 'cancelled' });
    const sp = pl.scenes.find(x => x.k === s.k) || fallbackPlan(project, s, o.n);
    const cast = s.roles.map(r => r.name), ident = cast.map(nm => { const v = pl.characters[nm] || a.chars?.[nm]?.look; return v ? `${nm}: ${v}` : ''; }).filter(Boolean).join('. ');
    const refs = cast.map(nm => a.chars?.[nm]?.ref).filter(u => typeof u === 'string' && /^(https:|data:image)/.test(u)).slice(0, 3);
    a.mood[s.k] = { light: sp.light || '', lightFr: sp.lightFr || '', palette: (sp.palette || []).filter(c => /^#[0-9a-f]{6}$/i.test(c?.hex)).slice(0, 6), at: Date.now() };
    const shots = project.shots ||= {}, keep = o.n === 'shots' && (shots[s.k] || []).length;
    if (!keep) shots[s.k] = [];
    const frames = (sp.frames || []).slice(0, 10), seed = hash(project.id + s.k);
    o.line(`<b>${esc(s.num)}. ${esc(s.decor)}</b> — ${frames.length} ${esc(tr('images'))}`);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i], st = o.line(`<span class="mute">${i + 1}/${frames.length} · ${esc(cut(f.desc || f.prompt, 70))}</span>`);
      const prompt = [look.en, `${f.size || ''} ${f.angle || ''}`.trim(), f.prompt, `Setting: ${s.ie === 'EXT' ? 'exterior' : 'interior'}, ${s.decor.toLowerCase()}, ${s.night ? 'night' : 'day'}`,
        sp.light && 'Lighting: ' + sp.light, (sp.palette || []).length && 'Color palette: ' + sp.palette.map(c => c.hex).join(' '), ident && 'Characters (keep exactly): ' + ident, 'no text, no watermark'].filter(Boolean).join('. ');
      try {
        const r = await makeImage({ prompt, ratio, seed: seed + i, refs, project: project.id, signal: o.signal, onStatus: t => { st.querySelector('.mute').textContent = `${i + 1}/${frames.length} · ${t}`; } });
        let x = keep ? shots[s.k][i] : null;
        if (!x) { x = { id: uid(), size: SHOT.size.includes(f.size) ? f.size : '', angle: SHOT.angle.includes(f.angle) ? f.angle : '', move: '', lens: '', desc: f.desc || '', sound: '', dur: '' }; shots[s.k].push(x); }
        x.img = r.url; x.prompt = prompt.slice(0, 1500);
        st.innerHTML = `<span class="ok">✓</span> <img src="${esc(r.url)}" alt=""> ${esc(cut(f.desc || '', 60))}`;
        X.save();
      } catch (e) { if (e.code === 'cancelled') throw e; st.innerHTML = `<span class="err">✕ ${esc(e.message)}</span>`; }
    }
  }
}
