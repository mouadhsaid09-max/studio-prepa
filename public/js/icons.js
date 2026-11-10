// Icônes pleines en dégradé (orange → corail), détails blancs translucides, pièce arrière plus foncée.
let n = 0;
const defs = u => `<defs>
  <linearGradient id="${u}m" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="58"><stop offset="0" stop-color="#ffb45e"/><stop offset="1" stop-color="#ff6436"/></linearGradient>
  <linearGradient id="${u}d" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="58"><stop offset="0" stop-color="#ff7a3d"/><stop offset="1" stop-color="#ef4f24"/></linearGradient>
  <linearGradient id="${u}w" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="56"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".62"/></linearGradient>
  <linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc56b"/><stop offset=".5" stop-color="#ff6b4a"/><stop offset="1" stop-color="#b84dff"/></linearGradient>
</defs>`;
const M = u => `url(#${u}m)`, D = u => `url(#${u}d)`, Wt = u => `url(#${u}w)`, A = u => `url(#${u}a)`;
const spark = (u, x, y, r) => `<path d="M${x} ${y - r}c${r * .18} ${r * .62} ${r * .38} ${r * .82} ${r} ${r}c-${r * .62} ${r * .18}-${r * .82} ${r * .38}-${r} ${r}c-${r * .18}-${r * .62}-${r * .38}-${r * .82}-${r}-${r}c${r * .62}-${r * .18} ${r * .82}-${r * .38} ${r}-${r}z" fill="${Wt(u)}"/>`;

