const wsUrl = process.argv[2];
const action = process.argv[3] || "read";

if (!wsUrl) {
  throw new Error("A DevTools WebSocket URL is required.");
}

const socket = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) {
    return;
  }
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) {
    reject(new Error(message.error.message));
  } else {
    resolve(message.result || {});
  }
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

if (action === "focus") {
  await command("Page.bringToFront");
  await command("Runtime.evaluate", {
    expression: `
      window.__resetXtensionTest();
      document.getElementById("target").focus();
      document.title;
    `,
    returnByValue: true
  });
  console.log("focused");
} else {
  const result = await command("Runtime.evaluate", {
    expression: `JSON.stringify({
      events: window.__xtensionEvents,
      text: document.getElementById("target").innerText
    })`,
    returnByValue: true
  });
  console.log(result.result?.value || "{}");
}

socket.close();
