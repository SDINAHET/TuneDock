const $ = (id) => document.getElementById(id);
const t = (key, substitutions) => window.tdMsg?.(key, substitutions) || key;
const ui = {
  welcome: $("welcome"), player: $("player"), settingsPanel: $("settingsPanel"), connectionStatus: $("connectionStatus"),
  playerMessage: $("playerMessage"), albumArt: $("albumArt"), albumFallback: $("albumFallback"),
  artLink: $("artLink"), trackTitle: $("trackTitle"), trackArtist: $("trackArtist"),
  elapsed: $("elapsed"), duration: $("duration"), progress: $("progress"),
  playPause: $("playPause"), previous: $("previous"), next: $("next"), volume: $("volume"), mute: $("mute"),
  shuffle: $("shuffle"), favorite: $("favorite"), repeat: $("repeat"), openSpotify: $("openSpotify"),
  searchLyrics: $("searchLyrics")
};

let currentPlayback = null;
let currentSaved = false;
let widgetVisible = false;
let pollTimer = null;
let progressTimer = null;
let progressAnchor = null;
let viewBeforeSettings = null;
let lastNonZeroVolume = 50;
let volumeSendTimer = null;
let seekSendTimer = null;

const LANGUAGE_OPTIONS = [
  ["ar", "العربية"], ["de", "Deutsch"], ["en", "English"], ["es", "Español"],
  ["fr", "Français"], ["hi", "हिन्दी"], ["id", "Bahasa Indonesia"], ["it", "Italiano"],
  ["ja", "日本語"], ["ko", "한국어"], ["nl", "Nederlands"], ["pl", "Polski"],
  ["pt_BR", "Português (Brasil)"], ["ru", "Русский"], ["sv", "Svenska"], ["th", "ไทย"],
  ["tr", "Türkçe"], ["uk", "Українська"], ["vi", "Tiếng Việt"], ["zh_CN", "简体中文"]
];

function show(view) {
  ui.welcome.classList.add("hidden");
  ui.player.classList.add("hidden");
  ui.settingsPanel.classList.add("hidden");
  view.classList.remove("hidden");
}

