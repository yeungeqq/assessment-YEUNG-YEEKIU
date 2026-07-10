import { getModelConfig } from "../../modules/model-config/model-config.service.js";
import type { EmbeddingProvider } from "./embedding.provider.js";
import { HuggingFaceEmbeddingProvider } from "./huggingface.provider.js";
import { LocalEmbeddingProvider } from "./local.embedding.js";
import { OpenAiEmbeddingProvider } from "./openai.embedding.js";

export function createEmbeddingProvider(modelId?: string): EmbeddingProvider {
  const config = getModelConfig(modelId, "embedding");

  switch (config.provider) {
    case "huggingface":
      return new HuggingFaceEmbeddingProvider(config);
    case "local":
      return new LocalEmbeddingProvider();
    case "openai":
      return new OpenAiEmbeddingProvider(config);
    default:
      throw new Error(`Unsupported embedding provider: ${config.provider}`);
  }
}
