import { useState, useRef, useCallback } from "react";
import { apiFetch, apiStream } from "../lib/api";
import type { ChatMessage, ChatSession } from "../lib/types";

export function useChat(endpoint: string = "/chat/stream") {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const saveSession = useCallback(
    async (finalMessages: ChatMessage[], currentSessionId: string | null) => {
      // Strip UI-only fields before saving
      const cleaned = finalMessages.map(({ role, content, sources }) => ({
        role,
        content,
        ...(sources ? { sources } : {}),
      }));

      if (currentSessionId) {
        // Update existing session
        await apiFetch(`/chat-history/${currentSessionId}`, {
          method: "PUT",
          body: JSON.stringify({ messages: cleaned }),
        });
      } else {
        // Create new session — title from first user message
        const firstUserMsg = cleaned.find((m) => m.role === "user");
        const title = firstUserMsg
          ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? "..." : "")
          : "New Chat";

        let productConfig = "unknown";
        try {
          const config = await apiFetch<{ name: string }>("/configs/active");
          productConfig = config.name;
        } catch {
          // use default
        }

        const session = await apiFetch<ChatSession>("/chat-history", {
          method: "POST",
          body: JSON.stringify({ title, messages: cleaned, productConfig }),
        });
        setSessionId(session.id);
        sessionIdRef.current = session.id;
      }
    },
    []
  );

  const send = useCallback(
    (userMessage: string, extraBody?: Record<string, unknown>) => {
      const newMessages: ChatMessage[] = [
        ...messages,
        { role: "user" as const, content: userMessage },
      ];
      setMessages([...newMessages, { role: "assistant" as const, content: "" }]);
      setStreaming(true);
      setError(null);

      let accumulated = "";
      let finalSources: { title: string; url: string }[] | undefined;

      controllerRef.current = apiStream(endpoint, { messages: newMessages, ...extraBody }, {
        onText: (text) => {
          accumulated += text;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: accumulated,
              searching: false,
            };
            return updated;
          });
        },
        onSearching: (query) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              searching: true,
              content: accumulated || `Searching for: ${query}`,
            };
            return updated;
          });
        },
        onSources: (sources) => {
          finalSources = sources;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              sources,
            };
            return updated;
          });
        },
        onDone: () => {
          setStreaming(false);
          // Auto-save after assistant response completes
          const completedMessages: ChatMessage[] = [
            ...newMessages,
            {
              role: "assistant" as const,
              content: accumulated,
              ...(finalSources ? { sources: finalSources } : {}),
            },
          ];
          saveSession(completedMessages, sessionIdRef.current);
        },
        onError: (err) => {
          setError(err);
          setStreaming(false);
        },
      });
    },
    [messages, endpoint, saveSession]
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    setStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    sessionIdRef.current = null;
    setError(null);
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      const session = await apiFetch<ChatSession>(`/chat-history/${id}`);
      setMessages(session.messages);
      setSessionId(session.id);
      sessionIdRef.current = session.id;
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return { messages, streaming, error, sessionId, send, stop, clear, loadSession };
}