async function openSettingsPanel() {
  viewBeforeSettings = ui.welcome.classList.contains("hidden") ? ui.player : ui.welcome;
  show(ui.settingsPanel);
  const { tunedockLanguageOverride = "" } = await chrome.storage.local.get("tunedockLanguageOverride");
  const select = $("languageOverride");
  select.replaceChildren();
  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = t("automaticLanguage", chrome.i18n.getMessage("@@ui_locale") || "en");
  select.append(automatic);
  for (const [value, label] of LANGUAGE_OPTIONS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  select.value = tunedockLanguageOverride;
  $("extensionVersion").textContent = `v${chrome.runtime.getManifest().version}`;
  $("openSettings").textContent = "←";
  $("openSettings").setAttribute("aria-label", t("backToPlayer"));
  $("openSettings").title = t("backToPlayer");
  $("openSettings").focus();
}

function closeSettingsPanel() {
  show(viewBeforeSettings || ui.player);
  $("openSettings").textContent = "⚙";
  $("openSettings").setAttribute("aria-label", t("settings"));
  $("openSettings").title = t("settings");
  $("openSettings").focus();
}

function message(text = "", error = false) {
  ui.playerMessage.textContent = text;
  ui.playerMessage.classList.toggle("error", error);
}

function setConnection(state, label) {
  ui.connectionStatus.className = `status-pill ${state}`;
  ui.connectionStatus.querySelector("span").textContent = label;
}

function setControlAvailability(button, available, unavailableMessage) {
  button.disabled = available === false;
  if (available === false) {
    button.title = unavailableMessage;
    button.setAttribute("aria-label", unavailableMessage);
  } else {
    const labels = { previous: "previousTrack", next: "nextTrack", shuffle: "shuffle", repeat: "repeat" };
    const label = t(labels[button.id] || "playPause");
    button.title = label;
    button.setAttribute("aria-label", label);
  }
}

function formatTime(milliseconds = 0) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

async function send(payload) {
  const response = await chrome.runtime.sendMessage(payload);
  if (!response?.ok) throw new Error(response?.error || t("commandFailed"));
  return response.data;
}

function renderFavorite(saved) {
  currentSaved = saved;
  ui.favorite.textContent = saved ? "✓" : "＋";
  ui.favorite.classList.toggle("active", saved);
  ui.favorite.setAttribute("aria-label", saved ? t("removeLiked") : t("addLiked"));
  ui.favorite.title = saved ? t("removeLiked") : t("addLiked");
}

function renderPlayback(playback) {
  currentPlayback = playback;
  const item = playback?.item;
  if (!item) {
    setConnection("waiting", t("statusWaiting"));
    ui.trackTitle.textContent = t("noActiveTrack");
    ui.trackArtist.textContent = t("startMusicSpotify");
    ui.albumArt.classList.add("hidden");
    ui.albumFallback.classList.remove("hidden");
    ui.progress.value = 0;
    ui.elapsed.textContent = "0:00";
    ui.duration.textContent = "0:00";
    ui.playPause.textContent = "▶";
    progressAnchor = null;
    ui.searchLyrics.href = "https://www.google.com";
    setControlAvailability(ui.previous, false, t("previousUnavailable"));
    setControlAvailability(ui.next, false, t("nextUnavailable"));
    setControlAvailability(ui.shuffle, false, t("shuffleUnavailable"));
    setControlAvailability(ui.repeat, false, t("repeatUnavailable"));
    return;
  }

  setConnection("connected", t("statusActive"));
  const artists = (item.artists || []).map((artist) => artist.name).join(", ") || t("unknownArtist");
  const spotifyUrl = item.external_urls?.spotify || "https://open.spotify.com";
  ui.trackTitle.textContent = item.name || t("unknownTrack");
  ui.trackArtist.textContent = artists;
  ui.artLink.href = spotifyUrl;
  ui.openSpotify.href = spotifyUrl;
  const image = item.album?.images?.[0]?.url;
  if (image) {
    ui.albumArt.src = image;
    ui.albumArt.classList.remove("hidden");
    ui.albumFallback.classList.add("hidden");
  } else {
    ui.albumArt.classList.add("hidden");
    ui.albumFallback.classList.remove("hidden");
  }
  ui.duration.textContent = formatTime(item.duration_ms);
  const volume = playback.device?.volume_percent ?? 50;
  ui.volume.value = volume;
  if (volume > 0) lastNonZeroVolume = volume;
  ui.mute.textContent = volume > 0 ? "🔊" : "🔇";
  ui.mute.setAttribute("aria-label", volume > 0 ? t("mute") : t("unmute"));
  ui.mute.title = ui.mute.getAttribute("aria-label");
  ui.playPause.textContent = playback.is_playing ? "⏸" : "▶";
  ui.playPause.setAttribute("aria-label", playback.is_playing ? t("pause") : t("play"));
  ui.shuffle.classList.toggle("active", Boolean(playback.shuffle_state));
  ui.repeat.classList.toggle("active", playback.repeat_state && playback.repeat_state !== "off");
  ui.repeat.textContent = playback.repeat_state === "track" ? "↻¹" : "↻";
  if (typeof playback.is_saved === "boolean") renderFavorite(playback.is_saved);
  const capabilities = playback.capabilities || {};
  setControlAvailability(ui.previous, capabilities.previous !== false, t("previousUnavailable"));
  setControlAvailability(ui.next, capabilities.next !== false, t("nextUnavailable"));
  setControlAvailability(ui.shuffle, capabilities.shuffle !== false, t("shuffleUnavailable"));
  setControlAvailability(ui.repeat, capabilities.repeat !== false, t("repeatUnavailable"));
  ui.searchLyrics.href = `https://www.google.com/search?q=${encodeURIComponent(`${item.name || ""} ${artists} lyrics`)}`;
  progressAnchor = {
    progressMs: playback.progress_ms || 0,
    durationMs: item.duration_ms || 0,
    at: Date.now(),
    playing: playback.is_playing
  };
  tickProgress();
}

function tickProgress() {
  if (!progressAnchor) return;
  const extra = progressAnchor.playing ? Date.now() - progressAnchor.at : 0;
  const position = Math.min(progressAnchor.progressMs + extra, progressAnchor.durationMs);
  ui.elapsed.textContent = formatTime(position);
  ui.progress.value = progressAnchor.durationMs
    ? Math.round(position / progressAnchor.durationMs * 1000)
    : 0;
}

async function updatePlayback() {
  try {
    renderPlayback(await send({ type: "tunedock:playback" }));
    message("");
  } catch (error) {
    setConnection("error", t("statusOffline"));
    message(error.message, true);
  }
}

async function ensureSpotifyReady(activate = false) {
  setConnection("connecting", t("statusConnecting"));
  message(t("connectingSpotify"));
  try {
    const result = await send({ type: "tunedock:ensure-web-player", activate });
    renderPlayback(result.playback);
    message("");
    return true;
  } catch (error) {
    setConnection("error", t("statusOffline"));
    message(error.message, true);
    return false;
  }
}

function startPolling() {
  clearInterval(pollTimer);
  clearInterval(progressTimer);
  pollTimer = setInterval(updatePlayback, 5000);
  progressTimer = setInterval(tickProgress, 500);
}

async function action(name) {
  try {
    const result = await send({ type: "tunedock:action", action: name });
    if (name === "favorite") {
      renderFavorite(typeof result?.favorite === "boolean" ? result.favorite : !currentSaved);
      message(currentSaved ? t("addedLiked") : t("removedLiked"));
    }
    if (name === "shuffle" && typeof result?.shuffle_state === "boolean") {
      currentPlayback.shuffle_state = result.shuffle_state;
      ui.shuffle.classList.toggle("active", result.shuffle_state);
    }
    if (name === "repeat" && result?.repeat_state) {
      currentPlayback.repeat_state = result.repeat_state;
      ui.repeat.classList.toggle("active", result.repeat_state !== "off");
      ui.repeat.textContent = result.repeat_state === "track" ? "↻¹" : "↻";
    }
    const refreshDelay = name === "favorite" ? 900
      : (name === "shuffle" || name === "repeat") ? 1100 : 350;
    setTimeout(updatePlayback, refreshDelay);
    if (name === "shuffle" || name === "repeat") setTimeout(updatePlayback, 2300);
  } catch (error) {
    message(error.message, true);
  }
}

function renderWidgetVisibility(visible) {
  widgetVisible = visible;
  $("toggleWidget").textContent = visible ? t("hideWidget") : t("showWidget");
}

$("startTuneDock").addEventListener("click", async () => {
  await chrome.storage.local.set({ tunedockOnboardingDone: true });
  show(ui.player);
  await ensureSpotifyReady(true);
  startPolling();
});

$("refresh").addEventListener("click", async () => {
  await ensureSpotifyReady(false);
});
$("openSettings").addEventListener("click", () => {
  if (!ui.settingsPanel.classList.contains("hidden")) closeSettingsPanel();
  else openSettingsPanel();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui.settingsPanel.classList.contains("hidden")) {
    closeSettingsPanel();
  }
});
$("languageOverride").addEventListener("change", (event) => window.tdSetLocale?.(event.target.value));
$("resetSettings").addEventListener("click", async () => {
  if (!confirm(t("resetConfirm"))) return;
  await chrome.permissions.remove({ origins: ["https://*/*"] }).catch(() => false);
  await chrome.storage.local.set({
    tunedockLanguageOverride: "",
    tunedockAutoOpenSpotify: true,
    tunedockWidgetVisible: false,
    tunedockWidgetOnStartup: false
  });
  $("settingsMessage").textContent = t("resetDone");
  setTimeout(() => location.reload(), 650);
});
$("openDevices").addEventListener("click", () => action("devices"));
ui.previous.addEventListener("click", () => action("previous"));
ui.next.addEventListener("click", () => action("next"));
ui.playPause.addEventListener("click", () => action(currentPlayback?.is_playing ? "pause" : "play"));
ui.shuffle.addEventListener("click", () => action("shuffle"));
ui.favorite.addEventListener("click", () => action("favorite"));
ui.repeat.addEventListener("click", () => action("repeat"));

