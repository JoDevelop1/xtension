# Security

Xtension does not operate a developer-owned data-collection server. Optional AI draft tools use a local loopback connector and one explicitly selected engine: the user's authenticated OpenAI Codex/ChatGPT session, the user's authenticated Claude Code subscription session, or a configured localhost/private-network Ollama server. Text and selected social context can be sent to the selected engine; images remain on the Codex path. Xtension does not request or store OpenAI or Anthropic API keys. Voice dictation is unavailable.

The connector is bound to `127.0.0.1`, restricts browser-extension origins, uses ephemeral read-only Codex threads, and denies Codex tool approvals. Claude Code runs without tools, MCP, slash commands, session persistence, API-key environment variables, or automatic retries. Ollama destinations are restricted to localhost and private IP ranges. Codex and Claude Code own their OAuth token lifecycles; the extension and connector do not expose those tokens to browser storage or request logs.

To report a vulnerability:

1. Open a GitHub issue if the report does not contain sensitive data.
2. If the report contains sensitive details, contact the repository maintainer privately before public disclosure.

Never include cookies, tokens, screenshots of private messages, or personal information in a public issue.
