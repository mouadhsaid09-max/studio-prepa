// Notes manuscrites : écrire au stylet (Apple Pencil, S Pen…), au doigt ou à la souris,
// puis garder le croquis ou le transformer en texte propre (reconnaissance d'écriture du système, sinon IA de vision).
import { LANG, tr } from './i18n.js';

const COLORS = ['#1d1d1f', '#ff9f0a', '#0a84ff', '#ff3b30'];
const SIZES = [[1.6, 'Fin'], [2.8, 'Moyen'], [5, 'Épais']];
const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* rien */ } } };

// o : { modal, toast, vision(prompt, dataUrl, signal) → texte, onAdd({ text, img }) }
export function openInk(o) {
  const st = { strokes: [], undone: [], color: COLORS[0], size: +(LS.get('sp.inksize') || 2.8), erase: false, penOnly: LS.get('sp.penonly') === '1', lines: LS.get('sp.inklines') !== '0', cur: null, busy: null };
  o.modal(`<div class="row between"><h3>✍ Note manuscrite</h3><button class="x" data-close>✕</button></div>
    <div class="ink-tools">
      <div class="ink-g">${COLORS.map(c => `<button class="ink-c" data-c="${c}" style="--c:${c}" title="${c}"></button>`).join('')}</div>
      <div class="ink-g">${SIZES.map(([w, l]) => `<button class="ink-s" data-s="${w}" title="${l}"><i style="--w:${w * 2.2}px"></i></button>`).join('')}</div>
      <div class="ink-g"><button class="ink-b" data-t="erase" title="Gomme">⌫</button><button class="ink-b" data-t="undo" title="Annuler">↶</button><button class="ink-b" data-t="redo" title="Rétablir">↷</button><button class="ink-b" data-t="clear" title="Tout effacer">✕</button></div>
      <div class="ink-g"><label class="chk sm"><input type="checkbox" id="ipen"> Stylet seulement</label><label class="chk sm"><input type="checkbox" id="ilines"> Lignes</label></div>
    </div>
    <div class="ink-pad"><canvas></canvas><div class="ink-ph">Écrivez ou dessinez ici</div></div>
    <div class="ink-res hidden"><label class="fl">Texte reconnu (modifiable)<textarea id="itxt" rows="5"></textarea></label><label class="chk"><input type="checkbox" id="ikeep"> Garder aussi le manuscrit sur le canvas</label></div>
    <div class="err" id="ierr"></div>
    <div class="row between ebtm"><button class="btn ghost" id="isk">Ajouter comme croquis</button><span class="sp"></span><button class="btn" id="iocr">✦ Transformer en texte</button><button class="btn hidden" id="iadd">Ajouter la note</button></div>`,
    (bg, close) => {
      bg.querySelector('.modal').classList.add('inkm');
      const q = s => bg.querySelector(s), cv = q('canvas'), pad = q('.ink-pad'), ctx = cv.getContext('2d');
      let dpr = 1, W = 0, H = 0;
      const ui = () => {
        bg.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', !st.erase && b.dataset.c === st.color));
        bg.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', +b.dataset.s === st.size));
        q('[data-t=erase]').classList.toggle('on', st.erase);
        q('[data-t=undo]').disabled = !st.strokes.length; q('[data-t=redo]').disabled = !st.undone.length; q('[data-t=clear]').disabled = !st.strokes.length;
        q('#ipen').checked = st.penOnly; q('#ilines').checked = st.lines; pad.classList.toggle('lined', st.lines);
        q('.ink-ph').classList.toggle('hidden', !!st.strokes.length || !!st.cur);
      };
      // Dessin d'un trait : épaisseur selon la pression du stylet, courbes lissées
      const drawStroke = (c, s, scale = 1, ox = 0, oy = 0) => {
        const p = s.pts; if (!p.length) return;
        c.strokeStyle = s.color; c.fillStyle = s.color; c.lineCap = 'round'; c.lineJoin = 'round';
        const X = i => (p[i][0] - ox) * scale, Y = i => (p[i][1] - oy) * scale, Wd = i => s.w * scale * (s.pen ? 0.35 + 1.3 * (p[i][2] || 0.5) : 1);
        if (p.length === 1) { c.beginPath(); c.arc(X(0), Y(0), Wd(0) / 2, 0, Math.PI * 2); c.fill(); return; }
        for (let i = 1; i < p.length; i++) {
          c.lineWidth = (Wd(i - 1) + Wd(i)) / 2; c.beginPath();
          const mx0 = i > 1 ? (X(i - 2) + X(i - 1)) / 2 : X(0), my0 = i > 1 ? (Y(i - 2) + Y(i - 1)) / 2 : Y(0);
          const mx1 = (X(i - 1) + X(i)) / 2, my1 = (Y(i - 1) + Y(i)) / 2;
          c.moveTo(mx0, my0); c.quadraticCurveTo(X(i - 1), Y(i - 1), mx1, my1); if (i === p.length - 1) c.lineTo(X(i), Y(i)); c.stroke();
        }
      };
      const redraw = () => { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); st.strokes.forEach(s => drawStroke(ctx, s)); if (st.cur) drawStroke(ctx, st.cur); };
      const fit = () => { const r = pad.getBoundingClientRect(); dpr = Math.min(3, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; redraw(); };
      const ro = new ResizeObserver(fit); ro.observe(pad);
      const pt = (e, t0) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5, Math.round(e.timeStamp - t0)]; };
      const eraseAt = (x, y) => { const n = st.strokes.length; st.strokes = st.strokes.filter(s => !s.pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 10 + s.w)); if (st.strokes.length !== n) { redraw(); ui(); } };
      let active = null, t0 = 0;
      cv.addEventListener('pointerdown', e => {
        if (e.pointerType === 'pen' && !st.penOnly && LS.get('sp.penonly') == null) { st.penOnly = true; LS.set('sp.penonly', '1'); ui(); }
        if (st.penOnly && e.pointerType === 'touch') return; // la paume ne dessine pas
        if (active != null) return;
        e.preventDefault(); cv.setPointerCapture(e.pointerId); active = e.pointerId;
        if (!st.strokes.length) t0 = e.timeStamp;
        if (st.erase || e.button === 5 || (e.buttons & 32)) { st.cur = null; st.erasing = true; const p = pt(e, t0); eraseAt(p[0], p[1]); return; }
        st.cur = { color: st.color, w: st.size, pen: e.pointerType === 'pen', pts: [pt(e, t0)] }; ui(); redraw();
      });
      cv.addEventListener('pointermove', e => {
        if (e.pointerId !== active) return; e.preventDefault();
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        if (st.erasing) { evs.forEach(ev => { const p = pt(ev, t0); eraseAt(p[0], p[1]); }); return; }
        if (!st.cur) return;
        evs.forEach(ev => { const p = pt(ev, t0), l = st.cur.pts[st.cur.pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.8) st.cur.pts.push(p); });
        redraw();
      });
      const end = e => {
        if (e.pointerId !== active) return; active = null;
        if (st.erasing) { st.erasing = false; return; }
        if (st.cur) { st.strokes.push(st.cur); st.undone = []; st.cur = null; redraw(); ui(); }
      };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      cv.addEventListener('touchstart', e => { if (!st.penOnly) e.preventDefault(); }, { passive: false });
      bg.querySelector('.ink-tools').addEventListener('click', e => {
        const c = e.target.closest('[data-c]'), s = e.target.closest('[data-s]'), t = e.target.closest('[data-t]')?.dataset.t;
        if (c) { st.color = c.dataset.c; st.erase = false; }
        if (s) { st.size = +s.dataset.s; LS.set('sp.inksize', st.size); st.erase = false; }
        if (t === 'erase') st.erase = !st.erase;
        if (t === 'undo' && st.strokes.length) st.undone.push(st.strokes.pop());
        if (t === 'redo' && st.undone.length) st.strokes.push(st.undone.pop());
        if (t === 'clear' && st.strokes.length) { st.undone = [...st.strokes].reverse(); st.strokes = []; }
        redraw(); ui();
      });
      q('#ipen').onchange = e => { st.penOnly = e.target.checked; LS.set('sp.penonly', st.penOnly ? '1' : '0'); };
      q('#ilines').onchange = e => { st.lines = e.target.checked; LS.set('sp.inklines', st.lines ? '1' : '0'); ui(); };
      const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); q(e.shiftKey ? '[data-t=redo]' : '[data-t=undo]').click(); } };
      window.addEventListener('keydown', onKey);
      // Image recadrée sur l'écriture, fond blanc
      const snapshot = (maxW = 1400) => {
        const pts = st.strokes.flatMap(s => s.pts.map(p => [p[0], p[1], s.w])); if (!pts.length) return null;
        const pad0 = 24, x0 = Math.min(...pts.map(p => p[0] - p[2])) - pad0, y0 = Math.min(...pts.map(p => p[1] - p[2])) - pad0, x1 = Math.max(...pts.map(p => p[0] + p[2])) + pad0, y1 = Math.max(...pts.map(p => p[1] + p[2])) + pad0;
        const w = x1 - x0, h = y1 - y0, sc = Math.min(3, maxW / w, 1600 / h), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
        const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
        st.strokes.forEach(s => drawStroke(g, s, sc, x0, y0));
        return c.toDataURL('image/jpeg', 0.9);
      };
      const err = t => { q('#ierr').textContent = t || ''; };
      const finish = r => { window.removeEventListener('keydown', onKey); ro.disconnect(); close(); o.onAdd(r); };
      q('#isk').onclick = () => { const img = snapshot(); if (!img) return err(tr('Écrivez ou dessinez d’abord quelque chose.')); finish({ img }); };
      q('#iocr').onclick = async () => {
        const img = snapshot(); if (!img) return err(tr('Écrivez ou dessinez d’abord quelque chose.'));
        err(''); const b = q('#iocr'); b.disabled = true; b.innerHTML = `${tr('Lecture de l’écriture…')} <span class="spin"></span>`;
        st.busy = new AbortController();
        try {
          let text = await systemRecognize(st.strokes).catch(() => '');
          if (!text) text = await o.vision(VISION_PROMPT(), img, st.busy.signal);
          text = String(text || '').trim().replace(/^```\w*\n?|```$/g, '').trim();
          if (!text) throw new Error(tr('Aucun texte reconnu.'));
          q('#itxt').value = text; q('.ink-res').classList.remove('hidden'); bg.querySelector('.inkm').classList.add('done'); q('#iadd').classList.remove('hidden'); b.classList.add('hidden');
          q('#ikeep').checked = LS.get('sp.inkkeep') === '1';
          setTimeout(() => q('#itxt').focus(), 30);
        } catch (e) { err(e.message || 'erreur'); b.disabled = false; b.textContent = tr('✦ Transformer en texte'); }
      };
      q('#iadd').onclick = () => { const text = q('#itxt').value.trim(); if (!text) return q('#itxt').focus(); LS.set('sp.inkkeep', q('#ikeep').checked ? '1' : '0'); finish({ text, img: q('#ikeep').checked ? snapshot() : null }); };
      bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) { st.busy?.abort(); window.removeEventListener('keydown', onKey); ro.disconnect(); } });
      ui(); requestAnimationFrame(fit);
    });
}

