# Security

Xtension does not operate a developer-owned data-collection server. The optional AI draft tools use a local loopback connector and the user's authenticated OpenAI Codex/ChatGPT session. Text, selected X/Twitter context, and images included for generation can therefore be sent to OpenAI to fulfil the user's request. Xtension does not request or store an OpenAI API key. Voice dictation is explicitly unavailable in this no-key Codex mode.

The connector is bound to `127.0.0.1`, restricts browser-extension origins, uses ephemeral read-only Codex threads, and denies tool-approval requests. Codex owns the ChatGPT OAuth token lifecycle; the extension and connector do not expose that token to browser storage or request logs.

To report a vulnerability:

1. Open a GitHub issue if the report does not contain sensitive data.
2. If the report contains sensitive details, contact the repository maintainer privately before public disclosure.

Never include cookies, tokens, screenshots of private messages, or personal information in a public issue.
