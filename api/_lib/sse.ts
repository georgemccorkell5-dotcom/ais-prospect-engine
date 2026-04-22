import type { VercelResponse } from "@vercel/node";

export function setupSSE(res: VercelResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
}

export function sendSSE(res: VercelResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function extractJSON(text: string): string {
  let jsonStr = text.trim();

  // Strip markdown fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Walk braces to find the first complete top-level JSON object, accounting
  // for string literals and escapes. Robust against preamble, trailing
  // commentary, and nested braces inside strings.
  const firstBrace = jsonStr.indexOf("{");
  if (firstBrace === -1) return jsonStr;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = firstBrace; i < jsonStr.length; i++) {
    const c = jsonStr[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return jsonStr.slice(firstBrace, i + 1);
    }
  }

  return jsonStr.slice(firstBrace);
}
