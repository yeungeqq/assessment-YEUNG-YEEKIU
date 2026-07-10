import type { EmbeddingProvider } from "./embedding.provider.js";

export class LocalEmbeddingProvider implements EmbeddingProvider {
  async embedText(_text: string): Promise<number[]> {
    throw new Error("Local embedding provider is not configured yet.");
  }

  async embedBatch(_texts: string[]): Promise<number[][]> {
    throw new Error("Local embedding provider is not configured yet.");
  }
}
