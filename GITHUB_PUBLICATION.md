# Publication GitHub

Ce fichier sert de mémo pour publier Xtension en repository GitHub public et créer une release utilisable avant publication sur les stores.

## Description courte GitHub

À mettre dans le champ **Description** lors de la création du repository :

```text
Browser extension to download X/Twitter articles, tweets and threads as clean PDF files with images.
```

Version française possible :

```text
Extension navigateur pour télécharger les articles, tweets et threads X/Twitter en PDF propre avec leurs images.
```

## Création du repository

1. Va sur https://github.com/new
2. Repository name : `xtension`
3. Description : utilise une des descriptions ci-dessus.
4. Visibility : **Public**
5. Ne coche pas README, `.gitignore` ou license : ils existent déjà localement.
6. Clique **Create repository**.

## Push initial

Ne pousse pas l'historique Git local existant si l'objectif est une publication sans identité personnelle.
Crée une branche publique sans historique, avec une identité Git neutre :

Depuis le dossier du projet :

```powershell
npm run build
npm run check
git status --short
git config user.name "Xtension Maintainers"
git config user.email "noreply@example.invalid"
git switch --orphan github-public
git rm -rf --cached .
git add .
git commit -m "Initial public release"
git branch -M main
```

Ajoute ensuite le remote GitHub et pousse uniquement cette branche :

```powershell
git remote add origin https://github.com/TON_USERNAME/xtension.git
git push -u origin main
```

Remplace `TON_USERNAME` par ton pseudo GitHub.

## Permissions GitHub Actions

Dans le repository GitHub :

1. Va dans **Settings**.
2. Va dans **Actions** puis **General**.
3. Dans **Workflow permissions**, choisis **Read and write permissions**.
4. Sauvegarde.

## Créer la release

Créer le tag :

```powershell
git tag v0.4.0
git push origin v0.4.0
```

Le workflow GitHub Actions construit les packages :

- `xtension-edge-v0.4.0.zip`
- `xtension-chrome-v0.4.0.zip`
- `xtension-firefox-v0.4.0.zip`
- `SHA256SUMS.txt`

Si les fichiers ne sont pas attachés automatiquement à la release, crée ou édite la release manuellement et ajoute les fichiers depuis `dist/`.

## Texte de release

Utilise le contenu de :

```text
release-notes/v0.4.0.md
```

## Vérification avant publication

À refaire juste avant le push :

```powershell
npm run build
npm run check
Get-Content dist\SHA256SUMS.txt
```

Vérifie aussi :

- Le README ne contient pas de chemin personnel.
- Aucun secret ou token n'est présent.
- Les zips sont présents dans `dist/`.
- Le logo est transparent et lisible dans `assets/icons/`.

## Création via API GitHub

Si un token GitHub est disponible localement, le repository peut être créé sans passer par l'interface web.
Le token ne doit jamais être commité ni affiché dans les logs.

Documentation officielle :

- https://docs.github.com/rest/repos/repos#create-a-repository-for-the-authenticated-user
- https://docs.github.com/rest/overview/authenticating-to-the-rest-api

Exemple PowerShell avec `$env:GITHUB_TOKEN` déjà défini :

```powershell
$body = @{ name = "xtension"; private = $false; description = "Browser extension to download X/Twitter articles, tweets and threads as clean PDF files with images." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://api.github.com/user/repos" -Headers @{ Authorization = "Bearer $env:GITHUB_TOKEN"; Accept = "application/vnd.github+json" } -Body $body -ContentType "application/json"
```
