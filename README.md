# Studio Prépa

Préparation de tournage en local : un projet = un canvas (mind map, moodboard, cartes scènes) + le scénario + le dépouillement, la liste artistique, le plan de travail et les feuilles de service, mis à jour automatiquement quand le scénario change.

## Lancer

1. Installez **Node.js 18 ou plus** : https://nodejs.org
2. Double-cliquez sur **Demarrer-Windows.bat** (Windows) ou **Demarrer-Mac.command** (Mac).
   En ligne de commande : `npm install` puis `npm start`.
3. Le navigateur s’ouvre sur http://localhost:3000. Au premier lancement, créez votre compte.

Pour arrêter : fermez la fenêtre du terminal (ou Ctrl+C).

> Mac : si le fichier .command est bloqué, clic droit → Ouvrir. Si besoin : `chmod +x Demarrer-Mac.command`.

## Utilisation

- **Projets** : vue façon Fichiers (Récents, Tous, Favoris, Corbeille), icônes ou liste, recherche. Clic droit ou « ••• » : renommer, dupliquer, favori, corbeille.
- **Canvas** (s’ouvre en premier) :
  - Double-clic sur le fond : nouvelle note. Outils à gauche : note, titre, to-do, image, couleur.
  - **Mind map** : sélectionnez une note et appuyez sur **Tab** pour créer une idée liée ; glissez le point ● d’une carte vers une autre pour les relier (ou dans le vide pour créer une note liée).
  - Glisser-déposer ou coller (Ctrl/⌘+V) des images. Maj+glisser : sélection multiple. Ctrl/⌘+Z : annuler.
  - **Cartes scènes** : créées et mises à jour automatiquement depuis le scénario (effet, décor, rôles, jour de tournage). Double-clic : ouvre la scène dans le texte.
  - **Moodboard IA** : sélectionnez une scène (ou une note) → « ✦ Moodboard IA ». La description est pré-remplie depuis la scène ; choisissez style, format et nombre. Les images arrivent sur le canvas, reliées à la scène.
- **Scénario** : collez, écrivez ou importez (PDF, Word .docx, Final Draft .fdx, Fountain, .txt). Chaque modification met à jour le canvas, le dépouillement, la liste artistique, le plan de travail et les feuilles de service, avec un résumé des changements.
  En-têtes reconnus : `1. INT. CUISINE - JOUR`, `EXT. RUE - NUIT`, `SEQ 3 - INT/EXT - VOITURE - SOIR`…
- **Dépouillement / Liste artistique / Plan de travail / Feuilles de service** : cellules modifiables, copie vers Excel/Sheets, impression.
- **Exporter PDF** (bouton en haut du projet) : présentation 16:9 du projet complet. Choisissez les parties : couverture, vue d’ensemble du canvas, moodboards par scène (images reliées à chaque carte scène), notes et mind maps, palette, dépouillement, liste artistique, plan de travail, stripboard, une feuille de service par jour.

## Nouveautés

- **Séries** : onglet Scénario → « Série ». Le scénario devient l’épisode 1 ; ajoutez, renommez, réordonnez (↑ ↓) et supprimez des épisodes. Scènes numérotées « épisode.scène » (2.14). Le plan de travail, le dépouillement (filtre par épisode), la liste artistique et les feuilles de service couvrent toute la série.
- **Plan de travail** : calcul automatique EXT jour → INT jour → INT nuit → EXT nuit, décors regroupés, journées remplies selon le temps estimé de chaque séquence (réglages : durée de journée, minutes par page, installation, déplacement). Glissez les bandes ⠿ et les « fins de journée » pour réorganiser ; « Revenir au calcul automatique » annule l’ordre manuel.
- **Liste artistique** : N°, rôle, catégorie, comédien·ne, séquences, jours, contrat, essayage costume, essai maquillage, scénario remis (papier / numérique), indisponibilités (dates signalées en rouge dans le plan et les feuilles de service).
- **PDF** : fabriqué par PDFKit (JavaScript), sans Chromium ni Puppeteer. La version locale le génère sur l’ordinateur ; la démo en ligne le génère dans le navigateur.

