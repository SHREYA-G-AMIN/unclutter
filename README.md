# unclutter-
**Unclutter is an AI-powered browser extension that transforms overwhelming webpages into calm, focused, and accessible experiences.**

## Folde4r structure
unclutter-extension/
├── manifest.json          # extension config — permissions, entry points
├── popup/
│   ├── popup.html         # the toolbar popup UI (4 state buttons + toggles)
│   ├── popup.css
│   └── popup.js           # sends messages to content.js, logs overload events
├── content/
│   ├── content.js         # THE CORE — DOM manipulation logic per state
│   └── content.css        # injected classes (hide, dim, highlight, font, etc.)
├── background/
│   └── background.js      # service worker — seam for Person B's AI calls
└── icons/
    └── icon16/48/128.png  # placeholder icons (swap with real design later)
