# Xtension Release Artifacts

Distributable artifacts are published as **GitHub Release assets**, not committed to the
repository. Every published build is available from:

- https://github.com/JoDevelop1/xtension/releases/latest
- https://xtension.jodevelop.com — same files behind stable URLs, with the checksums

```text
https://xtension.jodevelop.com/dl/xtension-chrome.zip
https://xtension.jodevelop.com/dl/xtension-edge.zip
https://xtension.jodevelop.com/dl/xtension-firefox.zip
https://xtension.jodevelop.com/dl/XtensionBridgeSetup.exe
https://xtension.jodevelop.com/dl/SHA256SUMS.txt
```

`https://xtension.jodevelop.com/version.json` returns the current version and these URLs as JSON.

## Why the installer is no longer committed

`XtensionBridgeSetup.exe` is an 82 MB self-contained binary. Committing a new copy on every
release made the repository grow by that amount each time and pushed the packfile past what
some Git hosts accept in a single push. It is now attached to the GitHub Release instead.
The browser `.zip` packages of past versions are still mirrored under `releases/browser/`
because they are small.

## Windows Connector

Chrome Web Store and Edge Add-ons cannot install the per-user Windows connector
automatically. Users install the browser extension from the store, then download and run the
no-admin installer only if they want AI features through their authenticated OpenAI
Codex/ChatGPT account. The installer is signed with Microsoft Trusted Signing; verify it with
`Get-FileHash` against `XtensionBridgeSetup.SHA256.txt` published alongside it.
