// Budget de production : lignes calculées à partir du projet (jours de tournage, rôles, décors…)
// et lignes ajoutées à la main. Trois devises : dinar tunisien, euro, dollar US.
// Taux saisis par l'utilisateur, exprimés en dinars pour 1 unité (TND = 1).

export const CURRENCIES = ['TND', 'EUR', 'USD'];
import { isAI } from './formats.js';
export const UNITS = ['jour', 'semaine', 'mois', 'forfait', 'pers./jour', 'unité'];
export const BUD_CATS = [
  ['scn', 'Scénario et droits'], ['prod', 'Production'], ['real', 'Réalisation'], ['int', 'Interprétation'],
  ['tech', 'Équipe technique'], ['mat', 'Matériel'], ['lieux', 'Décors et lieux'], ['cos', 'Costumes, HMC, accessoires'],
  ['reg', 'Transport et régie'], ['post', 'Post-production'], ['div', 'Assurances et divers']
];
export const BUD_CATS_AI = [
  ['scn', 'Scénario et droits'], ['real', 'Direction créative'], ['ia', 'Outils et crédits IA'], ['voix', 'Voix, musique et sons'], ['post', 'Post-production'], ['div', 'Licences, diffusion et divers']
];
// Lignes d'un projet IA : pas de tournage, donc ni équipe technique, ni matériel caméra, ni décors
function aiLines(P, b) {
  const shots = Math.max(P.scenes.length, P.scenes.reduce((a, s) => a + (s.shots || 0), 0)), L = [];
  const add = (key, cat, label, qty, unit) => L.push({ key, cat, label, qty, unit, auto: true });
  add('scn.droits', 'scn', 'Droits et écriture du scénario', 1, 'forfait');
  add('real.dir', 'real', 'Réalisation et direction créative', 1, 'forfait');
  add('real.prompt', 'real', 'Prompt design et génération', Math.max(1, Math.ceil(shots / 8)), 'jour');
  add('ia.img', 'ia', 'Abonnement générateur d’images', 1, 'mois');
  add('ia.vid', 'ia', 'Abonnement générateur vidéo', 1, 'mois');
  add('ia.cred', 'ia', 'Crédits de génération (≈ 3 essais par plan)', shots * 3, 'unité');
  add('ia.up', 'ia', 'Agrandissement et amélioration des plans', shots, 'unité');
  add('voix.voix', 'voix', 'Voix (synthèse ou comédien·ne voix)', 1, 'forfait');
  add('voix.mus', 'voix', 'Musique (licence ou génération)', 1, 'forfait');
  add('voix.sfx', 'voix', 'Sons et bruitages', 1, 'forfait');
  add('post.mont', 'post', 'Montage', +b.postW || 0, 'semaine');
  add('post.eta', 'post', 'Étalonnage', 1, 'forfait');
  add('post.mix', 'post', 'Montage son et mixage', 1, 'forfait');
  add('div.lic', 'div', 'Licences commerciales des outils', 1, 'forfait');
  add('div.diff', 'div', 'Diffusion et sponsorisation', 1, 'forfait');
  return { L, shots };
}
export const budgetDefaults = () => ({ cur: 'TND', fx: { EUR: 0, USD: 0 }, cont: 10, prepW: 4, postW: 8, crew: 15, auto: {}, lines: [] });

