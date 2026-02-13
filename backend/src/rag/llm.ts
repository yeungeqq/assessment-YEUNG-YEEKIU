type ChatCompletionResponse = {
    choices?: Array<{ message?: { content?: string } }>;
    error?: any;
  };
  
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY in backend/.env");
  
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  
  export async function answerWithSources(question: string, sources: string[]) {
    const context = sources
      .map((s, i) => `Source [S${i + 1}]: ${s}`)
      .join("\n\n")
      .slice(0, 6000);
  
    const body = {
      model,
      messages: [
        {
          role: "system",
          content:
            "Answer using ONLY the provided sources. If insufficient, say so.",
        },
        { role: "user", content: `Question: ${question}\n\nSources:\n${context}` },
      ],
      temperature: 0.2,
      max_tokens: 350,
    };
  
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  
    const json = (await resp.json().catch(() => null)) as ChatCompletionResponse | null;
  
    if (!resp.ok) {
      const msg =
        (typeof (json as any)?.error?.message === "string" && (json as any).error.message) ||
        JSON.stringify((json as any)?.error ?? json) ||
        `HTTP ${resp.status}`;
      throw new Error(`Groq LLM error: ${msg}`);
    }
  
    return json?.choices?.[0]?.message?.content ?? "";
  }