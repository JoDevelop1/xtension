# Install From a Release Archive

Until Xtension is published in browser stores, users can install it manually from a release archive.

All builds are published as GitHub Release assets. The download links in the extension and on the
website point directly at github.com so you can see the source before clicking:

```text
https://github.com/JoDevelop1/xtension/releases/latest
https://github.com/JoDevelop1/xtension/releases/latest/download/XtensionBridgeSetup.exe
```

The `https://xtension.jodevelop.com/dl/…` aliases still resolve to the same assets and remain
available for scripts and for extensions installed before 0.6.10.

`https://xtension.jodevelop.com/version.json` returns the current version and these URLs as JSON.
The same archives are attached to each GitHub release.

## Which File Should I Download?

- Microsoft Edge: `xtension-edge-vX.Y.Z.zip`
- Chrome, Brave, Vivaldi, Opera: `xtension-chrome-vX.Y.Z.zip`
- Firefox: `xtension-firefox-vX.Y.Z.zip`
- Optional Windows AI bridge installer: `XtensionBridgeSetup.exe`

`SHA256SUMS.txt` lets you verify that the downloaded archives match the files generated during the release.

The Windows bridge installer also includes `XtensionBridgeSetup.SHA256.txt`.

## Edge

1. Download `xtension-edge-vX.Y.Z.zip`.
2. Extract the zip into a stable folder, for example `Documents/Xtension/edge`.
3. Open `edge://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted folder.

## Chrome / Brave / Vivaldi / Opera

1. Download `xtension-chrome-vX.Y.Z.zip`.
2. Extract the zip into a stable folder.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted folder.

## Firefox

Firefox does not keep unsigned extensions permanently when they are loaded through `about:debugging`.

For temporary testing:

1. Download `xtension-firefox-vX.Y.Z.zip`.
2. Extract the zip.
3. Open `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on**.
5. Select `manifest.json` in the extracted folder.

For permanent Firefox installation, the extension must be signed through Mozilla Add-ons.

## Optional OpenAI Codex Connector for Windows

The browser extension cannot install desktop executables by itself. To use OpenAI Codex from Xtension, download and run `XtensionBridgeSetup.exe`, then connect the ChatGPT account from Xtension options.

The installer needs no administrator rights. It copies the connector into the current user's local application data, starts a silent host in the same Windows session as Codex, enables current-user startup, and verifies the loopback endpoint. This lets it reuse that user's existing ChatGPT OAuth session.

## Verify Checksums

In PowerShell:

```powershell
Get-FileHash .\xtension-edge-vX.Y.Z.zip -Algorithm SHA256
```

Compare the value with the corresponding line in `SHA256SUMS.txt`.
