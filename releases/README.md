# Xtension Release Artifacts

This folder mirrors the current distributable artifacts so GitHub and GitLab both contain the full source and release outputs.

## Browser Packages

The browser packages live in `releases/browser/`:

- `xtension-chrome-v0.4.15.zip`
- `xtension-edge-v0.4.15.zip`
- `xtension-firefox-v0.4.15.zip`
- `SHA256SUMS.txt`

## Windows Bridge

The signed Windows bridge installer lives in `releases/windows/`:

- `XtensionBridgeSetup.exe`
- `XtensionBridgeSetup.SHA256.txt`

Chrome Web Store and Edge Add-ons cannot install the Windows service automatically. Users install the browser extension from the store, then download and run this installer only if they want optional AI features through Codex, Grok, Gemini, or Claude.
