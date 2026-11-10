#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Téléchargez-le sur https://nodejs.org puis relancez."
  read -r -p "Appuyez sur Entrée pour fermer"; exit 1
fi
[ -d node_modules ] || { echo "Installation..."; npm install; }
node server.js
