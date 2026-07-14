import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { describeImageBuffer } from "./vision.js";

function htmlToText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType.startsWith("image/")) {
    return describeImageBuffer(buffer, mimeType);
  }

  if (mimeType === "text/plain") {
    return buffer.toString("utf8").trim();
  }

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
    try {
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || "").trim();
    } catch (error) {
      if (mimeType !== "application/msword") throw error;
      return htmlToText(buffer.toString("utf8"));
    }
  }

  throw new Error(`Unsupported mime type: ${mimeType}`);
}
