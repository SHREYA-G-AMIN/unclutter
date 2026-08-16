(() => {
  const OVERLAY_ID = "unclutter-ai-overlay";
  const READER_STATE_KEY = "aiReaderState";

  let currentResult = null;
  let currentUtterance = null;
  let simplificationInProgress = false;
  let activeRequestId = 0;
  let readerState = {
    available: false,
    status: "idle",
    rate: 1,
  };

  function findMainContent() {
    const candidates = Array.from(
      document.querySelectorAll(
        "article, main, [role='main'], #content, .content, .post, .article",
      ),
    ).filter((element) => element.innerText.trim().length > 200);

    if (!candidates.length) {
      return document.body;
    }

    return candidates.reduce((largest, current) =>
      current.innerText.length > largest.innerText.length ? current : largest,
    );
  }

  function extractPageContent() {
    const mainContent = findMainContent();
    const clone = mainContent.cloneNode(true);

    clone
      .querySelectorAll(
        [
          "script",
          "style",
          "noscript",
          "nav",
          "aside",
          "footer",
          "form",
          "input",
          "textarea",
          "select",
          "button",
          "table",
          "[hidden]",
          "[aria-hidden='true']",
          "[role='navigation']",
          "[aria-label*='language']",
          "[class*='language']",
          "[class*='advert']",
          "[class*='popup']",
          "[class*='cookie']",
          "[class*='newsletter']",
          ".vector-header",
          ".vector-column-start",
          ".vector-column-end",
          ".mw-portlet",
          ".mw-editsection",
          ".navbox",
          ".sidebar",
          ".infobox",
          ".hatnote",
          ".metadata",
          "sup.reference",
        ].join(","),
      )
      .forEach((element) => element.remove());

    const blocks = Array.from(clone.querySelectorAll("h1, h2, h3, p, li"))
      .map((element) =>
        (element.textContent || "").replace(/\s+/g, " ").trim(),
      )
      .filter((block) => block.length >= 40 && block.length <= 800)
      .filter((block, index, items) => items.indexOf(block) === index);

    const fallbackText = (clone.textContent || "")
      .replace(/\s+/g, " ")
      .trim();

    const text = (blocks.length ? blocks.join("\n") : fallbackText)
      .slice(0, 12000);

    return {
      title: document.title,
      url: window.location.href,
      text,
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getSpeechText() {
    if (!currentResult) return "";

    return [
      currentResult.title,
      currentResult.summary,
      ...currentResult.keyPoints,
      currentResult.nextStep,
      currentResult.calmingNote,
    ]
      .filter(Boolean)
      .join(". ");
  }

  function publishReaderState() {
    chrome.storage.local.set({
      [READER_STATE_KEY]: { ...readerState },
    });
    updateOverlayReaderControls();
  }

  function setReaderState(changes) {
    readerState = { ...readerState, ...changes };
    publishReaderState();
  }

  function getReaderButtonLabel() {
    if (readerState.status === "speaking") return "Pause";
    if (readerState.status === "paused") return "Resume";
    return "Play";
  }

  function getReaderStatusLabel() {
    if (!readerState.available) return "Simplify the page to enable reading.";
    if (readerState.status === "speaking") return "Reading simplified content…";
    if (readerState.status === "paused") return "Reading paused.";
    return "Ready to read the simplified content.";
  }

  function updateOverlayReaderControls() {
    const playButton = document.getElementById("unclutter-reader-play");
    const stopButton = document.getElementById("unclutter-reader-stop");
    const speedSelect = document.getElementById("unclutter-reader-speed");
    const status = document.getElementById("unclutter-reader-status");

    if (!playButton) return;

    playButton.textContent = getReaderButtonLabel();
    playButton.disabled = !readerState.available;
    stopButton.disabled =
      !readerState.available || readerState.status === "idle";
    speedSelect.disabled = !readerState.available;
    speedSelect.value = String(readerState.rate);
    status.textContent = getReaderStatusLabel();
  }

  function stopReader({ clearResult = false } = {}) {
    currentUtterance = null;
    window.speechSynthesis.cancel();

    if (clearResult) {
      currentResult = null;
    }

    setReaderState({
      available: Boolean(currentResult),
      status: "idle",
    });
  }

  function toggleReader(rate = readerState.rate) {
    if (!currentResult) return;

    const nextRate = Number(rate) || 1;

    if (readerState.status === "speaking") {
      window.speechSynthesis.pause();
      setReaderState({ status: "paused" });
      return;
    }

    if (
      readerState.status === "paused" &&
      nextRate === readerState.rate
    ) {
      window.speechSynthesis.resume();
      setReaderState({ status: "speaking" });
      return;
    }

    currentUtterance = null;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(getSpeechText());
    utterance.rate = nextRate;
    currentUtterance = utterance;

    utterance.onend = () => {
      if (currentUtterance !== utterance) return;
      currentUtterance = null;
      setReaderState({ status: "idle" });
    };

    utterance.onerror = () => {
      if (currentUtterance !== utterance) return;
      currentUtterance = null;
      setReaderState({ status: "idle" });
    };

    window.speechSynthesis.speak(utterance);
    setReaderState({
      available: true,
      status: "speaking",
      rate: nextRate,
    });
  }

  function setReaderRate(rate) {
    const nextRate = [0.75, 1, 1.25].includes(Number(rate))
      ? Number(rate)
      : 1;
    const wasActive =
      readerState.status === "speaking" || readerState.status === "paused";

    currentUtterance = null;
    window.speechSynthesis.cancel();
    setReaderState({ status: "idle", rate: nextRate });

    if (wasActive) {
      toggleReader(nextRate);
    }
  }

  function closeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
    stopReader({ clearResult: true });
  }

  function createOverlay() {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="unclutter-ai-panel">
        <button class="unclutter-ai-close" aria-label="Close reader mode">
          &times;
        </button>
        <div class="unclutter-ai-content">
          <div class="unclutter-ai-loader"></div>
          <p>Creating a calmer version of this page…</p>
        </div>
      </div>
    `;

    overlay
      .querySelector(".unclutter-ai-close")
      .addEventListener("click", closeOverlay);

    document.body.appendChild(overlay);
    return overlay;
  }

  function showResult(result) {
    const overlay =
      document.getElementById(OVERLAY_ID) || createOverlay();

    currentResult = result;
    readerState = {
      available: true,
      status: "idle",
      rate: readerState.rate,
    };

    const keyPoints = result.keyPoints
      .map((point) => `<li>${escapeHtml(point)}</li>`)
      .join("");

    const content = overlay.querySelector(".unclutter-ai-content");

    content.innerHTML = `
      <span class="unclutter-ai-label">Calm reading mode</span>
      <h1>${escapeHtml(result.title)}</h1>
      <p class="unclutter-ai-summary">${escapeHtml(result.summary)}</p>

      <section>
        <h2>What matters</h2>
        <ul>${keyPoints}</ul>
      </section>

      <section class="unclutter-ai-next">
        <h2>Your next step</h2>
        <p>${escapeHtml(result.nextStep)}</p>
      </section>

      <p class="unclutter-ai-note">${escapeHtml(result.calmingNote)}</p>

      <div class="unclutter-ai-reader" aria-label="Read aloud controls">
        <button id="unclutter-reader-play">Play</button>
        <button id="unclutter-reader-stop">Stop</button>
        <label>
          Speed
          <select id="unclutter-reader-speed">
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
          </select>
        </label>
        <span id="unclutter-reader-status" aria-live="polite"></span>
      </div>

      <div class="unclutter-ai-actions">
        <button id="unclutter-restore-page">Restore original page</button>
      </div>
    `;

    content
      .querySelector("#unclutter-reader-play")
      .addEventListener("click", () => toggleReader());

    content
      .querySelector("#unclutter-reader-stop")
      .addEventListener("click", () => stopReader());

    content
      .querySelector("#unclutter-reader-speed")
      .addEventListener("change", (event) =>
        setReaderRate(event.target.value),
      );

    content
      .querySelector("#unclutter-restore-page")
      .addEventListener("click", closeOverlay);

    publishReaderState();
  }

  function buildFallbackResult(page) {
    const blocks = page.text
      .split(/\n+/)
      .map((block) => block.trim())
      .filter((block) => block.length >= 40);

    const summary = (blocks[0] || page.text).slice(0, 400);
    const keyPoints = blocks.slice(1, 6).map((block) => block.slice(0, 240));

    if (!keyPoints.length) {
      keyPoints.push(page.text.slice(0, 240));
    }

    return {
      title:
        page.title.replace(/\s*[-–—]\s*Wikipedia.*$/i, "").trim() ||
        "Calm reading mode",
      summary,
      keyPoints,
      nextStep: "Start with the first key point and continue when you feel ready.",
      calmingNote:
        "AI is temporarily busy, so Unclutter is showing a calm local version.",
    };
  }

  function showError(message) {
    const overlay =
      document.getElementById(OVERLAY_ID) || createOverlay();

    stopReader({ clearResult: true });

    overlay.querySelector(".unclutter-ai-content").innerHTML = `
      <span class="unclutter-ai-label">Unclutter</span>
      <h1>We couldn’t simplify this page</h1>
      <p>${escapeHtml(message)}</p>
      <button id="unclutter-close-error">Return to the original page</button>
    `;

    overlay
      .querySelector("#unclutter-close-error")
      .addEventListener("click", closeOverlay);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "RESET") {
      activeRequestId += 1;
      simplificationInProgress = false;
      closeOverlay();
      return false;
    }

    if (message.type === "AI_READER_TOGGLE") {
      toggleReader(message.rate);
      return false;
    }

    if (message.type === "AI_READER_STOP") {
      stopReader();
      return false;
    }

    if (message.type === "AI_READER_SET_SPEED") {
      setReaderRate(message.rate);
      return false;
    }

    if (message.type !== "SIMPLIFY_PAGE") {
      return false;
    }

    if (simplificationInProgress) {
      return false;
    }

    const mode = message.mode || message.state;
    const page = extractPageContent();
    const requestId = ++activeRequestId;

    simplificationInProgress = true;
    createOverlay();

    if (!page.text) {
      simplificationInProgress = false;
      showError("No readable page content was found.");
      return false;
    }

    chrome.runtime.sendMessage(
      {
        type: "SIMPLIFY_CONTENT",
        payload: {
          ...page,
          mode,
        },
      },
      (response) => {
        if (requestId !== activeRequestId) {
          return;
        }

        simplificationInProgress = false;

        if (chrome.runtime.lastError || !response?.ok) {
          showResult(buildFallbackResult(page));
          return;
        }

        showResult(response.data);
      },
    );

    return false;
  });

  publishReaderState();
})();