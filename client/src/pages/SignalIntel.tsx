import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useProspects } from "../hooks/useProspects";

interface SignalOverview {
  totalProspects: number;
  scannedLast7Days: number;
  scannedLast14Days: number;
  scannedLast30Days: number;
  neverScanned: number;
  byScore: { HOT: number; WARM: number; COLD: number };
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
}

interface DigestData {
  digest: {
    weekOf: string;
    totalScanned: number;
    scoreChanges: Array<{
      company: string;
      configName: string;
      from: string;
      to: string;
      signalScore: number;
      summary: string;
      scannedAt: string;
    }>;
    hotProspects: Array<{
      company: string;
      configName: string;
      signalScore: number;
    }>;
    generatedAt: string;
  } | null;
  queue: {
    status: string;
    remaining: number;
    completed: number;
    scoreChanges: unknown[];
    createdAt: string;
  } | null;
}

interface DiscoveryData {
  configName: string;
  queue: {
    configName: string;
    createdAt: string;
    discoveries: Array<{
      company: string;
      website: string;
      industry: string;
      what_they_sell: string;
      hq: string;
      size: string;
      revenue: string;
      score: string;
      score_reasoning: string;
      pain_signals: string[];
      contacts: Array<{ name: string; title: string; linkedin: string; email: string }>;
      discovery_source: string;
      discovered_at: string;
    }>;
    approved: string[];
    dismissed: string[];
    status: string;
  } | null;
}

const scoreColor: Record<string, string> = {
  HOT: "text-red-400",
  WARM: "text-amber-400",
  COLD: "text-blue-400",
};

const scoreBg: Record<string, string> = {
  HOT: "bg-red-500/10 border-red-500/30",
  WARM: "bg-amber-500/10 border-amber-500/30",
  COLD: "bg-blue-500/10 border-blue-500/30",
};

function configLabel(_name: string): string {
  return "AIS";
}

function signalScoreColor(score: number): string {
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-amber-400";
  return "text-blue-400";
}

