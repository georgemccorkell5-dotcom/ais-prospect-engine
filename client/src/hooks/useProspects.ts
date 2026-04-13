import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import type { Prospect } from "../lib/types";

export function useProspects(filters?: { score?: string; status?: string }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.score) params.set("score", filters.score);
      if (filters?.status) params.set("status", filters.status);
      const qs = params.toString();
      const data = await apiFetch<Prospect[]>(`/prospects${qs ? `?${qs}` : ""}`);
      setProspects(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [filters?.score, filters?.status]);

  useEffect(() => { load(); }, [load]);

  // Reload when active product config changes
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("configChanged", handler);
    return () => window.removeEventListener("configChanged", handler);
  }, [load]);

  return { prospects, loading, error, reload: load };
}

export function useProspect(index: number | null) {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (index === null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Prospect>(`/prospects/${index}`);
      setProspect(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [index]);

  useEffect(() => { load(); }, [load]);

  const save = async (updates: Partial<Prospect>) => {
    if (index === null) return;
    try {
      const data = await apiFetch<Prospect>(`/prospects/${index}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      setProspect(data);
      return data;
    } catch (e) {
      setError(String(e));
    }
  };

  return { prospect, loading, error, reload: load, save };
}
