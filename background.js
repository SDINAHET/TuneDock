const WEB_PLAYER_MATCH = "https://open.spotify.com/*";
const WIDGET_SCRIPT_ID = "tunedock-floating-widget-v1";
const WIDGET_ORIGINS = ["https://*/*"];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const t = (key) => chrome.i18n.getMessage(key) || key;

async function syncWidgetRegistration() {
  const allowed = await chrome.permissions.contains({ origins: WIDGET_ORIGINS });
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [WIDGET_SCRIPT_ID] });
  if (allowed && !registered.length) {
    await chrome.scripting.registerContentScripts([{
      id: WIDGET_SCRIPT_ID,
      matches: WIDGET_ORIGINS,
      js: ["widget.js"],
      runAt: "document_idle",
      persistAcrossSessions: true
    }]);
  } else if (!allowed && registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [WIDGET_SCRIPT_ID] });
  }
}

async function injectWidgetInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://")) return;
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["widget.js"] }); } catch (_) {}
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get([
    "tunedockWidgetVisible",
    "tunedockWidgetOnStartup",
    "tunedockAutoOpenSpotify"
  ]);
  const defaults = {};
  if (typeof settings.tunedockWidgetVisible !== "boolean") defaults.tunedockWidgetVisible = false;
  if (typeof settings.tunedockWidgetOnStartup !== "boolean") defaults.tunedockWidgetOnStartup = false;
  if (typeof settings.tunedockAutoOpenSpotify !== "boolean") defaults.tunedockAutoOpenSpotify = true;
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults);
  await syncWidgetRegistration();
});

chrome.runtime.onStartup.addListener(async () => {
  const { tunedockAutoOpenSpotify = true, tunedockWidgetOnStartup = false } =
    await chrome.storage.local.get(["tunedockAutoOpenSpotify", "tunedockWidgetOnStartup"]);
  await chrome.storage.local.set({ tunedockWidgetVisible: tunedockWidgetOnStartup });
  await syncWidgetRegistration();
  if (!tunedockAutoOpenSpotify) return;
  const tabs = await chrome.tabs.query({ url: WEB_PLAYER_MATCH });
  if (!tabs.length) await chrome.tabs.create({ url: "https://open.spotify.com/", active: false });
});

// Firefox exposes extension sidebars through sidebarAction. Opening it from
// the toolbar click keeps the same one-click behavior as TuneDock on Chrome.
chrome.action.onClicked.addListener(() => {
  if (globalThis.browser?.sidebarAction?.open) {
    globalThis.browser.sidebarAction.open().catch(() => {});
  }
});

async function waitForWebPlayer(tabId) {
  let lastError = null;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: "tunedock-web:get-playback" });
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw new Error(lastError ? t("spotifyStartupTimeout") : t("spotifyUnavailable"));
}

async function ensureWebPlayer(activate = false) {
  const tabs = await chrome.tabs.query({ url: WEB_PLAYER_MATCH });
  let tab = [...tabs].sort((a, b) => Number(b.audible) - Number(a.audible))[0];
  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: "https://open.spotify.com/", active: activate });
    if (!tab.id) throw new Error(t("spotifyOpenFailed"));
    return { opened: true, reloaded: false, playback: await waitForWebPlayer(tab.id) };
  }
  if (activate) await chrome.tabs.update(tab.id, { active: true });
  try {
    const playback = await chrome.tabs.sendMessage(tab.id, { type: "tunedock-web:get-playback" });
    if (playback) return { opened: false, reloaded: false, playback };
  } catch (_) {}
  await chrome.tabs.reload(tab.id);
  return { opened: false, reloaded: true, playback: await waitForWebPlayer(tab.id) };
}

async function sendToWebPlayer(message) {
  const tabs = await chrome.tabs.query({ url: WEB_PLAYER_MATCH });
  if (!tabs.length) throw new Error(t("spotifyNotOpen"));
  const ordered = [...tabs].sort((a, b) => Number(b.audible) - Number(a.audible));
  let lastError = null;
  for (const tab of ordered) {
    if (!tab.id) continue;
    try {
      const result = await chrome.tabs.sendMessage(tab.id, message);
      if (result?.error) throw new Error(result.error);
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
  }
  const detail = lastError?.message || "";
  if (detail && !/receiving end|could not establish connection|message port closed/i.test(detail)) {
    throw new Error(detail);
  }
  throw new Error(t("spotifyNotResponding"));
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (typeof request?.type !== "string" || !request.type.startsWith("tunedock:")) return;
  (async () => {
    if (request.type === "tunedock:ensure-web-player") return ensureWebPlayer(Boolean(request.activate));
    if (request.type === "tunedock:playback") return sendToWebPlayer({ type: "tunedock-web:get-playback" });
    if (request.type === "tunedock:action") {
      return sendToWebPlayer({ type: "tunedock-web:action", action: request.action });
    }
    if (request.type === "tunedock:seek") {
      return sendToWebPlayer({ type: "tunedock-web:seek", positionMs: Math.max(0, Number(request.positionMs) || 0) });
    }
    if (request.type === "tunedock:volume") {
      return sendToWebPlayer({ type: "tunedock-web:volume", volume: Math.max(0, Math.min(100, Number(request.volume) || 0)) });
    }
    if (request.type === "tunedock:sync-widget") {
      await syncWidgetRegistration();
      const { tunedockWidgetVisible = false } = await chrome.storage.local.get("tunedockWidgetVisible");
      if (tunedockWidgetVisible) await injectWidgetInActiveTab();
      return { synced: true };
    }
    throw new Error(t("unknownCommand"));
  })()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
