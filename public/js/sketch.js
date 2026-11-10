// Croquis de storyboard dessinés directement dans le navigateur, sans IA ni réseau (gratuit, hors ligne).
// À partir de la scène (INT/EXT, jour/nuit, décor), du plan (valeur, angle, mouvement) et des personnages,
// compose une case : perspective, décor reconnu par mots-clés, silhouettes, ombres, flèche de mouvement.

const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const f1 = n => Math.round(n * 10) / 10;

// Palettes par style
const PAL = {
  board: { ink: '#151515', g1: '#d9d9d9', g2: '#ababab', g3: '#6e6e6e', dark: '#151515', sky: '#ffffff', w: 2.4 },
  crayon: { ink: '#3a3a3a', g1: 'url(#h1)', g2: 'url(#h2)', g3: 'url(#h3)', dark: 'url(#h3)', sky: 'none', w: 1.6 },
  encre: { ink: '#0d0d0d', g1: 'none', g2: '#cfcfcf', g3: '#0d0d0d', dark: '#0d0d0d', sky: 'none', w: 3 },
  fusain: { ink: '#2b2b2b', g1: '#bdbdbd', g2: '#8e8e8e', g3: '#585858', dark: '#2b2b2b', sky: '#d6d3cc', w: 3.4 },
  aqua: { ink: '#4a4540', g1: 'rgba(120,160,200,.35)', g2: 'rgba(200,150,90,.4)', g3: 'rgba(70,80,110,.55)', dark: 'rgba(40,40,60,.75)', sky: 'rgba(150,190,230,.35)', w: 1.5 }
};

