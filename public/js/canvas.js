// Canvas façon Milanote : notes, titres, to-do, images, couleurs, liens (mind map), cartes scènes, moodboard IA
import { esc, fmtE, cls } from './parser.js';

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const NOTE_COLORS = ['#ffffff', '#fff3b0', '#ffd6e0', '#d6ecff', '#d9f7d6', '#e9dcff', '#2c2c2e'];
export const STYLES = {
  cine: ['Cinéma', 'cinematic film still, 35mm lens, natural light, shallow depth of field, color graded'],
  story: ['Storyboard', 'storyboard frame, pencil sketch, black and white, rough expressive lines'],
  repe: ['Repérage', 'location scouting photograph, documentary style, wide angle, available light'],
  nb: ['Noir & blanc', 'black and white film photography, high contrast, film grain'],
  aqua: ['Aquarelle', 'watercolor concept art, soft muted palette'],
  concept: ['Concept art', 'concept art, matte painting, moody atmospheric lighting']
};
export const RATIOS = { '16:9': [1024, 576], '2.39:1': [1216, 512], '4:3': [1024, 768], '1:1': [1024, 1024], '9:16': [576, 1024] };
const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  note: I('<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>'),
  title: I('<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>'),
  todo: I('<rect x="4" y="5" width="4" height="4" rx="1"/><path d="M11 7h9"/><rect x="4" y="14" width="4" height="4" rx="1"/><path d="M11 16h9"/>'),
  image: I('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>'),
  swatch: I('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>'),
  pen: I('<path d="M4 20l1.2-4.6L16.5 4.1a2 2 0 0 1 2.9 0l.5.5a2 2 0 0 1 0 2.9L8.6 18.8z"/><path d="M14.5 6l3.5 3.5"/><path d="M13 20h7"/>'),
  gen: I('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  scenes: I('<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="6" rx="1.5"/>')
};

