// Surlignage du scénario : les rôles, accessoires, costumes, animaux… apparaissent en couleur
// sous le texte, comme sur un dépouillement papier. Calque placé derrière le textarea, défilement synchronisé.
import { esc } from './parser.js';

export const HL = [['ch', 'Rôles'], ['acc', 'Accessoires'], ['cos', 'Costumes'], ['hmc', 'HMC'], ['veh', 'Véhicules'], ['ani', 'Animaux'], ['fig', 'Figuration'], ['casc', 'Cascades'], ['sfx', 'Effets'], ['son', 'Son'], ['pl', 'Lieux']];
const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// termes : Map(minuscule → catégorie)
export function termsOf(P, project) {
  const T = new Map(), add = (n, c) => { n = String(n || '').trim().toLowerCase(); if (n.length > 1 && !T.has(n)) T.set(n, c); };
  P.roles.forEach(r => { add(r.name, 'ch'); r.name.split(/\s+/).filter(w => w.length > 2).forEach(w => add(w, 'ch')); });
  P.scenes.forEach(s => { HL.forEach(([c]) => { if (s.det && s.det[c]) s.det[c].split(/\s*,\s*/).forEach(n => add(n, c)); }); (s.places || []).forEach(n => add(n, 'pl')); });
  Object.entries(project.tags || {}).forEach(([n, c]) => add(n, c));
  return T;
}

export function attachHighlight(tx, getTerms) {
  const wrap = document.createElement('div'); wrap.className = 'hlwrap';
  tx.parentNode.insertBefore(wrap, tx); wrap.appendChild(tx);
  const back = document.createElement('div'); back.className = 'hlback'; back.setAttribute('aria-hidden', 'true');
  const inner = document.createElement('div'); back.appendChild(inner); wrap.insertBefore(back, tx);
  let on = true, re = null, map = null, timer = null;
  const fit = () => {
    const cs = getComputedStyle(tx);
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingLeft', 'paddingBottom', 'borderTopWidth', 'borderLeftWidth', 'borderRightWidth', 'borderBottomWidth', 'tabSize', 'wordSpacing'].forEach(k => back.style[k] = cs[k]);
    const sb = tx.offsetWidth - tx.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    back.style.paddingRight = (parseFloat(cs.paddingRight) + sb) + 'px';
    back.style.borderRadius = cs.borderRadius; back.style.borderStyle = 'solid'; back.style.borderColor = 'transparent';
  };
  const build = () => {
    map = getTerms();
    const keys = [...map.keys()].sort((a, b) => b.length - a.length).slice(0, 1500);
    re = keys.length ? new RegExp('(@\\[[^\\]\\n]{1,60}\\]|@[\\p{L}\\p{N}_\'’-]+)|(?<![\\p{L}\\p{N}])(' + keys.map(rx).join('|') + ')(?![\\p{L}\\p{N}])', 'giu') : /(@\[[^\]\n]{1,60}\]|@[\p{L}\p{N}_'’-]+)/giu;
  };
  const paint = () => {
    if (!on) { inner.innerHTML = ''; return; }
    if (!re) build();
    const v = tx.value; let out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(v))) {
      const txt = m[0];
      let c = m[1] ? (map.get(m[1].replace(/^@\[?|\]$/g, '').replace(/_/g, ' ').toLowerCase()) || 'mnt') : map.get(txt.toLowerCase());
      out += esc(v.slice(last, m.index)) + `<mark class="hl-${c || 'acc'}">${esc(txt)}</mark>`;
      last = m.index + txt.length;
    }
    inner.innerHTML = out + esc(v.slice(last)) + '\n';
    sync();
  };
  const sync = () => { inner.style.transform = `translate(${-tx.scrollLeft}px, ${-tx.scrollTop}px)`; };
  tx.addEventListener('scroll', sync);
  tx.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(paint, 120); });
  new ResizeObserver(() => { fit(); paint(); }).observe(tx);
  fit(); paint();
  return {
    refresh() { re = null; paint(); },
    toggle(v) { on = v; wrap.classList.toggle('off', !on); paint(); },
    get on() { return on; }
  };
}
