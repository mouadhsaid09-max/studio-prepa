// Saisie « @ » : en tapant @ dans un champ, une liste propose les personnages, lieux, objets… du projet.
// Si le nom n'existe pas encore, l'utilisateur choisit sa catégorie (personnage, lieu, accessoire…).
import { esc, MENTION_CATS, mentionToken } from './parser.js';
import { tr } from './i18n.js';

const ICON = { ch: '👤', pl: '📍', acc: '🧰', cos: '👗', hmc: '💄', veh: '🚗', ani: '🐾', fig: '👥', casc: '🤸', sfx: '✨', son: '🎵' };
const catLabel = c => tr((MENTION_CATS.find(x => x[0] === c) || [, 'Objet'])[1]);
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Position du curseur dans un textarea/input (copie invisible du champ)
function caretXY(el) {
  if (el.isContentEditable) {
    const sel = getSelection(); let r = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    if (!r || (!r.width && !r.height && !r.left)) r = el.getBoundingClientRect();
    return { x: Math.min(r.left, innerWidth - 300), y: Math.min(r.bottom, innerHeight - 40) - 18 };
  }
  const cs = getComputedStyle(el), d = document.createElement('div');
  ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'wordSpacing', 'tabSize', 'direction'].forEach(k => d.style[k] = cs[k]);
  Object.assign(d.style, { position: 'absolute', visibility: 'hidden', whiteSpace: el.tagName === 'INPUT' ? 'pre' : 'pre-wrap', wordWrap: 'break-word', overflow: 'hidden', top: 0, left: '-9999px' });
  d.textContent = el.value.slice(0, el.selectionStart);
  const m = document.createElement('span'); m.textContent = '​'; d.appendChild(m);
  document.body.appendChild(d);
  const r = el.getBoundingClientRect(), x = r.left + m.offsetLeft - el.scrollLeft, y = r.top + m.offsetTop - el.scrollTop + parseFloat(cs.lineHeight || 18);
  d.remove();
  return { x: Math.min(x, innerWidth - 300), y: Math.min(y, innerHeight - 40) };
}

