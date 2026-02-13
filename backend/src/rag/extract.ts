import mammoth from "mammoth";

export async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    // Works whether pdf-parse exports as default or module itself
    const mod: any = await import("pdf-parse");
    const pdfParse = mod.default ?? mod; // pick callable export
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  throw new Error(`Unsupported mime type: ${mimeType}`);
}