import type { ModelConfig } from "../../modules/model-config/model-config.types.js";
import {
  buildSourceBoundMessages,
  LLM_TEMPERATURE,
  type LlmAnswerInput,
  type LlmProvider,
} from "./llm.provider.js";

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
};

export class AnthropicProvider implements LlmProvider {
  constructor(private readonly config: ModelConfig) {}

  async answerWithSources(input: LlmAnswerInput): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY in backend/.env");

    const messages = buildSourceBoundMessages(input.question, input.sources);
    const system = messages[0]?.content ?? "";
    const user = messages[1]?.content ?? input.question;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 800,
        temperature: LLM_TEMPERATURE,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    const json = (await resp.json().catch(() => null)) as
      | AnthropicResponse
      | null;

    if (!resp.ok) {
      throw new Error(
        `Anthropic LLM error: ${json?.error?.message ?? `HTTP ${resp.status}`}`
      );
    }

    return (
      json?.content
        ?.filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("")
        .trim() ?? ""
    );
  }
}
