import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_lib/auth.js";
import { readJSON, writeJSON } from "./_lib/kvStore.js";
import { getProspectsKey } from "./_lib/context.js";
import { synthesizeSignals } from "./_lib/signalSynthesis.js";
import { getSubPath } from "./_lib/routing.js";
import { getQueueState, getLatestDigest } from "./_lib/signalQueue.js";
import type { Prospect, ScoreChange } from "./_lib/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  const parts = getSubPath(req);

  // GET /api/prospects/signal-digest — signal intelligence digest
  if (parts[0] === "signal-digest" && req.method === "GET") {
    try {
      const digest = await getLatestDigest();
      const queueState = await getQueueState();
      res.json({
        digest,
        queue: queueState ? {
          status: queueState.status,
          remaining: queueState.queue.length,
          completed: queueState.completed.length,
          scoreChanges: queueState.scoreChanges,
          createdAt: queueState.createdAt,
        } : null,
      });
    } catch (e) {
      res.json({ digest: null, queue: null });
    }
    return;
  }

  // GET /api/prospects/signal-overview — scan coverage stats
  if (parts[0] === "signal-overview" && req.method === "GET") {
    try {
      const configName = "ais-mn";
      const activeKey = getProspectsKey();

      const overview: {
        totalProspects: number;
        scannedLast7Days: number;
        scannedLast14Days: number;
        scannedLast30Days: number;
        neverScanned: number;
        byScore: { HOT: number; WARM: number; COLD: number };
        configName: string;
        recentScoreChanges: Array<{
          company: string;
          config: string;
          from: string;
          to: string;
          date: string;
          signalScore: number;
        }>;
        topSignalProspects: Array<{
          company: string;
          config: string;
          signalScore: number;
          score: string;
          lastScan: string | null;
        }>;
      } = {
        totalProspects: 0,
        scannedLast7Days: 0,
        scannedLast14Days: 0,
        scannedLast30Days: 0,
        neverScanned: 0,
        byScore: { HOT: 0, WARM: 0, COLD: 0 },
        configName,
        recentScoreChanges: [],
        topSignalProspects: [],
      };

      const now = Date.now();
      const day = 1000 * 60 * 60 * 24;

      let prospects: Prospect[];
      try { prospects = await readJSON<Prospect[]>(activeKey); } catch { prospects = []; }

      for (const p of prospects) {
          if (p.status === "disqualified") continue;
          overview.totalProspects++;
          if (p.score === "HOT") overview.byScore.HOT++;
          else if (p.score === "WARM") overview.byScore.WARM++;
          else overview.byScore.COLD++;

          if (!p.last_signal_scan) {
            overview.neverScanned++;
          } else {
            const age = (now - new Date(p.last_signal_scan).getTime()) / day;
            if (age <= 7) overview.scannedLast7Days++;
            else if (age <= 14) overview.scannedLast14Days++;
            else if (age <= 30) overview.scannedLast30Days++;
          }

          // Collect score changes from history
          if (p.score_history) {
            for (const sc of p.score_history) {
              overview.recentScoreChanges.push({
                company: p.company,
                config: configName,
                from: sc.from,
                to: sc.to,
                date: sc.date,
                signalScore: sc.signalScore,
              });
            }
          }

          // Collect top signal prospects
          if (p.signal_score && p.signal_score > 0) {
            overview.topSignalProspects.push({
              company: p.company,
              config: configName,
              signalScore: p.signal_score,
              score: p.score,
              lastScan: p.last_signal_scan || null,
            });
          }
      }

      // Sort and limit
      overview.recentScoreChanges.sort((a, b) => b.date.localeCompare(a.date));
      overview.recentScoreChanges = overview.recentScoreChanges.slice(0, 20);
      overview.topSignalProspects.sort((a, b) => b.signalScore - a.signalScore);
      overview.topSignalProspects = overview.topSignalProspects.slice(0, 20);

      res.json(overview);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
    return;
  }

  const key = getProspectsKey();

  let prospects: Prospect[];
  try {
    prospects = await readJSON<Prospect[]>(key);
  } catch {
    prospects = [];
  }

  // POST /api/prospects — add new prospect
  if (parts.length === 0 && req.method === "POST") {
    try {
      const newProspect: Prospect = req.body;
      prospects.push(newProspect);
      await writeJSON(key, prospects);
      res.status(201).json({ index: prospects.length - 1, prospect: newProspect });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
    return;
  }

  // GET /api/prospects — list all
  if (parts.length === 0 && req.method === "GET") {
    const { score, status } = req.query;
    let filtered = prospects;
    if (score) {
      const scores = (score as string).split(",");
      filtered = filtered.filter((p) => scores.includes(p.score));
    }
    if (status) {
      const statuses = (status as string).split(",");
      filtered = filtered.filter((p) => statuses.includes(p.status));
    }
    res.json(filtered);
    return;
  }

  // Routes with an index
  const idx = parseInt(parts[0], 10);
  if (isNaN(idx) || idx < 0 || idx >= prospects.length) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  // POST /api/prospects/:index/synthesize
  if (parts[1] === "synthesize" && req.method === "POST") {
    try {
      const prospect = prospects[idx];
      const signals = prospect.signals || [];
      const synthesis = synthesizeSignals(signals, prospect.company);
      prospect.signal_score = synthesis.computedScore;
      prospect.signal_synthesis = synthesis;
      if (synthesis.recommendedRating !== prospect.score) {
        const scoreHistory: ScoreChange[] = prospect.score_history || [];
        scoreHistory.push({
          date: new Date().toISOString().split("T")[0],
          from: prospect.score,
          to: synthesis.recommendedRating,
          reason: `Signal synthesis: ${synthesis.summary.slice(0, 200)}`,
          signalScore: synthesis.computedScore,
        });
        prospect.score_history = scoreHistory;
        prospect.score = synthesis.recommendedRating;
        prospect.score_reasoning = `[Auto-updated by signal synthesis] ${synthesis.summary}`;
      }
      prospects[idx] = prospect;
      await writeJSON(key, prospects);
      res.json({ synthesis, prospect });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
    return;
  }

  if (req.method === "GET") { res.json(prospects[idx]); return; }
  if (req.method === "PUT") {
    try {
      prospects[idx] = { ...prospects[idx], ...req.body };
      await writeJSON(key, prospects);
      res.json(prospects[idx]);
    } catch (e) { res.status(500).json({ error: String(e) }); }
    return;
  }
  if (req.method === "DELETE") {
    try {
      const removed = prospects.splice(idx, 1);
      await writeJSON(key, prospects);
      res.json(removed[0]);
    } catch (e) { res.status(500).json({ error: String(e) }); }
    return;
  }
  res.status(405).json({ error: "Method not allowed" });
}
