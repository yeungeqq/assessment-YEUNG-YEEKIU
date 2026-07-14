import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { downloadObjectBuffer } from "./storageService.js";

type Point = { x: number; y: number };
type StrokeAnnotation = {
  type: "stroke";
  page?: number;
  pageWidth?: number;
  pageHeight?: number;
  points?: Point[];
  color?: string;
  size?: number;
};
type HighlightAnnotation = {
  type: "highlight";
  page?: number;
  pageWidth?: number;
  pageHeight?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
};
type TextAnnotation = {
  type: "text";
  page?: number;
  x?: number;
  y?: number;
  text?: string;
  color?: string;
  fontSize?: number;
  pageWidth?: number;
  pageHeight?: number;
};
type Annotation = StrokeAnnotation | HighlightAnnotation | TextAnnotation;

type ExportedDocument = {
  body: Buffer;
  contentType: string;
  filename: string;
};

function replaceExtension(title: string | null | undefined, extension: string) {
  const cleanTitle = title?.trim() || `document.${extension}`;
  return `${cleanTitle.replace(/\.[^.]+$/, "")}.${extension}`;
}

function hexToRgb(color: string | undefined, fallback = "#111827") {
  const raw = (color ?? fallback).replace("#", "");
  const full = raw.length === 3
    ? raw.split("").map((part) => `${part}${part}`).join("")
    : raw;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return rgb(0.07, 0.09, 0.15);
  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  );
}

function scaleAnnotationPoint(
  annotation: { x?: number; y?: number; pageWidth?: number; pageHeight?: number },
  pageWidth: number,
  pageHeight: number
) {
  const sourceWidth = annotation.pageWidth && annotation.pageWidth > 0 ? annotation.pageWidth : pageWidth;
  const sourceHeight = annotation.pageHeight && annotation.pageHeight > 0 ? annotation.pageHeight : pageHeight;
  const x = ((annotation.x ?? 0) / sourceWidth) * pageWidth;
  const yFromTop = ((annotation.y ?? 0) / sourceHeight) * pageHeight;
  return { x, y: pageHeight - yFromTop };
}

function annotationPageIndex(annotation: Annotation) {
  const page = typeof annotation.page === "number" && Number.isFinite(annotation.page)
    ? annotation.page
    : 1;
  return Math.max(0, Math.floor(page) - 1);
}

function isAnnotation(value: unknown): value is Annotation {
  return Boolean(value && typeof value === "object" && "type" in value);
}

function hasSavedAnnotations(annotations: unknown[]) {
  return annotations.some(isAnnotation);
}

async function exportPdfWithAnnotations(params: {
  file: Buffer;
  title: string | null;
  annotations: unknown[];
}): Promise<ExportedDocument> {
  const pdf = await PDFDocument.load(params.file);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  params.annotations.filter(isAnnotation).forEach((annotation) => {
    const page = pages[annotationPageIndex(annotation)];
    if (!page) return;
    const { width: pageWidth, height: pageHeight } = page.getSize();

    if (annotation.type === "text") {
      const text = typeof annotation.text === "string" ? annotation.text.trim() : "";
      if (!text) return;
      const fontSize = annotation.fontSize ?? 14;
      const point = scaleAnnotationPoint(annotation, pageWidth, pageHeight);
      page.drawRectangle({
        x: point.x - 4,
        y: point.y - fontSize - 4,
        width: Math.max(font.widthOfTextAtSize(text, fontSize) + 8, 48),
        height: fontSize + 8,
        color: rgb(1, 1, 1),
        opacity: 0.9,
        borderColor: rgb(0.39, 0.45, 0.55),
        borderWidth: 0.5,
      });
      page.drawText(text, {
        x: point.x,
        y: point.y - fontSize,
        size: fontSize,
        font,
        color: hexToRgb(annotation.color),
      });
      return;
    }

    if (annotation.type === "highlight") {
      const point = scaleAnnotationPoint(annotation, pageWidth, pageHeight);
      const sourceWidth = annotation.pageWidth && annotation.pageWidth > 0 ? annotation.pageWidth : pageWidth;
      const sourceHeight = annotation.pageHeight && annotation.pageHeight > 0 ? annotation.pageHeight : pageHeight;
      const width = ((annotation.width ?? 0) / sourceWidth) * pageWidth;
      const height = ((annotation.height ?? 0) / sourceHeight) * pageHeight;
      if (width <= 0 || height <= 0) return;
      page.drawRectangle({
        x: point.x,
        y: point.y - height,
        width,
        height,
        color: hexToRgb(annotation.color, "#fde047"),
        opacity: 0.35,
      });
      return;
    }

    if (annotation.type === "stroke" && Array.isArray(annotation.points)) {
      const sourceWidth = annotation.pageWidth && annotation.pageWidth > 0 ? annotation.pageWidth : pageWidth;
      const sourceHeight = annotation.pageHeight && annotation.pageHeight > 0 ? annotation.pageHeight : pageHeight;
      const points = annotation.points;
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        page.drawLine({
          start: {
            x: (start.x / sourceWidth) * pageWidth,
            y: pageHeight - (start.y / sourceHeight) * pageHeight,
          },
          end: {
            x: (end.x / sourceWidth) * pageWidth,
            y: pageHeight - (end.y / sourceHeight) * pageHeight,
          },
          thickness: ((annotation.size ?? 2) / sourceWidth) * pageWidth,
          color: hexToRgb(annotation.color),
          opacity: 0.95,
        });
      }
    }
  });

  return {
    body: Buffer.from(await pdf.save()),
    contentType: "application/pdf",
    filename: replaceExtension(params.title, "pdf"),
  };
}

async function exportImageAsPdf(params: {
  file: Buffer;
  mimeType: string;
  title: string | null;
  annotations: unknown[];
}): Promise<ExportedDocument> {
  const pdf = await PDFDocument.create();
  const image = params.mimeType === "image/png"
    ? await pdf.embedPng(params.file)
    : await pdf.embedJpg(params.file);
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  const file = await exportPdfWithAnnotations({
    file: Buffer.from(await pdf.save()),
    title: params.title,
    annotations: params.annotations,
  });

  return {
    ...file,
    filename: replaceExtension(params.title, "pdf"),
  };
}

export async function exportDocumentWithChanges(params: {
  filePath: string;
  title: string | null;
  mimeType: string | null;
  annotations: unknown[];
}): Promise<ExportedDocument> {
  const file = await downloadObjectBuffer(params.filePath);
  const mimeType = params.mimeType ?? "application/octet-stream";

  if (mimeType === "application/pdf") {
    return exportPdfWithAnnotations({
      file,
      title: params.title,
      annotations: params.annotations,
    });
  }

  if ((mimeType === "image/jpeg" || mimeType === "image/png") && hasSavedAnnotations(params.annotations)) {
    return exportImageAsPdf({
      file,
      mimeType,
      title: params.title,
      annotations: params.annotations,
    });
  }

  return {
    body: file,
    contentType: mimeType,
    filename: params.title ?? "document",
  };
}
