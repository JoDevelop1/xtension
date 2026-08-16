import fs from "node:fs";

const wsUrl = process.argv[2];
const screenshotPath = process.argv[3];
if (!wsUrl || !screenshotPath) throw new Error("DevTools WebSocket URL and output path are required.");

const socket = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result || {});
});
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
function command(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Evaluation failed");
  return response.result?.value;
}

await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
for (let attempt = 0; attempt < 80; attempt += 1) {
  const ready = await evaluate('document.readyState === "complete" && Boolean(document.querySelector("#reply-ai-enabled"))');
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 50));
}
const disclosure = await evaluate('document.querySelector("[data-i18n=optionsPrivacyDisclosure]")?.textContent || ""');
if (!disclosure.includes("OpenAI") || !disclosure.includes("PDF")) {
  throw new Error("The real options disclosure was not rendered before screenshot capture.");
}
await evaluate('window.scrollTo(0, 0); document.querySelector("#reply-ai-enabled")?.focus(); true');
const screenshot = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
socket.close();
