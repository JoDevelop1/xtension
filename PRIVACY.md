# Privacy Policy

Xtension does not collect, sell, or store personal data on a developer-owned server.

The extension runs in the browser on X/Twitter pages. PDF export is processed locally. The optional draft tools (correction, translation, reformulation, and reply generation) use the local Xtension Codex Connector, which the user installs and runs on Windows, and the user's authenticated OpenAI Codex/ChatGPT account. Request data is sent to OpenAI by Codex when an AI operation is requested. Xtension does not request or store an OpenAI API key. Voice dictation is explicitly unavailable in this no-key Codex mode.

## Data Processed Locally

- Visible text from the selected X/Twitter article, tweet, reply composer, or thread.
- Source URL of the selected content.
- Public images, avatars, card images, and video preview thumbnails displayed in the selected content.
- User draft text when the user asks Xtension to correct, translate, or reformulate a draft.
- Extension settings stored in browser extension storage, including the loopback connector URL and an optional local connector token. ChatGPT OAuth tokens are managed by Codex, not stored by Xtension.

## AI Request Processing

When the draft tools are enabled, Xtension sends the visible X/Twitter context, user draft text, or image data needed for generation to the Xtension Codex Connector running on the user's own computer:

- The connector is bound to `127.0.0.1` and is only reachable from the local machine.
- The connector starts the official Codex App Server using ChatGPT-managed OAuth authentication.
- Codex sends the request to OpenAI using the model and reasoning effort selected by the user; the defaults are `gpt-5.6-luna` and maximum reasoning. Xtension does not send data to an Xtension developer server.
- The extension itself cannot execute local commands.

## Data Not Collected by Xtension

- No X/Twitter password.
- No cookie.
- No X/Twitter authentication token.
- No browsing history.
- No private message access.
- No upload to an Xtension developer-owned server.

## Storage

Generated PDFs are saved only through the user's browser download flow. Xtension stores extension settings in browser extension storage so the user's preferences persist.

## Contact

Support: https://github.com/JoDevelop1/xtension/issues
