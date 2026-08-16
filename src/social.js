(() => {
  "use strict";

  const EXTENSION_API = globalThis.chrome || globalThis.browser;
  const RUNTIME_API = EXTENSION_API?.runtime;
  const I18N_API = EXTENSION_API?.i18n;
  const STORAGE_API = EXTENSION_API?.storage?.local;
  const HOST_SELECTOR = "[data-xtension-social-host]";
  const PANEL_SELECTOR = "[data-xtension-social-panel]";
  const ACTION_ATTRIBUTE = "data-xtension-social-action";
  const MAX_CONTEXT_LENGTH = 12000;
  const TRUSTED_INTERACTION_WINDOW_MS = 2200;
  const actionRegistry = new WeakMap();

  const PLATFORM_DEFINITIONS = [
    {
      id: "reddit",
      name: "Reddit",
      hostname: /(^|\.)reddit\.com$/i,
      excludedPath: /^\/(?:message|settings)(?:\/|$)/i,
      editorSelector: [
        "shreddit-composer [contenteditable='true']",
        "textarea[name='comment']",
        "textarea[placeholder*='comment' i]",
        "[role='textbox'][contenteditable='true']"
      ].join(","),
      postSelector: "shreddit-comment, shreddit-post, [data-testid='comment'], [data-testid='post-container'], .Comment, .Post",
      textSelector: "[slot='title'], [slot='text-body'], [data-testid='post-content'], [data-testid='comment'], [id*='comment-rtjson-content'], .RichTextJSON-root",
      authorSelector: "[slot='authorName'], [data-testid='post_author_link'], a[href*='/user/'], a.author"
    },
    {
      id: "facebook",
      name: "Facebook",
      hostname: /(^|\.)facebook\.com$/i,
      excludedPath: /^\/(?:messages|settings)(?:\/|$)/i,
      editorSelector: "[role='textbox'][contenteditable='true']",
      postSelector: "[role='article']",
      textSelector: "[data-ad-preview='message'], [data-ad-comet-preview='message'], [dir='auto']",
      authorSelector: "h2 a[href], h3 a[href], strong a[href]"
    },
    {
      id: "instagram",
      name: "Instagram",
      hostname: /(^|\.)instagram\.com$/i,
      excludedPath: /^\/direct(?:\/|$)/i,
      editorSelector: "textarea[placeholder], [role='textbox'][contenteditable='true']",
      postSelector: "article",
      textSelector: "h1, ul li span[dir='auto'], div[dir='auto']",
      authorSelector: "header a[href], a[href^='/'][role='link']"
    },
    {
      id: "threads",
      name: "Threads",
      hostname: /(^|\.)(?:threads\.net|threads\.com)$/i,
      excludedPath: /^\/(?:settings)(?:\/|$)/i,
      editorSelector: "textarea, [role='textbox'][contenteditable='true']",
      postSelector: "[role='article'], [data-pressable-container='true']",
      textSelector: "[dir='auto'], [lang]",
      authorSelector: "a[href^='/@'], a[href^='/']"
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      hostname: /(^|\.)linkedin\.com$/i,
      excludedPath: /^\/messaging(?:\/|$)/i,
      editorSelector: ".comments-comment-box-comment__text-editor [contenteditable='true'], [role='textbox'][contenteditable='true']",
      postSelector: ".comments-comment-entity, .feed-shared-update-v2, [data-urn*='activity'], article",
      textSelector: ".feed-shared-update-v2__description, .update-components-text, .comments-comment-item__main-content",
      authorSelector: ".update-components-actor__name, .comments-post-meta__name-text, a[href*='/in/']"
    },
    {
      id: "bluesky",
      name: "Bluesky",
      hostname: /(^|\.)bsky\.app$/i,
      excludedPath: /^\/(?:messages|settings)(?:\/|$)/i,
      editorSelector: "textarea, [role='textbox'][contenteditable='true']",
      postSelector: "[data-testid^='feedItem-by-'], [data-testid*='postThreadItem'], [role='article']",
      textSelector: "[data-testid='postText'], [lang], [dir='auto']",
      authorSelector: "[data-testid='userAvatarImage'] + *, a[href^='/profile/']"
    },
    {
      id: "youtube",
      name: "YouTube",
      hostname: /(^|\.)youtube\.com$/i,
      excludedPath: /^\/(?:feed|account)(?:\/|$)/i,
      editorSelector: "#contenteditable-root[contenteditable='true'], textarea, [role='textbox'][contenteditable='true']",
      postSelector: "ytd-comment-thread-renderer, ytd-comment-view-model, ytd-backstage-post-thread-renderer",
      textSelector: "#content-text, #content, yt-attributed-string",
      authorSelector: "#author-text, #author-comment-badge a"
    }
  ];

  const platform = resolvePlatform();
  let pageObserver = null;
  let enhancementQueued = false;
  let lastTrustedInteractionAt = 0;
  let lastTrustedInteractionTarget = null;
  let nativeTypeUnavailable = false;

  if (!platform || platform.excludedPath?.test(window.location.pathname)) {
    return;
  }

  start();

  function resolvePlatform() {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const testPlatform = /^(?:localhost|127\.0\.0\.1)$/.test(hostname)
      ? document.documentElement?.getAttribute?.("data-xtension-test-platform")
      : "";
    return PLATFORM_DEFINITIONS.find((definition) => definition.id === testPlatform || definition.hostname.test(hostname)) || null;
  }

  function start() {
    document.addEventListener("pointerdown", rememberTrustedInteraction, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("input", scheduleEnhancement, true);
    enhancePage();

    pageObserver = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target?.closest?.(`${HOST_SELECTOR}, ${PANEL_SELECTOR}`))) {
        return;
      }
      scheduleEnhancement();
    });
    pageObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  function rememberTrustedInteraction(event) {
    if (event.isTrusted) {
      lastTrustedInteractionAt = Date.now();
      lastTrustedInteractionTarget = event.target instanceof Element ? event.target : null;
    }
  }

  function handleFocusIn(event) {
    scheduleEnhancement();
    const editor = findEligibleEditor(event.target);
    if (!editor || Date.now() - lastTrustedInteractionAt > TRUSTED_INTERACTION_WINDOW_MS) {
      return;
    }
    const contextPost = findContextPost(editor);
    const interactionMatchesComposer = lastTrustedInteractionTarget === editor
      || Boolean(editor.contains(lastTrustedInteractionTarget))
      || Boolean(contextPost?.contains?.(lastTrustedInteractionTarget));
    if (!interactionMatchesComposer) {
      return;
    }
    window.setTimeout(async () => {
      if (document.activeElement !== editor || readEditorText(editor)) {
        return;
      }
      if (!(await isAiProcessingEnabled())) {
        return;
      }
      const hidden = await readStorageValue("replySuggestionsHidden");
      if (!hidden && !editor._xtensionSocialAutoRequested) {
        editor._xtensionSocialAutoRequested = true;
        showSuggestions(editor).catch((error) => showToast(error?.message || localize("socialReplyGenerationFailed", "Unable to generate replies."), "error"));
      }
    }, 450);
  }

  function scheduleEnhancement() {
    if (enhancementQueued) return;
    enhancementQueued = true;
    requestAnimationFrame(() => {
      enhancementQueued = false;
      enhancePage();
    });
  }

  function enhancePage() {
    if (platform.excludedPath?.test(window.location.pathname)) {
      cleanup();
      return;
    }

    document.querySelectorAll(platform.editorSelector).forEach((candidate) => {
      const editor = findEligibleEditor(candidate);
      if (!editor || findHostForEditor(editor)) {
        return;
      }
      mountToolbar(editor);
    });

    document.querySelectorAll(HOST_SELECTOR).forEach((host) => {
      if (!host._xtensionEditor?.isConnected || !isEligibleEditor(host._xtensionEditor)) {
        host.remove();
      }
    });
  }

  function findHostForEditor(editor) {
    return Array.from(document.querySelectorAll(HOST_SELECTOR)).find((host) => host._xtensionEditor === editor) || null;
  }

  function findEligibleEditor(value) {
    if (!(value instanceof Element)) return null;
    const editor = value.matches(platform.editorSelector) ? value : value.closest(platform.editorSelector);
    return isEligibleEditor(editor) ? editor : null;
  }

  function isEligibleEditor(editor) {
    if (!(editor instanceof HTMLElement) || !isVisible(editor) || editor.closest(HOST_SELECTOR)) {
      return false;
    }
    if (!editor.matches("textarea, input, [contenteditable='true'], [role='textbox']")) {
      return false;
    }
    const marker = cleanText([
      editor.getAttribute("aria-label"),
      editor.getAttribute("placeholder"),
      editor.getAttribute("data-placeholder"),
      editor.getAttribute("name")
    ].filter(Boolean).join(" ")).toLowerCase();
    const replyMarker = /comment|reply|respond|answer|répond|repond|commentaire|respuesta|antwort|kommentar|返信|コメント/i.test(marker);
    return replyMarker || Boolean(editor.closest(platform.postSelector));
  }

  function isVisible(element) {
    if (!element?.isConnected) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 2 && rect.height > 2;
  }

  function mountToolbar(editor) {
    const host = document.createElement("div");
    host.setAttribute("data-xtension-social-host", platform.id);
    host._xtensionEditor = editor;

    const actions = [
      { id: "correct", label: localize("correctionButtonLabel", "Correction"), icon: "✓" },
      { id: "translate", label: localize("translationButtonLabel", "Translate"), icon: "文" },
      { id: "generate", label: localize("generateButtonLabel", "Generate"), icon: "✦" },
      { id: "suggestions", label: localize("suggestionsButtonLabel", "Suggested replies"), icon: "✨" }
    ];
    actions.forEach((action) => host.append(createActionButton(editor, action)));

    const placement = findToolbarPlacement(editor);
    placement.parent.insertBefore(host, placement.before);
    warmupBridge();
  }

  function findToolbarPlacement(editor) {
    const wrapper = editor.closest("form") || editor.parentElement;
    const parent = wrapper?.parentElement || editor.parentElement || document.body;
    return { parent, before: wrapper?.nextSibling || null };
  }

  function createActionButton(editor, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(ACTION_ATTRIBUTE, action.id);
    button.setAttribute("aria-label", action.label);
    button.title = action.label;
    button.textContent = `${action.icon} ${action.label}`;
    actionRegistry.set(button, { editor, action: action.id });
    button.addEventListener("pointerdown", stopPageEvent, true);
    button.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      stopPageEvent(event);
      runAction(button).catch((error) => showToast(error?.message || localize("socialReplyGenerationFailed", "Unable to generate replies."), "error"));
    }, true);
    return button;
  }

  function stopPageEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  async function runAction(button) {
    const registered = actionRegistry.get(button);
    if (!registered || button.disabled) return;
    if (!(await isAiProcessingEnabled())) {
      sendRuntimeMessage({ type: "xtension-open-options" }).catch(() => {});
      const error = new Error(localize("replyAiConsentRequired", "Review and accept the AI data-processing disclosure in Xtension options first."));
      error.code = "consent_required";
      throw error;
    }
    if (registered.action === "suggestions" || (registered.action === "generate" && !readEditorText(registered.editor))) {
      await showSuggestions(registered.editor, { force: true });
      return;
    }
    await transformDraft(registered.editor, registered.action, button);
  }

  async function transformDraft(editor, action, button) {
    const text = readEditorText(editor);
    if (!text) {
      showToast(localize("socialReplyDraftRequired", "Write an instruction or a draft first."));
      return;
    }
    const messageTypes = {
      correct: "xtension-correct-reply-draft",
      translate: "xtension-translate-reply-draft",
      generate: "xtension-generate-reply-draft"
    };
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const originalLabel = button.textContent;
    button.textContent = localize("socialReplyWorking", "AI is writing...");
    try {
      const context = collectSocialContext(editor);
      const response = await sendRuntimeMessage({
        type: messageTypes[action],
        text,
        locale: getUiLocale(),
        targetLanguage: getUiLocale().split("-")[0],
        context
      });
      const result = response?.correctedText || response?.translatedText || response?.generatedText || "";
      if (!response?.ok || !cleanMultilineText(result)) {
        throw createResponseError(response);
      }
      if (!await insertEditorText(editor, result)) {
        throw new Error(localize("socialReplyInsertFailed", "The site did not accept the generated text."));
      }
      showToast(localize("socialReplyInserted", "Draft inserted. Review it before publishing."), "success");
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = originalLabel;
    }
  }

  async function showSuggestions(editor, options = {}) {
    const liveEditor = findEligibleEditor(editor) || editor;
    if (!liveEditor?.isConnected || liveEditor._xtensionSocialGenerating) return;
    if (options.force) {
      await writeStorageValue("replySuggestionsHidden", false);
    }
    liveEditor._xtensionSocialGenerating = true;
    const panel = createSuggestionsPanel(liveEditor);
    try {
      const context = collectSocialContext(liveEditor);
      if (!context.tweetText) {
        throw new Error(localize("socialReplyContextMissing", "No post was found next to this reply field."));
      }
      panel.querySelector("[data-xtension-social-status]").textContent = localize("replySuggestionsLoading", "Generating replies...");
      const profileResponse = await sendRuntimeMessage({ type: "xtension-get-reply-prompt-profiles" });
      if (!profileResponse?.ok || !Array.isArray(profileResponse.profiles)) {
        throw createResponseError(profileResponse);
      }
      const list = panel.querySelector("[data-xtension-social-list]");
      list.replaceChildren();
      const slots = profileResponse.profiles.map((profile) => createSuggestionSlot(list, profile));
      const tasks = profileResponse.profiles.map(async (profile, index) => {
        try {
          const response = await sendRuntimeMessage({
            type: "xtension-generate-reply-suggestion-profile",
            locale: getUiLocale(),
            context,
            profileIndex: profile.index ?? index
          });
          if (!response?.ok || !response.reply?.text) {
            throw createResponseError(response);
          }
          renderSuggestion(slots[index], liveEditor, response.reply);
          return true;
        } catch (error) {
          slots[index].classList.add("is-error");
          slots[index].textContent = error?.message || localize("socialReplyGenerationFailed", "Unable to generate this reply.");
          return false;
        }
      });
      const results = await Promise.all(tasks);
      panel.querySelector("[data-xtension-social-status]").textContent = results.some(Boolean)
        ? localize("socialReplyChoose", "Choose a reply to insert it. Nothing is published automatically.")
        : localize("socialReplyGenerationFailed", "Unable to generate replies.");
    } catch (error) {
      panel.querySelector("[data-xtension-social-status]").textContent = error?.message || localize("socialReplyGenerationFailed", "Unable to generate replies.");
      panel.classList.add("is-error");
    } finally {
      liveEditor._xtensionSocialGenerating = false;
    }
  }

  function createSuggestionsPanel(editor) {
    document.querySelectorAll(PANEL_SELECTOR).forEach((existing) => existing.remove());
    const panel = document.createElement("section");
    panel.setAttribute("data-xtension-social-panel", platform.id);
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", localize("replySuggestionsTitle", "Suggested replies"));
    panel._xtensionEditor = editor;

    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = `Xtension · ${platform.name}`;
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", localize("replySuggestionsClose", "Close suggested replies"));
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      panel.remove();
    });
    header.append(title, close);

    const status = document.createElement("p");
    status.setAttribute("data-xtension-social-status", "true");
    status.textContent = localize("replySuggestionsPreparing", "Reading the post...");
    const list = document.createElement("div");
    list.setAttribute("data-xtension-social-list", "true");
    panel.append(header, status, list);
    document.body.append(panel);
    return panel;
  }

  function createSuggestionSlot(list, profile) {
    const slot = document.createElement("div");
    slot.className = "xtension-social-suggestion is-loading";
    slot.textContent = `${profile.label || localize("replySuggestionsTitle", "Suggested reply")}…`;
    list.append(slot);
    return slot;
  }

  function renderSuggestion(slot, editor, reply) {
    slot.className = "xtension-social-suggestion";
    slot.replaceChildren();
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = cleanMultilineText(reply.text);
    actionRegistry.set(button, { editor, action: "insert", text: reply.text });
    button.addEventListener("click", async (event) => {
      if (!event.isTrusted) return;
      const registered = actionRegistry.get(button);
      if (!registered || button.disabled) return;
      button.disabled = true;
      try {
        if (!await insertEditorText(registered.editor, registered.text)) {
          throw new Error(localize("socialReplyInsertFailed", "The site did not accept the generated text."));
        }
        document.querySelector(PANEL_SELECTOR)?.remove();
        showToast(localize("socialReplyInserted", "Draft inserted. Review it before publishing."), "success");
      } catch (error) {
        showToast(error?.message || localize("socialReplyInsertFailed", "The site did not accept the generated text."), "error");
      } finally {
        button.disabled = false;
      }
    });
    slot.append(button);
    if (reply.translation) {
      const translation = document.createElement("small");
      translation.textContent = cleanMultilineText(reply.translation);
      slot.append(translation);
    }
  }

  function collectSocialContext(editor) {
    const post = findContextPost(editor);
    const text = collectPostText(post, editor);
    const authorElement = post?.querySelector?.(platform.authorSelector);
    const authorName = cleanText(authorElement?.textContent || "").slice(0, 160);
    const authorHandle = extractAuthorHandle(authorElement);
    const languageElement = Array.from(post?.querySelectorAll?.("[lang]") || []).find((element) => cleanText(element.textContent));
    const explicitLanguage = String(languageElement?.getAttribute("lang") || "").split(/[-_]/)[0].toLowerCase();
    return {
      platform: platform.id,
      platformName: platform.name,
      contentType: "social_post",
      authorName,
      authorHandle,
      sourceUrl: findPostUrl(post),
      tweetLanguage: explicitLanguage || "unknown",
      tweetLanguageSource: explicitLanguage ? "post_lang" : "unknown",
      tweetText: text,
      visibleUrls: collectVisibleUrls(post),
      toneSignals: [],
      mediaContext: []
    };
  }

  function findContextPost(editor) {
    return editor?.closest?.(platform.postSelector) || findNearestPost(editor);
  }

  function findNearestPost(editor) {
    const posts = Array.from(document.querySelectorAll(platform.postSelector)).filter(isVisible);
    if (!posts.length || !editor) return null;
    const editorRect = editor.getBoundingClientRect();
    return posts
      .map((post) => ({ post, rect: post.getBoundingClientRect() }))
      .filter(({ rect }) => rect.top <= editorRect.bottom + 80)
      .sort((left, right) => Math.abs(left.rect.bottom - editorRect.top) - Math.abs(right.rect.bottom - editorRect.top))[0]?.post || null;
  }

  function collectPostText(post, editor) {
    if (!post) return "";
    const targeted = Array.from(post.querySelectorAll(platform.textSelector))
      .filter((element) => !element.contains(editor) && !element.closest(`${HOST_SELECTOR}, ${PANEL_SELECTOR}`))
      .map((element) => cleanMultilineText(element.innerText || element.textContent || ""))
      .filter(Boolean);
    let text = targeted.join("\n\n");
    if (!text) {
      text = cleanMultilineText(post.innerText || post.textContent || "");
      const editorText = readEditorText(editor);
      if (editorText) text = text.replace(editorText, "");
    }
    return dedupeParagraphs(text).slice(0, MAX_CONTEXT_LENGTH);
  }

  function dedupeParagraphs(value) {
    const seen = new Set();
    return cleanMultilineText(value).split(/\n{2,}/).filter((part) => {
      const key = cleanText(part).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join("\n\n");
  }

  function extractAuthorHandle(element) {
    const href = element?.closest?.("a[href]")?.getAttribute("href") || element?.getAttribute?.("href") || "";
    const match = href.match(/(?:\/user\/|\/profile\/|\/@|\/in\/|^\/)([^/?#]+)/i);
    return String(match?.[1] || "").replace(/^@/, "").slice(0, 100);
  }

  function findPostUrl(post) {
    const anchors = Array.from(post?.querySelectorAll?.("a[href]") || []);
    const preferred = anchors.find((anchor) => /\/comments\/|\/status\/|\/posts?\/|\/feed\/update\/|\/profile\/[^/]+\/post\//i.test(anchor.getAttribute("href") || ""));
    try {
      return preferred ? new URL(preferred.getAttribute("href"), window.location.href).href : window.location.href;
    } catch (error) {
      return window.location.href;
    }
  }

  function collectVisibleUrls(post) {
    return Array.from(post?.querySelectorAll?.("a[href]") || [])
      .filter(isVisible)
      .map((anchor) => {
        try { return new URL(anchor.getAttribute("href"), window.location.href).href; } catch (error) { return ""; }
      })
      .filter((url, index, all) => url && all.indexOf(url) === index)
      .slice(0, 12);
  }

  async function insertEditorText(editor, value) {
    const text = cleanMultilineText(value);
    if (!text || !editor?.isConnected) return false;

    const nativeResult = await typeNatively(editor, text);
    if (nativeResult.available) {
      if (!nativeResult.ok) return false;
      return waitForInsertedText(editor, text, 1000);
    }

    editor.focus();
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      const prototype = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(editor, text);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      selectEditorContents(editor);
      document.execCommand?.("insertText", false, text);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    }
    await nextFrame();
    return editorTextMatches(editor, text);
  }

  async function typeNatively(editor, text) {
    if (nativeTypeUnavailable) return { available: false, ok: false };
    try {
      const capability = await sendRuntimeMessage({ type: "xtension-native-type-capability" });
      if (!capability?.available) {
        nativeTypeUnavailable = true;
        return { available: false, ok: false };
      }
      editor.focus();
      selectEditorContents(editor);
      await nextFrame();
      if (!document.hasFocus() || document.activeElement !== editor || !selectionBelongsToEditor(editor)) {
        return { available: true, ok: false };
      }
      const expectedBrowser = getBrowserName();
      const prepared = await sendRuntimeMessage({ type: "xtension-native-type-prepare", expectedBrowser });
      if (!prepared?.ok || !prepared.targetToken) {
        if (["native_type_unavailable", "native_type_unsupported", "not_found", "disabled"].includes(prepared?.code)) {
          nativeTypeUnavailable = true;
          return { available: false, ok: false };
        }
        return { available: true, ok: false };
      }
      const result = await sendRuntimeMessage({
        type: "xtension-native-type",
        text,
        replaceExisting: true,
        targetToken: prepared.targetToken,
        expectedBrowser
      });
      return { available: true, ok: Boolean(result?.ok) };
    } catch (error) {
      return { available: true, ok: false };
    }
  }

  function getBrowserName() {
    const agent = String(navigator.userAgent || "");
    if (/Edg\//i.test(agent)) return "edge";
    if (/Firefox\//i.test(agent)) return "firefox";
    return /Chrome\//i.test(agent) ? "chrome" : "";
  }

  function selectEditorContents(editor) {
    editor.focus();
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      editor.select();
      return;
    }
    const selection = window.getSelection?.();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges?.();
    selection?.addRange?.(range);
  }

  function selectionBelongsToEditor(editor) {
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      return typeof editor.selectionStart === "number" && editor.selectionStart === 0 && editor.selectionEnd === editor.value.length;
    }
    const selection = window.getSelection?.();
    return Boolean(selection?.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode));
  }

  async function waitForInsertedText(editor, text, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (editorTextMatches(editor, text)) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    return editorTextMatches(editor, text);
  }

  function editorTextMatches(editor, text) {
    const current = readEditorText(editor);
    return current === text || (current.includes(text) && current.length <= text.length + 2);
  }

  function readEditorText(editor) {
    return cleanMultilineText(editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement
      ? editor.value
      : editor?.innerText || editor?.textContent || "");
  }

  async function warmupBridge() {
    if (!(await isAiProcessingEnabled())) return;
    if (warmupBridge.lastAt && Date.now() - warmupBridge.lastAt < 5 * 60 * 1000) return;
    warmupBridge.lastAt = Date.now();
    sendRuntimeMessage({ type: "xtension-warmup-bridge" }).catch(() => {});
  }

  async function isAiProcessingEnabled() {
    const config = await readStorageValue("replyAiConfig");
    return config?.enabled === true && Number(config?.dataProcessingConsentVersion) === 1;
  }

  function cleanup() {
    document.querySelectorAll(`${HOST_SELECTOR}, ${PANEL_SELECTOR}`).forEach((node) => node.remove());
  }

  function showToast(message, tone = "info") {
    document.querySelector("[data-xtension-social-toast]")?.remove();
    const toast = document.createElement("div");
    toast.setAttribute("data-xtension-social-toast", tone);
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function createResponseError(response) {
    const error = new Error(response?.error || localize("socialReplyGenerationFailed", "Unable to generate replies."));
    error.code = response?.code || "generation_failed";
    if (["bridge_unreachable", "bridge_update_required", "not_configured", "consent_required", "codex_login_required"].includes(error.code)) {
      const configure = window.confirm(`${error.message}\n\n${localize("socialReplyOpenSettings", "Open Xtension settings?")}`);
      if (configure) sendRuntimeMessage({ type: "xtension-open-options" }).catch(() => {});
    }
    return error;
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (!RUNTIME_API?.sendMessage) {
        reject(new Error(localize("optionsRuntimeUnavailable", "Extension runtime is unavailable.")));
        return;
      }
      try {
        if (!globalThis.chrome && globalThis.browser) {
          RUNTIME_API.sendMessage(message).then(resolve, reject);
          return;
        }
        RUNTIME_API.sendMessage(message, (response) => {
          if (RUNTIME_API.lastError) reject(new Error(RUNTIME_API.lastError.message));
          else resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function readStorageValue(key) {
    return new Promise((resolve) => {
      if (!STORAGE_API?.get) return resolve(undefined);
      try {
        const maybePromise = STORAGE_API.get(key, (result) => resolve(result?.[key]));
        if (maybePromise?.then) maybePromise.then((result) => resolve(result?.[key]), () => resolve(undefined));
      } catch (error) {
        resolve(undefined);
      }
    });
  }

  function writeStorageValue(key, value) {
    return new Promise((resolve) => {
      if (!STORAGE_API?.set) return resolve();
      try {
        const maybePromise = STORAGE_API.set({ [key]: value }, resolve);
        if (maybePromise?.then) maybePromise.then(resolve, resolve);
      } catch (error) {
        resolve();
      }
    });
  }

  function localize(key, fallback) {
    try { return I18N_API?.getMessage?.(key) || fallback || key; } catch (error) { return fallback || key; }
  }

  function getUiLocale() {
    try { return I18N_API?.getUILanguage?.() || navigator.language || "en"; } catch (error) { return navigator.language || "en"; }
  }

  function cleanText(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function cleanMultilineText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n[ \t\f\v]+|[ \t\f\v]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }
})();
