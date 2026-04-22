import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_lib/auth.js";
import { streamChat } from "./_lib/claude.js";
import {
  buildChatContext, buildOutreachContext, buildResearchContext,
  buildDeepResearchContext, buildSignalScanContext, buildProspectSearchContext,
  getProspectsKey,
} from "./_lib/context.js";
import { readJSON, writeJSON } from "./_lib/kvStore.js";
import { synthesizeSignals } from "./_lib/signalSynthesis.js";
import { setupSSE, sendSSE, extractJSON } from "./_lib/sse.js";
import { getSubPath } from "./_lib/routing.js";
import type { Signal, ScoreChange } from "./_lib/types.js";

export const maxDuration = 300;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!requireAuth(req, res)) return;

  const parts = getSubPath(req);
  const sub = parts[0] || "";

  try {
    switch (sub) {
      case "stream": return await handleStream(req, res);
      case "outreach": return await handleOutreach(req, res);
      case "deep-research": return await handleDeepResearch(req, res);
      case "signal-scan": return await handleSignalScan(req, res);
      case "contact-enrich": return await handleContactEnrich(req, res);
      case "research": return await handleResearch(req, res);
      case "prospect-search": return await handleProspectSearch(req, res);
      default: res.status(404).json({ error: "Unknown chat endpoint" });
    }
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: String(e) });
  }
}

async function handleStream(req: VercelRequest, res: VercelResponse) {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: "messages array required" }); return; }
  const systemPrompt = await buildChatContext();
  setupSSE(res);
  await streamChat(systemPrompt, messages, {
    onText: (text) => sendSSE(res, "text", text),
    onSearching: (query) => sendSSE(res, "searching", query),
    onSources: (sources) => sendSSE(res, "sources", sources),
    onDone: () => { sendSSE(res, "done", ""); res.end(); },
    onError: (error) => { sendSSE(res, "error", error.message); res.end(); },
  }, { webSearch: true });
}

async function handleOutreach(req: VercelRequest, res: VercelResponse) {
  const { prospectIndex, framework, messages, contactIndex } = req.body;
  if (prospectIndex === undefined) { res.status(400).json({ error: "prospectIndex required" }); return; }
  let systemPrompt = await buildOutreachContext(prospectIndex, contactIndex);
  if (framework) systemPrompt += `\n\nUse the "${framework}" framework specifically.`;
  const chatMessages = messages || [{ role: "user" as const, content: "Draft a personalized cold email for this prospect." }];
  setupSSE(res);
  await streamChat(systemPrompt, chatMessages, {
    onText: (text) => sendSSE(res, "text", text),
    onSearching: () => {}, onSources: () => {},
    onDone: () => { sendSSE(res, "done", ""); res.end(); },
    onError: (error) => { sendSSE(res, "error", error.message); res.end(); },
  });
}

async function handleDeepResearch(req: VercelRequest, res: VercelResponse) {
  const { prospectIndex } = req.body;
  if (prospectIndex === undefined) { res.status(400).json({ error: "prospectIndex required" }); return; }
  const systemPrompt = await buildDeepResearchContext(prospectIndex);
  setupSSE(res);
  let fullText = "";
  await streamChat(systemPrompt,
    [{ role: "user" as const, content: "Research this company thoroughly and return the enriched JSON." }],
    {
      onText: (text) => { fullText += text; sendSSE(res, "text", text); },
      onSearching: (query) => sendSSE(res, "searching", query),
      onSources: (sources) => sendSSE(res, "sources", sources),
      onDone: async () => {
        try {
          const enriched = JSON.parse(extractJSON(fullText));
          const key = getProspectsKey();
          const prospects = await readJSON<Record<string, unknown>[]>(key);
          if (prospectIndex >= 0 && prospectIndex < prospects.length) {
            prospects[prospectIndex] = { ...prospects[prospectIndex], ...enriched };
            await writeJSON(key, prospects);
          }
          sendSSE(res, "saved", enriched);
        } catch { sendSSE(res, "error", "Could not parse research results. Try again."); }
        sendSSE(res, "done", ""); res.end();
      },
      onError: (error) => { sendSSE(res, "error", error.message); res.end(); },
    }, { webSearch: true });
}

