import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedTexts(texts: string[]) {
  // OpenAI embedding model: 1536 dims
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  return resp.data.map(d => d.embedding);
}