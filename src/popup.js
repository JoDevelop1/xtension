(() => {
  "use strict";

  const extensionApi = globalThis.chrome || globalThis.browser;
  const runtimeApi = extensionApi?.runtime;
  const i18nApi = extensionApi?.i18n;
  const openButton = document.querySelector("#open-options");

  document.addEventListener("DOMContentLoaded", () => {
    localizePage();
    openButton?.addEventListener("click", openOptions);
  }, { once: true });

  function localizePage() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      const message = localizedText(key, element.textContent);
      element.textContent = message;
    });
  }

  function openOptions() {
    try {
      const maybePromise = runtimeApi?.openOptionsPage?.();
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.finally(closePopup);
      } else {
        closePopup();
      }
    } catch (error) {
      const optionsUrl = runtimeApi?.getURL?.("options.html");
      if (optionsUrl && extensionApi?.tabs?.create) {
        extensionApi.tabs.create({ url: optionsUrl }, closePopup);
      }
    }
  }

  function closePopup() {
    globalThis.close?.();
  }

  function localizedText(key, fallback) {
    try {
      return i18nApi?.getMessage?.(key) || fallback || key;
    } catch (error) {
      return fallback || key;
    }
  }
})();
