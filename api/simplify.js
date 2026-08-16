import { generateSimplification } from "./gemini.js";
import { buildSimplificationPrompt } from "./prompts.js";

const ALLOWED_MODES = new Set([
  "overwhelmed",
  "cant-focus",
  "eyes-hurt",
  "sensory-overload",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: CORS_HEADERS,
  });
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeResult(result, fallbackTitle) {
  if (!result || typeof result !== "object") {
    throw new Error("Gemini returned an invalid result.");
  }

  const normalized = {
    title: cleanString(result.title) || fallbackTitle || "Simplified page",
    summary: cleanString(result.summary),
    keyPoints: Array.isArray(result.keyPoints)
      ? result.keyPoints
          .filter((point) => typeof point === "string" && point.trim())
          .map((point) => point.trim())
          .slice(0, 5)
      : [],
    nextStep: cleanString(result.nextStep),
    calmingNote: cleanString(result.calmingNote),
  };

  if (
    !normalized.summary ||
    !normalized.keyPoints.length ||
    !normalized.nextStep
  ) {
    throw new Error("Gemini response is missing required fields.");
  }

  return normalized;
}

async function generateParsedResult(prompt) {
  const firstResponse = await generateSimplification(prompt);

  try {
    return JSON.parse(firstResponse);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }

    console.warn("Gemini returned malformed JSON. Retrying once.");

    const retryResponse = await generateSimplification(prompt);
    return JSON.parse(retryResponse);
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export function GET() {
  return json({
    service: "unclutter-ai",
    status: "ready",
  });
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, error: "Request body must be valid JSON." },
      400,
    );
  }

  const { title = "", text, mode } = body ?? {};

  if (typeof text !== "string" || !text.trim()) {
    return json(
      { ok: false, error: "Page text is required." },
      400,
    );
  }

  if (!ALLOWED_MODES.has(mode)) {
    return json(
      { ok: false, error: "Invalid wellness mode." },
      400,
    );
  }

  const cleanedTitle = String(title).trim().slice(0, 300);
  const cleanedText = text.trim().slice(0, 12000);

  try {
    const prompt = buildSimplificationPrompt({
      title: cleanedTitle,
      text: cleanedText,
      mode,
    });

    const parsedResult = await generateParsedResult(prompt);
    const result = normalizeResult(parsedResult, cleanedTitle);

    return json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Simplification failed:", error);

    return json(
      {
        ok: false,
        error: "Unable to simplify this page right now.",
      },
      502,
    );
  }
}
export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return OPTIONS();
    }

    if (request.method === "GET") {
      return GET();
    }

    if (request.method === "POST") {
      return POST(request);
    }

    return json(
      {
        ok: false,
        error: "Method not allowed.",
      },
      405,
    );
  },
};