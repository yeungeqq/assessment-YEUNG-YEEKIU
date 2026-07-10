import type { ModelConfig } from "./model-config.types.js";

export const DEFAULT_LLM_MODEL_ID =
  process.env.DEFAULT_LLM_MODEL_ID || "groq:llama-3.1-8b-instant";

export const DEFAULT_EMBEDDING_MODEL_ID =
  process.env.DEFAULT_EMBEDDING_MODEL_ID ||
  "huggingface:BAAI/bge-base-en-v1.5";

function modelNameFromId(modelId: string) {
  return modelId.split(":").slice(1).join(":");
}

function modelNameFromIdForProvider(
  modelId: string,
  provider: string,
  fallback: string
) {
  return modelId.startsWith(`${provider}:`) ? modelNameFromId(modelId) : fallback;
}

const DEFAULT_GROQ_MODEL = modelNameFromIdForProvider(
  DEFAULT_LLM_MODEL_ID,
  "groq",
  "llama-3.1-8b-instant"
);
const DEFAULT_HUGGINGFACE_MODEL = modelNameFromIdForProvider(
  DEFAULT_EMBEDDING_MODEL_ID,
  "huggingface",
  "BAAI/bge-base-en-v1.5"
);

export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: `groq:${DEFAULT_GROQ_MODEL}`,
    provider: "groq",
    label: `Groq ${DEFAULT_GROQ_MODEL}`,
    model: DEFAULT_GROQ_MODEL,
    capability: "llm",
    enabled: Boolean(process.env.GROQ_API_KEY),
  },
  {
    id: "openai:gpt-4.1-mini",
    provider: "openai",
    label: "OpenAI GPT-4.1 mini",
    model: "gpt-4.1-mini",
    capability: "llm",
    enabled: Boolean(process.env.OPENAI_API_KEY),
  },
  {
    id: "anthropic:claude-3-5-haiku-latest",
    provider: "anthropic",
    label: "Anthropic Claude 3.5 Haiku",
    model: "claude-3-5-haiku-latest",
    capability: "llm",
    enabled: Boolean(process.env.ANTHROPIC_API_KEY),
  },
  {
    id: "ollama:llama3.1",
    provider: "ollama",
    label: "Ollama Llama 3.1",
    model: process.env.OLLAMA_MODEL || "llama3.1",
    capability: "llm",
    enabled: Boolean(process.env.OLLAMA_BASE_URL),
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  },
  {
    id: `huggingface:${DEFAULT_HUGGINGFACE_MODEL}`,
    provider: "huggingface",
    label: `Hugging Face ${DEFAULT_HUGGINGFACE_MODEL}`,
    model: DEFAULT_HUGGINGFACE_MODEL,
    capability: "embedding",
    enabled: Boolean(process.env.EMBED_MODEL_API_TOKEN),
    dimensions: Number(process.env.EMBED_MODEL_DIMENSIONS || 768),
  },
  {
    id: "openai:text-embedding-3-small",
    provider: "openai",
    label: "OpenAI text-embedding-3-small",
    model: "text-embedding-3-small",
    capability: "embedding",
    enabled: Boolean(process.env.OPENAI_API_KEY),
    dimensions: 1536,
  },
  {
    id: "local:default",
    provider: "local",
    label: "Local embedding model",
    model: "default",
    capability: "embedding",
    enabled: process.env.LOCAL_EMBEDDING_ENABLED === "true",
  },
];
