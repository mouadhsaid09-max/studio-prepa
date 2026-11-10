// Bible du film (film, personnages, lieux, objets) + fiche scène modifiable
import { esc, bible, bibKey, KIND, FILM_FIELDS, GENRES, fmtE, parseE, cls, COLS_ALL, stripOrder, orderFromDays, fmtMin } from './parser.js';

let X; // contexte fourni par app.js : { modal, toast, project, P, save, refresh, upload, gotoScene }
export function initBible(ctx) { X = ctx; }

const field = (k, label, type, opt, value) => {
  const id = 'f_' + Math.random().toString(36).slice(2, 8);
  if (type === 'area') return `<label class="fl" for="${id}">${label}<textarea id="${id}" rows="3" data-bk="${esc(k)}" placeholder="${esc(opt || '')}">${esc(value)}</textarea></label>`;
  if (type === 'select') return `<label class="fl" for="${id}">${label}<select id="${id}" data-bk="${esc(k)}">${opt.map(o => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${o ? esc(o) : '—'}</option>`).join('')}</select></label>`;
  return `<label class="fl" for="${id}">${label}<input id="${id}" data-bk="${esc(k)}" value="${esc(value)}" placeholder="${esc(opt || '')}"></label>`;
};
// Les champs [data-bk] écrivent directement dans project.edits
function bindFields(root, after) {
  root.addEventListener('input', e => {
    const el = e.target.closest('[data-bk]'); if (!el) return;
    X.project.edits[el.dataset.bk] = el.value; X.save(); after && after(el);
  });
  root.addEventListener('change', e => { const el = e.target.closest('select[data-bk]'); if (el) { X.project.edits[el.dataset.bk] = el.value; X.save(); after && after(el); } });
}

// ---------- Onglet Bible ----------
const SUBS = [['film', 'Film'], ['ch', 'Personnages'], ['pl', 'Lieux'], ['ob', 'Objets']];
export function renderBible(sub) {
  const p = X.project, B = bible(p, X.P());
  const count = k => k === 'film' ? '' : ` <small>${B[k].length}</small>`;
  let body = '';
  if (sub === 'film') {
    const s = p.settings;
    body = `<div class="panel"><h2>Le film</h2>
      <div class="grid2 wide">
        <label class="fl">Titre<input data-title value="${esc(p.name)}"></label>
        <label class="fl">Production<input data-set="prod" value="${esc(s.prod || '')}" placeholder="Société"></label>
        <label class="fl">Réalisation<input data-set="real" value="${esc(s.real || '')}" placeholder="Nom"></label>
      </div>
      <div class="lbl">Genre</div>
      <div class="pills" id="genres">${[...new Set([...GENRES, ...B.film.genres])].map(g => `<button class="pill ${B.film.genres.includes(g) ? 'on' : ''}" data-genre="${esc(g)}">${esc(g)}</button>`).join('')}<button class="pill add" data-genre-add>+ Autre</button></div>
      <div class="fgrid">${FILM_FIELDS.map(([f, l, t, o]) => field('film.' + f, l, t, o, B.film[f])).join('')}</div></div>`;
  } else {
    const k = sub, list = B[k];
    body = `<div class="bgrid">${list.map(x => card(k, x, B)).join('')}<button class="bcard add" data-add-ent="${k}"><span>+</span>${KIND[k].add}</button></div>
      ${B.hidden.filter(h => h.key.startsWith(k + ':')).length ? `<p class="note">Masqués : ${B.hidden.filter(h => h.key.startsWith(k + ':')).map(h => `<button class="link" data-unhide="${esc(h.key)}">${esc(h.name)}</button>`).join(', ')}</p>` : ''}`;
  }
  return `<div class="prod"><div class="seg bseg">${SUBS.map(([k, l]) => `<button data-bsub="${k}" class="${sub === k ? 'on' : ''}">${l}${count(k)}</button>`).join('')}</div>
    <p class="note">${sub === 'film' ? 'Tout est modifiable. Le genre et la logline apparaissent sur la couverture du PDF.' : `Touchez une fiche pour la modifier. ${sub === 'ob' ? 'Les objets viennent de la colonne « Accessoires » du dépouillement ; ajoutez les vôtres.' : sub === 'pl' ? 'Les lieux viennent des décors du scénario ; ajoutez les vôtres.' : 'Les personnages viennent du scénario ; ajoutez les vôtres.'}`}</p>${body}</div>`;
}
function card(k, x, B) {
  const v = f => B.val(x.key, f), ph = v('photo');
  const sub = k === 'ch' ? [v('age'), v('height')].filter(Boolean).join(' · ') : k === 'pl' ? v('address') : v('status');
  const third = k === 'ch' ? v('actor') : k === 'pl' ? [...(x.ie || [])].join(' / ') : v('style');
  const chip = k === 'ch' ? v('style') : k === 'pl' ? v('permit') : '';
  const sc = x.scenes && x.scenes.length ? `Sc. ${x.scenes.join(', ')}` : (k === 'ob' && v('scenes') ? 'Sc. ' + v('scenes') : '');
  return `<button class="bcard" data-ent="${esc(x.key)}">
    <div class="bph ${k}" ${ph ? `style="background-image:url('${esc(ph)}')"` : ''}>${ph ? '' : esc(x.name.slice(0, 1))}</div>
    <div class="bt"><b>${esc(x.name)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}${third ? `<span class="m">${esc(third)}</span>` : ''}
    <div class="bmeta">${chip ? `<em>${esc(chip)}</em>` : ''}${sc ? `<small>${esc(sc)}</small>` : ''}${x.auto ? '' : '<small class="own">ajouté</small>'}</div></div></button>`;
}

export function bindBible(root, sub, rerender) {
  root.addEventListener('click', async e => {
    const t = e.target;
    const s = t.closest('[data-bsub]'); if (s) return rerender(s.dataset.bsub);
    const g = t.closest('[data-genre]'); if (g) {
      const cur = bible(X.project, X.P()).film.genres, name = g.dataset.genre;
      X.project.edits['film.genres'] = (cur.includes(name) ? cur.filter(x => x !== name) : [...cur, name]).join(','); X.save(); g.classList.toggle('on'); return;
    }
    if (t.closest('[data-genre-add]')) {
      X.modal(`<h3>Autre genre</h3><input id="ng" placeholder="Ex. : Comédie musicale"><div class="row end"><button class="btn ghost" data-close>Annuler</button><button class="btn" id="ok">Ajouter</button></div>`, (bg, close) => {
        const go = () => { const v = bg.querySelector('#ng').value.trim(); if (!v) return; const cur = bible(X.project, X.P()).film.genres; X.project.edits['film.genres'] = [...new Set([...cur, v])].join(','); X.save(); close(); rerender('film'); };
        bg.querySelector('#ok').onclick = go; bg.querySelector('#ng').onkeydown = ev => { if (ev.key === 'Enter') go(); };
      }); return;
    }
    const en = t.closest('[data-ent]'); if (en) return openEntity(en.dataset.ent, () => rerender(sub));
    const ad = t.closest('[data-add-ent]'); if (ad) {
      const k = ad.dataset.addEnt, b = X.project.bible ||= {}, key = { ch: 'chars', pl: 'places', ob: 'objects' }[k];
      const id = Math.random().toString(36).slice(2, 9); (b[key] ||= []).push({ id }); X.save();
      return openEntity(k + ':c:' + id, () => rerender(sub), true);
    }
    const uh = t.closest('[data-unhide]'); if (uh) { const b = X.project.bible ||= {}; b.hidden = (b.hidden || []).filter(h => h !== uh.dataset.unhide); X.save(); rerender(sub); }
  });
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('[data-title]')) { X.project.name = el.value || 'Sans titre'; X.save(); X.onTitle && X.onTitle(); }
    if (el.matches('[data-set]')) { X.project.settings[el.dataset.set] = el.value; X.save(); }
    if (el.matches('[data-bk]')) { X.project.edits[el.dataset.bk] = el.value; X.save(); }
  });
  root.addEventListener('change', e => { const el = e.target; if (el.matches('select[data-bk]')) { X.project.edits[el.dataset.bk] = el.value; X.save(); } });
}

// ---------- Fiche personnage / lieu / objet ----------
export function openEntity(key, onClose, isNew) {
  const k = key.slice(0, 2), K = KIND[k], B = bible(X.project, X.P());
  const x = B[k].find(i => i.key === key) || B.hidden.find(i => i.key === key) || { key, name: 'Sans nom', auto: false };
  const v = f => X.project.edits[bibKey(key, f)] || '';
  const ph = v('photo');
  const roleInfo = x.role ? `<p class="note">${esc(x.role.cat)} · scènes ${x.scenes.join(', ')}</p>` : x.scenes && x.scenes.length ? `<p class="note">Scènes ${x.scenes.join(', ')}</p>` : '';
  X.modal(`<div class="row between"><h3>${K.label}</h3><button class="x" data-close>✕</button></div>
    <div class="ehead"><label class="ephoto ${k}" ${ph ? `style="background-image:url('${esc(ph)}')"` : ''}>${ph ? '' : '<span>+ Photo</span>'}<input type="file" accept="image/*" hidden></label>
    <div class="ename">${x.auto ? `<h2>${esc(x.name)}</h2><p class="note sm">Nom repris du scénario${k === 'ob' ? ' (colonne Accessoires)' : ''}.</p>` : field(bibKey(key, 'name'), 'Nom', 'text', K.label, v('name'))}${roleInfo}</div></div>
    ${k === 'ch' && x.role ? `<label class="fl">Catégorie<select data-cat="${esc(x.name)}">${['Principal', 'Secondaire', 'Silhouette', 'Figuration'].map(c => `<option ${x.role.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>` : ''}
    <div class="fgrid">${K.fields.map(([f, l, t, o]) => field(bibKey(key, f), l, t, o, v(f))).join('')}</div>
    <div class="row between ebtm">${x.auto ? `<button class="btn ghost danger-t" data-hide>Masquer cette fiche</button>` : `<button class="btn ghost danger-t" data-del>Supprimer</button>`}${ph ? '<button class="btn ghost" data-nophoto>Retirer la photo</button>' : ''}<button class="btn" data-close>OK</button></div>`,
    (bg, close) => {
      bindFields(bg);
      const done = () => { onClose && onClose(); };
      bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-close]')) done(); });
      bg.querySelector('[data-cat]')?.addEventListener('change', ev => { X.project.edits['cat.' + x.name] = ev.target.value; X.save(); X.refresh(); });
      bg.querySelector('.ephoto input').onchange = async ev => {
        const f = ev.target.files[0]; if (!f) return;
        try { const url = await X.upload(f); X.project.edits[bibKey(key, 'photo')] = url; X.save(); const l = bg.querySelector('.ephoto'); l.style.backgroundImage = `url('${url}')`; l.querySelector('span')?.remove(); }
        catch (err) { X.toast('Photo non importée : ' + esc(err.message)); }
      };
      bg.querySelector('[data-nophoto]')?.addEventListener('click', () => { delete X.project.edits[bibKey(key, 'photo')]; X.save(); close(); done(); });
      bg.querySelector('[data-hide]')?.addEventListener('click', () => { const b = X.project.bible ||= {}; b.hidden = [...new Set([...(b.hidden || []), key])]; X.save(); close(); done(); X.toast('Fiche masquée. Elle reste disponible en bas de la liste.'); });
      bg.querySelector('[data-del]')?.addEventListener('click', () => {
        const b = X.project.bible ||= {}, lk = { ch: 'chars', pl: 'places', ob: 'objects' }[k], id = key.split(':')[2];
        b[lk] = (b[lk] || []).filter(c => c.id !== id); Object.keys(X.project.edits).filter(e => e.startsWith('bib.' + key + '.')).forEach(e => delete X.project.edits[e]);
        X.save(); close(); done();
      });
      if (isNew) setTimeout(() => bg.querySelector('input[data-bk]')?.focus(), 60);
    });
}

