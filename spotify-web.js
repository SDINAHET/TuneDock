(() => {
  const artworkCache = new Map();
  const artworkPending = new Set();
  const favoriteOverrides = new Map();
  const t = (key) => chrome.i18n.getMessage(key) || key;

  function first(selectors) {
    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  function text(selectors) {
    return first(selectors)?.textContent?.trim() || "";
  }

  function visibleControl(selectors) {
    const candidates = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
    const visible = candidates.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    return visible.find((element) => isAvailable(element)) || visible[0] || candidates[0] || null;
  }

  function parseClock(value) {
    if (!value) return 0;
    const parts = value.trim().split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    let seconds = 0;
    for (const part of parts) seconds = seconds * 60 + part;
    return seconds * 1000;
  }

  function controls() {
    return {
      playPause: visibleControl([
        'button[data-testid="control-button-playpause"]',
        'button[aria-label="Pause"]',
        'button[aria-label="Play"]'
      ]),
      previous: visibleControl([
        'button[data-testid="control-button-skip-back"]',
        'button[aria-label*="Previous"]',
        'button[aria-label*="Précédent"]'
      ]),
      next: visibleControl([
        'button[data-testid="control-button-skip-forward"]',
        'button[aria-label*="Next"]',
        'button[aria-label*="Suivant"]'
      ]),
      shuffle: visibleControl([
        'button[data-testid="control-button-shuffle"]',
        'button[data-testid="control-button-smart-shuffle"]',
        'button[aria-label*="shuffle" i]',
        'button[aria-label*="aléatoire" i]',
        'button[aria-label*="aleatoire" i]'
      ]),
      repeat: visibleControl([
        'button[data-testid="control-button-repeat"]',
        'button[data-testid="control-button-repeat-one"]',
        'button[aria-label*="repeat" i]',
        'button[aria-label*="répétition" i]',
        'button[aria-label*="répéter" i]',
        'button[aria-label*="repeter" i]'
      ])
    };
  }

  function isAvailable(element) {
    return Boolean(element)
      && !element.disabled
      && element.getAttribute("aria-disabled") !== "true"
      && element.getAttribute("data-disabled") !== "true";
  }

  function isToggleEnabled(element) {
    if (!element) return false;
    const label = element.getAttribute("aria-label")?.toLowerCase() || "";
    return element.getAttribute("aria-checked") === "true"
      || element.getAttribute("aria-pressed") === "true"
      || element.getAttribute("data-active") === "true"
      || element.getAttribute("data-state") === "on"
      || label.includes("disable")
      || label.includes("désactiver")
      || label.includes("desactiver");
  }

  function getRepeatState(element) {
    if (!element) return "off";
    const testId = element.getAttribute("data-testid") || "";
    const label = element.getAttribute("aria-label")?.toLowerCase() || "";
    const repeatOne = testId.includes("repeat-one")
      || label.includes("repeat one")
      || label.includes("repeat track")
      || label.includes("répéter le titre")
      || label.includes("répéter ce titre")
      || label.includes("repeter le titre");
    return repeatOne ? "track" : isToggleEnabled(element) ? "context" : "off";
  }

  function currentTrackKey() {
    return first([
      '[data-testid="context-item-info-title"] a[href*="/track/"]',
      '[data-testid="now-playing-widget"] a[href*="/track/"]',
      '[data-testid="now-playing-widget"] a[href*="/episode/"]'
    ])?.href || document.title;
  }

  function favoriteButton(selectors) {
    const scopes = [
      document.querySelector('[data-testid="now-playing-widget"]'),
      document.querySelector('[data-testid="now-playing-bar"]'),
      document.querySelector('footer[data-testid="now-playing-bar"]'),
      document.querySelector("footer")
    ].filter(Boolean);
    for (const scope of scopes) {
      for (const selector of selectors) {
        const button = scope.querySelector(selector);
        if (button) return button;
      }
    }
    for (const selector of selectors.filter((value) => value.includes("aria-label"))) {
      const button = document.querySelector(selector);
      if (button) return button;
    }
    return null;
  }

  function favoriteControl() {
    const remove = favoriteButton([
      'button[data-testid="remove-button"]',
      'button[aria-label*="Remove from Liked Songs" i]',
      'button[aria-label*="Remove from Your Library" i]',
      'button[aria-label*="Retirer des Titres likés" i]',
      'button[aria-label*="Retirer de votre Bibliothèque" i]',
      'button[aria-pressed="true"][aria-label*="Titre" i]'
    ]);
    if (remove) return { element: remove, saved: true };
    const add = favoriteButton([
      'button[data-testid="add-button"]',
      'button[aria-label*="Add to Liked Songs" i]',
      'button[aria-label*="Add to Your Library" i]',
      'button[aria-label*="Ajouter aux Titres likés" i]',
      'button[aria-label*="Ajouter à votre Bibliothèque" i]',
      'button[aria-pressed="false"][aria-label*="Titre" i]'
    ]);
    return { element: add, saved: add ? false : null };
  }

  function resolvedFavoriteState(control, trackKey) {
    const override = favoriteOverrides.get(trackKey);
    if (override && Date.now() < override.until) return override.saved;
    if (typeof control.saved === "boolean") {
      favoriteOverrides.delete(trackKey);
      return control.saved;
    }
    return override?.saved ?? null;
  }

  function primeArtwork(trackUrl) {
    if (!trackUrl || artworkCache.has(trackUrl) || artworkPending.has(trackUrl)) return;
    artworkPending.add(trackUrl);
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.thumbnail_url) artworkCache.set(trackUrl, data.thumbnail_url);
      })
      .catch(() => {})
      .finally(() => artworkPending.delete(trackUrl));
  }

  function bestArtworkUrl(coverElement, trackName, trackUrl) {
    const candidates = [];
    const add = (url, score = 0) => {
      if (typeof url === "string" && url) candidates.push({ url, score });
    };

    // Spotify expose généralement plusieurs tailles via la Media Session.
    // On privilégie uniquement ces images si elles correspondent au morceau affiché.
    try {
      const metadata = navigator.mediaSession?.metadata;
      const sameTrack = !metadata?.title || !trackName
        || metadata.title.trim().toLowerCase() === trackName.trim().toLowerCase();
      if (sameTrack) {
        for (const artwork of metadata?.artwork || []) {
          const size = Number.parseInt(String(artwork.sizes || "0").split("x")[0], 10) || 0;
          add(artwork.src, 100000 + size);
        }
      }
    } catch (_) {}

    // Secours public Spotify : l'image oEmbed est plus grande que la vignette du mini-lecteur.
    add(artworkCache.get(trackUrl), 50000);

    // Si Spotify utilise srcset, la variante ayant le plus grand descripteur gagne.
    const srcset = coverElement?.getAttribute("srcset") || "";
    for (const entry of srcset.split(",")) {
      const parts = entry.trim().split(/\s+/);
      if (!parts[0]) continue;
      const descriptor = Number.parseFloat(parts[1]) || 1;
      add(parts[0], 1000 + descriptor);
    }

    add(coverElement?.currentSrc, 100);
    add(coverElement?.src, 10);
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.url || "";
  }

  function getPlayback() {
    const player = controls();
    const titleElement = first([
      '[data-testid="context-item-info-title"] a',
      '[data-testid="now-playing-widget"] a[href*="/track/"]',
      '[data-testid="now-playing-widget"] a[href*="/episode/"]'
    ]);
    const artistElement = first([
      '[data-testid="context-item-info-artist"]',
      '[data-testid="now-playing-widget"] a[href*="/artist/"]'
    ]);
    const coverElement = first([
      '[data-testid="now-playing-widget"] img',
      '[data-testid="cover-art-image"] img',
      'img[data-testid="cover-art-image"]'
    ]);
    const positionText = text([
      '[data-testid="playback-position"]',
      '[data-testid="playback-progressbar"] [data-testid="playback-position"]'
    ]);
    const durationText = text([
      '[data-testid="playback-duration"]',
      '[data-testid="playback-progressbar"] [data-testid="playback-duration"]'
    ]);
    const progressInput = first([
      '[data-testid="playback-progressbar"] input[type="range"]',
      'input[data-testid="playback-progressbar"]'
    ]);
    const volumeInput = first([
      '[data-testid="volume-bar"] input[type="range"]',
      'input[data-testid="volume-bar"]'
    ]);

    let trackName = titleElement?.textContent?.trim() || "";
    let artistName = artistElement?.textContent?.trim() || "";
    if (!trackName && document.title.includes("•")) {
      const parts = document.title.replace(/\s*\|\s*Spotify\s*$/i, "").split("•").map((part) => part.trim());
      trackName = parts[0] || "";
      artistName = parts[1] || artistName;
    }

    const label = player.playPause?.getAttribute("aria-label")?.toLowerCase() || "";
    const isPlaying = label.includes("pause");
    const shuffleState = isToggleEnabled(player.shuffle);
    const repeatState = getRepeatState(player.repeat);
    const capabilities = {
      previous: isAvailable(player.previous),
      next: isAvailable(player.next),
      shuffle: isAvailable(player.shuffle),
      repeat: isAvailable(player.repeat)
    };
    const durationMs = parseClock(durationText);
    let progressMs = parseClock(positionText);
    if (!progressMs && progressInput) {
      const max = Number(progressInput.max) || 0;
      const value = Number(progressInput.value) || 0;
      if (durationMs && max) progressMs = Math.round(value / max * durationMs);
    }
    const audioElements = [...document.querySelectorAll("audio")];
    const activeAudio = audioElements.find((audio) => !audio.paused) || audioElements[0] || null;
    const rawVolume = Number(volumeInput?.getAttribute("aria-valuenow") ?? volumeInput?.value);
    const volumeMax = Number(volumeInput?.max) || 100;
    let volume = Number.isFinite(rawVolume)
      ? (volumeMax <= 1 ? rawVolume * 100 : rawVolume / volumeMax * 100)
      : (activeAudio ? activeAudio.volume * 100 : 50);
    volume = Math.max(0, Math.min(100, volume));

    const favorite = favoriteControl();
    const trackKey = currentTrackKey();
    const saved = resolvedFavoriteState(favorite, trackKey);

    if (!trackName) {
      return {
        is_playing: false,
        shuffle_state: shuffleState,
        repeat_state: repeatState,
        progress_ms: 0,
        device: { name: "Cet ordinateur", type: "", volume_percent: Number.isFinite(volume) ? volume : 50 },
        item: null,
        _tunedock_mode: "web",
        is_saved: saved,
        capabilities
      };
    }

    const trackUrl = titleElement?.href || location.href;
    primeArtwork(titleElement?.href);
    const artworkUrl = bestArtworkUrl(coverElement, trackName, trackUrl);
    return {
      is_playing: isPlaying,
      shuffle_state: shuffleState,
      repeat_state: repeatState,
      progress_ms: progressMs,
      device: { name: "Cet ordinateur", type: "", volume_percent: Number.isFinite(volume) ? volume : 50 },
      item: {
        name: trackName,
        duration_ms: durationMs,
        artists: artistName ? [{ name: artistName }] : [],
        album: { images: artworkUrl ? [{ url: artworkUrl }] : [] },
        external_urls: { spotify: trackUrl }
      },
      _tunedock_mode: "web",
      is_saved: saved,
      capabilities
    };
  }

  function clickAction(action) {
    if (action === "devices") {
      const connect = first([
        'button[data-testid="control-button-connect"]',
        'button[aria-label*="Connect to a device"]',
        'button[aria-label*="Se connecter à un appareil"]',
        'button[aria-label*="Connecter à un appareil"]'
      ]);
      if (!connect) throw new Error(t("devicesUnavailable"));
      connect.click();
      return { mode: "web", devicesOpened: true };
    }
    if (action === "favorite") {
      const favorite = favoriteControl();
      if (!favorite.element) throw new Error(t("favoriteUnavailable"));
      const trackKey = currentTrackKey();
      const current = resolvedFavoriteState(favorite, trackKey);
      const saved = !Boolean(current);
      favorite.element.click();
      favoriteOverrides.set(trackKey, { saved, until: Date.now() + 4000 });
      return { mode: "web", favorite: saved };
    }
    if (action === "shuffle" || action === "repeat") {
      const target = controls()[action];
      if (!isAvailable(target)) throw new Error(action === "shuffle"
        ? t("shuffleUnavailable")
        : t("repeatUnavailable"));
      const shuffleBefore = action === "shuffle" ? isToggleEnabled(target) : false;
      const repeatBefore = action === "repeat" ? getRepeatState(target) : "off";
      target.focus({ preventScroll: true });
      target.click();
      return action === "shuffle"
        ? { mode: "web", shuffle_state: !shuffleBefore }
        : {
            mode: "web",
            repeat_state: repeatBefore === "off" ? "context"
              : repeatBefore === "context" ? "track" : "off"
          };
    }
    const player = controls();
    const target = action === "previous" ? player.previous
      : action === "next" ? player.next
      : player.playPause;
    if (!isAvailable(target)) {
      if (action === "previous") throw new Error(t("previousUnavailable"));
      if (action === "next") throw new Error(t("nextUnavailable"));
      throw new Error(t("commandUnavailable"));
    }
    target.click();
    return { mode: "web" };
  }

  function setRange(input, value) {
    if (!input) throw new Error(t("controlUnavailable"));
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function seek(positionMs) {
    const input = first([
      '[data-testid="playback-progressbar"] input[type="range"]',
      'input[data-testid="playback-progressbar"]'
    ]);
    const durationMs = parseClock(text(['[data-testid="playback-duration"]']));
    if (!input || !durationMs) throw new Error(t("seekUnavailable"));
    const max = Number(input.max) || 100;
    setRange(input, Math.round(Math.max(0, Math.min(positionMs, durationMs)) / durationMs * max));
    return { mode: "web" };
  }

  function setVolume(volume) {
    const input = first([
      '[data-testid="volume-bar"] input[type="range"]',
      'input[data-testid="volume-bar"]'
    ]);
    const safeVolume = Math.max(0, Math.min(100, volume));
    let changed = false;

    if (input) {
      const max = Number(input.max) || 100;
      // Spotify utilise selon les versions une plage 0..1 ou 0..100.
      // Ne surtout pas arrondir quand max=1 : 20 % deviendrait sinon 0 (muet).
      setRange(input, safeVolume / 100 * max);
      changed = true;
    }

    for (const audio of document.querySelectorAll("audio")) {
      try {
        audio.volume = safeVolume / 100;
        if (safeVolume > 0) audio.muted = false;
        changed = true;
      } catch (_) {}
    }

    if (!changed) throw new Error(t("volumeUnavailable"));
    return { mode: "web" };
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type === "tunedock-web:get-playback") {
      sendResponse(getPlayback());
      return;
    }
    try {
      if (request?.type === "tunedock-web:action") sendResponse(clickAction(request.action));
      else if (request?.type === "tunedock-web:seek") sendResponse(seek(Number(request.positionMs) || 0));
      else if (request?.type === "tunedock-web:volume") sendResponse(setVolume(Number(request.volume) || 0));
    } catch (error) {
      sendResponse({ error: error.message });
    }
  });
})();
