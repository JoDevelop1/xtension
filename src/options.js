(() => {
  "use strict";

  const extensionApi = globalThis.chrome || globalThis.browser;
  const runtimeApi = extensionApi?.runtime;
  const i18nApi = extensionApi?.i18n;
  const storageApi = extensionApi?.storage?.local;
  const EXTENSION_VERSION = runtimeApi?.getManifest?.().version || "";
  const BRIDGE_STATUS_TIMEOUT_MS = 15000;
  const BRIDGE_STATUS_RETRY_DELAYS_MS = [0, 350, 1000];
  const MINIMUM_CONNECTOR_VERSION = "0.6.35";

  const REPLY_AI_CONFIG_VERSION = 26;
  const REQUIRED_AI_DATA_CONSENT_VERSION = 2;
  const DEFAULT_CODEX_BRIDGE_URL = "http://127.0.0.1:47623";
  const DEFAULT_CODEX_MODEL = "gpt-5.6-luna";
  const DEFAULT_AI_PRIMARY_PROVIDER = "auto";
  const AI_PROVIDER_IDS = ["openai-codex", "anthropic-claude", "local-ollama"];
  const DEFAULT_CLAUDE_MODEL = "sonnet";
  const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
  const DEFAULT_OLLAMA_MODEL = "hf.co/unsloth/Qwen3.8-27B-GGUF:UD-Q2_K_XL";
  const DEFAULT_CODEX_REASONING_EFFORT = "low";
  const CODEX_REASONING_ORDER = ["low", "medium", "high", "xhigh", "max", "ultra"];
  const FALLBACK_CODEX_MODELS = [
    { model: "gpt-5.6-sol", displayName: "GPT-5.6 Sol", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"] },
    { model: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"] },
    { model: "gpt-5.6-luna", displayName: "GPT-5.6 Luna", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"] }
  ];
  const DEFAULT_REPLY_TRANSLATION_LANGUAGE = "fr";
  const REPLY_TRANSLATION_LANGUAGES = new Set(["fr", "en", "es", "de", "ja"]);
  const DEFAULT_REPLY_STYLE = "auto";
  const LEGACY_GENERATE_PROMPT_V20 = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise, about 1 to 3 sentences, unless the instruction asks for more.";
  const LEGACY_GENERATE_PROMPT_V21 = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise. When the post contains more than one sentence or idea, use two short paragraphs separated by exactly one blank line; otherwise use one line. Never return a dense block.";
  const LEGACY_GENERATE_PROMPT_V23 = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise and visually airy. Put each distinct sentence, idea, reaction, or transition in its own very short paragraph whenever natural, separated by exactly one blank line. Use as many short paragraphs as the content needs; never target a fixed paragraph count or combine ideas merely to reduce it. A very short one-sentence post may remain one paragraph.";
  const DEFAULT_GENERATE_PROMPT = "Write a punchy, natural social-media post or reply with a clear point of view. Follow the visible platform's conventions and length limits. Keep it concise and visually airy. Put each distinct sentence, idea, reaction, or transition in its own very short paragraph whenever natural, separated by exactly one blank line. Use as many short paragraphs as the content needs; never target a fixed paragraph count or combine ideas merely to reduce it. A very short one-sentence post may remain one paragraph.";
  const LEGACY_REPLY_PROMPT_PROFILES_V20 = [
    { label: "Short impact", prompt: "Write one very short, punchy and direct X/Twitter reply, ideally 45 to 110 characters. Take one clear side from the visible context and avoid generic agreement." },
    { label: "Medium argument", prompt: "Write one natural X/Twitter reply in one sentence, ideally 100 to 210 characters, with one concrete reason or consequence." },
    { label: "Longer argument", prompt: "Write one dense, specific X/Twitter reply, ideally 170 to 300 characters, with a fuller argument and no filler." }
  ];
  const LEGACY_REPLY_PROMPT_PROFILES_V21 = [
    { label: "Short impact", prompt: "Write one very short, punchy and direct X/Twitter reply, ideally 45 to 110 characters. Take one clear side from the visible context and avoid generic agreement." },
    { label: "Medium argument", prompt: "Write one natural X/Twitter reply as two short sentences in two short paragraphs separated by exactly one blank line, ideally 120 to 230 characters, with one concrete reason or consequence. Never return a dense block." },
    { label: "Longer argument", prompt: "Write one specific X/Twitter reply in two or three short paragraphs separated by exactly one blank line, ideally 180 to 320 characters, with a fuller argument and no filler. Never return a dense block." }
  ];
  const LEGACY_REPLY_PROMPT_PROFILES_V23 = [
    { label: "Short impact", prompt: "Write one very short, punchy and direct X/Twitter reply, ideally 45 to 110 characters. Take one clear side from the visible context and avoid generic agreement." },
    { label: "Medium argument", prompt: "Write one natural X/Twitter reply, ideally 120 to 230 characters, with one concrete reason or consequence. Keep it visually airy: give each distinct sentence or idea its own very short paragraph, separated by exactly one blank line. Use as many short paragraphs as the reply needs; never target a fixed paragraph count." },
    { label: "Longer argument", prompt: "Write one specific X/Twitter reply, ideally 180 to 320 characters, with a fuller argument and no filler. Keep it visually airy: put each distinct sentence, idea, reaction, or transition in its own very short paragraph, separated by exactly one blank line. Use as many short paragraphs as the reply needs; never target a fixed paragraph count." }
  ];
  const DEFAULT_REPLY_PROMPT_PROFILES = [
    { label: "Short impact", prompt: "Write one very short, punchy and direct social-media reply. Follow the visible platform's conventions, take one clear side from the context, and avoid generic agreement." },
    { label: "Medium argument", prompt: "Write one natural social-media reply with one concrete reason or consequence. Follow the visible platform's conventions and length limits. Keep it visually airy: give each distinct sentence or idea its own very short paragraph, separated by exactly one blank line. Use as many short paragraphs as the reply needs; never target a fixed paragraph count." },
    { label: "Longer argument", prompt: "Write one specific social-media reply with a fuller argument and no filler. Follow the visible platform's conventions and length limits. Keep it visually airy: put each distinct sentence, idea, reaction, or transition in its own very short paragraph, separated by exactly one blank line. Use as many short paragraphs as the reply needs; never target a fixed paragraph count." }
  ];

  const DEFAULT_CONFIG = {
    configVersion: REPLY_AI_CONFIG_VERSION,
    enabled: false,
    dataProcessingConsentVersion: 0,
    codexBridgeUrl: DEFAULT_CODEX_BRIDGE_URL,
    bridgeToken: "",
    aiPrimaryProvider: DEFAULT_AI_PRIMARY_PROVIDER,
    aiFallbackEnabled: true,
    codexModel: DEFAULT_CODEX_MODEL,
    codexReasoningEffort: DEFAULT_CODEX_REASONING_EFFORT,
    claudeModel: DEFAULT_CLAUDE_MODEL,
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: DEFAULT_OLLAMA_MODEL,
    replyTranslationLanguage: DEFAULT_REPLY_TRANSLATION_LANGUAGE,
    replyStyle: DEFAULT_REPLY_STYLE,
    replyPromptProfiles: cloneDefaultReplyPromptProfiles(),
    generatePrompt: DEFAULT_GENERATE_PROMPT
  };

  const form = document.querySelector("#reply-ai-form");
  const versionElement = document.querySelector("#options-version");
  const enabledInput = document.querySelector("#reply-ai-enabled");
  const codexBridgeUrlInput = document.querySelector("#reply-ai-codex-bridge-url");
  const bridgeTokenInput = document.querySelector("#reply-ai-bridge-token");
  const primaryProviderInput = document.querySelector("#reply-ai-primary-provider");
  const fallbackEnabledInput = document.querySelector("#reply-ai-fallback-enabled");
  const replyTranslationLanguageInput = document.querySelector("#reply-ai-translation-language");
  const replyStyleInput = document.querySelector("#reply-ai-style");
  const generatePromptInput = document.querySelector("#reply-ai-generate-prompt");
  const promptResetButton = document.querySelector("#reply-ai-prompt-reset");
  const promptProfileRows = Array.from(document.querySelectorAll("[data-reply-prompt-profile]"));
  const statusElement = document.querySelector("#reply-ai-status");
  const engineStatusElement = document.querySelector("#reply-ai-engine-status");
  const accountStatusElement = document.querySelector("#reply-ai-account-status");
  const connectionCard = document.querySelector("#reply-ai-connection-card");
  const connectionBadge = document.querySelector("#reply-ai-connection-badge");
  const connectorBadge = document.querySelector("#reply-ai-connector-badge");
  const connectorStatusElement = document.querySelector("#reply-ai-connector-status");
  const codexModelInput = document.querySelector("#reply-ai-codex-model");
  const codexModelStatus = document.querySelector("#reply-ai-codex-model-status");
  const codexReasoningInput = document.querySelector("#reply-ai-codex-reasoning");
  const claudeModelInput = document.querySelector("#reply-ai-claude-model");
  const ollamaUrlInput = document.querySelector("#reply-ai-ollama-url");
  const ollamaModelInput = document.querySelector("#reply-ai-ollama-model");
  const ollamaModelsList = document.querySelector("#reply-ai-ollama-models");
  const ollamaModelStatus = document.querySelector("#reply-ai-ollama-model-status");
  const claudeCard = document.querySelector("#reply-ai-claude-card");
  const claudeBadge = document.querySelector("#reply-ai-claude-badge");
  const claudeStatusElement = document.querySelector("#reply-ai-claude-status");
  const ollamaCard = document.querySelector("#reply-ai-ollama-card");
  const ollamaBadge = document.querySelector("#reply-ai-ollama-badge");
  const ollamaStatusElement = document.querySelector("#reply-ai-ollama-status");
  const testButton = document.querySelector("#reply-ai-test");
  const loginButton = document.querySelector("#reply-ai-login");
  const logoutButton = document.querySelector("#reply-ai-logout");
  const installConnectorLink = document.querySelector("#reply-ai-install-connector");
  const updateConnectorButton = document.querySelector("#reply-ai-update-connector");
  const connectorCurrentElement = document.querySelector("#reply-ai-connector-current");
  const installedConnectorVersionElement = document.querySelector("#reply-ai-connector-installed-version");
  const latestConnectorVersionElement = document.querySelector("#reply-ai-connector-latest-version");
  const connectorDownload = installConnectorLink?.closest(".bridge-download");
  const logsCopyButton = document.querySelector("#reply-ai-logs-copy");
  const logsRefreshButton = document.querySelector("#reply-ai-logs-refresh");
  const logsClearButton = document.querySelector("#reply-ai-logs-clear");
  const logsOutput = document.querySelector("#reply-ai-logs-output");
  const tabButtons = Array.from(document.querySelectorAll(".options-tab"));
  const tabPanels = Array.from(document.querySelectorAll(".settings-tab-panel"));
  const statusBaseClass = statusElement?.className || "options-status";
  let modelCatalog = [...FALLBACK_CODEX_MODELS];
  let diagnosticLogText = "";

  document.addEventListener("DOMContentLoaded", start, { once: true });

  async function start() {
    localizePage();
    setupTabs();
    if (versionElement && EXTENSION_VERSION) {
      versionElement.textContent = `v${EXTENSION_VERSION}`;
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveConfig();
    });

    enabledInput?.addEventListener("change", async () => {
      try {
        await saveConfig();
      } catch (error) {
        showStatus(error?.message || localizedText("optionsRuntimeUnavailable", "Extension runtime is unavailable."), "error");
      }
    });

    testButton?.addEventListener("click", async () => {
      await testCodexConnection();
    });

    loginButton?.addEventListener("click", async () => {
      await loginToChatGpt();
    });

    logoutButton?.addEventListener("click", async () => {
      await logoutFromChatGpt();
    });

    updateConnectorButton?.addEventListener("click", async () => {
      await updateConnectorAutomatically();
    });

    codexModelInput?.addEventListener("change", () => {
      applyReasoningOptions(codexModelInput.value, codexReasoningInput?.value);
    });

    ollamaUrlInput?.addEventListener("change", () => {
      refreshOllamaModels(getFormConfig()).catch(() => {});
    });

    logsCopyButton?.addEventListener("click", async () => {
      await copyDiagnosticLogs();
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
      showStatus(localizedText("optionsPromptsReset", "Default prompts restored. Save to apply them."), "");
    });

    // Bind every control before touching the network. A stopped or wedged
    // connector must never make Save, tabs, or diagnostics appear broken.
    await loadConfig();
    setConnectorDownloadState("checking");
    setConnectorVersions("", EXTENSION_VERSION);
    setConnectorState("checking", localizedText("optionsCodexCheckingBadge", "Checking..."));
    setConnectionState("checking", localizedText("optionsCodexCheckingBadge", "Checking..."));
    setEngineStatus(localizedText("optionsCodexConnecting", "Checking the Codex connector and ChatGPT account..."));
    await refreshCodexStatus({ warmup: true, retry: true });
  }

  function localizePage() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      element.textContent = localizedText(key, element.textContent);
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

    if (enabledInput) {
      enabledInput.checked = Boolean(config.enabled)
        && config.dataProcessingConsentVersion === REQUIRED_AI_DATA_CONSENT_VERSION;
    }
    if (codexBridgeUrlInput) {
      codexBridgeUrlInput.value = config.codexBridgeUrl || DEFAULT_CODEX_BRIDGE_URL;
    }
    if (bridgeTokenInput) {
      bridgeTokenInput.value = config.bridgeToken || "";
    }
    if (primaryProviderInput) {
      primaryProviderInput.value = config.aiPrimaryProvider || DEFAULT_AI_PRIMARY_PROVIDER;
    }
    if (fallbackEnabledInput) {
      fallbackEnabledInput.checked = config.aiFallbackEnabled !== false;
    }
    if (codexModelInput) {
      codexModelInput.value = config.codexModel || DEFAULT_CODEX_MODEL;
    }
    applyReasoningOptions(config.codexModel, config.codexReasoningEffort);
    if (claudeModelInput) {
      claudeModelInput.value = config.claudeModel || DEFAULT_CLAUDE_MODEL;
    }
    if (ollamaUrlInput) {
      ollamaUrlInput.value = config.ollamaUrl || DEFAULT_OLLAMA_URL;
    }
    if (ollamaModelInput) {
      ollamaModelInput.value = config.ollamaModel || DEFAULT_OLLAMA_MODEL;
    }
    if (replyTranslationLanguageInput) {
      replyTranslationLanguageInput.value = config.replyTranslationLanguage || DEFAULT_REPLY_TRANSLATION_LANGUAGE;
    }
    if (replyStyleInput) {
      replyStyleInput.value = config.replyStyle || DEFAULT_REPLY_STYLE;
    }
    if (generatePromptInput) {
      generatePromptInput.value = config.generatePrompt || DEFAULT_GENERATE_PROMPT;
    }
    setPromptProfileInputs(config.replyPromptProfiles);
  }

  function setupTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activateSettingsTab(button.getAttribute("data-tab"));
      });
    });
  }

  function activateSettingsTab(tab) {
    const nextTab = tab || "connection";

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
      loadDiagnosticLogs().catch((error) => renderDiagnosticLogsError(error));
    }
  }

  async function saveConfig() {
    const config = getFormConfig();
    await storageSet({ replyAiConfig: config });
    showStatus(localizedText("optionsSaved", "Settings saved."), "success");
    return true;
  }

  async function testCodexConnection() {
    await saveConfig();
    setEngineStatus(localizedText("optionsCodexConnecting", "Checking the Codex connector and ChatGPT account..."));
    showStatus(localizedText("optionsCodexConnecting", "Checking the Codex connection..."), "");

    try {
      const config = getFormConfig();
      const data = await fetchBridgeJson(`${getBridgeUrl(config)}/warmup`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildBridgeAuthHeaders(config) },
        body: JSON.stringify(getProviderRequestConfig(config))
      });
      renderCodexStatus(data);
      await refreshCodexModels(config);
      await refreshOllamaModels(config);
      renderCodexStatus(data);
      await refreshConnectorUpdateStatus(config, data);
      if (isConnectorUpdateRequired(data)) {
        showStatus(localizedText("optionsCodexUpdateRequired", "Update the Xtension connector before using Codex."), "error");
      } else if (getUsableProviders(data).length) {
        showStatus(localizedText("optionsMultiProviderConnected", "At least one AI engine is ready."), "success");
      } else {
        showStatus(localizedText("optionsNoProviderReady", "No AI engine is ready yet."), "error");
      }
    } catch (error) {
      await refreshCodexStatus();
      setStatusText("", "");
    }
  }

  async function refreshCodexStatus({ warmup = false, retry = false } = {}) {
    const config = getFormConfig();
    const delays = retry ? BRIDGE_STATUS_RETRY_DELAYS_MS : [0];
    let lastError = null;

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt] > 0) {
        await delay(delays[attempt]);
      }

      try {
        const endpoint = warmup ? "/warmup" : buildProviderStatusPath(config);
        const data = await fetchBridgeJson(`${getBridgeUrl(config)}${endpoint}`, {
          method: warmup ? "POST" : "GET",
          headers: warmup
            ? { "content-type": "application/json", ...buildBridgeAuthHeaders(config) }
            : buildBridgeAuthHeaders(config),
          ...(warmup ? { body: JSON.stringify(getProviderRequestConfig(config)) } : {})
        });

        // The connector can answer before the Codex child process has finished
        // starting. Retry this transient state automatically instead of showing
        // a permanent red badge that disappears only after a manual test.
        if (!getInstalledProviders(data).length && attempt + 1 < delays.length) {
          lastError = new Error(data?.error || "AI engines are still starting.");
          continue;
        }

        renderCodexStatus(data);
        await refreshCodexModels(config);
        await refreshOllamaModels(config);
        renderCodexStatus(data);
        await refreshConnectorUpdateStatus(config, data);
        return data;
      } catch (error) {
        lastError = error;
      }
    }

    setConnectorDownloadState("missing");
    setConnectorVersions("", EXTENSION_VERSION);
    setConnectorState(
      "unavailable",
      localizedText("optionsCodexConnectorUnavailableBadge", "Connector unavailable"),
      lastError?.message || localizedText("optionsCodexConnectorMissing", "The Xtension Codex connector is not reachable.")
    );
    setConnectionState("unavailable", localizedText("optionsCodexUnavailableBadge", "Codex unavailable"));
    setEngineStatus(lastError?.message || localizedText("optionsCodexConnectorMissing", "The Xtension Codex connector is not reachable."));
    setAccountStatus(localizedText("optionsCodexConnectorMissing", "The Xtension Codex connector is not reachable."));
    setLoginButtons({ authenticated: false, busy: false, available: false });
    populateModelSelect(FALLBACK_CODEX_MODELS, getSelectedModel());
    return null;
  }

  function renderCodexStatus(data) {
    renderAdditionalProviders(data);
    const codexInstalled = Boolean(data?.codex?.installed);
    const authenticated = isCodexAuthenticated(data);
    const connectorVersion = getConnectorVersion(data);
    const updateRequired = isConnectorUpdateRequired(data);
    setConnectorDownloadState(updateRequired ? "incompatible" : "current");
    setConnectorVersions(connectorVersion, EXTENSION_VERSION);
    if (updateRequired) {
      setConnectorState(
        "outdated",
        localizedText("optionsCodexUpdateBadge", "Update required"),
        localizedText(
          "optionsCodexUpdateRequiredVersion",
          "This connector is outdated or does not report its version. Install v{version} to match the extension."
        ).replace("{version}", MINIMUM_CONNECTOR_VERSION)
      );
    } else {
      setConnectorState(
        "current",
        localizedText("optionsCodexConnectorReadyBadge", "Connector ready"),
        connectorVersion
          ? localizedText("optionsCodexConnectorVersion", "Connector v{version}.").replace("{version}", connectorVersion)
          : localizedText("optionsCodexConnectorHint", "The local connector is ready.")
      );
    }
    const selectedModel = getSelectedModel() || cleanText(data?.model || DEFAULT_CODEX_MODEL);
    const modelEntry = modelCatalog.find((item) => item.model === selectedModel);
    const modelName = modelEntry?.displayName || selectedModel;
    const selectedReasoning = normalizeReasoningEffort(codexReasoningInput?.value || DEFAULT_CODEX_REASONING_EFFORT);
    const modelLabel = `${localizedText("optionsCodexModelStatus", "Model:")} ${modelName}, ${localizedText("optionsCodexReasoningStatus", "reasoning:")} ${formatReasoningEffort(selectedReasoning)}.`;

    if (!codexInstalled) {
      setConnectionState("unavailable", localizedText("optionsCodexUnavailableBadge", "Codex unavailable"));
      setEngineStatus(localizedText("optionsCodexNotInstalled", "Codex CLI is not available to the connector."));
      setAccountStatus(localizedText("optionsCodexConnectorMissing", "The Codex connector is running, but Codex CLI is not available."));
      setLoginButtons({ authenticated: false, busy: false, available: false });
      return;
    }

    if (updateRequired) {
      setConnectionState("outdated", localizedText("optionsCodexUpdateBadge", "Update required"));
      setEngineStatus(localizedText(
        "optionsCodexUpdateRequiredVersion",
        "This connector is outdated or does not report its version. Install v{version} to match the extension."
      ).replace("{version}", MINIMUM_CONNECTOR_VERSION));
      setAccountStatus(authenticated
        ? localizedText("optionsCodexAccountConnected", "ChatGPT account connected.")
        : localizedText("optionsCodexAccountRequired", "Connect your ChatGPT account to use OpenAI Codex."));
      setLoginButtons({ authenticated, busy: false, available: false });
      return;
    }

    if (!authenticated) {
      setConnectionState("signed-out", localizedText("optionsCodexDisconnectedBadge", "Not connected"));
      setEngineStatus(localizedText("optionsCodexAccountRequired", "ChatGPT sign-in is required before using Codex."));
      setAccountStatus(localizedText("optionsCodexAccountRequired", "Connect your ChatGPT account to use OpenAI Codex."));
      setLoginButtons({ authenticated: false, busy: false, available: true });
      return;
    }

    const plan = cleanText(data?.auth?.planType || data?.planType || "");
    const planText = plan ? ` (${plan})` : "";
    const connectorText = connectorVersion
      ? ` ${localizedText("optionsCodexConnectorVersion", "Connector v{version}.").replace("{version}", connectorVersion)}`
      : "";
    setConnectionState("connected", localizedText("optionsCodexConnectedBadge", "Connected to ChatGPT"));
    setEngineStatus(`${localizedText("optionsCodexConnected", "Connected to OpenAI Codex.")} ${modelLabel}${connectorText}`);
    setAccountStatus(`${localizedText("optionsCodexAccountConnected", "ChatGPT account connected.")}${planText}`);
    setLoginButtons({ authenticated: true, busy: false, available: true });
  }

  function isCodexAuthenticated(data) {
    return Boolean(data?.auth?.authenticated ?? data?.authenticated);
  }

  function getProviderData(data, id) {
    return (Array.isArray(data?.providers) ? data.providers : []).find((provider) => provider?.id === id) || null;
  }

  function getInstalledProviders(data) {
    return (Array.isArray(data?.providers) ? data.providers : []).filter((provider) => provider?.installed);
  }

  function getUsableProviders(data) {
    return (Array.isArray(data?.providers) ? data.providers : []).filter((provider) => provider?.usable);
  }

  function renderAdditionalProviders(data) {
    const claudeProvider = getProviderData(data, "anthropic-claude") || data?.claude || {};
    if (claudeProvider.usable) {
      setProviderCard(claudeCard, claudeBadge, claudeStatusElement, "connected",
        localizedText("optionsProviderReadyBadge", "Ready"),
        localizedText("optionsClaudeReady", "Claude Code is connected through the existing Claude subscription."));
    } else if (claudeProvider.installed) {
      setProviderCard(claudeCard, claudeBadge, claudeStatusElement, "signed-out",
        localizedText("optionsCodexDisconnectedBadge", "Not connected"),
        claudeProvider.errorCode === "provider_update_required"
          ? localizedText("optionsClaudeUpdateRequired", "Update Claude Code before using it in Xtension.")
          : localizedText("optionsClaudeLoginRequired", "Run Claude Code once and sign in with a Claude subscription."));
    } else {
      setProviderCard(claudeCard, claudeBadge, claudeStatusElement, "unavailable",
        localizedText("optionsProviderUnavailableBadge", "Unavailable"),
        localizedText("optionsClaudeNotInstalled", "Claude Code was not detected on this Windows account."));
    }

    const ollamaProvider = getProviderData(data, "local-ollama") || data?.ollama || {};
    if (ollamaProvider.usable) {
      setProviderCard(ollamaCard, ollamaBadge, ollamaStatusElement, "connected",
        localizedText("optionsProviderReadyBadge", "Ready"),
        localizedText("optionsOllamaReady", "The configured Ollama server and model are ready."));
    } else if (ollamaProvider.installed) {
      setProviderCard(ollamaCard, ollamaBadge, ollamaStatusElement, "signed-out",
        localizedText("optionsProviderModelMissingBadge", "Model missing"),
        localizedText("optionsOllamaModelMissing", "Ollama is reachable, but the configured model is not installed."));
    } else {
      setProviderCard(ollamaCard, ollamaBadge, ollamaStatusElement, "unavailable",
        localizedText("optionsProviderUnavailableBadge", "Unavailable"),
        localizedText("optionsOllamaUnavailable", "Ollama is not reachable at the configured local URL."));
    }
  }

  function setProviderCard(card, badge, status, state, badgeText, statusText) {
    if (card) card.dataset.state = state;
    if (badge) {
      badge.dataset.state = state;
      badge.textContent = badgeText;
    }
    if (status) status.textContent = statusText;
  }

  function buildProviderStatusPath(config) {
    const params = new URLSearchParams({
      ollamaUrl: normalizeOllamaUrl(config?.ollamaUrl) || DEFAULT_OLLAMA_URL,
      ollamaModel: normalizeProviderModel(config?.ollamaModel, DEFAULT_OLLAMA_MODEL)
    });
    return `/providers?${params.toString()}`;
  }

  function getProviderRequestConfig(config) {
    return {
      allowedProviders: [...AI_PROVIDER_IDS],
      primaryProvider: normalizeAiPrimaryProvider(config?.aiPrimaryProvider),
      fallbackEnabled: config?.aiFallbackEnabled !== false,
      model: normalizeCodexModel(config?.codexModel || DEFAULT_CODEX_MODEL),
      reasoningEffort: normalizeReasoningEffort(config?.codexReasoningEffort || DEFAULT_CODEX_REASONING_EFFORT),
      claudeModel: normalizeProviderModel(config?.claudeModel, DEFAULT_CLAUDE_MODEL),
      ollamaUrl: normalizeOllamaUrl(config?.ollamaUrl) || DEFAULT_OLLAMA_URL,
      ollamaModel: normalizeProviderModel(config?.ollamaModel, DEFAULT_OLLAMA_MODEL)
    };
  }

  function getConnectorVersion(data) {
    return cleanText(data?.connectorVersion || data?.connector?.version || data?.version || "");
  }

  function isConnectorUpdateRequired(data) {
    const connectorVersion = getConnectorVersion(data);
    return !connectorVersion || compareVersions(connectorVersion, MINIMUM_CONNECTOR_VERSION) < 0;
  }

  function compareVersions(left, right) {
    const parse = (value) => String(value || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
    const a = parse(left);
    const b = parse(right);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const difference = (a[index] || 0) - (b[index] || 0);
      if (difference) return difference;
    }
    return 0;
  }

  function setConnectorDownloadState(state, { canSelfUpdate = false } = {}) {
    const normalized = cleanText(state || "current");
    if (connectorDownload) {
      connectorDownload.dataset.state = normalized === "incompatible" ? "outdated" : normalized;
    }
    if (installConnectorLink) {
      const manualUpdate = normalized === "outdated" || normalized === "incompatible";
      installConnectorLink.hidden = normalized !== "missing" && (!manualUpdate || canSelfUpdate);
      installConnectorLink.textContent = manualUpdate
        ? localizedText("optionsCodexUpdateConnector", "Update connector")
        : localizedText("optionsCodexInstallConnector", "Install connector");
    }
    if (updateConnectorButton) {
      updateConnectorButton.hidden = !(normalized === "outdated" && canSelfUpdate);
      updateConnectorButton.disabled = normalized === "updating";
      updateConnectorButton.textContent = normalized === "updating"
        ? localizedText("optionsCodexUpdatingConnector", "Updating...")
        : localizedText("optionsCodexUpdateConnector", "Update connector");
    }
    if (connectorCurrentElement) {
      connectorCurrentElement.hidden = normalized !== "current";
      connectorCurrentElement.textContent = canSelfUpdate
        ? localizedText("optionsCodexAutomaticUpdatesEnabled", "Up to date · automatic updates enabled")
        : localizedText("optionsCodexUpToDate", "Up to date");
    }
  }

  function setConnectorVersions(installedVersion, latestVersion) {
    if (installedConnectorVersionElement) {
      installedConnectorVersionElement.textContent = installedVersion
        ? `v${installedVersion}`
        : localizedText("optionsCodexNotDetectedVersion", "Not detected");
    }
    if (latestConnectorVersionElement) {
      latestConnectorVersionElement.textContent = latestVersion ? `v${latestVersion}` : "—";
    }
  }

  async function refreshConnectorUpdateStatus(config, connectorData) {
    const installedVersion = getConnectorVersion(connectorData);
    let update = null;
    try {
      const data = await fetchBridgeJson(`${getBridgeUrl(config)}/update/status`, {
        method: "GET",
        headers: buildBridgeAuthHeaders(config)
      });
      update = data?.update && typeof data.update === "object" ? data.update : null;
    } catch {
      // Connectors before the self-updater do not expose this route. They still
      // get a correct one-time manual update state by comparing their reported
      // version with the connector bundled alongside this extension release.
    }

    const latestVersion = cleanText(update?.latestVersion || EXTENSION_VERSION || "");
    const canSelfUpdate = Boolean(update?.canSelfUpdate ?? connectorData?.capabilities?.selfUpdate);
    const updateAvailable = typeof update?.updateAvailable === "boolean"
      ? update.updateAvailable
      : Boolean(installedVersion && latestVersion && compareVersions(installedVersion, latestVersion) < 0);
    const updateInProgress = ["checking", "downloading", "verifying", "ready", "waiting_for_idle", "installing", "restarting"]
      .includes(cleanText(update?.state || "").toLowerCase()) && updateAvailable;

    setConnectorVersions(installedVersion, latestVersion);
    if (updateInProgress) {
      setConnectorDownloadState("updating", { canSelfUpdate });
      setConnectorState(
        "updating",
        localizedText("optionsCodexUpdatingBadge", "Updating"),
        localizedText("optionsCodexAutomaticUpdateInProgress", "The signed update is being installed. The connector will restart automatically.")
      );
      return update;
    }
    if (updateAvailable) {
      setConnectorDownloadState("outdated", { canSelfUpdate });
      setConnectorState(
        "outdated",
        localizedText("optionsCodexUpdateBadge", "Update available"),
        canSelfUpdate
          ? localizedText("optionsCodexUpdateAvailable", "A newer signed connector is available and can be installed automatically.")
          : localizedText("optionsCodexManualUpdateOnce", "Run this update once. Future connector updates will install automatically.")
      );
      return update;
    }

    setConnectorDownloadState("current", { canSelfUpdate });
    setConnectorState(
      "current",
      localizedText("optionsCodexConnectorReadyBadge", "Up to date"),
      update?.error
        ? localizedText("optionsCodexLatestVersionUnavailable", "The connector is running, but the latest version could not be checked right now.")
        : localizedText("optionsCodexConnectorCurrent", "The installed connector is the latest available version.")
    );
    return update;
  }

  async function updateConnectorAutomatically() {
    const config = getFormConfig();
    setConnectorDownloadState("updating", { canSelfUpdate: true });
    setConnectorState(
      "updating",
      localizedText("optionsCodexUpdatingBadge", "Updating"),
      localizedText("optionsCodexDownloadingUpdate", "Downloading and verifying the signed connector update...")
    );
    showStatus(localizedText("optionsCodexDownloadingUpdate", "Downloading and verifying the signed connector update..."), "");
    try {
      const data = await fetchBridgeJson(`${getBridgeUrl(config)}/update/install`, {
        method: "POST",
        headers: buildBridgeAuthHeaders(config)
      });
      const targetVersion = cleanText(data?.update?.latestVersion || EXTENSION_VERSION);
      await waitForConnectorRestart(config, targetVersion);
      await refreshCodexStatus({ warmup: true, retry: true });
      showStatus(localizedText("optionsCodexUpdateComplete", "Connector updated and restarted successfully."), "success");
    } catch (error) {
      setConnectorDownloadState("outdated", { canSelfUpdate: true });
      setConnectorState(
        "outdated",
        localizedText("optionsCodexUpdateBadge", "Update available"),
        error?.message || localizedText("optionsCodexUpdateFailed", "The connector update could not be completed.")
      );
      showStatus(error?.message || localizedText("optionsCodexUpdateFailed", "The connector update could not be completed."), "error");
    }
  }

  async function waitForConnectorRestart(config, targetVersion) {
    const deadline = Date.now() + 90 * 1000;
    while (Date.now() < deadline) {
      await delay(1000);
      try {
        const data = await fetchBridgeJson(`${getBridgeUrl(config)}/ping`, {
          method: "GET",
          headers: buildBridgeAuthHeaders(config)
        });
        const version = getConnectorVersion(data);
        if (version && (!targetVersion || compareVersions(version, targetVersion) >= 0)) {
          return version;
        }
      } catch {
        // Expected while the silent installer replaces and restarts the bridge.
      }
    }
    throw new Error(localizedText("optionsCodexUpdateRestartTimeout", "The update was launched, but the connector did not restart in time."));
  }

  function setConnectorState(state, badge, detail = "") {
    const normalizedState = cleanText(state || "unknown").toLowerCase() || "unknown";
    if (connectorDownload) {
      connectorDownload.dataset.state = normalizedState;
    }
    if (connectorBadge) {
      connectorBadge.dataset.state = normalizedState;
      connectorBadge.textContent = badge || "";
    }
    if (connectorStatusElement && detail) {
      connectorStatusElement.textContent = detail;
    }
  }

  async function refreshCodexModels(config = getFormConfig()) {
    try {
      const data = await fetchBridgeJson(`${getBridgeUrl(config)}/models?provider=openai-codex`, {
        method: "GET",
        headers: buildBridgeAuthHeaders(config)
      });
      const models = Array.isArray(data?.models) && data.models.length ? data.models : FALLBACK_CODEX_MODELS;
      modelCatalog = models;
      populateModelSelect(modelCatalog, getSelectedModel() || DEFAULT_CODEX_MODEL);
      if (codexModelStatus) {
        codexModelStatus.textContent = localizedText("optionsCodexModelCount", `${models.length} OpenAI Codex models available.`).replace("{count}", String(models.length));
      }
      return models;
    } catch {
      modelCatalog = [...FALLBACK_CODEX_MODELS];
      populateModelSelect(modelCatalog, getSelectedModel() || DEFAULT_CODEX_MODEL);
      if (codexModelStatus) {
        codexModelStatus.textContent = localizedText("optionsCodexModelFallback", "Showing the standard Codex models. The live catalog will appear when the Codex host is reachable.");
      }
      return modelCatalog;
    }
  }

  async function refreshOllamaModels(config = getFormConfig()) {
    if (!ollamaModelsList || !ollamaModelInput) return [];
    const params = new URLSearchParams({
      provider: "local-ollama",
      ollamaUrl: normalizeOllamaUrl(config?.ollamaUrl) || DEFAULT_OLLAMA_URL
    });
    try {
      const data = await fetchBridgeJson(`${getBridgeUrl(config)}/models?${params.toString()}`, {
        method: "GET",
        headers: buildBridgeAuthHeaders(config)
      });
      const models = Array.isArray(data?.models) ? data.models.filter((item) => item?.model) : [];
      ollamaModelsList.replaceChildren(...models.map((item) => {
        const option = document.createElement("option");
        option.value = item.model;
        option.label = item.displayName || item.model;
        return option;
      }));
      if (ollamaModelStatus) {
        ollamaModelStatus.textContent = localizedText("optionsOllamaModelCount", "{count} local models available.")
          .replace("{count}", String(models.length));
      }
      return models;
    } catch (error) {
      ollamaModelsList.replaceChildren();
      if (ollamaModelStatus) {
        ollamaModelStatus.textContent = localizedText("optionsOllamaModelUnavailable", "The local model list will appear when Ollama is reachable.");
      }
      return [];
    }
  }

  function populateModelSelect(models, selectedModel) {
    if (!codexModelInput) {
      return;
    }

    const entries = Array.isArray(models) ? models.filter((item) => item?.model) : [];
    const selected = cleanText(selectedModel || DEFAULT_CODEX_MODEL);
    const hasSelected = entries.some((item) => item.model === selected);
    const options = hasSelected ? entries : [{ model: selected, displayName: selected, supportedReasoningEfforts: [] }, ...entries];
    codexModelInput.replaceChildren(...options.map((item) => {
      const option = document.createElement("option");
      option.value = item.model;
      option.textContent = item.displayName || item.model;
      return option;
    }));
    codexModelInput.value = options.some((item) => item.model === selected) ? selected : options[0]?.model || DEFAULT_CODEX_MODEL;
    applyReasoningOptions(codexModelInput.value, codexReasoningInput?.value);
  }

  function applyReasoningOptions(model, preferred) {
    if (!codexReasoningInput) {
      return;
    }

    const entry = modelCatalog.find((item) => item.model === model);
    const supported = Array.isArray(entry?.supportedReasoningEfforts) && entry.supportedReasoningEfforts.length
      ? entry.supportedReasoningEfforts
      : CODEX_REASONING_ORDER;
    const current = normalizeReasoningEffort(preferred || DEFAULT_CODEX_REASONING_EFFORT);
    const selected = supported.includes(current) ? current : [...CODEX_REASONING_ORDER].reverse().find((effort) => supported.includes(effort)) || supported[0];
    Array.from(codexReasoningInput.options).forEach((option) => {
      option.hidden = !supported.includes(option.value);
      option.disabled = !supported.includes(option.value);
    });
    codexReasoningInput.value = selected || DEFAULT_CODEX_REASONING_EFFORT;
  }

  async function loginToChatGpt() {
    const config = getFormConfig();
    setConnectionState("checking", localizedText("optionsCodexCheckingBadge", "Checking connection"));
    setLoginButtons({ authenticated: false, busy: true, available: true });
    setEngineStatus(localizedText("optionsCodexConnecting", "Opening the official ChatGPT sign-in..."));
    setAccountStatus(localizedText("optionsCodexConnecting", "Waiting for ChatGPT sign-in..."));
    showStatus(localizedText("optionsCodexConnecting", "Opening the official ChatGPT sign-in..."), "");

    // Open synchronously from the click handler so popup blockers do not hide
    // the official OAuth page returned by Codex.
    const loginWindow = globalThis.open("about:blank", "xtension-codex-login", "popup,width=520,height=760");

    try {
      const result = await fetchBridgeJson(`${getBridgeUrl(config)}/auth/login`, {
        method: "POST",
        headers: buildBridgeAuthHeaders(config)
      });
      const authUrl = cleanText(result?.authUrl || result?.verificationUrl || "");
      if (!authUrl) {
        throw new Error(localizedText("optionsCodexConnectionFailed", "Codex did not provide a sign-in page."));
      }

      // L'URL vient du connecteur local. Si un autre programme squattait le port
      // 47623 avant lui, il pourrait renvoyer une page de phishing ou une URL
      // javascript:. On n'ouvre donc que des pages de connexion OpenAI en HTTPS.
      if (!isTrustedSignInUrl(authUrl)) {
        throw new Error(localizedText("optionsCodexConnectionFailed", "The sign-in page returned by the connector is not a trusted OpenAI address."));
      }

      if (loginWindow && !loginWindow.closed) {
        loginWindow.location.href = authUrl;
      } else {
        globalThis.open(authUrl, "_blank", "noopener,noreferrer");
      }

      const connected = await waitForChatGptLogin(config);
      if (!connected) {
        throw new Error(localizedText("optionsCodexConnectionFailed", "ChatGPT sign-in was not completed."));
      }
      showStatus(localizedText("optionsCodexConnected", "Connected to OpenAI Codex."), "success");
    } catch (error) {
      setConnectionState("signed-out", localizedText("optionsCodexDisconnectedBadge", "Not connected"));
      setLoginButtons({ authenticated: false, busy: false, available: true });
      setAccountStatus(error?.message || localizedText("optionsCodexConnectionFailed", "The ChatGPT connection failed."));
      setEngineStatus(localizedText("optionsCodexConnectionFailed", "The Codex connection failed."));
      showStatus(error?.message || localizedText("optionsCodexConnectionFailed", "The ChatGPT connection failed."), "error");
    } finally {
      if (loginWindow && !loginWindow.closed) {
        try {
          loginWindow.close();
        } catch {
          // The user may have navigated the OAuth window independently.
        }
      }
      await refreshCodexStatus();
    }
  }

  async function waitForChatGptLogin(config) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      await delay(2000);
      try {
        const data = await fetchBridgeJson(`${getBridgeUrl(config)}/auth/status`, {
          method: "GET",
          headers: buildBridgeAuthHeaders(config)
        });
        renderCodexStatus(data);
        if (data?.auth?.authenticated) {
          return true;
        }
      } catch {
        // Keep polling while the local connector restarts during OAuth.
      }
    }
    return false;
  }

  async function logoutFromChatGpt() {
    const config = getFormConfig();
    setConnectionState("checking", localizedText("optionsCodexCheckingBadge", "Checking connection"));
    setLoginButtons({ authenticated: true, busy: true, available: true });
    try {
      await fetchBridgeJson(`${getBridgeUrl(config)}/auth/logout`, {
        method: "POST",
        headers: buildBridgeAuthHeaders(config)
      });
      showStatus(localizedText("optionsCodexLoggedOut", "ChatGPT account disconnected."), "success");
    } catch (error) {
      showStatus(error?.message || localizedText("optionsCodexConnectionFailed", "The ChatGPT connection failed."), "error");
    }
    await refreshCodexStatus();
  }

  function setLoginButtons({ authenticated, busy, available = true }) {
    if (loginButton) {
      loginButton.hidden = Boolean(authenticated) || !available;
      loginButton.disabled = Boolean(busy) || Boolean(authenticated) || !available;
    }
    if (logoutButton) {
      logoutButton.hidden = !authenticated || !available;
      logoutButton.disabled = Boolean(busy) || !authenticated;
    }
    if (installConnectorLink) {
      installConnectorLink.hidden = false;
    }
  }

  function setConnectionState(state, message) {
    const normalizedState = cleanText(state || "unknown").toLowerCase() || "unknown";
    if (connectionCard) {
      connectionCard.dataset.state = normalizedState;
    }
    if (connectionBadge) {
      connectionBadge.dataset.state = normalizedState;
      connectionBadge.textContent = message || "";
    }
  }

  function setEngineStatus(message) {
    if (engineStatusElement) {
      engineStatusElement.textContent = message || "";
    }
  }

  function setAccountStatus(message) {
    if (accountStatusElement) {
      accountStatusElement.textContent = message || "";
    }
  }

  function getBridgeUrl(config) {
    return normalizeCodexBridgeUrl(config?.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
  }

  function buildBridgeAuthHeaders(config) {
    const token = cleanText(config?.bridgeToken || "");
    return token ? { "x-xtension-bridge-token": token } : {};
  }

  async function fetchBridgeJson(url, options = {}) {
    let response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BRIDGE_STATUS_TIMEOUT_MS);
    try {
      response = await fetch(url, { ...options, signal: options.signal || controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(localizedText("optionsCodexConnectorTimeout", "The Codex connector did not answer in time."));
      }
      throw new Error(localizedText("optionsCodexConnectorMissing", "The Codex connector is not reachable."));
    } finally {
      clearTimeout(timer);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const originRejected = response.status === 403
        && (data?.code === "origin_not_allowed" || /origin is not allowed/i.test(cleanText(data?.error || "")));
      const error = new Error(originRejected
        ? localizedText("optionsCodexOriginRejected", "This connector does not recognize this Xtension installation. Update the connector, then try again.")
        : data?.error || `${localizedText("optionsCodexConnectionFailed", "The Codex connection failed.")} (${response.status})`);
      error.code = data?.code || "bridge_request_failed";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadDiagnosticLogs() {
    if (!logsOutput) {
      return;
    }

    diagnosticLogText = "";
    setDiagnosticLogOutput(localizedText("optionsLogsLoading", "Loading logs..."));
    if (logsCopyButton) logsCopyButton.disabled = true;
    const response = await runtimeSendMessage({ type: "xtension-get-diagnostic-logs" });
    if (!response?.ok) {
      throw new Error(response?.error || localizedText("optionsLogsLoadFailed", "Unable to load logs."));
    }
    renderDiagnosticLogs(response.logs || []);
  }

  async function clearDiagnosticLogs() {
    const response = await runtimeSendMessage({ type: "xtension-clear-diagnostic-logs" });
    if (!response?.ok) {
      throw new Error(response?.error || localizedText("optionsLogsClearFailed", "Unable to clear logs."));
    }
    renderDiagnosticLogs([]);
    showStatus(localizedText("optionsLogsCleared", "Logs cleared."), "success");
  }

  async function copyDiagnosticLogs() {
    if (!diagnosticLogText) {
      showStatus(localizedText("optionsLogsNothingToCopy", "There are no diagnostic logs to copy."), "");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(diagnosticLogText);
      } else if (!copyLogsWithSelection()) {
        throw new Error("Clipboard API unavailable");
      }
      showStatus(localizedText("optionsLogsCopied", "Logs copied to the clipboard."), "success");
    } catch {
      if (copyLogsWithSelection()) {
        showStatus(localizedText("optionsLogsCopied", "Logs copied to the clipboard."), "success");
        return;
      }
      showStatus(localizedText("optionsLogsCopyFailed", "Unable to copy the logs."), "error");
    }
  }

  function copyLogsWithSelection() {
    if (!logsOutput?.select || !document.execCommand) return false;
    logsOutput.focus();
    logsOutput.select();
    return Boolean(document.execCommand("copy"));
  }

  function renderDiagnosticLogs(logs) {
    if (!logsOutput) {
      return;
    }
    if (!Array.isArray(logs) || logs.length === 0) {
      diagnosticLogText = "";
      setDiagnosticLogOutput(localizedText("optionsLogsEmpty", "No diagnostic logs yet."));
      if (logsCopyButton) logsCopyButton.disabled = true;
      return;
    }
    diagnosticLogText = logs.map(formatDiagnosticLogEntry).join("\n");
    setDiagnosticLogOutput(diagnosticLogText);
    if (logsCopyButton) logsCopyButton.disabled = false;
  }

  function renderDiagnosticLogsError(error) {
    diagnosticLogText = "";
    if (logsOutput) {
      setDiagnosticLogOutput(error?.message || localizedText("optionsLogsLoadFailed", "Unable to load logs."));
    }
    if (logsCopyButton) logsCopyButton.disabled = true;
  }

  function setDiagnosticLogOutput(value) {
    if (!logsOutput) return;
    if ("value" in logsOutput) {
      logsOutput.value = value || "";
    } else {
      logsOutput.textContent = value || "";
    }
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
      details.route ? `route=${details.route}` : "",
      typeof details.ok === "boolean" ? `ok=${details.ok}` : "",
      Number.isFinite(details.durationMs) ? `durationMs=${details.durationMs}` : "",
      details.errorCode ? `errorCode=${details.errorCode}` : ""
    ].filter(Boolean);

    ["operation", "route", "ok", "durationMs", "errorCode"].forEach((key) => delete details[key]);
    const extra = Object.keys(details).length ? ` ${JSON.stringify(details)}` : "";
    return `[${time}] ${level} ${area}/${event} ${compact.join(" ")}${extra}`.trim();
  }

  function getFormConfig() {
    const aiEnabled = Boolean(enabledInput?.checked);
    return {
      configVersion: REPLY_AI_CONFIG_VERSION,
      enabled: aiEnabled,
      dataProcessingConsentVersion: aiEnabled ? REQUIRED_AI_DATA_CONSENT_VERSION : 0,
      codexBridgeUrl: normalizeCodexBridgeUrl(codexBridgeUrlInput?.value) || DEFAULT_CODEX_BRIDGE_URL,
      bridgeToken: cleanText(bridgeTokenInput?.value || ""),
      aiPrimaryProvider: normalizeAiPrimaryProvider(primaryProviderInput?.value),
      aiFallbackEnabled: fallbackEnabledInput?.checked !== false,
      codexModel: normalizeCodexModel(codexModelInput?.value || DEFAULT_CODEX_MODEL),
      codexReasoningEffort: normalizeReasoningEffort(codexReasoningInput?.value || DEFAULT_CODEX_REASONING_EFFORT),
      claudeModel: normalizeProviderModel(claudeModelInput?.value, DEFAULT_CLAUDE_MODEL),
      ollamaUrl: normalizeOllamaUrl(ollamaUrlInput?.value) || DEFAULT_OLLAMA_URL,
      ollamaModel: normalizeProviderModel(ollamaModelInput?.value, DEFAULT_OLLAMA_MODEL),
      replyTranslationLanguage: normalizeReplyTranslationLanguage(replyTranslationLanguageInput?.value),
      replyStyle: normalizeReplyStyle(replyStyleInput?.value),
      replyPromptProfiles: getPromptProfileInputs(),
      generatePrompt: cleanText(generatePromptInput?.value || DEFAULT_GENERATE_PROMPT) || DEFAULT_GENERATE_PROMPT
    };
  }

  function normalizeReplyAiConfig(config) {
    const rawConfig = config && typeof config === "object" ? config : {};
    const previousConfigVersion = Number(rawConfig.configVersion) || 0;
    const normalized = { ...DEFAULT_CONFIG, ...rawConfig };
    normalized.configVersion = REPLY_AI_CONFIG_VERSION;
    normalized.dataProcessingConsentVersion = Number(rawConfig.dataProcessingConsentVersion) === REQUIRED_AI_DATA_CONSENT_VERSION
      ? REQUIRED_AI_DATA_CONSENT_VERSION
      : 0;
    normalized.enabled = normalized.dataProcessingConsentVersion === REQUIRED_AI_DATA_CONSENT_VERSION
      && rawConfig.enabled === true;
    normalized.codexBridgeUrl = normalizeCodexBridgeUrl(normalized.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
    normalized.bridgeToken = cleanText(normalized.bridgeToken || "");
    normalized.codexModel = normalizeCodexModel(normalized.codexModel || DEFAULT_CODEX_MODEL);
    normalized.codexReasoningEffort = normalizeReasoningEffort(normalized.codexReasoningEffort || DEFAULT_CODEX_REASONING_EFFORT);
    normalized.aiPrimaryProvider = normalizeAiPrimaryProvider(normalized.aiPrimaryProvider);
    normalized.aiFallbackEnabled = normalized.aiFallbackEnabled !== false;
    normalized.claudeModel = normalizeProviderModel(normalized.claudeModel, DEFAULT_CLAUDE_MODEL);
    normalized.ollamaUrl = normalizeOllamaUrl(normalized.ollamaUrl) || DEFAULT_OLLAMA_URL;
    normalized.ollamaModel = normalizeProviderModel(normalized.ollamaModel, DEFAULT_OLLAMA_MODEL);
    if (previousConfigVersion < 20 && cleanText(rawConfig.codexReasoningEffort || "") === "max") {
      normalized.codexReasoningEffort = DEFAULT_CODEX_REASONING_EFFORT;
    }
    if (previousConfigVersion < 21 && cleanText(rawConfig.codexReasoningEffort || "") === "medium") {
      normalized.codexReasoningEffort = DEFAULT_CODEX_REASONING_EFFORT;
    }
    normalized.replyTranslationLanguage = normalizeReplyTranslationLanguage(normalized.replyTranslationLanguage);
    normalized.replyStyle = normalizeReplyStyle(normalized.replyStyle);
    normalized.replyPromptProfiles = (
      previousConfigVersion < 22 && (
        usesLegacyReplyPromptProfiles(rawConfig.replyPromptProfiles, LEGACY_REPLY_PROMPT_PROFILES_V20)
        || usesLegacyReplyPromptProfiles(rawConfig.replyPromptProfiles, LEGACY_REPLY_PROMPT_PROFILES_V21)
      )
    ) || (previousConfigVersion < 24 && usesLegacyReplyPromptProfiles(rawConfig.replyPromptProfiles, LEGACY_REPLY_PROMPT_PROFILES_V23))
      ? cloneDefaultReplyPromptProfiles()
      : normalizeReplyPromptProfiles(normalized.replyPromptProfiles, rawConfig.prompt);
    normalized.generatePrompt = cleanText(normalized.generatePrompt || DEFAULT_GENERATE_PROMPT) || DEFAULT_GENERATE_PROMPT;
    if (
      (previousConfigVersion < 22 && [LEGACY_GENERATE_PROMPT_V20, LEGACY_GENERATE_PROMPT_V21].includes(cleanText(rawConfig.generatePrompt || "")))
      || (previousConfigVersion < 24 && cleanText(rawConfig.generatePrompt || "") === LEGACY_GENERATE_PROMPT_V23)
    ) {
      normalized.generatePrompt = DEFAULT_GENERATE_PROMPT;
    }

    // Remove settings from the former local/provider architecture, including
    // API-key fields users may have stored in an earlier development build.
    [
      "provider", "codexModelPreset", "prompt", "replyCount",
      "baseUrl", "model", "apiKey", "gpu", "replyLanguageMode"
    ].forEach((key) => delete normalized[key]);
    return normalized;
  }

  function cloneDefaultReplyPromptProfiles() {
    return DEFAULT_REPLY_PROMPT_PROFILES.map((profile) => ({ ...profile }));
  }

  function usesLegacyReplyPromptProfiles(value, legacyProfiles) {
    if (!Array.isArray(value) || !Array.isArray(legacyProfiles) || value.length < legacyProfiles.length) {
      return false;
    }
    return legacyProfiles.every((legacy, index) => {
      const profile = value[index] && typeof value[index] === "object" ? value[index] : {};
      return cleanText(profile.label || profile.name || "") === legacy.label
        && cleanDraftText(profile.prompt || "") === legacy.prompt;
    });
  }

  function normalizeReplyPromptProfiles(value, legacyPrompt) {
    const input = Array.isArray(value) ? value : [];
    const legacy = cleanDraftText(legacyPrompt || "");
    return cloneDefaultReplyPromptProfiles().map((fallback, index) => {
      const raw = input[index] && typeof input[index] === "object" ? input[index] : {};
      return {
        label: cleanText(raw.label || raw.name || fallback.label).slice(0, 80) || fallback.label,
        prompt: cleanDraftText(raw.prompt || (legacy && index === 0 ? legacy : "") || fallback.prompt).slice(0, 5000) || fallback.prompt
      };
    });
  }

  function getPromptProfileInputs() {
    return normalizeReplyPromptProfiles(promptProfileRows.map((row, index) => {
      const fallback = DEFAULT_REPLY_PROMPT_PROFILES[index] || DEFAULT_REPLY_PROMPT_PROFILES[0];
      return {
        label: row.querySelector("[data-reply-prompt-label]")?.value || fallback.label,
        prompt: row.querySelector("[data-reply-prompt-text]")?.value || fallback.prompt
      };
    }));
  }

  function setPromptProfileInputs(profiles) {
    const normalized = normalizeReplyPromptProfiles(profiles);
    promptProfileRows.forEach((row, index) => {
      const profile = normalized[index] || DEFAULT_REPLY_PROMPT_PROFILES[index];
      const label = row.querySelector("[data-reply-prompt-label]");
      const prompt = row.querySelector("[data-reply-prompt-text]");
      if (label) label.value = profile.label;
      if (prompt) prompt.value = profile.prompt;
    });
  }

  function shouldPersistReplyAiConfig(rawConfig, normalizedConfig) {
    if (!rawConfig || typeof rawConfig !== "object") {
      return true;
    }
    return JSON.stringify(rawConfig) !== JSON.stringify(normalizedConfig);
  }

  function getSelectedModel() {
    return normalizeCodexModel(codexModelInput?.value || DEFAULT_CODEX_MODEL);
  }

  function normalizeCodexModel(value) {
    const model = cleanText(value);
    return /^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(model) ? model : DEFAULT_CODEX_MODEL;
  }

  function normalizeReasoningEffort(value) {
    const effort = cleanText(value).toLowerCase();
    return CODEX_REASONING_ORDER.includes(effort) ? effort : DEFAULT_CODEX_REASONING_EFFORT;
  }

  function normalizeAiPrimaryProvider(value) {
    const provider = cleanText(value).toLowerCase();
    return provider === "auto" || AI_PROVIDER_IDS.includes(provider)
      ? provider
      : DEFAULT_AI_PRIMARY_PROVIDER;
  }

  function normalizeProviderModel(value, fallback) {
    const model = cleanText(value);
    return model && !/[\x00-\x1f\s]/.test(model) && model.length <= 240 ? model : fallback;
  }

  function formatReasoningEffort(value) {
    const key = `optionsCodexReasoning${value === "xhigh" ? "XHigh" : value.charAt(0).toUpperCase() + value.slice(1)}`;
    return localizedText(key, value);
  }

  function normalizeCodexBridgeUrl(value) {
    try {
      const url = new URL(String(value || DEFAULT_CODEX_BRIDGE_URL).trim());
      if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
        return "";
      }
      return `${url.protocol}//${url.host}`;
    } catch {
      return "";
    }
  }

  function normalizeOllamaUrl(value) {
    try {
      const url = new URL(String(value || DEFAULT_OLLAMA_URL).trim());
      const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
      const privateHost = ["localhost", "127.0.0.1", "::1"].includes(host)
        || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
        || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
        || (() => {
          const match = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
          return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
        })();
      if (!["http:", "https:"].includes(url.protocol) || !privateHost || url.username || url.password) {
        return "";
      }
      return `${url.protocol}//${url.host}`;
    } catch {
      return "";
    }
  }

  function normalizeReplyTranslationLanguage(value) {
    const language = cleanText(value).toLowerCase().split(/[-_]/)[0];
    return REPLY_TRANSLATION_LANGUAGES.has(language) ? language : DEFAULT_REPLY_TRANSLATION_LANGUAGE;
  }

  function normalizeReplyStyle(value) {
    const style = cleanText(value).toLowerCase();
    return ["auto", "humor", "sharp", "useful", "question"].includes(style) ? style : DEFAULT_REPLY_STYLE;
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
        const maybePromise = storageApi.get(defaults, (result) => resolve(result || defaults || {}));
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then((result) => resolve(result || defaults || {}), () => resolve(defaults || {}));
        }
      } catch {
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

  function setStatusText(message, type) {
    if (!statusElement) {
      return;
    }
    statusElement.className = statusBaseClass;
    if (type) {
      statusElement.classList.add(type);
    }
    statusElement.textContent = message || "";
  }

  function showStatus(message, type) {
    setStatusText(message, type);
  }

  function localizedText(key, fallback) {
    if (!key || !i18nApi?.getMessage) {
      return fallback || "";
    }
    return i18nApi.getMessage(key) || fallback || "";
  }

  function cleanText(value) {
    return String(value || "").replace(/\u0000/g, "").trim();
  }

  // Domaines de connexion OpenAI/ChatGPT acceptés pour le flux OAuth de Codex.
  const TRUSTED_SIGN_IN_HOSTS = new Set([
    "auth.openai.com",
    "auth0.openai.com",
    "platform.openai.com",
    "chatgpt.com",
    "chat.openai.com",
    "openai.com"
  ]);

  function isTrustedSignInUrl(value) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch (error) {
      return false;
    }
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return TRUSTED_SIGN_IN_HOSTS.has(host) || host.endsWith(".openai.com");
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
