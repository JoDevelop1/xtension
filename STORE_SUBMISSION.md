# Publication stores

Les packages sont générés par `npm run build`.

## Chrome Web Store

Documentation officielle :

- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/images

Fichier à uploader :

```text
dist/xtension-chrome-v0.4.0.zip
```

Assets à fournir :

- Icône extension : `assets/icons/icon-128.png`
- Petite image promotionnelle obligatoire : `store-assets/promo-small-440x280.png`
- Image marquee optionnelle : `store-assets/promo-marquee-1400x560.png`
- Screenshots : `store-assets/screenshot-1-1280x800.png` et `store-assets/screenshot-2-1280x800.png`

Le Chrome Web Store demande notamment une icône PNG 128x128 dans le zip, une petite image promotionnelle 440x280, et au moins un screenshot 1280x800 ou 640x400.

## Microsoft Edge Add-ons

Documentation officielle :

- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/hosting-and-updating

Fichier à uploader :

```text
dist/xtension-edge-v0.4.0.zip
```

Assets à fournir :

- Logo : `store-assets/logo-300.png`
- Petite image promotionnelle : `store-assets/promo-small-440x280.png`
- Grande image promotionnelle : `store-assets/promo-marquee-1400x560.png`
- Screenshots : `store-assets/screenshot-1-1280x800.png` et `store-assets/screenshot-2-1280x800.png`

Edge Add-ons attend un zip. Le portail Partner Center convertit ensuite le zip en package distribué.

## Firefox Add-ons / AMO

Documentation officielle :

- https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/

Fichier à utiliser :

```text
dist/xtension-firefox-v0.4.0.zip
```

Pour une publication listée ou une signature, utilise `web-ext` depuis le dossier Firefox :

```powershell
npx web-ext build --source-dir browsers/firefox --artifacts-dir dist
npx web-ext sign --source-dir browsers/firefox --channel=listed --amo-metadata store-listings/firefox-amo-metadata.json --api-key=$env:AMO_JWT_ISSUER --api-secret=$env:AMO_JWT_SECRET
```

Firefox exige un identifiant `browser_specific_settings.gecko.id` pour les mises à jour et la signature MV3. Il est déjà défini dans le manifeste Firefox généré.

## Safari App Store

Documentation officielle :

- https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari
- https://developer.apple.com/safari/extensions/

Safari ne publie pas directement un zip WebExtension. Apple impose une app hôte générée avec Xcode. Depuis macOS :

```bash
xcrun safari-web-extension-converter browsers/chrome --bundle-identifier com.example.xtension
```

Le projet Xcode généré est ensuite publié via App Store Connect.

## Textes store

Voir :

- `store-listings/fr-FR.md`
- `store-listings/en-US.md`
- `store-listings/firefox-amo-metadata.json`
- `PRIVACY.md`
- `SUPPORT.md`

## Points à vérifier avant soumission

- Tester le dossier `browsers/edge` dans Edge.
- Tester le dossier `browsers/chrome` dans Chrome ou Brave.
- Tester le dossier `browsers/firefox` dans Firefox.
- Générer un PDF réel depuis un article X avec image.
- Générer un PDF réel depuis un tweet simple.
- Générer un PDF réel depuis un thread et vérifier qu'il s'arrête avant les réponses d'autres comptes.
- Vérifier que la boîte **Enregistrer sous** apparaît.
- Vérifier que les images apparaissent dans le PDF.
- Vérifier que l'extension ne s'active que dans le cadre X/Twitter et domaines média associés.