async function handleSignalScan(req: VercelRequest, res: VercelResponse) {
  const { prospectIndex } = req.body;
  if (prospectIndex === undefined) { res.status(400).json({ error: "prospectIndex required" }); return; }
  const systemPrompt = await buildSignalScanContext(prospectIndex);
  setupSSE(res);
  let fullText = "";
  await streamChat(systemPrompt,
    [{ role: "user" as const, content: "Scan for fresh buying signals on this company. Search the web thoroughly." }],
    {
      onText: (text) => { fullText += text; sendSSE(res, "text", text); },
      onSearching: (query) => sendSSE(res, "searching", query),
      onSources: (sources) => sendSSE(res, "sources", sources),
      onDone: async () => {
        try {
          const result = JSON.parse(extractJSON(fullText));
          const newSignals = result.signals || [];
          const signalScore = result.signal_score || 0;
          const scanSummary = result.scan_summary || "";
          const key = getProspectsKey();
          // Re-read to get latest data (including Apollo enrichment saved during context build)
          const prospects = await readJSON<Record<string, unknown>[]>(key);
          if (prospectIndex >= 0 && prospectIndex < prospects.length) {
            const existing = (prospects[prospectIndex].signals as unknown[]) || [];
            const existingDescriptions = new Set(
              (existing as Array<{ description: string }>).map((s) => s.description.toLowerCase().slice(0, 50))
            );
            const uniqueNew = newSignals.filter(
              (s: { description: string }) => !existingDescriptions.has(s.description.toLowerCase().slice(0, 50))
            );
            const mergedSignals = [...existing, ...uniqueNew] as Signal[];
            prospects[prospectIndex].signals = mergedSignals;
            prospects[prospectIndex].last_signal_scan = new Date().toISOString().split("T")[0];
            const company = (prospects[prospectIndex].company as string) || "Unknown";
            const synthesis = synthesizeSignals(mergedSignals, company);
            prospects[prospectIndex].signal_score = synthesis.computedScore;
            prospects[prospectIndex].signal_synthesis = synthesis;
            const currentScore = prospects[prospectIndex].score as string;
            if (synthesis.recommendedRating !== currentScore) {
              const scoreHistory = (prospects[prospectIndex].score_history as ScoreChange[]) || [];
              scoreHistory.push({
                date: new Date().toISOString().split("T")[0],
                from: currentScore as "HOT" | "WARM" | "COLD", to: synthesis.recommendedRating,
                reason: `Signal synthesis: ${synthesis.summary.slice(0, 200)}`, signalScore: synthesis.computedScore,
              });
              prospects[prospectIndex].score_history = scoreHistory;
              prospects[prospectIndex].score = synthesis.recommendedRating;
              prospects[prospectIndex].score_reasoning = `[Auto-updated by signal synthesis] ${synthesis.summary}`;
            }
            await writeJSON(key, prospects);
          }
          sendSSE(res, "saved", { signals: newSignals, signal_score: signalScore, scan_summary: scanSummary });
        } catch { sendSSE(res, "error", "Could not parse signal scan results. Try again."); }
        sendSSE(res, "done", ""); res.end();
      },
      onError: (error) => { sendSSE(res, "error", error.message); res.end(); },
    }, { webSearch: true, model: "claude-haiku-4-5-20251001" });
}

