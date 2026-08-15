(() => {
  const OVERLAY_ID = "unclutter-ai-overlay";

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
          "[hidden]",
          "[aria-hidden='true']",
          "[class*='advert']",
          "[class*='popup']",
          "[class*='cookie']",
          "[class*='newsletter']",
        ].join(","),
      )
      .forEach((element) => element.remove());

    const text = (clone.innerText || clone.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
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

  function closeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
    window.speechSynthesis.cancel();
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

      <div class="unclutter-ai-actions">
        <button id="unclutter-read-result">Read aloud</button>
        <button id="unclutter-restore-page">Restore original page</button>
      </div>
    `;

    content
      .querySelector("#unclutter-read-result")
      .addEventListener("click", () => {
        const speechText = [
          result.title,
          result.summary,
          ...result.keyPoints,
          result.nextStep,
          result.calmingNote,
        ].join(". ");

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(
          new SpeechSynthesisUtterance(speechText),
        );
      });

    content
      .querySelector("#unclutter-restore-page")
      .addEventListener("click", closeOverlay);
  }

  function showError(message) {
    const overlay =
      document.getElementById(OVERLAY_ID) || createOverlay();

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
    closeOverlay();
    return false;
  }

  if (message.type !== "SIMPLIFY_PAGE") {
    return false;
  }

    const mode = message.mode || message.state;
    const page = extractPageContent();

    createOverlay();

    if (!page.text) {
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
        if (chrome.runtime.lastError) {
          showError("The AI service could not be reached.");
          return;
        }

        if (!response?.ok) {
          showError(
            response?.error ||
              "AI simplification is temporarily unavailable.",
          );
          return;
        }

        showResult(response.data);
      },
    );

    return false;
  });
})();