$("copyTrackLink").addEventListener("click", async () => {
  const url = currentPlayback?.item?.external_urls?.spotify;
  if (!url) return message(t("noTrackLink"), true);
  try {
    await navigator.clipboard.writeText(url);
    message(t("linkCopied"));
  } catch (_) {
    message(t("copyFailed"), true);
  }
});

async function sendSeekFromSlider() {
  if (!currentPlayback?.item?.duration_ms) return;
  const positionMs = Math.round(Number(ui.progress.value) / 1000 * currentPlayback.item.duration_ms);
  try {
    await send({ type: "tunedock:seek", positionMs });
  } catch (error) { message(error.message, true); }
}
ui.progress.addEventListener("input", () => {
  if (!currentPlayback?.item?.duration_ms) return;
  const positionMs = Math.round(Number(ui.progress.value) / 1000 * currentPlayback.item.duration_ms);
  ui.elapsed.textContent = formatTime(positionMs);
  progressAnchor = {
    progressMs: positionMs,
    durationMs: currentPlayback.item.duration_ms,
    at: Date.now(),
    playing: currentPlayback.is_playing
  };
  clearTimeout(seekSendTimer);
  seekSendTimer = setTimeout(sendSeekFromSlider, 110);
});
ui.progress.addEventListener("change", async () => {
  await sendSeekFromSlider();
  setTimeout(updatePlayback, 350);
});