export default function SignalIntel() {
  const navigate = useNavigate();
  const { prospects } = useProspects();
  const [overview, setOverview] = useState<(SignalOverview & { configName?: string }) | null>(null);
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  // Map company names to their pipeline index for clickable links
  const companyIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    prospects.forEach((p, i) => {
      map.set(p.company.toLowerCase(), i);
    });
    return map;
  }, [prospects]);

  const getProspectIndex = (company: string): number | null => {
    return companyIndexMap.get(company.toLowerCase()) ?? null;
  };

  const handleProspectClick = (company: string) => {
    const idx = getProspectIndex(company);
    if (idx !== null) navigate(`/prospect/${idx}`);
  };

  const handleRunScan = async () => {
    setScanning(true);
    setScanStatus("Building scan queue...");
    try {
      let remaining = 1;
      let totalProcessed = 0;
      while (remaining > 0) {
        const res = await apiFetch<{
          status: string;
          processed?: Array<{ company: string; success: boolean; scoreChanged?: boolean }>;
          remaining: number;
          message?: string;
        }>("/cron/signal-scan", { method: "POST" });

        const batchCount = res.processed?.length || 0;
        totalProcessed += batchCount;
        remaining = res.remaining;

        if (res.status === "complete") {
          setScanStatus(`Scan complete — ${totalProcessed} prospects scanned`);
          remaining = 0;
        } else {
          setScanStatus(`Scanning... ${totalProcessed} done, ${remaining} remaining`);
        }
      }
      load();
    } catch (e) {
      setScanStatus(`Scan error: ${String(e)}`);
    } finally {
      setScanning(false);
      setTimeout(() => setScanStatus(""), 8000);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<SignalOverview & { configName?: string }>("/prospects/signal-overview").catch(() => null),
      apiFetch<DigestData>("/prospects/signal-digest").catch(() => null),
    ]).then(([ov, dg]) => {
      setOverview(ov);
      setDigest(dg);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reload when product config changes
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("configChanged", handler);
    return () => window.removeEventListener("configChanged", handler);
  }, [load]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-gray-500">Loading signal intelligence...</div>
      </div>
    );
  }

  const queueActive = digest?.queue && digest.queue.status === "processing";
  const hasDigest = digest?.digest;

  return (
    <div className="h-full overflow-y-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">Signal Intelligence</h2>
        <p className="text-sm text-gray-500">
          Automated buying signal detection — {overview?.configName ? configLabel(overview.configName) : "loading"}
        </p>
      </div>

      {/* Engine Status */}
      <div className="mb-6 p-4 bg-gray-900/80 border border-gray-800/60 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${queueActive || scanning ? "bg-green-500 animate-pulse" : "bg-gray-600"}`} />
            <span className="text-sm font-medium text-white">
              {scanning ? scanStatus : queueActive ? "Engine Active — Scanning" : "Engine Idle — Next scan Monday 5am"}
            </span>
          </div>
          {!scanning && !queueActive && (
            <button
              onClick={handleRunScan}
              className="text-xs font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Run Scan Now
            </button>
          )}
          {queueActive && digest?.queue && (
            <span className="text-xs text-gray-400">
              {digest.queue.completed} scanned / {digest.queue.remaining + digest.queue.completed} total
            </span>
          )}
        </div>
        {queueActive && digest?.queue && (
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(digest.queue.completed / (digest.queue.remaining + digest.queue.completed)) * 100}%` }}
            />
          </div>
        )}
        {hasDigest && !scanning && (
          <div className="text-xs text-gray-500 mt-2">
            Last digest: {new Date(digest.digest!.generatedAt).toLocaleDateString()} — {digest.digest!.totalScanned} prospects scanned
          </div>
        )}
        {!scanning && scanStatus && (
          <div className="text-xs text-green-400 mt-2">{scanStatus}</div>
        )}
      </div>

      {/* Stats Grid */}
      {overview && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Prospects" value={overview.totalProspects} color="text-white" />
          <StatCard label="Scanned (7d)" value={overview.scannedLast7Days} color="text-green-400" />
          <StatCard label="Scanned (30d)" value={overview.scannedLast7Days + overview.scannedLast14Days + overview.scannedLast30Days} color="text-blue-400" />
          <StatCard label="Never Scanned" value={overview.neverScanned} color={overview.neverScanned > 0 ? "text-amber-400" : "text-gray-500"} />
        </div>
      )}

      {/* Scan Cadence */}
      {overview && (
        <div className="mb-6 p-4 bg-gray-900/80 border border-gray-800/60 rounded-xl">
          <h3 className="text-sm font-semibold text-white mb-3">Scan Cadence</h3>
          <div className="grid grid-cols-3 gap-4">
            <CadenceCard
              label="HOT"
              count={overview.byScore.HOT}
              frequency="Weekly"
              color="text-red-400"
              bgColor="bg-red-500/10"
            />
            <CadenceCard
              label="WARM"
              count={overview.byScore.WARM}
              frequency="Biweekly"
              color="text-amber-400"
              bgColor="bg-amber-500/10"
            />
            <CadenceCard
              label="COLD"
              count={overview.byScore.COLD}
              frequency="Monthly"
              color="text-blue-400"
              bgColor="bg-blue-500/10"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Top Signal Prospects — Priority Outreach */}
        <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Priority Outreach
          </h3>
          <p className="text-xs text-gray-500 mb-4">Highest signal scores — reach out to these first</p>
          {overview?.topSignalProspects && overview.topSignalProspects.length > 0 ? (
            <div className="space-y-2">
              {overview.topSignalProspects.slice(0, 12).map((p, i) => {
                const clickable = getProspectIndex(p.company) !== null;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/40 ${clickable ? "cursor-pointer hover:bg-gray-800/70 transition-colors" : ""}`}
                    onClick={() => clickable && handleProspectClick(p.company)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-sm font-bold w-8 ${signalScoreColor(p.signalScore)}`}>
                        {p.signalScore}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm truncate ${clickable ? "text-blue-400 hover:text-blue-300" : "text-white"}`}>{p.company}</div>
                        <div className="text-xs text-gray-500">{configLabel(p.config)}</div>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${scoreBg[p.score]} ${scoreColor[p.score]}`}>
                      {p.score}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 py-8 text-center">
              No signal scores yet. Run signal scans on prospects to populate this view.
            </div>
          )}
        </div>

        {/* Score Changes */}
        <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            Score Changes
          </h3>
          <p className="text-xs text-gray-500 mb-4">Prospects that changed score based on signal detection</p>
          {overview?.recentScoreChanges && overview.recentScoreChanges.length > 0 ? (
            <div className="space-y-2">
              {overview.recentScoreChanges.slice(0, 12).map((sc, i) => {
                const clickable = getProspectIndex(sc.company) !== null;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/40 ${clickable ? "cursor-pointer hover:bg-gray-800/70 transition-colors" : ""}`}
                    onClick={() => clickable && handleProspectClick(sc.company)}
                  >
                    <div className="min-w-0">
                      <div className={`text-sm truncate ${clickable ? "text-blue-400 hover:text-blue-300" : "text-white"}`}>{sc.company}</div>
                      <div className="text-xs text-gray-500">{configLabel(sc.config)} — {sc.date}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-medium ${scoreColor[sc.from]}`}>{sc.from}</span>
                      <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <span className={`text-xs font-medium ${scoreColor[sc.to]}`}>{sc.to}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 py-8 text-center">
              No score changes recorded yet. Changes appear after signal scans detect new buying indicators.
            </div>
          )}
        </div>
      </div>

      {/* Weekly Digest */}
      {hasDigest && digest.digest!.scoreChanges.length > 0 && (
        <div className="mt-6 bg-gray-900/80 border border-gray-800/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Weekly Digest — {digest.digest!.weekOf}
          </h3>
          <div className="space-y-3">
            {digest.digest!.scoreChanges.map((sc, i) => {
              const clickable = getProspectIndex(sc.company) !== null;
              return (
              <div
                key={i}
                className={`p-3 rounded-lg bg-gray-800/40 ${clickable ? "cursor-pointer hover:bg-gray-800/70 transition-colors" : ""}`}
                onClick={() => clickable && handleProspectClick(sc.company)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${clickable ? "text-blue-400 hover:text-blue-300" : "text-white"}`}>{sc.company}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium ${scoreColor[sc.from]}`}>{sc.from}</span>
                    <span className="text-gray-600">→</span>
                    <span className={`text-xs font-medium ${scoreColor[sc.to]}`}>{sc.to}</span>
                    <span className={`text-xs font-bold ml-2 ${signalScoreColor(sc.signalScore)}`}>{sc.signalScore}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">{sc.summary}</p>
              </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function CadenceCard({ label, count, frequency, color, bgColor }: {
  label: string; count: number; frequency: string; color: string; bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-3 text-center`}>
      <div className={`text-lg font-bold ${color}`}>{count}</div>
      <div className={`text-xs font-medium ${color}`}>{label}</div>
      <div className="text-xs text-gray-500 mt-1">Scan {frequency}</div>
    </div>
  );
}
