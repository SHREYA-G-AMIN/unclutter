const statusEl = document.getElementById("status");
const readerPlayPause = document.getElementById("readerPlayPause");
const readerStop = document.getElementById("readerStop");
const readerSpeed = document.getElementById("readerSpeed");
const readerStatus = document.getElementById("readerStatus");

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return false;

  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch {
    statusEl.textContent = "Can't run on this page.";
    return false;
  }
}

function updateReaderControls(state = {}) {
  const available = Boolean(state.available);
  const readerMode = state.status || "idle";
  const rate = Number(state.rate) || 1;

  readerPlayPause.disabled = !available;
  readerStop.disabled = !available || readerMode === "idle";
  readerSpeed.disabled = !available;
  readerSpeed.value = String(rate);

  if (readerMode === "speaking") {
    readerPlayPause.textContent = "Pause";
    readerStatus.textContent = "Reading simplified content…";
  } else if (readerMode === "paused") {
    readerPlayPause.textContent = "Resume";
    readerStatus.textContent = "Reading paused.";
  } else {
    readerPlayPause.textContent = "Play";
    readerStatus.textContent = available
      ? "Ready to read the simplified content."
      : "Simplify a page to enable controls.";
  }
}

async function loadReaderState() {
  const { aiReaderState } = await chrome.storage.local.get("aiReaderState");
  updateReaderControls(aiReaderState);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.aiReaderState) {
    updateReaderControls(changes.aiReaderState.newValue);
  }
});

document.querySelectorAll(".state-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".state-btn").forEach((button) =>
      button.classList.remove("active"),
    );
    btn.classList.add("active");

    const state = btn.dataset.state;
    statusEl.textContent = "Calming the page…";

    await sendToContent({ type: "APPLY_STATE", state });

    statusEl.textContent = "Creating calm reading mode…";

    await sendToContent({
      type: "SIMPLIFY_PAGE",
      mode: state,
    });

    await logOverloadEvent(state);
    statusEl.textContent = "AI simplification started.";
  });
});

document.getElementById("dyslexiaFont").addEventListener("change", (event) => {
  sendToContent({
    type: "TOGGLE_DYSLEXIA_FONT",
    enabled: event.target.checked,
  });
});

readerPlayPause.addEventListener("click", () => {
  sendToContent({
    type: "AI_READER_TOGGLE",
    rate: Number(readerSpeed.value),
  });
});

readerStop.addEventListener("click", () => {
  sendToContent({ type: "AI_READER_STOP" });
});

readerSpeed.addEventListener("change", () => {
  sendToContent({
    type: "AI_READER_SET_SPEED",
    rate: Number(readerSpeed.value),
  });
});

document.getElementById("resetBtn").addEventListener("click", async () => {
  document.querySelectorAll(".state-btn").forEach((button) =>
    button.classList.remove("active"),
  );
  statusEl.textContent = "Resetting…";
  await sendToContent({ type: "RESET" });
  statusEl.textContent = "Page restored ✓";
});

async function logOverloadEvent(state) {
  const tab = await getActiveTab();
  if (!tab?.url) return;

  const hostname = new URL(tab.url).hostname;
  const { overloadLog = [] } =
    await chrome.storage.local.get("overloadLog");

  overloadLog.push({ hostname, state, timestamp: Date.now() });
  await chrome.storage.local.set({
    overloadLog: overloadLog.slice(-500),
  });
}

loadReaderState();