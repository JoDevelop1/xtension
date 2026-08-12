# Privacy Policy

Xtension does not collect, sell, or store personal data on a developer-owned server.

Xtension contains no microphone, camera, or audio-capture code. The extension runs on X/Twitter, Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky, and YouTube pages. X/Twitter PDF export is processed locally. The optional draft tools (correction, translation, reformulation, reply generation, and image generation) use the local Xtension Codex Connector, which the user installs and runs on Windows, and the user's authenticated OpenAI Codex/ChatGPT account. Request data is sent to OpenAI by Codex when an AI operation is requested. Xtension does not request or store an OpenAI API key.

## Data Processed Locally

- Visible text from the selected or nearby post, comment, article, reply composer, or thread on a supported platform.
- Source URL of the selected content.
- Public images, avatars, card images, and video preview thumbnails displayed in the selected content.
- User draft text when the user asks Xtension to correct, translate, or reformulate a draft.
- Extension settings stored in browser extension storage, including the loopback connector URL and an optional local connector token. ChatGPT OAuth tokens are managed by Codex, not stored by Xtension.
- A local diagnostic log, capped at 160 entries, kept in extension storage and clearable from the options page. It records operation names, timestamps, durations, text *lengths*, and error codes. Draft text, tweet content, prompts, tokens, and API keys are stripped before an entry is written.

## AI Request Processing

When the draft tools are enabled, Xtension sends the visible supported-platform context, user draft text, or image data needed for generation to the Xtension Codex Connector running on the user's own computer:

- The connector is bound to `127.0.0.1` and is only reachable from the local machine.
- The connector only accepts requests presenting a browser-extension origin, and validates the `Host` header so that a remote site cannot reach it through DNS rebinding.
- The connector starts the official Codex App Server using ChatGPT-managed OAuth authentication.
- Codex sends the request to OpenAI using the model and reasoning effort selected by the user; the defaults are `gpt-5.6-luna` and low reasoning. Xtension does not send data to an Xtension developer server.
- The extension itself cannot execute local commands.

## Data Not Collected by Xtension

- No X/Twitter password.
- No cookie.
- No X/Twitter authentication token.
- No browsing history.
- No private message access.
- No automatic publication: Xtension inserts drafts but never activates a platform's final publish or submit control.
- No analytics, tracking, or advertising.
- No upload to an Xtension developer-owned server.

## Storage

Generated PDFs are saved only through the user's browser download flow. Xtension stores extension settings and the local diagnostic log in browser extension storage so the user's preferences persist.

The separately installed Windows connector writes on the user's own machine only, under `%LOCALAPPDATA%\Xtension\Bridge`: its operation log, and any image generated through the image tool. It also registers a per-user startup entry (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run\XtensionCodexConnector`) so it is available when the user signs in. Uninstalling the connector removes both.

## Contact

Support: https://github.com/JoDevelop1/xtension/issues
