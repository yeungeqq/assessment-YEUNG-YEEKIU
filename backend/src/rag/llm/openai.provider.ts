import OpenAI from "openai";
import type { ModelConfig } from "../../modules/model-config/model-config.types.js";
import {
  buildSourceBoundMessages,
  LLM_TEMPERATURE,
  type LlmAnswerInput,
  type LlmProvider,
} from "./llm.provider.js";

export class OpenAiProvider implements LlmProvider {
  constructor(private readonly config: ModelConfig) {}

  async answerWithSources(input: LlmAnswerInput): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY in backend/.env");

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: this.config.model,
      messages: buildSourceBoundMessages(input.question, input.sources) as any,
      temperature: LLM_TEMPERATURE,
    });

    return response.choices[0]?.message?.content?.trim() ?? "";
  }
}
