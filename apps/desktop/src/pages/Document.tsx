// src/pages/Document.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import JSZip from "jszip";
import DownloadButton from "../components/DownloadButton";
import DeleteButton from "../components/DeleteButton";
import DocumentEditor from "../components/editor/DocumentEditor";
import * as API from "../Api";
import SortIcon from "../components/SortIcon";

type DocRow = {
  id: string;
  title: string | null;
  file_path: string;
  mime_type?: string | null;
  created_at: string;
  project_id?: string | null;
  folder_id?: string | null;
};

type PreviewState = {
  doc: DocRow;
  url?: string;
  text?: string;
  kind: "document" | "image" | "pdf" | "text";
};

function inferMimeType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".txt")) return "text/plain";
  if (/\.(md|csv|json|log)$/i.test(name)) return "text/plain";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "";
}

function replaceExtension(name: string, extension: string) {
  const baseName = name.replace(/\.[^.]+$/, "") || "document";
  return `${baseName}.${extension}`;
}

function isAllowedDoc(name: string) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx") ||
    isTextFile(name) ||
    isImageFile(name)
  );
}

function isIngestableDoc(name: string) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx") ||
    isTextFile(name) ||
    isImageFile(name)
  );
}

function isPreviewableDoc(name: string) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    isTextFile(name) ||
    isImageFile(name)
  );
}

