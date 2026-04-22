import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface StreamCallbacks {
  onText: (text: string) => void;
  onSearching: (query: string) => void;
  onSources: (sources: { title: string; url: string }[]) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamChat(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  callbacks: StreamCallbacks,
  options?: { webSearch?: boolean }
): Promise<void> {
  try {
    const tools = options?.webSearch
      ? [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 5 }]
      : undefined;

    const stream = await client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      ...(tools ? { tools } : {}),
    });

    let searchQueryJson = "";
    let inServerToolUse = false;

    for await (const event of stream) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = event as any;
      if (e.type === "content_block_start") {
        if (e.content_block?.type === "server_tool_use" && e.content_block?.name === "web_search") {
          inServerToolUse = true;
          searchQueryJson = "";
        }
      }
      if (e.type === "content_block_delta") {
        if (e.delta?.type === "text_delta" && typeof e.delta.text === "string") {
          callbacks.onText(e.delta.text);
        }
        if (e.delta?.type === "input_json_delta" && inServerToolUse) {
          searchQueryJson += e.delta.partial_json || "";
        }
      }
      if (e.type === "content_block_stop" && inServerToolUse) {
        try {
          const parsed = JSON.parse(searchQueryJson);
          callbacks.onSearching(parsed.query || "the web");
        } catch {
          callbacks.onSearching("the web");
        }
        inServerToolUse = false;
        searchQueryJson = "";
      }
    }

    const finalMsg = await stream.finalMessage();
    const sources: { title: string; url: string }[] = [];
    const seen = new Set<string>();
    for (const block of finalMsg.content) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = block as any;
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) {
          if (r.type === "web_search_result" && r.url && !seen.has(r.url)) {
            seen.add(r.url);
            sources.push({ title: r.title || r.url, url: r.url });
          }
        }
      }
    }
    if (sources.length > 0) {
      callbacks.onSources(sources);
    }

    callbacks.onDone();
  } catch (e) {
    callbacks.onError(e instanceof Error ? e : new Error(String(e)));
  }
}
