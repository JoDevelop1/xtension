"use strict";

// Benchmark des petits modèles locaux (llama.cpp / GGUF) pour Xtension.
// Tâche évaluée = exactement celle du bridge : correction / traduction /
// reformulation de brouillon, sortie JSON {"text":"..."} en CPU pur.
//
// Usage :
//   node scripts/benchmark-local-models.js
// Variables d'environnement :
//   XT_BENCH_DIR     dossier racine (défaut C:\ProgramData\Xtension\Bridge\bench)
//   XT_BENCH_THREADS threads llama-server (défaut 8, pour représenter un CPU client courant)

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const BENCH_DIR = process.env.XT_BENCH_DIR || path.join(process.env.ProgramData || os.tmpdir(), "Xtension", "Bridge", "bench");
const MODELS_DIR = path.join(BENCH_DIR, "models");
const LLAMA_SERVER = process.env.XT_LLAMA_SERVER || path.join(BENCH_DIR, "llama", "llama-server.exe");
const THREADS = Number.parseInt(process.env.XT_BENCH_THREADS || "8", 10);
const PORT = Number.parseInt(process.env.XT_BENCH_PORT || "47700", 10);
const CTX = 4096;

const MODELS = [
  { id: "qwen3.5-4b", label: "Qwen3.5-4B", file: "Qwen3.5-4B-Q4_K_M.gguf" },
  { id: "qwen3.5-2b", label: "Qwen3.5-2B", file: "Qwen3.5-2B-Q4_K_M.gguf" },
  { id: "gemma3-4b", label: "Gemma 3 4B", file: "gemma-3-4b-it-Q4_K_M.gguf" },
  { id: "gemma3-1b", label: "Gemma 3 1B", file: "gemma-3-1b-it-Q4_K_M.gguf" },
  { id: "smollm3-3b", label: "SmolLM3-3B", file: "SmolLM3-Q4_K_M.gguf" }
];

// Jeu de tests FR (fixe). expect = attendu indicatif pour l'évaluation qualité.
const TESTS = [
  { op: "correct", target: "fr", text: "Sa va pa marcher !", expect: "Ça va pas marcher !" },
  { op: "correct", target: "fr", text: "je pense que c'est une trés bonne idée mais il faudrai vérifié avant", expect: "orthographe + accords + conjugaison" },
  { op: "correct", target: "fr", text: "les developpeur on besoin de plus de temp pour fini le projet", expect: "développeurs ont besoin de plus de temps pour finir" },
  { op: "correct", target: "fr", text: "on ces vu hier et sa ma fait super plaisir de te revoir", expect: "on s'est vus hier et ça m'a fait plaisir" },
  { op: "correct", target: "fr", text: "ct vraiment nul ce film jai rien compris a la fin", expect: "c'était vraiment nul ce film, je n'ai rien compris à la fin" },
  { op: "correct", target: "fr", text: "il faut absolument quon parle de sa demain matin stp", expect: "qu'on parle de ça demain matin" },
  { op: "generate", target: "fr", text: "je trouve que les prix de l'immobilier c'est vraiment trop cher maintenant", expect: "post fidèle, sans idée nouvelle inventée" },
  { op: "generate", target: "fr", text: "pas content du tout du nouveau design de twitter", expect: "exprime le mécontentement, pas d'invention" },
  { op: "generate", target: "fr", text: "lIA locale cest mieux pour la vie privée que le cloud", expect: "reformule proprement, garde le sens" },
  { op: "translate", target: "en", text: "Ça ne marchera jamais sans plus de tests.", expect: "It will never work without more testing." },
  { op: "translate", target: "fr", text: "This update completely broke my workflow.", expect: "Cette mise à jour a complètement cassé mon flux de travail." },
  { op: "translate", target: "fr", text: "Tis will no work!", expect: "Ça ne marchera pas ! (corrige la faute avant de traduire)" }
];

function instructionsFor(op, target) {
  const base = {
    correct: [
      "You correct an X/Twitter draft and return the result in this target language: " + target + ".",
      "If the draft is already in the target language, keep that language and fix spelling, grammar, syntax, punctuation, capitalization, agreement, conjugation, word order and spacing.",
      "If the draft is in a different language, infer the intended meaning, fix the mistakes, and translate that corrected meaning into the target language.",
      "Preserve meaning, tone, register, valid informal wording, slang, emojis, mentions, hashtags, URLs and line breaks, but not mistakes.",
      "Never answer with a meta sentence like \"No correction needed\". Always return the corrected text itself.",
      "Do not make the text more formal and do not add facts or commentary."
    ],
    translate: [
      "You translate an X/Twitter draft into this target language: " + target + ".",
      "If the draft contains mistakes, infer the intended meaning and translate that corrected meaning.",
      "The returned text must be fluent, grammatical and correctly spelled in the target language, including accents, agreement and conjugation.",
      "Preserve meaning, tone, slang, emojis, mentions, hashtags, URLs and line breaks, but not mistakes.",
      "Do not add facts, explanations or commentary."
    ],
    generate: [
      "You rewrite the user's draft into one native X/Twitter post in this target language: " + target + ".",
      "The draft is the user's own intended message. Reformulate it cleanly; do NOT invent new ideas, facts or opinions.",
      "Preserve the user's stance, emotion and meaning. If the draft has mistakes, infer the intended meaning.",
      "Be conversational and concise. Do not invent facts."
    ]
  }[op];
  return base.concat([
    "Never use the Unicode character U+2014 (em dash). Use a comma instead.",
    "Return JSON only, in this exact shape: {\"text\":\"...\"}"
  ]).join("\n");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) {
        return true;
      }
    } catch (e) {
      // serveur pas encore prêt
    }
    await sleep(700);
  }
  return false;
}

