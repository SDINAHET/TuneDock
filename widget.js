(() => {
  const HOST_ID = "tunedock-floating-widget";
  const POLL_MS = 5000;
  const MIN_WIDTH = 280;
  const MAX_WIDTH = 480;
  const DEFAULT_WIDTH = 320;
  let host = null;
  let shadow = null;
  let playback = null;
  let timer = null;
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let lastNonZeroVolume = 50;
  let volumeSendTimer = null;
  let seekSendTimer = null;
  let widgetMessages = null;
  let widgetFallbackMessages = null;
  let widgetUsingOverride = false;
  const t = (key) => widgetUsingOverride
    ? (widgetMessages?.[key]?.message || widgetFallbackMessages?.[key]?.message || chrome.i18n.getMessage(key) || key)
    : (chrome.i18n.getMessage(key) || widgetFallbackMessages?.[key]?.message || key);

  const getHtml = () => `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .dock {
        width: 100%;
        color: #f8faf8;
        font: 12px/1.35 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        user-select: none;
        filter: drop-shadow(0 14px 30px rgba(0,0,0,.36));
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 58px;
        padding: 7px 8px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 18px;
        background: rgba(15,18,16,.94);
        backdrop-filter: blur(18px);
      }
      .cover {
        width: 44px; height: 44px; flex: 0 0 44px;
        border-radius: 4px; object-fit: cover;
        background: #252a27;
      }
      .meta { min-width: 0; flex: 1; cursor: grab; }
      .meta:active { cursor: grabbing; }
      .title, .artist { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .title { font-size: 12px; font-weight: 800; letter-spacing: -.01em; }
      .artist { margin-top: 2px; color: #a6aea8; font-size: 10px; }
      button {
        display: grid; place-items: center;
        border: 0; border-radius: 50%;
        background: transparent; color: #e8ece9;
        cursor: pointer; font: inherit;
      }
      button:hover { background: rgba(255,255,255,.09); color: #fff; }
      .mini { width: 28px; height: 28px; font-size: 15px; }
      .play { width: 31px; height: 31px; background: #f7faf8; color: #0c0f0d; font-size: 14px; }
      .play:hover { background: #fff; color: #000; transform: scale(1.04); }
      .expand { width: 23px; height: 28px; color: #758078; font-size: 14px; }
      .panel {
        display: none;
        position: relative;
        width: 100%;
        margin-top: 7px;
        padding: 13px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 20px;
        background: rgba(15,18,16,.96);
        backdrop-filter: blur(20px);
      }
      .dock.expanded .panel { display: block; }
      .dock.expanded .bar { display: none; }
      .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 3px; height: 24px; margin: -6px -4px 7px; }
      .panel-grip { flex: 1; color: #657069; cursor: grab; text-align: center; letter-spacing: 2px; }
      .panel-grip:active { cursor: grabbing; }
      .collapse { width: 25px; height: 25px; color: #879089; }
      .size-button { width: 28px; height: 25px; border-radius: 8px; color: #aab2ac; font-size: 10px; font-weight: 800; }
      .size-button:disabled { opacity: .3; }
      .hero { display: flex; gap: 11px; align-items: center; }
      .hero .cover { width: 72px; height: 72px; flex-basis: 72px; border-radius: 6px; }
      .hero-meta { min-width: 0; flex: 1; text-align: left; }
      .hero-title { font-size: 16px; line-height: 1.18; font-weight: 850; }
      .hero-artist { margin-top: 5px; color: #aeb6b0; font-size: 12px; line-height: 1.25; }
      .hero-title, .hero-artist { overflow: hidden; overflow-wrap: anywhere; }
      .hero-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
      .hero-artist { white-space: nowrap; text-overflow: ellipsis; }
      .timeline { display: grid; grid-template-columns: 31px 1fr 31px; gap: 6px; align-items: center; margin-top: 14px; color: #7d877f; font-size: 9px; }
      .favorite { width: 34px; height: 34px; flex: 0 0 34px; border: 1px solid #313933; color: #b8c0ba; font-size: 20px; }
      .favorite.active { border-color: #1ed760; background: rgba(30,215,96,.14); color: #1ed760; }
      input[type="range"] { width: 100%; margin: 0; accent-color: #8b7cff; cursor: pointer; }
      .big-controls { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 11px 0; }
      .big-controls .mini { width: 34px; height: 34px; font-size: 18px; }
      .big-controls .play { width: 42px; height: 42px; font-size: 17px; }
      .volume { display: grid; grid-template-columns: 28px 1fr; gap: 7px; align-items: center; color: #9aa39c; }
      .mute { width: 28px; height: 28px; color: #d4dad5; font-size: 13px; }
      .status { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 14px; margin-top: 9px; color: #707a72; text-align: center; font-size: 9px; }
      .spotify-mark { width: 70px; height: auto; opacity: .72; }
      .resize-handle {
        position: absolute; right: 5px; bottom: 5px; width: 18px; height: 18px; border: 0; border-radius: 5px;
        color: #7d877f; cursor: ew-resize; font-size: 14px; line-height: 1; touch-action: none;
      }
      .offline .play, .offline .previous, .offline .next, button:disabled { opacity: .38; pointer-events: none; }
    </style>
    <div class="dock">
      <div class="bar">
        <img class="cover bar-cover" alt="" />
        <div class="meta" title="${t("dragWidget")}">
          <div class="title">TuneDock</div>
          <div class="artist">${t("connectingSpotify")}</div>
        </div>
        <button class="mini previous" aria-label="${t("previousTrack")}" title="${t("previousTrack")}">⏮</button>
        <button class="play compact-play" aria-label="${t("play")}" title="${t("play")}">▶</button>
        <button class="mini next" aria-label="${t("nextTrack")}" title="${t("nextTrack")}">⏭</button>
        <button class="expand" aria-label="${t("expand")}" title="${t("expand")}">⌄</button>
      </div>
      <div class="panel">
        <div class="panel-head">
          <span class="panel-grip" title="${t("dragWidget")}">••••</span>
          <button class="size-button size-down" aria-label="${t("reduceWidget")}" title="${t("reduceWidget")}">A−</button>
          <button class="size-button size-up" aria-label="${t("enlargeWidget")}" title="${t("enlargeWidget")}">A+</button>
          <button class="collapse" aria-label="${t("collapse")}" title="${t("collapse")}">⌃</button>
        </div>
        <div class="hero">
          <img class="cover hero-cover" alt="" />
          <div class="hero-meta">
            <div class="hero-title">${t("noActiveTrack")}</div>
            <div class="hero-artist">Spotify Web</div>
          </div>
          <button class="favorite" aria-label="${t("addLiked")}" title="${t("addLiked")}">＋</button>
        </div>
        <div class="timeline">
          <span class="elapsed">0:00</span>
          <input class="progress" type="range" min="0" max="1000" value="0" aria-label="${t("playbackPosition")}" title="${t("playbackPosition")}" />
          <span class="duration">0:00</span>
        </div>
        <div class="big-controls">
          <button class="mini previous" aria-label="${t("previousTrack")}" title="${t("previousTrack")}">⏮</button>
          <button class="play large-play" aria-label="${t("play")}" title="${t("play")}">▶</button>
          <button class="mini next" aria-label="${t("nextTrack")}" title="${t("nextTrack")}">⏭</button>
        </div>
        <div class="volume">
          <button class="mute" aria-label="${t("mute")}" title="${t("mute")}">🔊</button>
          <input class="volume-range" type="range" min="0" max="100" value="50" aria-label="${t("volume")}" title="${t("volume")}" />
        </div>
        <div class="status"><img class="spotify-mark" alt="Spotify" /><span class="status-text">Web Player · TuneDock</span></div>
        <button class="resize-handle" aria-label="${t("resizeWidget")}" title="${t("resizeWidget")}">◢</button>
      </div>
    </div>`;

  function formatTime(ms = 0) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  async function send(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (_) {
      return { ok: false, error: t("tunedockUnavailable") };
    }
  }

  function setText(selector, value) {
    const element = shadow.querySelector(selector);
    if (element) element.textContent = value;
  }

  function render(data) {
    playback = data;
    const dock = shadow.querySelector(".dock");
    const item = data?.item;
    dock.classList.toggle("offline", !item);

    if (!item) {
      setText(".title", "TuneDock");
      setText(".artist", t("noActiveTrack"));
      setText(".hero-title", t("noActiveTrack"));
      setText(".hero-artist", t("startMusicSpotify"));
      setText(".status-text", `Web Player · ${t("statusWaiting")}`);
      return;
    }

    const artists = (item.artists || []).map((artist) => artist.name).join(", ") || t("unknownArtist");
    const image = item.album?.images?.[0]?.url || "";
    setText(".title", item.name || t("unknownTrack"));
    setText(".artist", artists);
    setText(".hero-title", item.name || t("unknownTrack"));
    setText(".hero-artist", artists);
    setText(".elapsed", formatTime(data.progress_ms));
    setText(".duration", formatTime(item.duration_ms));
    setText(".status-text", data.device?.name ? t("playingOn").replace("$1", data.device.name) : "Web Player");

    for (const img of shadow.querySelectorAll(".cover")) {
      if (image) img.src = image;
    }
    for (const button of shadow.querySelectorAll(".play")) {
      button.textContent = data.is_playing ? "⏸" : "▶";
      button.setAttribute("aria-label", data.is_playing ? t("pause") : t("play"));
      button.title = button.getAttribute("aria-label");
    }
    const progress = item.duration_ms ? Math.round((data.progress_ms || 0) / item.duration_ms * 1000) : 0;
    shadow.querySelector(".progress").value = progress;
    const volume = data.device?.volume_percent ?? 50;
    shadow.querySelector(".volume-range").value = volume;
    if (volume > 0) lastNonZeroVolume = volume;
    const mute = shadow.querySelector(".mute");
    mute.textContent = volume > 0 ? "🔊" : "🔇";
    mute.setAttribute("aria-label", volume > 0 ? t("mute") : t("unmute"));
    mute.title = mute.getAttribute("aria-label");
    const favorite = shadow.querySelector(".favorite");
    if (typeof data.is_saved === "boolean") {
      favorite.textContent = data.is_saved ? "✓" : "＋";
      favorite.classList.toggle("active", data.is_saved);
      favorite.setAttribute("aria-label", data.is_saved ? t("removeLiked") : t("addLiked"));
      favorite.title = favorite.getAttribute("aria-label");
    }
    const capabilities = data.capabilities || {};
    shadow.querySelectorAll(".previous").forEach((button) => {
      button.disabled = capabilities.previous === false;
      button.title = button.disabled ? t("previousUnavailable") : t("previousTrack");
    });
    shadow.querySelectorAll(".next").forEach((button) => {
      button.disabled = capabilities.next === false;
      button.title = button.disabled ? t("nextUnavailable") : t("nextTrack");
    });
  }

  async function refresh() {
    if (document.visibilityState !== "visible" || !shadow) return;
    const response = await send({ type: "tunedock:playback" });
    if (response?.ok) render(response.data);
    else if (response?.error) setText(".status-text", response.error);
  }

  async function action(name) {
    const response = await send({ type: "tunedock:action", action: name });
    if (!response?.ok) {
      setText(".status-text", response?.error || t("commandFailed"));
    } else if (name === "favorite" && playback) {
      playback.is_saved = typeof response.data?.favorite === "boolean"
        ? response.data.favorite
        : !Boolean(playback.is_saved);
      const favorite = shadow.querySelector(".favorite");
      favorite.textContent = playback.is_saved ? "✓" : "＋";
      favorite.classList.toggle("active", playback.is_saved);
      favorite.setAttribute("aria-label", playback.is_saved ? t("removeLiked") : t("addLiked"));
    }
    setTimeout(refresh, name === "favorite" ? 700 : 300);
  }

  function clampPosition(x, y) {
    const width = host.offsetWidth || 238;
    const height = host.offsetHeight || 50;
    return {
      x: Math.max(8, Math.min(window.innerWidth - width - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, y))
    };
  }

  function clampWidth(width) {
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - 16, Number(width) || DEFAULT_WIDTH));
  }

  async function setWidgetWidth(width, persist = true) {
    if (!host) return;
    host.style.width = `${clampWidth(width)}px`;
    updateSizeButtons();
    const rect = host.getBoundingClientRect();
    const safe = clampPosition(rect.left, rect.top);
    host.style.left = `${safe.x}px`;
    host.style.top = `${safe.y}px`;
    host.style.right = "auto";
    if (persist) await chrome.storage.local.set({ tunedockWidgetWidth: Math.round(host.getBoundingClientRect().width) });
  }

  function updateSizeButtons() {
    if (!shadow || !host) return;
    const width = host.getBoundingClientRect().width;
    shadow.querySelector(".size-down").disabled = width <= MIN_WIDTH;
    shadow.querySelector(".size-up").disabled = width >= Math.min(MAX_WIDTH, window.innerWidth - 16);
  }

  async function restorePosition() {
    const { tunedockWidgetPosition: position } = await chrome.storage.local.get("tunedockWidgetPosition");
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
      const safe = clampPosition(position.x, position.y);
      host.style.left = `${safe.x}px`;
      host.style.top = `${safe.y}px`;
      host.style.right = "auto";
    }
  }

  function bindDrag() {
    for (const handle of shadow.querySelectorAll(".meta, .panel-grip")) {
      handle.addEventListener("pointerdown", (event) => {
        dragging = true;
        const rect = host.getBoundingClientRect();
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      handle.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const safe = clampPosition(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
        host.style.left = `${safe.x}px`;
        host.style.top = `${safe.y}px`;
        host.style.right = "auto";
      });
      handle.addEventListener("pointerup", async (event) => {
        if (!dragging) return;
        dragging = false;
        handle.releasePointerCapture(event.pointerId);
        const rect = host.getBoundingClientRect();
        await chrome.storage.local.set({ tunedockWidgetPosition: { x: rect.left, y: rect.top } });
      });
    }
  }

  function bindControls() {
    const setExpanded = async (expanded) => {
      const dock = shadow.querySelector(".dock");
      dock.classList.toggle("expanded", expanded);
      await chrome.storage.local.set({ tunedockWidgetExpanded: expanded });
      requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const safe = clampPosition(rect.left, rect.top);
        host.style.left = `${safe.x}px`;
        host.style.top = `${safe.y}px`;
      });
    };
    shadow.querySelector(".expand").addEventListener("click", () => setExpanded(true));
    shadow.querySelector(".collapse").addEventListener("click", () => setExpanded(false));
    shadow.querySelector(".size-down").addEventListener("click", () => setWidgetWidth(host.getBoundingClientRect().width - 40));
    shadow.querySelector(".size-up").addEventListener("click", () => setWidgetWidth(host.getBoundingClientRect().width + 40));
    const resizeHandle = shadow.querySelector(".resize-handle");
    let resizeStartX = 0;
    let resizeStartWidth = DEFAULT_WIDTH;
    resizeHandle.addEventListener("pointerdown", (event) => {
      resizeStartX = event.clientX;
      resizeStartWidth = host.getBoundingClientRect().width;
      resizeHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    resizeHandle.addEventListener("pointermove", (event) => {
      if (!resizeHandle.hasPointerCapture(event.pointerId)) return;
      setWidgetWidth(resizeStartWidth + event.clientX - resizeStartX, false);
    });
    resizeHandle.addEventListener("pointerup", async (event) => {
      if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
      await setWidgetWidth(host.getBoundingClientRect().width, true);
    });
    shadow.querySelectorAll(".previous").forEach((button) => button.addEventListener("click", () => action("previous")));
    shadow.querySelectorAll(".next").forEach((button) => button.addEventListener("click", () => action("next")));
    shadow.querySelectorAll(".play").forEach((button) => button.addEventListener("click", () => action(playback?.is_playing ? "pause" : "play")));
    shadow.querySelector(".favorite").addEventListener("click", () => action("favorite"));
    const progressRange = shadow.querySelector(".progress");
    const sendSeek = async () => {
      if (!playback?.item?.duration_ms) return;
      const positionMs = Math.round(Number(progressRange.value) / 1000 * playback.item.duration_ms);
      await send({ type: "tunedock:seek", positionMs });
    };
    progressRange.addEventListener("input", (event) => {
      if (!playback?.item?.duration_ms) return;
      const positionMs = Math.round(Number(event.target.value) / 1000 * playback.item.duration_ms);
      setText(".elapsed", formatTime(positionMs));
      clearTimeout(seekSendTimer);
      seekSendTimer = setTimeout(sendSeek, 110);
    });
    progressRange.addEventListener("change", async () => {
      await sendSeek();
      setTimeout(refresh, 250);
    });
    const volumeRange = shadow.querySelector(".volume-range");
    const sendVolume = async (value) => {
      await send({ type: "tunedock:volume", volume: Number(value) });
    };
    volumeRange.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      if (value > 0) lastNonZeroVolume = value;
      const mute = shadow.querySelector(".mute");
      mute.textContent = value > 0 ? "🔊" : "🔇";
      mute.setAttribute("aria-label", value > 0 ? t("mute") : t("unmute"));
      mute.title = mute.getAttribute("aria-label");
      clearTimeout(volumeSendTimer);
      volumeSendTimer = setTimeout(() => sendVolume(value), 70);
    });
    volumeRange.addEventListener("change", async (event) => {
      await sendVolume(event.target.value);
      setTimeout(refresh, 250);
    });
    shadow.querySelector(".mute").addEventListener("click", async () => {
      const next = Number(volumeRange.value) > 0 ? 0 : Math.max(10, lastNonZeroVolume);
      volumeRange.value = next;
      shadow.querySelector(".mute").textContent = next > 0 ? "🔊" : "🔇";
      shadow.querySelector(".mute").setAttribute("aria-label", next > 0 ? t("mute") : t("unmute"));
      shadow.querySelector(".mute").title = shadow.querySelector(".mute").getAttribute("aria-label");
      await sendVolume(next);
      setTimeout(refresh, 250);
    });
  }

  async function mount() {
    if (host || document.getElementById(HOST_ID)) return;
    const { tunedockWidgetExpanded: expanded, tunedockWidgetWidth = DEFAULT_WIDTH, tunedockLanguageOverride = "" } =
      await chrome.storage.local.get(["tunedockWidgetExpanded", "tunedockWidgetWidth", "tunedockLanguageOverride"]);
    try {
      const fallbackResponse = await fetch(chrome.runtime.getURL("_locales/en/messages.json"));
      if (fallbackResponse.ok) widgetFallbackMessages = await fallbackResponse.json();
      if (tunedockLanguageOverride) {
        widgetUsingOverride = true;
        const response = await fetch(chrome.runtime.getURL(`_locales/${tunedockLanguageOverride}/messages.json`));
        if (response.ok) widgetMessages = await response.json();
      }
    } catch (_) {}

    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = [
      "all: initial",
      "position: fixed",
      "top: 40%",
      "right: 18px",
      "z-index: 2147483647",
      `width: ${clampWidth(tunedockWidgetWidth)}px`,
      "pointer-events: auto"
    ].join(";");
    shadow = host.attachShadow({ mode: "closed" });
    const widgetDocument = new DOMParser().parseFromString(getHtml(), "text/html");
    shadow.append(...widgetDocument.head.childNodes, ...widgetDocument.body.childNodes);
    shadow.querySelector(".spotify-mark").src = chrome.runtime.getURL("assets/spotify-full-logo-white.svg");
    document.documentElement.append(host);

    if (expanded) {
      shadow.querySelector(".dock").classList.add("expanded");
    }
    bindControls();
    bindDrag();
    updateSizeButtons();
    await restorePosition();
    refresh();
    startPolling();
  }

  function unmount() {
    clearInterval(timer);
    timer = null;
    host?.remove();
    host = null;
    shadow = null;
    playback = null;
  }

  function startPolling() {
    clearInterval(timer);
    if (document.visibilityState === "visible") {
      refresh();
      timer = setInterval(refresh, POLL_MS);
    }
  }

  document.addEventListener("visibilitychange", startPolling);
  window.addEventListener("resize", () => {
    if (!host) return;
    host.style.width = `${clampWidth(host.getBoundingClientRect().width)}px`;
    updateSizeButtons();
    const rect = host.getBoundingClientRect();
    const safe = clampPosition(rect.left, rect.top);
    host.style.left = `${safe.x}px`;
    host.style.top = `${safe.y}px`;
    host.style.right = "auto";
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.tunedockLanguageOverride && host) {
      unmount();
      mount();
      return;
    }
    if (changes.tunedockWidgetVisible) {
      if (changes.tunedockWidgetVisible.newValue === false) unmount();
      else mount();
    }
  });

  chrome.storage.local.get({ tunedockWidgetVisible: true }).then(({ tunedockWidgetVisible }) => {
    if (tunedockWidgetVisible) mount();
  });
})();
