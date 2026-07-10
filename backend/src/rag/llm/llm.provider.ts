export type LlmAnswerInput = {
  question: string;
  sources: string[];
};

export interface LlmProvider {
  answerWithSources(input: LlmAnswerInput): Promise<string>;
}

const parsedTemperature = Number(process.env.LLM_TEMPERATURE ?? 1);

export const LLM_TEMPERATURE = Number.isFinite(parsedTemperature)
  ? parsedTemperature
  : 1;

export function buildSourceBoundMessages(question: string, sources: string[]) {
  const context = sources
    .map((source) => source)
    .join("\n\n")
    .slice(0, 2000);

  return [
    {
      role: "system",
      content: `
        You are an internal business assistant.

        Provide a thoughtful, in-depth answer based on the provided sources.
        Explain the key points, relevant context, implications, and any important
        relationships between facts in the documents.

        Use clear structure when it improves readability. You may use short
        paragraphs, bullet points, and concise headings.

        Stay grounded in the provided sources. Do not invent facts, numbers,
        names, dates, or conclusions that are not supported by the sources.

        If the sources only partially answer the question, explain what can be
        answered and what remains unclear.

        If the answer is not found in the sources, say:
        "I cannot find this information in the uploaded documents."
      `.trim(),
    },
    {
      role: "user",
      content: `Question: ${question}\n\nSources:\n${context}`,
    },
  ];
}
