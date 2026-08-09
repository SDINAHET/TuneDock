const $ = (id) => document.getElementById(id);
const ui = {
  welcome: $("welcome"), player: $("player"), connectionStatus: $("connectionStatus"),
  playerMessage: $("playerMessage"), albumArt: $("albumArt"), albumFallback: $("albumFallback"),
  artLink: $("artLink"), trackTitle: $("trackTitle"), trackArtist: $("trackArtist"),
  elapsed: $("elapsed"), duration: $("duration"), progress: $("progress"),
  playPause: $("playPause"), previous: $("previous"), next: $("next"), volume: $("volume"),
  shuffle: $("shuffle"), favorite: $("favorite"), repeat: $("repeat"), openSpotify: $("openSpotify")
};

let currentPlayback = null;
let currentSaved = false;
let widgetVisible = false;
let pollTimer = null;
let progressTimer = null;
let progressAnchor = null;

function show(view) {
  ui.welcome.classList.add("hidden");
  ui.player.classList.add("hidden");
  view.classList.remove("hidden");
}

function message(text = "", error = false) {
  ui.playerMessage.textContent = text;
  ui.playerMessage.classList.toggle("error", error);
}

function setConnection(state, label) {
  ui.connectionStatus.className = `status-pill ${state}`;
  ui.connectionStatus.querySelector("span").textContent = label;
}

function formatTime(milliseconds = 0) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

async function send(payload) {
  const response = await chrome.runtime.sendMessage(payload);
  if (!response?.ok) throw new Error(response?.error || "Commande impossible.");
  return response.data;
}

function renderFavorite(saved) {
  currentSaved = saved;
  ui.favorite.textContent = saved ? "✓" : "＋";
  ui.favorite.classList.toggle("active", saved);
  ui.favorite.setAttribute("aria-label", saved ? "Retirer des Titres likés" : "Ajouter aux Titres likés");
  ui.favorite.title = saved ? "Retirer des Titres likés" : "Ajouter aux Titres likés";
}

function renderPlayback(playback) {
  currentPlayback = playback;
  const item = playback?.item;
  if (!item) {
    setConnection("waiting", "En attente");
    ui.trackTitle.textContent = "Aucun morceau actif";
    ui.trackArtist.textContent = "Lancez une musique dans Spotify Web";
    ui.albumArt.classList.add("hidden");
    ui.albumFallback.classList.remove("hidden");
    ui.progress.value = 0;
    ui.elapsed.textContent = "0:00";
    ui.duration.textContent = "0:00";
    ui.playPause.textContent = "▶";
    progressAnchor = null;
    return;
  }

  setConnection("connected", "Actif");
  const artists = (item.artists || []).map((artist) => artist.name).join(", ") || "Artiste inconnu";
  const spotifyUrl = item.external_urls?.spotify || "https://open.spotify.com";
  ui.trackTitle.textContent = item.name || "Titre inconnu";
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
  ui.volume.value = playback.device?.volume_percent ?? 50;
  ui.playPause.textContent = playback.is_playing ? "⏸" : "▶";
  ui.playPause.setAttribute("aria-label", playback.is_playing ? "Pause" : "Lecture");
  ui.shuffle.classList.toggle("active", Boolean(playback.shuffle_state));
  ui.repeat.classList.toggle("active", playback.repeat_state && playback.repeat_state !== "off");
  ui.repeat.textContent = playback.repeat_state === "track" ? "↻¹" : "↻";
  if (typeof playback.is_saved === "boolean") renderFavorite(playback.is_saved);
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
    setConnection("error", "Hors ligne");
    message(error.message, true);
  }
}

async function ensureSpotifyReady(activate = false) {
  setConnection("connecting", "Connexion");
  message("Connexion à Spotify Web…");
  try {
    const result = await send({ type: "tunedock:ensure-web-player", activate });
    renderPlayback(result.playback);
    message("");
    return true;
  } catch (error) {
    setConnection("error", "Hors ligne");
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
      message(currentSaved ? "Ajouté aux Titres likés." : "Retiré des Titres likés.");
    }
    setTimeout(updatePlayback, name === "favorite" ? 900 : 350);
  } catch (error) {
    message(error.message, true);
  }
}

function renderWidgetVisibility(visible) {
  widgetVisible = visible;
  $("toggleWidget").textContent = visible ? "Masquer le widget" : "Afficher le widget";
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
$("openDevices").addEventListener("click", () => action("devices"));
ui.previous.addEventListener("click", () => action("previous"));
ui.next.addEventListener("click", () => action("next"));
ui.playPause.addEventListener("click", () => action(currentPlayback?.is_playing ? "pause" : "play"));
ui.shuffle.addEventListener("click", () => action("shuffle"));
ui.favorite.addEventListener("click", () => action("favorite"));
ui.repeat.addEventListener("click", () => action("repeat"));

ui.progress.addEventListener("change", async () => {
  if (!currentPlayback?.item?.duration_ms) return;
  const positionMs = Math.round(Number(ui.progress.value) / 1000 * currentPlayback.item.duration_ms);
  try {
    await send({ type: "tunedock:seek", positionMs });
    setTimeout(updatePlayback, 300);
  } catch (error) { message(error.message, true); }
});

ui.volume.addEventListener("change", async () => {
  try {
    await send({ type: "tunedock:volume", volume: Number(ui.volume.value) });
  } catch (error) { message(error.message, true); }
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
      message("Autorisation refusée : le widget reste désactivé.", true);
      return;
    }
  }
  await chrome.storage.local.set({ tunedockWidgetVisible: next });
  await send({ type: "tunedock:sync-widget" });
  renderWidgetVisibility(next);
  message(next ? "Widget affiché sur les pages HTTPS." : "Widget masqué.");
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.tunedockWidgetVisible) {
    renderWidgetVisibility(changes.tunedockWidgetVisible.newValue === true);
  }
});

async function boot() {
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
