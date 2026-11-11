// Assistant GOSET : relais vers des IA texte gratuites pour le site en ligne (protégé par le code d'accès).
// Ordre d'essai, selon les clés présentes dans les variables d'environnement Vercel :
//   1. GROQ_API_KEY      — Groq (llama-3.3-70b), très rapide, offre gratuite sans carte (console.groq.com)
//   2. GEMINI_API_KEY    — Google Gemini Flash, contexte très long, gratuit (aistudio.google.com)
//   3. OPENROUTER_API_KEY — modèles « :free » d'OpenRouter
//   4. POLLINATIONS_KEY  — Pollinations avec clé
//   5. Pollinations sans clé (lent : une réponse toutes les ~45 s pour tout le site)
// Si un service répond « trop de demandes », le suivant prend le relais.
const MAX = 60000;
const hits = new Map(); // limite simple par adresse : 20 demandes / minute

function limited(ip) {
  const now = Date.now(), w = (hits.get(ip) || []).filter(t => now - t < 60000);
  w.push(now); hits.set(ip, w);
  return w.length > 20;
}

function providers() {
  const e = process.env, list = [];
  if (e.GROQ_API_KEY) list.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: e.GROQ_API_KEY, model: e.GROQ_MODEL || 'llama-3.3-70b-versatile', json: true });
  if (e.GEMINI_API_KEY) list.push({ name: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: e.GEMINI_API_KEY, model: e.GEMINI_MODEL || 'gemini-2.5-flash', json: true });
  if (e.OPENROUTER_API_KEY) list.push({ name: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: e.OPENROUTER_API_KEY, model: e.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free' });
  if (e.POLLINATIONS_KEY) list.push({ name: 'pollinations', url: 'https://gen.pollinations.ai/v1/chat/completions', key: e.POLLINATIONS_KEY, model: 'openai' });
  list.push({ name: 'pollinations-free', url: 'https://text.pollinations.ai/openai', model: 'openai', seed: true });
  return list;
}

async function call(p, messages, json) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 50000);
  try {
    const body = { model: p.model, messages, temperature: 0.7 };
    if (json && p.json) body.response_format = { type: 'json_object' };
    if (p.seed) body.seed = Math.floor(Math.random() * 1e6);
    const r = await fetch(p.url, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', ...(p.key ? { Authorization: `Bearer ${p.key}` } : {}) }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    const text = j?.choices?.[0]?.message?.content || '';
    if (r.status === 429 || /limit|quota/i.test(String(j?.error?.message || j?.error || '')) && !text) {
      const ra = +(r.headers.get('retry-after') || 0) || (/(\d+)\s*s/.exec(String(j?.error?.message || j?.error || ''))?.[1] | 0) || 45;
      return { status: 429, retryAfter: Math.min(ra, 90), error: 'Le service IA gratuit est saturé.' };
    }
    if (!r.ok || !text) return { status: 502, error: `Service IA (${p.name}) : ${String(j?.error?.message || j?.error || 'erreur ' + r.status).slice(0, 160)}` };
    return { text, provider: p.name };
  } catch (e) {
    return { status: 502, error: e.name === 'AbortError' ? 'Le service IA ne répond pas (délai dépassé).' : 'Service IA injoignable.' };
  } finally { clearTimeout(t); }
}

async function complete(messages, json) {
  let last = null, wait = 0;
  for (const p of providers()) {
    const out = await call(p, messages, json);
    if (out.text) return out;
    last = out; if (out.status === 429) wait = wait ? Math.min(wait, out.retryAfter) : out.retryAfter;
  }
  return wait ? { status: 429, retryAfter: wait, error: last.error } : last;
}

export async function POST(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return Response.json({ error: 'Trop de demandes : attendez une minute.', retryAfter: 30 }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  let messages = Array.isArray(b.messages) ? b.messages : [{ role: 'user', content: String(b.prompt || '') }];
  messages = messages.filter(m => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-20);
  const size = messages.reduce((a, m) => a + m.content.length, 0);
  if (!size) return Response.json({ error: 'Demande vide' }, { status: 400 });
  if (size > MAX) return Response.json({ error: 'Texte trop long pour une seule demande.' }, { status: 413 });
  const out = await complete(messages, !!b.json);
  return out.text ? Response.json({ text: out.text, provider: out.provider }) : Response.json({ error: out.error, retryAfter: out.retryAfter }, { status: out.status || 502 });
}

// Vérification rapide : GET /api/assist?ping=1 (indique aussi quels services sont branchés)
export async function GET(request) {
  const names = providers().map(p => p.name);
  if (!new URL(request.url).searchParams.has('ping')) return Response.json({ ok: true, providers: names });
  const out = await complete([{ role: 'user', content: 'Reply with the single word: ready' }]);
  return Response.json(out.text ? { ok: true, provider: out.provider, providers: names, reply: out.text.slice(0, 40) } : { ok: false, providers: names, error: out.error }, { status: out.text ? 200 : 502 });
}
