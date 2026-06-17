# Installer depuis GitHub Releases

Tant que Xtension n'est pas publié sur les stores, les utilisateurs peuvent l'installer manuellement depuis les archives de release.

## Quel fichier télécharger ?

- Microsoft Edge : `xtension-edge-vX.Y.Z.zip`
- Chrome, Brave, Vivaldi, Opera : `xtension-chrome-vX.Y.Z.zip`
- Firefox : `xtension-firefox-vX.Y.Z.zip`

Le fichier `SHA256SUMS.txt` permet de vérifier que les archives téléchargées correspondent bien à celles générées pendant la release.

## Edge

1. Télécharge `xtension-edge-vX.Y.Z.zip`.
2. Décompresse le zip dans un dossier stable, par exemple `Documents/Xtension/edge`.
3. Ouvre `edge://extensions`.
4. Active **Mode développeur**.
5. Clique **Charger l'extension décompressée**.
6. Sélectionne le dossier décompressé.

## Chrome / Brave / Vivaldi / Opera

1. Télécharge `xtension-chrome-vX.Y.Z.zip`.
2. Décompresse le zip dans un dossier stable.
3. Ouvre `chrome://extensions`.
4. Active **Mode développeur**.
5. Clique **Charger l'extension non empaquetée**.
6. Sélectionne le dossier décompressé.

## Firefox

Firefox ne garde pas durablement les extensions non signées chargées via `about:debugging`.

Pour un test temporaire :

1. Télécharge `xtension-firefox-vX.Y.Z.zip`.
2. Décompresse le zip.
3. Ouvre `about:debugging#/runtime/this-firefox`.
4. Clique **Charger un module complémentaire temporaire**.
5. Sélectionne le fichier `manifest.json` dans le dossier décompressé.

Pour une installation durable dans Firefox, l'extension doit être signée via Mozilla Add-ons.

## Vérifier le checksum

Dans PowerShell :

```powershell
Get-FileHash .\xtension-edge-vX.Y.Z.zip -Algorithm SHA256
```

Compare la valeur avec la ligne correspondante dans `SHA256SUMS.txt`.
