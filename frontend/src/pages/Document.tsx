// src/pages/Document.tsx
import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import DownloadButton from "../components/DownloadButton";
import DeleteButton from "../components/DeleteButton";
import * as API from "../Api";
import SortIcon from "../components/SortIcon";

type DocRow = {
  id: string;
  title: string | null;
  file_path: string;
  created_at: string;
};

function inferMimeType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  return "";
}

function isAllowedDoc(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx");
}

function isZip(name: string) {
  return name.toLowerCase().endsWith(".zip");
}

export default function Document() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  function renderSortIcon(field: "title" | "created_at") {
    if (sortField !== field) return "-";
    return sortOrder === "asc" ? "▲" : "▼";
  }

  function openDeleteModal(doc: DocRow) {
    setErr(null);
    setToDelete(doc);
    setConfirmOpen(true);
  }

  async function loadDocs() {
    setLoading(true);
    setErr(null);

    const { data: userData, error: userErr } = await API.getCurrentUser();
    if (userErr || !userData.user) {
      setErr("Not logged in.");
      setLoading(false);
      return;
    }

    const userId = userData.user.id;
    const { data, error } = await API.fetchDocuments(userId);
    if (error) setErr(error.message);

    setDocs((data ?? []) as DocRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadDocs();
  }, []);

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

    const { data, error } = await API.createDownloadUrl(doc.file_path, 60);

    if (error || !data?.signedUrl) {
      setErr(error?.message ?? "Failed to create download link.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocConfirmed() {
    if (!toDelete) return;
    setDeleting(true);
    setErr(null);

    try {
      const rmStorage = await API.removeStorageFile(toDelete.file_path);
      if (rmStorage.error) throw new Error(rmStorage.error.message);

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

  async function ingestOneFile(userId: string, file: File) {
    // Guard: never allow zip to be uploaded/ingested as a document
    if (file.name.toLowerCase().endsWith(".zip")) {
      throw new Error("ZIP files cannot be uploaded as a document.");
    }

    if (!isAllowedDoc(file.name)) {
      throw new Error(`Unsupported file: ${file.name}. Only PDF/DOC/DOCX allowed.`);
    }

    // Ensure mime type exists (important for backend extractor)
    const mime = file.type || inferMimeType(file.name);
    const fixedFile = mime ? new File([file], file.name, { type: mime }) : file;

    const safeName = fixedFile.name.replace(/\s+/g, "_");
    const filePath = `${userId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}_${safeName}`;

    const up = await API.uploadFileToStorage(filePath, fixedFile);
    if ((up as any)?.error) throw new Error((up as any).error.message);

    const ins = await API.createDocumentRow({
      user_id: userId,
      title: fixedFile.name,
      file_path: filePath,
      mime_type: fixedFile.type || null,
    });

    if ((ins as any)?.error || !(ins as any)?.data?.id) {
      throw new Error((ins as any)?.error?.message ?? "Failed to create document record.");
    }

    await API.callIngest((ins as any).data.id);
  }

  async function onUpload(file: File) {
    setUploading(true);
    setErr(null);

    try {
      const { data: userData, error: userErr } = await API.getCurrentUser();
      if (userErr || !userData.user) throw new Error("Not logged in.");

      const userId = userData.user.id;

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
          throw new Error("ZIP file contains no valid documents (PDF/DOC/DOCX).");
        }

        // Upload extracted docs one-by-one
        for (const entry of valid) {
          const blob = await entry.async("blob");

          // Preserve original filename but remove folders if any
          const baseName = entry.name.split("/").pop() || entry.name;

          const extracted = new File([blob], baseName, {
            type: inferMimeType(baseName) || "application/octet-stream",
          });

          await ingestOneFile(userId, extracted);
        }

        setOpen(false);
        await loadDocs();
        return;
      }

      // --------------------------
      // CASE 2: Single file upload
      // --------------------------
      if (!isAllowedDoc(file.name)) {
        throw new Error("Only PDF, DOC, DOCX, or ZIP files are allowed.");
      }

      await ingestOneFile(userId, file);

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
      {/* Top row: search + upload button */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search files here..."
            className="w-full h-10 rounded-full bg-indigo-100/60 px-5 text-sm text-slate-700 placeholder:text-slate-400
                       border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={() => setOpen(true)}
          className="h-10 px-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold transition"
        >
          Upload documents
        </button>
      </div>

      {/* Errors */}
      {err && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="mt-6 rounded-md border border-slate-200 bg-white">
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
                  {d.title ?? "Untitled"}
                </div>

                <div className="col-span-3 text-center text-sm text-slate-600">
                  {new Date(d.created_at).toLocaleString()}
                </div>

                <div className="col-span-3 flex justify-center gap-3">
                  <DownloadButton onClick={() => void downloadDoc(d)} />
                  <DeleteButton onClick={() => openDeleteModal(d)} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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

            <p className="mt-2 text-sm text-slate-600">
              Choose a PDF, Word (DOC/DOCX), or ZIP file to upload. ZIP may contain only
              PDF/DOC/DOCX.
            </p>

            <div className="mt-5">
              <label className="block">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.zip"
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