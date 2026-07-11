import type { FormatEditorProps } from "./editor.types";

export default function DocxEditor({ document, onCancel }: FormatEditorProps) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {document.title ?? "Untitled"}
          </div>
          <div className="text-xs text-slate-500">DOC/DOCX editor</div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">
        DOC/DOCX editing will be implemented after the text editing workflow.
      </div>
    </div>
  );
}
