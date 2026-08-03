# Xtension Release Artifacts

This folder mirrors the current distributable artifacts so GitHub and GitLab both contain the full source and release outputs.

## Browser Packages

The browser packages live in `releases/browser/`:

- `xtension-chrome-v0.6.5.zip`
- `xtension-edge-v0.6.5.zip`
- `xtension-firefox-v0.6.5.zip`
- `SHA256SUMS.txt`

## Windows Bridge

The signed Windows bridge installer lives in `releases/windows/`:

- `XtensionBridgeSetup.exe`
- `XtensionBridgeSetup.SHA256.txt`

Chrome Web Store and Edge Add-ons cannot install the per-user Windows connector automatically. Users install the browser extension from the store, then download and run this no-admin installer only if they want AI features through their authenticated OpenAI Codex/ChatGPT account.
