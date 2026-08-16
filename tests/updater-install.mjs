import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

if (process.platform !== "win32") throw new Error("The connector installer test requires Windows.");

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "xtension-updater-install-"));
const testPort = 47624;
const installedPort = 47623;
const origin = "chrome-extension://bkcoigchdfenookfhogaokpmlkhekeai";
const headers = { Origin: origin };
const child = spawn(process.execPath, [path.join(repositoryRoot, "scripts", "xtension-ai-bridge.js")], {
  cwd: repositoryRoot,
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    XTENSION_BRIDGE_PORT: String(testPort),
    XTENSION_BRIDGE_DATA_DIR: temporaryDirectory,
    XTENSION_DEV_CONNECTOR_VERSION: "0.6.31",
    XTENSION_DEV_UPDATE_CAPTURE: "0",
    XTENSION_UPDATE_INITIAL_DELAY_MS: String(30 * 60 * 1000)
  }
});

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(options.timeoutMs || 10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${data.error || response.statusText}`);
  return data;
}

try {
  let status = null;
  for (let attempt = 0; attempt < 30 && !status; attempt += 1) {
    try {
      status = await requestJson(`http://127.0.0.1:${testPort}/update/status`);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  if (!status?.update?.updateAvailable) {
    throw new Error(`The simulated old connector did not find an update: ${JSON.stringify(status)}`);
  }
  const targetVersion = status.update.latestVersion;
  const accepted = await requestJson(`http://127.0.0.1:${testPort}/update/install`, {
    method: "POST",
    timeoutMs: 180000
  });
  if (accepted.update?.latestVersion !== targetVersion) {
    throw new Error(`Unexpected accepted update: ${JSON.stringify(accepted)}`);
  }

  let sawInstalledConnectorOffline = false;
  let installed = null;
  let updaterState = null;
  let pollAttempt = 0;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (pollAttempt % 10 === 0) {
      try {
        updaterState = (await requestJson(`http://127.0.0.1:${testPort}/update/status`, { timeoutMs: 3000 })).update;
      } catch {
        // The source updater remains best-effort diagnostic state for this test.
      }
    }
    pollAttempt += 1;
    try {
      installed = await requestJson(`http://127.0.0.1:${installedPort}/ping`, { timeoutMs: 1500 });
      if (sawInstalledConnectorOffline && installed.version === targetVersion) break;
    } catch {
      sawInstalledConnectorOffline = true;
      installed = null;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!sawInstalledConnectorOffline || installed?.version !== targetVersion) {
    throw new Error(`The installed connector did not complete a visible restart to ${targetVersion}: ${JSON.stringify(updaterState)}`);
  }

  const auth = await requestJson(`http://127.0.0.1:${installedPort}/auth/status`, { timeoutMs: 20000 });
  if (auth.auth?.authenticated !== true) {
    throw new Error("ChatGPT authentication was not preserved across the connector update.");
  }
  console.log(JSON.stringify({
    fromVersion: "0.6.31",
    toVersion: installed.version,
    restartObserved: sawInstalledConnectorOffline,
    chatGptAuthenticated: true
  }));
} finally {
  child.kill();
  await new Promise((resolve) => child.once("close", resolve));
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
