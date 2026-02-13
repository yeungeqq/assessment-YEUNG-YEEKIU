import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

const token = process.env.HUGGINGFACEHUB_API_TOKEN;
if (!token) throw new Error("Missing HUGGINGFACEHUB_API_TOKEN");

const model = process.env.HF_EMBED_MODEL || "BAAI/bge-base-en-v1.5";

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: token,
  model,
});

export async function embedText(text: string): Promise<number[]> {
  return embeddings.embedQuery(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return embeddings.embedDocuments(texts);
}