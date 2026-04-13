const BASE = "/api";

const TOKEN_KEY = "ais_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(),
    ...init,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onSearching?: (query: string) => void;
  onSources?: (sources: { title: string; url: string }[]) => void;
  onSaved?: (data: Record<string, unknown>) => void;
}

export function apiStream(
  path: string,
  body: unknown,
  callbacks: StreamCallbacks
): AbortController {
  const controller = new AbortController();

  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (res.status === 401) {
        clearToken();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        callbacks.onError(`HTTP ${res.status}: ${await res.text()}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError("No response body");
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
            if (currentEvent === "done") {
              callbacks.onDone();
              return;
            }
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "text" && data !== "") {
                callbacks.onText(data);
              } else if (currentEvent === "searching" && callbacks.onSearching) {
                callbacks.onSearching(data);
              } else if (currentEvent === "sources" && callbacks.onSources) {
                callbacks.onSources(data);
              } else if ((currentEvent === "saved" || currentEvent === "results") && callbacks.onSaved) {
                callbacks.onSaved(data);
              } else if (currentEvent === "error") {
                callbacks.onError(typeof data === "string" ? data : JSON.stringify(data));
              }
            } catch {
              // skip malformed data
            }
            currentEvent = "";
          }
        }
      }
      callbacks.onDone();
    })
    .catch((e) => {
      if (e.name !== "AbortError") {
        callbacks.onError(String(e));
      }
    });

  return controller;
}

export async function login(password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(data.error || "Login failed");
  }
  const { token } = await res.json();
  setToken(token);
  return token;
}
