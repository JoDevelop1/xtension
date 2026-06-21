(() => {
  "use strict";

  const EXTENSION_API = globalThis.chrome || globalThis.browser;
  const RUNTIME_API = EXTENSION_API?.runtime;
  const I18N_API = EXTENSION_API?.i18n;
  const EXTENSION_VERSION = getExtensionVersion();
  const PDF_GENERATOR_NAME = `Xtension ${EXTENSION_VERSION} by JoDevelop`;
  const MENU_ITEM_SELECTOR = "[data-xtension-menu-item]";
  const MENU_ITEM_ATTRIBUTE = "data-xtension-menu-item";
  const MENU_ICON_ATTRIBUTE = "data-xtension-menu-icon";
  const MENU_LABEL = localizedText("menuDownloadPdf", "Download as PDF");
  const PDF_MENU_ICON_PATH = "pdf-menu-icon.png";
  const REPLY_BUTTON_SELECTOR = "[data-xtension-reply-button]";
  const REPLY_BUTTON_ATTRIBUTE = "data-xtension-reply-button";
  const DRAFT_ACTIONS_SELECTOR = "[data-xtension-draft-actions]";
  const DRAFT_ACTIONS_ATTRIBUTE = "data-xtension-draft-actions";
  const DRAFT_ACTIONS_HOST_SELECTOR = "[data-xtension-draft-actions-host]";
  const DRAFT_ACTIONS_HOST_ATTRIBUTE = "data-xtension-draft-actions-host";
  const DRAFT_ACTIONS_HOST_VERSION = "composer-submit-cleanup-v2";
  const CONTENT_BUILD_ATTRIBUTE = "data-xtension-content-build";
  const DRAFT_ACTION_BUTTON_ATTRIBUTE = "data-xtension-draft-action-button";
  const DRAFT_GENERATION_LANGUAGE_STORAGE_KEY = "draftGenerationLanguage";
  const DRAFT_ACTION_TIMINGS_STORAGE_KEY = "draftActionTimings";
  const REPLY_SUGGESTIONS_PANEL_SELECTOR = "[data-xtension-reply-suggestions]";
  const REPLY_SUGGESTIONS_PANEL_ATTRIBUTE = "data-xtension-reply-suggestions";
  const X_LAYERS_ID = "layers";
  const X_REACT_ROOT_ID = "react-root";
  const XTENSION_OVERLAY_ROOT_ATTRIBUTE = "data-xtension-overlay-root";
  const PROHIBITED_REPLY_SYMBOL_PATTERN = /\u2014/g;
  const COMPOSER_SUBMIT_SUPPRESSION_MS = 12000;
  const DEFAULT_DRAFT_ACTION_DURATION_MS = {
    correct: 12000,
    translate: 14000,
    generate: 18000
  };
  const DRAFT_ACTION_ICON_SVGS = {
    correct: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    translate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h9M8.5 3v2M11.5 5c-.7 2.7-2.6 5.2-5.5 7.2M6.5 8.2c1 1.4 2.2 2.5 3.8 3.4M14 19l3.2-8 3.3 8M15.1 16.4h4.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    generate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 13.8 8l5.2 1.8-5.2 1.8L12 16.8l-1.8-5.2L5 9.8 10.2 8 12 2.8ZM5.5 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4ZM18 15l.7 1.8 1.8.7-1.8.7L18 20l-.7-1.8-1.8-.7 1.8-.7L18 15Z" fill="currentColor"/></svg>',
    suggestions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14M5 12h10M5 17.5h7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18 15.5 19.2 18l2.3 1-2.3 1-1.2 2.5-1.2-2.5-2.3-1 2.3-1 1.2-2.5Z" fill="currentColor"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7H4v4M4.6 10.4A8 8 0 1 0 7.4 5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const DRAFT_GENERATION_LANGUAGES = [
    { id: "auto", iconPath: "flags/auto.svg", code: "AUTO", nativeName: "Auto", labelKey: "draftLanguageAuto", fallback: "Auto" },
    { id: "fr", iconPath: "flags/fr.svg", code: "FR", nativeName: "Français", labelKey: "draftLanguageFrench", fallback: "French" },
    { id: "en", iconPath: "flags/gb.svg", code: "EN", nativeName: "English", labelKey: "draftLanguageEnglish", fallback: "English" },
    { id: "es", iconPath: "flags/es.svg", code: "ES", nativeName: "Español", labelKey: "draftLanguageSpanish", fallback: "Spanish" },
    { id: "de", iconPath: "flags/de.svg", code: "DE", nativeName: "Deutsch", labelKey: "draftLanguageGerman", fallback: "German" },
    { id: "ja", iconPath: "flags/jp.svg", code: "JA", nativeName: "日本語", labelKey: "draftLanguageJapanese", fallback: "Japanese" }
  ];
  const REPLY_EDITOR_SELECTOR = [
    '[data-testid="tweetTextarea_0"][contenteditable="true"]',
    '[data-testid="tweetTextarea_1"][contenteditable="true"]',
    '[data-testid^="tweetTextarea_"][contenteditable="true"]',
    '[data-testid^="tweetTextarea_"][role="textbox"]',
    '[data-testid^="tweetTextarea_"] [contenteditable="true"]',
    '[data-testid^="tweetTextarea_"] [role="textbox"]',
    'div[role="textbox"][contenteditable="true"]'
  ].join(", ");
  const LONGFORM_SELECTOR = [
    ".longform-header-one",
    ".longform-header-one-narrow",
    ".longform-header-two",
    ".longform-header-two-narrow",
    ".longform-unstyled",
    ".longform-unstyled-narrow",
    ".longform-blockquote",
    ".longform-blockquote-narrow",
    ".longform-unordered-list-item",
    ".longform-unordered-list-item-narrow",
    ".longform-ordered-list-item",
    ".longform-ordered-list-item-narrow"
  ].join(", ");
  const MEDIA_SELECTOR = [
    'img[src*="pbs.twimg.com/media"]',
    'img[src*="twimg.com/media"]',
    'img[src*="pbs.twimg.com/ext_tw_video_thumb"]',
    'img[src*="twimg.com/ext_tw_video_thumb"]',
    'img[src*="pbs.twimg.com/amplify_video_thumb"]',
    'img[src*="twimg.com/amplify_video_thumb"]',
    'img[src*="/media/"]',
    'video[poster*="pbs.twimg.com/media"]',
    'video[poster*="twimg.com/media"]',
    'video[poster*="twimg.com/ext_tw_video_thumb"]',
    'video[poster*="twimg.com/amplify_video_thumb"]',
    'video[poster*="/media/"]',
    'div[style*="twimg.com/media"]',
    'div[style*="twimg.com/ext_tw_video_thumb"]',
    'div[style*="twimg.com/amplify_video_thumb"]'
  ].join(", ");
  const LINK_CARD_SELECTOR = '[data-testid="card.wrapper"]';
  const LINK_CARD_IMAGE_SELECTOR = [
    'img[src*="pbs.twimg.com/card_img"]',
    'img[src*="twimg.com/card_img"]',
    'img[src*="/card_img/"]',
    'div[style*="pbs.twimg.com/card_img"]',
    'div[style*="twimg.com/card_img"]',
    'div[style*="/card_img/"]',
    '[data-testid*="card.layout"][data-testid*=".media"] img',
    '[data-testid*="card.layout"][data-testid*=".media"] div[style*="url("]'
  ].join(", ");
  const EMBEDDED_TWEET_SELECTOR = [
    '[data-testid="quotedTweet"]',
    LINK_CARD_SELECTOR,
    'article[data-testid="tweet"]',
    '[role="link"]'
  ].join(", ");
  const PROFILE_IMAGE_SELECTOR = 'img[src*="/profile_images/"], img[src*="profile_images"]';
  const STATUS_PATH_PATTERN = /^\/([^/?#]+)\/status\/(\d+)/;
  const PDF_HELVETICA_WIDTH_FALLBACK = 556;
  const PDF_HELVETICA_WIDTHS = createPdfHelveticaWidthMap();
  const PDF_HELVETICA_BOLD_WIDTHS = createPdfHelveticaBoldWidthMap();
  const PDF_WIN_ANSI_REPLACEMENTS = new Map([
    [0x0152, 140],
    [0x0153, 156],
    [0x0160, 138],
    [0x0161, 154],
    [0x0178, 159],
    [0x017D, 142],
    [0x017E, 158],
    [0x0192, 131],
    [0x02C6, 136],
    [0x02DC, 152],
    [0x2013, 45],
    [0x2014, 45],
    [0x2018, 39],
    [0x2019, 39],
    [0x201A, 130],
    [0x201C, 34],
    [0x201D, 34],
    [0x201E, 132],
    [0x2020, 134],
    [0x2021, 135],
    [0x2022, 45],
    [0x2026, 133],
    [0x2030, 137],
    [0x2039, 139],
    [0x203A, 155],
    [0x20AC, 128],
    [0x2122, 153]
  ]);

  let enhanceQueued = false;
  let lastMenuContext = null;
  let pageObserver = null;
  let extensionContextInvalidated = false;

  function start() {
    if (extensionContextInvalidated) {
      return;
    }

    document.documentElement?.setAttribute?.(CONTENT_BUILD_ATTRIBUTE, DRAFT_ACTIONS_HOST_VERSION);
    document.addEventListener("pointerdown", rememberMenuTriggerContext, true);
    document.addEventListener("click", rememberDraftComposerSubmit, true);
    document.addEventListener("keydown", rememberMenuTriggerContext, true);
    document.addEventListener("focusin", scheduleEnhancementUnlessNativeMediaControl, true);
    document.addEventListener("focusout", scheduleEnhancementUnlessNativeMediaControl, true);
    document.addEventListener("input", scheduleEnhancement, true);
    document.addEventListener("pointerup", handleDraftActionPointerUp, true);
    document.addEventListener("pointerup", scheduleEnhancementUnlessNativeMediaControl, true);
    enhancePage();

    pageObserver?.disconnect();
    pageObserver = new MutationObserver((mutations) => {
      if (extensionContextInvalidated || mutations.every(isXtensionOverlayMutation)) {
        return;
      }

      scheduleEnhancement();
    });
    pageObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleEnhancement() {
    if (extensionContextInvalidated || enhanceQueued) {
      return;
    }

    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      if (extensionContextInvalidated) {
        return;
      }

      enhancePage();
    });
  }

  function scheduleEnhancementUnlessNativeMediaControl(event) {
    if (isNativeComposerMediaControl(event?.target) || isNativeComposerMediaControl(event?.relatedTarget)) {
      return;
    }

    scheduleEnhancement();
  }

  function enhancePage() {
    if (extensionContextInvalidated) {
      return;
    }

    enhanceDropdowns();
    if (extensionContextInvalidated) {
      return;
    }

    enhanceReplyButtons();
    if (extensionContextInvalidated) {
      return;
    }

    enhanceCorrectionButtons();
  }

  function enhanceDropdowns() {
    document.querySelectorAll('[data-testid="Dropdown"]').forEach((dropdown) => {
      if (dropdown.querySelector(MENU_ITEM_SELECTOR)) {
        return;
      }

      const context = resolveStatusContext(dropdown);
      if (!context || !shouldOfferPdfExport(dropdown, context)) {
        return;
      }

      const menuItem = createMenuItem(dropdown, context);
      const insertionPoint = findInsertionPoint(dropdown);

      if (insertionPoint && insertionPoint.parentElement === dropdown) {
        insertionPoint.after(menuItem);
      } else {
        dropdown.append(menuItem);
      }
    });
  }

  function enhanceReplyButtons() {
    document.querySelectorAll('article[data-testid="tweet"] [data-testid="User-Name"]').forEach((userName) => {
      if (userName.querySelector(REPLY_BUTTON_SELECTOR)) {
        return;
      }

      const tweet = userName.closest('article[data-testid="tweet"]');
      if (!tweet) {
        return;
      }

      const host = findReplyButtonHost(userName);
      if (!host || host.querySelector(REPLY_BUTTON_SELECTOR)) {
        return;
      }

      host.setAttribute("data-xtension-reply-host", "true");
      markReplyMetadataLine(userName, host);
      host.append(createReplyButton(tweet));
    });
  }

  function enhanceCorrectionButtons() {
    cleanupMisplacedDraftActionBars();

    document.querySelectorAll(REPLY_EDITOR_SELECTOR).forEach((editor) => {
      if (!isVisibleElement(editor)) {
        return;
      }

      const composer = findReplyComposerContainer(editor);
      if (!composer) {
        return;
      }

      if (isComposerRecentlySubmitted(editor, composer)) {
        return;
      }

      if (shouldUseDedicatedDraftActionRow(editor, composer) && !isDraftActionComposerActive(editor, composer)) {
        return;
      }

      const host = findCorrectionButtonHost(editor, composer);
      if (!host || host.querySelector(DRAFT_ACTIONS_SELECTOR)) {
        maybeShowAutomaticReplySuggestions(editor, composer);
        return;
      }

      const actions = createDraftActionButtons(editor);
      if (extensionContextInvalidated) {
        return;
      }

      host.append(actions);
      maybeShowAutomaticReplySuggestions(editor, composer);
    });
  }

  function findCorrectionButtonHost(editor, existingComposer) {
    const composer = existingComposer || findReplyComposerContainer(editor);
    if (!composer) {
      return null;
    }

    const existingHost = findExistingDraftActionHost(editor, composer);
    const placement = findDraftActionHostPlacement(editor, composer);
    if (!placement) {
      return null;
    }

    if (existingHost) {
      existingHost._xtensionDraftComposer = composer;
      if (findEditableReplyEditor(editor)) {
        existingHost._xtensionDraftEditor = editor;
      }
      applyDraftActionHostPlacement(existingHost, placement);
      return existingHost;
    }

    const host = document.createElement("div");
    host.className = "xtension-draft-actions-host";
    host.setAttribute(DRAFT_ACTIONS_HOST_ATTRIBUTE, DRAFT_ACTIONS_HOST_VERSION);
    host._xtensionDraftEditor = editor;
    host._xtensionDraftComposer = composer;
    applyDraftActionHostPlacement(host, placement);
    return host;
  }

  function findExistingDraftActionHost(editor, composer) {
    return Array.from(document.querySelectorAll(DRAFT_ACTIONS_HOST_SELECTOR)).find((host) => {
      return host.getAttribute(DRAFT_ACTIONS_HOST_ATTRIBUTE) === DRAFT_ACTIONS_HOST_VERSION
        && (host._xtensionDraftEditor === editor || host._xtensionDraftComposer === composer || composer?.contains?.(host));
    }) || null;
  }

  function applyDraftActionHostPlacement(host, placement) {
    host.classList.toggle("is-permission-row", placement.kind === "permission");
    host.classList.toggle("is-permission-slot", placement.kind === "permission-slot");
    host.classList.toggle("is-action-row", placement.kind === "action");
    host.classList.toggle("is-dedicated-row", placement.kind === "dedicated");
    if (placement.kind === "permission-slot") {
      host.style.setProperty("--xtension-draft-slot-top", `${Math.max(0, Math.round(placement.top || 0))}px`);
    } else {
      host.style.removeProperty("--xtension-draft-slot-top");
    }

    const alreadyPlaced = host.parentElement === placement.parent
      && (placement.before ? host.nextSibling === placement.before : host.nextSibling === null);

    if (!alreadyPlaced) {
      placement.parent.insertBefore(host, placement.before || null);
    }
  }

  function cleanupMisplacedDraftActionBars() {
    cleanupOrphanDraftLanguageMenus();

    document.querySelectorAll(`${DRAFT_ACTIONS_HOST_SELECTOR}, .xtension-draft-actions-host`).forEach((host) => {
      if (host.getAttribute(DRAFT_ACTIONS_HOST_ATTRIBUTE) !== DRAFT_ACTIONS_HOST_VERSION) {
        removeDraftActionHost(host);
        return;
      }

      const editor = host._xtensionDraftEditor;
      if (!editor?.isConnected || !isVisibleElement(editor)) {
        removeDraftActionHost(host);
        return;
      }

      const composer = host._xtensionDraftComposer || findReplyComposerContainer(editor);
      if (!composer?.isConnected || !isVisibleElement(composer)) {
        removeDraftActionHost(host);
        return;
      }

      if (isComposerRecentlySubmitted(editor, composer)) {
        removeDraftActionHost(host);
        return;
      }

      if (!host._xtensionDraftActionBusy && !isDraftActionComposerActive(editor, composer)) {
        removeDraftActionHost(host);
      }
    });

    document.querySelectorAll(DRAFT_ACTIONS_SELECTOR).forEach((bar) => {
      const host = bar.closest(DRAFT_ACTIONS_HOST_SELECTOR);
      if (!host || host.getAttribute(DRAFT_ACTIONS_HOST_ATTRIBUTE) !== DRAFT_ACTIONS_HOST_VERSION) {
        bar.remove();
      }
    });
  }

  function removeDraftActionHost(host) {
    host?.querySelectorAll?.(".xtension-draft-language-picker").forEach(removeDraftLanguageMenuForPicker);
    host?.remove?.();
  }

  function cleanupOrphanDraftLanguageMenus() {
    document.querySelectorAll(".xtension-draft-language-menu").forEach((menu) => {
      const picker = menu._xtensionDraftLanguagePicker;
      if (!picker?.isConnected) {
        menu.remove();
      }
    });
  }

  function findDraftActionHostPlacement(editor, composer) {
    if (shouldUseDedicatedDraftActionRow(editor, composer)) {
      return findDraftActionDedicatedPlacement(editor, composer);
    }

    const permissionButton = findComposerReplyPermissionButton(editor, composer);
    if (permissionButton) {
      const permissionRow = findComposerPermissionRow(permissionButton, composer);
      if (permissionRow) {
        if (isPaintedElement(permissionRow)) {
          return {
            kind: "permission",
            parent: permissionRow,
            before: null
          };
        }

        const permissionSlot = findComposerHiddenPermissionSlot(permissionRow, composer);
        if (permissionSlot) {
          const rowRect = permissionRow.getBoundingClientRect();
          const slotRect = permissionSlot.getBoundingClientRect();
          return {
            kind: "permission-slot",
            parent: permissionSlot,
            before: null,
            top: rowRect.top - slotRect.top + 4
          };
        }
      }
    }

    return findDraftActionRowPlacement(composer)
      || findDraftActionDedicatedPlacement(editor, composer);
  }

  function shouldUseDedicatedDraftActionRow(editor, composer) {
    const submitButton = findComposerSubmitButton(composer);
    const submitLabel = cleanText(`${submitButton?.getAttribute?.("aria-label") || ""} ${submitButton?.textContent || ""}`).toLowerCase();
    const composerText = cleanText(composer?.textContent || "").toLowerCase();
    const editorRoot = editor.closest?.('[data-testid^="tweetTextarea_"]') || editor;
    const editorLabel = cleanText(`${editorRoot?.getAttribute?.("aria-label") || ""} ${editorRoot?.textContent || ""}`).toLowerCase();

    return /\breply\b|répond|repond|antwort|respuesta|返信/.test(submitLabel)
      || /\breplying to\b|répondre à|repondre a|en réponse à|en reponse a/.test(composerText)
      || /\bpost your reply\b|publier votre réponse|publier votre reponse|réponse|reponse/.test(editorLabel);
  }

  function findDraftActionDedicatedPlacement(editor, composer) {
    const editorBlock = findComposerEditorBlock(editor, composer);
    if (
      editorBlock?.parentElement &&
      composer.contains(editorBlock.parentElement) &&
      !isInsideReplyTextArea(editorBlock, editor)
    ) {
      return {
        kind: "dedicated",
        parent: editorBlock.parentElement,
        before: editorBlock.nextSibling
      };
    }

    const actionRow = findComposerActionRow(composer);
    if (actionRow?.parentElement && composer.contains(actionRow.parentElement)) {
      return {
        kind: "dedicated",
        parent: actionRow.parentElement,
        before: actionRow
      };
    }

    return null;
  }

  function findDraftActionRowPlacement(composer) {
    const actionRow = findComposerActionRow(composer);
    const submitButton = findComposerSubmitButton(composer);
    if (!actionRow || !submitButton || !composer.contains(actionRow)) {
      return null;
    }

    const submitContainer = findDirectChildContaining(actionRow, submitButton);
    return {
      kind: "action",
      parent: actionRow,
      before: submitContainer || submitButton
    };
  }

  function findDirectChildContaining(parent, descendant) {
    let current = descendant;
    while (current?.parentElement && current.parentElement !== parent) {
      current = current.parentElement;
    }
    return current?.parentElement === parent ? current : null;
  }

  function findComposerHiddenPermissionSlot(permissionRow, composer) {
    let current = permissionRow.parentElement;

    for (let depth = 0; current && current !== composer && depth < 6; depth += 1) {
      if (isPaintedElement(current)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  function isPaintedElement(element) {
    if (!isVisibleElement(element)) {
      return false;
    }

    let current = element;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
    }

    return true;
  }

  function isInsideReplyTextArea(element, editor) {
    const editorRoot = editor?.closest?.('[data-testid^="tweetTextarea_"]') || editor;
    return Boolean(
      element?.closest?.('[data-testid^="tweetTextarea_"], [role="textbox"]') ||
      (editorRoot && element !== editorRoot && editorRoot.contains(element))
    );
  }

  function isDraftActionComposerActive(editor, composer) {
    if (!editor?.isConnected || !composer?.isConnected) {
      return false;
    }

    const activeElement = document.activeElement;
    const editorRoot = editor.closest?.('[data-testid^="tweetTextarea_"]') || editor;
    const existingHost = findExistingDraftActionHost(editor, composer);

    if (existingHost?._xtensionDraftActionBusy) {
      return true;
    }

    if (getReplyEditorText(findEditableReplyEditor(editor) || editor)) {
      return true;
    }

    if (isReplySuggestionsPanelForEditor(editor)) {
      return true;
    }

    if (existingHost?.contains?.(activeElement)) {
      return true;
    }

    if (isNativeComposerMediaControl(activeElement)) {
      return true;
    }

    if (isDraftLanguageMenuActive(existingHost, activeElement)) {
      return true;
    }

    if (activeElement && (editor.contains(activeElement) || editorRoot?.contains?.(activeElement))) {
      return true;
    }

    return false;
  }

  function isDraftLanguageMenuActive(host, activeElement) {
    if (!host || !activeElement) {
      return false;
    }

    return Array.from(host.querySelectorAll(".xtension-draft-language-picker")).some((picker) => {
      return picker._xtensionDraftLanguageMenu?.contains?.(activeElement);
    });
  }

  function findComposerReplyPermissionButton(editor, composer) {
    const editorRoot = editor.closest('[data-testid^="tweetTextarea_"]') || editor;
    const toolbar = findComposerToolbar(composer);
    const candidates = Array.from(composer?.querySelectorAll?.('button[aria-label]') || []).filter(isVisibleElement);

    return candidates.find((button) => {
      if (button.matches?.('[data-testid="tweetButton"], [data-testid="tweetButtonInline"], [data-testid="reply"]')) {
        return false;
      }

      if (button.closest?.('[data-testid="toolBar"], article[data-testid="tweet"]')) {
        return false;
      }

      if (editorRoot && !isElementAfter(editorRoot, button)) {
        return false;
      }

      if (toolbar && !isElementBeforeOrSame(button, toolbar)) {
        return false;
      }

      const label = cleanText(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`).toLowerCase();
      return /\breply\b|répond|repond|respond|antwort|respuesta|返信/.test(label);
    }) || null;
  }

  function findComposerPermissionRow(permissionButton, composer) {
    const buttonRect = permissionButton.getBoundingClientRect();
    let current = permissionButton.parentElement;

    for (let depth = 0; current && current !== composer && depth < 8; depth += 1) {
      const rect = current.getBoundingClientRect();
      const style = getComputedStyle(current);
      const className = getClassName(current, "");
      const isHorizontalRow = (style.display === "flex" && style.flexDirection !== "column")
        || className.includes("r-18u37iz");
      const hasRoomForButtons = rect.width >= Math.max(220, buttonRect.width + 180);
      const isCompact = rect.height > 0 && rect.height <= 64;

      if (isHorizontalRow && hasRoomForButtons && isCompact) {
        return current;
      }

      current = current.parentElement;
    }

    return permissionButton.parentElement || null;
  }

  function findReplyComposerContainer(editor) {
    let current = editor?.parentElement || null;
    let fallback = null;

    for (let depth = 0; current && depth < 40; depth += 1) {
      const hasToolbar = Boolean(findComposerToolbar(current));
      const hasSubmit = Boolean(findComposerSubmitButton(current));

      if ((hasToolbar || hasSubmit) && !fallback) {
        fallback = current;
      }

      if (hasToolbar && hasSubmit) {
        return current;
      }

      if (fallback && current.matches?.('[role="dialog"], article')) {
        return fallback;
      }

      current = current.parentElement;
    }

    return fallback;
  }

  function findReplyComposerContainerFromSubmitButton(button) {
    let current = button?.parentElement || null;
    let fallback = null;

    for (let depth = 0; current && depth < 40; depth += 1) {
      const hasEditor = Boolean(current.querySelector?.(REPLY_EDITOR_SELECTOR));
      const hasToolbar = Boolean(findComposerToolbar(current));
      const hasSubmit = Boolean(findComposerSubmitButton(current));

      if (hasEditor && (hasToolbar || hasSubmit) && !fallback) {
        fallback = current;
      }

      if (hasEditor && hasToolbar && hasSubmit) {
        return current;
      }

      if (fallback && current.matches?.('[role="dialog"], article')) {
        return fallback;
      }

      current = current.parentElement;
    }

    return fallback;
  }

  function findComposerActionRow(composer) {
    const toolbar = findComposerToolbar(composer);
    const tweetButton = findComposerSubmitButton(composer);

    if (toolbar && tweetButton) {
      const common = findSmallestCommonAncestor(toolbar, tweetButton, composer);
      if (common && common !== composer) {
        return common;
      }
    }

    if (toolbar?.parentElement && composer.contains(toolbar.parentElement)) {
      return toolbar.parentElement;
    }

    if (tweetButton?.parentElement && composer.contains(tweetButton.parentElement)) {
      return tweetButton.parentElement;
    }

    return null;
  }

  function findComposerEditorBlock(editor, composer) {
    let current = editor;
    let best = editor;

    for (let depth = 0; current?.parentElement && current.parentElement !== composer && depth < 12; depth += 1) {
      const parent = current.parentElement;
      const rect = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      const isComposerWidth = rect.width >= Math.max(220, editor.getBoundingClientRect().width * 0.8);
      const isVerticalBlock = style.display !== "inline" && style.display !== "inline-flex";

      if (isComposerWidth && isVerticalBlock) {
        best = parent;
      }

      current = parent;
    }

    return best;
  }

  function findComposerToolbar(scope) {
    return findVisibleDescendant(scope, '[data-testid="toolBar"], [role="toolbar"]');
  }

  function findComposerSubmitButton(scope) {
    return findVisibleDescendant(scope, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
  }

  function isNativeComposerMediaControl(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const button = element.closest?.('button[aria-label], [role="button"][aria-label], [data-testid]');
    if (!button || button.closest?.(DRAFT_ACTIONS_HOST_SELECTOR)) {
      return false;
    }

    const toolbar = button.closest?.('[data-testid="toolBar"], [role="toolbar"]');
    if (!toolbar) {
      return false;
    }

    const marker = cleanText([
      button.getAttribute("aria-label"),
      button.getAttribute("data-testid"),
      button.textContent
    ].filter(Boolean).join(" ")).toLowerCase();
    const compactMarker = marker.replace(/[^\p{L}\p{N}]+/gu, "");

    return /(?:gif|emoji|emojis|émoji|émojis|emotic[oô]ne|emotic[oô]nes|media|m[eé]dia|image|photo|photos|video|vid[eé]o|poll|sondage|schedule|programmer|calendar|calendrier|location|emplacement|gallery|galerie)/i.test(marker)
      || /(?:gif|emoji|emojis|media|image|photo|photos|video|poll|schedule|calendar|location|gallery)/i.test(compactMarker);
  }

  function rememberDraftComposerSubmit(event) {
    const button = event.target?.closest?.('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
    if (!button || !isVisibleElement(button) || isDisabledButton(button)) {
      return;
    }

    const composer = findReplyComposerContainerFromSubmitButton(button);
    const editors = Array.from(composer?.querySelectorAll?.(REPLY_EDITOR_SELECTOR) || []).filter(isVisibleElement);
    if (!composer || !editors.some((editor) => getReplyEditorText(editor))) {
      return;
    }

    const submittedAt = Date.now();
    composer._xtensionDraftSubmittedAt = submittedAt;
    editors.forEach((editor) => {
      editor._xtensionDraftSubmittedAt = submittedAt;
      const host = findExistingDraftActionHost(editor, composer);
      if (host) {
        removeDraftActionHost(host);
      }
    });

    scheduleEnhancement();
  }

  function isDisabledButton(button) {
    return button?.disabled
      || button?.getAttribute?.("aria-disabled") === "true"
      || button?.getAttribute?.("disabled") !== null;
  }

  function isComposerRecentlySubmitted(editor, composer) {
    const submittedAt = Math.max(
      Number(editor?._xtensionDraftSubmittedAt || 0),
      Number(composer?._xtensionDraftSubmittedAt || 0)
    );

    if (!submittedAt) {
      return false;
    }

    const target = findEditableReplyEditor(editor) || editor;
    if (getReplyEditorText(target)) {
      clearComposerSubmitSuppression(editor, composer);
      return false;
    }

    if (Date.now() - submittedAt <= COMPOSER_SUBMIT_SUPPRESSION_MS || hasPostSentNotice()) {
      return true;
    }

    clearComposerSubmitSuppression(editor, composer);
    return false;
  }

  function clearComposerSubmitSuppression(editor, composer) {
    if (editor) {
      editor._xtensionDraftSubmittedAt = 0;
    }
    if (composer) {
      composer._xtensionDraftSubmittedAt = 0;
    }
  }

  function hasPostSentNotice() {
    const notices = document.querySelectorAll('[role="status"], [aria-live], [data-testid="toast"]');
    return Array.from(notices).some((notice) => {
      const text = cleanText(notice.textContent).toLowerCase();
      return /your post was sent|post was sent|post sent|votre post a été envoyé|votre post a ete envoye|réponse envoyée|reponse envoyee|publication envoyée|publication envoyee/.test(text);
    });
  }

  function findVisibleDescendant(scope, selector) {
    if (!scope?.querySelectorAll) {
      return null;
    }

    return Array.from(scope.querySelectorAll(selector)).find(isVisibleElement) || null;
  }

  function findSmallestCommonAncestor(first, second, boundary) {
    let current = first;

    while (current && current !== boundary.parentElement) {
      if (current.contains(second)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  function createDraftActionButtons(editor) {
    const wrapper = document.createElement("div");

    wrapper.className = "xtension-draft-actions";
    wrapper.setAttribute(DRAFT_ACTIONS_ATTRIBUTE, "true");

    getDraftActionDefinitions().forEach((action) => {
      const button = document.createElement("button");
      const label = localizedText(action.labelKey, action.fallback);

      button.type = "button";
      button.className = `xtension-draft-action-button is-${action.id}`;
      button.setAttribute(DRAFT_ACTION_BUTTON_ATTRIBUTE, action.id);
      button.title = label;
      button.setAttribute("aria-label", label);
      button.append(createDraftActionIcon(action.id));
      button.addEventListener("pointerdown", stopDraftActionButtonEvent, true);
      button.addEventListener("mousedown", stopDraftActionButtonEvent, true);
      button.addEventListener("click", async (event) => {
        stopDraftActionButtonEvent(event);
        await activateDraftActionButton(button, editor, action.id);
      });
      wrapper.append(button);
    });

    wrapper.append(createDraftGenerationLanguagePicker());

    return wrapper;
  }

  function stopDraftActionButtonEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function handleDraftActionPointerUp(event) {
    const button = event.target?.closest?.(`[${DRAFT_ACTION_BUTTON_ATTRIBUTE}]`);
    if (!button || button.disabled || !button.isConnected) {
      return;
    }

    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }

    stopDraftActionButtonEvent(event);
    activateDraftActionButton(button, null, button.getAttribute(DRAFT_ACTION_BUTTON_ATTRIBUTE)).catch(() => {});
  }

  async function activateDraftActionButton(button, fallbackEditor, action) {
    const now = Date.now();
    if (button._xtensionDraftActionLastActivatedAt && now - button._xtensionDraftActionLastActivatedAt < 450) {
      return;
    }

    button._xtensionDraftActionLastActivatedAt = now;
    await handleDraftActionButtonClick(button, resolveDraftActionEditor(button, fallbackEditor), action);
  }

  function createDraftActionIcon(action) {
    const icon = document.createElement("span");
    const actionId = normalizeDraftAction(action);

    icon.className = "xtension-draft-action-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = DRAFT_ACTION_ICON_SVGS[actionId] || DRAFT_ACTION_ICON_SVGS.generate;
    return icon;
  }

  function renderDraftActionButtonIcon(button, action) {
    const actionId = normalizeDraftAction(action);
    const iconId = button.classList.contains("is-undo") ? "undo" : actionId;
    const icon = button.querySelector(".xtension-draft-action-icon") || createDraftActionIcon(iconId);

    icon.innerHTML = DRAFT_ACTION_ICON_SVGS[iconId] || DRAFT_ACTION_ICON_SVGS.generate;
    if (!icon.isConnected) {
      button.replaceChildren(icon);
    }
  }

  function createDraftGenerationLanguagePicker() {
    const picker = document.createElement("div");
    const trigger = document.createElement("button");
    const flag = document.createElement("span");
    const code = document.createElement("span");
    const chevron = document.createElement("span");
    const menu = document.createElement("div");
    const label = localizedText("draftLanguagePickerLabel", "Output language");

    picker.className = "xtension-draft-language-picker";
    picker.title = label;

    trigger.type = "button";
    trigger.className = "xtension-draft-language-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", label);
    trigger.setAttribute("aria-controls", getDraftLanguageMenuId());
    trigger.title = label;
    trigger.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      stopDraftLanguagePickerEvent(event);
      picker._xtensionDraftLanguageLastPointerToggleAt = Date.now();
      setDraftLanguageMenuOpen(picker, !isDraftLanguageMenuOpen(picker), true);
    }, true);
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      stopDraftLanguagePickerEvent(event);
      if (Date.now() - (picker._xtensionDraftLanguageLastPointerToggleAt || 0) < 500) {
        return;
      }
      setDraftLanguageMenuOpen(picker, !isDraftLanguageMenuOpen(picker), true);
    });
    trigger.addEventListener("keydown", handleDraftLanguageTriggerKeyDown);

    flag.className = "xtension-draft-language-flag";
    flag.setAttribute("aria-hidden", "true");

    code.className = "xtension-draft-language-code";
    code.setAttribute("aria-hidden", "true");

    chevron.className = "xtension-draft-language-chevron";
    chevron.textContent = "▾";
    chevron.setAttribute("aria-hidden", "true");

    menu.className = "xtension-draft-language-menu";
    menu.id = trigger.getAttribute("aria-controls");
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", label);
    menu.hidden = true;
    menu._xtensionDraftLanguagePicker = picker;
    picker._xtensionDraftLanguageMenu = menu;

    DRAFT_GENERATION_LANGUAGES.forEach((language) => {
      const option = document.createElement("button");
      const optionFlag = document.createElement("span");
      const optionLabel = document.createElement("span");
      const languageLabel = getDraftLanguageMenuLabel(language);

      option.type = "button";
      option.className = "xtension-draft-language-option";
      option.dataset.language = language.id;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.title = languageLabel;
      option.setAttribute("aria-label", languageLabel);
      option.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        stopDraftLanguagePickerEvent(event);
        option._xtensionDraftLanguageLastPointerSelectAt = Date.now();
        selectDraftGenerationLanguage(picker, language.id);
      }, true);
      option.addEventListener("click", (event) => {
        event.preventDefault();
        stopDraftLanguagePickerEvent(event);
        if (Date.now() - (option._xtensionDraftLanguageLastPointerSelectAt || 0) < 500) {
          return;
        }
        selectDraftGenerationLanguage(picker, language.id);
      });
      option.addEventListener("keydown", handleDraftLanguageOptionKeyDown);

      optionFlag.className = "xtension-draft-language-option-flag";
      optionFlag.setAttribute("aria-hidden", "true");
      optionFlag.style.backgroundImage = getDraftLanguageFlagBackground(language);

      optionLabel.className = "xtension-draft-language-option-label";
      optionLabel.textContent = languageLabel;

      option.append(optionFlag, optionLabel);
      menu.append(option);
    });

    trigger.append(flag, code, chevron);
    picker.append(trigger);
    appendDraftLanguageMenu(menu, picker);
    picker.addEventListener("focusout", () => {
      queueDraftLanguageMenuClose(picker);
    });
    menu.addEventListener("focusout", () => {
      queueDraftLanguageMenuClose(picker);
    });

    updateDraftGenerationLanguagePicker(picker, getDefaultDraftGenerationLanguage());

    getDraftGenerationLanguage().then((languageId) => {
      updateDraftGenerationLanguagePicker(picker, languageId);
    });

    return picker;
  }

  function updateDraftGenerationLanguagePicker(picker, languageId) {
    const normalized = normalizeDraftGenerationLanguage(languageId);
    const language = getDraftGenerationLanguageDefinition(normalized);
    const trigger = picker.querySelector(".xtension-draft-language-trigger");
    const flag = picker.querySelector(".xtension-draft-language-flag");
    const code = picker.querySelector(".xtension-draft-language-code");
    const languageLabel = getDraftLanguageMenuLabel(language);
    const menu = getDraftLanguageMenu(picker);

    picker.dataset.language = language.id;
    menu?.querySelectorAll(".xtension-draft-language-option").forEach((option) => {
      const selected = option.dataset.language === language.id;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", selected ? "true" : "false");
    });
    if (trigger) {
      const label = localizedText("draftLanguagePickerLabel", "Output language");
      trigger.title = `${label}: ${languageLabel}`;
      trigger.setAttribute("aria-label", `${label}: ${languageLabel}`);
    }
    if (flag) {
      flag.textContent = "";
      flag.style.backgroundImage = getDraftLanguageFlagBackground(language);
    }
    if (code) {
      code.textContent = language.code;
    }
  }

  function selectDraftGenerationLanguage(picker, languageId) {
    const normalized = normalizeDraftGenerationLanguage(languageId);
    updateDraftGenerationLanguagePicker(picker, normalized);
    storageSet({ [DRAFT_GENERATION_LANGUAGE_STORAGE_KEY]: normalized });
    setDraftLanguageMenuOpen(picker, false, false);
    picker.querySelector(".xtension-draft-language-trigger")?.focus?.({ preventScroll: true });
  }

  function isDraftLanguageMenuOpen(picker) {
    return picker?.classList?.contains("is-open") || false;
  }

  function setDraftLanguageMenuOpen(picker, open, focusSelectedOption) {
    const trigger = picker?.querySelector?.(".xtension-draft-language-trigger");
    const menu = getDraftLanguageMenu(picker);
    if (!trigger || !menu) {
      return;
    }

    picker.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    appendDraftLanguageMenu(menu, picker);
    menu.hidden = !open;

    if (open) {
      positionDraftLanguageMenu(picker, menu);
    }

    if (open && focusSelectedOption) {
      const selected = menu.querySelector(".xtension-draft-language-option.is-selected")
        || menu.querySelector(".xtension-draft-language-option");
      selected?.focus?.({ preventScroll: true });
    }
  }

  function handleDraftLanguageTriggerKeyDown(event) {
    if (!["ArrowDown", "Enter", " "].includes(event.key)) {
      return;
    }

    event.preventDefault();
    stopDraftLanguagePickerEvent(event);
    setDraftLanguageMenuOpen(event.currentTarget.closest(".xtension-draft-language-picker"), true, true);
  }

  function handleDraftLanguageOptionKeyDown(event) {
    const picker = event.currentTarget.closest(".xtension-draft-language-menu")?._xtensionDraftLanguagePicker || null;
    if (!picker) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stopDraftLanguagePickerEvent(event);
      setDraftLanguageMenuOpen(picker, false, false);
      picker.querySelector(".xtension-draft-language-trigger")?.focus?.({ preventScroll: true });
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      stopDraftLanguagePickerEvent(event);
      focusDraftLanguageOption(picker, event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      stopDraftLanguagePickerEvent(event);
      selectDraftGenerationLanguage(picker, event.currentTarget.dataset.language);
    }
  }

  function focusDraftLanguageOption(picker, currentOption, delta) {
    const options = Array.from(getDraftLanguageMenu(picker)?.querySelectorAll(".xtension-draft-language-option") || []);
    const currentIndex = Math.max(0, options.indexOf(currentOption));
    const nextIndex = (currentIndex + delta + options.length) % options.length;
    options[nextIndex]?.focus?.({ preventScroll: true });
  }

  function getDraftLanguageMenuId() {
    return `xtension-draft-language-menu-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getDraftLanguageMenu(picker) {
    return picker?._xtensionDraftLanguageMenu || null;
  }

  function appendDraftLanguageMenu(menu, picker) {
    if (!menu) {
      return;
    }

    const editor = resolveDraftActionEditor(picker?.closest?.(DRAFT_ACTIONS_HOST_SELECTOR), null)
      || picker?.closest?.(REPLY_EDITOR_SELECTOR)
      || findVisibleDialogReplyEditor();
    if (findVisibleReplyDialog(editor || picker)) {
      mountXtensionOverlayInsideXLayers(menu, editor || picker);
      return;
    }

    mountXtensionOverlayBelowXLayers(menu);
  }

  function removeDraftLanguageMenuForPicker(picker) {
    const menu = getDraftLanguageMenu(picker);
    menu?.remove?.();
    if (picker) {
      picker._xtensionDraftLanguageMenu = null;
    }
  }

  function queueDraftLanguageMenuClose(picker) {
    window.setTimeout(() => {
      const menu = getDraftLanguageMenu(picker);
      const activeElement = document.activeElement;
      if (!picker?.contains?.(activeElement) && !menu?.contains?.(activeElement)) {
        setDraftLanguageMenuOpen(picker, false, false);
      }
    }, 0);
  }

  function positionDraftLanguageMenu(picker, menu) {
    const trigger = picker?.querySelector?.(".xtension-draft-language-trigger");
    const rect = trigger?.getBoundingClientRect?.();
    if (!rect) {
      return;
    }

    const menuWidth = menu.offsetWidth || 148;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    const top = Math.max(8, Math.min(window.innerHeight - 8, rect.bottom + 6));
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }

  function getDraftLanguageMenuLabel(language) {
    return cleanText(language?.nativeName || localizedText(language?.labelKey, language?.fallback || ""));
  }

  function getDraftLanguageFlagBackground(language) {
    const path = cleanText(language?.iconPath || "");
    if (!path) {
      return "";
    }

    const url = getRuntimeResourceUrl(path) || path;
    return `url("${url.replace(/"/g, "%22")}")`;
  }

  function getDraftGenerationLanguageDefinition(languageId) {
    const normalized = normalizeDraftGenerationLanguage(languageId);
    return DRAFT_GENERATION_LANGUAGES.find((language) => language.id === normalized)
      || DRAFT_GENERATION_LANGUAGES[0];
  }

  function stopDraftLanguagePickerEvent(event) {
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function resolveDraftActionEditor(button, fallbackEditor) {
    const host = button?.closest?.(DRAFT_ACTIONS_HOST_SELECTOR) || null;
    const hostEditor = resolveDraftActionEditorFromHost(host);
    if (hostEditor) {
      return hostEditor;
    }

    if (fallbackEditor?.isConnected && isVisibleElement(fallbackEditor)) {
      return fallbackEditor;
    }

    const composer = findDraftActionsComposer(host);
    const composerEditor = Array.from(composer?.querySelectorAll?.(REPLY_EDITOR_SELECTOR) || []).find(isVisibleElement);

    return composerEditor
      || findVisibleDialogReplyEditor()
      || document.activeElement?.closest?.(REPLY_EDITOR_SELECTOR)
      || fallbackEditor
      || null;
  }

  function resolveDraftActionEditorFromHost(host) {
    const editor = host?._xtensionDraftEditor;
    if (editor?.isConnected && isVisibleElement(editor)) {
      return editor;
    }

    const composer = host?._xtensionDraftComposer;
    const composerEditor = Array.from(composer?.querySelectorAll?.(REPLY_EDITOR_SELECTOR) || []).find(isVisibleElement);
    if (composerEditor) {
      return composerEditor;
    }

    return null;
  }

  function findDraftActionsComposer(host) {
    if (host?._xtensionDraftComposer?.isConnected) {
      return host._xtensionDraftComposer;
    }

    let current = host?.parentElement || null;

    for (let depth = 0; current && depth < 30; depth += 1) {
      if (current.querySelector?.(REPLY_EDITOR_SELECTOR) && (findComposerToolbar(current) || findComposerSubmitButton(current))) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  function getDraftActionDefinitions() {
    return [
      {
        id: "correct",
        messageType: "xtension-correct-reply-draft",
        responseKey: "correctedText",
        labelKey: "correctionButtonLabel",
        loadingKey: "correctionButtonLoading",
        emptyKey: "toastCorrectionEmpty",
        failedKey: "toastCorrectionFailed",
        unchangedKey: "toastCorrectionUnchanged",
        fallback: "Correction",
        loadingFallback: "Correction in progress...",
        emptyFallback: "Type a reply before asking for correction.",
        failedFallback: "Unable to correct this reply.",
        unchangedFallback: "No correction needed."
      },
      {
        id: "translate",
        messageType: "xtension-translate-reply-draft",
        responseKey: "translatedText",
        labelKey: "translationButtonLabel",
        loadingKey: "translationButtonLoading",
        emptyKey: "toastTranslationEmpty",
        failedKey: "toastTranslationFailed",
        unchangedKey: "toastTranslationUnchanged",
        fallback: "Translate",
        loadingFallback: "Translation in progress...",
        emptyFallback: "Type a reply before translating it.",
        failedFallback: "Unable to translate this reply.",
        unchangedFallback: "This reply is already in the target language."
      },
      {
        id: "generate",
        messageType: "xtension-generate-reply-draft",
        responseKey: "generatedText",
        labelKey: "generateButtonLabel",
        loadingKey: "generateButtonLoading",
        emptyKey: "toastGenerateEmpty",
        failedKey: "toastGenerateFailed",
        unchangedKey: "toastGenerateUnchanged",
        fallback: "Generate",
        loadingFallback: "Generation in progress...",
        emptyFallback: "Type instructions before generating a reply.",
        failedFallback: "Unable to generate this reply.",
        unchangedFallback: "The generated reply did not change the draft."
      },
      {
        id: "suggestions",
        labelKey: "suggestionsButtonLabel",
        fallback: "Suggestions"
      }
    ];
  }

  function findReplyButtonHost(userName) {
    const verifiedIcon = userName.querySelector('[data-testid="icon-verified"], svg[aria-label*="Verified"]');
    const verifiedRow = verifiedIcon ? findTightAuthorNameRow(verifiedIcon, userName) : null;

    if (verifiedRow) {
      return verifiedRow;
    }

    const displayNameElement = findDisplayNameElement(userName);
    return displayNameElement
      ? findTightAuthorNameRow(displayNameElement, userName) || displayNameElement.closest('div[dir="ltr"]') || displayNameElement.parentElement || userName
      : userName.firstElementChild || userName;
  }

  function findTightAuthorNameRow(reference, boundary) {
    let current = reference;
    let best = null;

    while (current?.parentElement && current.parentElement !== boundary) {
      const parent = current.parentElement;

      if (parent.querySelector("time") || /@[A-Za-z0-9_]{1,20}/.test(cleanText(parent.textContent))) {
        break;
      }

      if (isTightAuthorNameRow(parent)) {
        best = parent;
      }

      current = parent;
    }

    return best;
  }

  function isTightAuthorNameRow(element) {
    if (!element || element.querySelector("time")) {
      return false;
    }

    const text = cleanText(element.textContent);
    if (!text || /@[A-Za-z0-9_]{1,20}/.test(text)) {
      return false;
    }

    const children = Array.from(element.children);
    const hasVerifiedIcon = Boolean(element.querySelector('[data-testid="icon-verified"], svg[aria-label*="Verified"]'));
    const namedChildren = children.filter((child) => {
      const childText = cleanText(child.textContent);
      return childText && !/@[A-Za-z0-9_]{1,20}/.test(childText);
    });

    return namedChildren.length > 0 && (hasVerifiedIcon || children.length <= 3);
  }

  function findDisplayNameElement(userName) {
    return Array.from(userName.querySelectorAll("span, div")).find((element) => {
      const text = cleanText(element.textContent);
      return text && !element.querySelector("time") && !/@[A-Za-z0-9_]{1,20}/.test(text);
    }) || null;
  }

  function markReplyMetadataLine(userName, host) {
    const metadata = findReplyMetadataElement(userName, host);

    if (!metadata) {
      return;
    }

    userName.setAttribute("data-xtension-reply-user-name", "true");
    metadata.setAttribute("data-xtension-reply-metadata", "true");
  }

  function findReplyMetadataElement(userName, host) {
    const candidates = Array.from(userName.querySelectorAll("span, div")).filter((element) => {
      if (element === host || host.contains(element) || element.querySelector(REPLY_BUTTON_SELECTOR)) {
        return false;
      }

      const text = cleanText(element.textContent);
      return /@[A-Za-z0-9_]{1,20}/.test(text) || Boolean(element.querySelector("time"));
    });

    return candidates.find((element) => element.parentElement === host.parentElement)
      || candidates.find((element) => element.closest('[data-testid="User-Name"]') === userName)
      || null;
  }

  function createReplyButton(tweet) {
    const button = document.createElement("button");
    const label = localizedText("replyButtonLabel", "Reply");

    button.type = "button";
    button.setAttribute(REPLY_BUTTON_ATTRIBUTE, "true");
    button.setAttribute("data-xtension-reply-label", label);
    button.setAttribute("aria-label", label);
    button.title = label;

    button.addEventListener("pointerdown", stopReplyButtonEvent, true);
    button.addEventListener("click", (event) => {
      stopReplyButtonEvent(event);
      openReplyComposerWithSuggestions(tweet);
    }, true);
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      stopReplyButtonEvent(event);
      openReplyComposerWithSuggestions(tweet);
    }, true);

    return button;
  }

  function stopReplyButtonEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  async function openReplyComposerWithSuggestions(tweet) {
    const nativeReplyButton = findNativeReplyButton(tweet);
    if (!nativeReplyButton) {
      showToast(localizedText("toastReplyComposerNotFound", "Unable to open the reply composer."));
      return;
    }

    const existingEditors = new WeakSet(
      Array.from(document.querySelectorAll(REPLY_EDITOR_SELECTOR)).filter(isVisibleElement)
    );
    nativeReplyButton.click();

    try {
      const editor = await waitForReplyEditor(existingEditors);
      await showReplySuggestions(editor, tweet);
    } catch (error) {
      showToast(localizedText("toastReplySuggestionsFailed", "Unable to generate reply suggestions."));
    }
  }

  function findNativeReplyButton(tweet) {
    return Array.from(tweet.querySelectorAll('[data-testid="reply"]')).find((button) => {
      const ownerTweet = button.closest('article[data-testid="tweet"]');
      return ownerTweet === tweet;
    }) || null;
  }

  function waitForReplyEditor(existingEditors) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timeoutMs = 5000;

      function check() {
        const editor = findActiveReplyEditor(existingEditors);
        if (editor) {
          resolve(editor);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("Reply editor not found."));
          return;
        }

        window.setTimeout(check, 80);
      }

      check();
    });
  }

  function findActiveReplyEditor(existingEditors) {
    const dialogEditor = findVisibleDialogReplyEditor();
    if (dialogEditor) {
      return dialogEditor;
    }

    const activeEditor = document.activeElement?.closest?.(REPLY_EDITOR_SELECTOR);
    if (activeEditor && isVisibleElement(activeEditor) && !existingEditors?.has(activeEditor)) {
      return activeEditor;
    }

    const editors = Array.from(document.querySelectorAll(REPLY_EDITOR_SELECTOR)).filter((editor) => {
      return isVisibleElement(editor)
        && !existingEditors?.has(editor)
        && !editor.closest('[data-xtension-menu-item]');
    });

    return editors.find((editor) => editor.closest('[role="dialog"]')) || editors[0] || null;
  }

  function findVisibleDialogReplyEditor() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(isVisibleElement);

    for (const dialog of dialogs.reverse()) {
      const editors = Array.from(dialog.querySelectorAll(REPLY_EDITOR_SELECTOR)).filter((editor) => {
        return isVisibleElement(editor) && !editor.closest('[data-xtension-menu-item]');
      });

      const focusedEditor = editors.find((editor) => editor.contains(document.activeElement));
      if (focusedEditor) {
        return focusedEditor;
      }

      if (editors.length) {
        return editors[editors.length - 1];
      }
    }

    return null;
  }

  function maybeShowAutomaticReplySuggestions(editor, composer) {
    if (!shouldUseDedicatedDraftActionRow(editor, composer) || !isDraftActionComposerActive(editor, composer)) {
      return;
    }

    const target = findEditableReplyEditor(editor);
    if (!target || getReplyEditorText(target) || target._xtensionAutoReplySuggestionsRequested) {
      return;
    }

    if (isReplySuggestionsPanelForEditor(target)) {
      return;
    }

    target._xtensionAutoReplySuggestionsRequested = true;
    window.setTimeout(async () => {
      if (!target.isConnected || !isVisibleElement(target) || getReplyEditorText(target)) {
        target._xtensionAutoReplySuggestionsRequested = false;
        return;
      }

      const targetComposer = findReplyComposerContainer(target) || composer;
      if (!isDraftActionComposerActive(target, targetComposer)) {
        target._xtensionAutoReplySuggestionsRequested = false;
        return;
      }

      const shown = await showReplySuggestionsForDraftEditor(target);
      if (!shown) {
        target._xtensionAutoReplySuggestionsRequested = false;
      }
    }, 350);
  }

  function isReplySuggestionsPanelForEditor(editor) {
    return Boolean(getReplySuggestionsPanelForEditor(editor));
  }

  function getReplySuggestionsPanelForEditor(editor) {
    const panel = document.querySelector(REPLY_SUGGESTIONS_PANEL_SELECTOR);
    const panelEditor = panel?._xtensionReplyEditor;
    return panel && panelEditor && (panelEditor === editor || resolveLiveReplyEditor(panelEditor) === editor)
      ? panel
      : null;
  }

  async function showReplySuggestions(editor, tweet) {
    const activeEditor = resolveLiveReplyEditor(editor) || editor;
    if (activeEditor?._xtensionReplySuggestionsPromise) {
      await activeEditor._xtensionReplySuggestionsPromise.catch(() => false);
      return;
    }

    const panel = createReplySuggestionsPanel(activeEditor);
    const generationPromise = (async () => {
      setReplySuggestionsPanelLoading(panel, "preparing");
      placeReplySuggestionsPanel(activeEditor, panel);

      try {
        const context = await collectReplySuggestionContext(tweet);
        await showReplySuggestionsForContext(activeEditor, context, panel);
      } catch (error) {
        setReplySuggestionsPanelError(panel, "generation_failed", error?.message || "");
      }
    })();

    activeEditor._xtensionReplySuggestionsPromise = generationPromise;
    try {
      await generationPromise;
    } finally {
      if (activeEditor._xtensionReplySuggestionsPromise === generationPromise) {
        activeEditor._xtensionReplySuggestionsPromise = null;
      }
    }
  }

  async function showReplySuggestionsForDraftEditor(editor, options = {}) {
    const target = findEditableReplyEditor(editor) || editor;
    const existingPanel = getReplySuggestionsPanelForEditor(target);
    if (existingPanel && !options.force) {
      attachReplySuggestionsPanel(target, existingPanel);
      positionReplySuggestionsPanel(target, existingPanel);
      return true;
    }
    if (existingPanel && options.force) {
      removeReplySuggestionsPanel(existingPanel);
    }

    if (target?._xtensionReplySuggestionsPromise) {
      await target._xtensionReplySuggestionsPromise.catch(() => false);
      return true;
    }

    const generationPromise = showReplySuggestionsForDraftEditorOnce(target, options);
    if (target) {
      target._xtensionReplySuggestionsPromise = generationPromise;
    }

    try {
      return await generationPromise;
    } finally {
      if (target?._xtensionReplySuggestionsPromise === generationPromise) {
        target._xtensionReplySuggestionsPromise = null;
      }
    }
  }

  async function toggleReplySuggestionsForDraftEditor(editor) {
    const target = findEditableReplyEditor(editor) || editor;
    const panel = getReplySuggestionsPanelForEditor(target);
    if (panel) {
      removeReplySuggestionsPanel(panel);
      return false;
    }

    return await showReplySuggestionsForDraftEditor(target, {
      instruction: getReplyEditorText(target)
    });
  }

  async function showReplySuggestionsForDraftEditorOnce(target, options = {}) {
    const panel = createReplySuggestionsPanel(target);

    setReplySuggestionsPanelLoading(panel, "preparing");
    placeReplySuggestionsPanel(target, panel);

    const baseContext = await getReplyDraftContext(target);
    const context = {
      ...baseContext
    };
    const instruction = cleanMultilineText(options.instruction || "");
    if (instruction) {
      context.userDraftInstruction = instruction;
    } else {
      delete context.userDraftInstruction;
    }
    if (!hasUsableReplySuggestionContext(context)) {
      removeReplySuggestionsPanel(panel);
      return false;
    }

    await showReplySuggestionsForContext(target, context, panel);
    return true;
  }

  function hasUsableReplySuggestionContext(context) {
    return Boolean(
      cleanText(context?.tweetText || "") ||
      cleanText(context?.authorName || "") ||
      cleanText(context?.authorHandle || "") ||
      context?.mediaContext?.length ||
      context?.quotedTweets?.length ||
      context?.linkCards?.length
    );
  }

  async function showReplySuggestionsForContext(editor, context, existingPanel) {
    const activeEditor = resolveLiveReplyEditor(editor) || editor;
    const panel = existingPanel || createReplySuggestionsPanel(activeEditor);
    activeEditor._xtensionReplyContext = context;

    if (!panel.isConnected) {
      placeReplySuggestionsPanel(activeEditor, panel);
    }

    try {
      const profilesResponse = await sendRuntimeMessage({
        type: "xtension-get-reply-prompt-profiles"
      });

      if (!profilesResponse?.ok) {
        setReplySuggestionsPanelError(panel, profilesResponse?.code, profilesResponse?.error);
        return;
      }

      const profiles = normalizeReplyPromptProfilesForUi(profilesResponse.profiles);
      setReplySuggestionsPanelStreaming(panel, panel._xtensionReplyEditor || activeEditor, profiles);
      const tasks = profiles.map((profile, index) => {
        return sendRuntimeMessage({
          type: "xtension-generate-reply-suggestion-profile",
          locale: getUiLocale(),
          context,
          profileIndex: index
        }).then((response) => {
          if (!response?.ok) {
            setReplySuggestionsPanelProfileError(panel, index, response?.error || localizedText("toastReplySuggestionsFailed", "Unable to generate reply suggestions."));
            return false;
          }

          setReplySuggestionsPanelProfileReply(panel, panel._xtensionReplyEditor || activeEditor, index, response.reply);
          return true;
        }).catch((error) => {
          setReplySuggestionsPanelProfileError(panel, index, error?.message || localizedText("toastReplySuggestionsFailed", "Unable to generate reply suggestions."));
          return false;
        });
      });

      const results = await Promise.allSettled(tasks);
      const hasReply = results.some((result) => result.status === "fulfilled" && result.value);
      finishReplySuggestionsPanelStreaming(panel);
      if (!hasReply) {
        setReplySuggestionsPanelError(panel, "generation_failed", localizedText("toastReplySuggestionsFailed", "Unable to generate reply suggestions."));
      }
    } catch (error) {
      setReplySuggestionsPanelError(panel, "generation_failed", error?.message || "");
    }
  }

  async function collectReplySuggestionContext(tweet) {
    await ensureOriginalTweetTextVisible(tweet);
    const status = getTweetStatusContext(tweet);
    const authorInfo = getTweetAuthorInfo(tweet, status);
    const tweetTextElement = findPrimaryTweetText(tweet);
    const tweetText = extractVisibleText(tweetTextElement) || cleanText(tweet.textContent);
    const authorHandle = cleanHandle(authorInfo?.handle || status?.author || "");

    return {
      authorName: authorInfo?.displayName || "",
      authorHandle,
      sourceUrl: status?.url || "",
      tweetLanguage: findTweetLanguage(tweet, tweetTextElement),
      tweetText,
      toneSignals: detectReplyToneSignals(tweet, tweetText),
      mediaContext: collectReplyMediaContext(tweet),
      authorProfileContext: collectVisibleAuthorProfileContext(authorHandle),
      linkCards: collectReplyLinkCards(tweet),
      quotedTweets: collectReplyQuotedTweets(tweet),
      visibleUrls: collectReplyVisibleUrls(tweet)
    };
  }

  async function ensureOriginalTweetTextVisible(tweet) {
    const tweetTextElement = findPrimaryTweetText(tweet);
    const originalButton = findShowOriginalTweetButton(tweet, tweetTextElement);

    if (!tweetTextElement || !originalButton) {
      return false;
    }

    const previousText = extractVisibleText(tweetTextElement);
    const previousLang = findTweetLanguage(tweet, tweetTextElement);

    originalButton.click();
    await waitForOriginalTweetText(tweet, previousText, previousLang);
    return true;
  }

  function findShowOriginalTweetButton(tweet, tweetTextElement) {
    if (!tweet || !tweetTextElement) {
      return null;
    }

    const checked = new Set();
    const candidates = [];
    let current = tweetTextElement.previousElementSibling;

    for (let index = 0; current && index < 4; index += 1) {
      candidates.push(current);
      current = current.previousElementSibling;
    }

    const parent = tweetTextElement.parentElement;
    if (parent) {
      candidates.push(...Array.from(parent.children).filter((child) => {
        return child !== tweetTextElement
          && isElementBeforeOrSame(child, tweetTextElement)
          && !child.contains(tweetTextElement);
      }).slice(-4));
    }

    for (const candidate of candidates) {
      if (!candidate || checked.has(candidate) || !isLikelyTranslationBanner(candidate)) {
        continue;
      }

      checked.add(candidate);
      const button = Array.from(candidate.querySelectorAll("button")).find((item) => {
        return isVisibleElement(item) && item.closest('article[data-testid="tweet"]') === tweet;
      });

      if (button) {
        return button;
      }
    }

    return null;
  }

  function isLikelyTranslationBanner(element) {
    if (!element || !isVisibleElement(element) || !element.querySelector("button")) {
      return false;
    }

    if (element.querySelector('[data-testid="User-Name"], [data-testid="caret"], [data-testid="reply"], [role="group"]')) {
      return false;
    }

    const text = cleanText(element.innerText || element.textContent || "");
    const buttonCount = element.querySelectorAll("button").length;
    const hasTranslationCue = /original|origine|trad|translat|übersetz|traduc|mostrar|afficher|show|元|翻訳|原文|원문|번역/i.test(text);

    return buttonCount <= 2
      && text.length > 0
      && text.length < 240
      && (hasTranslationCue || Boolean(element.querySelector("svg")));
  }

  async function waitForOriginalTweetText(tweet, previousText, previousLang) {
    const deadline = Date.now() + 1800;

    while (Date.now() < deadline) {
      await nextFrame();
      const tweetTextElement = findPrimaryTweetText(tweet);
      const currentText = extractVisibleText(tweetTextElement);
      const currentLang = findTweetLanguage(tweet, tweetTextElement);

      if ((currentText && currentText !== previousText) || (currentLang && currentLang !== previousLang)) {
        return;
      }
    }
  }

  function detectReplyToneSignals(tweet, tweetText) {
    const text = `${tweetText || ""} ${tweet?.textContent || ""}`;
    const signals = [];

    if (/\b(?:mdr|ptdr|lol|lmao|haha|ahah|😂|🤣)\b/i.test(text)) {
      signals.push("humor marker / laugh");
    }
    if (/\b(?:karma|cheh|ratio|dunk|seum|bien fait|retour de baton|retour de bâton)\b/i.test(text)) {
      signals.push("dunk or karma angle");
    }
    if (/\b(?:patreon|youtube|chaine|chaîne|demonet|démonét|strike|ban|sauter)\b/i.test(text)) {
      signals.push("platform/account sanction context");
    }
    if (tweet?.querySelector?.('video, [aria-label*="GIF" i], [data-testid*="gif" i]')) {
      signals.push("visible GIF or meme reaction");
    }
    if (/[!?]{2,}|…/.test(text)) {
      signals.push("dramatic or punchy phrasing");
    }

    return uniqueStrings(signals).slice(0, 8);
  }

  function collectReplyMediaContext(tweet) {
    const items = [];

    if (tweet?.querySelector?.('video, [aria-label*="GIF" i], [data-testid*="gif" i]')) {
      items.push({
        type: "gif_or_video",
        description: "A GIF/video reaction is visible in the tweet. Treat it as part of the joke/meme context when toneSignals indicate humor."
      });
    }

    Array.from(tweet?.querySelectorAll?.("img") || []).forEach((image) => {
      const alt = cleanText(image.getAttribute("alt") || "");
      const src = getReplyImageSource(image);

      if (!src || /profile_images/i.test(src) || image.matches(PROFILE_IMAGE_SELECTOR)) {
        return;
      }

      items.push({
        type: "image",
        description: alt || "Tweet image",
        imageUrl: src
      });
    });

    return items.slice(0, 6);
  }

  function getReplyImageSource(image) {
    const src = image.currentSrc || image.getAttribute("src") || image.src || "";

    if (!src || /^data:/i.test(src) || /^blob:/i.test(src)) {
      return "";
    }

    if (!/twimg\.com\/(?:media|card_img|ext_tw_video_thumb|amplify_video_thumb)|\/media\//i.test(src)) {
      return "";
    }

    try {
      const url = new URL(src, window.location.href);
      if (/pbs\.twimg\.com\/media/i.test(url.href)) {
        url.searchParams.set("name", "large");
      }
      return url.href;
    } catch (error) {
      return src;
    }
  }

  function collectVisibleAuthorProfileContext(authorHandle) {
    const handle = cleanHandle(authorHandle).toLowerCase();
    if (!handle) {
      return "";
    }

    const candidates = Array.from(document.querySelectorAll([
      '[data-testid="UserCell"]',
      '[data-testid="HoverCard"]',
      '[data-testid="placementTracking"]',
      'aside [role="link"]',
      'aside [dir="ltr"]'
    ].join(", ")));

    for (const candidate of candidates) {
      const text = extractVisibleText(candidate);
      if (!text || !text.toLowerCase().includes(`@${handle}`)) {
        continue;
      }

      return cleanAuthorProfileText(text, handle);
    }

    return "";
  }

  function cleanAuthorProfileText(text, handle) {
    return truncateReplyContextText(
      cleanText(text)
        .replace(new RegExp(`@${escapeRegExp(handle)}`, "ig"), `@${handle}`)
        .replace(/\b(?:Follow|Following|Abonné|Abonnée|Vous suit|Follows you)\b/gi, " ")
        .replace(/\s+/g, " "),
      900
    );
  }

  function truncateReplyContextText(value, maxLength) {
    const text = cleanText(value);
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}…`;
  }

  function findTweetLanguage(tweet, tweetTextElement) {
    const candidates = [
      tweetTextElement,
      tweetTextElement?.closest?.("[lang]"),
      tweet.querySelector('[data-testid="tweetText"][lang]'),
      tweet.querySelector("[lang]")
    ];

    for (const candidate of candidates) {
      const lang = cleanText(candidate?.getAttribute?.("lang") || candidate?.lang || "");
      if (lang && lang.toLowerCase() !== "und") {
        return lang;
      }
    }

    return "";
  }

  function collectReplyLinkCards(tweet) {
    return collectLinkCardParts(tweet, new Set()).map((card) => {
      return {
        domain: card.domain || "",
        title: card.title || "",
        description: card.description || "",
        url: card.url || ""
      };
    });
  }

  function collectReplyQuotedTweets(tweet) {
    return getEmbeddedTweetContainers(tweet).map((embeddedTweet) => {
      const status = getTweetStatusContext(embeddedTweet)
        || findStatusContextInElement(embeddedTweet)
        || parseStatusContextFromText(embeddedTweet.innerHTML || "");
      const authorInfo = getTweetAuthorInfo(embeddedTweet, status);
      const tweetTextElement = findPrimaryTweetText(embeddedTweet);
      const text = extractVisibleText(tweetTextElement);

      return {
        authorName: authorInfo?.displayName || "",
        authorHandle: cleanHandle(authorInfo?.handle || status?.author || ""),
        text,
        sourceUrl: status?.url || ""
      };
    }).filter((quotedTweet) => quotedTweet.text || quotedTweet.authorName || quotedTweet.sourceUrl);
  }

  function collectReplyVisibleUrls(tweet) {
    return uniqueStrings(
      Array.from(tweet.querySelectorAll("a[href]"))
        .map((link) => normalizeLinkHref(link.getAttribute("href") || link.href || ""))
        .filter((href) => {
          return href
            && !parseStatusContext(href)
            && !/^(?:#|javascript:)/i.test(href);
        })
    ).slice(0, 5);
  }

  function createReplySuggestionsPanel(editor) {
    const panel = document.createElement("div");

    panel.className = "xtension-reply-suggestions";
    panel.setAttribute(REPLY_SUGGESTIONS_PANEL_ATTRIBUTE, "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-live", "polite");
    panel._xtensionReplyEditor = editor;

    return panel;
  }

  function placeReplySuggestionsPanel(editor, panel) {
    const previousPanel = document.querySelector(REPLY_SUGGESTIONS_PANEL_SELECTOR);
    if (previousPanel) {
      removeReplySuggestionsPanel(previousPanel);
    }

    panel._xtensionReplyEditor = resolveLiveReplyEditor(editor) || editor;
    panel._xtensionReplyDialog = findVisibleReplyDialog(panel._xtensionReplyEditor);
    const reposition = () => {
      if (!panel.isConnected) {
        panel._xtensionReplyCleanup?.();
        return;
      }

      const liveEditor = resolveLiveReplyEditor(panel._xtensionReplyEditor || editor);
      const liveDialog = findVisibleReplyDialog(liveEditor);

      if (liveDialog) {
        panel._xtensionReplyDialog = liveDialog;
      }

      if (!isReplyComposerAlive(liveEditor, panel._xtensionReplyDialog)) {
        removeReplySuggestionsPanel(panel);
        return;
      }

      panel._xtensionReplyEditor = liveEditor;
      attachReplySuggestionsPanel(liveEditor, panel);
      positionReplySuggestionsPanel(liveEditor, panel);
    };
    const observer = new MutationObserver((mutations) => {
      if (mutations.every(isXtensionOverlayMutation)) {
        return;
      }

      reposition();
    });
    panel._xtensionReplyCleanup = () => {
      window.removeEventListener("resize", reposition, true);
      window.removeEventListener("scroll", reposition, true);
      observer.disconnect();
    };

    attachReplySuggestionsPanel(panel._xtensionReplyEditor, panel);
    window.addEventListener("resize", reposition, true);
    window.addEventListener("scroll", reposition, true);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    reposition();
    requestAnimationFrame(reposition);
  }

  function removeReplySuggestionsPanel(panel) {
    clearReplySuggestionsPanelProgress(panel);
    const editor = panel?._xtensionReplyEditor;
    if (editor?._xtensionReplySuggestionsPromise) {
      editor._xtensionReplySuggestionsPromise = null;
    }
    panel?._xtensionReplyCleanup?.();
    panel?.remove();
  }

  function createReplySuggestionsHeader(panel) {
    const header = document.createElement("div");
    const title = document.createElement("div");
    const close = document.createElement("button");

    header.className = "xtension-reply-suggestions-header";
    title.className = "xtension-reply-suggestions-title";
    title.textContent = localizedText("replySuggestionsTitle", "Suggested replies");
    close.type = "button";
    close.className = "xtension-reply-suggestions-close";
    close.setAttribute("aria-label", localizedText("replySuggestionsClose", "Close suggested replies"));
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeReplySuggestionsPanel(panel);
    });

    header.append(title, close);
    return header;
  }

  function isReplyComposerAlive(editor, dialog) {
    if (!editor?.isConnected || !isVisibleElement(editor)) {
      return false;
    }

    return !dialog || (dialog.isConnected && isVisibleElement(dialog));
  }

  function positionReplySuggestionsPanel(editor, panel) {
    if (!editor || !panel?.isConnected) {
      return;
    }

    if (!panel.classList.contains("is-floating")) {
      panel.style.removeProperty("left");
      panel.style.removeProperty("top");
      panel.style.removeProperty("width");
      panel.style.maxHeight = "min(420px, calc(100vh - 24px))";
      return;
    }

    const rect = getReplySuggestionsPlacementRect(editor);
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const maxWidth = Math.max(320, viewportWidth - 24);
    const width = Math.min(Math.max(rect.width || 520, 420), maxWidth);
    const left = clamp(rect.left + ((rect.width || width) - width) / 2, 12, Math.max(12, viewportWidth - width - 12));
    let top = rect.bottom + 12;
    top = clamp(top, 16, Math.max(16, viewportHeight - 80));
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.width = `${Math.round(width)}px`;
    panel.style.maxHeight = `${Math.max(120, Math.round(viewportHeight - top - 16))}px`;
  }

  function attachReplySuggestionsPanel(editor, panel) {
    panel.classList.add("is-floating");
    if (findVisibleReplyDialog(editor)) {
      panel.classList.add("is-reply-layer-mounted");
      mountXtensionOverlayInsideXLayers(panel, editor);
      return;
    }

    panel.classList.remove("is-reply-layer-mounted");
    mountXtensionOverlayBelowXLayers(panel);
  }

  function mountXtensionOverlayBelowXLayers(element) {
    const mount = getXtensionOverlayMount();

    if (!mount) {
      return;
    }

    if (element.parentElement !== mount) {
      mount.append(element);
    }
  }

  function mountXtensionOverlayInsideXLayers(element, editor) {
    const mount = getXtensionLayerOverlayMount(editor);

    if (!mount) {
      mountXtensionOverlayBelowXLayers(element);
      return;
    }

    if (element.parentElement !== mount) {
      mount.append(element);
    }
  }

  function getXtensionLayerOverlayMount(editor) {
    const layers = document.getElementById(X_LAYERS_ID);
    if (!layers) {
      return null;
    }

    let overlayRoot = layers.querySelector?.(`:scope > [${XTENSION_OVERLAY_ROOT_ATTRIBUTE}][data-xtension-layer-overlay="true"]`) || null;
    if (!overlayRoot) {
      overlayRoot = document.createElement("div");
      overlayRoot.setAttribute(XTENSION_OVERLAY_ROOT_ATTRIBUTE, "true");
      overlayRoot.setAttribute("data-xtension-layer-overlay", "true");
    }

    const referenceNode = getXtensionLayerOverlayReference(layers, editor);
    if (referenceNode) {
      layers.insertBefore(overlayRoot, referenceNode);
    } else if (overlayRoot.parentElement !== layers || overlayRoot.nextSibling) {
      layers.append(overlayRoot);
    }

    return overlayRoot;
  }

  function getXtensionLayerOverlayReference(layers, editor) {
    const dialog = findVisibleReplyDialog(editor);
    const anchor = getDirectChildContaining(layers, dialog || editor);
    let referenceNode = anchor?.nextSibling || null;

    while (referenceNode instanceof Element && referenceNode.hasAttribute(XTENSION_OVERLAY_ROOT_ATTRIBUTE)) {
      referenceNode = referenceNode.nextSibling;
    }

    return referenceNode;
  }

  function getDirectChildContaining(parent, child) {
    if (!parent || !child) {
      return null;
    }

    let current = child;
    while (current?.parentElement && current.parentElement !== parent) {
      current = current.parentElement;
    }

    return current?.parentElement === parent ? current : null;
  }

  function getXtensionOverlayMount() {
    const layers = document.getElementById(X_LAYERS_ID);
    const layersParent = layers?.parentElement;

    if (layersParent) {
      let overlayRoot = layersParent.querySelector?.(`:scope > [${XTENSION_OVERLAY_ROOT_ATTRIBUTE}]`) || null;
      if (!overlayRoot) {
        overlayRoot = document.createElement("div");
        overlayRoot.setAttribute(XTENSION_OVERLAY_ROOT_ATTRIBUTE, "true");
      }

      if (overlayRoot.parentElement !== layersParent || overlayRoot.nextSibling !== layers) {
        layersParent.insertBefore(overlayRoot, layers);
      }

      return overlayRoot;
    }

    return document.getElementById(X_REACT_ROOT_ID)
      || document.body
      || document.documentElement
      || null;
  }

  function isXtensionOverlayMutation(mutation) {
    if (!mutation) {
      return false;
    }

    const nodes = [
      ...Array.from(mutation.addedNodes || []),
      ...Array.from(mutation.removedNodes || [])
    ];

    return nodes.length > 0 && nodes.every(isXtensionOverlayNode);
  }

  function isXtensionOverlayNode(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    return node.matches?.(`${REPLY_SUGGESTIONS_PANEL_SELECTOR}, .xtension-draft-language-menu, .xtension-toast`)
      || node.hasAttribute?.(XTENSION_OVERLAY_ROOT_ATTRIBUTE)
      || Boolean(node.querySelector?.(`${REPLY_SUGGESTIONS_PANEL_SELECTOR}, .xtension-draft-language-menu, .xtension-toast`));
  }

  function getReplySuggestionsPlacementRect(editor) {
    const dialogRect = findVisibleReplyDialog(editor)?.getBoundingClientRect();
    if (dialogRect?.width) {
      return {
        left: dialogRect.left,
        top: dialogRect.top,
        bottom: dialogRect.bottom,
        width: dialogRect.width
      };
    }

    const composer = findReplyComposerContainer(editor);
    const composerControlRect = getReplyComposerControlsRect(composer);
    if (composerControlRect?.width >= 240) {
      return composerControlRect;
    }

    const textboxRoot = editor.closest('[data-testid^="tweetTextarea_"]') || editor;
    const textboxRect = textboxRoot.getBoundingClientRect();

    if (textboxRect.width >= 240) {
      return textboxRect;
    }

    if (dialogRect?.width) {
      const leftOffset = Math.min(64, Math.max(24, dialogRect.width * 0.12));
      return {
        left: dialogRect.left + leftOffset,
        top: textboxRect.top || dialogRect.top + 120,
        bottom: textboxRect.bottom || dialogRect.top + 190,
        width: Math.max(320, dialogRect.width - leftOffset - 24)
      };
    }

    return textboxRect;
  }

  function getReplyComposerControlsRect(composer) {
    if (!composer) {
      return null;
    }

    const candidates = [
      findComposerActionRow(composer),
      findComposerToolbar(composer),
      findComposerSubmitButton(composer),
      composer.querySelector?.(DRAFT_ACTIONS_HOST_SELECTOR)
    ].filter((element) => element && isVisibleElement(element));

    if (!candidates.length) {
      return null;
    }

    return unionElementRects(candidates);
  }

  function unionElementRects(elements) {
    const rects = elements
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    if (!rects.length) {
      return null;
    }

    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return {
      left,
      top,
      bottom,
      width: right - left
    };
  }

  function resolveLiveReplyEditor(editor) {
    return findVisibleDialogReplyEditor()
      || (editor && isVisibleElement(editor) ? editor : null);
  }

  function findVisibleReplyDialog(editor) {
    const currentDialog = editor?.closest?.('[role="dialog"]');
    if (currentDialog && isVisibleElement(currentDialog)) {
      return currentDialog;
    }

    return Array.from(document.querySelectorAll('[role="dialog"]'))
      .filter((dialog) => isVisibleElement(dialog) && dialog.querySelector(REPLY_EDITOR_SELECTOR))
      .at(-1)
      || null;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function setReplySuggestionsPanelLoading(panel, phase = "generating") {
    clearReplySuggestionsPanelProgress(panel);
    panel.innerHTML = "";
    panel.classList.remove("is-noninteractive-status");
    panel.setAttribute("aria-busy", "true");
    const header = createReplySuggestionsHeader(panel);
    const body = document.createElement("div");
    const status = document.createElement("div");
    const progress = document.createElement("div");
    const progressBar = document.createElement("div");
    const steps = getReplySuggestionsLoadingSteps(phase);
    const draftAction = getDraftActionFromLoadingPhase(phase);
    const isDraftAction = Boolean(draftAction);
    let stepIndex = 0;

    body.className = "xtension-reply-suggestions-status";
    body.classList.add("xtension-reply-suggestions-loading");
    status.className = "xtension-reply-suggestions-loading-text";
    progress.className = "xtension-reply-suggestions-progress";
    progressBar.className = "xtension-reply-suggestions-progress-bar";
    progress.classList.toggle("is-determinate", isDraftAction);
    progressBar.classList.toggle("is-determinate", isDraftAction);

    progress.append(progressBar);
    body.append(status, progress);

    if (isDraftAction) {
      const list = createDraftActionProgressList(steps);
      body.append(list);
      startDraftActionProgress(panel, draftAction, status, progressBar, steps, list);
    } else {
      const skeletons = createReplySuggestionsSkeletonList();
      body.append(skeletons);
      const updateStep = () => {
        status.textContent = steps[stepIndex] || steps.at(-1) || "";
        stepIndex += 1;
        if (stepIndex < steps.length) {
          panel._xtensionReplyProgressTimer = window.setTimeout(updateStep, 1400);
        } else {
          panel._xtensionReplyProgressTimer = null;
        }
      };

      updateStep();
    }

    panel.append(header, body);
    positionReplySuggestionsPanel(panel._xtensionReplyEditor, panel);
  }

  function createReplySuggestionsSkeletonList() {
    const skeletons = document.createElement("div");
    skeletons.className = "xtension-reply-suggestions-skeleton-list";

    for (let index = 0; index < 3; index += 1) {
      const card = document.createElement("div");
      const title = document.createElement("div");
      const lineA = document.createElement("div");
      const lineB = document.createElement("div");

      card.className = "xtension-reply-suggestions-skeleton";
      title.className = "xtension-reply-suggestions-skeleton-title";
      lineA.className = "xtension-reply-suggestions-skeleton-line";
      lineB.className = "xtension-reply-suggestions-skeleton-line is-short";
      card.append(title, lineA, lineB);
      skeletons.append(card);
    }

    return skeletons;
  }

  function createDraftActionProgressList(steps) {
    const list = document.createElement("ol");
    list.className = "xtension-draft-action-progress-list";

    steps.forEach((step, index) => {
      const item = document.createElement("li");
      item.className = "xtension-draft-action-progress-step";
      item.setAttribute("data-xtension-progress-step", String(index));
      item.textContent = step;
      list.append(item);
    });

    return list;
  }

  function startDraftActionProgress(panel, action, status, progressBar, steps, list) {
    const actionId = normalizeDraftAction(action);
    const baselineMs = DEFAULT_DRAFT_ACTION_DURATION_MS[actionId] || DEFAULT_DRAFT_ACTION_DURATION_MS.correct;
    const estimatedMs = Math.max(baselineMs, getDraftActionEstimatedDuration(action));
    const startedAt = Date.now();
    const pendingStepCount = Math.max(1, steps.length - 2);
    const stepRatios = getDraftActionProgressStepRatios(pendingStepCount);

    panel._xtensionDraftActionProgress = {
      action: actionId,
      status,
      progressBar,
      steps,
      list,
      startedAt,
      estimatedMs,
      pendingStepCount,
      stepRatios,
      manualStage: "",
      currentIndex: -1,
      lastProgress: 7
    };

    const tick = () => {
      const state = panel._xtensionDraftActionProgress;
      if (!state || state.manualStage) {
        return;
      }

      const elapsedMs = Date.now() - state.startedAt;
      const elapsedRatio = Math.max(0, elapsedMs / state.estimatedMs);
      const index = getDraftActionScheduledStepIndex(state.stepRatios, elapsedRatio);
      const easedRatio = 1 - Math.pow(1 + elapsedRatio * 2.4, -2);
      const targetProgress = clamp(7 + easedRatio * 90, 7, 98.6);
      const creepStep = state.lastProgress < 84 ? 0.72 : state.lastProgress < 94 ? 0.32 : 0.08;
      const progressValue = clamp(Math.max(targetProgress, state.lastProgress + creepStep), 7, 98.6);
      updateDraftActionProgress(panel, index, progressValue);
      panel._xtensionReplyProgressTimer = window.setTimeout(tick, 250);
    };

    updateDraftActionProgress(panel, 0, 7);
    panel._xtensionReplyProgressTimer = window.setTimeout(tick, 250);
  }

  function getDraftActionProgressStepRatios(count) {
    if (count <= 1) {
      return [0];
    }

    if (count === 5) {
      return [0, 0.16, 0.46, 0.74, 0.9];
    }

    return Array.from({ length: count }, (_, index) => {
      const ratio = index / Math.max(1, count - 1);
      return clamp(Math.pow(ratio, 1.35) * 0.9, 0, 0.9);
    });
  }

  function getDraftActionScheduledStepIndex(stepRatios, elapsedRatio) {
    const ratios = Array.isArray(stepRatios) && stepRatios.length ? stepRatios : [0];
    let index = 0;

    for (let itemIndex = 0; itemIndex < ratios.length; itemIndex += 1) {
      if (elapsedRatio >= ratios[itemIndex]) {
        index = itemIndex;
      }
    }

    return index;
  }

  async function markDraftActionPanelProgress(panel, stage) {
    const state = panel?._xtensionDraftActionProgress;
    if (!state) {
      return;
    }

    if (panel._xtensionReplyProgressTimer) {
      window.clearTimeout(panel._xtensionReplyProgressTimer);
      panel._xtensionReplyProgressTimer = null;
    }

    state.manualStage = stage;
    if (stage === "response") {
      await showDraftActionProgressThrough(panel, Math.max(0, state.steps.length - 2), Math.max(state.lastProgress || 0, 98.8), 180);
      return;
    }
    if (stage === "insert") {
      await showDraftActionProgressThrough(panel, state.steps.length - 1, Math.max(state.lastProgress || 0, 99.4), 160);
      return;
    }
    if (stage === "done") {
      updateDraftActionProgress(panel, state.steps.length - 1, 100);
    }
  }

  async function showDraftActionProgressThrough(panel, targetIndex, targetProgress, visibleMs) {
    const state = panel?._xtensionDraftActionProgress;
    if (!state || !state.steps.length) {
      return;
    }

    const normalizedTarget = Math.max(0, Math.min(targetIndex, state.steps.length - 1));
    const current = Math.max(-1, state.currentIndex);
    if (current >= normalizedTarget) {
      updateDraftActionProgress(panel, current, targetProgress);
      await delay(Math.min(visibleMs, 180));
      return;
    }

    for (let index = current + 1; index <= normalizedTarget; index += 1) {
      const ratio = index / Math.max(1, state.steps.length - 1);
      const progress = Math.max(state.lastProgress || 0, Math.min(targetProgress, 9 + ratio * (targetProgress - 9)));
      updateDraftActionProgress(panel, index, progress);
      await delay(visibleMs);
    }
  }

  function updateDraftActionProgress(panel, index, progressValue) {
    const state = panel?._xtensionDraftActionProgress;
    if (!state || !state.steps.length) {
      return;
    }

    const normalizedIndex = Math.max(0, Math.min(index, state.steps.length - 1));
    const monotonicIndex = Math.max(state.currentIndex || 0, normalizedIndex);
    if (state.currentIndex !== monotonicIndex) {
      state.currentIndex = monotonicIndex;
      const stepText = state.steps[monotonicIndex] || "";
      state.status.textContent = `${stepText} (${monotonicIndex + 1}/${state.steps.length})`;
      Array.from(state.list?.children || []).forEach((item, itemIndex) => {
        item.classList.toggle("is-complete", itemIndex < monotonicIndex);
        item.classList.toggle("is-current", itemIndex === monotonicIndex);
      });
    }

    const normalizedProgress = clamp(Number(progressValue) || 0, 0, 100);
    state.lastProgress = Math.max(state.lastProgress || 0, normalizedProgress);
    state.progressBar.style.width = `${state.lastProgress.toFixed(state.lastProgress >= 99.5 ? 0 : 1)}%`;
  }

  function getReplySuggestionsLoadingSteps(phase) {
    if (phase === "draft-correct") {
      return [
        localizedText("draftActionLoadingRead", "Reading the draft..."),
        localizedText("draftActionLoadingPrepareCorrect", "Preparing correction instructions..."),
        localizedText("draftActionLoadingSendCorrect", "Sending request to the AI..."),
        localizedText("draftActionLoadingAiCorrect", "AI is correcting grammar and syntax..."),
        localizedText("draftActionLoadingCheckCorrect", "Checking corrected text..."),
        localizedText("draftActionLoadingPrepareInsert", "Preparing insertion..."),
        localizedText("draftActionLoadingInsertCorrect", "Applying the correction...")
      ];
    }

    if (phase === "draft-translate") {
      return [
        localizedText("draftActionLoadingRead", "Reading the draft..."),
        localizedText("draftActionLoadingPrepareTranslate", "Preparing target language..."),
        localizedText("draftActionLoadingSendTranslate", "Sending request to the AI..."),
        localizedText("draftActionLoadingAiTranslate", "AI is translating the text..."),
        localizedText("draftActionLoadingCheckTranslate", "Checking translated text..."),
        localizedText("draftActionLoadingPrepareInsert", "Preparing insertion..."),
        localizedText("draftActionLoadingInsertTranslate", "Applying the translation...")
      ];
    }

    if (phase === "draft-generate") {
      return [
        localizedText("draftActionLoadingRead", "Reading the draft..."),
        localizedText("draftActionLoadingPrepareGenerate", "Preparing writing context..."),
        localizedText("draftActionLoadingSendGenerate", "Sending request to the AI..."),
        localizedText("draftActionLoadingAiGenerate", "AI is drafting the reply..."),
        localizedText("draftActionLoadingCheckGenerate", "Checking tone and length..."),
        localizedText("draftActionLoadingPrepareInsert", "Preparing insertion..."),
        localizedText("draftActionLoadingInsertGenerate", "Applying the generated text...")
      ];
    }

    if (phase === "preparing") {
      return [
        localizedText("replySuggestionsPreparing", "Reading the post..."),
        localizedText("replySuggestionsLoadingAnalyze", "Understanding the context...")
      ];
    }

    return [
      localizedText("replySuggestionsLoading", "Generating replies..."),
      localizedText("replySuggestionsLoadingStance", "Choosing a clear stance..."),
      localizedText("replySuggestionsLoadingWriting", "Writing postable replies..."),
      localizedText("replySuggestionsLoadingFinalizing", "Checking tone and facts...")
    ];
  }

  function getDraftActionFromLoadingPhase(phase) {
    const normalized = cleanText(phase).toLowerCase();
    if (normalized === "draft-correct") {
      return "correct";
    }
    if (normalized === "draft-translate") {
      return "translate";
    }
    if (normalized === "draft-generate") {
      return "generate";
    }
    return "";
  }

  function getDraftActionEstimatedDuration(action) {
    const actionId = normalizeDraftAction(action);
    const value = Number(window.__xtensionDraftActionEstimatedMs?.[actionId] || 0);
    return Number.isFinite(value) && value > 0
      ? value
      : DEFAULT_DRAFT_ACTION_DURATION_MS[actionId] || DEFAULT_DRAFT_ACTION_DURATION_MS.correct;
  }

  function clearReplySuggestionsPanelProgress(panel) {
    if (panel?._xtensionReplyProgressTimer) {
      window.clearTimeout(panel._xtensionReplyProgressTimer);
      panel._xtensionReplyProgressTimer = null;
    }
    panel?.querySelectorAll?.(".xtension-reply-suggestion").forEach(clearReplySuggestionOptionProgress);
    if (panel?._xtensionReplyAutoCloseTimer) {
      window.clearTimeout(panel._xtensionReplyAutoCloseTimer);
      panel._xtensionReplyAutoCloseTimer = null;
    }
    panel?.removeAttribute?.("aria-busy");
  }

  function showDraftActionPanelLoading(editor, action) {
    const target = findEditableReplyEditor(editor) || editor;
    const existingPanel = document.querySelector(REPLY_SUGGESTIONS_PANEL_SELECTOR);
    const panel = existingPanel || createReplySuggestionsPanel(target);

    panel._xtensionReplyEditor = target;
    setReplySuggestionsPanelLoading(panel, `draft-${normalizeDraftAction(action)}`);
    if (!panel.isConnected) {
      placeReplySuggestionsPanel(target, panel);
    } else {
      positionReplySuggestionsPanel(target, panel);
    }

    return panel;
  }

  function setDraftActionPanelMessage(panel, message, detail = "", options = {}) {
    if (!panel) {
      return;
    }

    clearReplySuggestionsPanelProgress(panel);
    panel.innerHTML = "";
    panel.classList.toggle("is-noninteractive-status", Boolean(options.nonInteractive));
    const header = createReplySuggestionsHeader(panel);
    const body = document.createElement("div");

    body.className = "xtension-reply-suggestions-status";
    body.classList.toggle("is-success", options.tone === "success");
    body.classList.toggle("is-warning", options.tone === "warning");
    body.classList.toggle("is-error", options.tone === "error");
    body.textContent = message;

    panel.append(header, body);

    if (detail) {
      const detailElement = document.createElement("div");
      detailElement.className = "xtension-reply-suggestions-error-detail";
      detailElement.textContent = detail;
      panel.append(detailElement);
    }

    positionReplySuggestionsPanel(panel._xtensionReplyEditor, panel);

    if (options.autoCloseMs) {
      panel._xtensionReplyAutoCloseTimer = window.setTimeout(() => {
        removeReplySuggestionsPanel(panel);
      }, options.autoCloseMs);
    }
  }

  function setReplySuggestionsPanelError(panel, code, errorMessage) {
    clearReplySuggestionsPanelProgress(panel);
    panel.innerHTML = "";
    panel.classList.remove("is-noninteractive-status");
    const header = createReplySuggestionsHeader(panel);
    const body = document.createElement("div");
    const detail = document.createElement("div");
    const configure = document.createElement("button");

    body.className = "xtension-reply-suggestions-status";
    body.textContent = code === "not_configured"
      ? localizedText("replyAiNotConfigured", "Configure local or connected AI in Xtension options first.")
      : localizedText("toastReplySuggestionsFailed", "Unable to generate reply suggestions.");

    detail.className = "xtension-reply-suggestions-error-detail";
    detail.textContent = errorMessage || "";

    configure.type = "button";
    configure.className = "xtension-reply-suggestions-configure";
    configure.textContent = localizedText("replyAiConfigureButton", "Open options");
    configure.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openExtensionOptions();
    });

    panel.append(header, body);
    if (detail.textContent) {
      panel.append(detail);
    }
    panel.append(configure);
    positionReplySuggestionsPanel(panel._xtensionReplyEditor, panel);
  }

  function normalizeReplyPromptProfilesForUi(profiles) {
    const input = Array.isArray(profiles) ? profiles : [];
    const defaults = [
      { index: 0, label: localizedReplyStyle("short") || "Short impact" },
      { index: 1, label: localizedReplyStyle("medium") || "Medium argument" },
      { index: 2, label: localizedReplyStyle("long") || "Longer argument" }
    ];

    return defaults.map((fallback, index) => {
      const raw = input[index] && typeof input[index] === "object" ? input[index] : {};
      return {
        index,
        label: cleanText(raw.label || raw.name || fallback.label) || fallback.label
      };
    });
  }

  function setReplySuggestionsPanelStreaming(panel, editor, profiles) {
    clearReplySuggestionsPanelProgress(panel);
    panel.innerHTML = "";
    panel.classList.remove("is-noninteractive-status");
    panel.setAttribute("aria-busy", "true");
    const header = createReplySuggestionsHeader(panel);
    const list = document.createElement("div");

    list.className = "xtension-reply-suggestions-list";
    profiles.forEach((profile, index) => {
      list.append(createStreamingReplyOption(panel, editor, profile, index));
    });

    panel.append(header, list);
    positionReplySuggestionsPanel(panel._xtensionReplyEditor || editor, panel);
  }

  function createStreamingReplyOption(panel, editor, profile, index) {
    const option = document.createElement("button");
    const style = document.createElement("span");
    const text = document.createElement("span");
    const progress = document.createElement("span");
    const progressBar = document.createElement("span");

    option.type = "button";
    option.className = "xtension-reply-suggestion is-loading";
    option.disabled = true;
    option.setAttribute("data-xtension-reply-suggestion-slot", String(index));
    style.className = "xtension-reply-suggestion-style";
    style.textContent = profile.label;
    text.className = "xtension-reply-suggestion-text";
    text.textContent = localizedText("replySuggestionsLoading", "Generating replies...");
    progress.className = "xtension-reply-suggestion-progress";
    progressBar.className = "xtension-reply-suggestion-progress-bar";

    progress.append(progressBar);
    option.append(style, text, progress);
    startReplySuggestionOptionProgress(option, profile, index);
    option.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const suggestion = option._xtensionSuggestion;
      if (!suggestion || panel._xtensionReplyPicking) {
        return;
      }

      const options = Array.from(panel.querySelectorAll(".xtension-reply-suggestion"));
      panel._xtensionReplyPicking = true;
      options.forEach((button) => {
        button.classList.remove("is-selected");
        button.disabled = true;
      });
      injectReplyDraft(panel._xtensionReplyEditor || editor, suggestion.text).then(() => {
        option.classList.add("is-selected");
      }).finally(() => {
        panel._xtensionReplyPicking = false;
        options.forEach((button) => {
          button.disabled = Boolean(!button._xtensionSuggestion);
        });
      });
    });

    return option;
  }

  function setReplySuggestionsPanelProfileReply(panel, editor, index, reply) {
    const option = panel?.querySelector?.(`[data-xtension-reply-suggestion-slot="${index}"]`);
    if (!option) {
      return;
    }

    panel.classList.remove("is-noninteractive-status");
    clearReplySuggestionOptionProgress(option);
    removeReplySuggestionOptionProgressBar(option);
    const suggestion = normalizeReplySuggestionForUi(reply, index);
    option._xtensionSuggestion = suggestion;
    option.classList.remove("is-loading", "is-error");
    option.disabled = false;
    const style = option.querySelector(".xtension-reply-suggestion-style");
    const text = option.querySelector(".xtension-reply-suggestion-text");
    if (style) {
      style.textContent = suggestion.style;
    }
    if (text) {
      text.textContent = suggestion.text;
    }
    positionReplySuggestionsPanel(panel._xtensionReplyEditor || editor, panel);
  }

  function setReplySuggestionsPanelProfileError(panel, index, message) {
    const option = panel?.querySelector?.(`[data-xtension-reply-suggestion-slot="${index}"]`);
    if (!option) {
      return;
    }

    panel.classList.remove("is-noninteractive-status");
    clearReplySuggestionOptionProgress(option);
    removeReplySuggestionOptionProgressBar(option);
    option._xtensionSuggestion = null;
    option.classList.remove("is-loading");
    option.classList.add("is-error");
    option.disabled = true;
    const text = option.querySelector(".xtension-reply-suggestion-text");
    if (text) {
      text.textContent = message || localizedText("toastReplySuggestionsFailed", "Unable to generate reply suggestions.");
    }
    positionReplySuggestionsPanel(panel._xtensionReplyEditor, panel);
  }

  function startReplySuggestionOptionProgress(option, profile, index) {
    clearReplySuggestionOptionProgress(option);
    const text = option.querySelector(".xtension-reply-suggestion-text");
    if (!text) {
      return;
    }

    const steps = getReplySuggestionOptionLoadingSteps(profile);
    const ratios = [0, 0.18, 0.48, 0.78, 0.92];
    const progressBar = option.querySelector(".xtension-reply-suggestion-progress-bar");
    const startedAt = Date.now() - Math.max(0, index || 0) * 120;
    const estimatedMs = DEFAULT_DRAFT_ACTION_DURATION_MS.generate;
    let currentIndex = -1;
    let lastProgress = 6;

    const tick = () => {
      const elapsedRatio = Math.max(0, (Date.now() - startedAt) / estimatedMs);
      let nextIndex = 0;
      for (let ratioIndex = 0; ratioIndex < ratios.length; ratioIndex += 1) {
        if (elapsedRatio >= ratios[ratioIndex]) {
          nextIndex = ratioIndex;
        }
      }
      nextIndex = Math.min(nextIndex, steps.length - 1);
      if (nextIndex !== currentIndex) {
        currentIndex = nextIndex;
        text.textContent = steps[currentIndex] || steps.at(-1) || localizedText("replySuggestionsLoading", "Generating replies...");
      }
      if (progressBar) {
        const easedRatio = 1 - Math.pow(1 + elapsedRatio * 2.2, -2);
        const targetProgress = clamp(6 + easedRatio * 92, 6, 98.6);
        const creepStep = lastProgress < 76 ? 0.64 : lastProgress < 93 ? 0.28 : 0.08;
        lastProgress = clamp(Math.max(targetProgress, lastProgress + creepStep), 6, 98.6);
        progressBar.style.width = `${lastProgress.toFixed(lastProgress >= 98 ? 1 : 0)}%`;
      }
      option._xtensionReplySuggestionProgressTimer = window.setTimeout(tick, 350);
    };

    tick();
  }

  function clearReplySuggestionOptionProgress(option) {
    if (option?._xtensionReplySuggestionProgressTimer) {
      window.clearTimeout(option._xtensionReplySuggestionProgressTimer);
      option._xtensionReplySuggestionProgressTimer = null;
    }
  }

  function removeReplySuggestionOptionProgressBar(option) {
    option?.querySelector?.(".xtension-reply-suggestion-progress")?.remove();
  }

  function getReplySuggestionOptionLoadingSteps(profile) {
    return [
      localizedText("replySuggestionLoadingPrepare", "Preparing the prompt..."),
      localizedText("replySuggestionLoadingSend", "Sending request to the AI..."),
      localizedText("replySuggestionLoadingWrite", "AI is writing this reply..."),
      localizedText("replySuggestionLoadingReceive", "Receiving the reply..."),
      localizedText("replySuggestionLoadingCheck", "Checking the reply...")
    ];
  }

  function finishReplySuggestionsPanelStreaming(panel) {
    clearReplySuggestionsPanelProgress(panel);
    panel?.removeAttribute?.("aria-busy");
  }

  function setReplySuggestionsPanelReplies(panel, editor, replies) {
    clearReplySuggestionsPanelProgress(panel);
    panel.innerHTML = "";
    panel.classList.remove("is-noninteractive-status");
    const header = createReplySuggestionsHeader(panel);
    const list = document.createElement("div");

    list.className = "xtension-reply-suggestions-list";

    replies.slice(0, 5).forEach((reply, index) => {
      const suggestion = normalizeReplySuggestionForUi(reply, index);
      const option = document.createElement("button");
      const style = document.createElement("span");
      const text = document.createElement("span");

      option.type = "button";
      option.className = "xtension-reply-suggestion";
      style.className = "xtension-reply-suggestion-style";
      style.textContent = suggestion.style;
      text.className = "xtension-reply-suggestion-text";
      text.textContent = suggestion.text;

      option.append(style, text);
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (panel._xtensionReplyPicking) {
          return;
        }

        const options = Array.from(list.querySelectorAll(".xtension-reply-suggestion"));
        panel._xtensionReplyPicking = true;
        options.forEach((button) => {
          button.classList.remove("is-selected");
          button.disabled = true;
        });
        injectReplyDraft(panel._xtensionReplyEditor || editor, suggestion.text).then(() => {
          option.classList.add("is-selected");
        }).finally(() => {
          panel._xtensionReplyPicking = false;
          options.forEach((button) => {
            button.disabled = false;
          });
        });
      });
      list.append(option);
    });

    if (!list.children.length) {
      setReplySuggestionsPanelError(panel, "empty");
      return;
    }

    panel.append(header, list);
    positionReplySuggestionsPanel(panel._xtensionReplyEditor, panel);
  }

  function normalizeReplySuggestionForUi(reply, index) {
    if (reply && typeof reply === "object") {
      return {
        style: resolveReplyStyleLabel(reply, index),
        text: sanitizeDisplayedReplyText(reply.text || reply.reply || reply.content || reply.message || "")
      };
    }

    const text = sanitizeDisplayedReplyText(reply);
    const match = text.match(/^([^:]{2,60}):\s+(.+)$/);
    if (match) {
      const styleId = inferReplyStyleId(match[1]);
      return {
        style: styleId ? localizedReplyStyle(styleId) : cleanText(match[1]),
        text: sanitizeDisplayedReplyText(match[2])
      };
    }

    return {
      style: localizedTemplate("replyStyleOption", { number: index + 1 }, `Option ${index + 1}`),
      text
    };
  }

  function sanitizeDisplayedReplyText(value) {
    return cleanText(value).replace(PROHIBITED_REPLY_SYMBOL_PATTERN, ",");
  }

  function resolveReplyStyleLabel(reply, index) {
    const styleId = cleanText(reply.styleId || reply.style_id || reply.type || "");
    if (styleId) {
      const localized = localizedReplyStyle(styleId);
      if (localized) {
        return localized;
      }
    }

    const rawStyle = cleanText(reply.style || reply.angle || reply.label || "");
    const inferredStyle = inferReplyStyleId(rawStyle);
    if (inferredStyle) {
      return localizedReplyStyle(inferredStyle);
    }

    return rawStyle || localizedTemplate("replyStyleOption", { number: index + 1 }, `Option ${index + 1}`);
  }

  function localizedReplyStyle(styleId) {
    const normalized = cleanText(styleId).toLowerCase();
    const keys = {
      argument: "replyStyleArgument",
      reaction: "replyStyleReaction",
      support: "replyStyleSupport",
      short: "replyStyleShort",
      medium: "replyStyleMedium",
      long: "replyStyleLong",
      humor: "replyStyleHumor",
      sharp: "replyStyleSharp",
      useful: "replyStyleUseful",
      question: "replyStyleQuestion",
      codex: "replyStyleCodex",
      callout: "replyStyleCallout",
      custom: "replyStyleCustom"
    };
    const key = keys[normalized];
    return key ? localizedText(key, "") : "";
  }

  function inferReplyStyleId(value) {
    const style = cleanText(value).toLowerCase();

    if (/short|court|courte|punchy|brief/.test(style)) {
      return "short";
    }
    if (/medium|moyen|moyenne|balanced/.test(style)) {
      return "medium";
    }
    if (/long|longue|detailed|développ|developp/.test(style)) {
      return "long";
    }
    if (/argument|reason|raison|preuve|pourquoi/.test(style)) {
      return "argument";
    }
    if (/reaction|réaction|human|humain|instinct|gut|take/.test(style)) {
      return "reaction";
    }
    if (/callout|call out|dénonc|denonc|scandale/.test(style)) {
      return "callout";
    }
    if (/support|agree|accord|positif|positive|soutien/.test(style)) {
      return "support";
    }
    if (/humou?r|joke|funny|meme|vanne|dr[oô]le/.test(style)) {
      return "humor";
    }
    if (/sharp|contrarian|angle|direct|malin|tranch/.test(style)) {
      return "sharp";
    }
    if (/useful|context|takeaway|utile|contexte/.test(style)) {
      return "useful";
    }
    if (/question|relance|engag|conversation/.test(style)) {
      return "question";
    }
    if (/codex|search|recherche/.test(style)) {
      return "codex";
    }

    return "";
  }

  function openExtensionOptions() {
    sendRuntimeMessage({ type: "xtension-open-options" }).then((response) => {
      if (!response?.ok) {
        throw new Error(response?.error || "");
      }
    }).catch(() => {
      showToast(localizedText("replyAiOptionsUnavailable", "Open the extension options to configure the reply provider."));
    });
  }

  async function transformReplyText(action, text, editor) {
    const actionId = normalizeDraftAction(action);
    const definition = getDraftActionDefinition(actionId);
    const context = await getReplyDraftContext(editor);
    const targetLanguage = await getDraftActionTargetLanguage(actionId, context, text);

    const response = await sendRuntimeMessage({
      type: definition.messageType,
      locale: getUiLocale(),
      targetLanguage,
      context,
      text
    });

    if (!response?.ok) {
      throw new Error(response?.error || localizedText(definition.failedKey, definition.failedFallback));
    }

    return cleanText(response[definition.responseKey] || response.text || "");
  }

  async function getReplyDraftContext(editor) {
    const target = findEditableReplyEditor(editor) || editor;
    if (target?._xtensionReplyContext) {
      return target._xtensionReplyContext;
    }

    const tweet = findReplySourceTweet(target);
    if (tweet) {
      const context = await collectReplySuggestionContext(tweet);
      if (target) {
        target._xtensionReplyContext = context;
      }
      return context;
    }

    return {
      tweetLanguage: getUiLocale(),
      tweetText: ""
    };
  }

  function findReplySourceTweet(editor) {
    const dialog = findVisibleReplyDialog(editor);
    if (dialog) {
      return Array.from(dialog.querySelectorAll('article[data-testid="tweet"]'))
        .find((tweet) => !tweet.contains(editor) && findPrimaryTweetText(tweet))
        || null;
    }

    const article = editor?.closest?.('article[data-testid="tweet"]');
    if (article && findPrimaryTweetText(article)) {
      return article;
    }

    return findNearestPreviousTweetForReplyEditor(editor);
  }

  function findNearestPreviousTweetForReplyEditor(editor) {
    const composer = findReplyComposerContainer(editor);
    const boundary = composer?.closest?.('[data-testid="primaryColumn"], main, [role="main"]') || document;
    const composerRect = (composer || editor)?.getBoundingClientRect?.();
    if (!composerRect) {
      return null;
    }

    return Array.from(boundary.querySelectorAll('article[data-testid="tweet"]'))
      .filter((tweet) => {
        const rect = tweet.getBoundingClientRect();
        return isVisibleElement(tweet)
          && findPrimaryTweetText(tweet)
          && rect.bottom <= composerRect.top + 8
          && !tweet.contains(editor);
      })
      .sort((first, second) => second.getBoundingClientRect().bottom - first.getBoundingClientRect().bottom)[0]
      || null;
  }

  async function getDraftActionTargetLanguage(action, context, draftText) {
    const generationLanguage = await getDraftGenerationLanguage();
    if (generationLanguage !== "auto") {
      return generationLanguage;
    }

    return cleanText(context?.tweetLanguage || inferDraftLanguage(draftText) || getUiLocale() || "en");
  }

  function normalizeDraftAction(action) {
    const value = cleanText(action).toLowerCase();
    return ["correct", "translate", "generate", "suggestions"].includes(value) ? value : "correct";
  }

  function getDraftActionDefinition(action) {
    const actionId = normalizeDraftAction(action);
    return getDraftActionDefinitions().find((definition) => definition.id === actionId) || getDraftActionDefinitions()[0];
  }

  async function getDraftGenerationLanguage() {
    const stored = await storageGet({
      [DRAFT_GENERATION_LANGUAGE_STORAGE_KEY]: getDefaultDraftGenerationLanguage()
    });
    return normalizeDraftGenerationLanguage(stored[DRAFT_GENERATION_LANGUAGE_STORAGE_KEY]);
  }

  function getDefaultDraftGenerationLanguage() {
    const uiLanguage = getUiLocale().toLowerCase().split("-")[0];
    return DRAFT_GENERATION_LANGUAGES.some((language) => language.id === uiLanguage && language.id !== "auto")
      ? uiLanguage
      : "auto";
  }

  function normalizeDraftGenerationLanguage(value) {
    const normalized = cleanText(value).toLowerCase();
    return DRAFT_GENERATION_LANGUAGES.some((language) => language.id === normalized) ? normalized : getDefaultDraftGenerationLanguage();
  }

  function storageGet(defaults) {
    return new Promise((resolve) => {
      const storage = EXTENSION_API?.storage?.local;
      if (!storage?.get) {
        resolve(defaults || {});
        return;
      }

      try {
        const maybePromise = storage.get(defaults, (result) => {
          resolve(result || defaults || {});
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then((result) => resolve(result || defaults || {}), () => resolve(defaults || {}));
        }
      } catch (error) {
        if (isExtensionContextInvalidatedError(error)) {
          markExtensionContextInvalidated();
        }

        resolve(defaults || {});
      }
    });
  }

  function storageSet(values) {
    return new Promise((resolve) => {
      const storage = EXTENSION_API?.storage?.local;
      if (!storage?.set) {
        resolve(false);
        return;
      }

      try {
        const maybePromise = storage.set(values, () => resolve(true));
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(() => resolve(true), () => resolve(false));
        }
      } catch (error) {
        if (isExtensionContextInvalidatedError(error)) {
          markExtensionContextInvalidated();
        }

        resolve(false);
      }
    });
  }

  async function getDraftActionTiming(action) {
    const actionId = normalizeDraftAction(action);
    const defaults = { [DRAFT_ACTION_TIMINGS_STORAGE_KEY]: {} };
    const stored = await storageGet(defaults);
    const timings = stored[DRAFT_ACTION_TIMINGS_STORAGE_KEY] || {};
    const entry = timings[actionId] || {};
    const averageMs = Number(entry.averageMs || 0);

    return {
      averageMs: Number.isFinite(averageMs) && averageMs > 0
        ? averageMs
        : DEFAULT_DRAFT_ACTION_DURATION_MS[actionId] || DEFAULT_DRAFT_ACTION_DURATION_MS.correct,
      count: Number(entry.count || 0)
    };
  }

  async function recordDraftActionTiming(action, durationMs) {
    const actionId = normalizeDraftAction(action);
    const measuredMs = Number(durationMs || 0);
    if (!Number.isFinite(measuredMs) || measuredMs < 500) {
      return false;
    }

    const defaults = { [DRAFT_ACTION_TIMINGS_STORAGE_KEY]: {} };
    const stored = await storageGet(defaults);
    const timings = stored[DRAFT_ACTION_TIMINGS_STORAGE_KEY] || {};
    const previous = timings[actionId] || {};
    const previousAverage = Number(previous.averageMs || 0);
    const previousCount = Math.max(0, Number(previous.count || 0));
    const averageMs = previousAverage > 0
      ? Math.round(previousAverage * 0.7 + measuredMs * 0.3)
      : Math.round(measuredMs);

    timings[actionId] = {
      averageMs: Math.max(3000, Math.min(90000, averageMs)),
      count: Math.min(50, previousCount + 1),
      lastMs: Math.round(measuredMs),
      updatedAt: Date.now()
    };

    setDraftActionEstimatedDuration(actionId, timings[actionId].averageMs);
    return storageSet({ [DRAFT_ACTION_TIMINGS_STORAGE_KEY]: timings });
  }

  function setDraftActionEstimatedDuration(action, averageMs) {
    const actionId = normalizeDraftAction(action);
    const measuredMs = Number(averageMs || 0);
    window.__xtensionDraftActionEstimatedMs = window.__xtensionDraftActionEstimatedMs || {};
    window.__xtensionDraftActionEstimatedMs[actionId] = Number.isFinite(measuredMs) && measuredMs > 0
      ? measuredMs
      : DEFAULT_DRAFT_ACTION_DURATION_MS[actionId] || DEFAULT_DRAFT_ACTION_DURATION_MS.correct;
  }

  function inferDraftLanguage(value) {
    const text = cleanText(value).toLowerCase();
    if (!text) {
      return "";
    }

    if (/[\u3040-\u30ff\u3400-\u9fff]/.test(text)) {
      return "ja";
    }
    if (/[àâæçéèêëîïôœùûüÿ]|\b(?:je|j'|tu|il|elle|nous|vous|ils|elles|pas|plus|très|tres|content|contre|pourquoi|parce|avec|sans|mais|donc|c'est|ce|ça|ca)\b/i.test(text)) {
      return "fr";
    }
    if (/[¿¡áéíóúñ]|\b(?:que|porque|para|con|sin|pero|estoy|quiero|deberia|debería)\b/i.test(text)) {
      return "es";
    }
    if (/[äöüß]|\b(?:ich|nicht|warum|weil|aber|mit|ohne|sollte)\b/i.test(text)) {
      return "de";
    }
    if (/\b(?:i|i'm|im|you|we|they|not|why|because|with|without|should|want|happy|angry)\b/i.test(text)) {
      return "en";
    }

    return "";
  }

  async function handleDraftActionButtonClick(button, editor, action) {
    const target = findEditableReplyEditor(editor);
    const actionId = normalizeDraftAction(action);
    const definition = getDraftActionDefinition(actionId);
    if (!target || button._xtensionDraftActionBusy) {
      return;
    }

    if (actionId === "suggestions") {
      await toggleReplySuggestionsForDraftEditor(target);
      return;
    }

    if (button._xtensionDraftActionOriginal) {
      const originalText = button._xtensionDraftActionOriginal;
      button._xtensionDraftActionOriginal = "";
      await injectReplyDraft(target, originalText);
      setDraftActionButtonState(button, actionId, "normal");
      return;
    }

    const currentText = getReplyEditorText(target);
    if (actionId === "generate") {
      const shown = await showReplySuggestionsForDraftEditor(target, {
        force: true,
        instruction: currentText
      });
      if (!shown) {
        const emptyMessage = localizedText("toastReplySuggestionsFailed", "Unable to generate reply suggestions.");
        showToast(emptyMessage);
      }
      return;
    }

    if (!currentText) {
      const emptyPanel = showDraftActionPanelLoading(target, actionId);
      setDraftActionPanelMessage(
        emptyPanel,
        localizedText(definition.emptyKey, definition.emptyFallback),
        "",
        { tone: "warning", autoCloseMs: 2600 }
      );
      showToast(localizedText(definition.emptyKey, definition.emptyFallback));
      return;
    }

    button._xtensionDraftActionBusy = true;
    const actionStartedAt = Date.now();
    const timing = await getDraftActionTiming(actionId);
    setDraftActionEstimatedDuration(actionId, timing.averageMs);
    const actionPanel = showDraftActionPanelLoading(target, actionId);
    const actionHost = button.closest(DRAFT_ACTIONS_HOST_SELECTOR);
    if (actionHost) {
      actionHost._xtensionDraftActionBusy = true;
    }
    const relatedButtons = getRelatedDraftActionButtons(button);
    relatedButtons.forEach((item) => {
      item.disabled = true;
    });
    button.classList.add("is-loading");
    const loadingMessage = localizedText(definition.loadingKey, definition.loadingFallback);
    setDraftActionButtonLabel(button, loadingMessage);
    const progressToast = showToast(loadingMessage, { persistent: true, role: "status" });

    try {
      const transformedText = await transformReplyText(actionId, currentText, target);
      await markDraftActionPanelProgress(actionPanel, "response");
      if (!transformedText || transformedText === currentText) {
        setDraftActionButtonState(button, actionId, "normal");
        const unchangedMessage = localizedText(definition.unchangedKey, definition.unchangedFallback);
        setDraftActionPanelMessage(actionPanel, unchangedMessage, "", { tone: "warning", autoCloseMs: 2600 });
        showToast(unchangedMessage);
        return;
      }

      clearOtherDraftActionUndoStates(button);
      button._xtensionDraftActionOriginal = currentText;
      await markDraftActionPanelProgress(actionPanel, "insert");
      const inserted = await injectReplyDraft(target, transformedText);
      if (!inserted) {
        throw new Error(localizedText("draftActionInsertFailed", "The text was generated but X did not accept the insertion."));
      }
      await markDraftActionPanelProgress(actionPanel, "done");
      recordDraftActionTiming(actionId, Date.now() - actionStartedAt).catch(() => {});
      setDraftActionButtonState(button, actionId, "undo");
      setDraftActionPanelMessage(
        actionPanel,
        localizedText(getDraftActionDoneKey(actionId), getDraftActionDoneFallback(actionId)),
        "",
        { tone: "success", autoCloseMs: 900, nonInteractive: true }
      );
      window.setTimeout(() => {
        showReplySuggestionsForDraftEditor(target, {
          force: true,
          instruction: getReplyEditorText(target)
        }).catch(() => {});
      }, 450);
    } catch (error) {
      setDraftActionButtonState(button, actionId, "normal");
      const errorMessage = error?.message || localizedText(definition.failedKey, definition.failedFallback);
      setDraftActionPanelMessage(actionPanel, localizedText(definition.failedKey, definition.failedFallback), errorMessage, { tone: "error" });
      showToast(errorMessage);
    } finally {
      relatedButtons.forEach((item) => {
        item.disabled = false;
      });
      button._xtensionDraftActionBusy = false;
      if (actionHost) {
        actionHost._xtensionDraftActionBusy = false;
      }
      if (progressToast?.isConnected) {
        progressToast.remove();
      }
    }
  }

  function getDraftActionDoneKey(action) {
    const actionId = normalizeDraftAction(action);
    if (actionId === "translate") {
      return "draftActionTranslationDone";
    }
    if (actionId === "generate") {
      return "draftActionGenerationDone";
    }
    return "draftActionCorrectionDone";
  }

  function getDraftActionDoneFallback(action) {
    const actionId = normalizeDraftAction(action);
    if (actionId === "translate") {
      return "Translation inserted.";
    }
    if (actionId === "generate") {
      return "Generated reply inserted.";
    }
    return "Correction applied.";
  }

  function clearOtherDraftActionUndoStates(button) {
    getRelatedDraftActionButtons(button).forEach((item) => {
      if (item === button) {
        return;
      }

      const actionId = item.getAttribute(DRAFT_ACTION_BUTTON_ATTRIBUTE);
      item._xtensionDraftActionOriginal = "";
      setDraftActionButtonState(item, actionId, "normal");
    });
  }

  function getRelatedDraftActionButtons(button) {
    const host = button.closest(DRAFT_ACTIONS_SELECTOR);
    return Array.from(host?.querySelectorAll(`[${DRAFT_ACTION_BUTTON_ATTRIBUTE}]`) || [button]);
  }

  function setDraftActionButtonState(button, action, state) {
    const actionId = normalizeDraftAction(action);
    if (state === "undo") {
      const label = localizedText("correctionUndoButtonLabel", "Undo");
      button.classList.add("is-undo");
      button.classList.remove("is-loading");
      setDraftActionButtonLabel(button, label);
      renderDraftActionButtonIcon(button, actionId);
      return;
    }

    const definition = getDraftActionDefinition(actionId);
    const label = localizedText(definition.labelKey, definition.fallback);
    button.classList.remove("is-undo");
    button.classList.remove("is-loading");
    setDraftActionButtonLabel(button, label);
    renderDraftActionButtonIcon(button, actionId);
  }

  function setDraftActionButtonLabel(button, label) {
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  async function injectReplyDraft(editor, message) {
    const trimmedMessage = cleanMultilineText(message);
    const target = findEditableReplyEditor(editor);

    if (!trimmedMessage || !target || target._xtensionReplyInjecting) {
      return false;
    }

    target._xtensionReplyInjecting = true;

    try {
      if (getReplyEditorText(target) === trimmedMessage) {
        dispatchReplyInput(target, trimmedMessage, "insertText");
        if (await waitForReplyDraftCommitted(target, trimmedMessage, 900)) {
          return true;
        }
      }

      await activateReplyEditor(target);
      if (!await clearReplyEditor(target)) {
        return false;
      }
      if (!await insertReplyText(target, trimmedMessage)) {
        return false;
      }
      if (!await verifyReplyTextInserted(target, trimmedMessage)) {
        await rewriteReplyEditorText(target, trimmedMessage);
      }
      if (await waitForReplyDraftCommitted(target, trimmedMessage, 900)) {
        return true;
      }

      if (!await rewriteReplyEditorText(target, trimmedMessage)) {
        return false;
      }
      return await waitForReplyDraftCommitted(target, trimmedMessage, 1200);
    } finally {
      window.setTimeout(() => {
        target._xtensionReplyInjecting = false;
      }, 350);
    }
  }

  function findEditableReplyEditor(editor) {
    if (editor?.matches?.('[contenteditable="true"]')) {
      return editor;
    }

    return editor?.querySelector?.('[contenteditable="true"]')
      || document.activeElement?.closest?.('[contenteditable="true"]')
      || null;
  }

  async function activateReplyEditor(editor) {
    editor.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    editor.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    editor.focus();
    editor.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    editor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    placeCaretAtEnd(editor);
    await nextFrame();
  }

  async function clearReplyEditor(editor) {
    const currentText = getReplyEditorText(editor);
    if (!currentText) {
      return true;
    }

    selectEditorContents(editor);
    const deleted = document.execCommand?.("delete", false);
    dispatchReplyInput(editor, "", "deleteContentBackward");
    await nextFrame();

    if (!deleted && getReplyEditorText(editor)) {
      selectEditorContents(editor);
      document.execCommand?.("delete", false);
      dispatchReplyInput(editor, "", "deleteContentBackward");
      await nextFrame();
    }

    return !getReplyEditorText(editor);
  }

  async function insertReplyText(editor, message) {
    placeCaretAtEnd(editor);

    if (dispatchReplyPaste(editor, message)) {
      await nextFrame();
      if (getReplyEditorText(editor).includes(message)) {
        dispatchReplyInput(editor, message, "insertFromPaste");
        return true;
      }
    }

    const inserted = document.execCommand?.("insertText", false, message);
    await nextFrame();
    if (inserted && getReplyEditorText(editor).includes(message)) {
      dispatchReplyInput(editor, message, "insertText");
      return true;
    }

    return false;
  }

  async function verifyReplyTextInserted(editor, message) {
    await nextFrame();
    let currentText = getReplyEditorText(editor);

    if (currentText === message) {
      dispatchReplyInput(editor, message, "insertText");
      return true;
    }

    if (currentText.includes(message) && currentText.length <= message.length + 2) {
      dispatchReplyInput(editor, message, "insertText");
      return true;
    }

    selectEditorContents(editor);
    document.execCommand?.("delete", false);
    document.execCommand?.("insertText", false, message);
    await nextFrame();
    currentText = getReplyEditorText(editor);

    if (currentText === message || (currentText.includes(message) && currentText.length <= message.length + 2)) {
      dispatchReplyInput(editor, message, "insertText");
      return true;
    }

    return false;
  }

  async function rewriteReplyEditorText(editor, message) {
    await activateReplyEditor(editor);
    selectEditorContents(editor);
    document.execCommand?.("delete", false);
    dispatchReplyInput(editor, "", "deleteContentBackward");
    await nextFrame();
    placeCaretAtEnd(editor);
    const inserted = document.execCommand?.("insertText", false, message);
    await nextFrame();
    if (inserted && getReplyEditorText(editor) === message) {
      dispatchReplyInput(editor, message, "insertText");
      return true;
    }

    return false;
  }

  async function waitForReplyDraftCommitted(editor, message, timeoutMs) {
    const deadline = Date.now() + Math.max(120, timeoutMs || 700);

    while (Date.now() <= deadline) {
      if (isReplyDraftCommitted(editor, message)) {
        return true;
      }
      await delay(80);
    }

    return isReplyDraftCommitted(editor, message);
  }

  function isReplyDraftCommitted(editor, message) {
    const currentText = getReplyEditorText(editor);
    if (currentText !== message && !(currentText.includes(message) && currentText.length <= message.length + 2)) {
      return false;
    }

    const composer = findReplyComposerContainer(editor);
    const submitButton = findComposerSubmitButton(composer);
    return !submitButton || !isDisabledButton(submitButton);
  }

  function dispatchReplyPaste(editor, message) {
    try {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", message);
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData
      });
      editor.dispatchEvent(event);
      return event.defaultPrevented;
    } catch (error) {
      return false;
    }
  }

  function dispatchReplyInput(editor, data, inputType) {
    const targets = Array.from(new Set([
      editor,
      editor?.closest?.('[data-testid^="tweetTextarea_"]')
    ].filter(Boolean)));

    for (const target of targets) {
      try {
        target.dispatchEvent(new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          data,
          inputType
        }));
        target.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          data,
          inputType
        }));
      } catch (error) {
        target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      }
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function getReplyEditorText(editor) {
    return cleanMultilineText(String(editor?.innerText || editor?.textContent || "").replace(/\u200b/g, ""));
  }

  function selectEditorContents(element) {
    const selection = window.getSelection?.();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function nextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function placeCaretAtEnd(element) {
    const selection = window.getSelection?.();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function isVisibleElement(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function shouldOfferPdfExport(dropdown, context) {
    const menuText = cleanText(dropdown.textContent);
    const hasArticleMenuItem = /\bArticle\b/i.test(menuText);
    const hasVisibleArticle = Boolean(
      document.querySelector('[data-testid="twitter-article-title"], ' + LONGFORM_SELECTOR)
    );

    return Boolean(
      context?.id
      && (hasStatusReference(dropdown) || looksLikePostMenu(dropdown) || hasArticleMenuItem || hasVisibleArticle)
    );
  }

  function resolveStatusContext(dropdown) {
    const contextFromMenu = findStatusContextInElement(dropdown);

    if (contextFromMenu) {
      return contextFromMenu;
    }

    const contextFromMarkup = parseStatusContextFromText(dropdown.innerHTML || dropdown.textContent || "");
    if (contextFromMarkup) {
      return contextFromMarkup;
    }

    if (isRecentMenuContext(lastMenuContext) && looksLikePostMenu(dropdown)) {
      return lastMenuContext.context;
    }

    if (looksLikePostMenu(dropdown) || looksLikeArticleMenu(dropdown)) {
      return parseStatusContext(window.location.href);
    }

    return null;
  }

  function rememberMenuTriggerContext(event) {
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const context = findStatusContextNearElement(target);
    if (!context?.id) {
      return;
    }

    lastMenuContext = {
      context,
      capturedAt: Date.now()
    };
  }

  function findStatusContextNearElement(element) {
    const linkContext = parseStatusContext(element.closest("a[href]")?.href);
    if (linkContext) {
      return linkContext;
    }

    const tweetContainer = element.closest('article[data-testid="tweet"], [data-testid="cellInnerDiv"]');
    if (tweetContainer) {
      return getTweetStatusContext(tweetContainer) || parseStatusContextFromText(tweetContainer.innerHTML || "");
    }

    return null;
  }

  function findStatusContextInElement(element) {
    const urls = Array.from(element.querySelectorAll("a[href]"), (link) => link.href);

    for (const url of urls) {
      const context = parseStatusContext(url);
      if (context) {
        return context;
      }
    }

    return null;
  }

  function hasStatusReference(dropdown) {
    return Boolean(
      findStatusContextInElement(dropdown)
      || parseStatusContextFromText(dropdown.innerHTML || dropdown.textContent || "")
    );
  }

  function isRecentMenuContext(capturedContext) {
    return Boolean(capturedContext?.context?.id && Date.now() - capturedContext.capturedAt < 10000);
  }

  function looksLikeArticleMenu(dropdown) {
    return /\bArticle\b|activit|engagement|int[eé]grer|embed/i.test(dropdown.textContent || "");
  }

  function looksLikePostMenu(dropdown) {
    return /post|tweet|activit|engagement|int[eé]grer|embed|r[eé]ponses masqu[eé]es|note de la communaut[eé]/i.test(dropdown.textContent || "");
  }

  function parseStatusContext(rawUrl) {
    try {
      const url = new URL(rawUrl, window.location.href);
      const directMatch = url.pathname.match(STATUS_PATH_PATTERN);

      if (directMatch) {
        const author = decodeURIComponent(directMatch[1]);
        const id = directMatch[2];

        return {
          author,
          id,
          url: `https://x.com/${author}/status/${id}`
        };
      }

      const nestedContentUrl = url.searchParams.get("content_id");
      if (nestedContentUrl && nestedContentUrl !== rawUrl) {
        return parseStatusContext(nestedContentUrl);
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function parseStatusContextFromText(value) {
    const variants = [String(value || "")];

    for (let index = 0; index < variants.length && index < 3; index += 1) {
      const current = variants[index];

      try {
        const decoded = decodeURIComponent(current);
        if (decoded !== current) {
          variants.push(decoded);
        }
      } catch (error) {
        // Keep scanning the original text if it is not valid URI-encoded data.
      }
    }

    for (const text of variants) {
      const match = text.match(/(?:https?:\/\/(?:x|twitter)\.com)?\/([A-Za-z0-9_]{1,20})\/status\/(\d+)/i);

      if (match) {
        const author = match[1];
        const id = match[2];

        return {
          author,
          id,
          url: `https://x.com/${author}/status/${id}`
        };
      }
    }

    return null;
  }

  function createMenuItem(dropdown, context) {
    const template = dropdown.querySelector('[role="menuitem"]');
    const templateSvg = template?.querySelector("svg");
    const templateSpan = template?.querySelector("span");
    const templateText = templateSpan?.parentElement;
    const templateLabel = templateText?.parentElement;
    const templateIcon = templateSvg?.parentElement;

    const item = document.createElement("div");
    item.setAttribute(MENU_ITEM_ATTRIBUTE, "true");
    item.setAttribute("role", "menuitem");
    item.tabIndex = 0;
    item.className = getClassName(template, "css-175oi2r r-18u37iz r-1mmae3n r-3pj75a r-13qz1uu r-1loqt21");
    item.style.color = "rgb(15, 20, 25)";

    const icon = document.createElement("div");
    icon.className = getClassName(templateIcon, "css-175oi2r r-1777fci");
    icon.setAttribute(MENU_ICON_ATTRIBUTE, "true");
    icon.style.color = "rgb(15, 20, 25)";
    icon.append(createPdfIcon(getClassName(templateSvg, "")));

    const label = document.createElement("div");
    label.className = getClassName(templateLabel, "css-175oi2r");
    label.style.color = "rgb(15, 20, 25)";

    const text = document.createElement("div");
    text.dir = "ltr";
    text.className = getClassName(templateText, "");
    text.style.color = "rgb(15, 20, 25)";

    const span = document.createElement("span");
    span.className = getClassName(templateSpan, "");
    span.style.color = "rgb(15, 20, 25)";
    span.textContent = MENU_LABEL;

    text.append(span);
    label.append(text);
    item.append(icon, label);

    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      exportCurrentArticle(context);
    }, true);

    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      exportCurrentArticle(context);
    }, true);

    return item;
  }

  function createPdfIcon(className) {
    const image = document.createElement("img");
    image.src = getExtensionResourceUrl(PDF_MENU_ICON_PATH);
    image.alt = "";
    image.decoding = "async";
    image.setAttribute("aria-hidden", "true");

    if (className) {
      image.className = className;
    }

    image.style.display = "block";
    image.style.height = "22px";
    image.style.objectFit = "contain";
    image.style.width = "22px";

    return image;
  }

  function getExtensionResourceUrl(path) {
    return getRuntimeResourceUrl(path) || path;
  }

  function findInsertionPoint(dropdown) {
    const directItems = Array.from(dropdown.children).filter((child) => {
      return child.getAttribute("role") === "menuitem";
    });

    const preferredItem = directItems.find((item) => {
      return /activit|engagement|int[eé]grer|embed/i.test(item.textContent || "");
    });

    return preferredItem || directItems[directItems.length - 1] || null;
  }

  function exportCurrentArticle(context) {
    showToast(localizedText("toastPreparingPdf", "Preparing the PDF..."), { persistent: true });

    const article = collectArticle(context);

    if (!article) {
      showToast(localizedText("toastContentNotFound", "No X content was found on this page."));
      return;
    }

    downloadArticleAsPdf(article).catch((error) => {
      showToast(error?.message || localizedText("toastPdfGenerationFailed", "Unable to generate the PDF."));
    });
  }

  function collectArticle(context) {
    const root = document.querySelector("main") || document.body;
    const titleElement = findArticleTitle(root, context);
    const longformBlocks = getLongformBlocks(root, titleElement);

    if (longformBlocks.length === 0) {
      return collectTweetThread(root, context);
    }

    const title = cleanText(titleElement?.textContent) || deriveTitleFromDocument();
    const parts = collectLongformParts(root, titleElement, longformBlocks);
    if (parts.length === 0) {
      return null;
    }

    const authorInfo = findArticleAuthorInfo(root, titleElement, context);

    return {
      title: title || localizedText("fallbackArticleTitle", "X article"),
      author: cleanHandle(authorInfo?.handle || context?.author || ""),
      authorInfo,
      kind: "article",
      sourceUrl: context?.url || window.location.href,
      publishedAt: findPublishedDate(root, titleElement),
      exportedAt: new Date(),
      parts
    };
  }

  function findArticleAuthorInfo(root, titleElement, context) {
    const candidates = uniqueElements([
      titleElement?.closest('article[data-testid="tweet"], article, [data-testid="cellInnerDiv"]'),
      findTweetContainerForContext(root, context, getTweetContainers(root)),
      root.querySelector('article[data-testid="tweet"], [data-testid="cellInnerDiv"]'),
      root
    ].filter(Boolean));

    for (const candidate of candidates) {
      const status = getTweetStatusContext(candidate, context) || context;
      const authorInfo = getTweetAuthorInfo(candidate, status);

      if (cleanAccountDisplayName(authorInfo.displayName) || authorInfo.handle) {
        return authorInfo;
      }
    }

    if (!context?.author) {
      return null;
    }

    return {
      avatarSrc: "",
      displayName: "",
      handle: cleanHandle(context.author),
      sourceUrl: context.url || ""
    };
  }

  function findArticleTitle(root, context) {
    const titles = Array.from(root.querySelectorAll('[data-testid="twitter-article-title"]'));

    if (titles.length < 2 || !context?.id) {
      return titles[0] || null;
    }

    return titles.find((title) => {
      const container = title.closest('article, [data-testid="cellInnerDiv"]') || title.parentElement;
      return Boolean(container?.querySelector(`a[href*="/status/${context.id}"]`));
    }) || titles[0] || null;
  }

  function getLongformBlocks(root, titleElement) {
    const blocks = Array.from(root.querySelectorAll(LONGFORM_SELECTOR)).filter((block) => {
      return cleanText(block.textContent).length > 0;
    });

    if (!titleElement) {
      return blocks;
    }

    return blocks.filter((block) => isElementAfter(titleElement, block));
  }

  function collectLongformParts(root, titleElement, longformBlocks) {
    const lastBlock = longformBlocks[longformBlocks.length - 1];
    const candidates = Array.from(root.querySelectorAll(`${LONGFORM_SELECTOR}, ${MEDIA_SELECTOR}, ${EMBEDDED_TWEET_SELECTOR}`));
    const mediaSeen = new Set();
    const parts = [];

    for (const candidate of candidates) {
      if (titleElement && !isElementAfter(titleElement, candidate)) {
        continue;
      }

      if (!isElementBeforeOrSame(candidate, lastBlock)) {
        continue;
      }

      if (candidate.matches(LONGFORM_SELECTOR)) {
        const part = longformPartFromElement(candidate);
        if (part) {
          parts.push(part);
        }
        continue;
      }

      if (candidate.matches(LINK_CARD_SELECTOR) && !isLikelyEmbeddedTweetCard(candidate, root)) {
        const linkCard = linkCardPartFromElement(candidate, mediaSeen);
        if (linkCard) {
          parts.push(linkCard);
        }
        continue;
      }

      if (isTopLevelEmbeddedTweetContainer(candidate, root)) {
        const embeddedParts = embeddedTweetPartsFromContainer(candidate, mediaSeen);
        if (embeddedParts.length > 0) {
          parts.push(...embeddedParts);
        }
        continue;
      }

      const embeddedAncestor = getEmbeddedTweetAncestor(candidate, root);
      if (embeddedAncestor && isTopLevelEmbeddedTweetContainer(embeddedAncestor, root)) {
        continue;
      }

      const mediaPart = mediaPartFromElement(candidate, mediaSeen);
      if (mediaPart) {
        parts.push(mediaPart);
      }
    }

    return parts;
  }

  function collectTweetThread(root, context) {
    const containers = getTweetContainers(root);

    if (containers.length === 0) {
      return null;
    }

    const selectedContainer = findTweetContainerForContext(root, context, containers) || containers[0];
    const selectedIndex = containers.indexOf(selectedContainer);

    if (selectedIndex < 0) {
      return null;
    }

    const selectedStatus = getTweetStatusContext(selectedContainer, context);
    const author = cleanHandle(selectedStatus?.author || context?.author || findHandleInTweet(selectedContainer));
    const normalizedAuthor = normalizeHandle(author);

    if (!normalizedAuthor) {
      return null;
    }

    let startIndex = selectedIndex;
    while (startIndex > 0 && isTweetFromAuthor(containers[startIndex - 1], normalizedAuthor)) {
      startIndex -= 1;
    }

    const mediaSeen = new Set();
    const tweets = [];

    for (let index = startIndex; index < containers.length; index += 1) {
      const container = containers[index];

      if (!isTweetFromAuthor(container, normalizedAuthor)) {
        if (tweets.length > 0) {
          break;
        }
        continue;
      }

      const tweetParts = collectTweetContainerParts(container, mediaSeen);

      if (tweetParts.parts.length === 0) {
        continue;
      }

      const status = getTweetStatusContext(container);
      tweets.push({
        authorInfo: getTweetAuthorInfo(container, status),
        parts: tweetParts.parts,
        text: tweetParts.text,
        publishedAt: findPublishedDateInContainer(container),
        sourceUrl: status?.url || ""
      });
    }

    if (tweets.length === 0) {
      return null;
    }

    return {
      title: "",
      author,
      authorInfo: tweets[0].authorInfo || null,
      kind: "tweet",
      sourceUrl: context?.url || tweets[0].sourceUrl || window.location.href,
      publishedAt: tweets[0].publishedAt,
      exportedAt: new Date(),
      parts: flattenThreadParts(tweets)
    };
  }

  function getTweetContainers(root) {
    const articleContainers = Array.from(root.querySelectorAll('article[data-testid="tweet"]')).filter((container) => {
      return !isNestedTweetContainer(container);
    });
    const rawContainers = articleContainers.length > 0
      ? articleContainers
      : Array.from(root.querySelectorAll('[data-testid="cellInnerDiv"]')).filter((container) => {
        return !isNestedTweetContainer(container);
      });

    return rawContainers.filter((container) => {
      return Boolean(
        getTweetStatusContext(container)
        || container.querySelector('[data-testid="tweetText"]')
        || container.querySelector(MEDIA_SELECTOR)
      );
    });
  }

  function isNestedTweetContainer(container) {
    const parent = container.parentElement;

    if (!parent) {
      return false;
    }

    if (container.matches('article[data-testid="tweet"]')) {
      return Boolean(parent.closest('article[data-testid="tweet"], [data-testid="quotedTweet"], [data-testid="card.wrapper"]'));
    }

    if (container.matches('[data-testid="cellInnerDiv"]')) {
      return Boolean(parent.closest('[data-testid="cellInnerDiv"], [data-testid="quotedTweet"], [data-testid="card.wrapper"]'));
    }

    return false;
  }

  function findTweetContainerForContext(root, context, containers = getTweetContainers(root)) {
    if (!context?.id) {
      return null;
    }

    return containers.find((candidate) => {
      return Boolean(candidate.querySelector(`a[href*="/status/${context.id}"]`));
    }) || null;
  }

  function isTweetFromAuthor(container, normalizedAuthor) {
    const author = cleanHandle(getTweetStatusContext(container)?.author || findHandleInTweet(container));
    return Boolean(author && normalizeHandle(author) === normalizedAuthor);
  }

  function getTweetStatusContext(container, preferredContext) {
    const contexts = [];
    const timeLink = container.querySelector("time[datetime]")?.closest("a[href]");
    const timeContext = parseStatusContext(timeLink?.href);

    if (timeContext) {
      contexts.push(timeContext);
    }

    for (const link of Array.from(container.querySelectorAll("a[href]"))) {
      const context = parseStatusContext(link.href);
      if (context) {
        contexts.push(context);
      }
    }

    if (preferredContext?.id) {
      const exactContext = contexts.find((context) => context.id === preferredContext.id);
      if (exactContext) {
        return exactContext;
      }
    }

    return contexts[0] || parseStatusContextFromText(container.innerHTML || "") || null;
  }

  function findHandleInTweet(container) {
    const userName = container.querySelector('[data-testid="User-Name"]');
    const match = cleanText(userName?.textContent).match(/@([A-Za-z0-9_]{1,20})/);
    return match ? match[1] : "";
  }

  function getTweetAuthorInfo(container, status) {
    const handle = cleanHandle(status?.author || findHandleInTweet(container));
    const userName = container.querySelector('[data-testid="User-Name"]');
    const rawNameText = cleanText(userName?.innerText || userName?.textContent)
      .replace(/\bCompte certifi[eé]\b/gi, "");
    let displayName = rawNameText;

    if (handle) {
      displayName = cleanText(displayName.replace(new RegExp(`@${escapeRegExp(handle)}.*$`, "i"), ""));
    }

    if (!displayName && handle && userName) {
      const profileLink = Array.from(userName.querySelectorAll("a[href]")).find((link) => {
        try {
          const url = new URL(link.href, window.location.href);
          return handle && url.pathname.replace(/^\/+/, "").toLowerCase() === handle.toLowerCase();
        } catch (error) {
          return false;
        }
      });
      displayName = cleanText(profileLink?.textContent).replace(new RegExp(`@${escapeRegExp(handle)}.*$`, "i"), "");
    }

    return {
      avatarSrc: findTweetAvatarSource(container),
      displayName: displayName || (handle ? `@${handle}` : "X"),
      handle,
      sourceUrl: status?.url || ""
    };
  }

  function findTweetAvatarSource(container) {
    const avatar = Array.from(container.querySelectorAll(PROFILE_IMAGE_SELECTOR)).find((candidate) => {
      return isPrimaryTweetDescendant(candidate, container) || container.contains(candidate);
    });

    return avatar ? getMediaSource(avatar) : "";
  }

  function cleanHandle(handle) {
    return cleanText(handle).replace(/^@+/, "");
  }

  function normalizeHandle(handle) {
    return cleanHandle(handle).toLowerCase();
  }

  function collectTweetContainerParts(container, mediaSeen) {
    const parts = [];
    const tweetTextElement = findPrimaryTweetText(container);
    const tweetStatus = getTweetStatusContext(container);
    const text = extractVisibleText(tweetTextElement);
    const html = normalizeInlineHtml(tweetTextElement ? serializeInlineContent(tweetTextElement) : "");

    if (text) {
      parts.push({
        type: "paragraph",
        html: html || escapeHtml(text),
        text
      });
    }

    for (const media of Array.from(container.querySelectorAll(MEDIA_SELECTOR))) {
      if (!isPrimaryTweetDescendant(media, container)) {
        continue;
      }

      if (isInsidePrimaryLinkCard(media, container)) {
        continue;
      }

      const mediaPart = mediaPartFromElement(media, mediaSeen, tweetStatus?.url || "");
      if (mediaPart) {
        parts.push(mediaPart);
      }
    }

    parts.push(...collectLinkCardParts(container, mediaSeen));
    parts.push(...collectEmbeddedTweetParts(container, mediaSeen));

    return {
      parts,
      text
    };
  }

  function collectEmbeddedTweetParts(container, mediaSeen) {
    const parts = [];
    const embeddedTweets = getEmbeddedTweetContainers(container);

    embeddedTweets.forEach((embeddedTweet) => {
      parts.push(...embeddedTweetPartsFromContainer(embeddedTweet, mediaSeen));
    });

    return parts;
  }

  function collectLinkCardParts(container, mediaSeen) {
    return Array.from(container.querySelectorAll(LINK_CARD_SELECTOR))
      .filter((card) => {
        return isPrimaryTweetDescendant(card, container)
          && !isLikelyEmbeddedTweetCard(card, container)
          && !getParentEmbeddedTweetContainer(card, container);
      })
      .map((card) => linkCardPartFromElement(card, mediaSeen))
      .filter(Boolean);
  }

  function isInsidePrimaryLinkCard(element, container) {
    const card = element.closest(LINK_CARD_SELECTOR);

    return Boolean(
      card
      && card !== container
      && container.contains(card)
      && isPrimaryTweetDescendant(card, container)
      && !isLikelyEmbeddedTweetCard(card, container)
    );
  }

  function linkCardPartFromElement(card, mediaSeen) {
    const url = findLinkCardUrl(card);
    const textParts = extractLinkCardText(card, url);
    const imageSrc = findLinkCardImageSource(card);

    if (!url && !textParts.title && !textParts.description && !imageSrc) {
      return null;
    }

    if (imageSrc && !mediaSeen.has(imageSrc)) {
      mediaSeen.add(imageSrc);
    }

    return {
      type: "link-card",
      description: textParts.description,
      domain: textParts.domain,
      imageSrc,
      src: imageSrc,
      title: textParts.title || textParts.domain || url,
      url
    };
  }

  function findLinkCardUrl(card) {
    const link = Array.from(card.querySelectorAll("a[href]")).find((candidate) => {
      return !parseStatusContext(candidate.href);
    }) || card.querySelector("a[href]");

    return normalizeLinkHref(link?.getAttribute("href") || link?.href || "");
  }

  function extractLinkCardText(card, url) {
    const detail = card.querySelector('[data-testid*="card.layout"][data-testid*=".detail"]');
    const textSource = detail || card;
    const values = uniqueStrings(
      Array.from(textSource.querySelectorAll(':scope > [dir="auto"], :scope > div, :scope > span'))
        .map((element) => cleanText(element.textContent))
        .filter((value) => value && value.length > 1)
    );
    const hostname = getHostname(url);
    const domain = values.find((value) => isLikelyDomainText(value)) || (hostname === "t.co" ? "" : hostname);
    const title = values.find((value) => value !== domain && !isLikelyDomainText(value)) || "";
    const description = values.find((value) => value !== domain && value !== title && value.length > title.length / 2) || "";

    return {
      description,
      domain,
      title
    };
  }

  function findLinkCardImageSource(card) {
    const image = card.querySelector(LINK_CARD_IMAGE_SELECTOR)
      || Array.from(card.querySelectorAll("img, div")).find((candidate) => {
        return /card_img|twimg\.com\/media|pbs\.twimg\.com\/media/i.test(getMediaSource(candidate));
      });

    return image ? getMediaSource(image) : "";
  }

  function embeddedTweetPartsFromContainer(embeddedTweet, mediaSeen) {
    const status = getTweetStatusContext(embeddedTweet)
      || findStatusContextInElement(embeddedTweet)
      || parseStatusContextFromText(embeddedTweet.innerHTML || "");
    const author = cleanHandle(status?.author || findHandleInTweet(embeddedTweet));
    const authorInfo = getTweetAuthorInfo(embeddedTweet, status);
    const directSourceUrl = status?.url || authorInfo.sourceUrl || "";
    const publishedAt = findPublishedDateInContainer(embeddedTweet);
    const tweetTextElement = findPrimaryTweetText(embeddedTweet);
    const text = extractVisibleText(tweetTextElement);
    const html = normalizeInlineHtml(tweetTextElement ? serializeInlineContent(tweetTextElement) : "");
    const sourceUrl = directSourceUrl || buildTweetSearchUrl(authorInfo.handle || author, text);
    const embeddedParts = [];

    if (text) {
      embeddedParts.push({
        type: "embedded-tweet-text",
        html: html || escapeHtml(text),
        text
      });
    }

    for (const media of Array.from(embeddedTweet.querySelectorAll(MEDIA_SELECTOR))) {
      if (!isPrimaryTweetDescendant(media, embeddedTweet)) {
        continue;
      }

      if (isInsidePrimaryLinkCard(media, embeddedTweet)) {
        continue;
      }

      const mediaPart = mediaPartFromElement(media, mediaSeen, sourceUrl);
      if (mediaPart) {
        embeddedParts.push(mediaPart);
      }
    }

    embeddedParts.push(...collectLinkCardParts(embeddedTweet, mediaSeen));

    if (embeddedParts.length === 0) {
      return [];
    }

    return [{
      type: "embedded-tweet-card",
      authorInfo: {
        avatarSrc: authorInfo.avatarSrc || "",
        displayName: authorInfo.displayName || (author ? `@${author}` : "X"),
        handle: authorInfo.handle || author,
        sourceUrl
      },
      publishedAt,
      sourceUrl,
      parts: embeddedParts
    }];
  }

  function buildTweetSearchUrl(author, text) {
    const handle = cleanHandle(author);
    const phrase = getTweetSearchPhrase(text);

    if (!handle && !phrase) {
      return "";
    }

    const query = [
      handle ? `from:${handle}` : "",
      phrase ? `"${phrase}"` : ""
    ].filter(Boolean).join(" ");
    const url = new URL("https://x.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("src", "typed_query");
    url.searchParams.set("f", "live");
    return url.href;
  }

  function getTweetSearchPhrase(text) {
    const cleaned = cleanText(text)
      .replace(/^["'“”«»]+/, "")
      .replace(/["'“”«»]+$/, "");

    if (!cleaned) {
      return "";
    }

    const sentence = cleaned.split(/[.!?\n]/).map((part) => cleanText(part)).find((part) => part.length >= 18) || cleaned;

    if (sentence.length <= 90) {
      return sentence;
    }

    return cleanText(sentence.slice(0, 90).replace(/\s+\S*$/, ""));
  }

  function getEmbeddedTweetContainers(container) {
    const explicitContainers = Array.from(container.querySelectorAll('[data-testid="quotedTweet"], [data-testid="card.wrapper"], article[data-testid="tweet"]'));
    const linkCards = Array.from(container.querySelectorAll('[role="link"]')).filter((candidate) => {
      return isLikelyEmbeddedTweetCard(candidate, container);
    });
    const candidates = uniqueElements([...explicitContainers, ...linkCards]).filter((candidate) => {
      return candidate !== container && container.contains(candidate) && isLikelyEmbeddedTweetCard(candidate, container);
    });

    return candidates.filter((candidate) => {
      return !candidates.some((other) => other !== candidate && other.contains(candidate));
    });
  }

  function isTopLevelEmbeddedTweetContainer(candidate, container) {
    return isLikelyEmbeddedTweetCard(candidate, container)
      && !getParentEmbeddedTweetContainer(candidate, container);
  }

  function getParentEmbeddedTweetContainer(element, container) {
    let parent = element?.parentElement;

    while (parent && parent !== container) {
      if (parent.matches(EMBEDDED_TWEET_SELECTOR) && isLikelyEmbeddedTweetCard(parent, container)) {
        if (parent.matches('article[data-testid="tweet"]') && !hasEmbeddingTweetParent(parent, container)) {
          parent = parent.parentElement;
          continue;
        }

        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }

  function hasEmbeddingTweetParent(element, container) {
    let parent = element?.parentElement;

    while (parent && parent !== container) {
      if (
        parent.matches('article[data-testid="tweet"], [data-testid="quotedTweet"], [data-testid="card.wrapper"]')
        && isLikelyEmbeddedTweetCard(parent, container)
      ) {
        return true;
      }

      parent = parent.parentElement;
    }

    return false;
  }

  function isLikelyEmbeddedTweetCard(candidate, container) {
    if (!candidate || candidate === container || !container.contains(candidate)) {
      return false;
    }

    if (!candidate.querySelector('[data-testid="User-Name"]') && !getTweetStatusContext(candidate)?.author) {
      return false;
    }

    return Boolean(
      candidate.querySelector('[data-testid="tweetText"]')
      || candidate.querySelector(MEDIA_SELECTOR)
      || candidate.querySelector("time[datetime]")
    );
  }

  function uniqueElements(elements) {
    return elements.filter((element, index) => elements.indexOf(element) === index);
  }

  function uniqueStrings(values) {
    return values.filter((value, index) => values.indexOf(value) === index);
  }

  function getHostname(rawUrl) {
    try {
      return new URL(rawUrl, window.location.href).hostname.replace(/^www\./, "");
    } catch (error) {
      return "";
    }
  }

  function isLikelyDomainText(value) {
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleanText(value));
  }

  function findPrimaryTweetText(container) {
    const elements = Array.from(container.querySelectorAll('[data-testid="tweetText"]'));

    const primary = elements.find((element) => {
      return isPrimaryTweetDescendant(element, container);
    });

    if (primary) {
      return primary;
    }

    return elements.length === 1 ? elements[0] : null;
  }

  function isPrimaryTweetDescendant(element, container) {
    if (!element) {
      return false;
    }

    if (getEmbeddedTweetAncestor(element, container)) {
      return false;
    }

    if (container.matches('article[data-testid="tweet"]')) {
      const article = element.closest('article[data-testid="tweet"]');
      return !article || article === container;
    }

    if (container.matches('[data-testid="cellInnerDiv"]')) {
      const cell = element.closest('[data-testid="cellInnerDiv"]');
      return !cell || cell === container;
    }

    return container.contains(element);
  }

  function getEmbeddedTweetAncestor(element, container) {
    const quotedTweetAncestor = element.closest('[data-testid="quotedTweet"]');

    if (quotedTweetAncestor && quotedTweetAncestor !== container && container.contains(quotedTweetAncestor)) {
      return quotedTweetAncestor;
    }

    const cardAncestor = element.closest('[data-testid="card.wrapper"]');
    if (cardAncestor && cardAncestor !== container && isLikelyEmbeddedTweetCard(cardAncestor, container)) {
      return cardAncestor;
    }

    const linkAncestor = element.closest('[role="link"]');
    if (linkAncestor && linkAncestor !== container && isLikelyEmbeddedTweetCard(linkAncestor, container)) {
      return linkAncestor;
    }

    const articleAncestor = element.closest('article[data-testid="tweet"]');
    if (
      articleAncestor
      && articleAncestor !== container
      && isLikelyEmbeddedTweetCard(articleAncestor, container)
      && hasEmbeddingTweetParent(articleAncestor, container)
    ) {
      return articleAncestor;
    }

    return null;
  }

  function flattenThreadParts(tweets) {
    const parts = [];

    tweets.forEach((tweet) => {
      if (tweet.parts.length === 0) {
        return;
      }

      parts.push({
        type: "tweet-block",
        parts: tweet.parts,
        publishedAt: tweet.publishedAt,
        sourceUrl: tweet.sourceUrl || "",
        text: tweet.text || tweet.parts.map((part) => part.text || part.alt || "").filter(Boolean).join("\n")
      });
    });

    return parts;
  }

  function longformPartFromElement(element) {
    const className = getClassName(element, "");
    const html = normalizeInlineHtml(serializeInlineContent(element));

    if (!html || cleanText(element.textContent).length === 0) {
      return null;
    }

    if (className.includes("longform-header-one")) {
      return { type: "heading1", html, text: extractVisibleText(element) };
    }

    if (className.includes("longform-header-two")) {
      return { type: "heading2", html, text: extractVisibleText(element) };
    }

    if (className.includes("longform-blockquote")) {
      return { type: "blockquote", html, text: extractVisibleText(element) };
    }

    if (className.includes("longform-unordered-list-item")) {
      return { type: "unordered-list-item", html, text: extractVisibleText(element) };
    }

    if (className.includes("longform-ordered-list-item")) {
      return { type: "ordered-list-item", html, text: extractVisibleText(element) };
    }

    return { type: "paragraph", html, text: extractVisibleText(element) };
  }

  function mediaPartFromElement(element, mediaSeen, sourceUrl = "") {
    const src = getMediaSource(element);

    if (!src || mediaSeen.has(src)) {
      return null;
    }

    mediaSeen.add(src);

    const isVideo = isVideoMediaElement(element, src);
    const alt = isVideo
      ? localizedText("videoPreviewLabel", "Video preview")
      : cleanText(element.getAttribute("alt")) || localizedText("imageAltFallback", "Image");

    return {
      type: "image",
      src,
      alt,
      text: alt,
      mediaKind: isVideo ? "video" : "image",
      sourceElement: isVideo && element.tagName === "VIDEO" ? element : null,
      sourceUrl
    };
  }

  function getMediaSource(element) {
    const rawSource = element.tagName === "VIDEO"
      ? element.getAttribute("poster")
      : element.currentSrc || element.getAttribute("src") || getBackgroundImageSource(element);

    if (!rawSource) {
      return "";
    }

    try {
      const url = new URL(rawSource, window.location.href);

      if (url.hostname.endsWith("twimg.com") && url.pathname.includes("/media/")) {
        url.searchParams.set("name", "large");
      }

      return url.href;
    } catch (error) {
      return rawSource;
    }
  }

  function getBackgroundImageSource(element) {
    const backgroundImage = element.style?.backgroundImage || element.getAttribute("style") || "";
    const match = backgroundImage.match(/url\((["']?)(.*?)\1\)/i);
    return match ? match[2] : "";
  }

  function isVideoMediaElement(element, src) {
    return element.tagName === "VIDEO"
      || /(?:ext_tw_video_thumb|amplify_video_thumb)/i.test(src)
      || /vid[ée]o/i.test(element.getAttribute("alt") || element.getAttribute("aria-label") || "");
  }

  function serializeInlineContent(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node;
    const tagName = element.tagName.toLowerCase();

    if (tagName === "br") {
      return "<br>";
    }

    if (tagName === "img") {
      return escapeHtml(element.getAttribute("alt") || "");
    }

    const children = Array.from(element.childNodes, serializeInlineContent).join("");

    if (!children) {
      return "";
    }

    if (tagName === "a") {
      const href = normalizeLinkHref(element.getAttribute("href"));
      return href ? `<a href="${escapeAttribute(href)}">${children}</a>` : children;
    }

    if (tagName === "strong" || tagName === "b") {
      return `<strong>${children}</strong>`;
    }

    if (tagName === "em" || tagName === "i") {
      return `<em>${children}</em>`;
    }

    if (tagName === "code") {
      return `<code>${children}</code>`;
    }

    return children;
  }

  function normalizeInlineHtml(html) {
    return html
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\n]+/g, " ")
      .replace(/\s*<br>\s*/g, "<br>")
      .trim();
  }

  function normalizeLinkHref(rawHref) {
    if (!rawHref) {
      return "";
    }

    try {
      return new URL(rawHref, window.location.href).href;
    } catch (error) {
      return "";
    }
  }

  function findPublishedDate(root, titleElement) {
    const container = titleElement?.closest('article, [data-testid="cellInnerDiv"]') || root;
    return findPublishedDateInContainer(container) || findPublishedDateInContainer(root);
  }

  function findPublishedDateInContainer(container) {
    const time = container?.querySelector("time[datetime]");
    const datetime = time?.getAttribute("datetime");

    if (!datetime) {
      return null;
    }

    const date = new Date(datetime);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function deriveTitleFromDocument() {
    return cleanText(document.title)
      .replace(/^(\(\d+\)\s*)?/, "")
      .replace(/\s*\/\s*X\s*$/i, "")
      .replace(/\s+sur\s+X\s*:\s*/i, " - ")
      .replace(/^"|"$/g, "");
  }

  async function downloadArticleAsPdf(article) {
    showToast(localizedText("toastPreparingPdf", "Preparing the PDF..."), { persistent: true });

    await hydrateArticleImages(article);

    showToast(localizedText("toastGeneratingPdf", "Generating the PDF..."), { persistent: true });
    const pdfBytes = buildDirectPdfBytes(article);
    const filename = buildExportFilename(article);
    showToast(localizedText("toastOpeningSaveDialog", "Opening the save dialog..."), { persistent: true });
    triggerBrowserDownload(pdfBytes, filename);

    hideToast();
  }

  function triggerBrowserDownload(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";

    (document.body || document.documentElement).append(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 30000);
  }

  async function hydrateArticleImages(article) {
    const imageParts = collectHydratableImageParts(article.parts);
    const avatarParts = collectHydratableAvatarTargets(article);

    if (imageParts.length === 0 && avatarParts.length === 0) {
      return;
    }

    showToast(localizedTemplate(
      "toastDownloadingImages",
      { count: imageParts.length + avatarParts.length },
      `Downloading images (${imageParts.length + avatarParts.length})...`
    ), { persistent: true });

    await Promise.all(imageParts.map(async (part) => {
      try {
        if (part.mediaKind === "video" && part.sourceElement) {
          const videoFrame = await captureVideoFrameAsPdfImage(part.sourceElement);
          if (videoFrame) {
            part.pdfImage = videoFrame;
            return;
          }
        }

        const response = await sendRuntimeMessage({
          type: "xtension-fetch-image",
          url: part.src
        });

        if (!response?.ok || !response.image?.dataUrl) {
          part.imageError = response?.error || localizedText("imageUnavailable", "image unavailable");
          return;
        }

        part.pdfImage = await convertDataUrlImageToPdfJpeg(response.image.dataUrl);
      } catch (error) {
        part.imageError = error?.message || localizedText("imageUnavailable", "image unavailable");
      }
    }));

    await Promise.all(avatarParts.map(async (part) => {
      try {
        const response = await sendRuntimeMessage({
          type: "xtension-fetch-image",
          url: part.avatarSrc
        });

        if (!response?.ok || !response.image?.dataUrl) {
          return;
        }

        part.avatarImage = await convertDataUrlImageToPdfJpeg(response.image.dataUrl);
      } catch (error) {
        part.avatarImage = null;
      }
    }));
  }

  function collectHydratableImageParts(parts) {
    const imageParts = [];

    for (const part of parts || []) {
      if (part.type === "image" && part.src) {
        imageParts.push(part);
      }

      if (part.type === "link-card" && part.src) {
        imageParts.push(part);
      }

      if (part.type === "embedded-tweet-card" || part.type === "tweet-block") {
        imageParts.push(...collectHydratableImageParts(part.parts));
      }
    }

    return imageParts;
  }

  function collectHydratableAvatarTargets(article) {
    const avatarTargets = [];

    if (article.authorInfo?.avatarSrc) {
      avatarTargets.push(article.authorInfo);
    }

    avatarTargets.push(...collectHydratableAvatarTargetsFromParts(article.parts));

    return avatarTargets;
  }

  function collectHydratableAvatarTargetsFromParts(parts) {
    const avatarTargets = [];

    for (const part of parts || []) {
      if (part.type === "embedded-tweet-card" && part.authorInfo?.avatarSrc) {
        avatarTargets.push(part.authorInfo);
      }

      if (part.type === "embedded-tweet-card" || part.type === "tweet-block") {
        avatarTargets.push(...collectHydratableAvatarTargetsFromParts(part.parts));
      }
    }

    return avatarTargets;
  }

  function captureVideoFrameAsPdfImage(video) {
    return new Promise((resolve) => {
      try {
        if (!video.videoWidth || !video.videoHeight) {
          resolve(null);
          return;
        }

        const dimensions = fitEmbeddedImagePixels(video.videoWidth, video.videoHeight);
        const canvas = document.createElement("canvas");
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const context = canvas.getContext("2d", {
          alpha: false
        });

        if (!context) {
          resolve(null);
          return;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }

          resolve({
            bytes: new Uint8Array(await blob.arrayBuffer()),
            width: canvas.width,
            height: canvas.height
          });
        }, "image/jpeg", 0.88);
      } catch (error) {
        resolve(null);
      }
    });
  }

  function convertDataUrlImageToPdfJpeg(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        try {
          const dimensions = fitEmbeddedImagePixels(image.naturalWidth || image.width, image.naturalHeight || image.height);
          const canvas = document.createElement("canvas");
          canvas.width = dimensions.width;
          canvas.height = dimensions.height;

          const context = canvas.getContext("2d", {
            alpha: false
          });

          if (!context) {
            reject(new Error("canvas indisponible"));
            return;
          }

          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async (blob) => {
            if (!blob) {
              reject(new Error("conversion image impossible"));
              return;
            }

            resolve({
              bytes: new Uint8Array(await blob.arrayBuffer()),
              width: canvas.width,
              height: canvas.height
            });
          }, "image/jpeg", 0.88);
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = () => {
        reject(new Error("lecture image impossible"));
      };
      image.src = dataUrl;
    });
  }

  function fitEmbeddedImagePixels(width, height) {
    const maxWidth = 1600;
    const maxHeight = 2200;
    const safeWidth = Math.max(1, width || 1);
    const safeHeight = Math.max(1, height || 1);
    const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight);

    return {
      width: Math.max(1, Math.round(safeWidth * scale)),
      height: Math.max(1, Math.round(safeHeight * scale))
    };
  }

  function buildDirectPdfBytes(article) {
    const documentBuilder = createPdfLayout();
    const isTweetExport = article.kind === "tweet";
    const pdfParts = preparePdfPartsForExport(article.parts || []);

    if (isTweetExport && article.authorInfo) {
      documentBuilder.addAuthorHeader(article.authorInfo, {
        after: 24,
        publishedAt: article.publishedAt,
        size: "large"
      });
    } else {
      documentBuilder.addText(article.title || localizedText("fallbackArticleTitle", "X article"), {
        font: "F2",
        size: 22,
        lineHeight: 28,
        after: 12
      });

      if (article.authorInfo) {
        documentBuilder.addAuthorHeader(article.authorInfo, {
          after: 24,
          publishedAt: article.publishedAt
        });
      }
    }

    let orderedIndex = 1;
    let tweetBlockIndex = 0;

    const renderPart = (part) => {
      const text = cleanMultilineText(part.text || part.alt || "");

      if (part.type !== "ordered-list-item") {
        orderedIndex = 1;
      }

      if (part.type === "embedded-tweet-card") {
        documentBuilder.addEmbeddedTweetCard(part, {
          before: 5,
          after: 10
        });
      } else if (part.type === "link-card") {
        documentBuilder.addLinkCard(part, {
          before: 5,
          after: 10
        });
      } else if (part.type === "embedded-tweet-source") {
        return;
      } else if (part.type === "embedded-tweet-text") {
        documentBuilder.addText(text, {
          font: "F1",
          size: 10.8,
          lineHeight: 15.5,
          after: 6,
          justify: true
        });
      } else if (part.type === "heading1") {
        documentBuilder.addText(text, {
          font: "F2",
          size: 18,
          lineHeight: 23,
          before: 18,
          after: 10
        });
      } else if (part.type === "heading2") {
        documentBuilder.addText(text, {
          font: "F2",
          size: 14.5,
          lineHeight: 19.5,
          before: 15,
          after: 8
        });
      } else if (part.type === "blockquote") {
        documentBuilder.addText(text, {
          font: "F3",
          size: 11.5,
          lineHeight: 16,
          before: 4,
          after: 9,
          indent: 18,
          prefix: "> "
        });
      } else if (part.type === "unordered-list-item") {
        documentBuilder.addText(text, {
          font: "F1",
          size: 11.5,
          lineHeight: 16,
          after: 4,
          indent: 14,
          prefix: "- "
        });
      } else if (part.type === "ordered-list-item") {
        documentBuilder.addText(text, {
          font: "F1",
          size: 11.5,
          lineHeight: 16,
          after: 4,
          indent: 18,
          prefix: `${orderedIndex}. `
        });
        orderedIndex += 1;
      } else if (part.type === "image") {
        if (part.pdfImage) {
          documentBuilder.addImage(part.pdfImage, {
            before: 16,
            after: part.mediaKind === "video" ? 8 : 20,
            url: getPdfImageOpenUrl(part)
          });
        } else {
          documentBuilder.addText(localizedTemplate(
            "imageNotInserted",
            { alt: part.alt || "" },
            `[Image not inserted] ${part.alt || ""}`
          ), {
            font: "F3",
            size: 10,
            lineHeight: 14,
            before: 16,
            after: 6
          });
          documentBuilder.addText(part.imageError ? `${part.imageError} - ${part.src}` : part.src, {
            font: "F1",
            size: 8,
            lineHeight: 11,
            after: 14
          });
        }

        if (part.mediaKind === "video") {
          const videoText = part.sourceUrl
            ? localizedTemplate(
                "videoPreviewOnlyWithSource",
                { url: part.sourceUrl },
                `Video: preview only. Open the source tweet to play the video - ${part.sourceUrl}`
              )
            : localizedText(
                "videoPreviewOnlyPdfSource",
                "Video: preview only. Open the PDF source link to play the video."
              );

          documentBuilder.addText(videoText, {
            font: "F3",
            size: 9,
            lineHeight: 12,
            after: 8
          });
        }
      } else if (part.type === "image-grid") {
        documentBuilder.addImageGrid(part.images, {
          before: 16,
          after: 20
        });
      } else {
        documentBuilder.addText(text, {
          font: "F1",
          size: 11.5,
          lineHeight: 16.5,
          after: 6,
          justify: true
        });
      }
    };

    const isHeadingPart = (part) => {
      return part?.type === "heading1" || part?.type === "heading2";
    };

    const isSectionBodyPart = (part) => {
      return [
        "paragraph",
        "embedded-tweet-text",
        "blockquote",
        "unordered-list-item",
        "ordered-list-item"
      ].includes(part?.type);
    };

    const findNextLayoutPart = (parts, startIndex) => {
      for (let index = startIndex; index < parts.length; index += 1) {
        const candidate = parts[index];
        if (candidate?.type && candidate.type !== "embedded-tweet-source") {
          return candidate;
        }
      }

      return null;
    };

    const collectHeadingKeepParts = (parts, index) => {
      const heading = parts[index];
      const keepParts = [heading];
      let bodyPartCount = 0;
      let bodyTextLength = 0;

      for (let nextIndex = index + 1; nextIndex < parts.length; nextIndex += 1) {
        const candidate = parts[nextIndex];

        if (!candidate || candidate.type === "embedded-tweet-source") {
          continue;
        }

        if (isHeadingPart(candidate) || candidate.type === "tweet-block" || candidate.type === "embedded-tweet-card" || candidate.type === "link-card") {
          break;
        }

        if (isSectionBodyPart(candidate)) {
          keepParts.push(candidate);
          bodyPartCount += 1;
          bodyTextLength += cleanText(candidate.text || candidate.alt || "").length;

          if (bodyPartCount >= 2 || bodyTextLength > 360) {
            break;
          }

          continue;
        }

        if ((candidate.type === "image" || candidate.type === "image-grid") && bodyPartCount > 0 && bodyPartCount <= 2 && bodyTextLength <= 360) {
          keepParts.push(candidate);
        }

        break;
      }

      if (keepParts.length === 1) {
        const nextPart = findNextLayoutPart(parts, index + 1);
        if (nextPart) {
          keepParts.push(nextPart);
        }
      }

      return keepParts;
    };

    const keepHeadingWithFollowingContent = (parts, index) => {
      const part = parts[index];
      if (!isHeadingPart(part)) {
        return;
      }

      const keepParts = collectHeadingKeepParts(parts, index);
      const includesImage = keepParts.some((keepPart) => keepPart?.type === "image");
      documentBuilder.keepPartsTogether(keepParts, {
        maxWastedHeight: includesImage ? 280 : (part.type === "heading1" ? 230 : 180),
        minStartHeight: part.type === "heading1" ? 115 : 95
      });
    };

    for (let index = 0; index < pdfParts.length; index += 1) {
      const part = pdfParts[index];
      if (part.type === "tweet-block") {
        documentBuilder.keepPartsTogether(part.parts, {
          allowNewPage: tweetBlockIndex > 0,
          maxWastedHeight: Number.POSITIVE_INFINITY,
          minStartHeight: 90
        });

        for (const tweetPart of part.parts || []) {
          renderPart(tweetPart);
        }

        tweetBlockIndex += 1;
        continue;
      }

      keepHeadingWithFollowingContent(pdfParts, index);
      renderPart(part);
    }

    documentBuilder.addLastPageFooter({
      followIntroSegments: [{
        text: localizedText("pdfFollowIntro", "Liked this article? To read more interesting content:")
      }],
      followActionSegments: buildPdfFollowActionSegments(article),
      sourceUrl: article.sourceUrl
    });

    return buildPdfBytesFromPages(documentBuilder.getDocument());
  }

  function preparePdfPartsForExport(parts) {
    const prepared = [];

    for (let index = 0; index < (parts || []).length; index += 1) {
      const part = parts[index];

      if (part?.type === "tweet-block") {
        prepared.push({
          ...part,
          parts: preparePdfPartsForExport(part.parts || [])
        });
        continue;
      }

      if (part?.type === "embedded-tweet-card") {
        prepared.push({
          ...part,
          parts: preparePdfPartsForExport(part.parts || [])
        });
        continue;
      }

      if (!isGridImagePart(part)) {
        prepared.push(part);
        continue;
      }

      const images = [];
      while (index < parts.length && isGridImagePart(parts[index])) {
        images.push(parts[index]);
        index += 1;
      }
      index -= 1;

      if (images.length > 1) {
        prepared.push({
          type: "image-grid",
          images,
          text: images.map((image) => image.alt || image.text || "").filter(Boolean).join("\n")
        });
      } else {
        prepared.push(images[0]);
      }
    }

    return prepared.filter(Boolean);
  }

  function isGridImagePart(part) {
    return part?.type === "image" && part.mediaKind === "image";
  }

  function createPdfLayout() {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const marginLeft = 54;
    const marginRight = 54;
    const marginTop = 42;
    const marginBottom = 76;
    const bodyHeight = pageHeight - marginTop - marginBottom;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const pages = [];
    const images = [];
    let currentPage = null;
    let writer = null;
    let y = 0;

    const newPage = () => {
      currentPage = {
        annotations: [],
        writer: createByteWriter(),
        imageNames: new Set()
      };
      writer = currentPage.writer;
      pages.push(currentPage);
      y = pageHeight - marginTop;
    };

    const ensureSpace = (height) => {
      if (!writer) {
        newPage();
      }

      if (y - height < marginBottom) {
        newPage();
      }
    };

    const keepPartsTogether = (parts, options = {}) => {
      if (options.allowNewPage === false) {
        return;
      }

      if (!writer) {
        newPage();
      }

      const before = options.before || 0;
      const after = options.after || 0;
      const estimatedHeight = before + estimateTopLevelPartsHeight(parts || []) + after;
      const remainingHeight = y - marginBottom;
      const maxWastedHeight = options.maxWastedHeight ?? Number.POSITIVE_INFINITY;
      const minStartHeight = options.minStartHeight || 0;

      if (
        (estimatedHeight <= bodyHeight && estimatedHeight > remainingHeight && remainingHeight <= maxWastedHeight)
        || (minStartHeight > 0 && remainingHeight < minStartHeight)
      ) {
        newPage();
      }
    };

    const estimateTopLevelPartsHeight = (parts) => {
      let height = 0;

      for (const part of parts) {
        const text = cleanMultilineText(part.text || part.alt || "");

        if (part.type === "embedded-tweet-card") {
          const cardWidth = Math.min(390, contentWidth - 72);
          const padding = 12;
          height += 5 + estimateEmbeddedTweetCardHeight(part, cardWidth - padding * 2, {
            bodyFontSize: 10.5,
            bodyLineHeight: 14.2,
            headerGap: 10,
            headerHeight: 34,
            imageMaxHeight: 210,
            padding
          }) + 10;
        } else if (part.type === "link-card") {
          const cardWidth = Math.min(390, contentWidth - 72);
          const padding = 12;
          height += 5 + estimateLinkCardHeight(part, cardWidth - padding * 2, {
            imageMaxHeight: 220,
            imageTextGap: 14,
            padding
          }) + 10;
        } else if (part.type === "embedded-tweet-text") {
          height += wrapPdfText(text, contentWidth, 10.8).length * 15.5 + 6;
        } else if (part.type === "heading1") {
          height += 18 + wrapPdfText(text, contentWidth, 18).length * 23 + 10;
        } else if (part.type === "heading2") {
          height += 15 + wrapPdfText(text, contentWidth, 14.5).length * 19.5 + 8;
        } else if (part.type === "blockquote") {
          height += 4 + wrapPdfText(`> ${text}`, contentWidth - 18, 11.5).length * 16 + 9;
        } else if (part.type === "unordered-list-item") {
          height += wrapPdfText(`- ${text}`, contentWidth - 14, 11.5).length * 16 + 4;
        } else if (part.type === "ordered-list-item") {
          height += wrapPdfText(`1. ${text}`, contentWidth - 18, 11.5).length * 16 + 4;
        } else if (part.type === "image") {
          if (part.pdfImage) {
            const imageBefore = 16;
            const imageAfter = part.mediaKind === "video" ? 8 : 20;
            const maxHeight = bodyHeight - imageBefore - imageAfter;
            let drawHeight = contentWidth * part.pdfImage.height / part.pdfImage.width;
            if (drawHeight > maxHeight) {
              drawHeight = maxHeight;
            }
            height += imageBefore + drawHeight + imageAfter;
          } else {
            height += 16 + wrapPdfText(localizedTemplate(
              "imageNotInserted",
              { alt: part.alt || "" },
              `[Image not inserted] ${part.alt || ""}`
            ), contentWidth, 10).length * 14 + 6;
            height += wrapPdfText(part.imageError ? `${part.imageError} - ${part.src}` : part.src || "", contentWidth, 8).length * 11 + 14;
          }

          if (part.mediaKind === "video") {
            const videoText = part.sourceUrl
              ? localizedTemplate(
                "videoPreviewOnlyWithSource",
                { url: part.sourceUrl },
                `Video: preview only. Open the source tweet to play the video - ${part.sourceUrl}`
              )
              : localizedText(
                "videoPreviewOnlyPdfSource",
                "Video: preview only. Open the PDF source link to play the video."
              );
            height += wrapPdfText(videoText, contentWidth, 9).length * 12 + 8;
          }
        } else if (part.type === "image-grid") {
          height += 16 + getPdfImageGridLayout(part.images, contentWidth, bodyHeight - 36).height + 20;
        } else {
          height += wrapPdfText(text, contentWidth, 11.5).length * 16.5 + 6;
        }
      }

      return height;
    };

    const addText = (rawText, options = {}) => {
      const text = cleanMultilineText(rawText);

      if (!text) {
        return;
      }

      const font = options.font || "F1";
      const size = options.size || 11;
      const lineHeight = options.lineHeight || size * 1.35;
      const before = options.before || 0;
      const after = options.after || 0;
      const indent = options.indent || 0;
      const firstPrefix = options.prefix || "";
      const justify = options.justify === true;
      const x = marginLeft + indent;
      const maxWidth = pageWidth - marginLeft - marginRight - indent;

      if (before) {
        ensureSpace(before + lineHeight);
        y -= before;
      }

      const paragraphs = text.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);

      for (const paragraph of paragraphs) {
        const lines = wrapPdfText(`${firstPrefix}${paragraph}`, maxWidth, size);
        const minStartLines = Math.min(lines.length, options.minStartLines || 2);
        ensureSpace(minStartLines * lineHeight);

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = lines[lineIndex];
          const isLastLine = lineIndex === lines.length - 1;
          const wordSpacing = justify && !isLastLine
            ? getPdfJustifiedWordSpacing(line, maxWidth, size)
            : 0;

          ensureSpace(lineHeight);
          writePdfTextLine(writer, line, x, y, font, size, 0, 0, 0, { wordSpacing });
          y -= lineHeight;
        }
      }

      if (after) {
        y -= after;
      }
    };

    const addLinkedText = (segments, options = {}) => {
      const tokens = createRichTextTokens(segments || []);

      if (tokens.length === 0) {
        return;
      }

      const font = options.font || "F1";
      const size = options.size || 10;
      const lineHeight = options.lineHeight || size * 1.35;
      const before = options.before || 0;
      const after = options.after || 0;
      const indent = options.indent || 0;
      const align = options.align || "left";
      const color = options.color || [0, 0, 0];
      const linkColor = options.linkColor || color;
      const x = marginLeft + indent;
      const maxWidth = pageWidth - marginLeft - marginRight - indent;
      const lines = wrapRichTextTokens(tokens, maxWidth, size, font);

      if (before) {
        ensureSpace(before + lineHeight);
        y -= before;
      }

      ensureSpace(Math.min(lines.length, options.minStartLines || 2) * lineHeight);

      for (const line of lines) {
        const lineWidth = measureRichTextTokens(line, size, font);
        let cursorX = align === "center" ? x + Math.max(0, (maxWidth - lineWidth) / 2) : x;

        ensureSpace(lineHeight);

        for (const run of mergeRichTextRuns(line)) {
          const runWidth = measurePdfText(run.text, size, font);
          const [r, g, b] = run.url ? linkColor : color;
          writePdfTextLine(writer, run.text, cursorX, y, font, size, r, g, b);

          if (run.url && !/^\s+$/.test(run.text)) {
            addLinkAnnotation(cursorX, y - 2, runWidth, size + 4, run.url);
          }

          cursorX += runWidth;
        }

        y -= lineHeight;
      }

      if (after) {
        y -= after;
      }
    };

    const drawLinkedTextLine = (segments, options = {}) => {
      const tokens = createRichTextTokens(segments || []);

      if (tokens.length === 0) {
        return;
      }

      if (!writer) {
        newPage();
      }

      const font = options.font || "F1";
      const maxWidth = options.maxWidth || contentWidth;
      const minSize = options.minSize || 8.8;
      const align = options.align || "left";
      const color = options.color || [0, 0, 0];
      const linkColor = options.linkColor || color;
      const x = options.x ?? marginLeft;
      const lineY = options.y;
      let size = options.size || 11.5;
      let lineWidth = measureRichTextTokens(tokens, size, font);

      while (lineWidth > maxWidth && size > minSize) {
        size = Math.max(minSize, size - 0.2);
        lineWidth = measureRichTextTokens(tokens, size, font);
      }

      let cursorX = align === "center" ? x + Math.max(0, (maxWidth - lineWidth) / 2) : x;

      for (const run of mergeRichTextRuns(tokens)) {
        const runWidth = measurePdfText(run.text, size, font);
        const [r, g, b] = run.url ? linkColor : color;
        writePdfTextLine(writer, run.text, cursorX, lineY, font, size, r, g, b);

        if (run.url && !/^\s+$/.test(run.text)) {
          addLinkAnnotation(cursorX, lineY - 1.6, runWidth, size + 3.2, run.url);
        }

        cursorX += runWidth;
      }
    };

    const drawLinkedTextBlock = (segments, options = {}) => {
      const tokens = createRichTextTokens(segments || []);

      if (tokens.length === 0) {
        return;
      }

      if (!writer) {
        newPage();
      }

      const font = options.font || "F1";
      const size = options.size || 11.5;
      const lineHeight = options.lineHeight || size * 1.2;
      const maxWidth = options.maxWidth || contentWidth;
      const align = options.align || "left";
      const color = options.color || [0, 0, 0];
      const linkColor = options.linkColor || color;
      const x = options.x ?? marginLeft;
      const lines = wrapRichTextTokens(tokens, maxWidth, size, font);

      lines.forEach((line, index) => {
        const lineY = options.y - index * lineHeight;
        const lineWidth = measureRichTextTokens(line, size, font);
        let cursorX = align === "center" ? x + Math.max(0, (maxWidth - lineWidth) / 2) : x;

        for (const run of mergeRichTextRuns(line)) {
          const runWidth = measurePdfText(run.text, size, font);
          const [r, g, b] = run.url ? linkColor : color;
          writePdfTextLine(writer, run.text, cursorX, lineY, font, size, r, g, b);

          if (run.url && !/^\s+$/.test(run.text)) {
            addLinkAnnotation(cursorX, lineY - 1.6, runWidth, size + 3.2, run.url);
          }

          cursorX += runWidth;
        }
      });
    };

    const addLastPageFooter = (footer = {}) => {
      if (!writer) {
        newPage();
      }

      const footerX = marginLeft;
      const footerWidth = pageWidth - marginLeft - marginRight;
      const linkColor = [0.1, 0.35, 0.62];
      const footerSize = 11.5;

      drawLinkedTextLine(footer.followIntroSegments || [], {
        align: "center",
        color: [0, 0, 0],
        font: "F1",
        linkColor,
        maxWidth: footerWidth,
        minSize: 10,
        size: footerSize,
        x: footerX,
        y: 62
      });

      drawLinkedTextLine(footer.followActionSegments || [], {
        align: "center",
        color: [0, 0, 0],
        font: "F1",
        linkColor,
        maxWidth: footerWidth,
        minSize: 10,
        size: footerSize,
        x: footerX,
        y: 47
      });

      if (footer.sourceUrl) {
        drawLinkedTextBlock([
          {
            text: `${localizedText("pdfSourceLabel", "Source")}: `
          },
          {
            text: footer.sourceUrl,
            url: footer.sourceUrl
          }
        ], {
          align: "center",
          color: [0, 0, 0],
          font: "F1",
          linkColor,
          lineHeight: 12.8,
          maxWidth: footerWidth,
          size: footerSize,
          x: footerX,
          y: 32
        });
      }
    };

    const addPdfImageResource = (image) => {
      const name = `Im${images.length + 1}`;
      images.push({
        name,
        bytes: image.bytes,
        width: image.width,
        height: image.height
      });

      currentPage.imageNames.add(name);
      return name;
    };

    const addLinkAnnotation = (x, y, width, height, url) => {
      if (!url || !currentPage) {
        return;
      }

      currentPage.annotations.push({
        height,
        url,
        width,
        x,
        y
      });
    };

    const drawImageGridContent = (imageParts, x, topY, maxWidth, options = {}) => {
      const layout = getPdfImageGridLayout(imageParts, maxWidth, options.maxHeight || 320);

      for (const item of layout.items) {
        const name = addPdfImageResource(item.part.pdfImage);
        const drawX = x + item.x;
        const drawY = topY - item.y - item.height;
        writePdfImageCover(writer, name, item.part.pdfImage, drawX, drawY, item.width, item.height);
        addLinkAnnotation(drawX, drawY, item.width, item.height, getPdfImageOpenUrl(item.part));
      }

      return topY - layout.height;
    };

    const addImage = (image, options = {}) => {
      if (!image?.bytes || !image.width || !image.height) {
        return;
      }

      const before = options.before || 0;
      const after = options.after || 0;
      const indent = options.indent || 0;
      const x = marginLeft + indent;
      const maxWidth = pageWidth - marginLeft - marginRight - indent;
      const maxHeight = pageHeight - marginTop - marginBottom - before - after;
      let drawWidth = maxWidth;
      let drawHeight = drawWidth * image.height / image.width;

      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = drawHeight * image.width / image.height;
      }

      ensureSpace(before + drawHeight + after);

      if (before) {
        y -= before;
      }

      const name = addPdfImageResource(image);
      y -= drawHeight;
      writePdfImage(writer, name, x, y, drawWidth, drawHeight);
      addLinkAnnotation(x, y, drawWidth, drawHeight, options.url);

      if (after) {
        y -= after;
      }
    };

    const addImageGrid = (imageParts, options = {}) => {
      const before = options.before || 0;
      const after = options.after || 0;
      const indent = options.indent || 0;
      const x = marginLeft + indent;
      const maxWidth = pageWidth - marginLeft - marginRight - indent;
      const maxHeight = pageHeight - marginTop - marginBottom - before - after;
      const layout = getPdfImageGridLayout(imageParts, maxWidth, maxHeight);

      if (layout.items.length === 0 || layout.height <= 0) {
        return;
      }

      ensureSpace(before + layout.height + after);

      if (before) {
        y -= before;
      }

      y = drawImageGridContent(imageParts, x, y, maxWidth, {
        maxHeight
      });

      if (after) {
        y -= after;
      }
    };

    const addAuthorHeader = (author, options = {}) => {
      const before = options.before || 0;
      const after = options.after || 0;
      const isLarge = options.size === "large";
      const avatarSize = isLarge ? 54 : 38;
      const x = marginLeft;
      const textX = x + avatarSize + 10;
      const displayName = cleanText(author.displayName || (author.handle ? `@${author.handle}` : "X"));
      const handle = author.handle ? `@${author.handle}` : "";
      const publishedAt = options.publishedAt ? formatDate(options.publishedAt) : "";
      const headerHeight = isLarge ? (publishedAt ? 58 : 42) : (publishedAt ? 54 : avatarSize);

      ensureSpace(before + headerHeight + after);

      if (before) {
        y -= before;
      }

      if (author.avatarImage?.bytes) {
        const name = addPdfImageResource(author.avatarImage);
        writePdfImage(writer, name, x, y - avatarSize, avatarSize, avatarSize);
      } else {
        writePdfFilledRect(writer, x, y - avatarSize, avatarSize, avatarSize, 0.93, 0.95, 0.97);
      }

      writePdfTextLine(writer, displayName, textX, y - (isLarge ? 14 : 13), "F2", isLarge ? 13.5 : 12.5);

      if (handle) {
        writePdfTextLine(writer, handle, textX, y - (isLarge ? 32 : 30), "F1", isLarge ? 10 : 9.5, 0.33, 0.39, 0.44);
      }

      if (publishedAt) {
        writePdfTextLine(writer, publishedAt, textX, y - (isLarge ? 48 : 44), "F1", isLarge ? 9.5 : 8.8, 0.33, 0.39, 0.44);
      }

      y -= headerHeight + after;
    };

    const drawLinkCardContent = (card, x, startY, width, options = {}) => {
      let cursorY = startY;
      const imageMaxHeight = options.imageMaxHeight || 220;
      const imageTextGap = options.imageTextGap ?? 12;

      if (card.pdfImage) {
        const name = addPdfImageResource(card.pdfImage);
        if (options.squareImage) {
          const squareSize = Math.min(imageMaxHeight, width);
          cursorY -= squareSize;
          writePdfImageCover(writer, name, card.pdfImage, x + (width - squareSize) / 2, cursorY, squareSize, squareSize);
        } else {
          const dimensions = fitPdfImage(card.pdfImage, width, imageMaxHeight);
          cursorY -= dimensions.height;
          writePdfImage(writer, name, x, cursorY, dimensions.width, dimensions.height);
        }
        cursorY -= imageTextGap;
      }

      if (card.domain) {
        writePdfTextLine(writer, card.domain, x, cursorY, "F1", 8.8, 0.33, 0.39, 0.44);
        cursorY -= 13;
      }

      if (card.title) {
        for (const line of wrapPdfText(card.title, width, 10.8)) {
          writePdfTextLine(writer, line, x, cursorY, "F1", 10.8);
          cursorY -= 14;
        }
        cursorY -= 4;
      }

      if (card.description) {
        for (const line of wrapPdfText(card.description, width, 9.2)) {
          writePdfTextLine(writer, line, x, cursorY, "F1", 9.2, 0.33, 0.39, 0.44);
          cursorY -= 11.8;
        }
        cursorY -= 3;
      }

      if (card.url) {
        for (const line of wrapPdfText(card.url, width, 8.4)) {
          writePdfTextLine(writer, line, x, cursorY, "F1", 8.4, 0.1, 0.35, 0.62);
          cursorY -= 10.8;
        }
      }

      return cursorY;
    };

    const addEmbeddedTweetCard = (card, options = {}) => {
      const before = options.before || 0;
      const after = options.after || 0;
      const cardWidth = Math.min(390, pageWidth - marginLeft - marginRight - 72);
      const cardX = marginLeft + 42;
      const padding = 12;
      const innerX = cardX + padding;
      const innerWidth = cardWidth - padding * 2;
      const avatarSize = 24;
      const headerHeight = 34;
      const headerGap = 10;
      const bodyFontSize = 10.5;
      const bodyLineHeight = 14.2;
      const imageMaxHeight = 210;
      const cardHeight = estimateEmbeddedTweetCardHeight(card, innerWidth, {
        bodyFontSize,
        bodyLineHeight,
        headerGap,
        headerHeight,
        imageMaxHeight,
        padding
      });

      ensureSpace(before + cardHeight + after);

      if (before) {
        y -= before;
      }

      const top = y;
      const bottom = top - cardHeight;
      writePdfRoundedRect(writer, cardX, bottom, cardWidth, cardHeight, 10, 0.78, 0.82, 0.86);
      addLinkAnnotation(cardX, bottom, cardWidth, cardHeight, card.sourceUrl);

      let cursorY = top - padding;
      const author = card.authorInfo || {};
      const displayName = cleanText(author.displayName || (author.handle ? `@${author.handle}` : "X"));
      const handleParts = [
        author.handle ? `@${author.handle}` : "",
        card.publishedAt ? formatDate(card.publishedAt) : ""
      ].filter(Boolean);

      if (author.avatarImage?.bytes) {
        const name = addPdfImageResource(author.avatarImage);
        writePdfImage(writer, name, innerX, cursorY - avatarSize, avatarSize, avatarSize);
      } else {
        writePdfFilledRect(writer, innerX, cursorY - avatarSize, avatarSize, avatarSize, 0.93, 0.95, 0.97);
      }

      writePdfTextLine(writer, displayName, innerX + avatarSize + 8, cursorY - 9, "F2", 10.2);
      if (handleParts.length > 0) {
        writePdfTextLine(writer, handleParts.join(" - "), innerX + avatarSize + 8, cursorY - 22, "F1", 8.2, 0.33, 0.39, 0.44);
      }

      cursorY -= headerHeight + headerGap;

      for (const part of card.parts || []) {
        const partText = cleanMultilineText(part.text || part.alt || "");

        if (part.type === "embedded-tweet-text" || part.type === "paragraph") {
          const lines = wrapPdfText(partText, innerWidth, bodyFontSize);
          for (const line of lines) {
            writePdfTextLine(writer, line, innerX, cursorY, "F1", bodyFontSize);
            cursorY -= bodyLineHeight;
          }
          cursorY -= 3;
        } else if (part.type === "image") {
          cursorY -= 4;

          if (part.pdfImage) {
            const squareSize = Math.min(210, innerWidth);
            const name = addPdfImageResource(part.pdfImage);
            cursorY -= squareSize;
            writePdfImageCover(writer, name, part.pdfImage, innerX + (innerWidth - squareSize) / 2, cursorY, squareSize, squareSize);
            addLinkAnnotation(innerX + (innerWidth - squareSize) / 2, cursorY, squareSize, squareSize, getPdfImageOpenUrl(part));
            cursorY -= 6;
          } else if (partText) {
            const lines = wrapPdfText(localizedTemplate(
              "imageNotInserted",
              { alt: partText },
              `[Image not inserted] ${partText}`
            ), innerWidth, 9);
            for (const line of lines) {
              writePdfTextLine(writer, line, innerX, cursorY, "F3", 9, 0.33, 0.39, 0.44);
              cursorY -= 12;
            }
            cursorY -= 4;
          }
        } else if (part.type === "link-card") {
          cursorY = drawLinkCardContent(part, innerX, cursorY - 3, innerWidth, {
            imageMaxHeight: 190,
            imageTextGap: 10,
            squareImage: true
          }) - 5;
        } else if (part.type === "image-grid") {
          cursorY = drawImageGridContent(part.images, innerX, cursorY - 4, innerWidth, {
            maxHeight: 210
          }) - 6;
        }
      }

      y = bottom - after;
    };

    const addLinkCard = (card, options = {}) => {
      const before = options.before || 0;
      const after = options.after || 0;
      const cardWidth = Math.min(390, pageWidth - marginLeft - marginRight - 72);
      const cardX = marginLeft + 42;
      const padding = 12;
      const innerX = cardX + padding;
      const innerWidth = cardWidth - padding * 2;
      const cardHeight = estimateLinkCardHeight(card, innerWidth, {
        imageMaxHeight: 220,
        imageTextGap: 14,
        padding
      });

      ensureSpace(before + cardHeight + after);

      if (before) {
        y -= before;
      }

      const top = y;
      const bottom = top - cardHeight;
      writePdfRoundedRect(writer, cardX, bottom, cardWidth, cardHeight, 10, 0.78, 0.82, 0.86);
      addLinkAnnotation(cardX, bottom, cardWidth, cardHeight, card.url);
      drawLinkCardContent(card, innerX, top - padding, innerWidth, {
        imageMaxHeight: 220,
        imageTextGap: 14
      });
      y = bottom - after;
    };

    return {
      addText,
      addImage,
      addAuthorHeader,
      addLinkedText,
      addEmbeddedTweetCard,
      addImageGrid,
      addLastPageFooter,
      keepPartsTogether,
      addLinkCard,
      getDocument() {
        if (!writer) {
          newPage();
        }

        return {
          pages: pages.map((page) => {
            return {
              annotations: page.annotations,
              stream: page.writer.toBytes(),
              imageNames: Array.from(page.imageNames)
            };
          }),
          images
        };
      }
    };
  }

  function buildPdfFollowActionSegments(article) {
    const handle = getPdfFollowHandle(article);
    const handleText = handle ? `@${handle}` : "X";
    const profileUrl = handle ? `https://x.com/${encodeURIComponent(handle)}` : "https://x.com/";

    return localizedRichTemplate(
      "pdfFollowAction",
      {
        handle: {
          text: handleText,
          url: profileUrl
        },
        signupLink: {
          text: localizedText("pdfSignupLinkText", "Sign up on X"),
          url: "https://x.com/"
        }
      },
      "{signupLink} and follow {handle}."
    );
  }

  function getPdfFollowHandle(article) {
    return cleanHandle(
      article?.authorInfo?.handle ||
      article?.author ||
      parseStatusContext(article?.sourceUrl || "")?.author ||
      ""
    );
  }

  function localizedRichTemplate(key, replacements, fallback) {
    const template = localizedText(key, fallback);
    const segments = [];
    const pattern = /\{([A-Za-z0-9_]+)\}/g;
    let cursor = 0;
    let match = pattern.exec(template);

    while (match) {
      if (match.index > cursor) {
        segments.push({
          text: template.slice(cursor, match.index)
        });
      }

      const replacement = replacements?.[match[1]];
      if (replacement) {
        segments.push({
          text: replacement.text,
          url: replacement.url
        });
      } else {
        segments.push({
          text: match[0]
        });
      }

      cursor = match.index + match[0].length;
      match = pattern.exec(template);
    }

    if (cursor < template.length) {
      segments.push({
        text: template.slice(cursor)
      });
    }

    return segments;
  }

  function createRichTextTokens(segments) {
    const tokens = [];

    for (const segment of segments || []) {
      const normalizedText = String(segment?.text || "").replace(/\s+/g, " ");

      for (const match of normalizedText.matchAll(/\s+|\S+/g)) {
        const text = /^\s+$/.test(match[0]) ? " " : match[0];
        if (text === " " && (tokens.length === 0 || tokens[tokens.length - 1].text === " ")) {
          continue;
        }

        tokens.push({
          text,
          url: segment?.url || ""
        });
      }
    }

    return trimRichTextLine(tokens);
  }

  function wrapRichTextTokens(tokens, maxWidth, fontSize, font = "F1") {
    const lines = [];
    let currentLine = [];

    for (const token of tokens) {
      if (/^\s+$/.test(token.text) && currentLine.length === 0) {
        continue;
      }

      if (!/^\s+$/.test(token.text) && measurePdfText(token.text, fontSize, font) > maxWidth) {
        const trimmedLine = trimRichTextLine(currentLine);
        if (trimmedLine.length > 0) {
          lines.push(trimmedLine);
        }

        for (const chunk of splitLongPdfWord(token.text, maxWidth, fontSize, font)) {
          lines.push([{
            text: chunk,
            url: token.url || ""
          }]);
        }

        currentLine = [];
        continue;
      }

      const candidateLine = [...currentLine, token];
      if (currentLine.length === 0 || measureRichTextTokens(candidateLine, fontSize, font) <= maxWidth) {
        currentLine = candidateLine;
        continue;
      }

      const trimmedLine = trimRichTextLine(currentLine);
      if (trimmedLine.length > 0) {
        lines.push(trimmedLine);
      }

      currentLine = /^\s+$/.test(token.text) ? [] : [token];
    }

    const trimmedLine = trimRichTextLine(currentLine);
    if (trimmedLine.length > 0) {
      lines.push(trimmedLine);
    }

    return lines;
  }

  function trimRichTextLine(tokens) {
    let start = 0;
    let end = tokens.length;

    while (start < end && /^\s+$/.test(tokens[start].text)) {
      start += 1;
    }

    while (end > start && /^\s+$/.test(tokens[end - 1].text)) {
      end -= 1;
    }

    return tokens.slice(start, end);
  }

  function mergeRichTextRuns(tokens) {
    const runs = [];

    for (const token of tokens || []) {
      const previous = runs[runs.length - 1];

      if (previous && previous.url === token.url) {
        previous.text += token.text;
        continue;
      }

      runs.push({
        text: token.text,
        url: token.url || ""
      });
    }

    return runs;
  }

  function measureRichTextTokens(tokens, fontSize, font = "F1") {
    return tokens.reduce((width, token) => width + measurePdfText(token.text, fontSize, font), 0);
  }

  function wrapPdfText(text, maxWidth, fontSize) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;

      if (measurePdfText(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
        current = "";
      }

      if (measurePdfText(word, fontSize) <= maxWidth) {
        current = word;
      } else {
        const splitLines = splitLongPdfWord(word, maxWidth, fontSize);
        lines.push(...splitLines.slice(0, -1));
        current = splitLines[splitLines.length - 1] || "";
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [""];
  }

  function estimateEmbeddedTweetCardHeight(card, innerWidth, options) {
    let height = options.padding + options.headerHeight + (options.headerGap || 4);

    for (const part of card.parts || []) {
      const text = cleanMultilineText(part.text || part.alt || "");

      if (part.type === "embedded-tweet-text" || part.type === "paragraph") {
        height += wrapPdfText(text, innerWidth, options.bodyFontSize).length * options.bodyLineHeight + 3;
      } else if (part.type === "image") {
        height += 4;

        if (part.pdfImage) {
          height += Math.min(options.imageMaxHeight, innerWidth) + 6;
        } else if (text) {
          height += wrapPdfText(localizedTemplate(
            "imageNotInserted",
            { alt: text },
            `[Image not inserted] ${text}`
          ), innerWidth, 9).length * 12 + 4;
        }
      } else if (part.type === "link-card") {
        height += estimateLinkCardHeight(part, innerWidth, {
          imageTextGap: 10,
          imageMaxHeight: 190,
          padding: 0,
          squareImage: true
        }) + 5;
      } else if (part.type === "image-grid") {
        height += 4 + getPdfImageGridLayout(part.images, innerWidth, options.imageMaxHeight || 210).height + 6;
      }
    }

    return height + options.padding;
  }

  function estimateLinkCardHeight(card, innerWidth, options) {
    const padding = options.padding || 0;
    let height = padding;

    if (card.pdfImage) {
      height += (options.squareImage
        ? Math.min(options.imageMaxHeight || 220, innerWidth)
        : fitPdfImage(card.pdfImage, innerWidth, options.imageMaxHeight || 220).height) + (options.imageTextGap ?? 8);
    }

    if (card.domain) {
      height += 13;
    }

    if (card.title) {
      height += wrapPdfText(card.title, innerWidth, 10.8).length * 14 + 4;
    }

    if (card.description) {
      height += wrapPdfText(card.description, innerWidth, 9.2).length * 11.8 + 3;
    }

    if (card.url) {
      height += wrapPdfText(card.url, innerWidth, 8.4).length * 10.8;
    }

    return height + padding;
  }

  function fitPdfImage(image, maxWidth, maxHeight) {
    let width = maxWidth;
    let height = width * image.height / image.width;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * image.width / image.height;
    }

    return {
      width,
      height
    };
  }

  function getPdfImageGridLayout(imageParts, maxWidth, maxHeight) {
    const images = (imageParts || []).filter((part) => {
      return part?.pdfImage?.bytes && part.pdfImage.width && part.pdfImage.height;
    }).slice(0, 4);
    const count = images.length;

    if (count === 0) {
      return {
        height: 0,
        items: [],
        width: maxWidth
      };
    }

    const gap = 4;
    const width = maxWidth;
    const items = [];

    if (count === 1) {
      const dimensions = fitPdfImage(images[0].pdfImage, width, maxHeight);
      return {
        height: dimensions.height,
        items: [{
          height: dimensions.height,
          part: images[0],
          width: dimensions.width,
          x: (width - dimensions.width) / 2,
          y: 0
        }],
        width
      };
    }

    if (count === 2) {
      const cellWidth = (width - gap) / 2;
      const cellHeight = Math.min(maxHeight, Math.min(285, Math.max(190, cellWidth * 1.05)));

      return {
        height: cellHeight,
        items: images.map((part, index) => ({
          height: cellHeight,
          part,
          width: cellWidth,
          x: index * (cellWidth + gap),
          y: 0
        })),
        width
      };
    }

    if (count === 3) {
      const leftWidth = (width - gap) / 2;
      const rightWidth = leftWidth;
      const gridHeight = Math.min(maxHeight, Math.min(360, Math.max(260, width * 0.72)));
      const smallHeight = (gridHeight - gap) / 2;

      return {
        height: gridHeight,
        items: [
          {
            height: gridHeight,
            part: images[0],
            width: leftWidth,
            x: 0,
            y: 0
          },
          {
            height: smallHeight,
            part: images[1],
            width: rightWidth,
            x: leftWidth + gap,
            y: 0
          },
          {
            height: smallHeight,
            part: images[2],
            width: rightWidth,
            x: leftWidth + gap,
            y: smallHeight + gap
          }
        ],
        width
      };
    }

    const cellWidth = (width - gap) / 2;
    const cellHeight = Math.min((maxHeight - gap) / 2, cellWidth);

    return {
      height: cellHeight * 2 + gap,
      items: images.map((part, index) => ({
        height: cellHeight,
        part,
        width: cellWidth,
        x: (index % 2) * (cellWidth + gap),
        y: Math.floor(index / 2) * (cellHeight + gap)
      })),
      width
    };
  }

  function splitLongPdfWord(word, maxWidth, fontSize, font = "F1") {
    const lines = [];
    let current = "";

    for (const character of word) {
      const candidate = current + character;

      if (current && measurePdfText(candidate, fontSize, font) > maxWidth) {
        lines.push(current);
        current = character;
      } else {
        current = candidate;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  function createPdfHelveticaWidthMap() {
    const widths = new Map();
    const add = (characters, width) => {
      for (const character of characters) {
        widths.set(character.codePointAt(0), width);
      }
    };
    const aliasBytes = (bytes, baseCharacter) => {
      const width = widths.get(baseCharacter.codePointAt(0)) || PDF_HELVETICA_WIDTH_FALLBACK;
      for (const byte of bytes) {
        widths.set(byte, width);
      }
    };

    // Widths are in thousandths of an em for the PDF base Helvetica font.
    add(" !", 278);
    add("\"", 355);
    add("#$0123456789=_", 556);
    add("%", 889);
    add("&", 667);
    add("'", 222);
    add("()", 333);
    add("*", 389);
    add("+<>~", 584);
    add(",./:;[]\\", 278);
    add("-", 333);
    add("?", 556);
    add("@", 1015);
    add("ABEPRSVXY", 667);
    add("CDHNU", 722);
    add("GOQ", 778);
    add("FTZ", 611);
    add("I", 278);
    add("J", 500);
    add("K", 667);
    add("L", 556);
    add("M", 833);
    add("W", 944);
    add("^", 469);
    add("`", 222);
    add("abdeghnopqu", 556);
    add("cksvxyz", 500);
    add("ft", 278);
    add("ijl", 222);
    add("m", 833);
    add("r", 333);
    add("w", 722);
    add("{}", 334);
    add("|", 260);

    widths.set(128, 556);
    widths.set(130, 222);
    widths.set(131, 556);
    widths.set(132, 333);
    widths.set(133, 1000);
    widths.set(134, 556);
    widths.set(135, 556);
    widths.set(136, 333);
    widths.set(137, 1000);
    widths.set(139, 333);
    widths.set(140, 1000);
    widths.set(152, 333);
    widths.set(153, 1000);
    widths.set(155, 333);
    widths.set(156, 944);
    widths.set(160, 278);
    widths.set(161, 333);
    widths.set(162, 556);
    widths.set(163, 556);
    widths.set(164, 556);
    widths.set(165, 556);
    widths.set(166, 260);
    widths.set(167, 556);
    widths.set(168, 333);
    widths.set(169, 737);
    widths.set(170, 370);
    widths.set(171, 556);
    widths.set(172, 584);
    widths.set(173, 333);
    widths.set(174, 737);
    widths.set(175, 333);
    widths.set(176, 400);
    widths.set(177, 584);
    widths.set(178, 333);
    widths.set(179, 333);
    widths.set(180, 333);
    widths.set(181, 556);
    widths.set(182, 537);
    widths.set(183, 278);
    widths.set(184, 333);
    widths.set(185, 333);
    widths.set(186, 365);
    widths.set(187, 556);
    widths.set(188, 834);
    widths.set(189, 834);
    widths.set(190, 834);
    widths.set(191, 611);
    widths.set(198, 1000);
    widths.set(208, 722);
    widths.set(215, 584);
    widths.set(216, 778);
    widths.set(222, 667);
    widths.set(223, 611);
    widths.set(230, 889);
    widths.set(240, 556);
    widths.set(247, 584);
    widths.set(248, 611);
    widths.set(254, 556);
    widths.set(255, 500);

    aliasBytes([138], "S");
    aliasBytes([142], "Z");
    aliasBytes([154], "s");
    aliasBytes([158], "z");
    aliasBytes([159], "Y");
    aliasBytes([192, 193, 194, 195, 196, 197], "A");
    aliasBytes([199], "C");
    aliasBytes([200, 201, 202, 203], "E");
    aliasBytes([204, 205, 206, 207], "I");
    aliasBytes([209], "N");
    aliasBytes([210, 211, 212, 213, 214], "O");
    aliasBytes([217, 218, 219, 220], "U");
    aliasBytes([221], "Y");
    aliasBytes([224, 225, 226, 227, 228, 229], "a");
    aliasBytes([231], "c");
    aliasBytes([232, 233, 234, 235], "e");
    aliasBytes([236, 237, 238, 239], "i");
    aliasBytes([241], "n");
    aliasBytes([242, 243, 244, 245, 246], "o");
    aliasBytes([249, 250, 251, 252], "u");
    aliasBytes([253], "y");

    return widths;
  }

  function createPdfHelveticaBoldWidthMap() {
    const widths = createPdfHelveticaWidthMap();
    const set = (characters, width) => {
      for (const character of characters) {
        widths.set(character.codePointAt(0), width);
      }
    };
    const aliasBytes = (bytes, baseCharacter) => {
      const width = widths.get(baseCharacter.codePointAt(0)) || PDF_HELVETICA_WIDTH_FALLBACK;
      for (const byte of bytes) {
        widths.set(byte, width);
      }
    };

    set(" ", 278);
    set("!", 333);
    set("\"", 474);
    set("#$0123456789=", 556);
    set("%", 889);
    set("&", 722);
    set("'", 278);
    set("()", 333);
    set("*", 389);
    set("+<>~", 584);
    set(",", 278);
    set("-", 333);
    set("./", 278);
    set(":;", 333);
    set("?", 611);
    set("@", 975);
    set("[\\]", 333);
    set("_", 556);
    set("`", 278);
    set("{|}", 389);
    set("ABCDHNKRU", 722);
    set("E", 667);
    set("F", 611);
    set("GOQ", 778);
    set("I", 278);
    set("J", 556);
    set("L", 611);
    set("M", 833);
    set("PSVXY", 667);
    set("T", 611);
    set("W", 944);
    set("Z", 611);
    set("acexy", 556);
    set("bdghnopqu", 611);
    set("fjt", 333);
    set("i", 278);
    set("k", 556);
    set("l", 278);
    set("m", 889);
    set("r", 389);
    set("s", 556);
    set("vw", 778);
    set("z", 500);

    widths.set(128, 556);
    widths.set(130, 278);
    widths.set(131, 556);
    widths.set(132, 278);
    widths.set(133, 1000);
    widths.set(134, 556);
    widths.set(135, 556);
    widths.set(136, 333);
    widths.set(137, 1000);
    widths.set(139, 333);
    widths.set(140, 1000);
    widths.set(152, 333);
    widths.set(153, 1000);
    widths.set(155, 333);
    widths.set(156, 944);
    widths.set(160, 278);
    widths.set(161, 333);
    widths.set(162, 556);
    widths.set(163, 556);
    widths.set(164, 556);
    widths.set(165, 556);
    widths.set(166, 389);
    widths.set(167, 556);
    widths.set(168, 333);
    widths.set(169, 737);
    widths.set(170, 370);
    widths.set(171, 556);
    widths.set(172, 584);
    widths.set(173, 333);
    widths.set(174, 737);
    widths.set(175, 333);
    widths.set(176, 400);
    widths.set(177, 584);
    widths.set(178, 333);
    widths.set(179, 333);
    widths.set(180, 278);
    widths.set(181, 611);
    widths.set(182, 556);
    widths.set(183, 278);
    widths.set(184, 278);
    widths.set(185, 333);
    widths.set(186, 365);
    widths.set(187, 556);
    widths.set(188, 834);
    widths.set(189, 834);
    widths.set(190, 834);
    widths.set(191, 611);
    widths.set(198, 1000);
    widths.set(208, 722);
    widths.set(215, 584);
    widths.set(216, 778);
    widths.set(222, 667);
    widths.set(223, 611);
    widths.set(230, 889);
    widths.set(240, 611);
    widths.set(247, 584);
    widths.set(248, 611);
    widths.set(254, 611);
    widths.set(255, 556);

    aliasBytes([138], "S");
    aliasBytes([142], "Z");
    aliasBytes([154], "s");
    aliasBytes([158], "z");
    aliasBytes([159], "Y");
    aliasBytes([192, 193, 194, 195, 196, 197], "A");
    aliasBytes([199], "C");
    aliasBytes([200, 201, 202, 203], "E");
    aliasBytes([204, 205, 206, 207], "I");
    aliasBytes([209], "N");
    aliasBytes([210, 211, 212, 213, 214], "O");
    aliasBytes([217, 218, 219, 220], "U");
    aliasBytes([221], "Y");
    aliasBytes([224, 225, 226, 227, 228, 229], "a");
    aliasBytes([231], "c");
    aliasBytes([232, 233, 234, 235], "e");
    aliasBytes([236, 237, 238, 239], "i");
    aliasBytes([241], "n");
    aliasBytes([242, 243, 244, 245, 246], "o");
    aliasBytes([249, 250, 251, 252], "u");
    aliasBytes([253], "y");

    return widths;
  }

  function measurePdfText(text, fontSize, font = "F1") {
    let width = 0;
    const widths = getPdfWidthMap(font);

    for (const byte of encodeWinAnsi(text)) {
      width += widths.get(byte) || PDF_HELVETICA_WIDTH_FALLBACK;
    }

    return width * fontSize / 1000;
  }

  function getPdfWidthMap(font) {
    return font === "F2" ? PDF_HELVETICA_BOLD_WIDTHS : PDF_HELVETICA_WIDTHS;
  }

  function getPdfJustifiedWordSpacing(text, maxWidth, fontSize) {
    const spaces = (text.match(/ /g) || []).length;

    if (spaces < 2) {
      return 0;
    }

    const currentWidth = measurePdfText(text, fontSize);
    const extraWidth = maxWidth - currentWidth;

    if (extraWidth <= 0 || currentWidth < maxWidth * 0.72) {
      return 0;
    }

    const wordSpacing = extraWidth / spaces;
    return wordSpacing <= fontSize * 0.7 ? wordSpacing : 0;
  }

  function writePdfTextLine(writer, text, x, y, font, size, r = 0, g = 0, b = 0, options = {}) {
    const strengthenRegularText = font === "F1" && size >= 10.5 && r === 0 && g === 0 && b === 0;
    const strokeSetup = strengthenRegularText ? ` ${formatPdfNumber(r)} ${formatPdfNumber(g)} ${formatPdfNumber(b)} RG 0.015 w` : "";
    const renderMode = strengthenRegularText ? " 2 Tr" : "";
    const wordSpacing = options.wordSpacing ? ` ${formatPdfNumber(options.wordSpacing)} Tw` : "";
    writer.writeAscii(`q ${formatPdfNumber(r)} ${formatPdfNumber(g)} ${formatPdfNumber(b)} rg${strokeSetup} BT /${font} ${formatPdfNumber(size)} Tf${renderMode} 1 0 0 1 ${formatPdfNumber(x)} ${formatPdfNumber(y)} Tm${wordSpacing} `);
    writer.writeBytes(createPdfLiteralBytes(text));
    writer.writeAscii(" Tj ET Q\n");
  }

  function writePdfImage(writer, name, x, y, width, height) {
    writer.writeAscii(
      `q ${formatPdfNumber(width)} 0 0 ${formatPdfNumber(height)} ${formatPdfNumber(x)} ${formatPdfNumber(y)} cm /${name} Do Q\n`
    );
  }

  function writePdfImageCover(writer, name, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;

    writer.writeAscii(
      `q ${formatPdfNumber(x)} ${formatPdfNumber(y)} ${formatPdfNumber(width)} ${formatPdfNumber(height)} re W n ` +
      `${formatPdfNumber(drawWidth)} 0 0 ${formatPdfNumber(drawHeight)} ${formatPdfNumber(drawX)} ${formatPdfNumber(drawY)} cm /${name} Do Q\n`
    );
  }

  function writePdfLine(writer, x1, y1, x2, y2, r, g, b) {
    writer.writeAscii(
      `q ${formatPdfNumber(r)} ${formatPdfNumber(g)} ${formatPdfNumber(b)} RG 0.6 w ${formatPdfNumber(x1)} ${formatPdfNumber(y1)} m ${formatPdfNumber(x2)} ${formatPdfNumber(y2)} l S Q\n`
    );
  }

  function writePdfFilledRect(writer, x, y, width, height, r, g, b) {
    writer.writeAscii(
      `q ${formatPdfNumber(r)} ${formatPdfNumber(g)} ${formatPdfNumber(b)} rg ${formatPdfNumber(x)} ${formatPdfNumber(y)} ${formatPdfNumber(width)} ${formatPdfNumber(height)} re f Q\n`
    );
  }

  function writePdfRoundedRect(writer, x, y, width, height, radius, r, g, b) {
    const c = radius * 0.5522847498;
    const x0 = x;
    const x1 = x + radius;
    const x2 = x + width - radius;
    const x3 = x + width;
    const y0 = y;
    const y1 = y + radius;
    const y2 = y + height - radius;
    const y3 = y + height;

    writer.writeAscii(
      `q ${formatPdfNumber(r)} ${formatPdfNumber(g)} ${formatPdfNumber(b)} RG 0.8 w ` +
      `${formatPdfNumber(x1)} ${formatPdfNumber(y0)} m ` +
      `${formatPdfNumber(x2)} ${formatPdfNumber(y0)} l ` +
      `${formatPdfNumber(x2 + c)} ${formatPdfNumber(y0)} ${formatPdfNumber(x3)} ${formatPdfNumber(y1 - c)} ${formatPdfNumber(x3)} ${formatPdfNumber(y1)} c ` +
      `${formatPdfNumber(x3)} ${formatPdfNumber(y2)} l ` +
      `${formatPdfNumber(x3)} ${formatPdfNumber(y2 + c)} ${formatPdfNumber(x2 + c)} ${formatPdfNumber(y3)} ${formatPdfNumber(x2)} ${formatPdfNumber(y3)} c ` +
      `${formatPdfNumber(x1)} ${formatPdfNumber(y3)} l ` +
      `${formatPdfNumber(x1 - c)} ${formatPdfNumber(y3)} ${formatPdfNumber(x0)} ${formatPdfNumber(y2 + c)} ${formatPdfNumber(x0)} ${formatPdfNumber(y2)} c ` +
      `${formatPdfNumber(x0)} ${formatPdfNumber(y1)} l ` +
      `${formatPdfNumber(x0)} ${formatPdfNumber(y1 - c)} ${formatPdfNumber(x1 - c)} ${formatPdfNumber(y0)} ${formatPdfNumber(x1)} ${formatPdfNumber(y0)} c S Q\n`
    );
  }

  function buildPdfBytesFromPages(pdfDocument) {
    const pageEntries = pdfDocument.pages;
    const imageEntries = pdfDocument.images;
    const annotationEntries = [];
    pageEntries.forEach((page, pageIndex) => {
      for (const annotation of page.annotations || []) {
        annotationEntries.push({
          ...annotation,
          pageIndex
        });
      }
    });
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const catalogObject = 1;
    const pagesObject = 2;
    const regularFontObject = 3;
    const boldFontObject = 4;
    const italicFontObject = 5;
    const firstPageObject = 6;
    const firstImageObject = firstPageObject + (pageEntries.length * 2);
    const firstAnnotationObject = firstImageObject + imageEntries.length;
    const infoObject = firstAnnotationObject + annotationEntries.length;
    const objectCount = infoObject;
    const imageObjectByName = new Map(imageEntries.map((image, index) => {
      return [image.name, firstImageObject + index];
    }));
    const annotationRefsByPage = pageEntries.map(() => []);
    annotationEntries.forEach((annotation, index) => {
      annotationRefsByPage[annotation.pageIndex].push(firstAnnotationObject + index);
    });
    const pageRefs = pageEntries.map((page, index) => `${firstPageObject + index * 2} 0 R`).join(" ");
    const objects = [
      asciiBytes(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`),
      asciiBytes(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pageEntries.length} >>`),
      asciiBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
      asciiBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
      asciiBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>")
    ];

    for (let index = 0; index < pageEntries.length; index += 1) {
      const pageObject = firstPageObject + index * 2;
      const contentObject = pageObject + 1;
      const page = pageEntries[index];
      const stream = page.stream;
      const xObjectResources = page.imageNames.length > 0
        ? ` /XObject << ${page.imageNames.map((name) => `/${name} ${imageObjectByName.get(name)} 0 R`).join(" ")} >>`
        : "";
      const annotations = annotationRefsByPage[index].length > 0
        ? ` /Annots [${annotationRefsByPage[index].map((objectNumber) => `${objectNumber} 0 R`).join(" ")}]`
        : "";

      objects.push(asciiBytes(
        `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${formatPdfNumber(pageWidth)} ${formatPdfNumber(pageHeight)}]${annotations} /Resources << /Font << /F1 ${regularFontObject} 0 R /F2 ${boldFontObject} 0 R /F3 ${italicFontObject} 0 R >>${xObjectResources} >> /Contents ${contentObject} 0 R >>`
      ));
      objects.push(concatBytes([
        asciiBytes(`<< /Length ${stream.length} >>\nstream\n`),
        stream,
        asciiBytes("\nendstream")
      ]));
    }

    for (const image of imageEntries) {
      objects.push(buildPdfImageObject(image));
    }

    for (const annotation of annotationEntries) {
      objects.push(buildPdfLinkAnnotationObject(annotation));
    }

    objects.push(buildPdfInfoObject());

    return writePdfFile(objects, objectCount, catalogObject, infoObject);
  }

  function buildPdfInfoObject() {
    return concatBytes([
      asciiBytes("<< /Title "),
      createPdfLiteralBytes("Xtension PDF export"),
      asciiBytes(" /Creator "),
      createPdfLiteralBytes(PDF_GENERATOR_NAME),
      asciiBytes(" /Producer "),
      createPdfLiteralBytes(`${PDF_GENERATOR_NAME} PDF generator`),
      asciiBytes(" /CreationDate "),
      createPdfLiteralBytes(formatPdfDate(new Date())),
      asciiBytes(" >>")
    ]);
  }

  function buildPdfLinkAnnotationObject(annotation) {
    return concatBytes([
      asciiBytes(
        `<< /Type /Annot /Subtype /Link /Rect [${formatPdfNumber(annotation.x)} ${formatPdfNumber(annotation.y)} ${formatPdfNumber(annotation.x + annotation.width)} ${formatPdfNumber(annotation.y + annotation.height)}] /Border [0 0 0] /A << /S /URI /URI `
      ),
      createPdfLiteralBytes(annotation.url),
      asciiBytes(" >> >>")
    ]);
  }

  function buildPdfImageObject(image) {
    return concatBytes([
      asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(image.width))} /Height ${Math.max(1, Math.round(image.height))} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
      image.bytes,
      asciiBytes("\nendstream")
    ]);
  }

  function writePdfFile(objects, objectCount, catalogObject, infoObject) {
    const chunks = [];
    const offsets = [0];
    let offset = 0;

    const addChunk = (chunk) => {
      chunks.push(chunk);
      offset += chunk.length;
    };

    addChunk(asciiBytes("%PDF-1.4\n"));

    objects.forEach((objectBytes, index) => {
      offsets.push(offset);
      addChunk(asciiBytes(`${index + 1} 0 obj\n`));
      addChunk(objectBytes);
      addChunk(asciiBytes("\nendobj\n"));
    });

    const xrefOffset = offset;
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;

    for (let index = 1; index <= objectCount; index += 1) {
      xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }

    const infoEntry = infoObject ? ` /Info ${infoObject} 0 R` : "";
    xref += `trailer\n<< /Size ${objectCount + 1} /Root ${catalogObject} 0 R${infoEntry} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    addChunk(asciiBytes(xref));

    return concatBytes(chunks);
  }

  function formatPdfDate(date) {
    const pad = (value, size = 2) => String(value).padStart(size, "0");
    const timezoneOffset = -date.getTimezoneOffset();
    const timezoneSign = timezoneOffset >= 0 ? "+" : "-";
    const timezoneMinutes = Math.abs(timezoneOffset);

    return "D:" +
      pad(date.getFullYear(), 4) +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds()) +
      timezoneSign +
      pad(Math.floor(timezoneMinutes / 60)) +
      "'" +
      pad(timezoneMinutes % 60) +
      "'";
  }

  function createByteWriter() {
    const chunks = [];

    return {
      writeAscii(value) {
        chunks.push(asciiBytes(value));
      },
      writeBytes(value) {
        chunks.push(value);
      },
      toBytes() {
        return concatBytes(chunks);
      }
    };
  }

  function createPdfLiteralBytes(value) {
    const textBytes = encodeWinAnsi(value);
    const bytes = [40];

    for (const byte of textBytes) {
      if (byte === 40 || byte === 41 || byte === 92) {
        bytes.push(92, byte);
      } else if (byte === 10) {
        bytes.push(92, 110);
      } else if (byte === 13) {
        bytes.push(92, 114);
      } else {
        bytes.push(byte);
      }
    }

    bytes.push(41);
    return new Uint8Array(bytes);
  }

  function encodeWinAnsi(value) {
    const bytes = [];

    for (const character of String(value || "")) {
      const codePoint = character.codePointAt(0);

      if (PDF_WIN_ANSI_REPLACEMENTS.has(codePoint)) {
        bytes.push(PDF_WIN_ANSI_REPLACEMENTS.get(codePoint));
      } else if (codePoint >= 32 && codePoint <= 255) {
        bytes.push(codePoint);
      } else if (codePoint === 9 || codePoint === 10 || codePoint === 13) {
        bytes.push(32);
      } else {
        bytes.push(63);
      }
    }

    return bytes;
  }

  function asciiBytes(value) {
    const bytes = new Uint8Array(value.length);

    for (let index = 0; index < value.length; index += 1) {
      bytes[index] = value.charCodeAt(index) & 0xff;
    }

    return bytes;
  }

  function concatBytes(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  function uint8ArrayToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(binary);
  }

  function formatPdfNumber(value) {
    return Number(value).toFixed(2).replace(/\.?0+$/, "");
  }

  function buildExportFilename(article) {
    const parts = [
      formatFilenameDate(new Date()),
      getFilenameAccountName(article),
      getFilenameSubject(article)
    ].filter(Boolean);

    return `${sanitizeFilename(parts.join(" - "))}.pdf`;
  }

  function formatFilenameDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getFilenameAccountName(article) {
    const displayName = cleanAccountDisplayName(article.authorInfo?.displayName);
    if (displayName) {
      return displayName;
    }

    const fallbackHandle = cleanHandle(article.authorInfo?.handle || article.author);
    return fallbackHandle || "X";
  }

  function cleanAccountDisplayName(value) {
    const name = cleanText(value)
      .replace(/\bCompte certifi[eé]\b/gi, "")
      .trim();

    if (!name) {
      return "";
    }

    const withoutHandle = cleanText(name.replace(/@([A-Za-z0-9_]{1,20}).*$/i, ""));
    return withoutHandle || cleanHandle(name);
  }

  function getFilenameSubject(article) {
    const title = cleanText(article.title);
    const subject = title && !/^article x$/i.test(title)
      ? title
      : collectFilenameText(article.parts);

    return truncateFilenamePart(subject || "texte");
  }

  function collectFilenameText(parts = []) {
    for (const part of parts) {
      const text = cleanText(part?.text || "");
      if (text) {
        return text;
      }

      if (Array.isArray(part?.parts)) {
        const nestedText = collectFilenameText(part.parts);
        if (nestedText) {
          return nestedText;
        }
      }
    }

    return "";
  }

  function truncateFilenamePart(value, maxLength = 90) {
    const text = cleanText(value);
    if (text.length <= maxLength) {
      return text;
    }

    const truncated = cleanText(text.slice(0, maxLength).replace(/\s+\S*$/, ""));
    return truncated || text.slice(0, maxLength).trim();
  }

  function sanitizeFilename(value) {
    const fallback = "article-x";
    const name = cleanText(value)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    return name || fallback;
  }

  function getPdfImageOpenUrl(part) {
    return part?.src || "";
  }

  function getExtensionVersion() {
    try {
      return RUNTIME_API?.getManifest?.()?.version || "development";
    } catch (error) {
      return "development";
    }
  }

  function getRuntimeResourceUrl(path) {
    try {
      const runtime = (globalThis.chrome || globalThis.browser)?.runtime || RUNTIME_API;
      return runtime?.getURL ? runtime.getURL(path) : "";
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        markExtensionContextInvalidated();
      }

      return "";
    }
  }

  function getExtensionReloadMessage() {
    return "Extension rechargée : rechargez aussi l'onglet X, puis générez un nouveau PDF.";
  }

  function isExtensionContextInvalidatedError(error) {
    return /extension context invalidated/i.test(error?.message || String(error || ""));
  }

  function createRuntimeUnavailableError(error) {
    if (isExtensionContextInvalidatedError(error)) {
      markExtensionContextInvalidated();
      return new Error(getExtensionReloadMessage());
    }

    return new Error(error?.message || String(error || "") || getExtensionReloadMessage());
  }

  function markExtensionContextInvalidated() {
    if (extensionContextInvalidated) {
      return;
    }

    extensionContextInvalidated = true;
    enhanceQueued = false;
    pageObserver?.disconnect?.();
    pageObserver = null;

    document.removeEventListener("pointerdown", rememberMenuTriggerContext, true);
    document.removeEventListener("click", rememberDraftComposerSubmit, true);
    document.removeEventListener("keydown", rememberMenuTriggerContext, true);
    document.removeEventListener("focusin", scheduleEnhancementUnlessNativeMediaControl, true);
    document.removeEventListener("focusout", scheduleEnhancementUnlessNativeMediaControl, true);
    document.removeEventListener("input", scheduleEnhancement, true);
    document.removeEventListener("pointerup", handleDraftActionPointerUp, true);
    document.removeEventListener("pointerup", scheduleEnhancementUnlessNativeMediaControl, true);

    cleanupXtensionInjectedUi();
  }

  function cleanupXtensionInjectedUi() {
    document.querySelectorAll(REPLY_SUGGESTIONS_PANEL_SELECTOR).forEach(removeReplySuggestionsPanel);
    document.querySelectorAll(".xtension-draft-language-menu").forEach((menu) => menu.remove());
    document.querySelectorAll(`${MENU_ITEM_SELECTOR}, ${REPLY_BUTTON_SELECTOR}, ${DRAFT_ACTIONS_HOST_SELECTOR}, .xtension-draft-actions-host, .xtension-toast`).forEach((node) => node.remove());
    document.querySelectorAll(`[${XTENSION_OVERLAY_ROOT_ATTRIBUTE}]`).forEach((root) => root.remove());
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      const runtime = globalThis.chrome?.runtime || globalThis.browser?.runtime;

      if (!runtime?.sendMessage) {
        markExtensionContextInvalidated();
        reject(new Error(getExtensionReloadMessage()));
        return;
      }

      try {
        if (!globalThis.chrome && globalThis.browser) {
          runtime.sendMessage(message).then(resolve, (error) => reject(createRuntimeUnavailableError(error)));
          return;
        }

        const maybePromise = runtime.sendMessage(message, (response) => {
          const error = runtime.lastError;

          if (error) {
            reject(createRuntimeUnavailableError(error));
            return;
          }

          resolve(response);
        });

        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve, (error) => reject(createRuntimeUnavailableError(error)));
        }
      } catch (error) {
        reject(createRuntimeUnavailableError(error));
      }
    });
  }

  function isElementAfter(reference, element) {
    return Boolean(reference.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function isElementBeforeOrSame(element, reference) {
    return element === reference ||
      Boolean(element.compareDocumentPosition(reference) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function getClassName(element, fallback) {
    if (!element) {
      return fallback;
    }

    if (typeof element.className === "string") {
      return element.className || fallback;
    }

    return element.getAttribute("class") || fallback;
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanMultilineText(value) {
    return normalizeUrlFragments(String(value || ""))
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\f\v]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\s+\n/g, "\n")
      .trim();
  }

  function normalizeUrlFragments(value) {
    return String(value || "")
      .replace(/\b(https?:\/\/)\s*\n\s*/gi, "$1")
      .replace(/\b(https?:\/\/)\s+([A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi, "$1$2");
  }

  function extractVisibleText(element) {
    return cleanMultilineText(element?.innerText || element?.textContent || "");
  }

  function localizedText(key, fallback) {
    try {
      return I18N_API?.getMessage?.(key) || fallback || key;
    } catch (error) {
      return fallback || key;
    }
  }

  function localizedTemplate(key, replacements, fallback) {
    let value = localizedText(key, fallback);

    for (const [name, replacement] of Object.entries(replacements || {})) {
      value = value.replaceAll(`{${name}}`, String(replacement ?? ""));
    }

    return value;
  }

  function getUiLocale() {
    let rawLocale = "";

    try {
      rawLocale = I18N_API?.getUILanguage?.() || "";
    } catch (error) {
      rawLocale = "";
    }

    rawLocale ||= navigator.language || "en";
    return rawLocale.replace("_", "-");
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(getUiLocale(), {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function showToast(message, options = {}) {
    document.querySelector(".xtension-toast")?.remove();

    const toast = document.createElement("div");
    toast.className = "xtension-toast";
    if (options.role) {
      toast.setAttribute("role", options.role);
    }
    toast.textContent = message;
    mountXtensionOverlayBelowXLayers(toast);
    if (!toast.isConnected) {
      document.body.append(toast);
    }

    if (!options.persistent) {
      window.setTimeout(() => {
        toast.remove();
      }, options.duration || 4200);
    }

    return toast;
  }

  function hideToast() {
    document.querySelector(".xtension-toast")?.remove();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
