import { useEffect, useRef, useState } from "react";
import * as API from "../../Api";
import ConfirmModal from "../common/ConfirmModal";
import type { FormatEditorProps } from "./editor.types";

export default function TextEditor({
  document,
  initialText = "",
  onCancel,
  onSaved,
}: FormatEditorProps) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const lastSavedTextRef = useRef(initialText);

  useEffect(() => {
    setText(initialText);
    lastSavedTextRef.current = initialText;
  }, [initialText, document.id]);

  async function save(closeAfterSave = false) {
    setSaving(true);
    setError(null);

    const file = new File([text], document.title ?? "document.txt", {
      type: "text/plain",
    });
    const { data, error } = await API.replaceDocumentFile(document.id, file);

    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? "Failed to save document.");
      return false;
    }

    lastSavedTextRef.current = text;
    onSaved({ chunks: data.chunks }, { closeAfterSave });
    return true;
  }

  async function finish() {
    await save(true);
  }

  function cancel() {
    if (text !== lastSavedTextRef.current) {
      setConfirmCancelOpen(true);
      return;
    }

    onCancel();
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {document.title ?? "Untitled"}
          </div>
          <div className="text-xs text-slate-500">Text editor</div>
        </div>

        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void finish()}
          disabled={saving}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Finish
        </button>
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={saving}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-0 flex-1 resize-none border-0 bg-white p-5 text-sm leading-6 text-slate-800 outline-none"
        spellCheck
      />

      <ConfirmModal
        open={confirmCancelOpen}
        title="Leave without saving?"
        message="Your latest changes have not been saved. If you leave now, those edits will be discarded."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        confirmTone="danger"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          onCancel();
        }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
