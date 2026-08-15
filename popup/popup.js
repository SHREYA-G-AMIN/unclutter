const statusEl = document.getElementById("status");
const themeToggleBtn = document.getElementById("themeToggle");
const themeIconEl = document.getElementById("themeIcon");

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (err) {
    // Content script may not be injected yet (e.g. chrome:// pages)
    statusEl.textContent = "Can't run on this page.";
  }
}

// State buttons
document.querySelectorAll(".state-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".state-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const state = btn.dataset.state;
    statusEl.textContent = "Calming the page…";

    await sendToContent({ type: "APPLY_STATE", state });
    await logOverloadEvent(state);

    statusEl.textContent = "Done ✓";
  });
});

// Toggles
document.getElementById("dyslexiaFont").addEventListener("change", (e) => {
  sendToContent({ type: "TOGGLE_DYSLEXIA_FONT", enabled: e.target.checked });
});

document.getElementById("readAloud").addEventListener("change", (e) => {
  sendToContent({ type: "TOGGLE_READ_ALOUD", enabled: e.target.checked });
});

// Reset
document.getElementById("resetBtn").addEventListener("click", async () => {
  document.querySelectorAll(".state-btn").forEach((b) => b.classList.remove("active"));
  statusEl.textContent = "Resetting…";
  await sendToContent({ type: "RESET" });
  statusEl.textContent = "Page restored ✓";
});

// Pattern tracking: which site + which state + when
async function logOverloadEvent(state) {
  const tab = await getActiveTab();
  if (!tab?.url) return;
  const hostname = new URL(tab.url).hostname;

  const { overloadLog = [] } = await chrome.storage.local.get("overloadLog");
  overloadLog.push({ hostname, state, timestamp: Date.now() });
  // Keep last 500 events so storage doesn't grow unbounded
  await chrome.storage.local.set({ overloadLog: overloadLog.slice(-500) });
}

// ---- Light / dark theme toggle (popup UI only) --------------------------

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
  // Icon shows the mode you'd switch TO, matching the "sun = go light" convention
  themeIconEl.textContent = isLight ? "dark_mode" : "light_mode";
}

async function initTheme() {
  const { theme = "dark" } = await chrome.storage.local.get("theme");
  applyTheme(theme);
}

themeToggleBtn.addEventListener("click", async () => {
  const nextTheme = document.body.classList.contains("light-theme") ? "dark" : "light";
  applyTheme(nextTheme);
  await chrome.storage.local.set({ theme: nextTheme });
});

initTheme();