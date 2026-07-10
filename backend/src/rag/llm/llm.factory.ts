import { getModelConfig } from "../../modules/model-config/model-config.service.js";
import type { LlmProvider } from "./llm.provider.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { GroqProvider } from "./groq.provider.js";
import { OllamaProvider } from "./ollama.provider.js";
import { OpenAiProvider } from "./openai.provider.js";

export function createLlmProvider(modelId?: string): LlmProvider {
  const config = getModelConfig(modelId, "llm");

  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "groq":
      return new GroqProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "openai":
      return new OpenAiProvider(config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
