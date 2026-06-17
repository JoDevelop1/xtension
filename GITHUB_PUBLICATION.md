# GitHub Publication

This file is a maintenance memo for publishing Xtension as a public GitHub repository and creating release archives before store publication.

## GitHub Short Description

Use this in the repository **Description** field:

```text
Browser extension to improve the X/Twitter experience with practical tools.
```

## Repository Creation

1. Go to https://github.com/new
2. Repository name: `xtension`
3. Description: use the description above.
4. Visibility: **Public**
5. Do not add a README, `.gitignore`, or license: they already exist locally.
6. Click **Create repository**.

## Initial Push

Do not push an existing local Git history if the goal is publication without personal identity traces.
Create a public branch with no prior history and a neutral Git identity:

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

Then add the GitHub remote and push only this branch:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/xtension.git
git push -u origin main
```

Replace `YOUR_USERNAME` with the GitHub account owner.

## GitHub Actions Permissions

In the GitHub repository:

1. Open **Settings**.
2. Open **Actions** then **General**.
3. Under **Workflow permissions**, choose **Read and write permissions**.
4. Save.

The workflow also declares `contents: write` so it can attach generated zip files to releases.

## Create A Release

Create the tag:

```powershell
git tag v0.4.2
git push origin v0.4.2
```

The GitHub Actions workflow builds:

- `xtension-edge-v0.4.2.zip`
- `xtension-chrome-v0.4.2.zip`
- `xtension-firefox-v0.4.2.zip`
- `SHA256SUMS.txt`

If the files are not attached automatically, create or edit the release manually and upload the files from `dist/`.

## Release Notes

Use the matching file:

```text
release-notes/v0.4.2.md
```

## Pre-Publication Check

Run this immediately before pushing:

```powershell
npm run build
npm run check
Get-Content dist\SHA256SUMS.txt
```

Also verify:

- The README contains no personal path.
- No secret or token is present.
- The zip files exist in `dist/`.
- The extension packages include `_locales/`.
- The logo is transparent and readable in `assets/icons/`.

## GitHub API Creation

If a GitHub token is available locally, the repository can be created without using the web interface.
Never commit or print the token.

Official documentation:

- https://docs.github.com/rest/repos/repos#create-a-repository-for-the-authenticated-user
- https://docs.github.com/rest/overview/authenticating-to-the-rest-api

Example PowerShell with `$env:GITHUB_TOKEN` already set:

```powershell
$body = @{ name = "xtension"; private = $false; description = "Browser extension to improve the X/Twitter experience with practical tools." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://api.github.com/user/repos" -Headers @{ Authorization = "Bearer $env:GITHUB_TOKEN"; Accept = "application/vnd.github+json" } -Body $body -ContentType "application/json"
```
