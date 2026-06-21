(() => {
  "use strict";

  const extensionApi = globalThis.chrome || globalThis.browser;
  const runtimeApi = extensionApi?.runtime;
  const i18nApi = extensionApi?.i18n;
  const storageApi = extensionApi?.storage?.local;

  const REPLY_AI_CONFIG_VERSION = 15;
  const DEFAULT_CODEX_BRIDGE_URL = "http://127.0.0.1:47623";
  const DEFAULT_REPLY_PROVIDER = "codex";
  const DEFAULT_CODEX_MODEL = "gpt-5.3-codex-spark";
  const CLI_DEFAULT_MODEL_VALUE = "__cli_default__";
  const CUSTOM_MODEL_VALUE = "custom";
  const DEFAULT_REPLY_COUNT = 3;
  const DEFAULT_REPLY_STYLE = "auto";
  const DEFAULT_REPLY_LANGUAGE_MODE = "tweet";
  const PROVIDER_MODEL_PRESETS = {
    codex: [
      { value: DEFAULT_CODEX_MODEL, label: "Codex-Spark, fast" },
      { value: CLI_DEFAULT_MODEL_VALUE, label: "CLI default" },
      { value: "gpt-5.5", label: "GPT-5.5" },
      { value: CUSTOM_MODEL_VALUE, label: "Custom model name" }
    ],
    grok: [
      { value: CLI_DEFAULT_MODEL_VALUE, label: "CLI default" },
      { value: "grok-composer-2.5-fast", label: "Grok Composer 2.5 Fast" },
      { value: CUSTOM_MODEL_VALUE, label: "Custom model name" }
    ],
    gemini: [
      { value: CLI_DEFAULT_MODEL_VALUE, label: "CLI default" },
      { value: CUSTOM_MODEL_VALUE, label: "Custom model name" }
    ],
    claude: [
      { value: CLI_DEFAULT_MODEL_VALUE, label: "CLI default" },
      { value: CUSTOM_MODEL_VALUE, label: "Custom model name" }
    ]
  };
  const KNOWN_MODEL_PRESETS = new Set(Object.values(PROVIDER_MODEL_PRESETS).flat().map((preset) => preset.value));
  const REPLY_PROVIDERS = new Map([
    ["codex", "Codex"],
    ["grok", "Grok"],
    ["gemini", "Gemini"],
    ["claude", "Claude"]
  ]);
  const PROVIDER_ALIASES = new Map([
    ["codex-cli", "codex"],
    ["grok-cli", "grok"],
    ["croc", "grok"],
    ["croc-cli", "grok"],
    ["gemini-cli", "gemini"],
    ["claude-cli", "claude"],
    ["claude-code", "claude"]
  ]);
  const DEFAULT_REPLY_SYSTEM_PROMPT = [
    "You write native X/Twitter replies that sound like a real person with a clear point of view. The goal is not neutral analysis; the goal is a reply that is human, true, relevant, and postable.",
    "Before writing, silently identify the original post's real claim, emotion, target, likely audience, and the strongest defensible stance for the user: amplify it, oppose it, call it out, or reframe it with conviction.",
    "Base every reply on ORIGINAL_TWEET and VISIBLE_CONTEXT. Treat toneSignals, mediaContext, authorProfileContext, quoted tweets, link cards, conversation context, and webSearchResults as context.",
    "Use live web search only when a reply would otherwise depend on current, named, or factual information not present in visible context: news, public people, companies, products, prices, laws, statistics, dates, technical claims, or source verification. Do not search for simple opinion, personal reaction, or common-sense reasoning.",
    "Every factual claim must be supportable from visible context or webSearchResults. If a useful fact is missing or uncertain, avoid it or state the uncertainty plainly.",
    "Write every reply in TARGET_LANGUAGE. Do not use another language unless the target language is unknown.",
    "Return only JSON in this exact shape: {\"replies\":[{\"styleId\":\"short\",\"style\":\"Short impact\",\"text\":\"...\"},{\"styleId\":\"medium\",\"style\":\"Medium argument\",\"text\":\"...\"},{\"styleId\":\"long\",\"style\":\"Longer argument\",\"text\":\"...\"}]}. Use stable styleId values only: short, medium, long, reaction, argument, support, useful, question, codex, custom, humor, sharp, callout.",
    "Write exactly {{replyCount}} replies. Make them genuinely different options, not paraphrases.",
    "Every reply must be exactly one sentence. Never write two sentences in the same reply. No paragraph, no bullet, no thread-like answer.",
    "Never use Unicode code point U+2014 in any reply. Use a comma instead.",
    "If REPLY_STYLE is auto, choose a clear side first. If the original post is an outrage claim and visible context does not disprove it, amplify the outrage with a reason instead of softening it. If the post is misleading, oppose it directly. Do not write a balanced pro/con take.",
    "In auto mode, produce three postable variants around the same clear stance with useful length variety: short, medium, and long. Do not write questions in auto mode.",
    "Reply 1 must be very short and impact-driven: one punchy sentence, 45 to 110 characters, with a clear emotional or rhetorical hit.",
    "Reply 2 must be one medium sentence, 100 to 210 characters, with one concrete reason or consequence.",
    "Reply 3 must be one denser sentence, 170 to 300 characters, with a fuller argument, but never pad, repeat, or write filler just to be long.",
    "If REPLY_STYLE is humor, keep it context-specific and human. If REPLY_STYLE is sharp, be direct without sounding like an essay. If REPLY_STYLE is useful, add one concrete consequence or practical point. If REPLY_STYLE is question, ask a non-generic question that advances the discussion.",
    "Prioritize conviction plus reason: a clear side, a concrete consequence, and a sentence that sounds like a person reacting on X/Twitter.",
    "Do not hedge with consultant phrases such as 'there is a tradeoff', 'technically legal yet', 'it depends', 'to be fair', 'on the one hand', or 'this may feel like' unless the user explicitly asks for nuance.",
    "Do not write vague encouragement such as 'great question', 'it's great that', 'I'm sure there are reasons', 'it might help', 'consider testing', or empty agreement.",
    "Do not write corporate wording, expert-report wording, generic praise, assistant-like phrasing, filler, moralizing, or a reply that could fit any tweet.",
    "Replies should be punchy and natural for X/Twitter. If an idea needs a second sentence, choose the strongest idea and compress it into one sentence.",
    "For developer-tool questions, useful arguments can include repo-aware edits, fewer context switches, running checks, explaining tradeoffs, faster iteration, or better fit with the user's workflow. State these as direct benefits, not as questions.",
    "Do not invent numbers, dates, names, sources, or claims. If a statistic would be useful but is not present in visible context or search results, avoid the statistic or state the uncertainty.",
    "If webSearchResults are provided, use them as external context. If no webSearchResults are provided, use only visible link cards and quoted tweets and do not pretend you opened links.",
    "Do not add hashtags unless the original tweet already uses hashtags. Do not mention that you are an AI.",
    "UI locale, only as fallback: {{uiLocale}}.",
    "Tweet language hint: {{tweetLanguage}}.",
    "Target language: {{targetLanguage}}.",
    "Reply style request: {{replyStyle}}."
  ].join("\n");
  const DEFAULT_REPLY_PROMPT_PROFILES = [
    {
      label: "Short impact",
      prompt: [
        "Write one very short X/Twitter reply for the profile named {{profileName}}.",
        "It must be punchy, direct, and between 45 and 110 characters when possible.",
        "Take one clear side based on the visible context and avoid generic agreement.",
        "Write in TARGET_LANGUAGE and never use Unicode code point U+2014; use a comma instead."
      ].join("\n")
    },
    {
      label: "Medium argument",
      prompt: [
        "Write one medium X/Twitter reply for the profile named {{profileName}}.",
        "It must be one sentence, usually 100 to 210 characters, with one concrete reason or consequence.",
        "Make it sound like a real person responding on X/Twitter, not a report.",
        "Write in TARGET_LANGUAGE and never use Unicode code point U+2014; use a comma instead."
      ].join("\n")
    },
    {
      label: "Longer argument",
      prompt: [
        "Write one longer X/Twitter reply for the profile named {{profileName}}.",
        "It must be one dense sentence, usually 170 to 300 characters, with a fuller argument and no filler.",
        "Keep the stance clear and specific to the visible post context.",
        "Write in TARGET_LANGUAGE and never use Unicode code point U+2014; use a comma instead."
      ].join("\n")
    }
  ];

  const DEFAULT_CONFIG = {
    configVersion: REPLY_AI_CONFIG_VERSION,
    enabled: true,
    provider: DEFAULT_REPLY_PROVIDER,
    codexBridgeUrl: DEFAULT_CODEX_BRIDGE_URL,
    bridgeToken: "",
    codexModel: DEFAULT_CODEX_MODEL,
    codexModelPreset: DEFAULT_CODEX_MODEL,
    prompt: DEFAULT_REPLY_SYSTEM_PROMPT,
    replyPromptProfiles: cloneDefaultReplyPromptProfiles(),
    replyCount: DEFAULT_REPLY_COUNT,
    replyStyle: DEFAULT_REPLY_STYLE,
    replyLanguageMode: DEFAULT_REPLY_LANGUAGE_MODE
  };

  const form = document.querySelector("#reply-ai-form");
  const enabledInput = document.querySelector("#reply-ai-enabled");
  const promptResetButton = document.querySelector("#reply-ai-prompt-reset");
  const promptProfileRows = Array.from(document.querySelectorAll("[data-reply-prompt-profile]"));
  const providerInput = document.querySelector("#reply-ai-provider");
  const codexBridgeUrlInput = document.querySelector("#reply-ai-codex-bridge-url");
  const bridgeTokenInput = document.querySelector("#reply-ai-bridge-token");
  const codexModelPresetInput = document.querySelector("#reply-ai-codex-model-preset");
  const codexModelCustomInput = document.querySelector("#reply-ai-codex-model-custom");
  const replyCountInput = document.querySelector("#reply-ai-count");
  const replyStyleInput = document.querySelector("#reply-ai-style");
  const replyLanguageModeInput = document.querySelector("#reply-ai-language-mode");
  const statusElement = document.querySelector("#reply-ai-status");
  const bridgeDownloadLink = document.querySelector("#reply-ai-bridge-download");
  const testButton = document.querySelector("#reply-ai-test");
  const logsRefreshButton = document.querySelector("#reply-ai-logs-refresh");
  const logsClearButton = document.querySelector("#reply-ai-logs-clear");
  const logsOutput = document.querySelector("#reply-ai-logs-output");
  const tabButtons = Array.from(document.querySelectorAll(".options-tab"));
  const tabPanels = Array.from(document.querySelectorAll(".settings-tab-panel"));
  const statusBaseClass = statusElement?.className || "options-status";

  document.addEventListener("DOMContentLoaded", start, { once: true });

  async function start() {
    localizePage();
    setupTabs();
    await loadConfig();
    refreshBridgeStatusOnLoad();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveConfig();
    });

    providerInput?.addEventListener("change", () => {
      renderModelPresetOptions(providerInput.value, getSelectedModel(providerInput.value).preset);
      normalizeModelForSelectedProvider();
      updateCodexModelControls();
    });
    codexModelPresetInput?.addEventListener("change", updateCodexModelControls);

    testButton.addEventListener("click", async () => {
      await testConfig();
    });

    logsRefreshButton?.addEventListener("click", async () => {
      try {
        await loadDiagnosticLogs();
      } catch (error) {
        renderDiagnosticLogsError(error);
        showStatus(error?.message || localizedText("optionsLogsLoadFailed", "Unable to load logs."), "error");
      }
    });

    logsClearButton?.addEventListener("click", async () => {
      try {
        await clearDiagnosticLogs();
      } catch (error) {
        showStatus(error?.message || localizedText("optionsLogsClearFailed", "Unable to clear logs."), "error");
      }
    });

    promptResetButton?.addEventListener("click", () => {
      setPromptProfileInputs(cloneDefaultReplyPromptProfiles());
    });
  }

  function localizePage() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      const message = localizedText(key, element.textContent);
      element.textContent = message;
    });

    document.querySelectorAll("[data-help-i18n]").forEach((element) => {
      const key = element.getAttribute("data-help-i18n");
      const fallback = element.getAttribute("data-help") || "";
      element.setAttribute("data-help", localizedText(key, fallback));
    });
  }

  async function loadConfig() {
    const stored = await storageGet({ replyAiConfig: null });
    const rawConfig = stored.replyAiConfig || null;
    const config = normalizeReplyAiConfig(rawConfig);

    if (shouldPersistReplyAiConfig(rawConfig, config)) {
      await storageSet({ replyAiConfig: config });
    }

    enabledInput.checked = Boolean(config.enabled);
    providerInput.value = config.provider || DEFAULT_REPLY_PROVIDER;
    setPromptProfileInputs(config.replyPromptProfiles);
    codexBridgeUrlInput.value = config.codexBridgeUrl || DEFAULT_CODEX_BRIDGE_URL;
    bridgeTokenInput.value = config.bridgeToken || "";
    setModelInputs(config);
    if (replyCountInput) {
      replyCountInput.value = String(config.replyCount || DEFAULT_REPLY_COUNT);
    }
    replyStyleInput.value = config.replyStyle || DEFAULT_REPLY_STYLE;
    replyLanguageModeInput.value = config.replyLanguageMode || DEFAULT_REPLY_LANGUAGE_MODE;
    updateCodexModelControls();
  }

  function setupTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activateSettingsTab(button.getAttribute("data-tab"));
      });
    });
  }

  function activateSettingsTab(tab) {
    const nextTab = tab || "replies";

    tabButtons.forEach((button) => {
      const active = button.getAttribute("data-tab") === nextTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    tabPanels.forEach((panel) => {
      const active = panel.getAttribute("data-tab-panel") === nextTab;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    if (nextTab === "logs") {
      loadDiagnosticLogs().catch((error) => {
        renderDiagnosticLogsError(error);
      });
    }
  }

  async function saveConfig() {
    const config = getFormConfig();
    await storageSet({ replyAiConfig: config });
    showStatus(localizedText("optionsSaved", "Settings saved."), "success");
    return true;
  }

  async function testConfig() {
    const saved = await saveConfig();
    if (!saved) {
      return;
    }

    showStatus(localizedText("optionsTesting", "Testing bridge..."), "");

    try {
      const message = await testBridgeConnection(getFormConfig());
      showStatus(message, "success");
    } catch (error) {
      showStatus(error?.message || localizedText("optionsTestFailed", "Connection test failed."), "error");
    }
  }

  function refreshBridgeStatusOnLoad() {
    testBridgeConnection(getFormConfig()).then((message) => {
      showStatus(message, "success");
    }).catch((error) => {
      if (error?.bridgeMissing) {
        activateSettingsTab("bridge");
        bridgeDownloadLink?.focus();
      }
      showStatus(error?.message || localizedText("optionsTestFailed", "Connection test failed."), "error");
    });
  }

  async function testBridgeConnection(config) {
    const bridgeUrl = String(config.codexBridgeUrl || DEFAULT_CODEX_BRIDGE_URL).trim().replace(/\/+$/, "");
    let response;
    try {
      response = await fetch(`${bridgeUrl}/providers`, {
        method: "GET",
        headers: buildBridgeAuthHeaders(config)
      });
    } catch (error) {
      const bridgeError = new Error(localizedText("optionsBridgeMissing", "Xtension Bridge was not detected. Download and run the installer, then test the bridge again."));
      bridgeError.cause = error;
      bridgeError.bridgeMissing = true;
      throw bridgeError;
    }

    if (!response.ok) {
      throw new Error(`${localizedText("optionsBridgeTestFailed", "Bridge test failed.")} (${response.status})`);
    }

    const data = await response.json();
    const providers = Array.isArray(data?.providers) ? data.providers : [];
    const selectedProvider = normalizeReplyProvider(config.provider);
    const provider = providers.find((item) => normalizeReplyProvider(item?.id) === selectedProvider);
    const providerLabel = getReplyProviderLabel(selectedProvider);

    if (!provider?.installed) {
      throw new Error(localizedText("optionsBridgeProviderMissing", "The selected provider was not detected by the bridge.")
        .replace("{provider}", providerLabel));
    }

    return localizedText("optionsBridgeTestOk", "Bridge is running. Provider detected: {provider}.")
      .replace("{provider}", provider.label || provider.executable || providerLabel);
  }

  function buildBridgeAuthHeaders(config) {
    const token = String(config?.bridgeToken || "").trim();
    return token ? { "x-xtension-bridge-token": token } : {};
  }

  async function loadDiagnosticLogs() {
    if (!logsOutput) {
      return;
    }

    logsOutput.textContent = localizedText("optionsLogsLoading", "Loading logs...");
    const response = await runtimeSendMessage({
      type: "xtension-get-diagnostic-logs"
    });

    if (!response?.ok) {
      throw new Error(response?.error || localizedText("optionsLogsLoadFailed", "Unable to load logs."));
    }

    renderDiagnosticLogs(response.logs || []);
  }

  async function clearDiagnosticLogs() {
    const response = await runtimeSendMessage({
      type: "xtension-clear-diagnostic-logs"
    });

    if (!response?.ok) {
      throw new Error(response?.error || localizedText("optionsLogsClearFailed", "Unable to clear logs."));
    }

    renderDiagnosticLogs([]);
    showStatus(localizedText("optionsLogsCleared", "Logs cleared."), "success");
  }

  function renderDiagnosticLogs(logs) {
    if (!logsOutput) {
      return;
    }

    if (!Array.isArray(logs) || logs.length === 0) {
      logsOutput.textContent = localizedText("optionsLogsEmpty", "No diagnostic logs yet.");
      return;
    }

    logsOutput.textContent = logs.map(formatDiagnosticLogEntry).join("\n");
  }

  function renderDiagnosticLogsError(error) {
    if (!logsOutput) {
      return;
    }

    logsOutput.textContent = error?.message || localizedText("optionsLogsLoadFailed", "Unable to load logs.");
  }

  function formatDiagnosticLogEntry(entry) {
    const details = { ...(entry || {}) };
    const time = details.time || "";
    const level = String(details.level || "info").toUpperCase();
    const event = details.event || "";
    const area = details.area || "";
    delete details.time;
    delete details.level;
    delete details.event;
    delete details.area;

    const compact = [
      details.operation ? `operation=${details.operation}` : "",
      details.provider ? `provider=${details.provider}` : "",
      details.route ? `route=${details.route}` : "",
      details.codexModel ? `model=${details.codexModel}` : "",
      typeof details.ok === "boolean" ? `ok=${details.ok}` : "",
      Number.isFinite(details.durationMs) ? `durationMs=${details.durationMs}` : "",
      details.reason ? `reason=${details.reason}` : "",
      details.errorCode ? `errorCode=${details.errorCode}` : ""
    ].filter(Boolean);

    ["operation", "provider", "route", "codexModel", "ok", "durationMs", "reason", "errorCode"].forEach((key) => {
      delete details[key];
    });

    const extra = Object.keys(details).length ? ` ${JSON.stringify(details)}` : "";
    return `[${time}] ${level} ${area}/${event} ${compact.join(" ")}${extra}`.trim();
  }

  function getFormConfig() {
    const provider = normalizeReplyProvider(providerInput?.value || DEFAULT_REPLY_PROVIDER);
    const modelInfo = getSelectedModel(provider);
    return {
      configVersion: REPLY_AI_CONFIG_VERSION,
      enabled: enabledInput.checked,
      provider,
      codexBridgeUrl: normalizeCodexBridgeUrl(codexBridgeUrlInput.value) || DEFAULT_CODEX_BRIDGE_URL,
      bridgeToken: bridgeTokenInput.value.trim(),
      codexModel: modelInfo.model,
      codexModelPreset: modelInfo.preset,
      prompt: DEFAULT_REPLY_SYSTEM_PROMPT,
      replyPromptProfiles: getPromptProfileInputs(),
      replyCount: normalizeReplyCount(replyCountInput?.value || DEFAULT_REPLY_COUNT),
      replyStyle: normalizeReplyStyle(replyStyleInput.value),
      replyLanguageMode: normalizeReplyLanguageMode(replyLanguageModeInput.value)
    };
  }

  function getPromptProfileInputs() {
    const values = promptProfileRows.map((row, index) => {
      const fallback = DEFAULT_REPLY_PROMPT_PROFILES[index] || DEFAULT_REPLY_PROMPT_PROFILES[0];
      return {
        label: String(row.querySelector("[data-reply-prompt-label]")?.value || fallback.label).trim(),
        prompt: cleanDraftText(row.querySelector("[data-reply-prompt-text]")?.value || fallback.prompt)
      };
    });

    return normalizeReplyPromptProfiles(values, "");
  }

  function setPromptProfileInputs(profiles) {
    const normalized = normalizeReplyPromptProfiles(profiles, "");
    promptProfileRows.forEach((row, index) => {
      const profile = normalized[index] || DEFAULT_REPLY_PROMPT_PROFILES[index] || DEFAULT_REPLY_PROMPT_PROFILES[0];
      const labelInput = row.querySelector("[data-reply-prompt-label]");
      const promptInput = row.querySelector("[data-reply-prompt-text]");
      if (labelInput) {
        labelInput.value = profile.label;
      }
      if (promptInput) {
        promptInput.value = profile.prompt;
      }
    });
  }

  function setModelInputs(config) {
    const model = normalizeCodexModel(config.codexModel);
    const preset = config.codexModelPreset || (model ? model : CLI_DEFAULT_MODEL_VALUE);
    const provider = normalizeReplyProvider(config.provider || providerInput?.value || DEFAULT_REPLY_PROVIDER);
    renderModelPresetOptions(provider, preset);

    if (KNOWN_MODEL_PRESETS.has(preset) && (preset !== CLI_DEFAULT_MODEL_VALUE || !model)) {
      codexModelPresetInput.value = preset;
      codexModelCustomInput.value = "";
      return;
    }

    if (KNOWN_MODEL_PRESETS.has(model)) {
      codexModelPresetInput.value = model || CLI_DEFAULT_MODEL_VALUE;
      codexModelCustomInput.value = "";
      return;
    }

    codexModelPresetInput.value = CUSTOM_MODEL_VALUE;
    codexModelCustomInput.value = model;
  }

  function getSelectedModel(providerValue) {
    const provider = normalizeReplyProvider(providerValue || providerInput?.value || DEFAULT_REPLY_PROVIDER);
    const preset = codexModelPresetInput.value || DEFAULT_CODEX_MODEL;
    if (provider !== "codex" && preset === DEFAULT_CODEX_MODEL) {
      return {
        preset: CLI_DEFAULT_MODEL_VALUE,
        model: ""
      };
    }

    if (preset === CUSTOM_MODEL_VALUE) {
      return {
        preset: CUSTOM_MODEL_VALUE,
        model: normalizeCodexModel(codexModelCustomInput.value)
      };
    }

    if (preset === CLI_DEFAULT_MODEL_VALUE) {
      return {
        preset,
        model: ""
      };
    }

    return {
      preset,
      model: normalizeCodexModel(preset)
    };
  }

  function updateCodexModelControls() {
    normalizeModelForSelectedProvider();
    const custom = codexModelPresetInput?.value === CUSTOM_MODEL_VALUE;
    if (codexModelCustomInput) {
      codexModelCustomInput.disabled = !custom;
      codexModelCustomInput.closest?.(".setting-row")?.classList.toggle("is-disabled", !custom);
    }
  }

  function normalizeModelForSelectedProvider() {
    const provider = normalizeReplyProvider(providerInput?.value || DEFAULT_REPLY_PROVIDER);
    const availablePresets = getProviderModelPresetValues(provider);
    if (codexModelPresetInput && !availablePresets.has(codexModelPresetInput.value)) {
      renderModelPresetOptions(provider, CLI_DEFAULT_MODEL_VALUE);
    }
    if (provider !== "codex" && codexModelPresetInput?.value === DEFAULT_CODEX_MODEL) {
      codexModelPresetInput.value = CLI_DEFAULT_MODEL_VALUE;
      if (codexModelCustomInput) {
        codexModelCustomInput.value = "";
      }
    }
  }

  function normalizeReplyAiConfig(config) {
    const rawConfig = config && typeof config === "object" ? config : {};
    const normalized = {
      ...DEFAULT_CONFIG,
      ...rawConfig
    };

    normalized.configVersion = REPLY_AI_CONFIG_VERSION;
    normalized.enabled = typeof rawConfig.enabled === "boolean" ? rawConfig.enabled : true;
    normalized.provider = normalizeReplyProvider(normalized.provider);
    normalized.codexBridgeUrl = normalizeCodexBridgeUrl(normalized.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
    normalized.bridgeToken = String(normalized.bridgeToken || "").trim();

    if (String(rawConfig.cliModelMode || "").trim().toLowerCase() === "default") {
      normalized.codexModel = "";
    } else {
      normalized.codexModel = normalizeProviderModel(normalized.provider, normalized.codexModel);
    }

    normalized.codexModelPreset = normalizeModelPreset(normalized.provider, normalized.codexModelPreset, normalized.codexModel);
    normalized.prompt = cleanDraftText(normalized.prompt || DEFAULT_REPLY_SYSTEM_PROMPT) || DEFAULT_REPLY_SYSTEM_PROMPT;
    if (shouldUpgradeDefaultPrompt(rawConfig.prompt)) {
      normalized.prompt = DEFAULT_REPLY_SYSTEM_PROMPT;
    }
    normalized.replyPromptProfiles = normalizeReplyPromptProfiles(normalized.replyPromptProfiles, rawConfig.prompt);
    normalized.replyCount = normalizeReplyCount(normalized.replyCount);
    normalized.replyStyle = normalizeReplyStyle(normalized.replyStyle);
    normalized.replyLanguageMode = normalizeReplyLanguageMode(normalized.replyLanguageMode);

    delete normalized.baseUrl;
    delete normalized.model;
    delete normalized.apiKey;
    delete normalized.webSearchEnabled;
    delete normalized.webSearchApiKey;
    delete normalized.codexEnabled;
    delete normalized.cliModelMode;
    delete normalized.claudeModel;
    delete normalized.geminiModel;
    delete normalized.embeddedLocalEnabled;
    delete normalized.embeddedLocalModel;
    delete normalized.embeddedLocalRoutes;

    return normalized;
  }

  function normalizeReplyProvider(value) {
    const rawProvider = String(value || "").trim().toLowerCase().replace(/_/g, "-");
    const provider = PROVIDER_ALIASES.get(rawProvider) || rawProvider || DEFAULT_REPLY_PROVIDER;
    return REPLY_PROVIDERS.has(provider) ? provider : DEFAULT_REPLY_PROVIDER;
  }

  function cloneDefaultReplyPromptProfiles() {
    return DEFAULT_REPLY_PROMPT_PROFILES.map((profile) => ({ ...profile }));
  }

  function normalizeReplyPromptProfiles(value, legacyPrompt) {
    const input = Array.isArray(value) ? value : [];
    const defaults = cloneDefaultReplyPromptProfiles();
    const legacy = cleanDraftText(legacyPrompt || "");

    return defaults.map((fallback, index) => {
      const raw = input[index] && typeof input[index] === "object" ? input[index] : {};
      return {
        label: String(raw.label || raw.name || fallback.label).trim().slice(0, 80) || fallback.label,
        prompt: cleanDraftText(raw.prompt || (legacy && index === 0 ? legacy : "") || fallback.prompt) || fallback.prompt
      };
    });
  }

  function getReplyProviderLabel(value) {
    return REPLY_PROVIDERS.get(normalizeReplyProvider(value)) || "Codex";
  }

  function renderModelPresetOptions(providerValue, selectedValue) {
    if (!codexModelPresetInput) {
      return;
    }

    const provider = normalizeReplyProvider(providerValue);
    const options = getProviderModelPresets(provider);
    const selected = options.some((option) => option.value === selectedValue) ? selectedValue : CLI_DEFAULT_MODEL_VALUE;

    codexModelPresetInput.innerHTML = "";
    options.forEach((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      codexModelPresetInput.append(element);
    });
    codexModelPresetInput.value = selected;
  }

  function getProviderModelPresets(providerValue) {
    return PROVIDER_MODEL_PRESETS[normalizeReplyProvider(providerValue)] || PROVIDER_MODEL_PRESETS.codex;
  }

  function getProviderModelPresetValues(providerValue) {
    return new Set(getProviderModelPresets(providerValue).map((option) => option.value));
  }

  function normalizeModelPreset(providerValue, preset, model) {
    const normalizedPreset = String(preset || "").trim();
    const normalizedModel = normalizeCodexModel(model);
    const availablePresets = getProviderModelPresetValues(providerValue);
    if (!normalizedModel) {
      return CLI_DEFAULT_MODEL_VALUE;
    }
    if (normalizedPreset === CUSTOM_MODEL_VALUE) {
      return CUSTOM_MODEL_VALUE;
    }
    if (availablePresets.has(normalizedPreset)) {
      return normalizedPreset;
    }
    if (availablePresets.has(normalizedModel)) {
      return normalizedModel;
    }
    return CUSTOM_MODEL_VALUE;
  }

  function shouldUpgradeDefaultPrompt(prompt) {
    const value = String(prompt || "");
    return !value
      || /sharp insight or contrarian angle|useful context or actionable takeaway|punchy social reaction/i.test(value)
      || /toneSignals include humor|Contextual joke|humor,\s*sharp,\s*useful,\s*question|make reply 1 genuinely funny/i.test(value)
      || /You write native X\/Twitter reply suggestions|Make the replies specific and worth choosing|Each reply text should usually be 90 to 260 characters/i.test(value)
      || /high-judgment X\/Twitter reply strategist|one nuanced or tradeoff-based reply|Reasoned argument.*Nuance.*Practical context/i.test(value)
      || /one human reaction with bite, one concise reasoned argument, and one sharper or more memorable take/i.test(value)
      || /Reply 2 must be medium length: usually one or two sentences|Reply 3 must be longer only because it adds substance: usually two to four short sentences/i.test(value);
  }

  function shouldPersistReplyAiConfig(rawConfig, normalizedConfig) {
    if (!rawConfig || typeof rawConfig !== "object") {
      return true;
    }

    return JSON.stringify(rawConfig) !== JSON.stringify(normalizedConfig);
  }

  function normalizeCodexBridgeUrl(value) {
    try {
      const url = new URL(String(value || DEFAULT_CODEX_BRIDGE_URL).trim());
      if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
        return "";
      }
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      return "";
    }
  }

  function normalizeCodexModel(value) {
    const model = String(value || "").trim();
    if (!model || model === CLI_DEFAULT_MODEL_VALUE) {
      return "";
    }
    return model;
  }

  function normalizeProviderModel(provider, value) {
    const model = normalizeCodexModel(value);
    if (normalizeReplyProvider(provider) !== "codex" && model === DEFAULT_CODEX_MODEL) {
      return "";
    }
    return model;
  }

  function normalizeReplyCount(value) {
    const count = Number.parseInt(value, 10);

    if (!Number.isFinite(count)) {
      return DEFAULT_REPLY_COUNT;
    }

    return Math.min(5, Math.max(3, count));
  }

  function normalizeReplyStyle(value) {
    const style = String(value || "").trim().toLowerCase();
    return ["auto", "humor", "sharp", "useful", "question"].includes(style) ? style : DEFAULT_REPLY_STYLE;
  }

  function normalizeReplyLanguageMode(value) {
    return String(value || "").trim().toLowerCase() === "ui" ? "ui" : DEFAULT_REPLY_LANGUAGE_MODE;
  }

  function cleanDraftText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function storageGet(defaults) {
    return new Promise((resolve) => {
      if (!storageApi?.get) {
        resolve(defaults || {});
        return;
      }

      try {
        const maybePromise = storageApi.get(defaults, (result) => {
          resolve(result || defaults || {});
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then((result) => resolve(result || defaults || {}), () => resolve(defaults || {}));
        }
      } catch (error) {
        resolve(defaults || {});
      }
    });
  }

  function storageSet(values) {
    return new Promise((resolve, reject) => {
      if (!storageApi?.set) {
        resolve();
        return;
      }

      try {
        const maybePromise = storageApi.set(values, () => {
          const error = runtimeApi?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }

          resolve();
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function runtimeSendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!runtimeApi?.sendMessage) {
        reject(new Error(localizedText("optionsRuntimeUnavailable", "Extension runtime is unavailable.")));
        return;
      }

      try {
        const maybePromise = runtimeApi.sendMessage(message, (response) => {
          const error = runtimeApi?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(response);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function showStatus(message, type) {
    if (!statusElement) {
      return;
    }

    statusElement.className = statusBaseClass;
    if (type) {
      statusElement.classList.add(type);
    }
    statusElement.textContent = message || "";
  }

  function localizedText(key, fallback) {
    if (!key || !i18nApi?.getMessage) {
      return fallback || "";
    }

    return i18nApi.getMessage(key) || fallback || "";
  }
})();
