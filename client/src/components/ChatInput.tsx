import { useState, useRef, useEffect } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type a message..."}
        disabled={disabled}
        rows={1}
        className="flex-1 bg-gray-800/70 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 transition-all duration-200 placeholder:text-gray-600"
        style={{ minHeight: "40px", maxHeight: "120px" }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = "auto";
          target.style.height = Math.min(target.scrollHeight, 120) + "px";
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="px-5 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-all duration-200 font-medium shadow-sm shadow-blue-600/20 hover:shadow-blue-500/30"
      >
        Send
      </button>
    </div>
  );
}
