const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: {
      type: "STRING",
    },
    summary: {
      type: "STRING",
    },
    keyPoints: {
      type: "ARRAY",
      items: {
        type: "STRING",
      },
    },
    nextStep: {
      type: "STRING",
    },
    calmingNote: {
      type: "STRING",
    },
  },
  required: [
    "title",
    "summary",
    "keyPoints",
    "nextStep",
    "calmingNote",
  ],
};
export async function generateSimplification(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2400,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Gemini request failed with status ${response.status}: ${errorBody}`,
    );
  }

  const data = await response.json();

  const candidate = data.candidates?.[0];

  if (!candidate) {
    throw new Error("Gemini returned no response candidate.");
  }

  if (candidate.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini response was truncated.");
  }

  const generatedText = candidate.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!generatedText) {
    throw new Error("Gemini returned an empty response.");
  }

  return generatedText;
}