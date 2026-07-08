# Privacy Policy

Xtension does not collect, sell, or store personal data on a developer server.

The extension runs in the browser on X/Twitter pages. PDF export is processed locally. The draft tools (correction, translation, reformulation) and voice dictation are optional and run entirely on the user's own computer through the local Xtension Bridge, which the user installs and runs on Windows. No text or audio is sent to any server.

## Data Processed Locally

- Visible text from the selected X/Twitter article, tweet, reply composer, or thread.
- Source URL of the selected content.
- Public images, avatars, card images, and video preview thumbnails displayed in the selected content.
- User draft text when the user asks Xtension to correct, translate, or reformulate a draft.
- Voice recordings captured for dictation, transcribed locally and then discarded.
- Extension settings stored in browser extension storage, including the local engine URL and an optional engine token.

## Local AI Processing

When the draft tools or dictation are enabled, Xtension sends the visible X/Twitter context, user draft text, or voice recording to the Xtension Bridge running on the user's own computer:

- The bridge is bound to `127.0.0.1` and is only reachable from the local machine.
- The bridge runs a small AI model locally (via llama.cpp) for text tasks and a local speech-to-text engine (whisper) for dictation. The model is downloaded once from a public model host, then runs offline.
- Nothing is sent to Xtension, to the developer, or to any third-party AI server. There is no API key and no cloud provider.
- The extension itself cannot execute local commands.

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