async function handleContactEnrich(req: VercelRequest, res: VercelResponse) {
  const { prospectIndex, contactIndex } = req.body;
  if (prospectIndex === undefined || contactIndex === undefined) {
    res.status(400).json({ error: "prospectIndex and contactIndex required" }); return;
  }
  const key = getProspectsKey();
  const prospects = await readJSON<Record<string, unknown>[]>(key);
  if (prospectIndex < 0 || prospectIndex >= prospects.length) { res.status(404).json({ error: "Prospect not found" }); return; }
  const prospect = prospects[prospectIndex];
  const contacts = prospect.contacts as Array<{ name: string; title: string; linkedin?: string; email?: string }>;
  if (contactIndex < 0 || contactIndex >= contacts.length) { res.status(404).json({ error: "Contact not found" }); return; }
  const contact = contacts[contactIndex];
  const company = prospect.company as string;
  const website = prospect.website as string || "";
  const systemPrompt = `You are a sales research assistant. Find the LinkedIn profile URL and professional email for:
- Name: ${contact.name}
- Title: ${contact.title}
- Company: ${company}
- Website: ${website}

Search thoroughly. Return ONLY JSON: {"linkedin":"url or empty","email":"email or empty","email_confidence":"verified|pattern_match|guess|not_found","notes":"brief explanation"}`;

  setupSSE(res);
  let fullText = "";
  await streamChat(systemPrompt,
    [{ role: "user" as const, content: `Find LinkedIn and email for ${contact.name} at ${company}.` }],
    {
      onText: (text) => { fullText += text; sendSSE(res, "text", text); },
      onSearching: (query) => sendSSE(res, "searching", query),
      onSources: (sources) => sendSSE(res, "sources", sources),
      onDone: async () => {
        try {
          const result = JSON.parse(extractJSON(fullText));
          if (result.linkedin) contacts[contactIndex].linkedin = result.linkedin;
          if (result.email) contacts[contactIndex].email = result.email;
          prospects[prospectIndex].contacts = contacts;
          await writeJSON(key, prospects);
          sendSSE(res, "saved", { contactIndex, linkedin: result.linkedin || "", email: result.email || "", email_confidence: result.email_confidence || "not_found", notes: result.notes || "" });
        } catch { sendSSE(res, "error", "Could not parse contact research results. Try again."); }
        sendSSE(res, "done", ""); res.end();
      },
      onError: (error) => { sendSSE(res, "error", error.message); res.end(); },
    }, { webSearch: true, model: "claude-haiku-4-5-20251001" });
}

async function handleResearch(req: VercelRequest, res: VercelResponse) {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: "messages array required" }); return; }
  const systemPrompt = await buildResearchContext();
  setupSSE(res);
  await streamChat(systemPrompt, messages, {
    onText: (text) => sendSSE(res, "text", text),
    onSearching: (query) => sendSSE(res, "searching", query),
    onSources: (sources) => sendSSE(res, "sources", sources),
    onDone: () => { sendSSE(res, "done", ""); res.end(); },
    onError: (error) => { sendSSE(res, "error", error.message); res.end(); },
  }, { webSearch: true });
}

async function handleProspectSearch(req: VercelRequest, res: VercelResponse) {
  const { query, count = 5 } = req.body;
  if (!query || typeof query !== "string" || query.trim().length < 5) {
    res.status(400).json({ error: "Search query must be at least 5 characters" }); return;
  }
  const clampedCount = Math.min(Math.max(Number(count), 1), 15);
  const systemPrompt = await buildProspectSearchContext(query.trim(), clampedCount);
  setupSSE(res);
  let fullText = "";
  let hadError = false;
  await streamChat(systemPrompt,
    [{ role: "user" as const, content: `Find ${clampedCount} companies matching: ${query.trim()}` }],
    {
      onText: (text) => { fullText += text; sendSSE(res, "text", text); },
      onSearching: (q) => sendSSE(res, "searching", q),
      onSources: (sources) => sendSSE(res, "sources", sources),
      onDone: () => {
        if (hadError) return;
        try {
          const result = JSON.parse(extractJSON(fullText));
          sendSSE(res, "results", { prospects: result.prospects || [], summary: result.search_summary || "" });
        } catch { sendSSE(res, "error", "Could not parse search results. Try a more specific query."); }
        sendSSE(res, "done", ""); res.end();
      },
      onError: (error) => {
        hadError = true;
        const msg = error.message || String(error);
        sendSSE(res, "error", msg.includes("rate_limit") ? "Rate limit hit. Wait a minute and try again." : msg);
        sendSSE(res, "done", ""); res.end();
      },
    }, { webSearch: true, model: "claude-haiku-4-5-20251001" });
}
