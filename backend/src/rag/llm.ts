import { createLlmProvider } from "./llm/llm.factory.js";

export async function answerWithSources(
  question: string,
  sources: string[],
  modelId?: string
) {
  const provider = createLlmProvider(modelId);
  return provider.answerWithSources({ question, sources });
}