function isImageFile(name: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

function isTextFile(name: string) {
  return /\.(txt|md|csv|json|log)$/i.test(name);
}

async function convertImageToJpeg(file: File) {
  if (file.type === "image/jpeg" && /\.jpe?g$/i.test(file.name)) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Failed to convert image: ${file.name}`));
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image conversion is not available.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error(`Failed to convert image: ${file.name}`));
        },
        "image/jpeg",
        0.92
      );
    });

    return new File([blob], replaceExtension(file.name, "jpg"), {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeFileBeforeUpload(file: File) {
  if (isImageFile(file.name)) {
    return convertImageToJpeg(file);
  }

  if (isTextFile(file.name)) {
    const text = await file.text();
    return new File([text], replaceExtension(file.name, "txt"), {
      type: "text/plain",
    });
  }

  return file;
}

function previewKind(doc: DocRow): PreviewState["kind"] {
  const name = doc.title ?? doc.file_path;
  if ((doc.mime_type ?? "").startsWith("image/") || isImageFile(name)) {
    return "image";
  }
  if ((doc.mime_type ?? "") === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  if (
    (doc.mime_type ?? "") === "text/plain" ||
    isTextFile(name)
  ) {
    return "text";
  }
  return "document";
}

function isZip(name: string) {
  return name.toLowerCase().endsWith(".zip");
}

type DocumentProps = {
  onPreviewChange?: (previewing: boolean) => void;
};

export default function Document({ onPreviewChange }: DocumentProps = {}) {
  const { projectId } = useParams<{ projectId?: string }>();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState<DocRow | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<"title" | "created_at" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  function handleSort(field: "title" | "created_at") {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder("asc"); // first click -> ascending
    } else {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc")); // toggle
    }
  }

  function openDeleteModal(doc: DocRow) {
    setErr(null);
    setToDelete(doc);
    setConfirmOpen(true);
  }

  async function loadDocs() {
    setLoading(true);
    setErr(null);

    const { data, error } = await API.fetchDocuments(projectId);
    if (error) setErr(error.message);

    setDocs((data ?? []) as DocRow[]);
    setPreview((current) =>
      current && (data ?? []).some((doc: any) => doc.id === current.doc.id)
        ? current
        : null
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadDocs();
  }, [projectId]);

  useEffect(() => {
    onPreviewChange?.(Boolean(preview));
  }, [onPreviewChange, preview]);

  const filtered = useMemo(() => {
    let result = docs;

    const needle = q.trim().toLowerCase();
    if (needle) {
      result = result.filter((d) => (d.title ?? "").toLowerCase().includes(needle));
    }

    if (!sortField) return result;

    return [...result].sort((a, b) => {
      if (sortField === "title") {
        const A = (a.title ?? "").toLowerCase();
        const B = (b.title ?? "").toLowerCase();
        return sortOrder === "asc" ? A.localeCompare(B) : B.localeCompare(A);
      }

      // created_at
      const A = new Date(a.created_at).getTime();
      const B = new Date(b.created_at).getTime();
      return sortOrder === "asc" ? A - B : B - A;
    });
  }, [docs, q, sortField, sortOrder]);

  async function downloadDoc(doc: DocRow) {
    setErr(null);
    setNotice(null);
    setDownloadingId(doc.id);

    try {
      const { data, error } = await API.downloadExportedDocument(doc.id);

      if (error || !data?.blob) {
        setErr(error?.message ?? "Failed to download document.");
        return;
      }

      const filename = data.filename || doc.title || "document";

      const buffer = await data.blob.arrayBuffer();
      const savedPath = await invoke<string>("save_file_to_downloads", {
        filename,
        bytes: Array.from(new Uint8Array(buffer)),
      });
      setNotice(`Downloaded to ${savedPath}`);
      return;
    } catch (e) {
      const isTauri = Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
      if (isTauri) {
        setErr(e instanceof Error ? e.message : "Failed to save downloaded document.");
        return;
      }

      const { data } = await API.downloadExportedDocument(doc.id);
      if (!data?.blob) {
        setErr("Failed to download document.");
        return;
      }

      const filename = data.filename || doc.title || "document";
      const url = URL.createObjectURL(data.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId((current) => (current === doc.id ? null : current));
    }
  }

  async function openPreview(doc: DocRow) {
    setErr(null);
    setPreviewLoading(true);

    const kind = previewKind(doc);
    if (kind === "image" || kind === "pdf") {
      setPreview({ doc, kind });
      setEditing(true);
      setPreviewLoading(false);
      return;
    }

    if (kind === "text") {
      const { data, error } = await API.fetchDocumentTextPreview(doc.id);
      if (error || typeof data?.text !== "string") {
        setErr(error?.message ?? "Failed to create document preview.");
        setPreviewLoading(false);
        return;
      }

      setPreview({ doc, kind, text: data.text });
      setEditing(true);
      setPreviewLoading(false);
      return;
    }

    const { data, error } = await API.createDownloadUrl(doc.id);

    if (error || !data?.signedUrl) {
      setErr(error?.message ?? "Failed to create document preview link.");
      setPreviewLoading(false);
      return;
    }

    setPreview({
      doc,
      url: data.signedUrl,
      kind,
    });
    setEditing(false);
    setPreviewLoading(false);
  }

  async function handleEditorSaved() {
    setEditing(false);
    const currentDoc = preview?.doc;
    await loadDocs();
    if (currentDoc) {
      await openPreview(currentDoc);
    }
  }

  async function deleteDocConfirmed() {
    if (!toDelete) return;
    setDeleting(true);
    setErr(null);

    try {
      const rmDoc = await API.deleteDocumentRow(toDelete.id);
      if (rmDoc.error) throw new Error(rmDoc.error.message);

      setConfirmOpen(false);
      setToDelete(null);
      await loadDocs();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete document.");
    } finally {
      setDeleting(false);
    }
  }

  async function ingestOneFile(file: File) {
    // Guard: never allow zip to be uploaded/ingested as a document
    if (file.name.toLowerCase().endsWith(".zip")) {
      throw new Error("ZIP files cannot be uploaded as a document.");
    }

    if (!isAllowedDoc(file.name)) {
      throw new Error(
        `Unsupported file: ${file.name}. Upload PDF, DOC, DOCX, text, or image files.`
      );
    }

    const normalizedFile = await normalizeFileBeforeUpload(file);

    // Ensure mime type exists (important for backend extractor/converter)
    const mime = normalizedFile.type || inferMimeType(normalizedFile.name);
    const fixedFile = mime
      ? new File([normalizedFile], normalizedFile.name, { type: mime })
      : normalizedFile;

    const upload = await API.uploadDocumentFile({
      file: fixedFile,
      projectId: projectId ?? null,
      title: fixedFile.name,
      mimeType: fixedFile.type || null,
    });

    if (upload.error || !upload.data?.id) {
      throw new Error(upload.error?.message ?? "Failed to upload document.");
    }

    if (isIngestableDoc(fixedFile.name)) {
      await API.callIngest(upload.data.id, projectId);
    }
  }

  async function onUpload(file: File) {
    setUploading(true);
    setErr(null);
    setNotice(null);

    try {
      // --------------------------
      // CASE 1: ZIP upload (extract-only)
      // --------------------------
      if (isZip(file.name)) {
        const buf = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);

        const entries = Object.values(zip.files).filter((f) => {
          if (f.dir) return false;

          const name = f.name.split("/").pop() || "";

          // Ignore macOS metadata
          if (f.name.startsWith("__MACOSX/")) return false;

          // Ignore hidden files
          if (name.startsWith(".")) return false;

          // Ignore temp office files
          if (name.startsWith("~$")) return false;

          return isAllowedDoc(name);
        });

        const valid = entries.filter((f) => isAllowedDoc(f.name));
        if (valid.length === 0) {
          throw new Error(
            "ZIP file contains no valid documents (PDF/DOC/DOCX/TXT/images)."
          );
        }

        // Upload extracted docs one-by-one
        for (const entry of valid) {
          const blob = await entry.async("blob");

          // Preserve original filename but remove folders if any
          const baseName = entry.name.split("/").pop() || entry.name;

          const extracted = new File([blob], baseName, {
            type: inferMimeType(baseName) || "application/octet-stream",
          });

          await ingestOneFile(extracted);
        }

        setOpen(false);
        await loadDocs();
        return;
      }

      // --------------------------
      // CASE 2: Single file upload
      // --------------------------
      if (!isAllowedDoc(file.name)) {
        throw new Error(
            "Only PDF, DOC, DOCX, text, image, or ZIP files are allowed."
        );
      }

      await ingestOneFile(file);

      setOpen(false);
      await loadDocs();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full">
      {/* Errors */}
      {err && (
        <div className="mx-8 mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {notice && (
        <div className="mx-8 mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {preview && (
        <div
          className="relative flex min-h-[420px] flex-col border-y border-slate-200 bg-white"
          style={{ height: "100vh" }}
        >
          {editing ? (
            <DocumentEditor
              document={preview.doc}
              initialText={preview.text}
              onCancel={() => {
                if (preview.kind === "image" || preview.kind === "pdf" || preview.kind === "text") {
                  setEditing(false);
                  setPreview(null);
                  return;
                }
                setEditing(false);
              }}
              onSaved={(_, options) => {
                if (preview.kind === "text") {
                  if (options?.closeAfterSave) {
                    setEditing(false);
                    setPreview(null);
                  }
                  void loadDocs();
                  return;
                }
                void loadDocs();
              }}
            />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {preview.doc.title ?? "Untitled"}
                  </div>
                  <div className="text-xs text-slate-500">Document preview</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setPreview(null);
                  }}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50">
                {preview.kind === "text" ? (
                  <pre className="h-full w-full overflow-auto whitespace-pre-wrap bg-white p-5 text-sm leading-6 text-slate-800">
                    {preview.text || "No preview text available."}
                  </pre>
                ) : preview.kind === "image" && preview.url ? (
                  <img
                    src={preview.url}
                    alt={preview.doc.title ?? "Document preview"}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : preview.url ? (
                  <iframe
                    title={preview.doc.title ?? "Document preview"}
                    src={preview.url}
                    className="h-full w-full border-0 bg-white"
                  />
                ) : (
                  <div className="text-sm text-slate-500">Preview unavailable.</div>
                )}
              </div>
            </>
          )}

        </div>
      )}

      {previewLoading && (
        <div className="mx-8 mt-4 text-sm text-slate-500">Loading preview...</div>
      )}

      {!preview && (
        <>
          {/* Top row: search + upload button */}
          <div className="flex items-center gap-4 px-8">
            <div className="flex-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  projectId ? "Search project documents..." : "Search files here..."
                }
                className="w-full h-10 rounded-full bg-indigo-100/60 px-5 text-sm text-slate-700 placeholder:text-slate-400
                           border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => setOpen(true)}
              className="h-10 px-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold transition"
            >
              Upload Document
            </button>
          </div>

          {/* Table */}
          <div className="mt-6 border-y border-slate-200 bg-white">
        {/* Header */}
          <div className="grid grid-cols-12 px-6 py-3 text-sm font-semibold text-slate-600 border-b border-slate-200">
            <div
              className="col-span-6 text-center cursor-pointer select-none flex items-center justify-center"
              onClick={() => handleSort("title")}
            >
              Document Name
              <SortIcon
                active={sortField === "title"}
                direction={sortOrder}
              />
            </div>

            <div
              className="col-span-3 text-center cursor-pointer select-none flex items-center justify-center"
              onClick={() => handleSort("created_at")}
            >
              Uploaded Date
              <SortIcon
                active={sortField === "created_at"}
                direction={sortOrder}
              />
            </div>

            <div className="col-span-3 text-center">Action</div>
          </div>

        {/* Scroll area */}
        <div className="max-h-[520px] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-sm text-slate-600">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No documents found.</div>
          ) : (
            filtered.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-12 px-6 py-4 border-b border-slate-100 items-center"
              >
                <div className="col-span-6 text-slate-700 text-sm">
                  {isPreviewableDoc(d.title ?? d.file_path) ? (
                    <button
                      type="button"
                      onClick={() => void openPreview(d)}
                      className="text-left font-medium text-blue-700 underline-offset-4 hover:underline"
                    >
                      {d.title ?? "Untitled"}
                    </button>
                  ) : (
                    d.title ?? "Untitled"
                  )}
                </div>

                <div className="col-span-3 text-center text-sm text-slate-600">
                  {new Date(d.created_at).toLocaleString()}
                </div>

                <div className="col-span-3 flex justify-center gap-3">
                  <DownloadButton
                    onClick={() => void downloadDoc(d)}
                    disabled={downloadingId === d.id}
                  />
                  <DeleteButton onClick={() => openDeleteModal(d)} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
        </>
      )}

      {/* Upload Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => (uploading ? null : setOpen(false))}
          />

          {/* card */}
          <div className="relative w-full max-w-lg rounded-lg bg-white shadow-xl border border-slate-200 p-6">
            <div className="flex items-center">
              <h2 className="text-lg font-extrabold text-slate-800">Upload document</h2>
              <button
                className="ml-auto text-slate-400 hover:text-slate-600"
                onClick={() => (uploading ? null : setOpen(false))}
              >
                ✕
              </button>
            </div>

            <div className="mt-5">
              <label className="block">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.log,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.zip"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void onUpload(f);
                    e.currentTarget.value = "";
                  }}
                  className="block w-full text-sm text-slate-600
                             file:mr-4 file:rounded-md file:border-0
                             file:bg-indigo-600 file:px-4 file:py-2
                             file:text-sm file:font-semibold file:text-white
                             hover:file:bg-indigo-700"
                />
              </label>
            </div>

            {uploading && <div className="mt-4 text-sm text-slate-600">Uploading…</div>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={uploading}
                className="px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmOpen && toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => (deleting ? null : setConfirmOpen(false))}
          />

          {/* card */}
          <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl border border-slate-200 p-6">
            <div className="flex items-center">
              <h2 className="text-lg font-extrabold text-slate-800">Delete document?</h2>
              <button
                className="ml-auto text-slate-400 hover:text-slate-600"
                onClick={() => (deleting ? null : setConfirmOpen(false))}
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              This will permanently delete{" "}
              <span className="font-semibold text-slate-800">
                {toDelete.title ?? "Untitled"}
              </span>
              , including all extracted chunks created from it.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                onClick={() => void deleteDocConfirmed()}
                disabled={deleting}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm font-semibold disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
