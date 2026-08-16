# Unclutter

**Unclutter is a browser extension that transforms overwhelming webpages into calmer, focused and more accessible reading experiences.**

## Problem Statement

Students constantly receive advice to be more productive, build habits and optimize every minute. During exams or project deadlines, this pressure often leads to burnout, guilt and declining mental well-being.

Webpages can add to this overload through advertisements, popups, sidebars, animations, dense text and other distractions. Unclutter helps students reduce this visual and cognitive overload while browsing.

## Our Solution

Unclutter adjusts a webpage according to how the user is currently feeling.

Instead of asking users to force themselves through an overwhelming webpage, the extension creates a calmer browsing experience by removing distractions, simplifying content and offering accessibility tools.

Users can choose from four wellness modes:

* **I’m Overwhelmed** — removes unnecessary clutter and presents the important content clearly.
* **My Eyes Hurt** — reduces visual strain, distractions and animations.
* **I Can’t Focus** — emphasizes the main content and the next important step.
* **Sensory Overload** — reduces distracting media and unnecessary visual elements.

## Key Features

* Four cognitive wellness modes
* AI-powered webpage simplification
* Automatic detection of the main webpage content
* Removal of advertisements, popups, sidebars and navigation clutter
* Calm Reading Mode
* Short summary, key points and a manageable next step
* Read-aloud with Play, Pause and Stop controls
* Adjustable narration speed
* Active reading-section highlighting
* Automatic scrolling while narration is active
* Dyslexia-friendly font option
* Eye-comfort controls
* Light and dark themes
* Page restoration and reset controls
* Cached AI responses for faster repeated requests
* Basic Calm Mode when the AI service is unavailable

## How It Works

1. The user opens Unclutter on a webpage.
2. The user selects one of the four wellness modes.
3. The content script identifies the main readable content.
4. Advertisements, navigation elements and other unnecessary content are removed.
5. The cleaned webpage text and selected mode are sent to the background service worker.
6. The background service worker sends the request to the Vercel backend.
7. The backend securely communicates with the Gemini API.
8. Gemini returns a structured response containing:

   * A title
   * A short summary
   * Important key points
   * One manageable next step
   * A calming note
9. Unclutter displays the result inside Calm Reading Mode.
10. The user can read the simplified version or listen using the narration controls.

If Gemini is unavailable, Unclutter switches to Basic Calm Mode and creates a simple local version from the extracted webpage content.

## Technology Stack

* HTML
* CSS
* JavaScript
* Chrome Extensions Manifest V3
* Chrome Storage API
* Chrome Messaging API
* Web Speech API
* Gemini API
* Vercel Serverless Functions
* Google Fonts
* Material Symbols
* Git and GitHub

## Project Architecture

```text
Extension Popup
      │
      ▼
Content Scripts
      │
      ▼
Background Service Worker
      │
      ▼
Vercel Serverless API
      │
      ▼
Gemini API
      │
      ▼
Calm Reading Mode
```

## Project Structure

```text
unclutter/
├── api/
│   ├── gemini.js          # Communicates with the Gemini API
│   ├── prompts.js         # Builds mode-aware simplification prompts
│   └── simplify.js        # Validates and processes API requests
│
├── background/
│   └── background.js      # Connects the extension to the backend and caches results
│
├── content/
│   ├── ai.css             # Calm Reading Mode and narration-highlight styles
│   ├── ai.js              # AI overlay, fallback and read-aloud logic
│   ├── content.css        # Webpage transformation and accessibility styles
│   └── content.js         # DOM manipulation and wellness-mode logic
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── popup/
│   ├── popup.css          # Popup themes and component styling
│   ├── popup.html         # Extension popup structure
│   └── popup.js           # Popup interactions and content-script messaging
│
├── .env.example
├── .gitignore
├── manifest.json
├── package.json
└── README.md
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/SHREYA-G-AMIN/unclutter.git
cd unclutter
```

### 2. Load the extension

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable **Developer Mode**.
3. Select **Load unpacked**.
4. Choose the cloned `unclutter` folder.
5. Pin Unclutter to the browser toolbar.

### 3. Use Unclutter

1. Open a normal article or content-heavy webpage.
2. Select the Unclutter icon.
3. Choose the wellness mode that matches how you are feeling.
4. Wait for Calm Reading Mode to appear.
5. Read the simplified content or use the narration controls.
6. Select **Reset to default** or close Calm Reading Mode to restore the webpage.

## Backend Setup

Create a `.env` file based on `.env.example`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
```

Never commit the real `.env` file or Gemini API key.

To run the Vercel API locally:

```bash
npx vercel dev
```

The production API is deployed using Vercel Serverless Functions. The Gemini API key is stored securely through Vercel environment variables and is not exposed inside the browser extension.

## Reliability and Fallback

Gemini may occasionally become unavailable because of network problems, quota limits or temporary API errors.

Unclutter handles these situations using:

* Request validation
* Error handling
* Cached successful responses
* Duplicate-request protection
* Basic Calm Mode as a local fallback

The fallback keeps the extension usable even when AI simplification cannot be completed.

## Accessibility

Unclutter includes accessibility controls designed to make reading more comfortable:

* Dyslexia-friendly typography
* Reduced animations
* Eye-comfort controls
* Light and dark themes
* Read-aloud controls
* Adjustable narration speed
* Active-section highlighting
* Automatic scrolling during narration
* High-contrast interface controls

## Privacy

Unclutter extracts visible text from the current webpage only when the user selects a wellness mode.

The extracted text is sent to the Unclutter Vercel backend for simplification. The Gemini API key remains on the server and is never stored in the extension.

Unclutter does not collect passwords, form values or private authentication information.

## AI Usage

Gemini is used as the main simplification engine inside Unclutter.

The selected wellness mode and cleaned webpage content are included in a mode-aware prompt. Gemini is instructed to preserve the original meaning and return structured JSON containing a title, summary, key points, next step and calming note.

AI development tools were also used during planning, prototyping and debugging. The team reviewed, tested and integrated the implementation while remaining responsible for the final functionality and decisions.

## Team Contributions

### Istha P. Jain — Frontend and User Experience

* Designed and developed the extension popup interface
* Created the four wellness-mode selection cards
* Built the light and dark popup themes
* Designed the accessibility-control section
* Developed the dyslexia-friendly font interface
* Created the eye-comfort control interface
* Designed the read-aloud control layout
* Improved the AI summary-card appearance
* Added responsive styling and popup scrolling behaviour
* Tested and polished the overall visual experience

### Shreya G Amin — Extension Logic and AI Integration

* Developed the webpage content detection and extraction logic
* Implemented DOM manipulation for the four wellness modes
* Built and deployed the Vercel serverless backend
* Integrated Gemini with mode-aware prompts and structured responses
* Connected the popup, content scripts, background worker and backend
* Developed Calm Reading Mode and Basic Calm Mode
* Implemented narration controls and active-section highlighting
* Added caching, validation, request locking and fallback handling
* Secured the Gemini API key using Vercel environment variables
* Tested and debugged the complete extension and AI workflow

## Credits

Unclutter uses the following technologies and resources:

* Google Gemini API
* Vercel
* Chrome Extensions Manifest V3
* Chrome Storage and Messaging APIs
* Web Speech API
* Google Fonts
* Material Symbols

We also used open-source browser APIs, development tools and learning resources while building and testing the project.

