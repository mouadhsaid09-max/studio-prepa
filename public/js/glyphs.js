// Pictogrammes abstraits au trait (style minimal, cinéma) : cadres, perforations, formes simples.
// Couleur = currentColor ; l'accent (orange) passe par la variable CSS --gl-a.
const S = (w, h, body, cls = '') => `<svg class="gl ${cls}" viewBox="0 0 ${w} ${h}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const perf = (x0, y, n, step) => Array.from({ length: n }, (_, i) => `<rect x="${x0 + i * step}" y="${y}" width="5" height="3.5" rx="1"/>`).join('');

export const GLYPH = {
  // Film : un seul cadre large 2.39:1, perforations, horizon
  film: () => S(120, 72, `<rect class="gl-fill" x="10" y="16" width="100" height="42" rx="3"/>${perf(14, 8, 12, 8.4)}${perf(14, 62.5, 12, 8.4)}<path d="M10 44h100" opacity=".35"/><circle class="gl-acc" cx="80" cy="32" r="6"/>`, 'big'),
  // Série : trois cadres en cascade, numérotés
  series: () => S(120, 72, `<rect x="30" y="6" width="74" height="32" rx="3" opacity=".35"/><rect x="22" y="16" width="74" height="32" rx="3" opacity=".6"/><rect class="gl-fill" x="14" y="26" width="74" height="32" rx="3"/><path d="M22 66h8M38 66h8M54 66h8" /><path class="gl-acc-s" d="M22 66h8"/>`, 'big'),
  // Canvas vierge : cadre vide et point
  blank: () => S(32, 32, `<rect x="5" y="8" width="22" height="16" rx="2"/><circle class="gl-acc" cx="16" cy="16" r="1.8"/>`),
  // Importer : page et flèche entrante
  import: () => S(32, 32, `<path d="M9 5h10l5 5v17H9z"/><path d="M19 5v5h5"/><path class="gl-acc-s" d="M16.5 13v9M13 18.5l3.5 3.5 3.5-3.5"/>`),
  // Exemple : bobine abstraite
  sample: () => S(32, 32, `<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="2"/><circle cx="16" cy="9.5" r="2.2"/><circle cx="22.2" cy="18" r="2.2"/><circle cx="9.8" cy="18" r="2.2"/><path class="gl-acc-s" d="M26 16h3"/>`),
  // Image / affiche
  image: () => S(32, 32, `<rect x="7" y="5" width="18" height="22" rx="2"/><path d="M7 21l5-5 4 4 3-3 6 6"/><circle class="gl-acc" cx="19" cy="11" r="2"/>`),
  // Petits pictos pour les dossiers (sur fond noir)
  filmS: () => S(24, 24, `<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M5.5 4.5h1M9.5 4.5h1M13.5 4.5h1M17.5 4.5h1M5.5 19.5h1M9.5 19.5h1M13.5 19.5h1M17.5 19.5h1"/><circle class="gl-acc" cx="15" cy="12" r="1.8"/>`),
  seriesS: () => S(24, 24, `<rect x="8" y="3.5" width="13" height="8" rx="1.2" opacity=".5"/><rect x="5.5" y="7.5" width="13" height="8" rx="1.2" opacity=".75"/><rect x="3" y="11.5" width="13" height="8" rx="1.2"/><circle class="gl-acc" cx="9.5" cy="15.5" r="1.6"/>`)
};
export const glyph = n => (GLYPH[n] || GLYPH.blank)();
