# Changelog

## v0.6.6

Security and store-readiness release. No feature change.

- The dictation button now asks the connector whether transcription exists **before** requesting microphone access, instead of recording first and failing afterwards. With the ChatGPT-managed Codex account it reports unavailable without ever opening the microphone.
- The connector rejects requests that do not present a browser-extension origin, and validates the `Host` header, closing DNS rebinding and blocking any other local process from reading the ChatGPT account or spending its quota. A new `/ping` route exposes liveness only, with no account data, for install-time checks.
- Composer actions ignore synthetic events and only trust buttons the extension actually created, so a script running inside x.com can no longer trigger AI actions on the user's behalf.
- Image fetches by the service worker are restricted to the public X/Twitter media hosts, and the Codex sign-in page is only opened when it is an OpenAI HTTPS address.
- The installer runs `sc.exe` and `schtasks.exe` from their absolute `System32` paths, preventing a same-named binary earlier in `PATH` from being executed instead.
- Firefox: real add-on id `xtension@jodevelop.com` in place of the `example.invalid` placeholder, and the `data_collection_permissions` declaration AMO now requires.
- `PRIVACY.md` documents the dictation preflight, the microphone case, the sanitized local diagnostic log, and the files the separately installed connector writes.
- Store listings, manifest descriptions and the README describe the actual 0.6.x feature set instead of the 0.4 PDF-only wording.
- The build pins `@yao-pkg/pkg` to 6.22.0 so the signed connector is reproducible.
- Downloads move to GitHub Releases, mirrored at https://xtension.jodevelop.com.

## v0.6.5

- Adds three compact ImageGen presets for visual style, framing, and mood without overcrowding the generation dialog.
- Offers Auto, Photorealistic, Drawing/Illustration, Infographic, and 3D visual styles, plus practical framing and lighting choices.
- Normalizes every preset in the extension and connector before translating it into focused Codex image-generation instructions.

## v0.6.4

- Adds selectable 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, and 2:3 formats to Codex image generation and sends exact compatible canvas dimensions to ImageGen.
- Closes the image-generation window automatically after the generated image is successfully added to the X post, while keeping it open when X rejects the attachment.

## v0.6.3

- Restores the writing settings, output language, reply style, generation prompt, three customizable suggested-reply prompts, and diagnostic logs without bringing back local models or alternate providers.
- Restores contextual reply suggestions and routes each customized prompt through the authenticated OpenAI Codex App Server session.
- Opens the full settings page directly when the browser toolbar icon is clicked, removing the intermediate popup.
- Keeps the signed connector install/update link visible alongside separate connector, Codex, and ChatGPT account status.
- Adds Codex image generation from the X/Twitter composer, with optional post-image reference, preview, download, and best-effort attachment to the post.

## v0.6.2

- Replaces the system-level Windows service with a silent per-user connector host so Codex uses the same Windows profile and ChatGPT OAuth session as the signed-in user.
- Installs without administrator rights under the current user's local application data and starts automatically at sign-in.
- Restores a contextual connector-install action only when the connector is unavailable.
- Keeps the live Codex model picker and per-model reasoning-effort choice for every AI request, with Luna and maximum reasoning as defaults.
- Removes the misleading "local Codex host" wording: only the small loopback connector is local; model inference runs through OpenAI Codex.

## v0.6.1

- Fixes the Codex connection test so it reads the authenticated account from both current and legacy bridge responses.
- Adds a live OpenAI Codex model picker with per-model reasoning-effort compatibility, while keeping Luna/maximum as the default.
- Replaces the multi-panel options layout with one compact ChatGPT/Codex connection page; the connected state is shown by a badge and only the relevant connect/disconnect action is visible.
- Keeps Correction, Translation, Reformulation, Dictation, Suggestions, Undo, and Redo visible in an open X composer even when X changes focus or markup around the composer.
- Hides the connector-install action while the connector is available.

## v0.6.0

- Replaces the local model bridge with the official Codex App Server and ChatGPT-managed OAuth authentication; no OpenAI API key is requested or stored.
- Routes every text operation through `gpt-5.6-luna` with maximum reasoning and read-only ephemeral threads.
- Removes the old local model, speech-model provisioning, provider selection, GPU controls, and obsolete local benchmark.
- Adds ChatGPT connect/disconnect/status controls to the options page and migrates the Windows service/installer to the Codex connector.
- The legacy voice-dictation route now reports clearly that transcription is unavailable in this no-key ChatGPT/Codex mode instead of silently falling back to a local model.

## v0.5.0

- Moves all AI features to a fully local engine: the Xtension Bridge now runs a compact model (Gemma 3 4B via llama.cpp) on the user's own computer for correction, translation, and post reformulation, plus local speech-to-text for voice dictation. No cloud, no API key, no data leaves the machine.
- Rebuilds voice dictation around Parakeet TDT 0.6B v3 (ggml, CPU-only): a spoken phrase now appears in about one second instead of up to thirty, with live interim text while you are still speaking (refreshed every ~1.2 s and replaced by the final phrase at each pause).
- Eliminates the "Thank you." / "Sous-titres réalisés par la communauté d'Amara.org" endings: silence and noise produce no text at all (transducer engine that emits nothing without speech, plus an energy gate, Silero VAD on the whisper fallback, and a hallucination filter).
- Keeps a whisper.cpp fallback (small-q5_1, resident server, adaptive encoder window, per-session pinned language) for languages Parakeet does not cover; the browser locale is only a routing hint and the spoken language is still auto-detected.
- Warms up the dictation engine and the text model as soon as the composer opens, so the first microphone click and the first correction are already fast.
- Removes the multi-provider system (Codex, Grok, Gemini, Claude) and the Grok sign-in/reconnect flow.
- Removes the reply-suggestions panel; the composer keeps Correction, Translation, Reformulation, and Dictation.
- Simplifies the options page: no provider or model menus, just the enable toggle, draft language, and local engine status.

## v0.4.15

- Starts each X/Twitter thread tweet on a new page when its text and images would otherwise split across pages.
- Keeps the extension package version visible as `0.4.15` so reloads are easy to verify.

## v0.4.14

- Keeps multiple images from the same X/Twitter post in a compact grid.
- Keeps PDF image and hyperlink annotations as direct links for broad PDF viewer compatibility.
- Fixes exported URLs where `https://` could appear on a separate line.

## v0.4.13

- Removes the Chrome `downloads` permission and saves generated PDFs through a local browser download link.

## v0.4.12

- Forces the X/Twitter menu item text and icon color to black so it cannot inherit red destructive-menu styling.

## v0.4.11

- Fixes spacing in the final bold PDF follow callout by measuring Helvetica Bold text correctly.
- Renders continuous rich-text runs instead of drawing every word separately, preventing collapsed spaces between words and links.

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
