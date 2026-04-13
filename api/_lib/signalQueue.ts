import { readJSON, writeJSON } from "./kvStore.js";
import type { Prospect } from "./types.js";

const PROSPECTS_KEY = "prospects:ais-leads";
const QUEUE_KEY = "signal-scan:queue";
const DIGEST_KEY = "signal-scan:digest";

export interface ScanQueueItem {
  prospectKey: string;
  prospectIndex: number;
  company: string;
  score: string;
  lastScan: string | null;
  priority: number;
}

export interface ScanQueueState {
  createdAt: string;
  queue: ScanQueueItem[];
  completed: ScanQueueItem[];
  scoreChanges: ScoreChangeRecord[];
  status: "building" | "processing" | "done";
}

export interface ScoreChangeRecord {
  company: string;
  from: string;
  to: string;
  signalScore: number;
  summary: string;
  scannedAt: string;
}

export interface WeeklyDigest {
  weekOf: string;
  totalScanned: number;
  scoreChanges: ScoreChangeRecord[];
  hotProspects: { company: string; signalScore: number }[];
  generatedAt: string;
}

export async function getQueueState(): Promise<ScanQueueState | null> {
  try {
    return await readJSON<ScanQueueState>(QUEUE_KEY);
  } catch {
    return null;
  }
}

export async function getLatestDigest(): Promise<WeeklyDigest | null> {
  try {
    return await readJSON<WeeklyDigest>(DIGEST_KEY);
  } catch {
    return null;
  }
}

export async function buildScanQueue(): Promise<ScanQueueState> {
  let prospects: Prospect[];
  try {
    prospects = await readJSON<Prospect[]>(PROSPECTS_KEY);
  } catch {
    prospects = [];
  }

  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;
  const queue: ScanQueueItem[] = [];

  for (let i = 0; i < prospects.length; i++) {
    const p = prospects[i];
    if (p.status === "disqualified") continue;

    const lastScan = p.last_signal_scan || null;
    const daysSinceLastScan = lastScan ? (now - new Date(lastScan).getTime()) / day : Infinity;

    let scanDue = false;
    if (p.score === "HOT") scanDue = daysSinceLastScan >= 7;
    else if (p.score === "WARM") scanDue = daysSinceLastScan >= 14;
    else scanDue = daysSinceLastScan >= 30;

    if (scanDue) {
      const priority =
        p.score === "HOT" ? 0 :
        p.score === "WARM" ? 1 : 2;

      queue.push({
        prospectKey: PROSPECTS_KEY,
        prospectIndex: i,
        company: p.company,
        score: p.score,
        lastScan,
        priority,
      });
    }
  }

  queue.sort((a, b) => a.priority - b.priority);

  const state: ScanQueueState = {
    createdAt: new Date().toISOString(),
    queue,
    completed: [],
    scoreChanges: [],
    status: "processing",
  };

  await writeJSON(QUEUE_KEY, state);
  return state;
}

export async function completeItem(
  item: ScanQueueItem,
  scoreChange?: ScoreChangeRecord
): Promise<void> {
  const state = await getQueueState();
  if (!state) return;
  state.queue = state.queue.filter(
    (q) => !(q.prospectKey === item.prospectKey && q.prospectIndex === item.prospectIndex)
  );
  state.completed.push(item);
  if (scoreChange) state.scoreChanges.push(scoreChange);
  if (state.queue.length === 0) state.status = "done";
  await writeJSON(QUEUE_KEY, state);
}

export async function generateDigest(): Promise<WeeklyDigest> {
  const state = await getQueueState();
  let prospects: Prospect[];
  try {
    prospects = await readJSON<Prospect[]>(PROSPECTS_KEY);
  } catch {
    prospects = [];
  }

  const hotProspects = prospects
    .filter((p) => p.signal_score && p.signal_score >= 70)
    .map((p) => ({ company: p.company, signalScore: p.signal_score! }))
    .sort((a, b) => b.signalScore - a.signalScore);

  const digest: WeeklyDigest = {
    weekOf: new Date().toISOString().split("T")[0],
    totalScanned: state?.completed.length || 0,
    scoreChanges: state?.scoreChanges || [],
    hotProspects,
    generatedAt: new Date().toISOString(),
  };

  await writeJSON(DIGEST_KEY, digest);
  return digest;
}
