type VisionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

const DEFAULT_IMAGE_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export async function describeImageBuffer(buffer: Buffer, mimeType: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY in backend/.env");

  const model = process.env.IMAGE_VISION_MODEL || DEFAULT_IMAGE_VISION_MODEL;
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You create detailed, factual image descriptions for document retrieval. Describe visible objects, text, diagrams, labels, relationships, context, and important visual details. Do not invent details that are not visible.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all searchable information from this image. Include any visible text exactly when possible, then summarize the image content in detail.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    }),
  });

  const json = (await resp.json().catch(() => null)) as VisionResponse | null;

  if (!resp.ok) {
    throw new Error(
      `Image vision error: ${json?.error?.message ?? `HTTP ${resp.status}`}`
    );
  }

  return json?.choices?.[0]?.message?.content?.trim() ?? "";
}
