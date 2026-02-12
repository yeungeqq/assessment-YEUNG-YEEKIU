import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>('')

  async function upload() {
    setStatus('')
    if (!file) return setStatus('Choose a file first.')

    // NOTE: Create a Storage bucket called "documents" in Supabase (recommended private)
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return setStatus('Not authenticated')

    const path = `${user.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: false })

    if (error) return setStatus(`Upload failed: ${error.message}`)

    setStatus(`Uploaded to: ${path}. Next: call backend /documents/ingest to chunk+embed.`)
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
