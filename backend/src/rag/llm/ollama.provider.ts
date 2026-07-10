import type { ModelConfig } from "../../modules/model-config/model-config.types.js";
import {
  buildSourceBoundMessages,
  LLM_TEMPERATURE,
  type LlmAnswerInput,
  type LlmProvider,
} from "./llm.provider.js";

type OllamaResponse = {
  message?: { content?: string };
  error?: string;
};

export class OllamaProvider implements LlmProvider {
  constructor(private readonly config: ModelConfig) {}

  async answerWithSources(input: LlmAnswerInput): Promise<string> {
    const baseUrl = this.config.baseUrl || "http://localhost:11434";
    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        messages: buildSourceBoundMessages(input.question, input.sources),
        stream: false,
        options: { temperature: LLM_TEMPERATURE },
      }),
    });

    const json = (await resp.json().catch(() => null)) as OllamaResponse | null;

    if (!resp.ok) {
      throw new Error(
        `Ollama LLM error: ${json?.error ?? `HTTP ${resp.status}`}`
      );
    }

    return json?.message?.content?.trim() ?? "";
  }
}
