import type { ModelConfig } from "../../modules/model-config/model-config.types.js";
import {
  buildSourceBoundMessages,
  LLM_TEMPERATURE,
  type LlmAnswerInput,
  type LlmProvider,
} from "./llm.provider.js";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: unknown;
};

export class GroqProvider implements LlmProvider {
  constructor(private readonly config: ModelConfig) {}

  async answerWithSources(input: LlmAnswerInput): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Missing GROQ_API_KEY in backend/.env");

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: buildSourceBoundMessages(input.question, input.sources),
        temperature: LLM_TEMPERATURE,
      }),
    });

    const json = (await resp.json().catch(() => null)) as
      | ChatCompletionResponse
      | null;

    if (!resp.ok) {
      const msg =
        (typeof (json as any)?.error?.message === "string" &&
          (json as any).error.message) ||
        JSON.stringify((json as any)?.error ?? json) ||
        `HTTP ${resp.status}`;
      throw new Error(`Groq LLM error: ${msg}`);
    }

    return json?.choices?.[0]?.message?.content?.trim() ?? "";
  }
}
