# Xtension Privacy Policy

Effective date: August 16, 2026

Xtension's single purpose is to help users prepare, adapt, and preserve content for use on supported social platforms. This includes drafting and improving posts or replies, generating related images, displaying relevant public relationship context on X/Twitter, and exporting X/Twitter content to PDF.

JoDevelop does not receive, collect, or store the user's page content, drafts, AI requests, or AI responses. There is no JoDevelop processing server, analytics SDK, advertising system, or tracking SDK. When the user chooses an optional AI feature, the requested content goes from the user's browser to OpenAI through the open-source connector running on that same computer.

## AI Features and User Control

AI features are off by default. The user turns them on in Xtension's options after a short explanation of the OpenAI connection. Turning them off immediately stops AI draft actions and automatic contextual suggestions.

Turning on AI features does not sign the user into ChatGPT. Account authentication is a separate step handled by the local connector and the official OpenAI sign-in flow; Xtension and JoDevelop never receive the user's password or OAuth token.

When AI features are on, contextual reply suggestions may be requested when the user deliberately focuses an empty supported reply field. Other AI requests begin only when the user chooses a correction, translation, generation, suggestion, or image action. Results are inserted as editable drafts; Xtension never activates a platform's final publish or submit control.

PDF export works whether or not AI features are enabled. It is generated locally in the browser and is never sent to OpenAI or JoDevelop.

## Data Processed

Depending on the feature chosen, these categories may be used locally or sent to OpenAI to produce the requested result:

- **Website content:** visible text from a nearby post, comment, article, reply composer, quoted post, or same-author thread; the user's draft or instruction; and public images or video thumbnails associated with that content.
- **Identifiers contained in website content:** public display names and account handles visible next to the selected content.
- **Current-page and source URLs:** URLs for the supported page or selected public post, used to preserve sources and give AI the relevant context. Xtension does not build a browsing-history profile.
- **Public relationship context on X/Twitter:** following, followed-by, or mutual status already present in X/Twitter responses, processed locally to display timeline badges independently of the optional AI tools.
- **Extension settings:** AI on/off state, model, reasoning effort, writing preferences, loopback connector URL, and an optional local connector token, stored in browser extension storage.
- **Diagnostic metadata:** up to 160 local entries containing operation names, timestamps, durations, text lengths, routing information, and error codes. Full post text, drafts, prompts, account tokens, and API keys are excluded.

Xtension contains no microphone, camera, audio-capture, cookie-reading, password-reading, private-message, or platform-authentication-token code.

## What Is Sent to OpenAI

When the user requests an AI feature, the browser sends only the data needed for that request to the Xtension Codex Connector at `127.0.0.1:47623` on the same computer. The connector starts the official Codex App Server and forwards the request directly to OpenAI using the user's ChatGPT-managed authentication, selected model, and reasoning effort. JoDevelop is not in this data path.

OpenAI is the only external AI processor used by these features. Its handling of data is governed by the user's OpenAI account and applicable OpenAI terms and privacy controls. Xtension does not request or store an OpenAI API key or ChatGPT OAuth token. ChatGPT authentication is managed by Codex outside extension storage.

No website content, draft, identifier, URL, relationship status, image, or AI response is sent to JoDevelop or to a JoDevelop-owned server.

## Local Connector Security

- The connector binds only to `127.0.0.1`, validates the request `Host`, and is not reachable from the local network or internet.
- The default connector accepts the official Chrome Web Store Xtension origin only. Other explicitly configured development or browser origins require a shared local secret.
- The extension package contains all executable extension code. It does not download or evaluate remote code.
- The extension cannot execute local commands. The separately installed connector performs only its documented Codex and native draft-insertion operations.

## Storage and Retention

Generated PDFs are saved only through the browser's normal save flow. Settings and bounded diagnostic metadata remain in browser extension storage until the user clears them or uninstalls the extension.

The optional Windows connector stores its logs and generated image files locally under `%LOCALAPPDATA%\Xtension\Bridge`. It registers a per-user startup entry at `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\XtensionCodexConnector`. Uninstalling the connector removes the installed program; the user can delete remaining locally generated files or logs.

Xtension has no developer account database and therefore retains no user data on developer infrastructure.

## Limited Use

Xtension's use and transfer of information received from Google APIs, if any, complies with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements. Data is used only to provide or improve Xtension's single user-facing purpose, is not sold, is not used for advertising, is not used for creditworthiness or lending, and is not transferred to humans except with the user's affirmative agreement for support, for security purposes, to comply with law, or as part of a merger or acquisition.

## Contact

Support and privacy questions: contact@jodevelop.com

Issue tracker: https://github.com/JoDevelop1/xtension/issues
