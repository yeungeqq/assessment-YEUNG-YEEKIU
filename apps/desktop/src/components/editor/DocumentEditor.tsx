import DocxEditor from "./DocxEditor";
import ImageEditor from "./ImageEditor";
import PdfEditor from "./PdfEditor";
import TextEditor from "./TextEditor";
import type { DocumentEditorProps } from "./editor.types";

function isImage(document: DocumentEditorProps["document"]) {
  const name = document.title ?? document.file_path;
  return (document.mime_type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

function isPdf(document: DocumentEditorProps["document"]) {
  return document.mime_type === "application/pdf" || (document.title ?? "").toLowerCase().endsWith(".pdf");
}

function isDocx(document: DocumentEditorProps["document"]) {
  const name = (document.title ?? "").toLowerCase();
  return (
    document.mime_type === "application/msword" ||
    document.mime_type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  );
}

export default function DocumentEditor(props: DocumentEditorProps) {
  if (props.document.mime_type === "text/plain") {
    return <TextEditor {...props} />;
  }

  if (isPdf(props.document)) {
    return <PdfEditor {...props} />;
  }

  if (isImage(props.document)) {
    return <ImageEditor {...props} />;
  }

  if (isDocx(props.document)) {
    return <DocxEditor {...props} />;
  }

  return <TextEditor {...props} />;
}
