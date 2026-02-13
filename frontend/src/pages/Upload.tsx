import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>('')

  async function upload() {
    setStatus('')
    if (!file) return setStatus('Choose a file first.')

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return setStatus("Not authenticated");

    const path = `${user.id}/${Date.now()}-${file.name}`;

    // 1) upload to storage
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) return setStatus(`Upload failed: ${upErr.message}`);

    // 2) insert into documents table
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        title: file.name,
        file_path: path,
        mime_type: file.type
      })
      .select()
      .single();

    if (docErr) return setStatus(`DB insert failed: ${docErr.message}`);

    // 3) call backend ingest endpoint
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/documents/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ documentId: doc.id }),
    });

    let json: any = null
    try { json = await res.json() } catch { /* ignore */ }
    
    if (!res.ok) {
      const msg =
        (typeof json?.error === "string" ? json.error : null) ??
        (json?.error?.message ? json.error.message : null) ??
        (json?.error ? JSON.stringify(json.error) : null) ??
        (await res.text().catch(() => "")) ??
        "unknown error";
      return setStatus(`Ingest failed: ${msg}`);
    }

    setStatus("Upload + ingestion started ✅");
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2>Upload Business Documents</h2>
      <p style={{ opacity: 0.8 }}>
        Upload a PDF/DOCX to Supabase Storage. Then implement ingestion in backend to build the vector index.
      </p>

      <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <div style={{ marginTop: 10 }}>
        <button onClick={upload}>Upload</button>
      </div>

      {status && <div style={{ marginTop: 10 }}>{status}</div>}
    </div>
  )
}
