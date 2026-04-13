import { useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import { useChatHistory } from "../hooks/useChatHistory";
import ChatMessage from "../components/ChatMessage";
import ChatInput from "../components/ChatInput";

const quickActions = [
  { label: "Morning Brief", message: "Give me a morning briefing. Summarize pipeline status, flag follow-ups due today, highlight hot leads, and recommend top 3 priorities.", icon: "☀️" },
  { label: "Follow-ups Due", message: "Check all prospects and tell me which follow-ups are due today or overdue. Draft follow-up messages for each.", icon: "📋" },
  { label: "Pipeline Summary", message: "Give me a complete pipeline summary with counts by score and status, and highlight any concerns or opportunities.", icon: "📊" },
  { label: "Research a Company", message: "I want to research a new company for our pipeline. Ask me which company and I'll give you the details.", icon: "🔍" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function Chat() {
  const { messages, streaming, error, sessionId, send, stop, clear, loadSession } = useChat("/chat/stream");
  const { sessions, reload: reloadHistory, deleteSession } = useChatHistory();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Reload history list when streaming finishes (a session was saved/updated)
  const prevStreamingRef = useRef(streaming);
  useEffect(() => {
    if (prevStreamingRef.current && !streaming) {
      reloadHistory();
    }
    prevStreamingRef.current = streaming;
  }, [streaming, reloadHistory]);

  const handleNewChat = () => {
    clear();
  };

  const handleLoadSession = (id: string) => {
    if (id === sessionId) return;
    loadSession(id);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSession(id);
    if (id === sessionId) {
      clear();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800/50">
        <h2 className="text-lg font-semibold text-white">Agent Chat</h2>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-md hover:bg-gray-800/50 transition-all duration-200"
            >
              New Chat
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Messages */}
          <div ref={scrollRef} className={`flex-1 overflow-y-auto px-6 py-4 ${messages.length === 0 ? "flex items-center justify-center" : ""}`}>
            {messages.length === 0 && (
              <div className="text-center w-full max-w-2xl">
                <h3 className="text-xl font-semibold text-white mb-2">AIS Prospect Agent</h3>
                <p className="text-gray-500 mb-8">Your AI-powered sales development assistant. What would you like to do?</p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {quickActions.map((qa) => (
                    <button
                      key={qa.label}
                      onClick={() => send(qa.message)}
                      className="flex items-center gap-3 px-4 py-3 text-sm bg-gray-800/50 border border-gray-700/50 rounded-xl text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-600 transition-all duration-200 text-left"
                    >
                      <span className="text-lg shrink-0">{qa.icon}</span>
                      <span className="font-medium">{qa.label}</span>
                    </button>
                  ))}
                </div>
                <ChatInput
                  onSend={send}
                  disabled={streaming}
                  placeholder="Ask the agent anything..."
                />
              </div>
            )}
            {messages.map((m, i) => (
              <ChatMessage key={i} message={m} />
            ))}
            {error && (
              <div className="text-red-400 text-sm px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/20 mb-4">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className={`px-6 py-4 border-t border-gray-800/50 ${messages.length === 0 ? "hidden" : ""}`}>
            {streaming && (
              <button
                onClick={stop}
                className="text-xs text-gray-500 hover:text-gray-300 mb-2 transition-colors"
              >
                Stop generating
              </button>
            )}
            <ChatInput
              onSend={send}
              disabled={streaming}
              placeholder="Ask the agent anything..."
            />
          </div>
        </div>

        {/* Recents Panel — right side */}
        <div className="w-48 shrink-0 border-l border-gray-800/50 flex flex-col bg-gray-900/30">
          <div className="px-3 py-2.5 border-b border-gray-800/50 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Recents</span>
            <button
              onClick={handleNewChat}
              className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-[11px] text-gray-600 px-3 py-4 text-center">No chats yet</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleLoadSession(s.id)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-800/30 hover:bg-gray-800/40 transition-colors group cursor-pointer ${
                    s.id === sessionId ? "bg-blue-500/10 border-l-2 border-l-blue-400" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs text-gray-300 truncate leading-snug">
                      {s.title}
                    </p>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.id)}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-xs leading-none px-0.5"
                      title="Delete chat"
                    >
                      ×
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-600 mt-0.5 block">{formatDate(s.updatedAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