const LN = { fr: 'français', en: 'English', ar: 'العربية' };
const VISION_PROMPT = () => `This image is a handwritten note from a film director's notebook (it may be in French, English or Arabic, or a mix). Transcribe it into clean typed text:
- keep the original language of each word (do not translate);
- fix obvious spelling mistakes and unreadable letters using context (film vocabulary: plan, scène, travelling, HMC, décor, INT/EXT…);
- keep line breaks, lists and numbering; write list items with "• "; turn hand-drawn arrows into "→";
- if there is a small drawing, describe it in a few words between square brackets, in ${LN[LANG] || 'French'};
Reply with the transcribed text only, nothing else.`;

// Reconnaissance d'écriture intégrée au système (Chrome sur Android / ChromeOS) : rapide et hors ligne
async function systemRecognize(strokes) {
  if (!('createHandwritingRecognizer' in navigator) || typeof HandwritingStroke === 'undefined') return '';
  const langs = { fr: 'fr', en: 'en', ar: 'ar' }[LANG] || 'fr';
  const ok = await navigator.queryHandwritingRecognizer?.({ languages: [langs] }).catch(() => null);
  if (!ok) return '';
  const rec = await navigator.createHandwritingRecognizer({ languages: [langs] });
  try {
    const d = rec.startDrawing({ recognitionType: 'text', inputType: strokes.some(s => s.pen) ? 'stylus' : 'touch', textContext: '' });
    strokes.forEach(s => { const hs = new HandwritingStroke(); s.pts.forEach(p => hs.addPoint({ x: p[0], y: p[1], t: p[3] || 0 })); d.addStroke(hs); });
    const pr = await d.getPrediction(); d.clear();
    return (pr && pr[0] && pr[0].text) || '';
  } finally { rec.finish?.(); }
}
