// Accès privé : avant la page de connexion, un code d'accès est demandé (variable Vercel ACCESS_CODE).
// Le code n'est jamais écrit dans le dépôt. Une fois validé, un cookie garde l'accès 30 jours sur cet appareil.
export const config = { runtime: 'nodejs' };

const COOKIE = 'sp_gate';
const MAX_AGE = 60 * 60 * 24 * 30;

async function tokenFor(code) {
  const data = new TextEncoder().encode('studio-prepa|' + code);
  const h = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const readCookie = (req, name) => {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
};
const safeEq = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

export default async function middleware(request) {
  const code = process.env.ACCESS_CODE;
  if (!code) return; // pas de code configuré : site ouvert
  const url = new URL(request.url);
  // La page d'accueil (présentation, tarifs) reste publique ; le code protège l'application.
  if (url.pathname === '/' || url.pathname === '/index' || url.pathname === '/index.html' || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/fonts/') || url.pathname === '/robots.txt' || (url.pathname === '/api/assist' && request.method === 'GET')) return; // GET = simple vérification
  const good = await tokenFor(code);

  if (url.pathname === '/__access' && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const given = String((form && form.get('code')) || '').trim();
    if (safeEq(await tokenFor(given), good)) {
      return new Response(null, { status: 303, headers: {
        Location: '/app',
        'Set-Cookie': `${COOKIE}=${good}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store'
      } });
    }
    await new Promise(r => setTimeout(r, 900)); // ralentit les essais au hasard
    return gate(true);
  }
  if (safeEq(readCookie(request, COOKIE), good)) return; // accès déjà accordé : on continue vers l'application
  return gate(false);
}

function gate(error) {
  return new Response(PAGE.replace('%ERR%', error ? '<p class="err" role="alert"><span data-l="fr">Code incorrect. Réessayez.</span><span data-l="en">Wrong code. Try again.</span><span data-l="ar">رمز غير صحيح. حاول مجددًا.</span></p>' : ''), {
    status: error ? 401 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
  });
}

const PAGE = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b0b0d">
<title>GOSET.ai — accès privé</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231d1d1f'/%3E%3Crect x='7' y='14' width='18' height='11' rx='2' fill='%23ff9f0a'/%3E%3Cpath d='M7 12l17-4 1 3.5-17 4z' fill='%23ff9f0a'/%3E%3C/svg%3E">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;color:#f5f5f7;background:#0b0b0d;display:grid;place-items:center;overflow:hidden;-webkit-font-smoothing:antialiased}
.bg{position:fixed;inset:-20%;background:radial-gradient(40% 35% at 25% 30%,rgba(255,122,26,.28),transparent 70%),radial-gradient(35% 40% at 78% 70%,rgba(123,77,255,.25),transparent 70%),radial-gradient(60% 60% at 50% 50%,#17171b,#0b0b0d);filter:blur(10px);animation:drift 18s ease-in-out infinite alternate}
@keyframes drift{to{transform:translate3d(3%,-2%,0) scale(1.06)}}
.grain{position:fixed;inset:0;opacity:.07;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
.bars:before,.bars:after{content:"";position:fixed;left:0;right:0;height:7vh;background:#000;z-index:1}.bars:before{top:0}.bars:after{bottom:0}
main{position:relative;z-index:2;width:min(400px,90vw);text-align:center;animation:in .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes in{from{opacity:0;transform:translateY(14px)}}
.slate{width:84px;height:84px;margin:0 auto 22px;display:block;filter:drop-shadow(0 18px 40px rgba(255,122,26,.35))}
.slate .top{transform-origin:14px 34px;animation:clap 2.6s ease-in-out infinite}
@keyframes clap{0%,70%,100%{transform:rotate(0)}78%{transform:rotate(-16deg)}86%{transform:rotate(0)}}
.k{font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#a1a1a6;margin:0 0 6px}
h1{font-size:34px;letter-spacing:-.02em;margin:0 0 6px;font-weight:700}
.sub{color:#a1a1a6;margin:0 0 26px}
form{display:flex;flex-direction:column;gap:12px}
.f{position:relative}
input{width:100%;padding:15px 48px 15px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:16px;letter-spacing:.06em;outline:none;transition:.2s;backdrop-filter:blur(10px)}
input::placeholder{color:#6e6e73;letter-spacing:0}
input:focus{border-color:#ff9f0a;background:rgba(255,255,255,.09);box-shadow:0 0 0 4px rgba(255,159,10,.18)}
.eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:none;color:#a1a1a6;width:36px;height:36px;border-radius:10px;cursor:pointer}
.eye:hover{color:#fff;background:rgba(255,255,255,.08)}
button.go{padding:15px;border:0;border-radius:14px;font:inherit;font-weight:650;font-size:16px;color:#1d1d1f;background:linear-gradient(135deg,#ffb340,#ff7a1a);cursor:pointer;transition:transform .15s,box-shadow .2s;box-shadow:0 10px 30px rgba(255,122,26,.35)}
button.go:hover{transform:translateY(-1px);box-shadow:0 14px 36px rgba(255,122,26,.45)}button.go:active{transform:none}
.err{margin:0;color:#ff6961;font-size:13.5px;animation:shake .4s}
@keyframes shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.foot{margin-top:28px;font-size:12px;color:#6e6e73}
.lang{position:fixed;top:calc(7vh + 14px);right:18px;z-index:3;display:flex;gap:4px}
.lang button{border:0;background:rgba(255,255,255,.07);color:#a1a1a6;font:inherit;font-size:12px;padding:5px 9px;border-radius:8px;cursor:pointer}.lang button.on{color:#fff;background:rgba(255,255,255,.16)}
[data-l]{display:none}html[data-lang=fr] [data-l=fr],html[data-lang=en] [data-l=en],html[data-lang=ar] [data-l=ar]{display:inline}
html[data-lang=ar] main{direction:rtl}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
</head>
<body class="bars">
<div class="bg"></div><div class="grain"></div>
<div class="lang"><button data-set="fr">FR</button><button data-set="en">EN</button><button data-set="ar">ع</button></div>
<main>
  <svg class="slate" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb340"/><stop offset="1" stop-color="#ff5e3a"/></linearGradient></defs>
    <rect x="8" y="27" width="48" height="29" rx="6" fill="url(#g)"/><path d="M16 38h24M16 46h16" stroke="#fff" stroke-opacity=".85" stroke-width="3.4" stroke-linecap="round"/>
    <g class="top"><rect x="8" y="15" width="48" height="10" rx="3" fill="#2c2c2e"/><path d="M15 15l-5 10h6l5-10zM28 15l-5 10h6l5-10zM41 15l-5 10h6l5-10z" fill="#f5f5f7"/></g></svg>
  <p class="k"><span data-l="fr">Accès privé</span><span data-l="en">Private access</span><span data-l="ar">دخول خاص</span></p>
  <h1>GOSET.ai</h1>
  <p class="sub"><span data-l="fr">Entrez le code d’accès pour continuer.</span><span data-l="en">Enter the access code to continue.</span><span data-l="ar">أدخل رمز الدخول للمتابعة.</span></p>
  <form method="post" action="/__access" autocomplete="off">
    <div class="f"><input id="c" name="code" type="password" required autofocus aria-label="Code d’accès" placeholder="Code d’accès" spellcheck="false" autocapitalize="off"><button type="button" class="eye" aria-label="Afficher" onclick="var i=document.getElementById('c');i.type=i.type==='password'?'text':'password'">◉</button></div>
    %ERR%
    <button class="go" type="submit"><span data-l="fr">Entrer</span><span data-l="en">Enter</span><span data-l="ar">دخول</span></button>
  </form>
  <p class="foot"><span data-l="fr">Du scénario aux feuilles de service.</span><span data-l="en">From script to call sheets.</span><span data-l="ar">من السيناريو إلى أوراق الاستدعاء.</span></p>
</main>
<script>
(function(){var ph={fr:'Code d’accès',en:'Access code',ar:'رمز الدخول'};
function set(l){document.documentElement.dataset.lang=l;document.documentElement.lang=l;document.getElementById('c').placeholder=ph[l];document.querySelectorAll('[data-set]').forEach(function(b){b.classList.toggle('on',b.dataset.set===l)});try{localStorage.setItem('sp.lang',l)}catch(e){}}
var l='fr';try{l=localStorage.getItem('sp.lang')||((navigator.language||'fr').slice(0,2))}catch(e){}if(!ph[l])l='fr';set(l);
document.querySelectorAll('[data-set]').forEach(function(b){b.onclick=function(){set(b.dataset.set)}});})();
</script>
</body>
</html>`;
