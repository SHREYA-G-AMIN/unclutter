// ============================================================
// Unclutter — content script
// Runs on every page. Listens for messages from the popup and
// transforms the live DOM based on the selected cognitive state.
// ============================================================

const CLUTTER_SELECTORS = [
  "nav", "aside", "footer",
  "[class*='ad-']", "[id*='ad-']", "[class*='advert']",
  "[class*='popup']", "[class*='modal']", "[class*='banner']",
  "[class*='sidebar']", "[class*='newsletter']", "[class*='cookie']",
  "[class*='social-share']", "[class*='related-posts']",
  "iframe:not([src*='youtube']):not([src*='vimeo'])",
];

let speaking = false;

// ---- Utilities -------------------------------------------------

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// Finds the most likely "main content" block on the page.
// Prefers semantic containers, excludes nav/header/footer, and
// falls back to scoring divs by paragraph density (penalizing
// link-heavy blocks, which are usually navigation, not content).
function findMainContent() {
  const excludeSelector = "nav, header, footer, aside, [role='navigation'], [role='banner']";

  const candidates = qsa("article, main, [role='main'], #content, .content, .post, .article")
    .filter((el) => !el.matches(excludeSelector) && !el.closest(excludeSelector));

  if (candidates.length) {
    return candidates.reduce((best, el) =>
      el.innerText.length > (best?.innerText.length || 0) ? el : best, null);
  }

  const blocks = qsa("div, section")
    .filter((el) => !el.matches(excludeSelector) && !el.closest(excludeSelector))
    .filter((el) => el.querySelectorAll("p").length >= 2);

  const scored = blocks.map((el) => ({
    el,
    score: el.innerText.length - el.querySelectorAll("a").length * 20,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.el || document.body;
}

// Finds the most likely "next important step" — first visible
// button, primary link, or CTA-looking element inside main content.
function findNextStep(mainEl) {
  const ctaSelectors = "button, a.btn, a.button, [class*='cta'], input[type='submit']";
  const candidates = qsa(ctaSelectors, mainEl).filter(isVisible);
  if (candidates.length) return candidates[0];

  const heading = mainEl.querySelector("h1, h2, h3");
  return heading || null;
}

// ---- State handlers ---------------------------------------------

function clearAll() {
  qsa(".unclutter-hidden").forEach((el) => el.classList.remove("unclutter-hidden"));
  qsa(".unclutter-dim").forEach((el) => el.classList.remove("unclutter-dim"));
  qsa(".unclutter-highlight-next").forEach((el) => el.classList.remove("unclutter-highlight-next"));
  document.documentElement.classList.remove("unclutter-no-animation", "unclutter-calm-bg");
  stopReadAloud();
  removeReadingOverlay();
  removeEyeComfortPanel();
}

function applyOverwhelmed() {
  clearAll();
  CLUTTER_SELECTORS.forEach((sel) => {
    qsa(sel).forEach((el) => el.classList.add("unclutter-hidden"));
  });
  document.documentElement.classList.add("unclutter-no-animation", "unclutter-calm-bg");

  const main = findMainContent();
  const next = findNextStep(main);
  if (next) next.classList.add("unclutter-highlight-next");
}

function applyEyesHurt() {
  clearAll();
  document.documentElement.classList.add("unclutter-calm-bg", "unclutter-no-animation");
  CLUTTER_SELECTORS.forEach((sel) => {
    qsa(sel).forEach((el) => el.classList.add("unclutter-hidden"));
  });
  setDyslexiaFont(true);
  showEyeComfortPanel();
}

function applyCantFocus() {
  clearAll();

  CLUTTER_SELECTORS.forEach((sel) => {
    qsa(sel).forEach((el) => el.classList.add("unclutter-hidden"));
  });

  const main = findMainContent();

  qsa("body > *").forEach((el) => {
    if (el === main || el.contains(main) || main.contains(el)) return;
    el.classList.add("unclutter-dim");
  });

  document.documentElement.classList.add("unclutter-no-animation");
  const next = findNextStep(main);
  if (next) next.classList.add("unclutter-highlight-next");
}

function applySensoryOverload() {
  clearAll();
  document.documentElement.classList.add("unclutter-no-animation", "unclutter-calm-bg");
  qsa("video, audio").forEach((el) => {
    try { el.pause(); } catch (e) {}
  });
  CLUTTER_SELECTORS.forEach((sel) => {
    qsa(sel).forEach((el) => el.classList.add("unclutter-hidden"));
  });
  qsa("img").forEach((el) => el.classList.add("unclutter-dim"));
}

// ---- Dyslexia font -------------------------------------------------

function setDyslexiaFont(enabled) {
  document.documentElement.classList.toggle("unclutter-dyslexia-font", enabled);
}

// ---- Eye comfort panel (dim + warmth sliders) -----------------------

function showEyeComfortPanel() {
  removeEyeComfortPanel(); // avoid duplicates

  const dimOverlay = document.createElement("div");
  dimOverlay.id = "unclutter-dim-overlay";
  dimOverlay.className = "unclutter-dim-overlay";
  document.body.appendChild(dimOverlay);

  const warmthOverlay = document.createElement("div");
  warmthOverlay.id = "unclutter-warmth-overlay";
  warmthOverlay.className = "unclutter-warmth-overlay";
  document.body.appendChild(warmthOverlay);

  const panel = document.createElement("div");
  panel.id = "unclutter-eye-panel";
  panel.className = "unclutter-eye-panel";
  panel.innerHTML = `
    <button class="unclutter-eye-close" id="unclutter-eye-close">✕</button>
    <h4>Eye comfort</h4>
    <div class="unclutter-eye-row">
      <label>Dim screen <span id="unclutter-dim-value">0%</span></label>
      <input type="range" id="unclutter-dim-slider" min="0" max="70" value="0" />
    </div>
    <div class="unclutter-eye-row">
      <label>Warmth <span id="unclutter-warmth-value">0%</span></label>
      <input type="range" id="unclutter-warmth-slider" min="0" max="60" value="0" />
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById("unclutter-dim-slider").addEventListener("input", (e) => {
    document.getElementById("unclutter-dim-value").textContent = e.target.value + "%";
    dimOverlay.style.opacity = e.target.value / 100;
  });

  document.getElementById("unclutter-warmth-slider").addEventListener("input", (e) => {
    document.getElementById("unclutter-warmth-value").textContent = e.target.value + "%";
    warmthOverlay.style.opacity = e.target.value / 100;
  });

  document.getElementById("unclutter-eye-close").addEventListener("click", removeEyeComfortPanel);
}

function removeEyeComfortPanel() {
  document.getElementById("unclutter-eye-panel")?.remove();
  document.getElementById("unclutter-dim-overlay")?.remove();
  document.getElementById("unclutter-warmth-overlay")?.remove();
}

// ---- Read aloud (Web Speech API) ------------------------------------

function startReadAloud() {
  const main = findMainContent();
  const text = main.innerText.slice(0, 6000); // cap for demo safety
  if (!text.trim()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.onend = () => { speaking = false; removeReadingOverlay(); };
  window.speechSynthesis.speak(utterance);
  speaking = true;
  showReadingOverlay();
}

function stopReadAloud() {
  window.speechSynthesis.cancel();
  speaking = false;
}

function showReadingOverlay() {
  removeReadingOverlay();
  const bar = document.createElement("div");
  bar.className = "unclutter-reading-overlay";
  bar.id = "unclutter-reading-bar";
  bar.innerHTML = `<span>🔊 Reading page aloud…</span>`;
  const stopBtn = document.createElement("button");
  stopBtn.textContent = "Stop";
  stopBtn.addEventListener("click", stopReadAloud);
  bar.appendChild(stopBtn);
  document.body.prepend(bar);
}

function removeReadingOverlay() {
  document.getElementById("unclutter-reading-bar")?.remove();
}

// ---- Message listener -------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "APPLY_STATE":
      if (message.state === "overwhelmed") applyOverwhelmed();
      else if (message.state === "eyes-hurt") applyEyesHurt();
      else if (message.state === "cant-focus") applyCantFocus();
      else if (message.state === "sensory-overload") applySensoryOverload();
      break;

    case "TOGGLE_DYSLEXIA_FONT":
      setDyslexiaFont(message.enabled);
      break;

    case "TOGGLE_READ_ALOUD":
      message.enabled ? startReadAloud() : stopReadAloud();
      break;

    case "RESET":
      clearAll();
      setDyslexiaFont(false);
      break;
  }
  sendResponse({ ok: true });
  return true;
});