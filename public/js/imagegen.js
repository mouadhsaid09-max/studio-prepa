// Génération d'images : un seul point d'entrée pour toute l'app.
// En ligne : /api/image (Cloudflare FLUX, Together, Gemini « Nano Banana »… selon les clés Vercel).
// Si aucun service n'est branché ou qu'ils sont saturés : Pollinations chargé directement par le navigateur
// (gratuit, sans compte, limité par utilisateur).
let info = null;
export async function imageInfo() {
  if (info) return info;
  try { const r = await fetch('/api/image'); info = r.ok ? await r.json() : { providers: [] }; } catch { info = { providers: [] }; }
  return info;
}
const wait = (ms, signal) => new Promise((ok, ko) => { const t = setTimeout(ok, ms); signal?.addEventListener('abort', () => { clearTimeout(t); ko(Object.assign(new Error('Arrêté.'), { code: 'cancelled' })); }, { once: true }); });
const RATIOS = { '16:9': [1024, 576], '2.39:1': [1216, 512], '4:3': [1024, 768], '1:1': [1024, 1024], '9:16': [576, 1024], '3:2': [1024, 688] };

// Charge une URL d'image dans le navigateur (vérifie qu'elle existe vraiment)
function preload(url, ms = 120000) {
  return new Promise((ok, ko) => {
    const im = new Image(), t = setTimeout(() => { im.src = ''; ko(new Error('trop long')); }, ms);
    im.onload = () => { clearTimeout(t); im.naturalWidth > 40 ? ok(url) : ko(new Error('image vide')); };
    im.onerror = () => { clearTimeout(t); ko(new Error('refusée')); };
    im.src = url;
  });
}
// Une image en ligne (data:) devient un JPEG plus léger pour le stockage du navigateur
async function shrink(dataUrl, max = 1024) {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  try {
    const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = dataUrl; });
    const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } catch { return dataUrl; }
}

export function pollinationsUrl(prompt, ratio, seed) {
  const [w, h] = RATIOS[ratio] || RATIOS['16:9'];
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1400))}?width=${w}&height=${h}&seed=${seed}&model=flux&nologo=true&enhance=false`;
}

// { prompt, ratio, seed, refs, project, signal, onStatus } → URL de l'image
export async function makeImage(o) {
  const seed = o.seed ?? Math.floor(Math.random() * 1e6), st = o.onStatus || (() => { });
  const { providers = [] } = await imageInfo();
  if (providers.length) {
    for (let tryN = 0; tryN < 3; tryN++) {
      const r = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: o.signal, body: JSON.stringify({ prompt: o.prompt, ratio: o.ratio, seed, refs: o.refs || [], project: o.project }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) return { url: await shrink(j.url), provider: j.provider };
      if (r.status === 429) { for (let s = j.retryAfter || 20; s > 0; s--) { st(`saturé · nouvel essai dans ${s} s`); await wait(1000, o.signal); } continue; }
      break; // autre erreur : on passe à Pollinations direct
    }
  }
  for (let tryN = 0; tryN < 4; tryN++) {
    if (o.signal?.aborted) throw Object.assign(new Error('Arrêté.'), { code: 'cancelled' });
    try { const url = await preload(pollinationsUrl(o.prompt, o.ratio, seed + tryN * 7)); return { url, provider: 'pollinations' }; }
    catch { for (let s = 16; s > 0; s--) { st(`file d’attente gratuite · ${s} s`); await wait(1000, o.signal); } }
  }
  throw new Error('Le service d’images gratuit ne répond pas. Réessayez dans un moment.');
}
