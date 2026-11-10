// Analyse du scénario, plan de travail, utilitaires partagés
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const fmtE = e => { const p = Math.floor(e / 8), r = e % 8; return ((p ? p : '') + (p && r ? ' ' : '') + (r ? r + '/8' : '')) || '0'; };
export function parseE(s) {
  if (s == null) return null; s = String(s).trim(); let m;
  if ((m = s.match(/^(\d+)\s+(\d+)\/8$/))) return +m[1] * 8 + +m[2];
  if ((m = s.match(/^(\d+)\/8$/))) return +m[1];
  if (/^\d+([.,]\d+)?$/.test(s)) return Math.round(parseFloat(s.replace(',', '.')) * 8);
  return null;
}
export const toMin = s => { const [h, m] = (s || '08:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const hm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + 'h' + String(m % 60).padStart(2, '0'); };
let DATE_LOCALE = 'fr-FR';
export const setDateLocale = l => { DATE_LOCALE = l || 'fr-FR'; };
export const fdate = d => d.toLocaleDateString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
export const fdateL = d => d.toLocaleDateString(DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const cls = s => (s.ie === 'INT' ? 'i' : 'e') + (s.night ? 'n' : 'j');
export function nextMonday() { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export const DEFAULT_SETTINGS = () => ({ prod: '', real: '', start: nextMonday(), dpw: 5, pat: '08:00', patN: '17:00', hpd: 10, mpp: 75, setup: 30, move: 45, shotMin: 15 });

const TIMES = ['FIN DE JOURNÉE', 'APRÈS-MIDI', 'CRÉPUSCULE', 'CREPUSCULE', 'CONTINUOUS', 'PLUS TARD', 'CONTINU', 'MATIN', 'NIGHT', 'DUSK', 'DAWN', 'LATER', 'JOUR', 'NUIT', 'SOIR', 'AUBE', 'MIDI', 'SUITE', 'DAY'];
const TMAP = { DAY: 'JOUR', NIGHT: 'NUIT', DUSK: 'CRÉPUSCULE', CREPUSCULE: 'CRÉPUSCULE', DAWN: 'AUBE', LATER: 'PLUS TARD', CONTINUOUS: 'CONTINU' };
const B = '[\\s\\-–—/.,()]';
// Scénarios en arabe : « 3. داخلي - مطبخ - نهار » ou « مشهد 3 - خارجي - ليل »
const AR_DIGITS = /[٠-٩]/g;
function arabicHeading(t) {
  if (!/[\u0600-\u06FF]/.test(t)) return t;
  let x = t.replace(AR_DIGITS, d => String(d.charCodeAt(0) - 0x660)).replace(/^\s*مشهد\s*/, '');
  const w = (a, b) => { x = x.replace(new RegExp('(^|[\\s\\-–—/.,:(])(' + a + ')(?=$|[\\s\\-–—/.,:)])', 'g'), '$1' + b); };
  w('داخلي\\s*/\\s*خارجي|داخلي-خارجي', 'INT/EXT'); w('خارجي\\s*/\\s*داخلي', 'INT/EXT'); w('داخلي|داخل', 'INT'); w('خارجي|خارج', 'EXT');
  w('نهارا|نهار|صباحا|صباح|ظهرا|ظهر', 'JOUR'); w('ليلا|ليل|مساء|مساءً', 'NUIT'); w('فجر|الفجر', 'AUBE'); w('غروب|الغروب', 'CRÉPUSCULE');
  return /\b(INT|EXT)\b/.test(x) ? x.replace(/^\s*(\d+[A-Z]?)\s*[.\-–—:)]?\s*([^]*?)\s*[-–—]\s*(INT\/EXT|INT|EXT)\b/, '$1. $3 - $2') : t;
}
export function heading(line) {
  const t = arabicHeading(line.trim());
  if (!t || t.length > 120) return null;
  const m = t.match(/^#?(?:(?:S[ÉE]Q(?:UENCE)?|SC(?:[ÈE]NE)?)\s*\.?\s*)?(\d+[A-Z]?)?\s*[.\-–—:)]?\s*(INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\/E|INT|EXT)(?![A-Za-zÀ-ÿ])\.?\s*[-–—\/.]?\s*(.*)$/);
  if (!m) return null;
  let rest = m[3] || '', time = '';
  const up = rest.toUpperCase();
  for (const w of TIMES) {
    const re = new RegExp('(^|' + B + ')' + rx(w) + '(?=$|' + B + ')');
    if (re.test(up)) { time = w; rest = rest.replace(new RegExp('(^|' + B + ')' + rx(w) + '(?=$|' + B + ')', 'i'), '$1'); break; }
  }
  if (!time && rest.length > 70) return null;
  const decor = rest.replace(/#\d+[A-Z]?#\s*$/, '').replace(/^[\s\-–—\/.,]+|[\s\-–—\/.,]+$/g, '').replace(/\s*[-–—]\s*([-–—]\s*)+/g, ' - ').replace(/\s{2,}/g, ' ').trim();
  const ieRaw = m[2].replace(/[\s.]/g, '');
  return { num: m[1] || '', ie: ieRaw.includes('/') ? 'INT/EXT' : ieRaw, timeRaw: TMAP[time] || time, decor: decor.toUpperCase() || 'DÉCOR ?' };
}
const TRANS = /^(FONDU|CUT|COUPE|COUPURE|ENCHA[IÎ]N|FADE|FIN\b|NOIR|SMASH|DISSOLVE|TITRE|CARTON|INSERT|FLASH|INTERCUT|RETOUR|BACK|SUPER|THE END|G[ÉE]N[ÉE]RIQUE|NOTE)/;
function cue(t) {
  let inline = null;
  if (/^[\u0600-\u06FF]/.test(t)) {
    const mi = t.match(/^([\u0600-\u06FF ]{2,24}?)\s*(\([^)]*\))?\s*[:：]\s*(.+)$/);
    if (mi) return { name: mi[1].trim(), inline: mi[3] };
    const n = t.replace(/\([^)]*\)/g, '').replace(/[:：]\s*$/, '').trim();
    if (n.split(/\s+/).length <= 2 && n.length <= 24 && !/[.!?؟،,…]/.test(n) && /[:：]$|^[\u0600-\u06FF ]+$/.test(t)) return { name: n, inline: null };
    return null;
  }
  const mi = t.match(/^([A-ZÀ-ÖØ-Þ'’ .\-]{2,32}?)\s*(\([^)]*\))?\s*:\s*(.+)$/);
  if (mi && /[A-ZÀ-Þ]{2}/.test(mi[1])) { t = mi[1]; inline = mi[3]; }
  else if (t !== t.toUpperCase() || !/[A-ZÀ-Þ]{2}/.test(t) || t.length > 40 || /[.!?…]$/.test(t)) return null;
  if (TRANS.test(t)) return null;
  const n = t.replace(/\([^)]*\)/g, '').replace(/:+\s*$/, '').replace(/\s+/g, ' ').trim();
  if (!n || n.split(' ').length > 4 || /\d/.test(n)) return null;
  return { name: n, inline };
}
export const DICT = {
  acc: ['valise', 'valises', 'sac à dos', 'sac à main', 'sac', 'sacoche', 'cartable', 'lettre', 'lettres', 'enveloppe', 'colis', 'paquet', 'téléphone', 'portable', 'smartphone', 'clé', 'clés', 'trousseau', 'couteau', 'ciseaux', 'verre', 'verres', 'tasse', 'tasses', 'bol', 'assiette', 'plateau', 'bouteille', 'carafe', 'théière', 'cafetière', 'cigarette', 'cigarettes', 'cigare', 'briquet', 'allumettes', 'cendrier', 'livre', 'livres', 'cahier', 'journal', 'magazine', 'photo', 'photos', 'cadre', 'billet', 'billets', 'ticket', 'carnet', 'stylo', 'crayon', 'pinceau', 'pinceaux', 'palette', 'toile', 'chevalet', 'peinture', 'ordinateur', 'tablette', 'appareil photo', 'caméra', 'micro', 'casque', 'écouteurs', 'montre', 'horloge', 'réveil', 'bague', 'collier', 'bracelet', 'boucles d\'oreilles', 'lunettes', 'parapluie', 'miroir', 'mouchoir', 'mouchoirs', 'serviette', 'portefeuille', 'porte-monnaie', 'argent', 'pièce', 'carte', 'passeport', 'bougie', 'bougies', 'lampe', 'torche', 'lampe torche', 'corde', 'marteau', 'tournevis', 'arme', 'revolver', 'bouquet', 'fleurs', 'rose', 'cadeau', 'gâteau', 'pain', 'radio', 'guitare', 'violon', 'piano', 'oud', 'ballon', 'jouet', 'poupée', 'chapelet', 'coran', 'bible', 'médicaments', 'seringue', 'fiole', 'flacon', 'parfum', 'rouge à lèvres', 'minibar', 'mini bar',
        'suitcase', 'bag', 'handbag', 'purse', 'backpack', 'letter', 'envelope', 'parcel', 'phone', 'mobile', 'key', 'keys', 'knife', 'scissors', 'glass', 'glasses', 'cup', 'mug', 'plate', 'tray', 'bottle', 'jug', 'cigarette', 'cigar', 'lighter', 'matches', 'ashtray', 'book', 'notebook', 'newspaper', 'magazine', 'photo', 'photograph', 'frame', 'ticket', 'pen', 'pencil', 'brush', 'paintbrush', 'canvas', 'easel', 'laptop', 'computer', 'tablet', 'camera', 'microphone', 'headphones', 'watch', 'clock', 'ring', 'necklace', 'bracelet', 'earrings', 'sunglasses', 'umbrella', 'mirror', 'tissue', 'tissues', 'towel', 'wallet', 'money', 'coin', 'card', 'passport', 'candle', 'lamp', 'torch', 'flashlight', 'rope', 'hammer', 'pistol', 'flowers', 'bouquet', 'gift', 'present', 'cake', 'bread', 'guitar', 'violin', 'ball', 'toy', 'doll', 'pills', 'syringe', 'perfume', 'lipstick', 'mini bar', 'minibar', 'wine', 'champagne'],
  cos: ['robe', 'robe de soirée', 'costume', 'tailleur', 'chemise', 'chemisier', 't-shirt', 'pull', 'gilet', 'veste', 'blouson', 'manteau', 'imperméable', 'trench', 'jupe', 'pantalon', 'jean', 'short', 'uniforme', 'blouse', 'tablier', 'pyjama', 'peignoir', 'maillot', 'cravate', 'nœud papillon', 'écharpe', 'foulard', 'voile', 'hijab', 'chapeau', 'casquette', 'chéchia', 'jebba', 'burnous', 'kachabia', 'djellaba', 'gants', 'chaussures', 'baskets', 'talons', 'bottes', 'sandales', 'pieds nus', 'tenue', 'déguisement',
        'dress', 'party dress', 'gown', 'suit', 'tuxedo', 'shirt', 'blouse', 't-shirt', 'sweater', 'jumper', 'jacket', 'coat', 'raincoat', 'skirt', 'trousers', 'pants', 'jeans', 'shorts', 'uniform', 'apron', 'pyjamas', 'bathrobe', 'tie', 'bow tie', 'scarf', 'headscarf', 'hat', 'cap', 'gloves', 'shoes', 'trainers', 'sneakers', 'heels', 'boots', 'sandals', 'barefoot', 'outfit', 'costume'],
  hmc: ['maquillage', 'maquillée', 'maquillé', 'démaquillé', 'rouge à lèvres', 'mascara', 'fond de teint', 'perruque', 'moustache', 'barbe', 'chignon', 'tresse', 'tresses', 'coiffure', 'coiffée', 'cheveux mouillés', 'cicatrice', 'ecchymose', 'hématome', 'plaie', 'sueur', 'larmes', 'tatouage', 'henné', 'khôl', 'vieilli',
        'make up', 'makeup', 'make-up', 'lipstick', 'mascara', 'foundation', 'wig', 'moustache', 'beard', 'bun', 'braid', 'braids', 'hair done', 'hairdo', 'wet hair', 'scar', 'bruise', 'wound', 'sweat', 'tears', 'tattoo', 'henna', 'kohl'],
  veh: ['voiture', 'taxi', 'louage', 'moto', 'scooter', 'mobylette', 'autobus', 'bus', 'camion', 'camionnette', 'vélo', 'train', 'tramway', 'métro', 'ambulance', 'voiture de police', 'bateau', 'barque', 'avion', 'hélicoptère', 'charrette', 'ascenseur', 'car', 'cab', 'truck', 'motorcycle', 'motorbike', 'bike', 'bicycle', 'boat', 'van', 'plane', 'helicopter', 'lift', 'elevator', 'police car'],
  ani: ['chien', 'chiens', 'chiot', 'chat', 'chats', 'chaton', 'cheval', 'chevaux', 'âne', 'chèvre', 'mouton', 'moutons', 'vache', 'poule', 'poules', 'coq', 'oiseau', 'oiseaux', 'pigeon', 'pigeons', 'mouette', 'chameau', 'dromadaire', 'poisson', 'poissons', 'abeille', 'abeilles', 'serpent', 'tortue', 'lapin', 'souris', 'rat', 'dog', 'dogs', 'puppy', 'cat', 'cats', 'kitten', 'horse', 'donkey', 'goat', 'sheep', 'cow', 'chicken', 'bird', 'birds', 'pigeon', 'seagull', 'camel', 'fish', 'bee', 'bees', 'snake', 'rabbit', 'mouse'],
  casc: ['bagarre', 'se battent', 'se bat', 'frappe', 'gifle', 'chute', 'tombe à terre', 'trébuche', 'saute', 'poursuite', 'court après', 'renverse', 'percute', 'accident', 's\'effondre', 'fight', 'punches', 'slaps', 'falls', 'stumble', 'stumbles', 'jumps', 'chase', 'crash', 'collapses'],
  sfx: ['explosion', 'explose', 'feu', 'incendie', 'flammes', 'fumée', 'pluie', 'orage', 'neige', 'vent', 'brouillard', 'coup de feu', 'coups de feu', 'pistolet', 'fusil', 'sang', 'blessure', 'éclair', 'écran vert', 'fire', 'flames', 'smoke', 'rain', 'storm', 'snow', 'wind', 'fog', 'gunshot', 'gun', 'blood', 'lightning', 'green screen'],
  fig: ['foule', 'passants', 'voyageurs', 'clients', 'habitués', 'élèves', 'invités', 'serveur', 'serveuse', 'policiers', 'passagers', 'badauds', 'public', 'danseurs', 'couple', 'crowd', 'passers-by', 'passengers', 'customers', 'guests', 'waiter', 'waitress', 'police officers', 'dancers', 'audience'],
  son: ['musique', 'chanson', 'radio', 'télévision', 'télé', 'téléphone sonne', 'sonnerie', 'haut-parleur', 'klaxon', 'ping', 'music', 'song', 'tv', 'loudspeaker', 'phone rings', 'ringtone', 'doorbell']
};
// Groupe nominal : « bouteille » devient « bouteille de vin rouge », « bottle » devient « bottle of red wine »
const STOP = new Set('a an and the from in on at to with for by as is are was his her their its it et le la les un une des du sur dans avec pour par sous qui que quand puis mais ou où il elle ils elles son sa ses leur leurs ce cette eux lui nous vous moi toi soi se main mains face côté train cours plus moins fois tout toute tous him them me us you there here'.split(' '));
const COMPL = "(?:\\s+(?:of(?:\\s+the)?|de(?:\\s+la|\\s+l')?|d'|du|des|à|au|aux|en)\\s*([\\p{L}-]{2,})(?:\\s+([\\p{L}-]{2,}))?)?";
function detect(text, list) {
  const low = text.toLowerCase().replace(/[’]/g, "'"), f = [], seen = new Set();
  [...list].sort((a, b) => b.length - a.length).forEach(w => {
    const re = new RegExp('(^|[^\\p{L}])' + rx(w) + '(?![\\p{L}])' + COMPL, 'gu'); let m;
    while ((m = re.exec(low))) {
      let label = w;
      if (m[2] && !STOP.has(m[2])) { const glue = m[0].slice(m[1].length + w.length).match(/^\s+(?:of(?:\s+the)?|de(?:\s+la|\s+l')?|d'|du|des|à|au|aux|en)\s*/u)[0]; label = w + glue + m[2] + (m[3] && !STOP.has(m[3]) ? ' ' + m[3] : ''); label = label.replace(/\s+/g, ' ').replace(/'\s+/, "'"); }
      // un mot déjà compris dans un groupe plus long n'est pas répété (« sac » dans « sac à main »)
      if ([...seen].some(x => x.includes(w) && x !== label)) continue;
      if (!seen.has(label)) { seen.add(label); f.push(label); }
    }
  });
  return f.join(', ');
}

// ---------- Mentions « @ » : @Nom ou @[plusieurs mots] dans le scénario ----------
// La catégorie (personnage, lieu, accessoire…) est choisie par l'utilisateur et gardée dans project.tags[nom en minuscules].
export const MENTION_CATS = [['ch', 'Personnage'], ['pl', 'Lieu'], ['acc', 'Accessoire'], ['cos', 'Costume'], ['hmc', 'HMC'], ['veh', 'Véhicule'], ['ani', 'Animal'], ['fig', 'Figuration'], ['casc', 'Cascade'], ['sfx', 'SFX / VFX'], ['son', 'Son / musique']];
const MENTION_RX = /@\[([^\]\n]{1,60})\]|@([\p{L}\p{N}][\p{L}\p{N}_'’-]{0,40})/gu;
export const mentionsIn = text => { const out = []; String(text || '').replace(MENTION_RX, (m, a, b) => { const n = (a || b).replace(/_/g, ' ').trim(); if (n) out.push(n); return m; }); return out; };
export const stripMentions = text => String(text || '').replace(MENTION_RX, (m, a, b) => (a || b).replace(/_/g, ' '));
export const mentionToken = name => /[^\p{L}\p{N}_'’-]/u.test(name) ? '@[' + name + ']' : '@' + name;

// Découpe un texte en scènes brutes (sans numérotation finale ni rôles)
function rawScenes(text) {
  const L = String(text || '').replace(/\r/g, '').split('\n');
  const scenes = []; let cur = null, mode = 'action';
  for (let i = 0; i < L.length; i++) {
    const t = L[i].trim();
    const h = heading(t);
    if (h) { cur = { ...h, line: i, action: [], dialog: [], cues: new Set(), lines: 2 }; scenes.push(cur); mode = 'action'; continue; }
    if (!cur) continue;
    if (!t) { cur.lines += 1; if (mode === 'dialog') mode = 'action'; continue; }
    if (mode === 'cue') { cur.dialog.push(t); cur.lines += Math.ceil(t.length / 35); if (!/^\(.*\)$/.test(t)) mode = 'dialog'; continue; }
    if (mode === 'dialog') { cur.dialog.push(t); cur.lines += Math.ceil(t.length / 35); continue; }
    const c = cue(t);
    if (c) {
      if (c.inline) { cur.cues.add(c.name); cur.dialog.push(c.inline); cur.lines += 1 + Math.ceil(c.inline.length / 35); continue; }
      let j = i + 1; while (j < L.length && !L[j].trim() && j < i + 3) j++;
      const nx = (L[j] || '').trim();
      if (nx && !heading(nx) && !cue(nx)) { cur.cues.add(c.name); mode = 'cue'; cur.lines += 1; continue; }
    }
    cur.action.push(t); cur.lines += Math.ceil(t.length / 60);
  }
  return scenes;
}
// Numérotation, effets, éléments détectés et rôles (film ou série)
function finalize(scenes, series) {
  let prevNight = false, prevEp = null; const warns = []; let autoNum = false; const seen = new Set(); const counter = {};
  scenes.forEach((s, i) => {
    s.idx = i;
    if (s.ep !== prevEp) { prevNight = false; prevEp = s.ep; }
    counter[s.ep || 0] = (counter[s.ep || 0] || 0) + 1;
    if (!s.num) { s.num = String(counter[s.ep || 0]); autoNum = true; }
    s.localNum = s.num;
    if (series) s.num = s.ep + '.' + s.localNum;
    const tr = s.timeRaw;
    if (/NUIT|SOIR|CRÉPUSCULE/.test(tr)) s.night = true;
    else if (/JOUR|MATIN|AUBE|MIDI|APRÈS-MIDI|FIN DE JOURNÉE/.test(tr)) s.night = false;
    else { s.night = prevNight; if (!tr) warns.push('Sc. ' + s.num + ' : moment (JOUR/NUIT) absent, repris de la scène précédente.'); }
    s.timeL = tr || (s.night ? 'NUIT?' : 'JOUR?');
    prevNight = s.night;
    s.dk = s.decor.split(/\s+[-–—]\s+|\s*\/\s*/)[0].trim();
    // Clé stable : numéro de scène, préfixé par l'identifiant (et non la position) de l'épisode
    let k = series ? s.epId + ':' + s.localNum : s.num;
    if (seen.has(k)) { k = k + '·' + i; warns.push('Numéro de scène ' + s.num + ' en double.'); } seen.add(k); s.k = k;
    s.autoE = Math.max(1, Math.round(s.lines / 55 * 8));
    s.mentions = [...new Set(mentionsIn(s.action.join(' ')))];
    s.action = s.action.map(stripMentions);
    const act = s.action.join(' ');
    const first = (act.match(/^.*?[.!?](\s|$)/) || [act])[0].trim();
    s.summary = first.length > 120 ? first.slice(0, 117) + '…' : first;
    s.det = {}; Object.keys(DICT).forEach(k2 => s.det[k2] = detect(act, DICT[k2]));
    s.actText = act;
  });
  if (autoNum) warns.unshift('Scènes non numérotées dans le texte : numérotation automatique.');
  const R = new Map();
  scenes.forEach(s => s.cues.forEach(n => { if (!R.has(n)) R.set(n, { name: n, speak: new Set(), present: new Set() }); R.get(n).speak.add(s.idx); }));
  R.forEach(r => {
    const keys = [r.name]; const w = r.name.split(' '); if (w.length > 1 && w[w.length - 1].length >= 4) keys.push(w[w.length - 1]);
    scenes.forEach(s => {
      if (r.speak.has(s.idx)) return;
      if (keys.some(k => k.length >= 3 && new RegExp('(^|[^\\p{L}])' + rx(k) + '(?![\\p{L}])', 'iu').test(s.actText))) r.present.add(s.idx);
    });
  });
  const roles = [...R.values()].map(r => ({ ...r, all: [...new Set([...r.speak, ...r.present])].sort((a, b) => a - b) }))
    .sort((a, b) => b.all.length - a.all.length || a.all[0] - b.all[0]);
  roles.forEach((r, i) => {
    r.id = i + 1; const share = r.all.length / Math.max(1, scenes.length);
    r.cat = (i === 0 || share >= 0.4) && r.all.length > 1 ? 'Principal' : r.all.length > 1 ? 'Secondaire' : 'Silhouette';
  });
  scenes.forEach(s => { s.roles = roles.filter(r => r.all.includes(s.idx)); });
  return { scenes, roles, warns };
}
export function parse(text) { return finalize(rawScenes(text), false); }
// Clip musical : paroles découpées en sections [Couplet 1 0:12] EXT. PLAGE - JOUR
// Lignes entre parenthèses = images / intentions ; « Avec : A, B » = artistes à l'écran ; le reste = paroles.
const SEC = /^\[([^\]]{1,60})\]\s*(.*)$/;
const TC = /(\d{1,2}:\d{2})/;
function lyricsScenes(text) {
  const L = String(text || '').replace(/\r/g, '').split('\n'), out = [];
  let cur = null, loc = { ie: 'INT', timeRaw: '', decor: 'DÉCOR ?' };
  const setLoc = h => { loc = { ie: h.ie, timeRaw: h.timeRaw, decor: h.decor }; if (cur) Object.assign(cur, loc); };
  for (let i = 0; i < L.length; i++) {
    const t = L[i].trim(), m = t.match(SEC);
    if (m) {
      const lab = m[1].trim(), tc = (lab.match(TC) || [])[1] || '';
      cur = { num: '', ...loc, line: i, action: [], dialog: [], lyrics: [], cues: new Set(), lines: 2, sec: lab.replace(TC, '').replace(/[\s\-–—·|]+$/, '').trim() || lab, tc };
      out.push(cur);
      const h = m[2] && heading(m[2]); if (h) setLoc(h); else if (m[2]) cur.action.push(m[2]);
      continue;
    }
    if (!cur) { const h = heading(t); if (h) setLoc(h); continue; }
    if (!t) { cur.lines += 1; continue; }
    const h = heading(t); if (h) { setLoc(h); continue; }
    const w = t.match(/^(?:avec|with|feat\.?|مع)\s*[:：]\s*(.+)$/i);
    if (w) { w[1].split(/\s*[,;،&]\s*|\s+et\s+|\s+and\s+/).map(x => x.trim().toUpperCase()).filter(Boolean).forEach(n => cur.cues.add(n)); continue; }
    if (/^\(.*\)$/.test(t) || /^>/.test(t)) { cur.action.push(t.replace(/^[(>]\s*|\s*\)$/g, '')); cur.lines += 1; continue; }
    cur.lyrics.push(t); cur.lines += 1;
  }
  let prevCast = new Set();
  out.forEach(s => {
    if (!s.timeRaw) s.timeRaw = 'JOUR';
    if (!s.cues.size) s.cues = new Set([...prevCast].slice(0, 1)); else prevCast = s.cues; // sans « Avec : », l'artiste principal·e reste à l'écran
    const first = s.action[0] || (s.lyrics[0] ? '« ' + s.lyrics[0] + ' »' : '');
    s.action.unshift(s.sec + (s.tc ? ' ' + s.tc : '') + (first ? ' — ' + first.replace(/[.!?]$/, '') : '') + '.');
    s.dialog = s.lyrics.slice();
  });
  return out;
}
export const isClip = project => !!project && project.format === 'clip';
export const isSeries = project => Array.isArray(project.episodes) && project.episodes.length > 0;
export function parseProject(project) {
  if (isClip(project) && !isSeries(project)) { const P = finalize(lyricsScenes(project.script), false); P.clip = true; P.warns = P.warns.filter(w => !/non numérotées/.test(w)); return P; }
  if (!isSeries(project)) return parse(project.script);
  const raw = [];
  project.episodes.forEach((ep, i) => rawScenes(ep.script).forEach(s => raw.push({ ...s, ep: i + 1, epId: ep.id, epName: ep.name || 'Épisode ' + (i + 1) })));
  const P = finalize(raw, true); P.series = true; P.episodes = project.episodes.map((ep, i) => ({ id: ep.id, n: i + 1, name: ep.name || 'Épisode ' + (i + 1) }));
  return P;
}

// ---------- Estimation du temps de tournage ----------
export const LIGHT_ORDER = ['ej', 'ij', 'in', 'en']; // Extérieur jour → Intérieur jour → Intérieur nuit → Extérieur nuit
export const lightKey = s => (s.ie === 'INT' ? 'i' : 'e') + (s.night ? 'n' : 'j');
export function estimate(s, set, edits) {
  const o = parseInt(edits['est.' + s.k]); if (o > 0) return o;
  const v = c => (edits['bd.' + s.k + '.' + c] ?? s.det[c]) || '';
  // Avec un découpage, le temps suit le nombre de plans ; sinon la longueur de la scène
  let m = (+set.setup || 30) + (s.shots ? s.shots * (+set.shotMin || 15) : s.e / 8 * (+set.mpp || 75));
  if (v('casc')) m += 45; if (v('sfx')) m += 30; if (v('fig')) m += 20; if (v('veh')) m += 30; if (v('ani')) m += 30;
  if (s.night) m *= 1.15;
  return Math.max(15, Math.round(m / 5) * 5);
}
export const fmtMin = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? String(r).padStart(2, '0') : '') : r + ' min'; };
const hm2 = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
// Durée de la journée : heures de début et de fin si elles sont réglées, sinon « journée de travail (h) »
export const dayLength = set => { const a = hm2(set.pat), b = hm2(set.endT); if (a != null && b != null) return ((b - a + 1440) % 1440) || 600; return (+set.hpd || 10) * 60; };
export const dayCapacity = set => Math.max(60, dayLength(set) - 60); // journée moins la pause repas
// Jours de repos chaque semaine (0 = dimanche … 6 = samedi) : réglage « off », sinon ancien réglage « jours / semaine »
export const offDays = set => { if (Array.isArray(set.off)) return set.off.map(Number); const dpw = +set.dpw || 5; return dpw >= 7 ? [] : dpw == 6 ? [0] : [0, 6]; };
export const extraOff = set => (Array.isArray(set.extraOff) ? set.extraOff : []).filter(x => x && x.d);
export function isOff(set, d) { const x = iso(d); return offDays(set).includes(d.getDay()) || extraOff(set).some(o => x >= o.d && x <= (o.to || o.d)); }

// Indisponibilités d'un comédien : [{from, to}] en dates ISO
export function unavail(edits, name) { try { return JSON.parse(edits['unav.' + name] || '[]'); } catch (e) { return []; } }
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const isUnavail = (edits, name, date) => { const x = iso(date); return unavail(edits, name).some(r => x >= r.from && x <= (r.to || r.from)); };

function isWork(d, dpw) { const w = d.getDay(); if (dpw >= 7) return true; if (dpw == 6) return w !== 0; return w !== 0 && w !== 6; }
export function stripOrder(edits) { try { const a = JSON.parse(edits['strip.order'] || 'null'); return Array.isArray(a) ? a : null; } catch (e) { return null; } }
export function plan(P, set, edits) {
  const cap = dayCapacity(set), moveMin = +set.move || 45;
  P.scenes.forEach(s => { const e = parseE(edits['bd.' + s.k + '.e']); s.e = e != null && e > 0 ? e : s.autoE; s.est = estimate(s, set, edits); s.light = lightKey(s); });
  const days = [];
  const nd = night => { const d = { night, sc: [], e: 0 }; days.push(d); return d; };
  const manual = stripOrder(edits);
  if (manual) {
    // Ordre manuel du stripboard (glisser-déposer) : « | » = fin de journée
    const byK = new Map(P.scenes.map(s => [s.k, s])), used = new Set();
    let cur = nd(false);
    manual.forEach(t => { if (t === '|') { cur = nd(false); return; } const s = byK.get(t); if (s && !used.has(t)) { cur.sc.push(s); used.add(t); } });
    const rest = P.scenes.filter(s => !used.has(s.k));
    if (rest.length) { cur = nd(false); rest.forEach(s => cur.sc.push(s)); }
  } else {
    // Ordre automatique : EXT JOUR → INT JOUR → INT NUIT → EXT NUIT, décors regroupés, quota de temps par journée
    const firstSeen = new Map(); P.scenes.forEach(s => { if (!firstSeen.has(s.dk)) firstSeen.set(s.dk, firstSeen.size); });
    const ordered = [...P.scenes].sort((a, b) => LIGHT_ORDER.indexOf(a.light) - LIGHT_ORDER.indexOf(b.light) || firstSeen.get(a.dk) - firstSeen.get(b.dk) || a.idx - b.idx);
    let cur = null, used = 0, last = null;
    ordered.forEach(s => {
      const extra = cur && cur.sc.length && last !== s.dk ? moveMin : 0;
      if (!cur || cur.night !== s.night || (cur.sc.length && used + extra + s.est > cap)) { cur = nd(s.night); used = 0; last = null; }
      used += (cur.sc.length && last !== s.dk ? moveMin : 0) + s.est; cur.sc.push(s); last = s.dk;
    });
    // Ancien réglage « jour imposé » (fiches scène d'avant le glisser-déposer)
    P.scenes.filter(s => parseInt(edits['day.' + s.k]) > 0).forEach(s => {
      const f = parseInt(edits['day.' + s.k]);
      days.forEach(dd => { const i = dd.sc.indexOf(s); if (i >= 0) dd.sc.splice(i, 1); });
      while (days.length < f) nd(s.night);
      days[f - 1].sc.push(s);
    });
  }
  if (!manual) for (let i = days.length - 1; i >= 0; i--) if (!days[i].sc.length) days.splice(i, 1);
  if (!days.length) nd(false);
  let d = new Date((set.start || nextMonday()) + 'T12:00:00'); if (isNaN(d)) d = new Date();
  if (offDays(set).length >= 7) set = { ...set, off: [] };
  days.forEach((day, i) => {
    day.n = i + 1;
    day.night = day.sc.length > 0 && day.sc.every(s => s.night); day.mixed = !day.night && day.sc.some(s => s.night);
    day.e = day.sc.reduce((a, s) => a + s.e, 0);
    day.moves = 0; let prev = null; day.sc.forEach(s => { if (prev && prev !== s.dk) day.moves++; prev = s.dk; s.day = day.n; });
    day.min = day.sc.reduce((a, s) => a + s.est, 0) + day.moves * moveMin;
    day.over = day.min > cap;
    let guard = 0; while (isOff(set, d) && guard++ < 400) d.setDate(d.getDate() + 1);
    day.date = new Date(d); d.setDate(d.getDate() + 1);
    day.roles = P.roles.filter(r => day.sc.some(s => s.roles.includes(r)));
    day.conflicts = day.roles.filter(r => isUnavail(edits, r.name, day.date)).map(r => r.name);
  });
  P.roles.forEach(r => { r.days = days.filter(dd => dd.roles.includes(r)).map(dd => dd.n - 1); });
  const avg = P.scenes.length ? P.scenes.reduce((a, s) => a + s.est, 0) / P.scenes.length : 60;
  const last = days[days.length - 1]?.date; P.wrapLate = !!(set.end && last && iso(last) > set.end);
  P.days = days; P.cap = cap; P.moveMin = moveMin; P.quota = Math.max(1, Math.floor(cap / avg)); P.manual = !!manual;
  return P;
}
// Transforme le plan actuel en ordre manuel (pour déplacer une scène ou une coupure)
export const orderFromDays = days => days.flatMap((d, i) => (i ? ['|'] : []).concat(d.sc.map(s => s.k)));
// Catégorie d'une mention : choix de l'utilisateur, sinon personnage connu ou mot du dictionnaire
export function mentionCat(P, tags, name) {
  const k = name.toLowerCase();
  if (tags[k]) return tags[k];
  if (P.roles.some(r => r.name.toLowerCase() === k)) return 'ch';
  for (const c of Object.keys(DICT)) if (DICT[c].includes(k)) return c;
  return null;
}
function applyMentions(P, tags, ignore = []) {
  const un = new Set(), ign = new Set(ignore.map(x => String(x).toLowerCase()));
  // Mots classés en les sélectionnant dans le texte : on les retrouve dans chaque scène, comme une mention « @ »
  const tagRx = Object.keys(tags).filter(n => n.length > 1).map(n => [n, new RegExp('(^|[^\\p{L}\\p{N}])' + rx(n) + '(?![\\p{L}\\p{N}])', 'iu')]);
  P.scenes.forEach(s => {
    s.places = [];
    const txt = s.action.join(' ').replace(/[’]/g, "'");
    s.mentions = s.mentions || [];
    tagRx.forEach(([n, re]) => { if (re.test(txt) && !s.mentions.some(m => m.toLowerCase() === n)) s.mentions.push(n); });
    // Mots retirés : plus détectés ni surlignés
    if (ign.size) Object.keys(s.det).forEach(c => { s.det[c] = (s.det[c] || '').split(/\s*,\s*/).filter(x => x && !ign.has(x.toLowerCase())).join(', '); });
    s.mentions = s.mentions.filter(n => !ign.has(n.toLowerCase()));
    (s.mentions || []).forEach(n => {
      const c = mentionCat(P, tags, n) || (un.add(n), 'acc');
      if (c === 'ch') {
        let r = P.roles.find(x => x.name.toLowerCase() === n.toLowerCase());
        if (!r) { r = { name: n.toUpperCase(), speak: new Set(), present: new Set(), all: [], id: P.roles.length + 1, cat: 'Silhouette', tagged: true }; P.roles.push(r); }
        if (!r.all.includes(s.idx)) { r.all.push(s.idx); r.all.sort((a, b) => a - b); }
        if (!s.roles.includes(r)) s.roles.push(r);
      } else if (c === 'pl') { if (!s.places.includes(n)) s.places.push(n); }
      else { const cur = (s.det[c] || '').split(/\s*,\s*/).filter(Boolean); if (!cur.some(x => x.toLowerCase() === n.toLowerCase())) s.det[c] = [...cur, n.toLowerCase()].join(', '); }
    });
  });
  P.untagged = [...un];
}
export function analyse(project) {
  const set = { ...DEFAULT_SETTINGS(), ...(project.settings || {}) }, edits = project.edits || {};
  const P = parseProject(project);
  // Modifications faites dans les fiches (sans toucher au texte du scénario)
  P.scenes.forEach(s => {
    const o = f => edits['ov.' + s.k + '.' + f];
    if (o('decor') && o('decor').trim()) { s.decor = o('decor').trim().toUpperCase(); s.dk = s.decor.split(/\s+[-–—]\s+|\s*\/\s*/)[0].trim(); }
    if (o('ie')) s.ie = o('ie');
    if (o('time')) { s.timeL = o('time'); s.night = /NUIT|SOIR|CRÉPUSCULE/.test(o('time')); }
    if (o('summary') != null) s.summary = o('summary');
    s.ovr = ['decor', 'ie', 'time', 'summary'].some(f => o(f) != null && o(f) !== '') || parseInt(edits['est.' + s.k]) > 0;
  });
  applyMentions(P, project.tags || {}, project.ignore || []);
  // Éléments trouvés par l'IA (dépouillement « Compléter avec l'IA ») : project.found[clé de scène][catégorie] = [noms]
  Object.entries(project.found || {}).forEach(([k, f]) => { const sc = P.scenes.find(x => x.k === k); if (!sc) return; Object.entries(f).forEach(([c, list]) => { if (!(c in sc.det)) return; const cur = (sc.det[c] || '').split(/\s*,\s*/).filter(Boolean); (list || []).forEach(n => { n = String(n).toLowerCase().trim(); if (n && !cur.some(x => x.includes(n) || n.includes(x))) cur.push(n); }); sc.det[c] = cur.join(', '); }); });
  P.roles.forEach(r => { const c = edits['cat.' + r.name]; if (c) r.cat = c; });
  const shots = project.shots || {}; P.scenes.forEach(s => { s.shots = (shots[s.k] || []).length; });
  return plan(P, set, edits);
}
// Différences entre deux analyses (pour signaler ce qui a changé)
export function diff(a, b) {
  if (!a) return null;
  const sig = s => [s.ie, s.night, s.decor, s.roles.map(r => r.name).sort().join(','), s.autoE, s.summary].join('|');
  const A = new Map(a.scenes.map(s => [s.k, sig(s)])), Bm = new Map(b.scenes.map(s => [s.k, sig(s)]));
  let add = 0, del = 0, chg = 0;
  Bm.forEach((v, k) => { if (!A.has(k)) add++; else if (A.get(k) !== v) chg++; });
  A.forEach((v, k) => { if (!Bm.has(k)) del++; });
  const ra = new Set(a.roles.map(r => r.name)), rb = new Set(b.roles.map(r => r.name));
  const newRoles = [...rb].filter(x => !ra.has(x)), goneRoles = [...ra].filter(x => !rb.has(x));
  const dayDelta = b.days.length - a.days.length;
  if (!add && !del && !chg && !newRoles.length && !goneRoles.length) return null;
  return { add, del, chg, newRoles, goneRoles, dayDelta, days: b.days.length };
}

export const SAMPLE = `LE DERNIER TRAIN

1. EXT. GARE DE TUNIS - QUAI - JOUR

Le quai est noyé de monde. Des voyageurs pressés, une foule bruyante. YASMINE (28 ans), valise à la main, cherche quelqu'un des yeux. Un haut-parleur annonce un retard.

YASMINE
Il avait promis d'être là.

KARIM (60 ans), le chef de gare, s'approche.

KARIM
Mademoiselle, le train de Sousse ne partira pas avant ce soir.

2. INT. APPARTEMENT DE YASMINE - CUISINE - JOUR

Une petite cuisine. La radio diffuse une vieille chanson. Yasmine pose sa valise, sort une lettre de son sac.

YASMINE
(lisant)
Je t'attendrai au dernier train.

Son téléphone sonne. Elle ne répond pas.

3. EXT. RUE DE LA MÉDINA - JOUR

Yasmine marche vite entre les passants. Un scooter la frôle. Elle trébuche et tombe à terre, la lettre s'envole. OMAR (30 ans) ramasse la lettre et la lui tend.

OMAR
Vous avez perdu ça.

YASMINE
Merci... On se connaît ?

OMAR
Pas encore.

4. INT. CAFÉ EL ALI - JOUR

Un café plein d'habitués. Omar et Yasmine sont assis à une table, deux tasses entre eux.

OMAR
Le dernier train, c'est celui de vingt-trois heures.

YASMINE
Alors j'ai encore le temps.

LE SERVEUR
Deux autres cafés ?

5. EXT. GARE DE TUNIS - PARKING - NUIT

La pluie tombe. Un taxi s'arrête. Yasmine en sort, trempée. Karim fume une cigarette sous l'auvent.

KARIM
Vous revoilà.

YASMINE
Il est arrivé ?

Karim secoue la tête.

6. INT. GARE DE TUNIS - SALLE D'ATTENTE - NUIT

La salle est presque vide. Yasmine relit la lettre. Omar entre, essoufflé.

OMAR
Je savais que vous seriez là.

YASMINE
Vous m'avez suivie ?

OMAR
Non. C'est moi qui ai écrit la lettre.

Silence. L'horloge marque 22h58.

7. EXT. GARE DE TUNIS - QUAI - NUIT

Le dernier train entre en gare dans un nuage de fumée. Yasmine et Omar se font face. Karim les observe de loin.

YASMINE
Pourquoi ?

OMAR
Parce que vous ne seriez jamais venue sinon.

Elle monte dans le train. Il la suit.

8. INT. TRAIN - COMPARTIMENT - NUIT

Yasmine et Omar, assis face à face. Le paysage défile dans le noir.

YASMINE
Et maintenant ?

OMAR
Maintenant, on rentre.

FONDU AU NOIR.`;

export const COLS_ALL = [['fig', 'Silhouettes / figuration'], ['acc', 'Accessoires'], ['cos', 'Costumes'], ['hmc', 'HMC'], ['veh', 'Véhicules'], ['ani', 'Animaux'], ['casc', 'Cascades'], ['sfx', 'SFX / VFX'], ['son', 'Son / musique'], ['rem', 'Remarques']];
// Calcul d'une feuille de service (partagé entre l'écran et l'export PDF)
export const NEEDS = [['acc', 'Accessoires'], ['cos', 'Costumes'], ['hmc', 'HMC'], ['veh', 'Véhicules'], ['ani', 'Animaux'], ['casc', 'Cascades'], ['sfx', 'SFX / VFX'], ['son', 'Son / musique']];
export const CREW = [['Régie', -90], ['Mise en scène', -60], ['Image / électro / machino', -60], ['Son', -45], ['HMC / costumes', -90], ['Décoration / accessoires', -75]];
export function callSheet(P, project, dayIdx) {
  const set = { ...DEFAULT_SETTINGS(), ...(project.settings || {}) }, edits = project.edits || {};
  const d = P.days[dayIdx], mpe = 540 / P.cap, pat = toMin(edits['fds.' + d.n + '.pat'] || (d.night ? set.patN : set.pat));
  let t = pat, lunch = false, prev = null; const rows = [], first = {};
  d.sc.forEach(s => {
    if (prev && s.dk !== prev) { rows.push({ type: 'move', at: t, label: 'Déplacement → ' + s.dk }); t += P.moveMin || 45; }
    if (!lunch && t - pat >= 330) { rows.push({ type: 'meal', at: t, label: 'Pause repas (1 h)' }); t += 60; lunch = true; }
    rows.push({ type: 'scene', at: t, s, atL: edits['fds.' + d.n + '.t.' + s.k] || hm(t), key: 'fds.' + d.n + '.t.' + s.k });
    s.roles.forEach(r => { if (first[r.id] == null) first[r.id] = t; });
    t += s.est; prev = s.dk;
  });
  const val = (s, k) => (edits['bd.' + s.k + '.' + k] ?? s.det[k]) || '';
  const hmcMin = r => r.cat === 'Principal' ? 75 : r.cat === 'Secondaire' ? 45 : 30;
  const cast = [...d.roles].sort((a, b) => a.id - b.id).map(r => {
    const ready = first[r.id], h = hmcMin(r);
    const ck = f => 'fds.' + d.n + '.cast.' + r.name + '.' + f;
    return { r, actor: edits['cast.' + r.name + '.n'] || '', arrive: ready - h - 15, hmc: ready - h, ready, ck,
      arriveL: edits[ck('arr')] || hm(ready - h - 15), hmcL: edits[ck('hmc')] || hm(ready - h), readyL: edits[ck('ready')] || hm(ready),
      scenes: d.sc.filter(s => s.roles.includes(r)).map(s => s.num) };
  });
  const needs = NEEDS.map(([k, l]) => [k, l, [...new Set(d.sc.map(s => val(s, k)).filter(Boolean).flatMap(v => v.split(/\s*,\s*/)))].join(', ')]).filter(x => x[2]);
  const fig = d.sc.filter(s => val(s, 'fig')).map(s => ({ s, text: val(s, 'fig'), note: edits['fds.' + d.n + '.fig.' + s.k] || '' }));
  const crew = CREW.map(([n, o]) => [n, edits['fds.' + d.n + '.crew.' + n] || hm(pat + o)]);
  const decors = [...new Set(d.sc.map(s => s.dk))].map(k => ({ k, addr: edits['addr.' + k] || '', park: edits['park.' + k] || '' }));
  return { d, set, mpe, pat, rows, end: t + 30, cast, needs, fig, crew, decors, val, next: P.days[dayIdx + 1] };
}

// ---------- Bible du film : film, personnages, lieux, objets ----------
export const GENRES = ['Comédie', 'Drame', 'Horreur', 'Thriller', 'Romance', 'Action', 'Science-fiction', 'Fantastique', 'Policier', 'Aventure', 'Documentaire', 'Animation', 'Musical', 'Historique', 'Western', 'Expérimental'];
export const FILM_FIELDS = [['logline', 'Logline', 'area', 'Le film en une ou deux phrases'], ['synopsis', 'Synopsis', 'area', 'Résumé de l’histoire'], ['style', 'Style visuel / ton', 'area', 'Ex. : réalisme poétique, lumière naturelle, caméra épaule'], ['format', 'Format', 'select', ['', 'Court métrage', 'Long métrage', 'Série', 'Clip', 'Publicité', 'Documentaire']], ['duree', 'Durée visée', 'text', 'Ex. : 12 min'], ['ratio', 'Image', 'text', 'Ex. : 2.39:1, couleur, 4K']];
export const KIND = {
  ch: { label: 'Personnage', plural: 'Personnages', add: 'Ajouter un personnage', fields: [
    ['age', 'Âge', 'text', 'Ex. : 28 ans'], ['height', 'Taille', 'text', 'Ex. : 1,70 m'], ['style', 'Style / registre', 'text', 'Ex. : comique, inquiétant, romantique'],
    ['look', 'Look / costume', 'area', 'Vêtements, coiffure, accessoires'], ['desc', 'Description', 'area', 'Physique, personnalité, histoire'],
    ['actor', 'Comédien·ne', 'text', 'Nom'], ['contact', 'Contact', 'text', 'Tél. / e-mail'], ['notes', 'Notes', 'area', '']] },
  pl: { label: 'Lieu', plural: 'Lieux', add: 'Ajouter un lieu', fields: [
    ['address', 'Adresse', 'text', 'Rue, ville'], ['type', 'Type', 'select', ['', 'Intérieur', 'Extérieur', 'Intérieur et extérieur']],
    ['style', 'Ambiance / style', 'text', 'Ex. : années 70, délabré, lumineux'], ['desc', 'Description', 'area', 'Ce qu’on y voit, ce qu’il faut adapter'],
    ['permit', 'Autorisation', 'select', ['', 'À demander', 'Demandée', 'Obtenue', 'Refusée']], ['contact', 'Contact sur place', 'text', 'Nom · tél.'],
    ['parking', 'Parking / cantine', 'text', ''], ['notes', 'Notes', 'area', '']] },
  ob: { label: 'Objet', plural: 'Objets', add: 'Ajouter un objet', fields: [
    ['cat', 'Catégorie', 'select', ['', 'Accessoire', 'Costume', 'HMC', 'Véhicule', 'Animal', 'Figuration', 'Cascade', 'SFX / VFX', 'Son / musique']],
    ['desc', 'Description', 'area', 'Taille, couleur, état'], ['style', 'Style / époque', 'text', 'Ex. : vintage années 60'], ['qty', 'Quantité', 'text', 'Ex. : 2 (dont 1 doublure)'],
    ['status', 'Statut', 'select', ['', 'À trouver', 'Trouvé', 'Acheté', 'Loué', 'Fabriqué']], ['owner', 'Responsable', 'text', 'Déco, accessoiriste…'],
    ['scenes', 'Scènes', 'text', 'Ex. : 2, 5, 7'], ['notes', 'Notes', 'area', '']] }
};
// Clé de modification d'un champ (certains champs sont partagés avec la liste artistique et les feuilles de service)
export function bibKey(key, f) {
  if (key.startsWith('ch:r:')) { const n = key.slice(5); if (f === 'actor') return 'cast.' + n + '.n'; if (f === 'contact') return 'cast.' + n + '.c'; }
  if (key.startsWith('pl:d:')) { const n = key.slice(5); if (f === 'address') return 'addr.' + n; if (f === 'parking') return 'park.' + n; }
  return 'bib.' + key + '.' + f;
}
export function bible(project, P) {
  const b = project.bible || {}, e = project.edits || {}, hidden = new Set(b.hidden || []);
  const val = (key, f) => e[bibKey(key, f)] || '';
  const custom = (kind, list) => (list || []).map(c => ({ key: kind + ':c:' + c.id, id: c.id, name: val(kind + ':c:' + c.id, 'name') || 'Sans nom', auto: false, catLabel: kind === 'ob' ? val(kind + ':c:' + c.id, 'cat') : '' }));
  // Une fiche ajoutée à la main (ou par « @ ») qui porte le même nom qu'un élément trouvé dans le scénario n'apparaît qu'une fois
  const uniq = (auto, cust) => { const n = new Set(cust.map(c => c.name.toLowerCase())); return auto.filter(a => !n.has(a.name.toLowerCase())).concat(cust); };
  const chars = uniq(P.roles.map(r => ({ key: 'ch:r:' + r.name, name: r.name, auto: true, role: r, scenes: r.all.map(i => P.scenes[i].num) })), custom('ch', b.chars));
  const pmap = new Map();
  P.scenes.forEach(s => { if (!pmap.has(s.dk)) pmap.set(s.dk, { key: 'pl:d:' + s.dk, name: s.dk, auto: true, scenes: [], ie: new Set() }); const p = pmap.get(s.dk); p.scenes.push(s.num); p.ie.add(s.ie); });
  P.scenes.forEach(s => (s.places || []).forEach(n => { const k = n.toUpperCase(); if (!pmap.has(k)) pmap.set(k, { key: 'pl:d:' + k, name: k, auto: true, scenes: [], ie: new Set() }); const p = pmap.get(k); if (!p.scenes.includes(s.num)) p.scenes.push(s.num); }));
  const places = uniq([...pmap.values()], custom('pl', b.places));
  const omap = new Map();
  P.scenes.forEach(s => {
    const v = (e['bd.' + s.k + '.acc'] ?? s.det.acc) || '';
    v.split(/\s*[,;]\s*/).map(x => x.trim()).filter(Boolean).forEach(n => { const k = n.toLowerCase(); if (!omap.has(k)) omap.set(k, { key: 'ob:a:' + k, name: n.charAt(0).toUpperCase() + n.slice(1), auto: true, scenes: [] }); omap.get(k).scenes.push(s.num); });
  });
  // Éléments appelés par « @ » dans le scénario (costume, véhicule, animal…) : aussi dans la Bible
  const tags = project.tags || {}, CL = Object.fromEntries(MENTION_CATS);
  P.scenes.forEach(s => (s.mentions || []).forEach(n => { const c = mentionCat(P, tags, n) || 'acc'; if (c === 'ch' || c === 'pl') return; const k = n.toLowerCase(); if (!omap.has(k)) omap.set(k, { key: 'ob:a:' + k, name: n.charAt(0).toUpperCase() + n.slice(1), auto: true, scenes: [], catLabel: CL[c] }); const o = omap.get(k); if (!o.scenes.includes(s.num)) o.scenes.push(s.num); }));
  const objects = uniq([...omap.values()], custom('ob', b.objects));
  const vis = l => l.filter(x => !hidden.has(x.key));
  const film = { genres: (e['film.genres'] || '').split(',').map(x => x.trim()).filter(Boolean) };
  FILM_FIELDS.forEach(([f]) => film[f] = e['film.' + f] || '');
  return { film, ch: vis(chars), pl: vis(places), ob: vis(objects), hidden: [...chars, ...places, ...objects].filter(x => hidden.has(x.key)), val };
}

// ---------- Découpage technique ----------
export const SHOT = {
  size: ['', 'Plan d’ensemble', 'Plan large', 'Plan moyen', 'Plan américain', 'Plan rapproché', 'Gros plan', 'Très gros plan', 'Insert'],
  angle: ['', 'Face', 'Profil', 'Trois-quarts', 'Plongée', 'Contre-plongée', 'Subjective', 'Vue aérienne', 'Champ', 'Contrechamp', 'Amorce'],
  move: ['', 'Fixe', 'Panoramique', 'Travelling avant', 'Travelling arrière', 'Travelling latéral', 'Steadicam', 'Caméra épaule', 'Grue', 'Drone', 'Zoom']
};
export const shotLabel = (s, i) => s.localNum + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '');

// Exemple de clip musical (paroles originales)
export const SAMPLE_CLIP = `TUNIS LA NUIT — clip musical

[Intro 0:00] EXT. TOITS DE LA MÉDINA - NUIT
(Plan large sur les toits, la ville scintille. Amina de dos, les cheveux au vent.)
Avec : Amina

[Couplet 1 0:14] INT. CHAMBRE D'AMINA - NUIT
(Une seule lampe. Elle écrit dans un carnet, puis regarde la fenêtre.)
J'ai rangé les mots dans un tiroir
Les lettres jamais envoyées
La ville dort, moi je veux croire
Qu'un matin va se lever

[Pré-refrain 0:38] EXT. RUELLE DE LA MÉDINA - NUIT
(Elle descend les escaliers en courant, la caméra recule devant elle.)
J'entends battre les portes
Comme un cœur qui se réveille

[Refrain 0:52] EXT. PLACE DU MARCHÉ - NUIT
Avec : Amina, Danseurs
(Les danseurs l'entourent sous les guirlandes de lumière.)
Danse, danse, Tunis la nuit
Allume les rues, rallume ma vie
Danse, danse, jusqu'au matin
Je laisse la peur sur le chemin

[Couplet 2 1:20] INT. CAFÉ - NUIT
Avec : Amina, Karim
(Karim au comptoir. Leurs regards se croisent dans le miroir.)
Un café froid, un vieux refrain
Ta voix qui chante entre deux trains
On se connaît sans se le dire
Il reste encore tant à écrire

[Pont 2:05] EXT. PLAGE - AUBE
(Seule face à la mer, ralenti, la lumière bleue arrive.)
Et si la nuit n'était qu'un pont
Entre ce qu'on tait et ce qu'on est

[Refrain final 2:30] EXT. PLACE DU MARCHÉ - JOUR
Avec : Amina, Danseurs, Karim
(Même chorégraphie, en plein jour, la place est pleine.)
Danse, danse, Tunis la nuit
Allume les rues, rallume ma vie

[Outro 3:05] EXT. TOITS DE LA MÉDINA - AUBE
Avec : Amina
(Le soleil se lève. Elle sourit à la caméra. Noir.)
`;

// Exemple pour les formats IA : publicité de parfum (marque fictive), avec des mentions « @ »
export const SAMPLE_AI = `ZAHRA — eau de parfum
Publicité générée avec l'IA · 45 secondes

1. EXT. DÉSERT DE TOZEUR - DUNES - AUBE

Le vent soulève le sable. @LINA (25 ans), dans une longue @[robe safran], marche pieds nus vers le soleil levant. Elle tient un @[flacon de verre ambré]. Des @[grains de sable] s'élèvent en spirale autour d'elle.

LINA (V.O.)
Il y a des parfums qui se souviennent de nous.

2. INT. ATELIER DE PARFUMEUR - MÉDINA - JOUR

Lumière dorée à travers un moucharabieh. Des dizaines de @fioles sur une étagère en bois. @SALMA (60 ans), la parfumeuse, foulard indigo, verse une goutte d'essence de @[fleur d'oranger] dans le flacon.

SALMA
Chaque goutte garde un lieu.

3. EXT. JARDIN DE FLEURS D'ORANGER - JOUR

Ralenti. Des pétales blancs tombent comme une pluie. Lina tourne sur elle-même, la @[robe safran] s'ouvre en corolle. Des @abeilles dansent dans la lumière.

4. INT. ATELIER DE PARFUMEUR - MÉDINA - JOUR

Très gros plan : le @[flacon de verre ambré] se remplit, la lumière traverse le liquide. Le visage de Lina se reflète dans le verre.

5. EXT. TOITS DE LA MÉDINA - CRÉPUSCULE

Lina sur la terrasse, le ciel devient rose. Elle ouvre le flacon. Une @[brume dorée] s'échappe et dessine dans l'air les dunes du début.

LINA (V.O.)
Zahra. L'Orient en une goutte.

6. INT. STUDIO - FOND NOIR - NUIT

Plan produit. Le flacon tourne lentement sur un socle de @[sable noir]. Le nom ZAHRA apparaît en lettres d'or.

LINA (V.O.)
Zahra, eau de parfum.
`;
const sid = n => 'z' + n;
export const SAMPLE_AI_SETUP = {
  tags: { 'lina': 'ch', 'salma': 'ch', 'robe safran': 'cos', 'flacon de verre ambré': 'acc', 'grains de sable': 'sfx', 'fioles': 'acc', "fleur d'oranger": 'acc', 'abeilles': 'ani', 'brume dorée': 'sfx', 'sable noir': 'acc' },
  ai: {
    style: { ratio: '16:9', light: 'golden hour, warm backlight, soft haze', palette: 'saffron, amber gold, indigo, desert sand', neg: 'blurry, distorted faces, extra fingers, text, watermark, logo' },
    skills: [
      { id: 'pubstudio', name: 'Pub produit studio', text: 'premium commercial look, clean studio lighting, glossy reflections, product hero framing, high-end advertising photography', on: true },
      { id: 'cine35', name: 'Cinéma 35 mm', text: 'cinematic film still, shot on 35mm film, anamorphic lens, natural film grain, shallow depth of field, motivated lighting', on: true }
    ],
    chars: {
      LINA: { token: '@lina', look: '25-year-old Tunisian woman, long dark wavy hair, warm olive skin, almond-shaped brown eyes, natural makeup', outfit: 'flowing saffron silk dress, barefoot, thin gold bracelet', voice: 'soft, warm, intimate whisper, French with a light Arabic accent' },
      SALMA: { token: '@salma', look: '60-year-old Tunisian woman, silver hair in a low bun, deep laugh lines, kind dark eyes', outfit: 'indigo headscarf, linen artisan apron, brass rings', voice: 'calm, low, wise' }
    },
    shots: {}
  },
  shots: {
    '1': [{ id: sid(1), size: 'Plan d’ensemble', angle: 'Face', move: 'Drone', lens: '24mm', desc: 'Lina walks barefoot on the dunes toward the rising sun, sand swirling around her', sound: 'wind', dur: '5' },
          { id: sid(2), size: 'Insert', angle: 'Profil', move: 'Travelling latéral', lens: '85mm', desc: 'the amber glass bottle in her hand, sand grains rising in a spiral', sound: '', dur: '3' }],
    '2': [{ id: sid(3), size: 'Plan moyen', angle: 'Trois-quarts', move: 'Travelling avant', lens: '35mm', desc: 'Salma pours one drop of orange blossom essence into the bottle, golden light through a mashrabiya', sound: 'drop', dur: '5' }],
    '3': [{ id: sid(4), size: 'Plan large', angle: 'Contre-plongée', move: 'Steadicam', lens: '35mm', desc: 'slow motion, Lina spins, the saffron dress opens like a flower, white petals falling', sound: 'music swells', dur: '5' }],
    '4': [{ id: sid(5), size: 'Très gros plan', angle: 'Face', move: 'Fixe', lens: '100mm macro', desc: 'the amber bottle fills, light passes through the liquid, Lina’s face reflected in the glass', sound: '', dur: '4' }],
    '5': [{ id: sid(6), size: 'Plan rapproché', angle: 'Profil', move: 'Panoramique', lens: '50mm', desc: 'on a rooftop at dusk Lina opens the bottle, a golden mist draws the dunes in the air', sound: '', dur: '5' }],
    '6': [{ id: sid(7), size: 'Gros plan', angle: 'Face', move: 'Travelling avant', lens: '100mm macro', desc: 'product shot, the bottle turns slowly on a base of black sand, black background, gold rim light', sound: 'music hit', dur: '4' }]
  }
};