// Lignes calculées : clé stable, catégorie, libellé, quantité proposée, unité
function autoLines(P, b) {
  const D = P.days.filter(d => d.sc.length).length, W = Math.max(1, Math.ceil(D / 5));
  const prepD = (+b.prepW || 0) * 5, L = [];
  const add = (key, cat, label, qty, unit) => L.push({ key, cat, label, qty, unit, auto: true });
  add('scn.droits', 'scn', 'Droits et écriture du scénario', 1, 'forfait');
  add('prod.dp', 'prod', 'Direction de production', (+b.prepW || 0) + W, 'semaine');
  add('prod.reg', 'prod', 'Régie générale', prepD + D, 'jour');
  add('prod.bur', 'prod', 'Frais de bureau et de production', 1, 'forfait');
  add('real.real', 'real', 'Réalisation', 1, 'forfait');
  add('real.ad1', 'real', '1er assistant·e à la réalisation', (+b.prepW || 0) + W, 'semaine');
  add('real.scr', 'real', 'Scripte', D, 'jour');
  P.roles.forEach(r => add('int.' + r.name, 'int', r.name, (r.days || []).length, 'jour'));
  add('int.fig', 'int', 'Figuration', 0, 'pers./jour');
  [['op', 'Chef·fe opérateur·rice'], ['cad', 'Assistant·e caméra'], ['elec', 'Chef électricien·ne'], ['mach', 'Chef machiniste'], ['son', 'Ingénieur·e du son'], ['perche', 'Perchman'], ['deco', 'Chef décorateur·rice'], ['cost', 'Costumier·ère'], ['hmc', 'Maquillage et coiffure']]
    .forEach(([k, l]) => add('tech.' + k, 'tech', l, D, 'jour'));
  [['cam', 'Caméra et optiques'], ['lum', 'Lumière'], ['machi', 'Machinerie'], ['sonm', 'Matériel son']].forEach(([k, l]) => add('mat.' + k, 'mat', l, D, 'jour'));
  const loc = new Map(); P.days.forEach(d => new Set(d.sc.map(s => s.dk)).forEach(dk => loc.set(dk, (loc.get(dk) || 0) + 1)));
  loc.forEach((n, dk) => add('lieux.' + dk, 'lieux', dk, n, 'jour'));
  add('cos.cos', 'cos', 'Costumes (achats, locations)', 1, 'forfait');
  add('cos.hmc', 'cos', 'Produits HMC', 1, 'forfait');
  add('cos.acc', 'cos', 'Accessoires', 1, 'forfait');
  const meals = P.days.reduce((a, d) => a + (d.sc.length ? d.roles.length + (+b.crew || 0) : 0), 0);
  add('reg.repas', 'reg', 'Repas et cantine', meals, 'pers./jour');
  add('reg.veh', 'reg', 'Véhicules et carburant', D, 'jour');
  add('reg.hbg', 'reg', 'Hébergement', 0, 'pers./jour');
  add('post.mont', 'post', 'Montage', +b.postW || 0, 'semaine');
  add('post.eta', 'post', 'Étalonnage', 1, 'forfait');
  add('post.mix', 'post', 'Montage son et mixage', 1, 'forfait');
  add('post.mus', 'post', 'Musique', 1, 'forfait');
  add('div.ass', 'div', 'Assurance de production', 1, 'forfait');
  return L;
}

// Conversion : montant dans la devise c → dinars → devise d'affichage
export const fxOk = (b, c) => c === 'TND' || +(b.fx || {})[c] > 0;
export const toTND = (b, v, c) => c === 'TND' ? v : v * (+(b.fx || {})[c] || 0);
export const fromTND = (b, v, c) => c === 'TND' ? v : (+(b.fx || {})[c] > 0 ? v / +(b.fx || {})[c] : null);

export function computeBudget(project, P) {
  const b = { ...budgetDefaults(), ...(project.budget || {}) }; b.fx = { ...budgetDefaults().fx, ...(b.fx || {}) }; b.auto = b.auto || {}; b.lines = b.lines || [];
  const rows = [], ai = isAI(project), A = ai ? aiLines(P, b) : null, CATS = ai ? BUD_CATS_AI : BUD_CATS;
  (ai ? A.L : autoLines(P, b)).forEach(l => {
    const o = b.auto[l.key] || {}; if (o.off) return;
    rows.push({ ...l, sugg: l.qty, qty: o.qty != null && o.qty !== '' ? +o.qty : l.qty, unit: o.unit || l.unit, rate: +o.rate || 0, c: o.c || b.cur, label: o.label || l.label, note: o.note || '' });
  });
  b.lines.forEach(l => rows.push({ ...l, auto: false, qty: +l.qty || 0, rate: +l.rate || 0, c: l.c || b.cur }));
  let missing = new Set();
  rows.forEach(r => { r.tot = r.qty * r.rate; if (r.tot && !fxOk(b, r.c)) missing.add(r.c); r.totTND = toTND(b, r.tot, r.c); r.totMain = fromTND(b, r.totTND, b.cur); });
  const cats = CATS.map(([id, label]) => { const rr = rows.filter(r => r.cat === id); return { id, label, rows: rr, totTND: rr.reduce((a, r) => a + r.totTND, 0) }; });
  const subTND = cats.reduce((a, c) => a + c.totTND, 0), contTND = subTND * (+b.cont || 0) / 100, totalTND = subTND + contTND;
  const inCur = v => Object.fromEntries(CURRENCIES.map(c => [c, fromTND(b, v, c)]));
  if (!fxOk(b, b.cur)) missing.add(b.cur);
  return { b, rows, cats, subTND, contTND, totalTND, total: inCur(totalTND), sub: inCur(subTND), cont: inCur(contTND), missing: [...missing], days: P.days.filter(d => d.sc.length).length, ai, shots: A ? A.shots : 0 };
}

const DEC = { TND: 3, EUR: 2, USD: 2 };
export function money(v, c, locale = 'fr-FR', exact = false) {
  if (v == null || isNaN(v)) return '—';
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: c, maximumFractionDigits: exact ? DEC[c] : 0, minimumFractionDigits: 0 }).format(v); }
  catch (e) { return Math.round(v) + ' ' + c; }
}
