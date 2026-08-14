# Changelog

## v0.6.27

- Adds a yellow-gold **↔ Mutual** relationship badge when X/Twitter explicitly reports that the viewer and the timeline author follow each other.
- Displays three distinct inline labels: red **✕ Not following**, blue **✓ Following**, and gold **↔ Mutual**.
- Reuses the `following` and `followed_by` fields from X's existing GraphQL timeline responses, without hover cards or per-profile requests; incomplete relationship data remains unlabelled or non-mutual instead of being guessed.

## v0.6.26

- Moves the Xtension draft-action toolbar onto a dedicated row above X/Twitter's native media toolbar in top-level post composers such as **What's happening?**.
- Prevents Xtension's correction, translation, generation, undo/redo, and language controls from overlapping X's image, GIF, poll, emoji, scheduling, location, and publish controls.
- Recognizes top-level post buttons across the supported English, French, German, Spanish, and Japanese interfaces while retaining the existing dedicated layout in reply composers.

## v0.6.25

- Places the exact native X/Twitter post time or date immediately before the Grok and overflow-menu action group, instead of leaving it at the earlier edge of the author-name block.
- Keeps the timestamp text, link, and `<time>` value supplied by X unchanged and resynchronizes the visible copy when X updates it.
- Retains the far-right author-row fallback for quoted posts and other cards that do not expose the Grok/menu action group.

## v0.6.24

- Restores the X/Twitter post time or date at the far right of the first author line. The visible timestamp is now mirrored outside X's clipped metadata container, while preserving its native post link and keeping the original timestamp as the synchronized source.
- Keeps only the `@handle` on the second line, flush left and without a leading gap.
- Adds a regression fixture that reproduces X's nested overflow clipping so a hidden timestamp can no longer pass the layout test.

## v0.6.23

- Keeps the X/Twitter post time or date at the far right of the first author line, aligned with the display name, relationship badge, and **Reply** button.
- Places only the `@handle` on the second line, flush with the display name and without a leading gap, while preserving the native profile and timestamp links.
- Fixes recurring timeline cleanup removing the metadata layout markers from already-enhanced tweets, which caused older visible rows to revert to the previous single-line layout while newly rendered rows looked correct.

## v0.6.22

- Moves the X/Twitter `@handle · time` metadata onto its own second line beneath the display name and Xtension controls.
- Keeps the display name, relationship badge, and green **Reply** button together and vertically aligned on the first line, including long verified names.

## v0.6.21

- Replaces the longer negative relationship label with the compact red **✕ Following** state, while retaining the blue **✓ Following** state for accounts you follow. The full positive/negative meaning remains available in the tooltip and accessible label.
- Changes the inline X/Twitter **Reply** button from pink to green so it is visually distinct from the relationship badge.
- Regression-tests the exact `Docteur Laurent Alexandre` author row and keeps the display name, relationship badge, and Reply button vertically aligned on one line.

## v0.6.20

- Keeps the X/Twitter relationship badge and **Reply** button on the same author line for long verified display names, including the `Gaëtan Caillot (Bambino)` layout reported from the home timeline.
- Selects X's complete author row before injecting controls, and lets native name/handle text shrink instead of wrapping Xtension controls onto a second line.

## v0.6.19

- Shows a direct **Following** or **Not following** badge beside each known X/Twitter timeline author by reusing relationship data already present in X's GraphQL timeline responses. Unknown states remain unlabelled, and no per-profile hover or extra request is required.
- Adds a shared AI reply toolbar and contextual reply suggestions to Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky, and YouTube. Correction, translation, generation, and suggested-reply insertion use the same local Codex connector as X/Twitter.
- Keeps publication under user control on every platform: generated text is inserted into the visible editor, but Xtension never clicks or submits the platform's publish button.
- Adapts default prompts to the active platform while preserving customized prompts, and keeps native Windows `SendInput` as the preferred insertion path when the installed connector supports it.

