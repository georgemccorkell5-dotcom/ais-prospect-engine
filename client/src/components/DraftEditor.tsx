import { useState } from "react";

interface Props {
  subject: string;
  body: string;
  onSubjectChange: (s: string) => void;
  onBodyChange: (b: string) => void;
  onSave: () => void;
  onCopy: () => void;
  saving?: boolean;
  saved?: boolean;
}

export default function DraftEditor({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onSave,
  onCopy,
  saving,
  saved,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 block mb-1.5 uppercase tracking-wider font-medium">Subject Line</label>
        <input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="w-full bg-gray-800/70 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 placeholder:text-gray-600"
          placeholder="Email subject..."
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1.5 uppercase tracking-wider font-medium">Email Body</label>
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={12}
          className="w-full bg-gray-800/70 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 resize-y transition-all duration-200 placeholder:text-gray-600 leading-relaxed"
          placeholder="Email body will appear here after generation..."
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !body}
          className="px-4 py-2 text-sm bg-blue-600 rounded-xl hover:bg-blue-500 text-white disabled:opacity-50 transition-all duration-200 font-medium shadow-sm shadow-blue-600/20"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Draft"}
        </button>
        <button
          onClick={handleCopy}
          disabled={!body}
          className="px-4 py-2 text-sm bg-gray-800/70 border border-gray-700/50 rounded-xl hover:bg-gray-800 text-gray-300 disabled:opacity-50 transition-all duration-200 font-medium"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
