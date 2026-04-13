import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";

interface ActiveConfig {
  name: string;
  content: string;
}

export function useConfig() {
  const [active, setActive] = useState<ActiveConfig | null>(null);
  const [configs, setConfigs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activeData, configList] = await Promise.all([
        apiFetch<ActiveConfig>("/configs/active"),
        apiFetch<string[]>("/configs"),
      ]);
      setActive(activeData);
      setConfigs(configList);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const switchConfig = async (name: string) => {
    await apiFetch("/configs/switch", {
      method: "POST",
      body: JSON.stringify({ config: name }),
    });
    await load();
    window.dispatchEvent(new Event("configChanged"));
  };

  return { active, configs, loading, switchConfig, reload: load };
}
