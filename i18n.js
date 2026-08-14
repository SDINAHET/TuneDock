(() => {
  let localeMessages = null;
  let fallbackMessages = null;
  let usingOverride = false;
  let activeLocale = chrome.i18n.getMessage("@@ui_locale") || "en";

  function formatMessage(value, substitutions) {
    if (!substitutions) return value;
    const values = Array.isArray(substitutions) ? substitutions : [substitutions];
    return values.reduce((text, item, index) => text.replaceAll(`$${index + 1}`, String(item)), value);
  }

  const msg = (key, substitutions) => {
    const local = localeMessages?.[key]?.message;
    const native = chrome.i18n.getMessage(key, substitutions);
    const fallback = fallbackMessages?.[key]?.message;
    const value = usingOverride ? (local || fallback || native) : (native || fallback);
    return value ? formatMessage(value, substitutions) : key;
  };

  function applyTranslations() {
    document.documentElement.lang = activeLocale.replace("_", "-");
    document.documentElement.dir = activeLocale === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = msg(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = msg(element.dataset.i18nTitle);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", msg(element.dataset.i18nAria));
    });
    if (document.querySelector('[data-i18n="privacyPageTitle"]')) {
      document.title = msg("privacyPageTitle");
    }
  }

  window.tdMsg = msg;
  window.tdLocale = () => activeLocale;
  window.tdSetLocale = async (locale) => {
    await chrome.storage.local.set({ tunedockLanguageOverride: locale || "" });
    location.reload();
  };
  window.tdI18nReady = (async () => {
    const { tunedockLanguageOverride = "" } = await chrome.storage.local.get("tunedockLanguageOverride");
    try {
      const fallbackResponse = await fetch(chrome.runtime.getURL("_locales/en/messages.json"));
      if (fallbackResponse.ok) fallbackMessages = await fallbackResponse.json();
    } catch (_) {}
    if (tunedockLanguageOverride) {
      usingOverride = true;
      try {
        const response = await fetch(chrome.runtime.getURL(`_locales/${tunedockLanguageOverride}/messages.json`));
        if (response.ok) {
          localeMessages = await response.json();
          activeLocale = tunedockLanguageOverride;
        }
      } catch (_) {}
    }
    applyTranslations();
  })();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.tunedockLanguageOverride
        && document.querySelector('[data-i18n="privacyPageTitle"]')) {
      location.reload();
    }
  });
})();
