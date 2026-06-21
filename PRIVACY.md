# Privacy Policy

Xtension does not collect, sell, or store personal data on a developer server.

The extension runs in the browser on X/Twitter pages. PDF export is processed locally. AI reply and draft tools are optional and use the local Xtension Bridge when the user installs and runs it on Windows.

## Data Processed Locally

- Visible text from the selected X/Twitter article, tweet, reply composer, or thread.
- Source URL of the selected content.
- Public images, avatars, card images, and video preview thumbnails displayed in the selected content.
- User draft text when the user asks Xtension to correct, translate, or generate a draft.
- Extension settings stored in browser extension storage, including bridge URL, optional bridge token, selected provider, and selected model.

## Optional AI Provider Requests

When AI tools are enabled, Xtension sends the visible X/Twitter context and user draft text to the bridge running on the user's own computer:

- The bridge is bound to `127.0.0.1` by default.
- The bridge calls the selected desktop CLI already installed by the user: Codex, Grok, Gemini, or Claude.
- The extension itself cannot execute local commands.

Xtension does not provide, install, or operate the selected AI provider. Provider request handling is governed by the user's CLI installation and account.

## Data Not Collected by Xtension

- No X/Twitter password.
- No cookie.
- No X/Twitter authentication token.
- No browsing history.
- No private message access.
- No upload to a developer-owned server.

## Storage

Generated PDFs are saved only through the user's browser download flow. Xtension stores extension settings in browser extension storage so the user's preferences persist.

## Contact

Support: https://github.com/JoDevelop1/xtension/issues
