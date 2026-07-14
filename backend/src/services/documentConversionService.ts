import { extractTextFromFile } from "../rag/extract.js";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const PDF_MIME = "application/pdf";
const TXT_MIME = "text/plain";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const execFileAsync = promisify(execFile);
const LIBREOFFICE_BIN_CANDIDATES = [
  process.env.LIBREOFFICE_BIN,
  "soffice",
  "libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
].filter((value): value is string => Boolean(value));

type NormalizedDocumentUpload = {
  body: Buffer;
  title: string;
  mimeType: string | null;
};

function replaceExtension(title: string, extension: string) {
  const cleanTitle = title.trim() || `document.${extension}`;
  const withoutExtension = cleanTitle.replace(/\.[^.]+$/, "");
  return `${withoutExtension}.${extension}`;
}

function safeInputName(title: string) {
  const name = basename(title || "document.docx").replace(/[^a-zA-Z0-9._-]+/g, "_");
  return name || "document.docx";
}

async function convertOfficeDocumentToPdf(params: {
  body: Buffer;
  title: string;
}) {
  const workdir = await mkdtemp(join(tmpdir(), "cortexdocs-office-"));
  try {
    const inputName = safeInputName(params.title);
    const inputPath = join(workdir, inputName);
    const profileDir = join(workdir, "lo-profile");
    await writeFile(inputPath, params.body);

    const args = [
        "--headless",
        "--nologo",
        "--nodefault",
        "--nolockcheck",
        "--nofirststartwizard",
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        "--convert-to",
        "pdf:writer_pdf_Export",
        "--outdir",
        workdir,
        inputPath,
      ];
    let lastError: any = null;
    let lastStdout = "";
    let lastStderr = "";

    const failures: string[] = [];
    for (const binary of LIBREOFFICE_BIN_CANDIDATES) {
      try {
        const result = await execFileAsync(binary, args, {
          timeout: 60_000,
          cwd: workdir,
          env: {
            ...process.env,
            HOME: workdir,
            SAL_USE_VCLPLUGIN: "svp",
          },
        });
        lastStdout = result.stdout;
        lastStderr = result.stderr;
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
        lastStdout = error?.stdout ?? "";
        lastStderr = error?.stderr ?? "";
        failures.push(`${binary}: ${error?.code ?? "ERR"} ${error?.message ?? ""}`.trim());
        if (error?.code !== "ENOENT") continue;
      }
    }

    if (lastError) {
      const detail = failures.length > 0 ? ` ${failures.join(" | ")}` : "";
      throw new Error(`LibreOffice conversion failed.${detail}`);
    }

    const outputName = replaceExtension(inputName, "pdf");
    const files = await readdir(workdir);
    const pdfName =
      files.find((file) => file === outputName) ??
      files.find((file) => file.toLowerCase().endsWith(".pdf"));
    if (!pdfName) {
      throw new Error(
        `LibreOffice did not create a PDF output. stdout: ${lastStdout || "(empty)"} stderr: ${lastStderr || "(empty)"}`
      );
    }

    return await readFile(join(workdir, pdfName));
  } catch (error: any) {
    const message = error?.code === "ENOENT" && error?.syscall === "spawn"
      ? `LibreOffice is not installed in the backend environment. Tried: ${LIBREOFFICE_BIN_CANDIDATES.join(", ")}.`
      : error?.message ?? "Office document conversion failed.";
    throw new Error(`${message} Install LibreOffice so DOC/DOCX uploads can preserve formatting.`);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function normalizeDocumentUpload(params: {
  body: Buffer;
  title: string;
  mimeType: string | null;
}): Promise<NormalizedDocumentUpload> {
  const title = params.title.trim();
  const mimeType = params.mimeType;
  const lowerTitle = title.toLowerCase();

  if (mimeType === PDF_MIME || lowerTitle.endsWith(".pdf")) {
    return {
      body: params.body,
      title: replaceExtension(title, "pdf"),
      mimeType: PDF_MIME,
    };
  }

  if (mimeType === DOCX_MIME || mimeType === DOC_MIME || /\.(docx?|rtf)$/i.test(title)) {
    return {
      body: await convertOfficeDocumentToPdf({
        body: params.body,
        title,
      }),
      title: replaceExtension(title, "pdf"),
      mimeType: PDF_MIME,
    };
  }

  if ((mimeType && mimeType.startsWith("text/")) || /\.(txt|md|csv|json|log)$/i.test(title)) {
    return {
      body: Buffer.from(params.body.toString("utf8"), "utf8"),
      title: replaceExtension(title, "txt"),
      mimeType: TXT_MIME,
    };
  }

  return {
    body: params.body,
    title,
    mimeType,
  };
}