export class Board {
  constructor(root, o) {
    this.root = root; this.o = o;
    const c = o.project.canvas || (o.project.canvas = {});
    c.items ??= []; c.links ??= []; c.view ??= { x: 130, y: 90, z: 1 };
    this.c = c; this.sel = new Set(); this.selLink = null; this.undo = []; this.redo = [];
    this.ptrs = new Map(); this.mode = null; this.editing = null;
    this.build();
  }
  get P() { return this.o.getP(); }
  get v() { return this.c.view; }
  save() { this.o.onChange(); }
  snap() { this.undo.push(JSON.stringify({ items: this.c.items, links: this.c.links })); if (this.undo.length > 80) this.undo.shift(); this.redo = []; }
  restore(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify({ items: this.c.items, links: this.c.links }));
    const s = JSON.parse(from.pop()); this.c.items = s.items; this.c.links = s.links;
    this.sel.clear(); this.selLink = null; this.render(); this.save();
  }
  byId(id) { return this.c.items.find(i => i.id === id); }

  build() {
    this.root.innerHTML = `<div class="board">
      <div class="tools">
        <button data-add="note" title="Note (N)">${ICON.note}<span>Note</span></button>
        <button data-add="title" title="Titre (T)">${ICON.title}<span>Titre</span></button>
        <button data-add="todo" title="Liste">${ICON.todo}<span>To-do</span></button>
        <label class="tb" title="Importer une image">${ICON.image}<span>Image</span><input type="file" accept="image/*" multiple hidden></label>
        <button data-add="swatch" title="Couleur de référence">${ICON.swatch}<span>Couleur</span></button>
        <button data-ink title="Note manuscrite (stylet)">${ICON.pen}<span>Stylo</span></button>
        <div class="sep"></div>
        <button data-gen title="Moodboard AI">${ICON.gen}<span>Moodboard AI</span></button>
        <button data-arrange title="Remettre les cartes scènes en grille">${ICON.scenes}<span>Ranger scènes</span></button>
      </div>
      <div class="vp" tabindex="0"><div class="world"><svg class="links"><defs><marker id="arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs><g class="lk"></g><path class="tmp hidden"/></svg><div class="layer"></div></div><div class="selbox hidden"></div></div>
      <div class="ctx hidden"></div>
      <div class="zoom"><button data-z="-" title="Dézoomer">−</button><button data-z="fit" class="zv" title="Tout afficher">100%</button><button data-z="+" title="Zoomer">+</button></div>
      <div class="hint">Double-clic : note · Tab : idée liée · Glisser ● pour relier · Ctrl/⌘ + molette : zoom · Glisser une image ici</div>
    </div>`;
    const q = s => this.root.querySelector(s);
    this.vp = q('.vp'); this.world = q('.world'); this.layer = q('.layer'); this.lk = q('.lk'); this.tmp = q('.tmp');
    this.ctx = q('.ctx'); this.selbox = q('.selbox'); this.zv = q('.zv');
    this.root.querySelector('.tools').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.add) this.addAtCenter(b.dataset.add);
      if ('gen' in b.dataset) { const it = this.firstSel(); this.o.openAI(it && it.type === 'scene' ? { mode: 'scene', sceneKey: it.sceneKey, anchorId: it.id } : {}); }
      if ('ink' in b.dataset) this.o.openInk(r => this.addInk(r));
      if ('arrange' in b.dataset) { this.snap(); this.arrangeScenes(true); this.render(); this.save(); }
    });
    q('.tools input[type=file]').addEventListener('change', e => { this.upload([...e.target.files], this.center()); e.target.value = ''; });
    q('.zoom').addEventListener('click', e => {
      const z = e.target.closest('button')?.dataset.z; if (!z) return;
      if (z === 'fit') return this.fit();
      const r = this.vp.getBoundingClientRect(); this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, z === '+' ? 1.2 : 1 / 1.2);
    });
    this.ctx.addEventListener('click', e => this.ctxAction(e));
    this.ctx.addEventListener('input', e => {
      if (e.target.type === 'color') { const it = this.firstSel(); if (it) { it.color = e.target.value; this.render(); this.save(); } }
    });
    const vp = this.vp;
    vp.addEventListener('pointerdown', e => this.down(e));
    vp.addEventListener('pointermove', e => this.move(e));
    vp.addEventListener('pointerup', e => this.up(e));
    vp.addEventListener('pointercancel', e => this.up(e));
    vp.addEventListener('wheel', e => this.wheel(e), { passive: false });
    vp.addEventListener('dblclick', e => this.dbl(e));
    vp.addEventListener('dragover', e => { e.preventDefault(); vp.classList.add('drop'); });
    vp.addEventListener('dragleave', () => vp.classList.remove('drop'));
    vp.addEventListener('drop', e => {
      e.preventDefault(); vp.classList.remove('drop');
      const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'));
      if (files.length) this.upload(files, this.toWorld(e.clientX, e.clientY));
    });
    this.layer.addEventListener('input', e => this.textInput(e));
    this.layer.addEventListener('change', e => this.layerChange(e));
    this.layer.addEventListener('click', e => this.layerClick(e));
    this.layer.addEventListener('focusout', e => { if (e.target.isContentEditable) this.endEdit(); });
    this.onKey = e => this.key(e); this.onPaste = e => this.paste(e);
    window.addEventListener('keydown', this.onKey); window.addEventListener('paste', this.onPaste);
    this.ro = new ResizeObserver(() => this.drawLinks()); this.ro.observe(this.layer);
    this.syncScenes();
    const first = !this.c.init;
    if (first) { this.c.init = true; this.arrangeScenes(false); this.save(); }
    this.applyView(); this.render();
    if (first) setTimeout(() => {
      if (innerWidth < 600 && this.c.items.some(i => i.type === 'scene')) {
        const sc = this.c.items.filter(i => i.type === 'scene'), r = this.vp.getBoundingClientRect();
        const x0 = Math.min(...sc.map(i => i.x)), y0 = Math.min(...sc.map(i => i.y)), z = Math.min(1, (r.width - 40) / 270);
        Object.assign(this.v, { z, x: 20 - x0 * z, y: 20 - y0 * z }); this.applyView(); this.saveView();
      } else this.fit();
    }, 80);
  }
  destroy() { window.removeEventListener('keydown', this.onKey); window.removeEventListener('paste', this.onPaste); this.ro?.disconnect(); }

  // ---------- Vue ----------
  applyView() { const v = this.v; this.world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`; this.zv.textContent = Math.round(v.z * 100) + '%'; this.placeCtx(); }
  toWorld(cx, cy) { const r = this.vp.getBoundingClientRect(), v = this.v; return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }; }
  center() { const r = this.vp.getBoundingClientRect(); return this.toWorld(r.left + r.width / 2, r.top + r.height / 2); }
  zoomAt(cx, cy, f) {
    const v = this.v, r = this.vp.getBoundingClientRect(), nz = Math.min(3, Math.max(0.15, v.z * f));
    const px = cx - r.left, py = cy - r.top;
    v.x = px - (px - v.x) * (nz / v.z); v.y = py - (py - v.y) * (nz / v.z); v.z = nz;
    this.applyView(); this.saveView();
  }
  saveView() { clearTimeout(this.vt); this.vt = setTimeout(() => this.save(), 600); }
  size(it) { const el = this.el(it.id); return { w: el ? el.offsetWidth : (it.w || 240), h: el ? el.offsetHeight : 120 }; }
  el(id) { return this.layer.querySelector(`.it[data-id="${id}"]`); }
  bbox(items) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    items.forEach(it => { const s = this.size(it); x1 = Math.min(x1, it.x); y1 = Math.min(y1, it.y); x2 = Math.max(x2, it.x + s.w); y2 = Math.max(y2, it.y + s.h); });
    return { x1, y1, x2, y2 };
  }
  fit() {
    if (!this.c.items.length) { Object.assign(this.v, { x: 130, y: 90, z: 1 }); return this.applyView(); }
    const b = this.bbox(this.c.items), r = this.vp.getBoundingClientRect(), pad = 50;
    const left = innerWidth > 820 ? 100 : 0, bottom = innerWidth > 820 ? 0 : 80, W = r.width - left, H = r.height - bottom;
    const z = Math.min(1.2, Math.max(0.15, Math.min((W - pad * 2) / (b.x2 - b.x1 || 1), (H - pad * 2) / (b.y2 - b.y1 || 1))));
    Object.assign(this.v, { z, x: left + (W - (b.x2 - b.x1) * z) / 2 - b.x1 * z, y: (H - (b.y2 - b.y1) * z) / 2 - b.y1 * z });
    this.applyView(); this.saveView();
  }

  // ---------- Scènes ----------
  syncScenes() {
    const P = this.P; let added = 0;
    const cards = () => this.c.items.filter(i => i.type === 'scene');
    P.scenes.forEach((s, i) => {
      if (cards().some(c => c.sceneKey === s.k)) return;
      const prevCard = P.scenes.slice(0, i).reverse().map(p => cards().find(c => c.sceneKey === p.k)).find(Boolean);
      const pos = prevCard ? { x: prevCard.x + 290, y: prevCard.y } : (() => { const a = cards(); if (!a.length) return { x: 0, y: 0 }; const b = this.bbox(a); return { x: b.x1, y: b.y2 + 40 }; })();
      while (cards().some(c => Math.abs(c.x - pos.x) < 40 && Math.abs(c.y - pos.y) < 40)) pos.y += 260;
      this.c.items.push({ id: uid(), type: 'scene', sceneKey: s.k, x: pos.x, y: pos.y, w: 260 });
      added++;
    });
    return added;
  }
  arrangeScenes(all) {
    const P = this.P, cards = this.c.items.filter(i => i.type === 'scene');
    if (!cards.length) return;
    const ox = all ? Math.min(...cards.map(c => c.x)) : 0, oy = all ? Math.min(...cards.map(c => c.y)) : 0;
    const order = P.scenes.map(s => cards.find(c => c.sceneKey === s.k)).filter(Boolean);
    cards.filter(c => !order.includes(c)).forEach(c => order.push(c));
    const per = innerWidth < 600 ? 1 : 5;
    order.forEach((c, i) => { c.x = ox + (i % per) * 290; c.y = oy + Math.floor(i / per) * (per === 1 ? 200 : 270); });
  }
  sceneOf(it) { return this.P.scenes.find(s => s.k === it.sceneKey); }

  // ---------- Rendu ----------
  render() {
    const added = this.syncScenes(); if (added) this.save();
    this.layer.innerHTML = this.c.items.map(it => this.itemHtml(it)).join('');
    if (this.editing) { const f = this.layer.querySelector(`.it[data-id="${this.editing.id}"] [data-f="${this.editing.f}"]${this.editing.ti != null ? `[data-ti="${this.editing.ti}"]` : ''}`); if (f) { f.contentEditable = 'true'; } }
    requestAnimationFrame(() => { this.measure(); this.drawLinks(); this.placeCtx(); });
  }
  measure() { this.c.items.forEach(it => { const el = this.el(it.id); if (el && el.offsetHeight) it.h = el.offsetHeight; }); }
  itemHtml(it) {
    const s = this.sel.has(it.id) ? ' sel' : '';
    const st = `left:${it.x}px;top:${it.y}px;${it.w ? `width:${it.w}px;` : ''}`;
    let inner = '', extra = '', style = '';
    switch (it.type) {
      case 'note': {
        const dark = it.color === '#2c2c2e';
        style = `background:${it.color || '#fff'};${dark ? 'color:#f2f2f7;' : ''}`;
        inner = `<div class="txt" data-f="text" data-ph="Écrivez…">${esc(it.text || '')}</div>`; break;
      }
      case 'title': inner = `<div class="txt" data-f="text" data-ph="Titre">${esc(it.text || '')}</div>`; break;
      case 'todo': inner = `<div class="txt tt" data-f="title" data-ph="Liste">${esc(it.title || '')}</div><ul>${(it.tasks || []).map((t, i) => `<li class="${t.done ? 'done' : ''}"><input type="checkbox" data-ti="${i}" ${t.done ? 'checked' : ''}><span class="txt" data-f="task" data-ti="${i}" data-ph="Tâche">${esc(t.t)}</span></li>`).join('')}</ul><button class="addt">+ Tâche</button>`; break;
      case 'image': inner = `<img src="${esc(it.src)}" draggable="false" alt=""><div class="txt cap" data-f="caption" data-ph="Légende">${esc(it.caption || '')}</div>${it.prompt ? `<div class="pr" title="${esc(it.prompt)}">IA · ${esc(it.prompt.slice(0, 60))}${it.prompt.length > 60 ? '…' : ''}</div>` : ''}`; break;
      case 'swatch': inner = `<div class="chip" style="background:${esc(it.color || '#ff9f0a')}"></div><div class="txt" data-f="label" data-ph="Nom de la couleur">${esc(it.label || '')}</div><div class="hex">${esc((it.color || '').toUpperCase())}</div>`; break;
      case 'scene': {
        const sc = this.sceneOf(it);
        if (!sc) { extra = ' gone'; inner = `<div class="sch">Scène retirée du scénario</div><div class="scb"><p>Cette scène n’existe plus dans le texte. Vous pouvez supprimer la carte ou la garder comme archive.</p><button class="btn sm ghost" data-act="del">Supprimer la carte</button></div>`; break; }
        extra = ' ' + cls(sc);
        inner = `<div class="sch"><b>${esc(sc.num)}</b><span>${sc.ie} ${esc(sc.timeL)}</span><span class="dd">J${sc.day} · ${fmtE(sc.e)} p.</span></div>
          <div class="scb"><div class="dc">${esc(sc.decor)}</div><p>${esc(sc.summary || '')}</p>
          <div class="chips">${sc.roles.map(r => `<span class="${r.speak.has(sc.idx) ? '' : 'mute'}">${esc(r.name)}</span>`).join('')}</div></div>`;
        break;
      }
    }
    return `<div class="it ${it.type}${extra}${s}" data-id="${it.id}" style="${st}${style}">${inner}<i class="knob" title="Glisser pour relier"></i><i class="rs" title="Redimensionner"></i></div>`;
  }
  anchor(a, b) {
    const sa = this.size(a), sb = this.size(b);
    const ca = { x: a.x + sa.w / 2, y: a.y + sa.h / 2 }, cb = { x: b.x + sb.w / 2, y: b.y + sb.h / 2 };
    const dx = cb.x - ca.x, dy = cb.y - ca.y;
    if (Math.abs(dx) * 0.7 > Math.abs(dy)) {
      const s = Math.sign(dx) || 1;
      return [{ x: ca.x + s * sa.w / 2, y: ca.y }, { x: cb.x - s * sb.w / 2, y: cb.y }, 'h'];
    }
    const s = Math.sign(dy) || 1;
    return [{ x: ca.x, y: ca.y + s * sa.h / 2 }, { x: cb.x, y: cb.y - s * sb.h / 2 }, 'v'];
  }
  curve(p, q, dir) {
    const k = dir === 'h' ? Math.max(40, Math.abs(q.x - p.x) / 2) : Math.max(40, Math.abs(q.y - p.y) / 2);
    const sx = dir === 'h' ? Math.sign(q.x - p.x) || 1 : 0, sy = dir === 'v' ? Math.sign(q.y - p.y) || 1 : 0;
    return `M${p.x},${p.y} C${p.x + sx * k},${p.y + sy * k} ${q.x - sx * k},${q.y - sy * k} ${q.x},${q.y}`;
  }
  drawLinks() {
    this.c.links = this.c.links.filter(l => this.byId(l.from) && this.byId(l.to));
    this.lk.innerHTML = this.c.links.map(l => {
      const [p, q, dir] = this.anchor(this.byId(l.from), this.byId(l.to)); const d = this.curve(p, q, dir);
      return `<g data-link="${l.id}" class="${this.selLink === l.id ? 'on' : ''}"><path class="hit" d="${d}"/><path class="ln" d="${d}" marker-end="url(#arw)"/></g>`;
    }).join('');
  }

  // ---------- Barre contextuelle ----------
  firstSel() { const id = [...this.sel][0]; return id ? this.byId(id) : null; }
  placeCtx() {
    const items = [...this.sel].map(id => this.byId(id)).filter(Boolean);
    if (!items.length || this.mode === 'drag') { this.ctx.classList.add('hidden'); return; }
    const one = items.length === 1 ? items[0] : null;
    let h = '';
    if (one?.type === 'note') h += NOTE_COLORS.map(c => `<button class="dot" data-color="${c}" style="background:${c}"></button>`).join('') + '<span class="vs"></span>';
    if (one?.type === 'swatch') h += `<label class="cbtn">Couleur<input type="color" value="${esc(one.color || '#ff9f0a')}"></label><span class="vs"></span>`;
    if (one?.type === 'scene' && this.sceneOf(one)) h += `<button data-act="editscene">Modifier</button><button data-act="gen">✦ Moodboard AI</button><button data-act="script">Texte</button><span class="vs"></span>`;
    if (one?.type === 'image' && one.prompt) h += `<button data-act="regen">↻ Variante</button><span class="vs"></span>`;
    if (one && ['note', 'title', 'todo', 'swatch', 'image'].includes(one.type)) h += `<button data-act="edit">Écrire</button>`;
    if (one) h += `<button data-act="child" title="Tab">+ Idée liée</button>`;
    h += `<button data-act="dup" title="Ctrl/⌘ D">Dupliquer</button><button data-act="del" class="danger" title="Suppr">Supprimer</button>`;
    this.ctx.innerHTML = h;
    const b = this.bbox(items), v = this.v, r = this.vp.getBoundingClientRect(), rr = this.root.getBoundingClientRect();
    this.ctx.classList.remove('hidden');
    const cw = this.ctx.offsetWidth;
    let left = r.left - rr.left + v.x + ((b.x1 + b.x2) / 2) * v.z - cw / 2;
    let top = r.top - rr.top + v.y + b.y1 * v.z - 52;
    if (top < 8) top = r.top - rr.top + v.y + b.y2 * v.z + 12;
    left = Math.max(8, Math.min(rr.width - cw - 8, left));
    this.ctx.style.left = left + 'px'; this.ctx.style.top = top + 'px';
  }
  ctxAction(e) {
    const b = e.target.closest('button'); if (!b) return;
    const one = this.firstSel();
    if (b.dataset.color && one) { this.snap(); one.color = b.dataset.color; this.render(); this.save(); return; }
    const a = b.dataset.act;
    if (a === 'del') this.deleteSel();
    if (a === 'dup') this.duplicate();
    if (a === 'child' && one) this.child(one);
    if (a === 'gen' && one) this.o.openAI({ mode: 'scene', sceneKey: one.sceneKey, anchorId: one.id });
    if (a === 'regen' && one) { const l = this.c.links.find(x => x.to === one.id || x.from === one.id), o = l && this.byId(l.from === one.id ? l.to : l.from); this.o.openAI({ mode: 'scene', sceneKey: o && o.type === 'scene' ? o.sceneKey : null, prompt: one.prompt, anchorId: one.id }); }
    if (a === 'script' && one) this.o.gotoScene(one.sceneKey);
    if (a === 'editscene' && one) this.o.editScene(one.sceneKey);
    if (a === 'edit' && one) { const f = this.el(one.id)?.querySelector('[data-f]'); if (f) this.startEdit(one.id, f.dataset.f, f.dataset.ti != null ? +f.dataset.ti : null); }
  }

  // ---------- Création ----------
  make(type, x, y, extra = {}) {
    const base = { id: uid(), type, x: Math.round(x), y: Math.round(y) };
    const def = { note: { w: 240, text: '', color: '#ffffff' }, title: { w: 420, text: '' }, todo: { w: 260, title: 'À faire', tasks: [{ t: '', done: false }] }, swatch: { w: 160, color: '#ff9f0a', label: '' }, image: { w: 300 } }[type] || {};
    return { ...base, ...def, ...extra };
  }
  freeSpot(x, y, w, h) {
    const hit = (px, py) => this.c.items.some(it => { const s = this.size(it); return it.x < px + w && it.x + s.w > px && it.y < py + h && it.y + s.h > py; });
    for (let i = 0; i < 120; i++) { const px = x + (i % 4) * (w + 30), py = y + Math.floor(i / 4) * (h + 30); if (!hit(px, py)) return { x: px, y: py }; }
    return { x, y };
  }
  addAtCenter(type) {
    const c = this.center(), w = { title: 420, swatch: 160 }[type] || 250;
    const p = this.freeSpot(c.x - w / 2, c.y - 60, w, type === 'swatch' ? 150 : 110); this.add(type, p.x, p.y);
  }
  add(type, x, y, extra) {
    this.snap(); const it = this.make(type, x, y, extra); this.c.items.push(it); this.fresh = it.id;
    this.sel = new Set([it.id]); this.selLink = null; this.render(); this.save();
    if (['note', 'title', 'todo', 'swatch'].includes(type)) setTimeout(() => this.startEdit(it.id, type === 'todo' ? 'task' : type === 'swatch' ? 'label' : 'text', type === 'todo' ? 0 : null), 30);
    return it;
  }
  child(parent) {
    const ps = this.size(parent);
    const kids = this.c.links.filter(l => l.from === parent.id).map(l => this.byId(l.to)).filter(Boolean);
    const y = kids.length ? Math.max(...kids.map(k => k.y + this.size(k).h)) + 24 : parent.y;
    this.snap();
    const it = this.make('note', parent.x + ps.w + 90, y); this.c.items.push(it); this.fresh = it.id;
    this.c.links.push({ id: uid(), from: parent.id, to: it.id });
    this.sel = new Set([it.id]); this.render(); this.save();
    setTimeout(() => this.startEdit(it.id, 'text'), 30);
  }
  duplicate() {
    if (!this.sel.size) return; this.snap();
    const map = {}, news = [];
    [...this.sel].map(id => this.byId(id)).filter(it => it && it.type !== 'scene').forEach(it => {
      const n = { ...structuredClone(it), id: uid(), x: it.x + 30, y: it.y + 30 }; map[it.id] = n.id; news.push(n);
    });
    this.c.items.push(...news);
    this.c.links.filter(l => map[l.from] && map[l.to]).forEach(l => this.c.links.push({ id: uid(), from: map[l.from], to: map[l.to] }));
    this.sel = new Set(news.map(n => n.id)); this.render(); this.save();
  }
  deleteSel() {
    if (this.selLink) { this.snap(); this.c.links = this.c.links.filter(l => l.id !== this.selLink); this.selLink = null; this.render(); this.save(); return; }
    if (!this.sel.size) return;
    const ids = [...this.sel].filter(id => { const it = this.byId(id); return it && !(it.type === 'scene' && this.sceneOf(it)); });
    const blocked = this.sel.size - ids.length;
    if (blocked) this.o.toast('Les cartes scènes suivent le scénario : supprimez la scène dans le texte pour les retirer.');
    if (!ids.length) return;
    this.snap();
    this.c.items = this.c.items.filter(i => !ids.includes(i.id));
    this.c.links = this.c.links.filter(l => !ids.includes(l.from) && !ids.includes(l.to));
    this.sel.clear(); this.render(); this.save();
  }
  // Résultat du stylo : note texte et/ou croquis manuscrit, au centre de la vue
  async addInk({ text, img }) {
    const c = this.center();
    let note = null;
    if (text) { this.snap(); const p = this.freeSpot(c.x - 130, c.y - 60, 260, 120); note = this.make('note', p.x, p.y, { text, w: 260 }); this.c.items.push(note); this.sel = new Set([note.id]); this.render(); this.save(); }
    if (img) {
      const blob = await (await fetch(img)).blob(), n0 = this.c.items.length;
      await this.upload([new File([blob], 'note.jpg', { type: 'image/jpeg' })], note ? { x: note.x + 150, y: note.y + this.size(note).h + 140 } : c);
      const im = this.c.items[n0]; if (note && im && im.type === 'image') { this.c.links.push({ id: uid(), from: note.id, to: im.id }); this.render(); this.save(); }
    }
    this.o.toast(text ? 'Note ajoutée au canvas' : 'Croquis ajouté au canvas');
  }
  async upload(files, at) {
    for (const f of files) {
      try {
        const r = await fetch(`/api/projects/${this.o.project.id}/assets`, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
        const j = await r.json(); if (!r.ok) throw new Error(j.error);
        const p = this.freeSpot(at.x - 150, at.y - 100, 300, 200);
        this.snap(); const it = this.make('image', p.x, p.y, { src: j.url, caption: '' }); this.c.items.push(it);
        this.sel = new Set([it.id]); this.render(); this.save();
        await new Promise(r => requestAnimationFrame(() => setTimeout(r, 60)));
      } catch (e) { this.o.toast('Image non importée : ' + e.message); }
    }
  }

  // ---------- Édition de texte ----------
  startEdit(id, f, ti = null) {
    const sel = `.it[data-id="${id}"] [data-f="${f}"]` + (ti != null ? `[data-ti="${ti}"]` : '');
    const node = this.layer.querySelector(sel); if (!node) return;
    if (this.fresh !== id) this.snap(); this.fresh = null; this.editing = { id, f, ti };
    node.contentEditable = 'true'; node.focus();
    const r = document.createRange(); r.selectNodeContents(node); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    this.ctx.classList.add('hidden');
  }
  endEdit() {
    const e = this.editing; if (!e) return;
    this.editing = null;
    this.layer.querySelectorAll('[contenteditable="true"]').forEach(n => n.contentEditable = 'false');
    const it = this.byId(e.id);
    if (it && it.type === 'note' && !it.text.trim() && !this.c.links.some(l => l.from === it.id || l.to === it.id)) {
      this.c.items = this.c.items.filter(x => x !== it); this.sel.delete(it.id); this.render();
    } else this.placeCtx();
    this.save();
  }
  textInput(e) {
    const node = e.target; if (!node.dataset?.f) return;
    const it = this.byId(node.closest('.it').dataset.id); if (!it) return;
    const val = node.innerText.replace(/\n$/, '');
    if (!node.innerText.trim() && node.innerHTML !== '') node.innerHTML = '';
    const f = node.dataset.f;
    if (f === 'task') it.tasks[+node.dataset.ti].t = val; else it[f] = val;
    this.drawLinks(); this.save();
  }
  layerChange(e) {
    if (e.target.type === 'checkbox') {
      const it = this.byId(e.target.closest('.it').dataset.id); this.snap();
      it.tasks[+e.target.dataset.ti].done = e.target.checked; this.render(); this.save();
    }
  }
  layerClick(e) {
    const it = e.target.closest('.it'); if (!it) return;
    const item = this.byId(it.dataset.id);
    if (e.target.closest('.addt')) { this.snap(); item.tasks.push({ t: '', done: false }); this.render(); this.save(); setTimeout(() => this.startEdit(item.id, 'task', item.tasks.length - 1), 30); }
    if (e.target.closest('[data-act="del"]')) { this.sel = new Set([item.id]); this.snap(); this.c.items = this.c.items.filter(x => x !== item); this.sel.clear(); this.render(); this.save(); }
  }
  dbl(e) {
    if (e instanceof Event && this.touchDbl && Date.now() - this.touchDbl < 600) return;
    if (e.target.closest?.('.ctx,.tools,.zoom')) return;
    const itEl = e.target.closest('.it');
    if (!itEl) { const p = this.toWorld(e.clientX, e.clientY); this.add('note', p.x - 20, p.y - 20); return; }
    const it = this.byId(itEl.dataset.id);
    if (it.type === 'scene') { if (this.sceneOf(it)) this.o.gotoScene(it.sceneKey); return; }
    if (it.type === 'swatch' && !e.target.closest('.txt')) { this.sel = new Set([it.id]); this.placeCtx(); this.ctx.querySelector('input[type=color]')?.click(); return; }
    const f = e.target.closest('[data-f]');
    if (f) this.startEdit(it.id, f.dataset.f, f.dataset.ti != null ? +f.dataset.ti : null);
    else { const first = itEl.querySelector('[data-f]'); if (first) this.startEdit(it.id, first.dataset.f, first.dataset.ti != null ? +first.dataset.ti : null); }
  }

  // ---------- Pointeur ----------
  down(e) {
    if (e.button === 2) return;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.mode = 'pinch'; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; return; }
    const t = e.target;
    if (t.isContentEditable || t.closest('input,button,select,label,a')) return;
    if (this.editing) this.endEdit();
    const itEl = t.closest('.it'), lk = t.closest('[data-link]');
    this.start = { x: e.clientX, y: e.clientY, moved: false };
    if (t.classList.contains('knob') && itEl) {
      this.mode = 'link'; this.linkFrom = itEl.dataset.id; this.vp.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (t.classList.contains('rs') && itEl) {
      const it = this.byId(itEl.dataset.id); this.mode = 'resize'; this.rs = { it, w: itEl.offsetWidth }; this.vp.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (itEl) {
      const id = itEl.dataset.id;
      if (e.shiftKey || e.metaKey || e.ctrlKey) { this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id); }
      else if (!this.sel.has(id)) this.sel = new Set([id]);
      this.selLink = null;
      this.layer.querySelectorAll('.it').forEach(n => n.classList.toggle('sel', this.sel.has(n.dataset.id)));
      this.drawLinks();
      this.mode = 'drag'; this.orig = [...this.sel].map(i => { const it = this.byId(i); return { it, x: it.x, y: it.y }; });
      this.vp.setPointerCapture(e.pointerId); return;
    }
    if (lk) { this.sel.clear(); this.selLink = lk.dataset.link; this.render(); return; }
    this.sel.clear(); this.selLink = null;
    this.layer.querySelectorAll('.it.sel').forEach(n => n.classList.remove('sel')); this.drawLinks(); this.placeCtx();
    this.vp.setPointerCapture(e.pointerId);
    if (e.shiftKey) { this.mode = 'box'; this.boxStart = this.toWorld(e.clientX, e.clientY); }
    else { this.mode = 'pan'; this.panStart = { x: this.v.x, y: this.v.y }; this.vp.classList.add('panning'); }
  }
  move(e) {
    if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.mode === 'pinch' && this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinch.d); this.pinch.d = d; return;
    }
    if (!this.mode || !this.start) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    if (!this.start.moved && Math.hypot(dx, dy) < 3) return;
    const first = !this.start.moved; this.start.moved = true;
    const z = this.v.z;
    if (this.mode === 'pan') { this.v.x = this.panStart.x + dx; this.v.y = this.panStart.y + dy; this.applyView(); }
    else if (this.mode === 'drag') {
      if (first) { this.snap(); this.ctx.classList.add('hidden'); }
      this.orig.forEach(o => { o.it.x = Math.round(o.x + dx / z); o.it.y = Math.round(o.y + dy / z); const n = this.el(o.it.id); if (n) { n.style.left = o.it.x + 'px'; n.style.top = o.it.y + 'px'; } });
      this.drawLinks();
    } else if (this.mode === 'resize') {
      if (first) this.snap();
      const min = { swatch: 110, title: 140 }[this.rs.it.type] || 160;
      this.rs.it.w = Math.max(min, Math.round(this.rs.w + dx / z)); const n = this.el(this.rs.it.id); if (n) n.style.width = this.rs.it.w + 'px';
      this.drawLinks(); this.placeCtx();
    } else if (this.mode === 'link') {
      const a = this.byId(this.linkFrom), s = this.size(a), p = this.toWorld(e.clientX, e.clientY);
      const from = { x: a.x + s.w, y: a.y + s.h / 2 };
      this.tmp.classList.remove('hidden'); this.tmp.setAttribute('d', this.curve(from, p, 'h'));
    } else if (this.mode === 'box') {
      const p = this.toWorld(e.clientX, e.clientY), b = this.boxStart, v = this.v;
      const x1 = Math.min(p.x, b.x), y1 = Math.min(p.y, b.y), x2 = Math.max(p.x, b.x), y2 = Math.max(p.y, b.y);
      Object.assign(this.selbox.style, { left: v.x + x1 * z + 'px', top: v.y + y1 * z + 'px', width: (x2 - x1) * z + 'px', height: (y2 - y1) * z + 'px' });
      this.selbox.classList.remove('hidden');
      this.sel = new Set(this.c.items.filter(it => { const s = this.size(it); return it.x < x2 && it.x + s.w > x1 && it.y < y2 && it.y + s.h > y1; }).map(it => it.id));
      this.layer.querySelectorAll('.it').forEach(n => n.classList.toggle('sel', this.sel.has(n.dataset.id)));
    }
  }
  up(e) {
    this.ptrs.delete(e.pointerId);
    if (e.pointerType !== 'mouse' && this.mode !== 'pinch' && this.start && !this.start.moved && this.mode !== 'link') {
      const now = Date.now(), t = this.lastTap;
      if (t && now - t.time < 320 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) {
        this.lastTap = null; this.touchDbl = now;
        const target = document.elementFromPoint(e.clientX, e.clientY) || this.vp;
        setTimeout(() => this.dbl({ target, clientX: e.clientX, clientY: e.clientY }), 0);
      } else this.lastTap = { time: now, x: e.clientX, y: e.clientY };
    }
    if (this.mode === 'pinch') { if (this.ptrs.size < 2) this.mode = null; return; }
    const m = this.mode, moved = this.start?.moved; this.mode = null; this.vp.classList.remove('panning');
    if (m === 'pan' && moved) this.saveView();
    if ((m === 'drag' || m === 'resize') && moved) { this.save(); this.placeCtx(); }
    if (m === 'drag' && !moved) this.placeCtx();
    if (m === 'box') { this.selbox.classList.add('hidden'); this.placeCtx(); }
    if (m === 'link') {
      this.tmp.classList.add('hidden');
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.it');
      if (target && target.dataset.id !== this.linkFrom && !this.c.links.some(l => (l.from === this.linkFrom && l.to === target.dataset.id))) {
        this.snap(); this.c.links.push({ id: uid(), from: this.linkFrom, to: target.dataset.id }); this.drawLinks(); this.save();
      } else if (!target && moved) {
        const p = this.toWorld(e.clientX, e.clientY); this.snap();
        const it = this.make('note', p.x, p.y - 30); this.c.items.push(it); this.c.links.push({ id: uid(), from: this.linkFrom, to: it.id });
        this.sel = new Set([it.id]); this.render(); this.save(); setTimeout(() => this.startEdit(it.id, 'text'), 30);
      }
    }
    this.start = null;
  }
  wheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
    else { this.v.x -= e.deltaX; this.v.y -= e.deltaY; this.applyView(); this.saveView(); }
  }
  visible() { return this.root.isConnected && this.root.offsetParent !== null && !document.querySelector('.modal-bg'); }
  key(e) {
    if (!this.visible()) return;
    const a = document.activeElement;
    const typing = a && (a.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(a.tagName));
    if (typing) { if (e.key === 'Escape' || (e.key === 'Tab' && this.editing)) { e.preventDefault(); const id = this.editing?.id; a.blur(); this.endEdit(); if (e.key === 'Tab' && id && this.byId(id)) this.child(this.byId(id)); } return; }
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? this.restore(this.redo, this.undo) : this.restore(this.undo, this.redo); return; }
    if (mod && k === 'y') { e.preventDefault(); this.restore(this.redo, this.undo); return; }
    if (mod && k === 'd') { e.preventDefault(); this.duplicate(); return; }
    if (mod && k === 'a') { e.preventDefault(); this.sel = new Set(this.c.items.map(i => i.id)); this.render(); return; }
    if (mod) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSel(); }
    else if (e.key === 'Escape') { this.sel.clear(); this.selLink = null; this.render(); }
    else if (e.key === 'Tab') { e.preventDefault(); const it = this.firstSel(); if (it) this.child(it); }
    else if (e.key === 'Enter') { const it = this.firstSel(); if (it) { e.preventDefault(); const f = this.el(it.id)?.querySelector('[data-f]'); if (f) this.startEdit(it.id, f.dataset.f, f.dataset.ti != null ? +f.dataset.ti : null); } }
    else if (k === 'n') { e.preventDefault(); this.addAtCenter('note'); }
    else if (k === 't') { e.preventDefault(); this.addAtCenter('title'); }
  }
  paste(e) {
    if (!this.visible()) return;
    const a = document.activeElement; if (a && (a.isContentEditable || /INPUT|TEXTAREA/.test(a.tagName))) return;
    const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); this.upload(files, this.center()); return; }
    const txt = e.clipboardData?.getData('text/plain');
    if (txt) { e.preventDefault(); const c = this.center(), sp = this.freeSpot(c.x - 120, c.y - 40, 250, 110); this.snap(); const it = this.make('note', sp.x, sp.y, { text: txt.slice(0, 4000) }); this.c.items.push(it); this.sel = new Set([it.id]); this.render(); this.save(); }
  }

}
