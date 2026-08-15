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

let originalMainBg = null;
let speaking = false;

// ---- Utilities -------------------------------------------------

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

// Very lightweight "main content" heuristic: the element with the
// most direct text among candidates. Good enough for a demo; swap
// for a real readability algorithm later if needed.
function findMainContent() {
  const candidates = qsa("article, main, [role='main'], #content, .content, .post, .article");
  if (candidates.length) {
    return candidates.reduce((best, el) =>
      el.innerText.length > (best?.innerText.length || 0) ? el : best, null);
  }
  // Fallback: largest text block on the page
  const blocks = qsa("div, section").filter((el) => el.innerText.length > 200);
  return blocks.sort((a, b) => b.innerText.length - a.innerText.length)[0] || document.body;
}

// Finds the most likely "next important step" — first visible
// button, primary link, or CTA-looking element inside main content.
function findNextStep(mainEl) {
  const ctaSelectors = "button, a.btn, a.button, [class*='cta'], input[type='submit']";
  const candidates = qsa(ctaSelectors, mainEl).filter(isVisible);
  if (candidates.length) return candidates[0];

  // Fallback: first heading in main content
  const heading = mainEl.querySelector("h1, h2, h3");
  return heading || null;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}


function clearAll() {
  qsa(".unclutter-hidden").forEach((el) => el.classList.remove("unclutter-hidden"));
  qsa(".unclutter-dim").forEach((el) => el.classList.remove("unclutter-dim"));
  qsa(".unclutter-highlight-next").forEach((el) => el.classList.remove("unclutter-highlight-next"));
  document.documentElement.classList.remove("unclutter-no-animation", "unclutter-calm-bg");
  stopReadAloud();
  removeReadingOverlay();
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
}

function applyCantFocus() {
  clearAll();
  const main = findMainContent();
  // Dim everything that ISN'T the main content
  qsa("body > *").forEach((el) => {
    if (!main.contains(el) && el !== main) {
      el.classList.add("unclutter-dim");
    }
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
