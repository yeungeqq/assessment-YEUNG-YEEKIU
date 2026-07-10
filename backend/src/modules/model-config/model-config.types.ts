export type ModelProvider =
  | "anthropic"
  | "groq"
  | "huggingface"
  | "local"
  | "ollama"
  | "openai";

export type ModelCapability = "llm" | "embedding";

export type ModelConfig = {
  id: string;
  provider: ModelProvider;
  label: string;
  model: string;
  capability: ModelCapability;
  enabled: boolean;
  dimensions?: number;
  baseUrl?: string;
};

export type ModelConfigResponse = {
  defaults: {
    llmModelId: string;
    embeddingModelId: string;
  };
  llm: ModelConfig[];
  embedding: ModelConfig[];
};
