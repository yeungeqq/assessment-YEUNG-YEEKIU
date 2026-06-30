import { useState } from "react";
import { Copy, Check } from "lucide-react";

type Props = {
  text: string;
};

export default function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center p-2 rounded-md hover:bg-slate-200 transition"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-600" />
      ) : (
        <Copy className="w-4 h-4 text-slate-600" />
      )}
    </button>
  );
}