// Formats de projet
export const FORMATS = [
  { id: 'film', label: 'Film', sub: 'Long ou court métrage', icon: 'film', short: 'Film' },
  { id: 'series', label: 'Série', sub: 'Plusieurs épisodes', icon: 'series', eps: true, short: 'Série' },
  { id: 'pub', label: 'Publicité', sub: 'Spot, film de marque', icon: 'pub', short: 'Pub' },
  { id: 'clip', label: 'Clip musical', sub: 'Vidéo pour une chanson', icon: 'clip', short: 'Clip' },
  { id: 'ai-pub', label: 'Publicité IA', sub: 'Spot généré avec l’IA', icon: 'ai-pub', ai: true, short: 'Pub IA' },
  { id: 'ai-series', label: 'Mini-série IA', sub: 'Épisodes générés avec l’IA', icon: 'ai-series', ai: true, eps: true, short: 'Mini-série IA' }
];
export const fmt = id => FORMATS.find(f => f.id === id) || FORMATS[0];
export const formatOf = p => (p && p.format && FORMATS.some(f => f.id === p.format)) ? p.format : (p && ((Array.isArray(p.episodes) && p.episodes.length) || p.episodes > 0) ? 'series' : 'film');
export const isAI = p => !!fmt(formatOf(p)).ai;
