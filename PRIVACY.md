# Xtension Privacy Policy

Effective date: August 16, 2026

Xtension's single purpose is to help users prepare, adapt, and preserve content for use on supported social platforms. This includes drafting and improving posts or replies, generating related images, displaying relevant public relationship context on X/Twitter, and exporting X/Twitter content to PDF.

Xtension does not sell data, use data for advertising or creditworthiness, or send data to a server owned by the developer. The extension has no analytics or tracking SDK. Some optional AI features do transmit data to OpenAI through a connector running on the user's own computer, as described below.

## Consent and Control

AI processing is disabled by default. Before any supported-page content, draft, URL, author identifier, relationship context, or image is processed for AI features, the user must affirmatively accept the disclosure shown in Xtension's options and enable the AI tools. A user can withdraw consent at any time by disabling the AI tools or clearing that consent in the options.

After consent, Xtension may request contextual reply suggestions when the user deliberately focuses an empty supported reply field. Other AI operations begin when the user chooses an Xtension correction, translation, generation, suggestion, or image action. Xtension inserts results as editable drafts and never activates a platform's final publish or submit control.

PDF export does not require AI consent. It is generated locally in the browser and is never sent to OpenAI or the developer.

## Data Processed

Depending on the feature used, Xtension may process these categories:

- **Website content:** visible text from a nearby post, comment, article, reply composer, quoted post, or same-author thread; the user's draft or instruction; and public images or video thumbnails associated with that content.
- **Identifiers contained in website content:** public display names and account handles visible next to the selected content.
- **Current-page and source URLs:** URLs for the supported page or selected public post, used to preserve sources and give AI the relevant context. Xtension does not build a browsing-history profile.
- **Public relationship context on X/Twitter:** following, followed-by, or mutual status already present in X/Twitter responses, used to display timeline badges. This observation remains off until AI processing has been accepted and enabled.
- **Extension settings:** consent state, AI enablement, model, reasoning effort, writing preferences, loopback connector URL, and an optional local connector token, stored in browser extension storage.
- **Diagnostic metadata:** up to 160 local entries containing operation names, timestamps, durations, text lengths, routing information, and error codes. Full post text, drafts, prompts, account tokens, and API keys are excluded.

Xtension contains no microphone, camera, audio-capture, cookie-reading, password-reading, private-message, or platform-authentication-token code.

## AI Request Processing and Sharing

When an AI feature is enabled and invoked, Xtension sends only the data needed for that feature to the Xtension Codex Connector at `127.0.0.1:47623` on the user's computer. The connector starts the official Codex App Server and sends the request to OpenAI using the user's ChatGPT-managed authentication, selected model, and reasoning effort.

OpenAI is the only external AI processor used by these features. Its handling of data is governed by the user's OpenAI account and applicable OpenAI terms and privacy controls. Xtension does not request or store an OpenAI API key or ChatGPT OAuth token. ChatGPT authentication is managed by Codex outside extension storage.

No website content, draft, identifier, URL, relationship status, image, or AI response is sent to a developer-owned server.

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
