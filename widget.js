(() => {
  const HOST_ID = "tunedock-floating-widget";
  const POLL_MS = 5000;
  let host = null;
  let shadow = null;
  let playback = null;
  let timer = null;
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const html = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .dock {
        width: 238px;
        color: #f8faf8;
        font: 12px/1.35 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        user-select: none;
        filter: drop-shadow(0 14px 30px rgba(0,0,0,.36));
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 50px;
        padding: 5px 7px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 18px;
        background: rgba(15,18,16,.94);
        backdrop-filter: blur(18px);
      }
      .cover {
        width: 38px; height: 38px; flex: 0 0 38px;
        border-radius: 4px; object-fit: cover;
        background: #252a27;
      }
      .meta { min-width: 0; flex: 1; cursor: grab; }
      .meta:active { cursor: grabbing; }
      .title, .artist { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .title { font-weight: 750; letter-spacing: -.01em; }
      .artist { margin-top: 1px; color: #8f9891; font-size: 10px; }
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
        width: 238px;
        margin-top: 7px;
        padding: 13px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 20px;
        background: rgba(15,18,16,.96);
        backdrop-filter: blur(20px);
      }
      .dock.expanded .panel { display: block; }
      .dock.expanded .bar { display: none; }
      .panel-head { display: flex; align-items: center; justify-content: space-between; height: 20px; margin: -6px -4px 6px; }
      .panel-grip { flex: 1; color: #657069; cursor: grab; text-align: center; letter-spacing: 2px; }
      .panel-grip:active { cursor: grabbing; }
      .collapse { width: 25px; height: 25px; color: #879089; }
      .hero { display: flex; gap: 11px; align-items: center; }
      .hero .cover { width: 64px; height: 64px; flex-basis: 64px; border-radius: 4px; }
      .hero-meta { min-width: 0; }
      .hero-title { font-size: 14px; font-weight: 800; }
      .hero-artist { margin-top: 3px; color: #98a199; font-size: 11px; }
      .hero-title, .hero-artist { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .timeline { display: grid; grid-template-columns: 31px 1fr 31px; gap: 6px; align-items: center; margin-top: 14px; color: #7d877f; font-size: 9px; }
      .favorite { width: 34px; height: 34px; flex: 0 0 34px; border: 1px solid #313933; color: #b8c0ba; font-size: 20px; }
      .favorite.active { border-color: #1ed760; background: rgba(30,215,96,.14); color: #1ed760; }
      input[type="range"] { width: 100%; margin: 0; accent-color: #8b7cff; cursor: pointer; }
      .big-controls { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 11px 0; }
      .big-controls .mini { width: 34px; height: 34px; font-size: 18px; }
      .big-controls .play { width: 42px; height: 42px; font-size: 17px; }
      .volume { display: grid; grid-template-columns: 19px 1fr; gap: 7px; align-items: center; color: #9aa39c; }
      .status { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 14px; margin-top: 9px; color: #707a72; text-align: center; font-size: 9px; }
      .spotify-mark { width: 70px; height: auto; opacity: .72; }
      .offline .play, .offline .previous, .offline .next { opacity: .38; pointer-events: none; }
    </style>
    <div class="dock">
      <div class="bar">
        <img class="cover bar-cover" alt="" />
        <div class="meta" title="Glisser pour déplacer TuneDock">
          <div class="title">TuneDock</div>
          <div class="artist">Connexion à Spotify…</div>
        </div>
        <button class="mini previous" aria-label="Précédent">⏮</button>
        <button class="play compact-play" aria-label="Lecture">▶</button>
        <button class="mini next" aria-label="Suivant">⏭</button>
        <button class="expand" aria-label="Agrandir" title="Agrandir">⌄</button>
      </div>
      <div class="panel">
        <div class="panel-head">
          <span class="panel-grip" title="Glisser pour déplacer">••••</span>
          <button class="collapse" aria-label="Réduire" title="Réduire">⌃</button>
        </div>
        <div class="hero">
          <img class="cover hero-cover" alt="" />
          <div class="hero-meta">
            <div class="hero-title">Aucun morceau actif</div>
            <div class="hero-artist">Spotify Web</div>
          </div>
          <button class="favorite" aria-label="Ajouter aux Titres likés" title="Ajouter aux Titres likés">＋</button>
        </div>
        <div class="timeline">
          <span class="elapsed">0:00</span>
          <input class="progress" type="range" min="0" max="1000" value="0" aria-label="Position" />
          <span class="duration">0:00</span>
        </div>
        <div class="big-controls">
          <button class="mini previous" aria-label="Précédent">⏮</button>
          <button class="play large-play" aria-label="Lecture">▶</button>
          <button class="mini next" aria-label="Suivant">⏭</button>
        </div>
        <div class="volume">
          <span>🔊</span>
          <input class="volume-range" type="range" min="0" max="100" value="50" aria-label="Volume" />
        </div>
        <div class="status"><img class="spotify-mark" alt="Spotify" /><span class="status-text">Web Player · TuneDock</span></div>
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
      return { ok: false, error: "TuneDock indisponible" };
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
      setText(".artist", "Aucun morceau actif");
      setText(".hero-title", "Aucun morceau actif");
      setText(".hero-artist", "Lance Spotify sur un appareil");
      setText(".status-text", "Web Player · en attente");
      return;
    }

    const artists = (item.artists || []).map((artist) => artist.name).join(", ") || "Artiste inconnu";
    const image = item.album?.images?.[0]?.url || "";
    setText(".title", item.name || "Titre inconnu");
    setText(".artist", artists);
    setText(".hero-title", item.name || "Titre inconnu");
    setText(".hero-artist", artists);
    setText(".elapsed", formatTime(data.progress_ms));
    setText(".duration", formatTime(item.duration_ms));
    setText(".status-text", data.device?.name ? `Lecture sur ${data.device.name}` : "Web Player");

    for (const img of shadow.querySelectorAll(".cover")) {
      if (image) img.src = image;
    }
    for (const button of shadow.querySelectorAll(".play")) {
      button.textContent = data.is_playing ? "⏸" : "▶";
      button.setAttribute("aria-label", data.is_playing ? "Pause" : "Lecture");
    }
    const progress = item.duration_ms ? Math.round((data.progress_ms || 0) / item.duration_ms * 1000) : 0;
    shadow.querySelector(".progress").value = progress;
    shadow.querySelector(".volume-range").value = data.device?.volume_percent ?? 50;
    const favorite = shadow.querySelector(".favorite");
    if (typeof data.is_saved === "boolean") {
      favorite.textContent = data.is_saved ? "✓" : "＋";
      favorite.classList.toggle("active", data.is_saved);
      favorite.setAttribute("aria-label", data.is_saved ? "Retirer des Titres likés" : "Ajouter aux Titres likés");
    }
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
      setText(".status-text", response?.error || "Commande impossible");
    } else if (name === "favorite" && playback) {
      playback.is_saved = typeof response.data?.favorite === "boolean"
        ? response.data.favorite
        : !Boolean(playback.is_saved);
      const favorite = shadow.querySelector(".favorite");
      favorite.textContent = playback.is_saved ? "✓" : "＋";
      favorite.classList.toggle("active", playback.is_saved);
      favorite.setAttribute("aria-label", playback.is_saved ? "Retirer des Titres likés" : "Ajouter aux Titres likés");
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
    shadow.querySelectorAll(".previous").forEach((button) => button.addEventListener("click", () => action("previous")));
    shadow.querySelectorAll(".next").forEach((button) => button.addEventListener("click", () => action("next")));
    shadow.querySelectorAll(".play").forEach((button) => button.addEventListener("click", () => action(playback?.is_playing ? "pause" : "play")));
    shadow.querySelector(".favorite").addEventListener("click", () => action("favorite"));
    shadow.querySelector(".progress").addEventListener("change", async (event) => {
      if (!playback?.item?.duration_ms) return;
      const positionMs = Math.round(Number(event.target.value) / 1000 * playback.item.duration_ms);
      await send({ type: "tunedock:seek", positionMs });
      setTimeout(refresh, 250);
    });
    shadow.querySelector(".volume-range").addEventListener("change", async (event) => {
      await send({ type: "tunedock:volume", volume: Number(event.target.value) });
      setTimeout(refresh, 250);
    });
  }

  async function mount() {
    if (host || document.getElementById(HOST_ID)) return;
    const { tunedockWidgetExpanded: expanded } =
      await chrome.storage.local.get(["tunedockWidgetExpanded"]);

    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = [
      "all: initial",
      "position: fixed",
      "top: 40%",
      "right: 18px",
      "z-index: 2147483647",
      "width: 238px",
      "pointer-events: auto"
    ].join(";");
    shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = html;
    shadow.querySelector(".spotify-mark").src = chrome.runtime.getURL("assets/spotify-full-logo-white.svg");
    document.documentElement.append(host);

    if (expanded) {
      shadow.querySelector(".dock").classList.add("expanded");
    }
    bindControls();
    bindDrag();
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
    const rect = host.getBoundingClientRect();
    const safe = clampPosition(rect.left, rect.top);
    host.style.left = `${safe.x}px`;
    host.style.top = `${safe.y}px`;
    host.style.right = "auto";
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.tunedockWidgetVisible) {
      if (changes.tunedockWidgetVisible.newValue === false) unmount();
      else mount();
    }
  });

  chrome.storage.local.get({ tunedockWidgetVisible: true }).then(({ tunedockWidgetVisible }) => {
    if (tunedockWidgetVisible) mount();
  });
})();
