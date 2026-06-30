type Props = {
    onClick: () => void;
  };
  
  export default function DeleteButton({ onClick }: Props) {
    return (
      <button
        onClick={onClick}
        className="px-4 py-1.5 rounded-full bg-red-100/60 text-red-700 border border-red-200/70
                   hover:bg-red-200/70 text-sm transition"
      >
        Delete
      </button>
    );
  }