async function sendVolume(value) {
  try {
    await send({ type: "tunedock:volume", volume: Number(value) });
  } catch (error) { message(error.message, true); }
}

ui.volume.addEventListener("input", () => {
  const value = Number(ui.volume.value);
  if (value > 0) lastNonZeroVolume = value;
  ui.mute.textContent = value > 0 ? "🔊" : "🔇";
  ui.mute.setAttribute("aria-label", value > 0 ? t("mute") : t("unmute"));
  ui.mute.title = ui.mute.getAttribute("aria-label");
  clearTimeout(volumeSendTimer);
  volumeSendTimer = setTimeout(() => sendVolume(value), 70);
});
ui.volume.addEventListener("change", () => sendVolume(Number(ui.volume.value)));
ui.mute.addEventListener("click", async () => {
  const next = Number(ui.volume.value) > 0 ? 0 : Math.max(10, lastNonZeroVolume);
  ui.volume.value = next;
  ui.mute.textContent = next > 0 ? "🔊" : "🔇";
  ui.mute.setAttribute("aria-label", next > 0 ? t("mute") : t("unmute"));
  ui.mute.title = ui.mute.getAttribute("aria-label");
  await sendVolume(next);
  setTimeout(updatePlayback, 250);
});

$("autoOpenSpotify").addEventListener("change", async (event) => {
  await chrome.storage.local.set({ tunedockAutoOpenSpotify: event.target.checked });
});

$("widgetOnStartup").addEventListener("change", async (event) => {
  await chrome.storage.local.set({ tunedockWidgetOnStartup: event.target.checked });
});

$("toggleWidget").addEventListener("click", async () => {
  const next = !widgetVisible;
  if (next) {
    const granted = await chrome.permissions.request({ origins: ["https://*/*"] });
    if (!granted) {
      message(t("widgetPermissionDenied"), true);
      return;
    }
  }
  await chrome.storage.local.set({ tunedockWidgetVisible: next });
  await send({ type: "tunedock:sync-widget" });
  renderWidgetVisibility(next);
  message(next ? t("widgetShown") : t("widgetHidden"));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.tunedockWidgetVisible) {
    renderWidgetVisibility(changes.tunedockWidgetVisible.newValue === true);
  }
});

async function boot() {
  await window.tdI18nReady;
  const settings = await chrome.storage.local.get({
    tunedockOnboardingDone: false,
    tunedockAutoOpenSpotify: true,
    tunedockWidgetVisible: false,
    tunedockWidgetOnStartup: false
  });
  $("autoOpenSpotify").checked = settings.tunedockAutoOpenSpotify;
  $("widgetOnStartup").checked = settings.tunedockWidgetOnStartup;
  renderWidgetVisibility(settings.tunedockWidgetVisible);
  if (!settings.tunedockOnboardingDone) {
    show(ui.welcome);
    return;
  }
  show(ui.player);
  await ensureSpotifyReady(false);
  startPolling();
}

boot();
