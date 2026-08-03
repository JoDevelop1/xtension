(() => {
  "use strict";

  const extensionApi = globalThis.chrome || globalThis.browser;
  const runtimeApi = extensionApi?.runtime;
  const i18nApi = extensionApi?.i18n;
  const storageApi = extensionApi?.storage?.local;

  const REPLY_AI_CONFIG_VERSION = 18;
  const DEFAULT_CODEX_BRIDGE_URL = "http://127.0.0.1:47623";
  const DEFAULT_CODEX_MODEL = "gpt-5.6-luna";
  const DEFAULT_CODEX_REASONING_EFFORT = "max";
  const CODEX_REASONING_ORDER = ["low", "medium", "high", "xhigh", "max", "ultra"];
  const FALLBACK_CODEX_MODELS = [
    { model: "gpt-5.6-sol", displayName: "GPT-5.6 Sol", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"] },
    { model: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"] },
    { model: "gpt-5.6-luna", displayName: "GPT-5.6 Luna", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"] }
  ];
  const DEFAULT_REPLY_LANGUAGE_MODE = "tweet";
  const DEFAULT_GENERATE_PROMPT = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise, about 1 to 3 sentences, unless the instruction asks for more.";

  const DEFAULT_CONFIG = {
    configVersion: REPLY_AI_CONFIG_VERSION,
    enabled: true,
    codexBridgeUrl: DEFAULT_CODEX_BRIDGE_URL,
    bridgeToken: "",
    codexModel: DEFAULT_CODEX_MODEL,
    codexReasoningEffort: DEFAULT_CODEX_REASONING_EFFORT,
    replyLanguageMode: DEFAULT_REPLY_LANGUAGE_MODE,
    generatePrompt: DEFAULT_GENERATE_PROMPT
  };

  const form = document.querySelector("#reply-ai-form");
  const enabledInput = document.querySelector("#reply-ai-enabled");
  const codexBridgeUrlInput = document.querySelector("#reply-ai-codex-bridge-url");
  const bridgeTokenInput = document.querySelector("#reply-ai-bridge-token");
  const replyLanguageModeInput = document.querySelector("#reply-ai-language-mode");
  const generatePromptInput = document.querySelector("#reply-ai-generate-prompt");
  const statusElement = document.querySelector("#reply-ai-status");
  const engineStatusElement = document.querySelector("#reply-ai-engine-status");
  const accountStatusElement = document.querySelector("#reply-ai-account-status");
  const connectionCard = document.querySelector("#reply-ai-connection-card");
  const connectionBadge = document.querySelector("#reply-ai-connection-badge");
  const codexModelInput = document.querySelector("#reply-ai-codex-model");
  const codexModelStatus = document.querySelector("#reply-ai-codex-model-status");
  const codexReasoningInput = document.querySelector("#reply-ai-codex-reasoning");
  const testButton = document.querySelector("#reply-ai-test");
  const loginButton = document.querySelector("#reply-ai-login");
  const logoutButton = document.querySelector("#reply-ai-logout");
  const installConnectorLink = document.querySelector("#reply-ai-install-connector");
  const logsRefreshButton = document.querySelector("#reply-ai-logs-refresh");
  const logsClearButton = document.querySelector("#reply-ai-logs-clear");
  const logsOutput = document.querySelector("#reply-ai-logs-output");
  const tabButtons = Array.from(document.querySelectorAll(".options-tab"));
  const tabPanels = Array.from(document.querySelectorAll(".settings-tab-panel"));
  const statusBaseClass = statusElement?.className || "options-status";
  let modelCatalog = [...FALLBACK_CODEX_MODELS];

  document.addEventListener("DOMContentLoaded", start, { once: true });

  async function start() {
    localizePage();
    setupTabs();
    await loadConfig();
    await refreshCodexStatus();

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveConfig();
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

    codexModelInput?.addEventListener("change", () => {
      applyReasoningOptions(codexModelInput.value, codexReasoningInput?.value);
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
      enabledInput.checked = Boolean(config.enabled);
    }
    if (codexBridgeUrlInput) {
      codexBridgeUrlInput.value = config.codexBridgeUrl || DEFAULT_CODEX_BRIDGE_URL;
    }
    if (bridgeTokenInput) {
      bridgeTokenInput.value = config.bridgeToken || "";
    }
    if (codexModelInput) {
      codexModelInput.value = config.codexModel || DEFAULT_CODEX_MODEL;
    }
    applyReasoningOptions(config.codexModel, config.codexReasoningEffort);
    if (replyLanguageModeInput) {
      replyLanguageModeInput.value = config.replyLanguageMode || DEFAULT_REPLY_LANGUAGE_MODE;
    }
    if (generatePromptInput) {
      generatePromptInput.value = config.generatePrompt || DEFAULT_GENERATE_PROMPT;
    }
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
      loadDiagnosticLogs().catch((error) => renderDiagnosticLogsError(error));
    }
  }

  async function saveConfig() {
    await storageSet({ replyAiConfig: getFormConfig() });
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
        headers: buildBridgeAuthHeaders(config)
      });
      renderCodexStatus(data);
      await refreshCodexModels(config);
      renderCodexStatus(data);
      if (isCodexAuthenticated(data)) {
        showStatus(localizedText("optionsCodexConnected", "Connected to OpenAI Codex."), "success");
      } else {
        showStatus(localizedText("optionsCodexAccountRequired", "Connect your ChatGPT account to use OpenAI Codex."), "error");
      }
    } catch (error) {
      await refreshCodexStatus();
      showStatus(error?.message || localizedText("optionsCodexConnectionFailed", "The Codex connection failed."), "error");
    }
  }

  async function refreshCodexStatus() {
    const config = getFormConfig();
    try {
      const data = await fetchBridgeJson(`${getBridgeUrl(config)}/auth/status`, {
        method: "GET",
        headers: buildBridgeAuthHeaders(config)
      });
      renderCodexStatus(data);
      await refreshCodexModels(config);
      renderCodexStatus(data);
      return data;
    } catch (error) {
      setConnectionState("unavailable", localizedText("optionsCodexUnavailableBadge", "Codex unavailable"));
      setEngineStatus(localizedText("optionsCodexConnectorMissing", "The Xtension Codex connector is not reachable."));
      setAccountStatus(localizedText("optionsCodexConnectorMissing", "The Xtension Codex connector is not reachable."));
      setLoginButtons({ authenticated: false, busy: false, available: false });
      populateModelSelect(FALLBACK_CODEX_MODELS, getSelectedModel());
      return null;
    }
  }

  function renderCodexStatus(data) {
    const codexInstalled = Boolean(data?.codex?.installed);
    const authenticated = isCodexAuthenticated(data);
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

    if (!authenticated) {
      setConnectionState("signed-out", localizedText("optionsCodexDisconnectedBadge", "Not connected"));
      setEngineStatus(localizedText("optionsCodexAccountRequired", "ChatGPT sign-in is required before using Codex."));
      setAccountStatus(localizedText("optionsCodexAccountRequired", "Connect your ChatGPT account to use OpenAI Codex."));
      setLoginButtons({ authenticated: false, busy: false, available: true });
      return;
    }

    const plan = cleanText(data?.auth?.planType || data?.planType || "");
    const planText = plan ? ` (${plan})` : "";
    setConnectionState("connected", localizedText("optionsCodexConnectedBadge", "Connected to ChatGPT"));
    setEngineStatus(`${localizedText("optionsCodexConnected", "Connected to OpenAI Codex.")} ${modelLabel}`);
    setAccountStatus(`${localizedText("optionsCodexAccountConnected", "ChatGPT account connected.")}${planText}`);
    setLoginButtons({ authenticated: true, busy: false, available: true });
  }

  function isCodexAuthenticated(data) {
    return Boolean(data?.auth?.authenticated ?? data?.authenticated);
  }

  async function refreshCodexModels(config = getFormConfig()) {
    try {
      const data = await fetchBridgeJson(`${getBridgeUrl(config)}/models`, {
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
      installConnectorLink.hidden = Boolean(available);
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
    try {
      response = await fetch(url, options);
    } catch {
      throw new Error(localizedText("optionsCodexConnectorMissing", "The Codex connector is not reachable."));
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error || `${localizedText("optionsCodexConnectionFailed", "The Codex connection failed.")} (${response.status})`);
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

    logsOutput.textContent = localizedText("optionsLogsLoading", "Loading logs...");
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
    if (logsOutput) {
      logsOutput.textContent = error?.message || localizedText("optionsLogsLoadFailed", "Unable to load logs.");
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
    return {
      configVersion: REPLY_AI_CONFIG_VERSION,
      // The former enable/disable toggle is no longer part of the compact
      // Codex page. Keep draft actions enabled for existing configurations.
      enabled: enabledInput ? Boolean(enabledInput.checked) : true,
      codexBridgeUrl: normalizeCodexBridgeUrl(codexBridgeUrlInput?.value) || DEFAULT_CODEX_BRIDGE_URL,
      bridgeToken: cleanText(bridgeTokenInput?.value || ""),
      codexModel: normalizeCodexModel(codexModelInput?.value || DEFAULT_CODEX_MODEL),
      codexReasoningEffort: normalizeReasoningEffort(codexReasoningInput?.value || DEFAULT_CODEX_REASONING_EFFORT),
      replyLanguageMode: normalizeReplyLanguageMode(replyLanguageModeInput?.value),
      generatePrompt: cleanText(generatePromptInput?.value || DEFAULT_GENERATE_PROMPT) || DEFAULT_GENERATE_PROMPT
    };
  }

  function normalizeReplyAiConfig(config) {
    const rawConfig = config && typeof config === "object" ? config : {};
    const normalized = { ...DEFAULT_CONFIG, ...rawConfig };
    normalized.configVersion = REPLY_AI_CONFIG_VERSION;
    // AI draft actions are now part of the always-on Codex surface; there is
    // intentionally no second enable switch in the options page.
    normalized.enabled = true;
    normalized.codexBridgeUrl = normalizeCodexBridgeUrl(normalized.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
    normalized.bridgeToken = cleanText(normalized.bridgeToken || "");
    normalized.codexModel = normalizeCodexModel(normalized.codexModel || DEFAULT_CODEX_MODEL);
    normalized.codexReasoningEffort = normalizeReasoningEffort(normalized.codexReasoningEffort || DEFAULT_CODEX_REASONING_EFFORT);
    normalized.replyLanguageMode = normalizeReplyLanguageMode(normalized.replyLanguageMode);
    normalized.generatePrompt = cleanText(normalized.generatePrompt || DEFAULT_GENERATE_PROMPT) || DEFAULT_GENERATE_PROMPT;

    // Remove settings from the former local/provider architecture, including
    // API-key fields users may have stored in an earlier development build.
    [
      "provider", "codexModelPreset", "prompt", "replyPromptProfiles",
      "replyCount", "replyStyle", "baseUrl", "model", "apiKey", "gpu"
    ].forEach((key) => delete normalized[key]);
    return normalized;
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

  function normalizeReplyLanguageMode(value) {
    return cleanText(value).toLowerCase() === "ui" ? "ui" : DEFAULT_REPLY_LANGUAGE_MODE;
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

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
