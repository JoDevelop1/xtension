# Xtension Privacy Policy

Effective date: August 20, 2026

Xtension's single purpose is to help users prepare, adapt, and preserve content for use on supported social platforms. This includes drafting and improving posts or replies, generating related images, displaying relevant public relationship context on X/Twitter, and exporting X/Twitter content to PDF.

JoDevelop does not receive, collect, or store the user's page content, drafts, AI requests, or AI responses. There is no JoDevelop processing server, analytics SDK, advertising system, or tracking SDK. When the user chooses an optional AI feature, the requested content goes from the browser through the open-source connector running on that same computer to the selected engine: OpenAI Codex, Claude Code, or a configured Ollama server.

## AI Features and User Control

AI features are off by default. The user turns them on in Xtension's options after an explanation of the available processing paths. Turning them off immediately stops AI draft actions and automatic contextual suggestions.

Turning on AI features does not sign the user into ChatGPT or Claude. Authentication remains owned by the official Codex and Claude Code applications; Xtension and JoDevelop never receive the user's password or OAuth token. Ollama requires no account.

When AI features are on, contextual reply suggestions may be requested when the user deliberately focuses an empty supported reply field. Other AI requests begin only when the user chooses a correction, translation, generation, suggestion, or image action. Results are inserted as editable drafts; Xtension never activates a platform's final publish or submit control.

PDF export works whether or not AI features are enabled. It is generated locally in the browser and is never sent to an AI provider or JoDevelop.

## Data Processed

Depending on the feature and engine chosen, these categories may be used locally or sent to OpenAI or Anthropic to produce the requested result:

- **Website content:** visible text from a nearby post, comment, article, reply composer, quoted post, or same-author thread; the user's draft or instruction; and public images or video thumbnails associated with that content.
- **Identifiers contained in website content:** public display names and account handles visible next to the selected content.
- **Current-page and source URLs:** URLs for the supported page or selected public post, used to preserve sources and give AI the relevant context. Xtension does not build a browsing-history profile.
- **Public relationship context on X/Twitter:** following, followed-by, or mutual status already present in X/Twitter responses, processed locally to display timeline badges independently of the optional AI tools.
- **Extension settings:** AI on/off state, preferred engine, fallback choice, models, reasoning effort, Ollama server URL, writing preferences, loopback connector URL, and an optional local connector token, stored in browser extension storage.
- **Diagnostic metadata:** up to 160 local entries containing operation names, timestamps, durations, text lengths, routing information, and error codes. Full post text, drafts, prompts, account tokens, and API keys are excluded.

Xtension contains no microphone, camera, audio-capture, cookie-reading, password-reading, private-message, or platform-authentication-token code.

## AI Processing Paths

When the user requests an AI feature, the browser sends only the data needed for that request to the Xtension Connector at `127.0.0.1:47623` on the same computer. The connector uses only engines explicitly authorized by the current extension consent version. If fallback is enabled, attempts occur one at a time and stop as soon as one engine returns text. JoDevelop is not in any of these data paths.

- **OpenAI Codex:** the connector starts the official Codex App Server and sends the request to OpenAI using the user's ChatGPT-managed authentication, selected model, and reasoning effort. Images and image generation use this path exclusively.
- **Claude Code:** the connector invokes the official Claude Code CLI using the user's existing `claude.ai` subscription session. Tools, MCP, slash commands, session persistence, API-key environment variables, and automatic retries are disabled. Claude Code adds account metadata, including the signed-in email address, to its own system context; Xtension does not read, log, or store that address.
- **Ollama:** the connector sends the request to the user-configured localhost or private-network Ollama server. This path is local to the user's machine or private network and is not an external Xtension processor.

OpenAI and Anthropic handling is governed by the user's account and their applicable terms and privacy controls. Xtension does not request or store an OpenAI or Anthropic API key, ChatGPT OAuth token, or Claude OAuth token. Authentication is managed by Codex and Claude Code outside extension storage.

No website content, draft, identifier, URL, relationship status, image, or AI response is sent to JoDevelop or to a JoDevelop-owned server.

## Local Connector Security

- The connector binds only to `127.0.0.1`, validates the request `Host`, and is not reachable from the local network or internet.
- The default connector accepts only two fixed Xtension origins: the current Chrome Web Store ID and the legacy Xtension package ID retained for existing installations. It does not accept arbitrary extensions. Other explicitly configured development or browser origins require a shared local secret.
- The extension package contains all executable extension code. It does not download or evaluate remote code.
- The extension cannot execute arbitrary local commands. The separately installed connector performs only its documented Codex, Claude Code, Ollama, update, and native draft-insertion operations. Claude Code runs with tools disabled; Ollama targets are restricted to localhost and private-network addresses.
- After its first manual installation, the connector periodically reads Xtension's public version manifest. If a newer connector exists, it downloads the Windows installer from the documented Xtension/GitHub release hosts, verifies the published SHA-256, the NOVA2G Authenticode signature, and the release version, then installs it silently while no AI operation is active. These version checks contain no page content, draft, ChatGPT account data, or AI request.

## Storage and Retention

Generated PDFs are saved only through the browser's normal save flow. Settings and bounded diagnostic metadata remain in browser extension storage until the user clears them or uninstalls the extension.

The optional Windows connector stores its logs and generated image files locally under `%LOCALAPPDATA%\Xtension\Bridge`. It registers a per-user startup entry at `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\XtensionCodexConnector`. Uninstalling the connector removes the installed program; the user can delete remaining locally generated files or logs.

Xtension has no developer account database and therefore retains no user data on developer infrastructure.

## Limited Use

Xtension's use and transfer of information received from Google APIs, if any, complies with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements. Data is used only to provide or improve Xtension's single user-facing purpose, is not sold, is not used for advertising, is not used for creditworthiness or lending, and is not transferred to humans except with the user's affirmative agreement for support, for security purposes, to comply with law, or as part of a merger or acquisition.

## Contact

Support and privacy questions: contact@jodevelop.com

Issue tracker: https://github.com/JoDevelop1/xtension/issues
