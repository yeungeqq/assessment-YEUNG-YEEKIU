import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    const loadingTask = (pdfjsLib as any).getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
    });

    const pdf = await loadingTask.promise;

    let out = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const strings = content.items
        .map((it: any) => (typeof it.str === "string" ? it.str : ""))
        .filter(Boolean);

      out += strings.join(" ") + "\n";
    }

    return out.trim();
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || "").trim();
  }

  throw new Error(`Unsupported mime type: ${mimeType}`);
}