export function sketchSVG({ w, h, style = 'board', size = '', angle = '', move = '', ie = 'INT', night = false, text = '', people = 1, seed = 1 }) {
  const R = rng(seed), P = PAL[style] || PAL.board, t = String(text).toLowerCase();
  const has = (...k) => k.some(x => t.includes(x));
  const out = [];
  const j = (a = 2) => (R() - .5) * a;
  // Trait à main levée : deux passages légèrement décalés
  const line = (x1, y1, x2, y2, sw = P.w, col = P.ink, twice = true) => {
    const mx = (x1 + x2) / 2 + j(4), my = (y1 + y2) / 2 + j(4);
    out.push(`<path d="M${f1(x1 + j())} ${f1(y1 + j())} Q${f1(mx)} ${f1(my)} ${f1(x2 + j())} ${f1(y2 + j())}" stroke="${col}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`);
    if (twice && R() < .6) out.push(`<path d="M${f1(x1 + j(3))} ${f1(y1 + j(3))} L${f1(x2 + j(3))} ${f1(y2 + j(3))}" stroke="${col}" stroke-width="${f1(sw * .45)}" fill="none" opacity=".7" stroke-linecap="round"/>`);
  };
  const poly = (pts, fill, sw = P.w * .8) => out.push(`<path d="M${pts.map(p => f1(p[0] + j(1.5)) + ' ' + f1(p[1] + j(1.5))).join(' L')} Z" fill="${fill}" stroke="${P.ink}" stroke-width="${sw}" stroke-linejoin="round"/>`);
  const rect = (x, y, rw, rh, fill, sw) => poly([[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]], fill, sw);
  const S = size.toLowerCase();
  const close = /gros|insert/.test(S) && !/rapproch/.test(S), xclose = /très gros|insert/.test(S), mid = /moyen|américain|rapproch/.test(S), wide = !close && !mid;
  // Horizon et point de fuite selon l'angle
  const hy = /contre-plong/i.test(angle) ? h * .78 : /plong|aérienne/i.test(angle) ? h * .2 : h * (.4 + R() * .1);
  const vx = w * (.32 + R() * .36), vy = hy;
  const toV = (x, y, k) => [x + (vx - x) * k, y + (vy - y) * k];

  // ---------- Fond ----------
  if (ie === 'EXT') {
    if (night) rect(0, 0, w, hy, P.g3, 0); else if (P.sky !== 'none' && P.sky !== '#ffffff') rect(0, 0, w, hy, P.sky, 0);
    if (night && R() < .8) out.push(`<circle cx="${f1(w * (.7 + R() * .2))}" cy="${f1(hy * .3)}" r="${f1(h * .05)}" fill="#f2f2f2" stroke="${P.ink}" stroke-width="1"/>`);
    line(0, hy, w, hy, P.w * .8);
    if (has('quai', 'platform', 'gare', 'station', 'train', 'rail')) {
      // Quai, rails et train en perspective
      [w * .55, w * .7].forEach(x => line(x, h, ...toV(x, h, .97), P.w));
      for (let k = .1; k < .9; k += .12) { const a = toV(w * .52, h, k), b = toV(w * .73, h, k); line(a[0], a[1], b[0], b[1], P.w * .6, P.ink, false); }
      poly([[w * .78, h], [w, h], [w, hy - h * .3], toV(w, hy - h * .3, .9), toV(w, h * .98, .9)], P.g1);
      for (let k = .05; k < .8; k += .14) { const a = toV(w, hy - h * .22, k), b = toV(w, hy - h * .05, k + .07); rect(a[0] - 2, a[1], Math.max(4, (b[0] - a[0]) * .7), (b[1] - a[1]), night ? '#f5f5f5' : P.g3, P.w * .5); }
      poly([[0, h], [w * .5, h], toV(w * .5, h, .97), toV(0, hy + 4, .97), [0, hy + 4]], P.g2 === 'none' ? 'none' : P.g1, P.w * .5);
      for (let i = 0; i < 3; i++) { const x = w * (.08 + i * .14), y = hy - h * .02; line(x, y, x, y - h * .25, P.w * .7); }
    } else if (has('parking', 'voiture', 'car', 'taxi', 'route', 'road', 'rue', 'street', 'médina', 'medina', 'ville', 'city', 'place')) {
      // Rue : façades des deux côtés, fenêtres, chaussée
      [[0, -1], [w, 1]].forEach(([x0]) => {
        const top = hy - h * (.45 + R() * .2);
        poly([[x0, h * .95], [x0, top], toV(x0, top, .75), toV(x0, h * .95, .75)], x0 ? P.g2 : P.g1);
        for (let k = .06; k < .7; k += .16) for (let r = 0; r < 3; r++) { const a = toV(x0, top + (r + .4) * h * .14, k), b = toV(x0, top + (r + .4) * h * .14 + h * .07, k + .08); rect(Math.min(a[0], b[0]), a[1], Math.abs(b[0] - a[0]) * .7, Math.max(4, b[1] - a[1]), night ? (R() < .5 ? '#f3f3f3' : P.dark) : P.g3, P.w * .4); }
      });
      line(w * .3, h, ...toV(w * .3, h, .9), P.w * .7); line(w * .7, h, ...toV(w * .7, h, .9), P.w * .7);
      if (has('parking', 'voiture', 'car', 'taxi')) { const cx = w * (.18 + R() * .1), cy = h * .82, cw = w * .3, ch = h * .13; poly([[cx, cy], [cx + cw * .15, cy - ch], [cx + cw * .75, cy - ch], [cx + cw, cy - ch * .1], [cx + cw, cy + ch * .6], [cx, cy + ch * .6]], P.g2); [cx + cw * .2, cx + cw * .8].forEach(x => out.push(`<circle cx="${f1(x)}" cy="${f1(cy + ch * .6)}" r="${f1(ch * .32)}" fill="${P.dark}" stroke="${P.ink}" stroke-width="${P.w}"/>`)); if (night) out.push(`<path d="M${f1(cx + cw)} ${f1(cy)} L${f1(w)} ${f1(cy - ch)} L${f1(w)} ${f1(cy + ch)} Z" fill="#ffffff" opacity=".55"/>`); }
    } else {
      // Paysage ouvert : collines, arbre, sol
      out.push(`<path d="M0 ${f1(hy)} Q${f1(w * .25)} ${f1(hy - h * .12)} ${f1(w * .5)} ${f1(hy - h * .03)} T${f1(w)} ${f1(hy - h * .06)} L${f1(w)} ${f1(hy)} Z" fill="${P.g1}" stroke="${P.ink}" stroke-width="${P.w * .7}"/>`);
      const tx = w * (R() < .5 ? .12 : .82); line(tx, hy + h * .25, tx, hy - h * .05, P.w * 1.6); out.push(`<ellipse cx="${f1(tx)}" cy="${f1(hy - h * .12)}" rx="${f1(w * .07)}" ry="${f1(h * .11)}" fill="${P.g2}" stroke="${P.ink}" stroke-width="${P.w * .8}"/>`);
      for (let i = 0; i < 6; i++) { const y = hy + (h - hy) * (i / 6) ** 1.4; line(w * R() * .3, y + 8, w * (.7 + R() * .3), y + 8, P.w * .4, P.g3 === 'url(#h3)' ? P.ink : P.g3, false); }
    }
  } else {
    // Intérieur : boîte en perspective (mur du fond, sol, plafond)
    const bw = w * (.42 + R() * .12), bh = h * .5, bx = vx - bw / 2, by = vy - bh * .55;
    rect(bx, by, bw, bh, night ? P.g2 : 'none', P.w * .8);
    [[bx, by, 0, 0], [bx + bw, by, w, 0], [bx, by + bh, 0, h], [bx + bw, by + bh, w, h]].forEach(([x, y, X, Y]) => line(x, y, X, Y, P.w * .8));
    poly([[0, h], [bx, by + bh], [bx + bw, by + bh], [w, h]], P.g1 === 'none' ? 'none' : P.g1, P.w * .5);
    // fenêtre ou porte au fond
    const win = has('fenêtre', 'window', 'cuisine', 'kitchen', 'appartement', 'apartment', 'chambre', 'bedroom', 'salon', 'café', 'cafe', 'bureau', 'office');
    const wx = bx + bw * (.15 + R() * .4), wy = by + bh * .18, ww = bw * .28, wh = bh * .42;
    if (win) { rect(wx, wy, ww, wh, night ? P.dark : '#ffffff', P.w); line(wx + ww / 2, wy, wx + ww / 2, wy + wh, P.w * .6); line(wx, wy + wh / 2, wx + ww, wy + wh / 2, P.w * .6); if (!night) out.push(`<path d="M${f1(wx)} ${f1(wy + wh)} L${f1(wx + ww)} ${f1(wy + wh)} L${f1(wx + ww * 1.8)} ${f1(h)} L${f1(wx - ww * .6)} ${f1(h)} Z" fill="#ffffff" opacity=".45"/>`); }
    else rect(bx + bw * .66, by + bh * .3, bw * .2, bh * .7, P.g2, P.w);
    if (has('train', 'compartiment', 'compartment', 'wagon')) { [[w * .02, .7], [w * .76, .7]].forEach(([x]) => poly([[x, h], [x, h * .55], [x + w * .2, h * .5], [x + w * .22, h]], P.g2)); rect(bx + bw * .1, by + bh * .15, bw * .8, bh * .35, night ? P.dark : '#ffffff', P.w); }
    if (has('café', 'cafe', 'bar', 'restaurant', 'table', 'cuisine', 'kitchen')) {
      const tx = w * (.3 + R() * .3), ty = h * .78;
      out.push(`<ellipse cx="${f1(tx)}" cy="${f1(ty)}" rx="${f1(w * .16)}" ry="${f1(h * .045)}" fill="${P.g2}" stroke="${P.ink}" stroke-width="${P.w}"/>`);
      line(tx, ty + h * .04, tx, h, P.w * 1.4);
      for (let i = 0; i < 2; i++) { const cx = tx - w * .06 + i * w * .1; rect(cx, ty - h * .05, w * .025, h * .04, '#ffffff', P.w * .7); }
    }
    if (night) out.push(`<circle cx="${f1(vx + bw * .3)}" cy="${f1(by + bh * .1)}" r="${f1(h * .03)}" fill="#ffffff" stroke="${P.ink}" stroke-width="${P.w * .6}"/><circle cx="${f1(vx + bw * .3)}" cy="${f1(by + bh * .1)}" r="${f1(h * .1)}" fill="#ffffff" opacity=".35"/>`);
  }
  if (has('pluie', 'rain', 'orage', 'storm')) for (let i = 0; i < 60; i++) { const x = R() * w, y = R() * h; line(x, y, x - 6, y + 16, 1, P.ink, false); }
  if (has('fumée', 'smoke', 'brume', 'fog', 'vapeur', 'steam')) for (let i = 0; i < 5; i++) out.push(`<ellipse cx="${f1(w * R())}" cy="${f1(hy - h * .05 + R() * h * .1)}" rx="${f1(w * .12)}" ry="${f1(h * .05)}" fill="#ffffff" opacity=".6"/>`);

  // ---------- Personnages ----------
  const shade = P.dark;
  const figure = (x, base, ht, face = 1) => {
    const hr = ht * .075, hx = x, hyy = base - ht + hr;
    // ombre portée
    out.push(`<ellipse cx="${f1(x + face * ht * .08)}" cy="${f1(base)}" rx="${f1(ht * .16)}" ry="${f1(ht * .025)}" fill="${P.g3}" opacity=".55"/>`);
    poly([[x - ht * .055, base], [x - ht * .07, base - ht * .46], [x - ht * .13, base - ht * .8], [x - ht * .05, base - ht * .85], [x + ht * .05, base - ht * .85], [x + ht * .13, base - ht * .8], [x + ht * .08, base - ht * .46], [x + ht * .06, base]], shade);
    line(x, base - ht * .44, x, base, P.w * .6, '#ffffff', false);
    out.push(`<circle cx="${f1(hx)}" cy="${f1(hyy)}" r="${f1(hr)}" fill="${style === 'aqua' ? 'rgba(230,190,160,.6)' : '#ffffff'}" stroke="${P.ink}" stroke-width="${P.w}"/>`);
    out.push(`<path d="M${f1(hx - hr)} ${f1(hyy)} A${f1(hr)} ${f1(hr)} 0 0 1 ${f1(hx + hr)} ${f1(hyy)} Z" fill="${shade}"/>`);
  };
  const bust = (x, ht, face = 1) => {
    const hr = ht * .2, cy = h - ht * .42 - hr * .82;
    poly([[x - hr * .28, cy + hr * .7], [x + hr * .28, cy + hr * .7], [x + hr * .32, h - ht * .4], [x - hr * .32, h - ht * .4]], '#ffffff', P.w * .8);
    poly([[x - ht * .55, h + 4], [x - ht * .42, h - ht * .32], [x - ht * .12, h - ht * .42], [x + ht * .12, h - ht * .42], [x + ht * .42, h - ht * .32], [x + ht * .55, h + 4]], shade);
    out.push(`<ellipse cx="${f1(x)}" cy="${f1(cy)}" rx="${f1(hr * .85)}" ry="${f1(hr)}" fill="#ffffff" stroke="${P.ink}" stroke-width="${P.w * 1.1}"/>`);
    out.push(`<path d="M${f1(x - hr * .9)} ${f1(cy)} Q${f1(x)} ${f1(cy - hr * 1.6)} ${f1(x + hr * .9)} ${f1(cy - hr * .1)} Q${f1(x + face * hr * .2)} ${f1(cy - hr * .6)} ${f1(x - hr * .9)} ${f1(cy)} Z" fill="${shade}"/>`);
    out.push(`<path d="M${f1(x + face * hr * .2)} ${f1(cy - hr * .1)} l${f1(face * hr * .25)} ${f1(hr * .35)} l${f1(-face * hr * .2)} ${f1(hr * .05)}" stroke="${P.ink}" stroke-width="${P.w * .7}" fill="none"/>`);
    out.push(`<path d="M${f1(x + face * hr * .05)} ${f1(cy - hr * .12)} l${f1(face * hr * .22)} ${f1(-hr * .03)}" stroke="${P.ink}" stroke-width="${P.w * 1.2}" stroke-linecap="round"/>`);
    out.push(`<path d="M${f1(x - face * hr * .85)} ${f1(cy - hr * .2)} Q${f1(x - face * hr * .2)} ${f1(cy + hr * .9)} ${f1(x + face * hr * .1)} ${f1(cy + hr)}" stroke="none" fill="${P.g3}" opacity=".5"/>`);
  };
  const n = Math.max(1, Math.min(3, people || 1));
  if (xclose && /insert/.test(S)) {
    // Insert : mains et objet
    const cx = w * .5, cy = h * .6;
    rect(cx - w * .12, cy - h * .08, w * .24, h * .16, '#ffffff', P.w * 1.2);
    line(cx - w * .08, cy - h * .02, cx + w * .07, cy - h * .02, P.w * .6); line(cx - w * .08, cy + h * .03, cx + w * .03, cy + h * .03, P.w * .6);
    [-1, 1].forEach(s => poly([[cx + s * w * .12, cy + h * .02], [cx + s * w * .2, cy - h * .06], [cx + s * w * .5, cy + h * .05], [cx + s * w * .5, cy + h * .3], [cx + s * w * .14, cy + h * .12]], shade));
  } else if (close) {
    const ht = xclose ? h * 1.4 : h * 1.05;
    bust(w * (.42 + R() * .16), ht, R() < .5 ? 1 : -1);
    if (n > 1 && !xclose) out.push(`<path d="M${f1(w * .96)} ${f1(h)} Q${f1(w * .82)} ${f1(h * .5)} ${f1(w * .98)} ${f1(h * .25)} L${f1(w)} ${f1(h)} Z" fill="${shade}"/>`); // amorce
  } else if (mid) {
    const ht = /rapproch/.test(S) ? h * .9 : h * .72;
    for (let i = 0; i < n; i++) bust(w * ((i + 1) / (n + 1)) + j(w * .05), ht * (1 - i * .08), i % 2 ? -1 : 1);
  } else {
    const ht = /ensemble/.test(S) ? h * .2 : h * .36;
    for (let i = 0; i < n; i++) { const x = w * (.25 + R() * .5), base = Math.min(h * .97, hy + (h - hy) * (.55 + R() * .35)); figure(x, base, ht * (base - hy) / (h - hy) * 1.25 + ht * .2, R() < .5 ? 1 : -1); }
  }

  // ---------- Mouvement de caméra ----------
  const M = move.toLowerCase();
  if (M && !/fixe/.test(M)) {
    const ar = (x1, y1, x2, y2) => { const a = Math.atan2(y2 - y1, x2 - x1), L = 16; out.push(`<path d="M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)}" stroke="${P.ink}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M${f1(x2 + Math.cos(a) * 6)} ${f1(y2 + Math.sin(a) * 6)} L${f1(x2 - Math.cos(a - .5) * L)} ${f1(y2 - Math.sin(a - .5) * L)} L${f1(x2 - Math.cos(a + .5) * L)} ${f1(y2 - Math.sin(a + .5) * L)} Z" fill="${P.ink}"/>`); };
    if (/avant|zoom/.test(M)) ar(w * .5, h * .55, w * .5, h * .3);
    else if (/arrière/.test(M)) ar(w * .5, h * .3, w * .5, h * .55);
    else if (/grue|drone/.test(M)) ar(w * .88, h * .7, w * .88, h * .2);
    else ar(w * .7, h * .12, w * .32, h * .12);
  }
  return out.join('');
}

export const HATCH_DEFS = `<pattern id="h1" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="9" stroke="#8a8a8a" stroke-width="1"/></pattern>
<pattern id="h2" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="6" stroke="#6a6a6a" stroke-width="1.2"/></pattern>
<pattern id="h3" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="4" stroke="#3a3a3a" stroke-width="1.6"/></pattern>`;

export const seedOf = s => hash(s);