const ICONS = {
  // Bobine avec amorce
  film: u => `<rect x="28" y="45" width="28" height="8" rx="4" fill="${D(u)}"/><circle cx="29" cy="31" r="21" fill="${M(u)}"/>
    <circle cx="36" cy="21" r="4.6" fill="${Wt(u)}"/><circle cx="19.5" cy="28" r="4.6" fill="${Wt(u)}"/><circle cx="26" cy="43" r="4.6" fill="${Wt(u)}"/><circle cx="40" cy="36" r="4.6" fill="${Wt(u)}"/>`,
  // Scène / écran avec rideau (série)
  series: u => `<rect x="9" y="10" width="46" height="44" rx="10" fill="${M(u)}"/>
    <path d="M16 16h32v3c-5 8-10 11-16 11s-11-3-16-11z" fill="#fff" opacity=".38"/><path d="M23 16c2 6 5 9 9 9s7-3 9-9" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <path d="M9 38c11-5 35-5 46 0v6H9z" fill="${Wt(u)}"/><path d="M9 44h46a10 10 0 0 1-10 10H19A10 10 0 0 1 9 44z" fill="${D(u)}"/>
    <rect x="17" y="46" width="8" height="4" rx="1.5" fill="${Wt(u)}"/><rect x="28" y="46" width="8" height="4" rx="1.5" fill="${Wt(u)}"/><rect x="39" y="46" width="8" height="4" rx="1.5" fill="${Wt(u)}"/>`,
  // Publicité : mégaphone
  pub: u => `<path d="M14 36l4 15h7l-3-15z" fill="${D(u)}"/><rect x="8" y="24" width="12" height="15" rx="4" fill="${D(u)}"/>
    <path d="M17 24l26-12v39L17 39z" fill="${M(u)}"/><rect x="40" y="10" width="7" height="43" rx="3.5" fill="${M(u)}"/>
    <path d="M51 25a8 8 0 0 1 0 13" fill="none" stroke="${Wt(u)}" stroke-width="3" stroke-linecap="round"/><path d="M22 27l17-7" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>`,
  // Clip : billet avec note de musique
  clip: u => `<rect x="25" y="13" width="26" height="40" rx="4" transform="rotate(10 38 33)" fill="${D(u)}"/>
    <path d="M14 10h26a4 4 0 0 1 4 4v14a4 4 0 0 0 0 8v14a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V36a4 4 0 0 0 0-8V14a4 4 0 0 1 4-4z" fill="${M(u)}"/>
    <path d="M29 20v16" stroke="${Wt(u)}" stroke-width="3" stroke-linecap="round"/><path d="M29 20c4 0 6 2 7 5" fill="none" stroke="${Wt(u)}" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="38" r="5" fill="${Wt(u)}"/>`,
  // IA · publicité : signet avec étincelle
  'ai-pub': u => `<path d="M16 8h30a4 4 0 0 1 4 4v42l-19-8-19 8V12a4 4 0 0 1 4-4z" fill="${A(u)}"/><rect x="23" y="14" width="16" height="3.5" rx="1.75" fill="${Wt(u)}"/>${spark(u, 31, 33, 9)}${spark(u, 42, 24, 3.4)}`,
  // IA · mini-série : cadres empilés avec étincelle
  'ai-series': u => `<rect x="18" y="8" width="38" height="30" rx="7" fill="${D(u)}" opacity=".55"/><rect x="13" y="14" width="38" height="30" rx="7" fill="${D(u)}" opacity=".8"/><rect x="8" y="21" width="40" height="32" rx="8" fill="${A(u)}"/>${spark(u, 28, 37, 9)}${spark(u, 40, 29, 3.2)}`,
  // Départ : page blanche avec plus
  blank: u => `<rect x="15" y="12" width="34" height="42" rx="6" fill="${D(u)}" transform="rotate(8 32 33)"/><rect x="13" y="9" width="34" height="44" rx="6" fill="${M(u)}"/>
    <path d="M30 23v16M22 31h16" stroke="${Wt(u)}" stroke-width="4" stroke-linecap="round"/>`,
  // Importer : document avec flèche
  import: u => `<path d="M16 8h20l12 12v30a5 5 0 0 1-5 5H16a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z" fill="${M(u)}"/><path d="M36 8v8a4 4 0 0 0 4 4h8z" fill="${D(u)}"/>
    <path d="M29.5 26v16M23 36l6.5 6.5L36 36" fill="none" stroke="${Wt(u)}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Exemple : clap
  sample: u => `<rect x="8" y="26" width="46" height="28" rx="6" fill="${M(u)}"/><g transform="rotate(-14 10 24)"><rect x="8" y="14" width="46" height="10" rx="3" fill="${D(u)}"/>
    <path d="M16 14l-5 10h6l5-10zM29 14l-5 10h6l5-10zM42 14l-5 10h6l5-10z" fill="${Wt(u)}"/></g><path d="M16 36h22M16 43h14" stroke="${Wt(u)}" stroke-width="3.4" stroke-linecap="round"/>`,
  // Image / affiche
  image: u => `<rect x="9" y="12" width="46" height="40" rx="8" fill="${M(u)}"/><circle cx="41" cy="24" r="5" fill="${Wt(u)}"/><path d="M9 46l13-14 10 10 7-6 16 14v2a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8z" fill="${D(u)}"/><path d="M9 44l13-13 10 10" fill="none" stroke="${Wt(u)}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Personnage (fiche) : réalisateur à lunettes
  person: u => `<path d="M10 56c1-11 10-17 22-17s21 6 22 17z" fill="${M(u)}"/><path d="M29 40h6l-1 12-2 3-2-3z" fill="${D(u)}"/>
    <circle cx="32" cy="23" r="12" fill="${M(u)}"/><rect x="21" y="18" width="9" height="6" rx="2.4" fill="${Wt(u)}"/><rect x="34" y="18" width="9" height="6" rx="2.4" fill="${Wt(u)}"/><path d="M30 21h4" stroke="#fff" stroke-width="1.6"/><path d="M28 29c2 2 6 2 8 0" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2" stroke-linecap="round"/>`,
  // Prompt : bulle avec étincelle
  prompt: u => `<path d="M14 10h36a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H30l-11 9v-9h-5a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z" fill="${A(u)}"/>${spark(u, 32, 27, 9)}`,
  // Post-production : timeline de montage avec curseurs
  post: u => `<rect x="8" y="12" width="48" height="40" rx="8" fill="${M(u)}"/><rect x="14" y="20" width="22" height="7" rx="3.5" fill="${Wt(u)}"/><rect x="28" y="31" width="22" height="7" rx="3.5" fill="${D(u)}"/><rect x="14" y="42" width="14" height="5" rx="2.5" fill="${Wt(u)}" opacity=".8"/><path d="M40 15v34" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M36 13h8l-4 5z" fill="#fff"/>`,
  // Facture : feuille avec lignes et tampon
  invoice: u => `<path d="M14 8h30l8 8v38l-5-3-5 3-5-3-5 3-5-3-5 3-5-3-3 2V12a4 4 0 0 1 4-4z" fill="${M(u)}"/><path d="M20 20h16M20 27h22M20 34h12" stroke="${Wt(u)}" stroke-width="3.2" stroke-linecap="round"/><circle cx="41" cy="40" r="7" fill="${D(u)}"/><path d="M38 40l2 2 4-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Assistant : deux bulles avec étincelle
  assist: u => `<path d="M10 12h30a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H24l-9 7v-7h-5a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" fill="${A(u)}"/><path d="M48 24h4a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6h-2v6l-7-6H34a6 6 0 0 1-5-3" fill="${D(u)}" opacity=".7"/>${spark(u, 25, 25, 7.5)}`,
  // Style / palette
  style: u => `<path d="M32 9c13 0 24 9 24 21 0 7-5 10-10 10h-5c-3 0-5 3-3 6 2 4 0 9-6 9C19 55 8 45 8 32S19 9 32 9z" fill="${M(u)}"/><circle cx="21" cy="28" r="4.2" fill="${Wt(u)}"/><circle cx="30" cy="19" r="4.2" fill="${Wt(u)}"/><circle cx="42" cy="21" r="4.2" fill="${Wt(u)}"/><circle cx="21" cy="41" r="4.2" fill="${D(u)}"/>`
};

export function icon(name, size = 40) {
  const u = 'ic' + (++n);
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${defs(u)}${(ICONS[name] || ICONS.film)(u)}</svg>`;
}