// o : { items() → [{ name, cat, hint }], create(name, cat), token?(item) }
export function attachMentions(el, o) {
  if (!el || el.dataset.mentions) return; el.dataset.mentions = '1';
  let pop = null, st = null;
  const close = () => { pop?.remove(); pop = null; st = null; };
  const ce = el.isContentEditable;
  const before = () => {
    if (!ce) return el.value.slice(0, el.selectionStart);
    const sel = getSelection(); if (!sel.rangeCount || !el.contains(sel.anchorNode)) return '';
    const r = sel.getRangeAt(0).cloneRange(); r.selectNodeContents(el); r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset); return r.toString();
  };
  const query = () => {
    const v = before();
    const m = v.match(/@\[([^\]\n]{0,60})\]?$|@([\p{L}\p{N}_'’-]{0,40})$/u);
    return m ? { q: (m[1] ?? m[2] ?? '').replace(/_/g, ' '), start: ce ? 0 : el.selectionStart - m[0].length, len: m[0].length } : null;
  };
  const insert = (name, cat) => {
    const tok = (o.token ? o.token({ name, cat }) : mentionToken(name)) + ' ';
    if (ce) {
      const sel = getSelection(); for (let i = 0; i < st.len; i++) sel.modify('extend', 'backward', 'character');
      document.execCommand('insertText', false, tok);
    } else {
      el.setRangeText(tok, st.start, el.selectionStart, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    close(); el.focus();
  };
  const draw = () => {
    const { q } = st, nq = norm(q);
    const seen = new Set();
    let list = o.items().filter(i => { const k = norm(i.name); if (seen.has(k)) return false; seen.add(k); return !nq || k.includes(nq); });
    list.sort((a, b) => norm(a.name).indexOf(nq) - norm(b.name).indexOf(nq) || a.name.localeCompare(b.name)); list = list.slice(0, 8);
    const exact = list.some(i => norm(i.name) === nq);
    st.list = list; st.sel = Math.min(st.sel || 0, Math.max(0, list.length - 1));
    if (!pop) { pop = document.createElement('div'); pop.className = 'mnt-pop'; pop.setAttribute('role', 'listbox'); document.body.appendChild(pop);
      pop.addEventListener('mousedown', e => { e.preventDefault();
        const it = e.target.closest('[data-mi]'); if (it) { const i = st.list[+it.dataset.mi]; return insert(i.name, i.cat); }
        const c = e.target.closest('[data-mc]'); if (c && st.q.trim()) { const n = st.q.trim(); o.create(n, c.dataset.mc); return insert(n, c.dataset.mc); }
      }); }
    pop.innerHTML = (list.length ? list.map((i, n) => `<div class="mnt-it ${n === st.sel ? 'on' : ''}" data-mi="${n}" role="option"><span class="mnt-ic">${ICON[i.cat] || '•'}</span><b data-nt>${esc(i.name)}</b><small>${esc(catLabel(i.cat))}${i.hint ? ' · ' + esc(i.hint) : ''}</small></div>`).join('') : '')
      + (q.trim() && !exact ? `<div class="mnt-new"><span>${tr('Ajouter')} « <b data-nt>${esc(q.trim())}</b> » ${tr('comme')} :</span><div class="mnt-cats">${MENTION_CATS.map(([c, l]) => `<button type="button" data-mc="${c}">${ICON[c]} ${tr(l)}</button>`).join('')}</div></div>` : '')
      + (!list.length && !q.trim() ? `<div class="mnt-help">${tr('Tapez un nom : personnage, lieu, objet… Pour plusieurs mots : @[vieille radio]')}</div>` : '');
    const p = caretXY(el); pop.style.left = Math.max(8, p.x) + 'px'; pop.style.top = p.y + 4 + 'px';
    const h = pop.offsetHeight; if (p.y + h > innerHeight - 8) pop.style.top = Math.max(8, p.y - h - 26) + 'px';
  };
  el.addEventListener('input', () => { const q = query(); if (!q) return close(); st = { ...(st || {}), ...q }; draw(); });
  el.addEventListener('keydown', e => {
    if (!pop || !st) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!st.list.length) return; e.preventDefault(); st.sel = (st.sel + (e.key === 'ArrowDown' ? 1 : -1) + st.list.length) % st.list.length; draw(); }
    else if ((e.key === 'Enter' || e.key === 'Tab') && st.list.length) { e.preventDefault(); e.stopPropagation(); const i = st.list[st.sel]; insert(i.name, i.cat); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }, true);
  el.addEventListener('blur', () => setTimeout(close, 120));
  el.addEventListener('scroll', () => pop && st && draw());
  if (ce) el.addEventListener('focusout', () => setTimeout(close, 120));
}

// Liste des éléments du projet pour « @ »
export function projectItems(P, B, tags) {
  const out = [];
  P.roles.forEach(r => out.push({ name: r.name, cat: 'ch', hint: r.all.length ? r.all.length + ' sc.' : '' }));
  (B ? B.ch.filter(c => !c.auto) : []).forEach(c => out.push({ name: c.name, cat: 'ch', hint: 'Bible' }));
  (B ? B.pl : []).forEach(p => out.push({ name: p.name, cat: 'pl' }));
  const byLabel = Object.fromEntries(MENTION_CATS.map(([c, l]) => [l, c]));
  (B ? B.ob : []).forEach(x => out.push({ name: x.name, cat: byLabel[x.catLabel] || 'acc' }));
  P.scenes.forEach(s => ['cos', 'hmc', 'veh', 'ani', 'fig', 'casc', 'sfx', 'son'].forEach(c => (s.det[c] || '').split(/\s*,\s*/).filter(Boolean).forEach(n => out.push({ name: n, cat: c }))));
  Object.entries(tags || {}).forEach(([n, c]) => out.push({ name: n, cat: c }));
  return out;
}
