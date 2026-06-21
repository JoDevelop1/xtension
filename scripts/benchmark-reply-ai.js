const bridgeUrl = String(process.env.XTENSION_CODEX_BRIDGE_URL || getArg("bridge", "http://127.0.0.1:47623")).replace(/\/+$/, "");
const model = getArg("model", process.env.XTENSION_CODEX_MODEL || "gpt-5.3-codex-spark");
const iterations = Math.max(1, Number.parseInt(getArg("iterations", "2"), 10) || 2);

const tasks = [
  {
    id: "correct-fr",
    endpoint: "/transform",
    payload: {
      operation: "correct",
      locale: "fr",
      model,
      text: "Je test une reponse faus"
    },
    pick: (data) => data?.text || data?.correctedText || ""
  },
  {
    id: "translate-en",
    endpoint: "/transform",
    payload: {
      operation: "translate",
      locale: "fr",
      targetLanguage: "en",
      model,
      text: "Je ne suis pas convaincu par cette annonce."
    },
    pick: (data) => data?.text || data?.translatedText || ""
  },
  {
    id: "reply-suggestions",
    endpoint: "/reply",
    payload: {
      locale: "fr",
      targetLanguage: "fr",
      replyCount: 3,
      replyStyle: "auto",
      model,
      context: {
        authorName: "Xtension",
        authorHandle: "xtension",
        sourceUrl: "https://x.com/",
        tweetLanguage: "fr",
        tweetText: "Je cherche un outil qui corrige mes réponses X sans installer de modèle local lourd.",
        toneSignals: ["tooling", "asks for practical advice"]
      }
    },
    pick: (data) => Array.isArray(data?.replies) ? data.replies.map((reply) => reply.text).join(" | ") : ""
  }
];

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});

async function main() {
  const rows = [];

  for (const task of tasks) {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const startedAt = Date.now();
      const data = await postJson(`${bridgeUrl}${task.endpoint}`, task.payload);
      rows.push({
        task: task.id,
        iteration: iteration + 1,
        ok: true,
        durationMs: Date.now() - startedAt,
        output: truncateText(task.pick(data), 180)
      });
    }
  }

  const summary = summarize(rows);
  console.log(JSON.stringify({ bridgeUrl, model: model || "codex-cli-default", iterations, summary, rows }, null, 2));
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`${url} failed (${response.status}): ${truncateText(await response.text().catch(() => ""), 400)}`);
  }

  return await response.json();
}

function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    const current = groups.get(row.task) || [];
    current.push(row.durationMs);
    groups.set(row.task, current);
  }

  return Object.fromEntries(Array.from(groups.entries()).map(([task, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const avg = Math.round(values.reduce((total, value) => total + value, 0) / values.length);
    return [task, {
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      avgMs: avg
    }];
  }));
}

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
