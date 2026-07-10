import { createEmbeddingProvider } from "./embeddings/embedding.factory.js";

export async function embedText(
  text: string,
  modelId?: string
): Promise<number[]> {
  return createEmbeddingProvider(modelId).embedText(text);
}

export async function embedBatch(
  texts: string[],
  modelId?: string
): Promise<number[][]> {
  return createEmbeddingProvider(modelId).embedBatch(texts);
}
