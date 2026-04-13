import type { ChatMessage as ChatMessageType } from "../lib/types";

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
            : "bg-gray-800/70 text-gray-200 border border-gray-700/50"
        }`}
      >
        {message.searching && (
          <div className="flex items-center gap-2 text-xs text-blue-400 mb-2">
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Searching the web...
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content || "..."}</div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-700/50">
            <div className="text-xs text-gray-500 mb-1">Sources</div>
            <div className="flex flex-col gap-1">
              {message.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 truncate transition-colors"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
