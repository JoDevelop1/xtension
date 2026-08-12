const wsUrl = process.argv[2];

if (!wsUrl) {
  throw new Error("A DevTools WebSocket URL is required.");
}

const socket = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result || {});
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

async function trustedClick(selector) {
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: "center", inline: "center" });
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) throw new Error(`Missing click target: ${selector}`);
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

await command("Runtime.enable");
await command("Page.enable");
await evaluate("document.fonts?.ready");
for (let attempt = 0; attempt < 40; attempt += 1) {
  const ready = await evaluate(`document.readyState === "complete" && Boolean(document.querySelector("[data-xtension-social-host]"))`);
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 50));
}

const initial = await evaluate(`JSON.stringify({
  hosts: document.querySelectorAll("[data-xtension-social-host]").length,
  actions: Array.from(document.querySelectorAll("[data-xtension-social-action]")).map((button) => button.textContent.trim()),
  submitted: window.__xtensionHarnessSubmitted
})`);
const initialState = JSON.parse(initial);
if (initialState.hosts !== 1 || initialState.actions.length !== 4 || initialState.submitted) {
  const diagnostics = await evaluate(`JSON.stringify({
    readyState: document.readyState,
    platform: document.documentElement.getAttribute("data-xtension-test-platform"),
    editorCount: document.querySelectorAll("textarea[name='comment']").length,
    editorRect: (() => { const rect = document.getElementById("reply")?.getBoundingClientRect(); return rect && { width: rect.width, height: rect.height }; })(),
    chromeRuntime: Boolean(globalThis.chrome?.runtime?.sendMessage),
    scripts: Array.from(document.scripts).map((script) => script.src || "inline"),
    resources: performance.getEntriesByType("resource").map((entry) => entry.name),
    errors: window.__xtensionHarnessErrors || []
  })`);
  throw new Error(`Unexpected initial state: ${initial}; diagnostics: ${diagnostics}`);
}

await trustedClick('[data-xtension-social-action="suggestions"]');
await new Promise((resolve) => setTimeout(resolve, 120));
const generated = JSON.parse(await evaluate(`JSON.stringify({
  panel: document.querySelectorAll("[data-xtension-social-panel]").length,
  suggestions: Array.from(document.querySelectorAll(".xtension-social-suggestion > button")).map((button) => button.textContent.trim()),
  status: document.querySelector("[data-xtension-social-status]")?.textContent || "",
  submitted: window.__xtensionHarnessSubmitted
})`));
if (generated.panel !== 1 || generated.suggestions.length !== 3 || generated.submitted) {
  throw new Error(`Unexpected generated state: ${JSON.stringify(generated)}`);
}

await trustedClick(".xtension-social-suggestion > button");
await new Promise((resolve) => setTimeout(resolve, 120));
const inserted = JSON.parse(await evaluate(`JSON.stringify({
  value: document.getElementById("reply").value,
  panel: document.querySelectorAll("[data-xtension-social-panel]").length,
  submitted: window.__xtensionHarnessSubmitted
})`));
if (inserted.value !== "Réponse 1 pour Reddit" || inserted.panel !== 0 || inserted.submitted) {
  throw new Error(`Unexpected insertion state: ${JSON.stringify(inserted)}`);
}

console.log(JSON.stringify({ initial: initialState, generated, inserted }));
socket.close();
