// src/pages/Document.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type DocRow = {
  id: string;
  title: string | null;
  file_path: string;
  created_at: string;
};

export default function Document() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadDocs() {
    setLoading(true);
    setErr(null);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setErr("Not logged in.");
      setLoading(false);
      return;
    }

    const userId = userData.user.id;

    const { data, error } = await supabase
      .from("documents")
      .select("id,title,file_path,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    setDocs((data ?? []) as DocRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadDocs();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter((d) => (d.title ?? "").toLowerCase().includes(needle));
  }, [docs, q]);

  async function downloadDoc(doc: DocRow) {
    setErr(null);
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60);

    if (error || !data?.signedUrl) {
      setErr(error?.message ?? "Failed to create download link.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function onUpload(file: File) {
    setUploading(true);
    setErr(null);
  
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not logged in.");
  
      const userId = userData.user.id;
  
      // Storage path: userId/timestamp_filename
      const safeName = file.name.replace(/\s+/g, "_");
      const filePath = `${userId}/${Date.now()}_${safeName}`;
  
      // 1) upload to storage
      const up = await supabase.storage.from("documents").upload(filePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
  
      if (up.error) throw new Error(up.error.message);
  
      // 2) insert row into documents table
      const ins = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          title: file.name,
          file_path: filePath,
          mime_type: file.type || null,
        })
        .select("id")
        .single();
  
      if (ins.error || !ins.data?.id) {
        throw new Error(ins.error?.message ?? "Failed to create document record.");
      }
  
      const documentId = ins.data.id;
  
      // 3) call backend ingest to create chunks
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Missing access token (not logged in).");
  
      const resp = await fetch("http://localhost:8080/documents/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId }),
      });
  
      const body = await resp.json().catch(() => ({}));
  
      if (!resp.ok) {
        throw new Error(body?.error ?? `Ingest failed (HTTP ${resp.status})`);
      }
  
      // success
      setOpen(false);
      await loadDocs();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
  
      // OPTIONAL rollback: if you want, we can also delete the storage file + DB row here
      // so you don't end up with "uploaded but not chunked" docs.
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
          <div className="col-span-9 text-center">Document Name</div>
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
                <div className="col-span-9 text-slate-700 text-sm">
                  {d.title ?? "Untitled"}
                </div>

                <div className="col-span-3 flex justify-center">
                  <button
                    onClick={() => downloadDoc(d)}
                    className="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200
                               hover:bg-emerald-100 text-sm transition"
                  >
                    Download
                  </button>
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
              Choose a PDF or DOCX file to upload.
            </p>

            <div className="mt-5">
              <label className="block">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
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

            {uploading && (
              <div className="mt-4 text-sm text-slate-600">Uploading…</div>
            )}

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
    </div>
  );
}