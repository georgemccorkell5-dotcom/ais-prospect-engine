import type { VercelRequest, VercelResponse } from "@vercel/node";
import { client } from "../_lib/claude.js";
import { buildSignalScanContext, getProspectsKey } from "../_lib/context.js";
import { readJSON, writeJSON } from "../_lib/kvStore.js";
import { synthesizeSignals } from "../_lib/signalSynthesis.js";
import {
  buildScanQueue,
  getQueueState,
  completeItem,
  generateDigest,
} from "../_lib/signalQueue.js";
import type { Signal, ScoreChange } from "../_lib/types.js";

export const maxDuration = 300;

const BATCH_SIZE = 5;

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text.trim();
}

async function scanProspect(prospectIndex: number): Promise<{
  signals: Signal[];
  signalScore: number;
  scanSummary: string;
} | null> {
  const systemPrompt = await buildSignalScanContext(prospectIndex);

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user" as const,
        content:
          "Scan for fresh buying signals on this company. Search the web thoroughly.",
      },
    ],
    tools: [
      {
        type: "web_search_20250305" as const,
        name: "web_search" as const,
        max_uses: 5,
      } as never,
    ],
  });

  let fullText = "";
  for (const block of response.content) {
    if (block.type === "text") {
      fullText += block.text;
    }
  }

  try {
    const result = JSON.parse(extractJSON(fullText));
    return {
      signals: result.signals || [],
      signalScore: result.signal_score || 0,
      scanSummary: result.scan_summary || "",
    };
  } catch {
    return null;
  }
}

async function processOneProspect(prospectIndex: number, company: string): Promise<{
  scoreChanged: boolean;
  from?: string;
  to?: string;
  signalScore?: number;
  summary?: string;
}> {
  const result = await scanProspect(prospectIndex);
  if (!result) return { scoreChanged: false };

  const key = getProspectsKey();
  const prospects = await readJSON<Record<string, unknown>[]>(key);
  if (prospectIndex < 0 || prospectIndex >= prospects.length) {
    return { scoreChanged: false };
  }

  const existing = (prospects[prospectIndex].signals as Signal[]) || [];
  const existingDescriptions = new Set(
    existing.map((s) => s.description.toLowerCase().slice(0, 50))
  );
  const uniqueNew = result.signals.filter(
    (s: Signal) =>
      !existingDescriptions.has(s.description.toLowerCase().slice(0, 50))
  );
  const mergedSignals = [...existing, ...uniqueNew];

  prospects[prospectIndex].signals = mergedSignals;
  prospects[prospectIndex].last_signal_scan = new Date()
    .toISOString()
    .split("T")[0];

  const synthesis = synthesizeSignals(mergedSignals, company);
  prospects[prospectIndex].signal_score = synthesis.computedScore;
  prospects[prospectIndex].signal_synthesis = synthesis;

  const currentScore = prospects[prospectIndex].score as string;
  let scoreChanged = false;
  let from: string | undefined;
  let to: string | undefined;

  if (synthesis.recommendedRating !== currentScore) {
    const scoreHistory =
      (prospects[prospectIndex].score_history as ScoreChange[]) || [];
    scoreHistory.push({
      date: new Date().toISOString().split("T")[0],
      from: currentScore as "HOT" | "WARM" | "COLD",
      to: synthesis.recommendedRating,
      reason: `Signal synthesis: ${synthesis.summary.slice(0, 200)}`,
      signalScore: synthesis.computedScore,
    });
    prospects[prospectIndex].score_history = scoreHistory;
    prospects[prospectIndex].score = synthesis.recommendedRating;
    prospects[prospectIndex].score_reasoning = `[Auto-updated by signal synthesis] ${synthesis.summary}`;
    scoreChanged = true;
    from = currentScore;
    to = synthesis.recommendedRating;
  }

  await writeJSON(key, prospects);

  return {
    scoreChanged,
    from,
    to,
    signalScore: synthesis.computedScore,
    summary: result.scanSummary,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow both GET (Vercel cron) and POST (manual trigger)
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify cron secret for GET requests (Vercel cron sends this)
  if (req.method === "GET") {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // Only run on the first Monday of the month (day of month 1-7 AND Monday).
    // Vercel cron fires every Monday; we filter in the handler because standard
    // cron doesn't support "first Monday of month" syntax. Manual POST triggers
    // bypass this guard.
    const now = new Date();
    const isFirstMonday = now.getUTCDay() === 1 && now.getUTCDate() <= 7;
    if (!isFirstMonday) {
      res.json({ status: "skipped", reason: "not first Monday of month" });
      return;
    }
  }

  try {
    // Check if there's an active queue to continue, otherwise build a new one
    let state = await getQueueState();

    if (!state || state.status === "done") {
      state = await buildScanQueue();
    }

    if (state.queue.length === 0) {
      // Nothing to scan — generate digest and finish
      const digest = await generateDigest();
      res.json({
        status: "complete",
        message: "No prospects due for scanning",
        digest,
      });
      return;
    }

    // Process a batch
    const batch = state.queue.slice(0, BATCH_SIZE);
    const results: Array<{
      company: string;
      success: boolean;
      scoreChanged?: boolean;
      error?: string;
    }> = [];

    for (const item of batch) {
      try {
        const result = await processOneProspect(
          item.prospectIndex,
          item.company
        );
        await completeItem(
          item,
          result.scoreChanged
            ? {
                company: item.company,
                from: result.from!,
                to: result.to!,
                signalScore: result.signalScore!,
                summary: result.summary || "",
                scannedAt: new Date().toISOString(),
              }
            : undefined
        );
        results.push({
          company: item.company,
          success: true,
          scoreChanged: result.scoreChanged,
        });
      } catch (e) {
        // Mark as complete even on error so it doesn't block the queue
        await completeItem(item);
        results.push({
          company: item.company,
          success: false,
          error: String(e),
        });
      }
    }

    // Check remaining
    const updatedState = await getQueueState();
    const remaining = updatedState?.queue.length || 0;

    if (remaining === 0) {
      // All done — generate digest
      const digest = await generateDigest();
      res.json({
        status: "complete",
        processed: results,
        digest,
        remaining: 0,
      });
    } else {
      res.json({
        status: "processing",
        processed: results,
        remaining,
        message: `${remaining} prospects remaining. Call again to continue.`,
      });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
