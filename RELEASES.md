# Install From GitHub Releases

Until Xtension is published in browser stores, users can install it manually from GitHub release archives.

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

## Optional AI Bridge for Windows

The browser extension cannot install desktop executables by itself. To use Codex, Grok, Gemini, or Claude from Xtension, download and run `XtensionBridgeSetup.exe`.

The installer requests administrator rights, copies the signed bridge files, creates the automatic `XtensionBridge` Windows service, starts it, and verifies the local bridge endpoint.

## Verify Checksums

In PowerShell:

```powershell
Get-FileHash .\xtension-edge-vX.Y.Z.zip -Algorithm SHA256
```

Compare the value with the corresponding line in `SHA256SUMS.txt`.
