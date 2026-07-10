import {
  DEFAULT_EMBEDDING_MODEL_ID,
  DEFAULT_LLM_MODEL_ID,
  MODEL_REGISTRY,
} from "./model-registry.js";
import type {
  ModelCapability,
  ModelConfig,
  ModelConfigResponse,
} from "./model-config.types.js";

export function listModelConfig(): ModelConfigResponse {
  return {
    defaults: {
      llmModelId: DEFAULT_LLM_MODEL_ID,
      embeddingModelId: DEFAULT_EMBEDDING_MODEL_ID,
    },
    llm: MODEL_REGISTRY.filter((model) => model.capability === "llm"),
    embedding: MODEL_REGISTRY.filter((model) => model.capability === "embedding"),
  };
}

export function getModelConfig(
  modelId: string | undefined,
  capability: ModelCapability
): ModelConfig {
  const fallbackId =
    capability === "llm" ? DEFAULT_LLM_MODEL_ID : DEFAULT_EMBEDDING_MODEL_ID;
  const resolvedId = modelId || fallbackId;
  const config = MODEL_REGISTRY.find(
    (model) => model.id === resolvedId && model.capability === capability
  );

  if (!config) {
    throw new Error(`Unknown ${capability} model: ${resolvedId}`);
  }

  if (!config.enabled) {
    throw new Error(
      `${config.label} is not configured. Add the required API key or base URL.`
    );
  }

  return config;
}
