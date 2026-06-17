# Xtension

Extension dédiée à X/Twitter qui ajoute **Télécharger en PDF** dans le menu `...` des articles, tweets et threads. Le PDF est généré localement, inclut le texte structuré, les tweets inclus/cités, les images disponibles et les aperçus vidéo.

> Xtension est un projet indépendant. Il n'est pas affilié à X Corp., Twitter, Microsoft, Google, Mozilla ou Apple.

## Dossiers générés à utiliser

Ces dossiers sont créés par `npm run build` et ne sont pas suivis dans Git.

- `browsers/edge` : dossier décompressé à charger dans Microsoft Edge.
- `browsers/chrome` : dossier décompressé à charger dans Chrome, Brave, Vivaldi ou Opera.
- `browsers/firefox` : dossier décompressé à charger temporairement dans Firefox.
- `browsers/safari` : instructions de conversion Safari via Xcode sur macOS.
- `dist/*.zip` : archives prêtes pour les stores.
- `store-assets/` : logo, images promotionnelles et screenshots pour les fiches store.
- `store-listings/` : textes prêts à coller dans Chrome Web Store, Edge Add-ons et AMO.

## Build

Prérequis : Node.js, Python et Pillow pour générer les icônes et visuels.

```powershell
python -m pip install pillow
```

```powershell
npm run build
npm run check
```

## Installation locale

### Edge

1. Ouvre `edge://extensions`.
2. Active **Mode développeur**.
3. Clique **Charger l'extension décompressée**.
4. Sélectionne le dossier `browsers/edge`.

### Chrome / Brave / Vivaldi / Opera

1. Ouvre `chrome://extensions` ou la page équivalente du navigateur Chromium.
2. Active **Mode développeur**.
3. Clique **Charger l'extension non empaquetée**.
4. Sélectionne le dossier `browsers/chrome`.

### Firefox

1. Ouvre `about:debugging#/runtime/this-firefox`.
2. Clique **Charger un module complémentaire temporaire**.
3. Sélectionne `browsers/firefox/manifest.json`.

### Safari

Safari nécessite Xcode sur macOS. Utilise `browsers/chrome` comme source avec le convertisseur Safari :

```bash
xcrun safari-web-extension-converter browsers/chrome --bundle-identifier com.example.xtension
```

## Publication

Voir [STORE_SUBMISSION.md](STORE_SUBMISSION.md).

Archives générées :

- `dist/xtension-chrome-v0.4.0.zip`
- `dist/xtension-edge-v0.4.0.zip`
- `dist/xtension-firefox-v0.4.0.zip`
- `dist/SHA256SUMS.txt`

## Releases GitHub

Voir [RELEASES.md](RELEASES.md) pour installer Xtension depuis une release GitHub en attendant la validation des stores.

## Permissions

- `downloads` : ouvrir la boîte **Enregistrer sous** pour le PDF.
- `https://x.com/*`, `https://*.x.com/*`, `https://twitter.com/*`, `https://*.twitter.com/*` : injecter l'action dans le menu des articles, tweets et threads X/Twitter.
- `https://pbs.twimg.com/*`, `https://video.twimg.com/*`, `https://*.twimg.com/*`, `https://t.co/*` : rester compatible avec les médias et liens publics utilisés par X/Twitter.

L'extension reste limitée aux domaines X/Twitter et aux domaines média associés.