## v0.6.18

- Simplifies automatic reply language: Xtension now uses only the post text currently displayed by X, taking its `lang` attribute first and text inference as a fallback. It no longer reads translation banners or clicks **Show original**.
- Replaces the former reply-output language override with a dedicated translation-display language in settings, defaulting to French for existing and new installations.
- Shows a faithful translation under every suggested reply written in another language. Selecting the suggestion inserts only the original reply into X.

## v0.6.17

- Makes Auto language follow the original post rather than the X account language when X displays an automatic translation. Xtension reads X's source-language banner, recognizes localized **Show original** controls anywhere in the post, and waits for the original text before collecting context.
- Stops falling back to the X interface locale when a source post exists but its language metadata is unavailable. The model can infer the language from the post instead of being forced into English.
- Keeps reply suggestions multiline through display and native insertion instead of collapsing their blank lines in the UI sanitation step.
- Replaces the former two/three-paragraph targets with an airy Twitter layout: one short paragraph per distinct sentence or idea, separated by one blank line, with no fixed paragraph-count ceiling. Existing custom prompts remain untouched.

## v0.6.16

- Selects the first still image in the replied-to post as the ImageGen visual reference by default and preloads it as soon as the generation dialog opens.
- Shows the exact source-image thumbnail and a localized loaded/error state before generation, while excluding GIFs, videos, and their thumbnails.
- Remembers the clicked post photo briefly so X reply modals that omit their media node still receive the correct reference from the originating timeline post.
- Prevents a selected reference from being dropped silently: download, format, size, and connector validation failures now stop generation with an actionable message. Diagnostics record both whether the reference was requested and whether it actually reached the connector, without logging image data.

## v0.6.15

- Replaces native window-title matching with a short-lived, single-use target lease that pins the exact foreground browser window, process, UI thread, and focused native child control.
- Fixes Edge tab groups and multi-selected tabs whose native window title does not change when the active page changes its `document.title`.
- Raises the native-input protocol to version 3 so the browser extension and installed connector cannot mix the earlier title-marker flow with the target-lease flow.

## v0.6.14

- Fixes native insertion in real Edge windows whose taskbar title represents a tab group or workspace (for example, “and 11 more pages”) instead of starting with the active page's `document.title`.
- Temporarily places a cryptographically random marker in the active tab title and requires the native Edge/Chrome/Firefox window to contain that exact marker before `SendInput`. The original title is restored immediately after the operation.
- Raises the native-input protocol to version 2 so an updated extension cannot accidentally use the earlier strict-title connector.

## v0.6.13

- Inserts generated, corrected, translated, suggested, restored, and replaced draft text through the installed Windows connector and `SendInput`, so Chrome and Edge create the resulting `keydown`, `beforeinput`, `input`, and `keyup` events with `Event.isTrusted === true`.
- Stops writing streaming AI deltas into the composer through synthetic DOM updates. The final text is delivered once through native Windows input, while non-Windows or legacy connectors retain the existing compatibility fallback.
- Refuses native typing if the foreground browser, page title, native window, or focused native child changes before delivery. Once the connector advertises native typing, a failure no longer falls back silently to synthetic insertion or risks duplicating a partial result.
- Packages, signs, installs, and verifies the dedicated `XtensionInput.exe` helper as part of every Windows connector release. The connector only advertises the capability when the helper is actually present.

## v0.6.12

- Preserves intentional blank lines all the way into the X/Twitter editor, so generated posts and replies can use short, readable paragraphs instead of collapsing into one dense block.
- Updates the default generation and suggestion profiles to separate multiple sentences or ideas with one blank line. Existing custom prompts remain unchanged.
- Lowers the default Luna reasoning effort from `medium` to `low` for short social-writing tasks. In the same local alternating benchmark, Luna averaged about 3.7 seconds at low effort versus 6.3 seconds at medium, while the setting remains adjustable.
- Continuously prepares the next ephemeral Codex thread after a request starts, rather than prewarming only once when the composer opens.
- Shares the download and conversion of one contextual X image across parallel reply suggestions, removing duplicate work without retaining it beyond a short in-memory cache.