// ---------- Fiche scène ----------
const MOMENTS = ['JOUR', 'NUIT', 'AUBE', 'MATIN', 'APRÈS-MIDI', 'SOIR', 'CRÉPUSCULE'];
export function openScene(k) {
  const P = X.P(), s = P.scenes.find(z => z.k === k); if (!s) return;
  const e = X.project.edits, ov = f => e['ov.' + k + '.' + f];
  const dayOpts = ['', ...P.days.map(d => String(d.n)), String(P.days.length + 1)];
  const val = c => (e['bd.' + k + '.' + c] ?? s.det[c]) || '';
  X.modal(`<div class="row between"><h3>Scène ${esc(s.num)}${s.epName ? ' · ' + esc(s.epName) : ''}</h3><button class="x" data-close>✕</button></div>
    <p class="note">Ces changements mettent à jour le canvas, le dépouillement, le plan de travail, les feuilles de service et le PDF. Le texte du scénario n’est pas modifié.</p>
    <label class="fl">Décor<input data-ov="decor" value="${esc(ov('decor') || s.decor)}"></label>
    <div class="row gap2">
      <div><div class="lbl">Intérieur / extérieur</div><div class="seg" data-ovseg="ie">${['INT', 'EXT', 'INT/EXT'].map(o => `<button data-v="${o}" class="${s.ie === o ? 'on' : ''}">${o}</button>`).join('')}</div></div>
      <label class="fl">Moment<select data-ov="time">${[...new Set([...MOMENTS, s.timeL.replace('?', '')])].map(o => `<option ${s.timeL.replace('?', '') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
    </div>
    <label class="fl">Résumé<textarea data-ov="summary" rows="3">${esc(s.summary)}</textarea></label>
    <div class="row gap2">
      <label class="fl">Durée (pages)<input data-bk="bd.${esc(k)}.e" value="${esc(e['bd.' + k + '.e'] ?? fmtE(s.autoE))}" placeholder="Ex. : 1 4/8"></label>
      <label class="fl">Temps estimé (min)<input data-bk="est.${esc(k)}" value="${esc(e['est.' + k] || '')}" placeholder="Auto : ${s.est} min" inputmode="numeric"></label>
    </div>
    <label class="fl">Jour de tournage<select data-day>${dayOpts.slice(1).map(o => `<option value="${o}" ${String(s.day) === o ? 'selected' : ''}>J${o}${+o === P.days.length + 1 ? ' (nouvelle journée)' : ' · ' + P.days[+o - 1].date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</option>`).join('')}</select></label>
    <details class="more-f"><summary>Éléments du dépouillement</summary><div class="fgrid">${COLS_ALL.map(([c, l]) => `<label class="fl">${l}<textarea rows="2" data-bk="bd.${esc(k)}.${c}">${esc(val(c))}</textarea></label>`).join('')}</div></details>
    <div class="row between ebtm"><div class="row"><button class="btn ghost" data-script>Voir le texte</button>${s.ovr ? '<button class="btn ghost" data-reset>Réinitialiser</button>' : ''}</div><button class="btn" data-close>OK</button></div>`,
    (bg, close) => {
      bindFields(bg, el => { if (/\.e$|^est\./.test(el.dataset.bk)) X.refresh(true); });
      const setOv = (f, v) => { if (v === '' || v == null) delete e['ov.' + k + '.' + f]; else e['ov.' + k + '.' + f] = v; X.save(); X.refresh(true); };
      bg.querySelectorAll('[data-ov]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => setOv(el.dataset.ov, el.dataset.ov === 'decor' && el.value.trim().toUpperCase() === s.decor && !ov('decor') ? '' : el.value)));
      bg.querySelector('[data-ovseg]').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; bg.querySelectorAll('[data-ovseg] button').forEach(x => x.classList.toggle('on', x === b)); setOv('ie', b.dataset.v); });
      bg.querySelector('[data-day]').addEventListener('change', ev => {
        // Déplacer la scène = passer en ordre manuel et la mettre à la fin de la journée choisie
        const target = +ev.target.value, cur = X.P();
        const days = []; let d = []; (stripOrder(e) || orderFromDays(cur.days)).forEach(t => { if (t === '|') { days.push(d); d = []; } else if (t !== k) d.push(t); }); days.push(d);
        while (days.length < target) days.push([]);
        days[target - 1].push(k);
        e['strip.order'] = JSON.stringify(days.flatMap((x, i) => (i ? ['|'] : []).concat(x)));
        Object.keys(e).filter(x => x.startsWith('day.')).forEach(x => delete e[x]);
        X.save(); X.refresh(true); X.toast('Scène déplacée au J' + target);
      });
      bg.querySelector('[data-script]').onclick = () => { close(); X.refresh(); X.gotoScene(k); };
      bg.querySelector('[data-reset]')?.addEventListener('click', () => { ['decor', 'ie', 'time', 'summary'].forEach(f => delete e['ov.' + k + '.' + f]); delete e['day.' + k]; delete e['est.' + k]; X.save(); close(); X.refresh(); X.toast('Scène remise comme dans le scénario'); });
      bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-close]')) X.refresh(); });
    });
}
