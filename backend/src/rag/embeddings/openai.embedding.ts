import OpenAI from "openai";
import type { ModelConfig } from "../../modules/model-config/model-config.types.js";
import type { EmbeddingProvider } from "./embedding.provider.js";

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private readonly client: OpenAI;

  constructor(private readonly config: ModelConfig) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY in backend/.env");
    this.client = new OpenAI({ apiKey });
  }

  async embedText(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.config.model,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  }
}
