import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import type { ModelConfig } from "../../modules/model-config/model-config.types.js";
import type { EmbeddingProvider } from "./embedding.provider.js";

export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  private readonly embeddings: HuggingFaceInferenceEmbeddings;

  constructor(config: ModelConfig) {
    const token = process.env.EMBED_MODEL_API_TOKEN;
    if (!token) throw new Error("Missing EMBED_MODEL_API_TOKEN");

    this.embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: token,
      model: config.model,
    });
  }

  embedText(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  embedBatch(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }
}
