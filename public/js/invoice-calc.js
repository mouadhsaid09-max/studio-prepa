// Calculs de facture : totaux (HT, TVA, TTC, timbre, retenue) et montant en lettres (FR / EN).
export const DEC = { TND: 3, EUR: 2, USD: 2 };
const r = (v, c) => { const k = 10 ** (DEC[c] ?? 2); return Math.round((v + Number.EPSILON) * k) / k; };

export function invTotals(inv) {
  const c = inv.cur || 'TND';
  const ht = r((inv.lines || []).reduce((a, l) => a + (+l.qty || 0) * (+l.price || 0), 0), c);
  const vat = r(ht * (+inv.vat || 0) / 100, c), ttc = r(ht + vat, c);
  const stamp = c === 'TND' ? r(+inv.stamp || 0, c) : 0;
  const wh = r(ttc * (+inv.wh || 0) / 100, c);
  return { ht, vat, ttc, stamp, wh, net: r(ttc + stamp - wh, c) };
}

// ---------- Nombres en lettres ----------
const FR_U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const FR_T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
function fr99(n) {
  if (n < 20) return FR_U[n];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7 || t === 9) return FR_T[t] + (t === 7 && u === 1 ? '-et-' : '-') + FR_U[10 + u];
  if (u === 0) return FR_T[t] + (t === 8 ? 's' : '');
  return FR_T[t] + (u === 1 && t !== 8 ? '-et-' : '-') + FR_U[u];
}
function fr999(n) {
  const c = Math.floor(n / 100), rest = n % 100;
  const cs = c === 0 ? '' : c === 1 ? 'cent' : FR_U[c] + '-cent' + (rest === 0 ? 's' : '');
  return [cs, rest ? fr99(rest) : ''].filter(Boolean).join('-');
}
export function frWords(n) {
  n = Math.floor(n); if (n === 0) return 'zéro';
  const parts = []; const scales = [[1e9, 'milliard'], [1e6, 'million'], [1e3, 'mille']];
  for (const [v, w] of scales) {
    const q = Math.floor(n / v); if (!q) continue; n %= v;
    if (w === 'mille') parts.push(q === 1 ? 'mille' : fr999(q).replace(/(cent|vingt)s$/, '$1') + '-mille');
    else parts.push(fr999(q) + '-' + w + (q > 1 ? 's' : ''));
  }
  if (n) parts.push(fr999(n));
  return parts.join('-');
}
const EN_U = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_T = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const en999 = n => { const c = Math.floor(n / 100), x = n % 100; const t = x < 20 ? (x ? EN_U[x] : '') : EN_T[Math.floor(x / 10)] + (x % 10 ? '-' + EN_U[x % 10] : ''); return [c ? EN_U[c] + ' hundred' : '', t].filter(Boolean).join(' and '); };
export function enWords(n) {
  n = Math.floor(n); if (n === 0) return 'zero';
  const parts = []; for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) { const q = Math.floor(n / v); if (q) { parts.push(en999(q) + ' ' + w); n %= v; } }
  if (n) parts.push(en999(n));
  return parts.join(' ');
}
const UNIT = {
  fr: { TND: ['dinar', 'dinars', 'millime', 'millimes'], EUR: ['euro', 'euros', 'centime', 'centimes'], USD: ['dollar', 'dollars', 'cent', 'cents'] },
  en: { TND: ['dinar', 'dinars', 'millime', 'millimes'], EUR: ['euro', 'euros', 'cent', 'cents'], USD: ['dollar', 'dollars', 'cent', 'cents'] }
};
export function amountWords(v, cur, lang = 'fr') {
  if (!(v >= 0)) return '';
  const u = (UNIT[lang] || UNIT.fr)[cur]; if (!u) return '';
  const d = DEC[cur] ?? 2, k = 10 ** d, tot = Math.round(v * k), ent = Math.floor(tot / k), frac = tot % k;
  const W = lang === 'en' ? enWords : frWords;
  let s = `${W(ent)} ${ent > 1 ? u[1] : u[0]}`;
  if (frac) s += (lang === 'en' ? ' and ' : ' et ') + (cur === 'TND' ? `${frac} ${frac > 1 ? u[3] : u[2]}` : `${W(frac)} ${frac > 1 ? u[3] : u[2]}`);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
