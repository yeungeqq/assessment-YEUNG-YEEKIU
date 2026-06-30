type Props = {
    active: boolean;
    direction: "asc" | "desc";
  };
  
  export default function SortIcon({ active, direction }: Props) {
    if (!active) {
      return <span className="ml-1 text-slate-400">-</span>;
    }
  
    return (
      <span className="ml-1 text-slate-600">
        {direction === "asc" ? "▲" : "▼"}
      </span>
    );
  }