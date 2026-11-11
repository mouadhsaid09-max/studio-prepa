// Images IA pour le site en ligne (protégé par le code d'accès).
// Services essayés dans cet ordre, selon les clés ajoutées dans Vercel → Settings → Environment Variables :
//   1. GEMINI_IMAGE_KEY   — Google « Nano Banana » (gemini-2.5-flash-image). Payant (~0,04 $ l'image) mais le meilleur
//                           pour garder le même visage : on lui envoie la fiche du personnage en image de référence.
//   2. CF_ACCOUNT_ID + CF_API_TOKEN — Cloudflare Workers AI, FLUX.1 schnell, gratuit (10 000 « neurones » par jour,
//                           soit environ 150 images 16:9 par jour), sans carte bancaire.
//   3. TOGETHER_API_KEY   — Together AI, FLUX.1 schnell gratuit.
//   4. POLLINATIONS_KEY   — Pollinations avec clé.
// Sans aucune clé, l'app charge les images Pollinations directement depuis le navigateur de chaque utilisateur.
// Si BLOB_READ_WRITE_TOKEN est présent (Vercel Blob), les images sont rangées dans le stockage Vercel et l'app ne garde que leur lien.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), w = (hits.get(ip) || []).filter(t => now - t < 60000);
  w.push(now); hits.set(ip, w); return w.length > 24;
}

function providers() {
  const e = process.env, l = [];
  if (e.GEMINI_IMAGE_KEY) l.push('gemini');
  if (e.CF_ACCOUNT_ID && e.CF_API_TOKEN) l.push('cloudflare');
  if (e.TOGETHER_API_KEY) l.push('together');
  if (e.POLLINATIONS_KEY) l.push('pollinations');
  return l;
}
const RATIO = r => { const [a, b] = String(r || '16:9').split(':').map(Number); return a && b ? a / b : 16 / 9; };
const dims = (ratio, long = 1024) => { const q = RATIO(ratio); const w = q >= 1 ? long : Math.round(long * q / 16) * 16, h = q >= 1 ? Math.round(long / q / 16) * 16 : long; return [w, h]; };
const GEM_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

async function toB64(url) {
  if (url.startsWith('data:')) { const m = /^data:([^;]+);base64,(.*)$/.exec(url); return m ? { mime: m[1], data: m[2] } : null; }
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (!r.ok) return null;
  return { mime: r.headers.get('content-type') || 'image/jpeg', data: Buffer.from(await r.arrayBuffer()).toString('base64') };
}

async function run(name, b) {
  const e = process.env, [w, h] = dims(b.ratio);
  if (name === 'gemini') {
    const parts = [{ text: b.prompt + (b.refs?.length ? '\nKeep each character exactly as in the reference images (same face, hair, costume).' : '') }];
    for (const u of (b.refs || []).slice(0, 3)) { const x = await toB64(u).catch(() => null); if (x) parts.push({ inline_data: { mime_type: x.mime, data: x.data } }); }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${e.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': e.GEMINI_IMAGE_KEY },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: GEM_RATIOS.includes(b.ratio) ? b.ratio : '16:9' } } }), signal: AbortSignal.timeout(60000)
    });
    const j = await r.json().catch(() => ({}));
    const img = j?.candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
    if (!img) return { status: r.status === 429 ? 429 : 502, error: j?.error?.message || 'Gemini : pas d’image' };
    const d = img.inlineData || img.inline_data; return { mime: d.mimeType || d.mime_type || 'image/png', data: d.data };
  }
  if (name === 'cloudflare') {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${e.CF_ACCOUNT_ID}/ai/run/${e.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'}`, {
      method: 'POST', headers: { Authorization: `Bearer ${e.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: `${b.prompt.slice(0, 1900)}. Wide ${b.ratio || '16:9'} cinematic framing.`, steps: 8 }), signal: AbortSignal.timeout(60000) // FLUX schnell : seulement prompt + steps (image carrée 1024)
    });
    const j = await r.json().catch(() => ({}));
    if (!j?.result?.image) return { status: r.status === 429 ? 429 : 502, error: j?.errors?.[0]?.message || 'Cloudflare : pas d’image' };
    return { mime: 'image/jpeg', data: j.result.image };
  }
  if (name === 'together') {
    const r = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST', headers: { Authorization: `Bearer ${e.TOGETHER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: e.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell-Free', prompt: b.prompt.slice(0, 2000), width: w, height: h, steps: 4, n: 1, seed: b.seed, response_format: 'b64_json' }), signal: AbortSignal.timeout(60000)
    });
    const j = await r.json().catch(() => ({}));
    const d = j?.data?.[0]; if (!d) return { status: r.status === 429 ? 429 : 502, error: j?.error?.message || 'Together : pas d’image' };
    if (d.b64_json) return { mime: 'image/jpeg', data: d.b64_json };
    const x = await toB64(d.url); return x || { status: 502, error: 'Together : image illisible' };
  }
  if (name === 'pollinations') {
    const u = `https://gen.pollinations.ai/image/${encodeURIComponent(b.prompt.slice(0, 1500))}?model=${e.POLLINATIONS_IMAGE_MODEL || 'flux'}&width=${w}&height=${h}&seed=${b.seed}&nologo=true`;
    const r = await fetch(u, { headers: { Authorization: `Bearer ${e.POLLINATIONS_KEY}` }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) return { status: r.status === 429 ? 429 : 502, error: 'Pollinations : erreur ' + r.status };
    return { mime: r.headers.get('content-type') || 'image/jpeg', data: Buffer.from(await r.arrayBuffer()).toString('base64') };
  }
  return { status: 400, error: 'Service inconnu' };
}

async function store(img, b) {
  const tok = process.env.BLOB_READ_WRITE_TOKEN;
  if (!tok) return `data:${img.mime};base64,${img.data}`;
  try {
    const { put } = await import('@vercel/blob');
    const ext = /png/.test(img.mime) ? 'png' : 'jpg';
    const r = await put(`goset/${String(b.project || 'x').replace(/[^a-z0-9]/gi, '')}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`, Buffer.from(img.data, 'base64'), { access: 'public', contentType: img.mime, token: tok });
    return r.url;
  } catch { return `data:${img.mime};base64,${img.data}`; }
}

export async function POST(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return Response.json({ error: 'Trop d’images d’un coup : attendez une minute.', retryAfter: 20 }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  b.prompt = String(b.prompt || '').trim(); b.seed = Math.abs(parseInt(b.seed, 10) || Math.floor(Math.random() * 1e6)) % 2147483647;
  b.refs = Array.isArray(b.refs) ? b.refs.filter(u => typeof u === 'string' && /^(https:|data:image\/)/.test(u)).slice(0, 3) : [];
  if (!b.prompt) return Response.json({ error: 'Décrivez l’image' }, { status: 400 });
  const list = providers(); if (!list.length) return Response.json({ error: 'Aucun service d’image configuré', direct: true }, { status: 503 });
  let last = null, wait = 0;
  for (const name of list) {
    const out = await run(name, b).catch(er => ({ status: 502, error: String(er.message || er) }));
    if (out.data) return Response.json({ url: await store(out, b), provider: name });
    last = out; if (out.status === 429) wait = 20;
  }
  return Response.json({ error: last?.error || 'Image impossible', retryAfter: wait || undefined, direct: true }, { status: wait ? 429 : 502 });
}

export async function GET() {
  return Response.json({ ok: true, providers: providers(), storage: process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'inline' });
}
