import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import type { ChatSession } from "../lib/types";

export type ChatSessionSummary = Omit<ChatSession, "messages">;

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<ChatSessionSummary[]>("/chat-history");
      setSessions(data);
    } catch {
      // silently fail — empty list is fine
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const deleteSession = useCallback(
    async (id: string) => {
      await apiFetch(`/chat-history/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    []
  );

  return { sessions, loading, reload, deleteSession };
}
