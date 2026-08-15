// Background service worker (Manifest V3).
// Currently minimal — this is the seam where Person B's AI
// simplification calls will eventually be triggered from,
// since content scripts can't always make cross-origin fetches
// as reliably as the background worker can.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Unclutter installed.");
  chrome.storage.local.set({ overloadLog: [] });
});

// Placeholder: Person B will add a listener here like:
//
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.type === "SIMPLIFY_TEXT") {
//     fetch("https://api.anthropic.com/v1/messages", { ... })
//       .then(res => res.json())
//       .then(data => sendResponse({ simplified: data }));
//     return true; // keep the message channel open for async response
//   }
// });
