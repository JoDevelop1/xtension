(() => {
  "use strict";

  const MENU_ITEM_SELECTOR = "[data-xtension-menu-item]";
  const MENU_ITEM_ATTRIBUTE = "data-xtension-menu-item";
  const MENU_ICON_ATTRIBUTE = "data-xtension-menu-icon";
  const MENU_LABEL = "Télécharger en PDF";
  const PDF_MENU_ICON_PATH = "pdf-menu-icon.png";
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

  let enhanceQueued = false;
  let lastMenuContext = null;

  function start() {
    document.addEventListener("pointerdown", rememberMenuTriggerContext, true);
    document.addEventListener("keydown", rememberMenuTriggerContext, true);
    enhanceDropdowns();

    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleEnhancement() {
    if (enhanceQueued) {
      return;
    }

    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      enhanceDropdowns();
    });
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

    const icon = document.createElement("div");
    icon.className = getClassName(templateIcon, "css-175oi2r r-1777fci");
    icon.setAttribute(MENU_ICON_ATTRIBUTE, "true");
    icon.append(createPdfIcon(getClassName(templateSvg, "")));

    const label = document.createElement("div");
    label.className = getClassName(templateLabel, "css-175oi2r");

    const text = document.createElement("div");
    text.dir = "ltr";
    text.className = getClassName(templateText, "");
    text.style.color = templateText?.style?.color || "rgb(15, 20, 25)";

    const span = document.createElement("span");
    span.className = getClassName(templateSpan, "");
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
    const runtime = (globalThis.chrome || globalThis.browser)?.runtime;
    return runtime?.getURL ? runtime.getURL(path) : path;
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
    showToast("Préparation du PDF...", { persistent: true });

    const article = collectArticle(context);

    if (!article) {
      showToast("Contenu X introuvable sur la page.");
      return;
    }

    downloadArticleAsPdf(article).catch((error) => {
      showToast(error?.message || "Impossible de générer le PDF.");
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
      title: title || "Article X",
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
      ? "Apercu video"
      : cleanText(element.getAttribute("alt")) || "Image";

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
    showToast("Préparation du PDF...", { persistent: true });

    await hydrateArticleImages(article);

    showToast("Génération du PDF...", { persistent: true });
    const pdfBytes = buildDirectPdfBytes(article);
    const dataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(pdfBytes)}`;
    const filename = buildExportFilename(article);
    showToast("Ouverture de la fenêtre d'enregistrement...", { persistent: true });
    const response = await sendRuntimeMessage({
      type: "xtension-download-pdf",
      filename,
      dataUrl
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Le téléchargement a échoué.");
    }

    hideToast();
  }

  async function hydrateArticleImages(article) {
    const imageParts = collectHydratableImageParts(article.parts);
    const avatarParts = collectHydratableAvatarTargets(article);

    if (imageParts.length === 0 && avatarParts.length === 0) {
      return;
    }

    showToast(`Téléchargement des images (${imageParts.length + avatarParts.length})...`, { persistent: true });

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
          part.imageError = response?.error || "image indisponible";
          return;
        }

        part.pdfImage = await convertDataUrlImageToPdfJpeg(response.image.dataUrl);
      } catch (error) {
        part.imageError = error?.message || "image indisponible";
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

    if (isTweetExport && article.authorInfo) {
      documentBuilder.addAuthorHeader(article.authorInfo, {
        after: 24,
        publishedAt: article.publishedAt,
        size: "large"
      });
    } else {
      documentBuilder.addText(article.title || "Article X", {
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
          after: 6
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
            after: part.mediaKind === "video" ? 8 : 20
          });
        } else {
          documentBuilder.addText(`[Image non insérée] ${part.alt}`, {
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
          documentBuilder.addText(part.sourceUrl
            ? `Video : apercu uniquement. Ouvrir le tweet source pour lire la video - ${part.sourceUrl}`
            : "Video : apercu uniquement. Ouvrir la source en fin de PDF pour lire la video.", {
            font: "F3",
            size: 9,
            lineHeight: 12,
            after: 8
          });
        }
      } else {
        documentBuilder.addText(text, {
          font: "F1",
          size: 11.5,
          lineHeight: 16.5,
          after: 6
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

        if (candidate.type === "image" && bodyPartCount > 0 && bodyPartCount <= 2 && bodyTextLength <= 360) {
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

    for (let index = 0; index < article.parts.length; index += 1) {
      const part = article.parts[index];
      if (part.type === "tweet-block") {
        documentBuilder.keepPartsTogether(part.parts, {
          allowNewPage: tweetBlockIndex > 0,
          maxWastedHeight: 110,
          minStartHeight: 90
        });

        for (const tweetPart of part.parts || []) {
          renderPart(tweetPart);
        }

        tweetBlockIndex += 1;
        continue;
      }

      keepHeadingWithFollowingContent(article.parts, index);
      renderPart(part);
    }

    documentBuilder.addText("Source", {
      font: "F2",
      size: 11,
      lineHeight: 15,
      before: 28,
      after: 5
    });
    documentBuilder.addText(article.sourceUrl, {
      font: "F1",
      size: 8.5,
      lineHeight: 12
    });

    return buildPdfBytesFromPages(documentBuilder.getDocument());
  }

  function createPdfLayout() {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const marginLeft = 54;
    const marginRight = 54;
    const marginTop = 42;
    const marginBottom = 40;
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
            height += 16 + wrapPdfText(`[Image non insérée] ${part.alt || ""}`, contentWidth, 10).length * 14 + 6;
            height += wrapPdfText(part.imageError ? `${part.imageError} - ${part.src}` : part.src || "", contentWidth, 8).length * 11 + 14;
          }

          if (part.mediaKind === "video") {
            const videoText = part.sourceUrl
              ? `Video : apercu uniquement. Ouvrir le tweet source pour lire la video - ${part.sourceUrl}`
              : "Video : apercu uniquement. Ouvrir la source en fin de PDF pour lire la video.";
            height += wrapPdfText(videoText, contentWidth, 9).length * 12 + 8;
          }
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

        for (const line of lines) {
          ensureSpace(lineHeight);
          writePdfTextLine(writer, line, x, y, font, size);
          y -= lineHeight;
        }
      }

      if (after) {
        y -= after;
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
            cursorY -= 6;
          } else if (partText) {
            const lines = wrapPdfText(`[Image non insérée] ${partText}`, innerWidth, 9);
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
      addEmbeddedTweetCard,
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
          height += wrapPdfText(`[Image non insérée] ${text}`, innerWidth, 9).length * 12 + 4;
        }
      } else if (part.type === "link-card") {
        height += estimateLinkCardHeight(part, innerWidth, {
          imageTextGap: 10,
          imageMaxHeight: 190,
          padding: 0,
          squareImage: true
        }) + 5;
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

  function splitLongPdfWord(word, maxWidth, fontSize) {
    const lines = [];
    let current = "";

    for (const character of word) {
      const candidate = current + character;

      if (current && measurePdfText(candidate, fontSize) > maxWidth) {
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

  function measurePdfText(text, fontSize) {
    let width = 0;

    for (const character of text) {
      if (" .,;:!|ilI'`[]()".includes(character)) {
        width += 0.28;
      } else if ("mwMW@#%&".includes(character)) {
        width += 0.82;
      } else if (character === character.toUpperCase() && /[A-Z]/.test(character)) {
        width += 0.62;
      } else {
        width += 0.52;
      }
    }

    return width * fontSize;
  }

  function writePdfTextLine(writer, text, x, y, font, size, r = 0, g = 0, b = 0) {
    const strengthenRegularText = font === "F1" && size >= 10.5 && r === 0 && g === 0 && b === 0;
    const strokeSetup = strengthenRegularText ? ` ${formatPdfNumber(r)} ${formatPdfNumber(g)} ${formatPdfNumber(b)} RG 0.015 w` : "";
    const renderMode = strengthenRegularText ? " 2 Tr" : "";
    writer.writeAscii(`q ${formatPdfNumber(r)} ${formatPdfNumber(g)} ${formatPdfNumber(b)} rg${strokeSetup} BT /${font} ${formatPdfNumber(size)} Tf${renderMode} 1 0 0 1 ${formatPdfNumber(x)} ${formatPdfNumber(y)} Tm `);
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
    const objectCount = 5 + (pageEntries.length * 2) + imageEntries.length + annotationEntries.length;
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

    return writePdfFile(objects, objectCount, catalogObject);
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

  function writePdfFile(objects, objectCount, catalogObject) {
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

    xref += `trailer\n<< /Size ${objectCount + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    addChunk(asciiBytes(xref));

    return concatBytes(chunks);
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
    const replacementMap = new Map([
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
    const bytes = [];

    for (const character of String(value || "")) {
      const codePoint = character.codePointAt(0);

      if (replacementMap.has(codePoint)) {
        bytes.push(replacementMap.get(codePoint));
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

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      const runtime = globalThis.chrome?.runtime || globalThis.browser?.runtime;

      if (!runtime?.sendMessage) {
        reject(new Error("API d'extension indisponible."));
        return;
      }

      try {
        if (!globalThis.chrome && globalThis.browser) {
          runtime.sendMessage(message).then(resolve, reject);
          return;
        }

        const maybePromise = runtime.sendMessage(message, (response) => {
          const error = runtime.lastError;

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
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\f\v]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\s+\n/g, "\n")
      .trim();
  }

  function extractVisibleText(element) {
    return cleanMultilineText(element?.innerText || element?.textContent || "");
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function showToast(message, options = {}) {
    document.querySelector(".xtension-toast")?.remove();

    const toast = document.createElement("div");
    toast.className = "xtension-toast";
    toast.textContent = message;
    document.body.append(toast);

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