- **Nouveau projet** : fenêtre sobre aux couleurs de l’app, panneau cinéma (clap 3D animé qui affiche le titre tapé, citations de cinéastes en FR/EN/AR), pictogrammes abstraits au trait — Film ou Série (nombre d’épisodes à taper ou avec − / +), point de départ (vierge, import, exemple), vignette et couleur. La vignette se change ensuite depuis le menu ••• d’un projet (image importée, image du projet ou automatique).
- **Formats** : Film, Série, Publicité, Clip musical, et deux formats IA (Publicité IA, Mini-série IA).
- **Clip musical : paroles** au lieu d’un scénario. Une section par partie de la chanson : `[Refrain 0:52] EXT. PLACE - NUIT`, lignes entre parenthèses = images, `Avec : Amina, Danseurs` = qui est à l’écran, le reste = paroles. Les sections deviennent les « scènes » du dépouillement, du découpage, du plan de travail et des feuilles de service. Exemple fourni : « Tunis la nuit ».
- **Projets IA** : pas de tournage, donc pas de dépouillement, liste artistique, plan de travail ni feuilles de service ; budget propre à l’IA (abonnements, crédits par plan, voix, musique, licences).
- **Studio IA** (projets IA) : fiches personnages (apparence, tenue, voix, jeton de cohérence, image de référence), compétences de prompt (blocs de style réutilisables, préréglages), prompts image + mouvement pour chaque plan, composés depuis le découpage ; copier, exporter en .txt ou JSON.
- **Budget** (onglet Budget) : postes de production pré-remplis depuis le plan de travail (jours de tournage, jours par comédien·ne, décors, repas…), tarifs et quantités modifiables, lignes libres, imprévus en %. Trois devises : dinar tunisien, euro, dollar US — chaque ligne peut avoir sa devise, totaux dans les trois ; les taux de change sont ceux que vous saisissez. Export Excel (CSV) et pages Budget dans le PDF.
- **Dossiers de projet** : chaque projet est un dossier avec l’affiche au centre (vignette ou affiche générée), une page du scénario à gauche et le découpage à droite ; la couleur du dossier se change dans ••• → Vignette et couleur.
- **Croquis gratuits dans la démo** : dessinés dans le navigateur (perspective, décor reconnu par mots-clés, silhouettes, mouvement de caméra), sans IA d’image ni réseau. Si l’IA texte n’est pas disponible, Moodboard AI propose un découpage de base. En local, les images viennent toujours de Pollinations ou Cloudflare (gratuits).
- **Planche de storyboard** (Découpage → Planche) : cases 16:9 avec Scène / Plan / Format, valeur de plan en marge, légende manuscrite modifiable. Même mise en page dans le PDF (section Storyboard), cases vides comprises pour dessiner à la main. Nouveau style de croquis « Storyboard » (encre + marqueur gris), par défaut.
- **Stylo** (canvas → Stylo) : écrivez au stylet (Apple Pencil, S Pen), au doigt ou à la souris ; « Stylet seulement » ignore la paume. « Ajouter comme croquis » pose le dessin sur le canvas ; « Transformer en texte » le lit (reconnaissance d’écriture du système si le navigateur l’a, sinon IA de vision : Claude dans la démo, Pollinations ou Cloudflare Llama 3.2 Vision en local) et crée une note propre, modifiable avant ajout.
- **Langues** : français, English, العربية (menu Langue à gauche ou sur l’écran de connexion ; l’arabe s’affiche de droite à gauche, PDF compris). Les scénarios en arabe sont reconnus : « 1. داخلي - مطبخ - نهار », « مشهد 2 - خارجي - شارع - ليل ».
- **Film ou série** à la création. Une série s’ouvre comme un dossier : Ép. 1, Ép. 2… (renommer, réordonner, supprimer), plus les vues de toute la série.
- **Découpage technique** : liste des plans par scène (valeur, angle, mouvement, objectif, action, son, durée, croquis). Le temps de tournage d’une scène découpée suit son nombre de plans. Sections « Découpage » et « Storyboard » dans le PDF.
- **Moodboard AI** (bouton ✦, remplace Prep AI) : « Tout préparer », « Une scène », « Découpage » ; styles crayon, encre, fusain, aquarelle (et réaliste en local) ; les personnages gardent le même look d’une image à l’autre.
- **Ancien Prep AI** (bouton ✦ en bas à droite) : lit le scénario et écrit la logline, le synopsis, le genre, le style, les fiches personnages (âge, taille, style, look, description), lieux, objets principaux, et pour chaque scène un résumé, une intention de mise en scène, costumes et HMC. Puis il crée 6 à 13 croquis de storyboard, posés sur le canvas et reliés à leur scène. Option « Garder ce que j’ai déjà écrit ». Texte : Pollinations (gratuit ; une clé gratuite sur enter.pollinations.ai le rend plus fiable) ou Cloudflare Workers AI (Llama 3.3), selon Réglages → IA. Croquis : le générateur d’images choisi.

