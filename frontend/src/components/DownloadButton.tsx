type Props = {
    onClick: () => void;
  };
  
  export default function DownloadButton({ onClick }: Props) {
    return (
      <button
        onClick={onClick}
        className="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200
                   hover:bg-emerald-100 text-sm transition"
      >
        Download
      </button>
    );
  }