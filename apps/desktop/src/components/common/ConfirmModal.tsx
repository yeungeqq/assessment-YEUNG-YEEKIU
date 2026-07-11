type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmClass =
    confirmTone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-blue-600 text-white hover:bg-blue-700";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/35" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
