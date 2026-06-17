# Changelog

## v0.4.10

- Formats the final PDF follow callout as two centered bold lines.
- Uses normal body text sizing for the final PDF callout and keeps the sign-up and profile links on the second line.

## v0.4.9

- Adds a localized final PDF callout after the source link, with clickable links to X and to the exported account profile.
- Updates the PDF menu icon to a monochrome document style so it matches the X/Twitter menu icons.
- Keeps the validated multicolor double-struck X application logo across browser packages and store assets.
- Rebuilds Chrome, Edge, and Firefox packages from the same source assets.

## v0.4.8

- Clarifies install and build documentation so end users do not see development-only Pillow requirements.
- Commits runtime and store assets so package builds only require Node.js by default.

## v0.4.7

- Adds `by JoDevelop` to generated PDF metadata.

## v0.4.6

- Adds hidden PDF generator metadata with the active Xtension version so stale browser content scripts can be diagnosed from the generated file.

## v0.4.5

- Uses Helvetica-compatible PDF text metrics for body justification so generated paragraphs align cleanly to the right margin.

## v0.4.4

- Makes the PDF document icon corner transparent so the folded page effect is visible on light backgrounds.

## v0.4.3

- Restored the red PDF document menu icon style.
- Replaced the application logo with a black transparent double-struck X-style mark.

## v0.4.2

- Justifies prose text in generated PDFs while keeping headings, lists, source URLs, media, and embedded cards in their existing layout.

## v0.4.1

- Added WebExtension localization with the same locale coverage as the PapaClip browser extension.
- Localized extension metadata, the X/Twitter menu action, export progress messages, and PDF fallback text.
- Switched public documentation and generated promotional visuals to English.

## v0.4.0

- Added **Download as PDF** to X/Twitter tweet menus.
- Added PDF export for X/Twitter threads.
- Detects contiguous posts from the same author and stops before replies from other accounts.
- Includes quoted tweets with their available text and media.
- Adds video previews and source notes, because browser PDFs do not play video reliably across viewers.
- Updated release and store copy to cover articles, tweets, and threads.

## v0.3.0

- Renamed the public project to **Xtension**.
- Added a new logo based on a mathematical `x`, distinct from the official X logo.
- Added direct PDF export from X/Twitter article menus.
- Embedded media images in generated PDFs.
- Added separate packages for Edge, Chrome/Chromium, and Firefox.
- Added sideload documentation through GitHub Releases.
- Added a GitHub Actions workflow to generate zips and checksums.

## v0.2.0

- Added direct PDF download with the browser **Save As** dialog.
- Added images to generated PDFs.
- Added the first multi-browser manifests.

## v0.1.0

- Added the Edge/Chrome Manifest V3 prototype.
- Added an action to the article menu.
- Added text extraction for X long-form articles.
