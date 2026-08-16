(() => {
  const OVERLAY_ID = "unclutter-ai-overlay";
  const READER_STATE_KEY = "aiReaderState";

  let currentResult = null;
  let currentUtterance = null;
  let readerSegments = [];
  let currentSegmentIndex = 0;
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

  function prepareReaderSegments(result) {
    readerSegments = [
      result.title,
      result.summary,
      ...result.keyPoints,
      result.nextStep,
      result.calmingNote,
    ]
      .filter(Boolean)
      .map((text, index) => ({ index, text: String(text) }));

    currentSegmentIndex = 0;
  }

  function readerText(text, index) {
    return `<span class="unclutter-reader-segment" data-reader-index="${index}">${escapeHtml(text)}</span>`;
  }

  function clearReaderHighlight() {
    document
      .querySelectorAll(".unclutter-reader-segment-active")
      .forEach((element) =>
        element.classList.remove("unclutter-reader-segment-active"),
      );
  }

  function highlightReaderSegment(index) {
    clearReaderHighlight();

    const element = document.querySelector(
      `[data-reader-index="${index}"]`,
    );

    if (!element) return;

    element.classList.add("unclutter-reader-segment-active");
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }

  function speakCurrentSegment(rate = readerState.rate) {
    if (currentSegmentIndex >= readerSegments.length) {
      currentUtterance = null;
      currentSegmentIndex = 0;
      clearReaderHighlight();
      setReaderState({ status: "idle" });
      return;
    }

    const segment = readerSegments[currentSegmentIndex];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.rate = rate;
    currentUtterance = utterance;

    highlightReaderSegment(segment.index);

    utterance.onend = () => {
      if (currentUtterance !== utterance) return;

      currentUtterance = null;
      currentSegmentIndex += 1;
      speakCurrentSegment(rate);
    };

    utterance.onerror = (event) => {
      if (currentUtterance !== utterance || event.error === "canceled") return;

      currentUtterance = null;
      clearReaderHighlight();
      setReaderState({ status: "idle" });
    };

    window.speechSynthesis.speak(utterance);
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
    currentSegmentIndex = 0;
    clearReaderHighlight();

    if (clearResult) {
      currentResult = null;
      readerSegments = [];
    }

    setReaderState({
      available: Boolean(currentResult),
      status: "idle",
    });
  }

  function toggleReader(rate = readerState.rate) {
    if (!currentResult || !readerSegments.length) return;

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

    if (currentSegmentIndex >= readerSegments.length) {
      currentSegmentIndex = 0;
    }

    speakCurrentSegment(nextRate);
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

  function restoreOriginalPageStyles() {
    document
      .querySelectorAll(
        ".unclutter-hidden, .unclutter-dim, .unclutter-highlight-next",
      )
      .forEach((element) => {
        element.classList.remove(
          "unclutter-hidden",
          "unclutter-dim",
          "unclutter-highlight-next",
        );
      });

    document.documentElement.classList.remove(
      "unclutter-no-animation",
      "unclutter-calm-bg",
    );
  }

  function closeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
    stopReader({ clearResult: true });
    restoreOriginalPageStyles();
  }

  function createOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
    stopReader({ clearResult: true });

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
    prepareReaderSegments(result);
    readerState = {
      available: true,
      status: "idle",
      rate: readerState.rate,
    };

    const keyPoints = result.keyPoints
      .map((point, index) => `<li>${readerText(point, index + 2)}</li>`)
      .join("");

    const content = overlay.querySelector(".unclutter-ai-content");

    content.innerHTML = `
      <span class="unclutter-ai-label">Calm reading mode</span>
      <h1>${readerText(result.title, 0)}</h1>
      <p class="unclutter-ai-summary">${readerText(result.summary, 1)}</p>

      <section>
        <h2>What matters</h2>
        <ul>${keyPoints}</ul>
      </section>

      <section class="unclutter-ai-next">
        <h2>Your next step</h2>
        <p>${readerText(result.nextStep, result.keyPoints.length + 2)}</p>
      </section>

      <p class="unclutter-ai-note">${readerText(
        result.calmingNote,
        result.keyPoints.length + 3,
      )}</p>

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