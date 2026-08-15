const API_BASE_URL = "https://unclutter-lyart.vercel.app";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SIMPLIFY_CONTENT") {
    return false;
  }

  simplifyContent(message.payload)
    .then((data) => {
      sendResponse({
        ok: true,
        data,
      });
    })
    .catch((error) => {
      console.error("Unclutter AI request failed:", error);

      sendResponse({
        ok: false,
        error: "AI simplification is temporarily unavailable.",
      });
    });

  return true;
});

async function simplifyContent(payload) {
  if (!payload?.text || !payload?.mode) {
    throw new Error("Missing webpage content or wellness mode.");
  }

  const response = await fetch(`${API_BASE_URL}/api/simplify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Simplification request failed.");
  }

  return result.data;
}
