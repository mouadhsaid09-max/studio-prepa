#!/bin/bash
# Construit la démo statique (sans serveur) dans demo/site. Nécessite « npm install » (pdfkit, polices).
set -e
cd "$(dirname "$0")/.."
rm -rf demo/site && mkdir -p demo/site/vendor demo/site/fonts
cp -r public/css public/js public/icons demo/site/
cp demo/demo.js demo/site/js/demo.js
cp node_modules/pdfkit/js/pdfkit.standalone.js demo/site/vendor/
for f in DejaVuSansCondensed.ttf DejaVuSansCondensed-Bold.ttf DejaVuSans-Bold.ttf; do cp node_modules/dejavu-fonts-ttf/ttf/$f demo/site/fonts/; done
cp public/fonts/Caveat.ttf demo/site/fonts/
cat > demo/site/app.html <<'HTML'
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f5f5f7">
<title>GOSET.ai</title>
<link rel="icon" type="image/png" href="icons/icon-192.png">
<link rel="stylesheet" href="css/app.css">
</head>
<body>
<div id="app"></div>
<script src="js/demo.js"></script>
<script type="module">import { SAMPLE } from './js/parser.js'; window.__SAMPLE__ = SAMPLE;</script>
<script type="module" src="js/app.js"></script>
</body>
</html>
HTML
# Page d'accueil publique (présentation, tarifs) ; l'application est servie sur /app
cp landing/index.html demo/site/index.html
cp landing/fonts/*.woff2 demo/site/fonts/
echo "Démo prête : demo/site"