async function startServer(modelPath) {
  const args = [
    "-m", modelPath,
    "--host", "127.0.0.1",
    "--port", String(PORT),
    "-c", String(CTX),
    "-t", String(THREADS),
    "-ngl", "0",
    "--jinja",
    "--no-webui"
  ];
  const child = spawn(LLAMA_SERVER, args, { stdio: ["ignore", "ignore", "ignore"] });
  const ready = await waitForHealth(180000);
  if (!ready) {
    try { child.kill(); } catch (e) {}
    throw new Error("llama-server n'a pas démarré à temps");
  }
  return child;
}

async function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      resolve();
      return;
    }
    child.on("exit", () => resolve());
    try { child.kill(); } catch (e) { resolve(); }
    setTimeout(resolve, 4000);
  });
}

// Extrait {"text":...} d'une sortie qui peut contenir un bloc <think>, des
// fences ```json, ou du texte autour. Renvoie {text, jsonOk}.
function extractJsonText(raw) {
  let s = String(raw || "");
  // retirer un bloc de raisonnement <think>...</think> (même non fermé)
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (/<think>/i.test(s)) {
    s = s.replace(/[\s\S]*<\/think>/i, "");
  }
  s = s.replace(/```(?:json)?/gi, "").trim();
  const tryParse = (str) => {
    try {
      const p = JSON.parse(str);
      if (p && typeof p.text === "string") {
        return p.text;
      }
    } catch (e) {}
    return null;
  };
  let text = tryParse(s);
  if (text === null) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last > first) {
      text = tryParse(s.slice(first, last + 1));
    }
  }
  return { text: text === null ? s.trim() : text, jsonOk: text !== null && text.length > 0 };
}

async function runOne(test) {
  const body = {
    messages: [
      { role: "system", content: instructionsFor(test.op, test.target) },
      { role: "user", content: `Draft:\n${test.text}\nTarget language: ${test.target}` }
    ],
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 256,
    response_format: { type: "json_object" },
    chat_template_kwargs: { enable_thinking: false },
    cache_prompt: false
  };
  const t0 = Date.now();
  const res = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const elapsedMs = Date.now() - t0;
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  const extracted = extractJsonText(raw);
  const outText = extracted.text;
  const jsonOk = extracted.jsonOk;
  const completionTokens = data?.usage?.completion_tokens || 0;
  const tps = completionTokens > 0 ? completionTokens / (elapsedMs / 1000) : 0;
  const emDash = /—/.test(outText);
  return { op: test.op, target: test.target, input: test.text, expect: test.expect, output: outText, jsonOk, emDash, elapsedMs, completionTokens, tps };
}

async function benchModel(model) {
  const modelPath = path.join(MODELS_DIR, model.file);
  if (!fs.existsSync(modelPath)) {
    console.log(`[skip] ${model.label} — fichier absent (${model.file})`);
    return null;
  }
  const sizeGb = fs.statSync(modelPath).size / 1e9;
  console.log(`\n===== ${model.label} (${sizeGb.toFixed(2)} Go) — démarrage llama-server =====`);
  let child;
  try {
    child = await startServer(modelPath);
  } catch (e) {
    console.log(`[erreur démarrage] ${model.label}: ${e.message}`);
    return { model: model.label, id: model.id, error: e.message, results: [] };
  }
  const results = [];
  try {
    // requête d'échauffement (chargement caches) non comptée
    await runOne(TESTS[0]).catch(() => {});
    for (const test of TESTS) {
      const r = await runOne(test);
      results.push(r);
      console.log(`  [${r.op}/${r.target}] ${Math.round(r.elapsedMs)}ms ${r.tps.toFixed(1)}tok/s json=${r.jsonOk ? "ok" : "NON"}${r.emDash ? " EMDASH" : ""}`);
    }
  } finally {
    await stopServer(child);
  }
  const jsonRate = results.filter((r) => r.jsonOk).length / results.length;
  const avgTps = results.reduce((a, r) => a + r.tps, 0) / results.length;
  const avgMs = results.reduce((a, r) => a + r.elapsedMs, 0) / results.length;
  return { model: model.label, id: model.id, sizeGb: Number(sizeGb.toFixed(2)), jsonRate, avgTps, avgMs, results };
}

async function main() {
  if (!fs.existsSync(LLAMA_SERVER)) {
    console.error(`llama-server introuvable: ${LLAMA_SERVER}`);
    process.exit(1);
  }
  console.log(`Benchmark local — CPU pur, ${THREADS} threads, ctx ${CTX}`);
  const only = (process.env.XT_BENCH_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
  const selected = only.length ? MODELS.filter((m) => only.includes(m.id)) : MODELS;
  const all = [];
  for (const model of selected) {
    const r = await benchModel(model);
    if (r) {
      all.push(r);
    }
  }
  const outPath = path.join(BENCH_DIR, "results.json");
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2), "utf8");

  console.log("\n\n================= SYNTHÈSE =================");
  console.log("Modèle           Taille  JSON%   tok/s   ms/req");
  for (const r of all) {
    if (r.error) {
      console.log(`${r.model.padEnd(16)} ERREUR: ${r.error}`);
      continue;
    }
    console.log(
      `${r.model.padEnd(16)} ${String(r.sizeGb).padStart(5)}Go  ${(r.jsonRate * 100).toFixed(0).padStart(3)}%  ${r.avgTps.toFixed(1).padStart(6)}  ${Math.round(r.avgMs).toString().padStart(6)}`
    );
  }
  console.log(`\nDétail complet (sorties texte) : ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
