// Assistant GOSET : relais vers une IA texte gratuite (Pollinations) pour le site en ligne.
// Protégé par le code d'accès (middleware). Variable facultative POLLINATIONS_KEY (clé gratuite sur enter.pollinations.ai).
const MAX = 60000;
const hits = new Map(); // limite simple par adresse : 20 demandes / minute

function limited(ip) {
  const now = Date.now(), w = (hits.get(ip) || []).filter(t => now - t < 60000);
  w.push(now); hits.set(ip, w);
  return w.length > 20;
}

async function complete(messages) {
  const key = process.env.POLLINATIONS_KEY;
  const url = key ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai';
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 55000);
  try {
    const r = await fetch(url, {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model: 'openai', messages, seed: Math.floor(Math.random() * 1e6) })
    });
    const j = await r.json().catch(() => null);
    const text = j?.choices?.[0]?.message?.content || '';
    if (r.status === 429) return { status: 429, error: 'Trop de demandes au service IA gratuit : réessayez dans une minute.' };
    if (!r.ok || !text) return { status: 502, error: `Service IA : ${j?.error?.message || j?.error || 'erreur ' + r.status}` };
    return { text };
  } catch (e) {
    return { status: 502, error: e.name === 'AbortError' ? 'Le service IA ne répond pas (délai dépassé).' : 'Service IA injoignable.' };
  } finally { clearTimeout(t); }
}

export async function POST(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return Response.json({ error: 'Trop de demandes : attendez une minute.' }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  let messages = Array.isArray(b.messages) ? b.messages : [{ role: 'user', content: String(b.prompt || '') }];
  messages = messages.filter(m => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-20);
  const size = messages.reduce((a, m) => a + m.content.length, 0);
  if (!size) return Response.json({ error: 'Demande vide' }, { status: 400 });
  if (size > MAX) return Response.json({ error: 'Texte trop long pour une seule demande.' }, { status: 413 });
  const out = await complete(messages);
  return out.text ? Response.json({ text: out.text }) : Response.json({ error: out.error }, { status: out.status || 502 });
}

// Vérification rapide : GET /api/assist?ping=1
export async function GET(request) {
  if (!new URL(request.url).searchParams.has('ping')) return Response.json({ ok: true });
  const out = await complete([{ role: 'user', content: 'Reply with the single word: ready' }]);
  return Response.json(out.text ? { ok: true, reply: out.text.slice(0, 40) } : { ok: false, error: out.error }, { status: out.text ? 200 : 502 });
}
