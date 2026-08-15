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

  const { title = "", url = "", text, mode } = body ?? {};

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

  const cleanedText = text.trim().slice(0, 12000);

  return json({
    ok: true,
    message: "Simplification request accepted.",
    input: {
      title: String(title).slice(0, 300),
      url: String(url).slice(0, 2000),
      mode,
      characters: cleanedText.length,
    },
  });
}