## Sur le téléphone (iPhone, Android)

1. Le téléphone et l’ordinateur doivent être sur le **même Wi-Fi**, et l’application lancée sur l’ordinateur.
2. Dans l’application : menu de gauche → **Sur le téléphone**. Scannez le QR code (ou tapez l’adresse affichée, ex. `http://192.168.1.20:3000`).
3. Connectez-vous avec votre compte.
4. Pour l’avoir comme une app :
   - **iPhone / iPad** : Safari → Partager → « Sur l’écran d’accueil ».
   - **Android** : Chrome → menu ⋮ → « Ajouter à l’écran d’accueil ».

Sur le téléphone : double-tap sur le fond = nouvelle note, un tap sélectionne, glisser déplace, pincer pour zoomer ; le bouton « Écrire » de la barre noire modifie le texte et « + Idée liée » remplace la touche Tab.

Windows : au premier lancement, autorisez Node.js sur les **réseaux privés** quand le pare-feu le demande. Les Wi-Fi « invités » isolent parfois les appareils : utilisez le Wi-Fi principal.
L’icône sur l’écran d’accueil fonctionne seulement quand l’ordinateur est allumé, l’application lancée et le téléphone sur le même Wi-Fi.

## Génération d’images (gratuite)

Réglages → « Génération d’images » :

| Service | Compte | Limites |
|---|---|---|
| **Pollinations** (par défaut) | Aucun | ~1 image / 15 s, filigrane possible. Une clé gratuite sur enter.pollinations.ai lève ces limites. |
| **Cloudflare Workers AI** (FLUX.1 schnell) | Compte Cloudflare gratuit | 10 000 neurones / jour, soit environ 200 images. Images carrées. Il faut l’Account ID et un jeton API avec la permission Workers AI. |

La génération et l’import PDF/Word ont besoin d’internet ; tout le reste fonctionne hors ligne.

## Données

Tout est dans le dossier `data/` (comptes, projets, images). Sauvegardez ce dossier pour garder vos projets.
Par défaut, l’application est joignable depuis les appareils du même Wi-Fi (connexion obligatoire, essais de mot de passe limités). Pour la réserver à cet ordinateur, copiez `.env.example` en `.env` et mettez `HOST=127.0.0.1`. Évitez de la laisser tourner sur un Wi-Fi public.

## Réglages avancés (.env)

`PORT`, `HOST`, `DATA_DIR`, `OPEN_BROWSER=0` (ne pas ouvrir le navigateur), `IMAGE_PROVIDER`, `POLLINATIONS_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`.

## Facture / devis PDF (onglet Budget)
Bouton **Facture / devis PDF** : facture, devis, pro forma ou avoir en A4.
- **Émetteur** (mémorisé pour les prochains documents) : logo, couleur, société, adresse, matricule fiscal, RNE, téléphone, e-mail, banque, RIB/IBAN.
- **Signature** dessinée au doigt, au stylet ou à la souris (ou image importée), cachet en image, nom du signataire.
- **Client** : nom, adresse, matricule fiscal, e-mail.
- **Lignes** : depuis le budget (récapitulatif par poste ou détail), modèle « Post-production IA », ou saisie libre.
- **TVA** 19 % par défaut (modifiable), droit de timbre (TND, 1,000 par défaut, modifiable), retenue à la source, montant en lettres (FR/EN), taux de change obligatoire pour une facture en EUR/USD.
- Numérotation automatique par type et par année (FAC-2026-001, DEV-…, PRO-…).
- ⚠️ En Tunisie, la facture électronique officielle est émise via **El Fatoora (TTN)** avec une signature électronique qualifiée. Le PDF sert de devis, de pro forma ou de copie de facture : vérifiez les mentions obligatoires avec votre comptable.

## Post-production IA (Studio IA → Post-production)
- Suivi de chaque plan : À générer → Généré → Prise choisie → Composité → Upscalé → Étalonné → Son / lip-sync → Validé, avec outil/modèle, seed/version et note.
- Listes de contrôle : finitions image, son, livrables (16:9, 9:16, 1:1, 4:5, .srt, Rec.709), transparence et droits (mentions IA des plateformes, AI Act art. 50, C2PA, consentements, licences).
- Cible de niveau sonore, résolution et cadence du master ; section « Post-production IA » dans l'export PDF.
