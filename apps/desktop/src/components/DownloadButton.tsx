type Props = {
    onClick: () => void;
    disabled?: boolean;
  };
  
  export default function DownloadButton({ onClick, disabled = false }: Props) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="document-download-button px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200
                   hover:bg-emerald-100 text-sm transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {disabled ? "Downloading..." : "Download"}
      </button>
    );
  }