## v0.6.11

- Adds a one-click **Copy logs** action. Diagnostic entries now live in a read-only text area, so selecting them cannot drag the selection through Refresh, Clear, or Save button labels.
- Detects an outdated desktop connector instead of reporting it as healthy. The options page shows the installed connector version, highlights required updates, and AI actions stop with a clear update message when a legacy connector does not report a compatible version.
- Removes the five-minute ImageGen cliff. The bounded generation timeout is now ten minutes, Codex turn errors are preserved, and the connector recovers the final image from the authoritative completed-turn payload when an individual item notification was missed.
- Makes every release component use the version in `package.json`. The Windows installer now records its real built version instead of always displaying 0.6.5, and installation verifies the connector version returned by `/ping`.
- Binds settings controls before network checks and caps connection-status requests at 15 seconds, so a stopped connector cannot make Save, tabs, or diagnostics appear frozen.
- Aligns the options page with the v20 configuration migration and the `medium` reasoning default already used by the background worker and connector.

## v0.6.10

- The download links in the extension and on the website now point straight at `github.com` instead of going through a redirect on the project domain. Users see where the binary comes from before they click, rather than discovering it after. The `xtension.jodevelop.com/dl/…` aliases keep working for older installs and for scripts.
- The download section states explicitly that every file is served by GitHub Releases, from this project's own repository.

## v0.6.9

- Fixes image generation silently failing on long runs. The connector allowed up to 5 minutes to produce an image, but closed the HTTP connection after 4. A long generation was therefore completed by Codex and logged as successful, while the browser never received it and the image never appeared. The connection now outlives the longest possible operation.
- The image dialog shows elapsed seconds while generating. Image generation legitimately takes one to three minutes, and a frozen dialog was indistinguishable from a hang. Errors now report how long they took, which separates an immediate failure from an abandoned long generation.

## v0.6.8

Latency release. Measured on repeated draft corrections, alternating requests between the old and the new connector to absorb service variability:

| | before | after |
|---|---|---|
| full result | 5823 ms | **3266 ms** (−44 %) |
| first word on screen | 5823 ms | **2817 ms** (−52 %) |

- Stops asking the model for a reasoning summary. Xtension never displayed it, and producing it cost about 1.8 s per request — the single largest win.
- Default reasoning effort drops from `max` to `medium`. On a tweet-length correction or translation the result is equivalent, for roughly 1.2 s less. Existing installs are migrated only if they still carry the old default; anything you picked yourself is kept, and the setting remains available.
- Stops refreshing the OAuth token before every single request. The account is now read once and cached for ten minutes, and invalidated on sign-in, sign-out or any authentication failure, which removes about 0.4 s per request.
- Prepares a Codex thread while you are still typing, so the request no longer waits for one to be created.
- Correction and translation now stream, like generation already did: the text appears as it is written instead of after a frozen wait.

Model choice was measured too: `gpt-5.4-mini` and `gpt-5.3-codex-spark` are **slower** than `gpt-5.6-luna` on these short tasks, so the default model is unchanged.

## v0.6.7

- Removes voice dictation entirely. ChatGPT-managed Codex exposes no transcription model, so the feature could never produce a result; the button, the microphone capture, the recorder, the voice-activity detection and the `/transcribe` route are all gone. The packages now contain **zero** `getUserMedia`, `MediaRecorder` or audio-capture code, which also removes any microphone declaration from the store forms. Speech input, if it ever returns, will be a separate application.
- Relicenses the project under the **Apache License 2.0**. Xtension is free software: use, modification and redistribution are allowed, including commercially, with an explicit patent grant. Adds a `NOTICE` file.
- Trims about 50 KB from every browser package.

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
