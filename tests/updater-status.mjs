import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "xtension-updater-status-"));
const port = 47624;
const origin = "chrome-extension://bkcoigchdfenookfhogaokpmlkhekeai";
const packagedConnector = process.argv[2] ? path.resolve(process.argv[2]) : "";
const connectorCommand = packagedConnector || process.execPath;
const connectorArgs = packagedConnector ? [] : [path.join(repositoryRoot, "scripts", "xtension-ai-bridge.js")];
const child = spawn(connectorCommand, connectorArgs, {
  cwd: repositoryRoot,
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    XTENSION_BRIDGE_PORT: String(port),
    XTENSION_BRIDGE_DATA_DIR: temporaryDirectory,
    XTENSION_UPDATE_INITIAL_DELAY_MS: String(30 * 60 * 1000)
  }
});

try {
  let data = null;
  let lastError = null;
  for (let attempt = 0; attempt < 30 && !data; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/update/status`, {
        headers: { Origin: origin },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  if (!data) throw lastError || new Error("Updater status endpoint did not answer.");
  if (!data.ok || !/^\d+\.\d+\.\d+$/.test(data.update?.installedVersion || "")) {
    throw new Error(`Unexpected updater state: ${JSON.stringify(data)}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(data.update?.latestVersion || "")) {
    throw new Error(`Latest connector version is missing: ${JSON.stringify(data)}`);
  }
  if (data.update?.canSelfUpdate !== true || data.update?.automatic !== true) {
    throw new Error(`Automatic updater is not enabled: ${JSON.stringify(data)}`);
  }
  console.log(JSON.stringify(data.update));
} finally {
  child.kill();
  await new Promise((resolve) => child.once("close", resolve));
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
