import { useState } from "react";
import type { Signal, SignalSynthesis, ScoreChange } from "../lib/types";
import {
  decayedStrength,
  daysSince,
  signalTypeLabel,
  signalCategoryLabel,
  signalCategoryColor,
  strengthColor,
  signalScoreColor,
  signalScoreLabel,
} from "../lib/signals";

interface SignalPanelProps {
  signals: Signal[];
  signalScore?: number;
  signalSynthesis?: SignalSynthesis;
  scoreHistory?: ScoreChange[];
  lastScanDate?: string;
  onScan: () => void;
  scanning: boolean;
  scanStatus: string;
}

export default function SignalPanel({
  signals,
  signalScore,
  signalSynthesis,
  scoreHistory,
  lastScanDate,
  onScan,
  scanning,
  scanStatus,
}: SignalPanelProps) {
  const sorted = [...signals].sort(
    (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
  );

  const score = signalSynthesis?.computedScore ?? signalScore ?? 0;
  const [showInferenceChain, setShowInferenceChain] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const SIGNAL_PREVIEW_COUNT = 5;

  return (
    <div className="border border-gray-800/60 rounded-xl p-5 bg-gray-900/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <span className="text-base">&#9889;</span>
          <span className="uppercase tracking-wider">Signal Detection</span>
          {signals.length > 0 && (
            <span className="text-xs text-gray-600 font-normal ml-1">
              {signals.length} signal{signals.length !== 1 ? "s" : ""}
            </span>
          )}
        </h3>
        <button
          onClick={onScan}
          disabled={scanning}
          className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-200 font-medium border ${
            scanning
              ? "bg-cyan-600/10 border-cyan-500/20 text-cyan-500 cursor-not-allowed"
              : "bg-cyan-600/15 border-cyan-500/30 hover:bg-cyan-600/25 text-cyan-400"
          }`}
        >
          {scanning ? "Scanning..." : "Scan for Signals"}
        </button>
      </div>

      {/* Scan status */}
      {scanning && scanStatus && (
        <div className="mb-4 px-3 py-2 bg-cyan-900/20 border border-cyan-700/30 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-cyan-300">{scanStatus}</span>
          </div>
        </div>
      )}

      {/* Signal Score + Synthesis Summary */}
      {(signals.length > 0 || signalScore !== undefined) && (
        <div className="mb-4 p-3 bg-gray-800/40 rounded-lg border border-gray-700/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Buying Readiness Score</div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${signalScoreColor(score)}`}>{score}</span>
                <span className="text-xs text-gray-500">/100</span>
                {signalSynthesis && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
                    signalSynthesis.recommendedRating === "HOT"
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : signalSynthesis.recommendedRating === "WARM"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                  }`}>
                    {signalSynthesis.recommendedRating}
                  </span>
                )}
              </div>
              <div className={`text-xs mt-0.5 ${signalScoreColor(score)}`}>{signalScoreLabel(score)}</div>
            </div>
            <div className="text-right">
              {lastScanDate && (
                <div className="text-xs text-gray-600">
                  Last scan: {lastScanDate}
                  {daysSince(lastScanDate) > 7 && (
                    <span className="text-amber-500 ml-1">(stale)</span>
                  )}
                </div>
              )}
              {signalSynthesis && (
                <div className="text-xs text-gray-600 mt-0.5">
                  Synthesized: {signalSynthesis.synthesizedAt}
                </div>
              )}
            </div>
          </div>
          {/* Score bar */}
          <div className="mt-2 w-full bg-gray-700/50 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : score >= 40 ? "bg-amber-500" : score >= 20 ? "bg-blue-500" : "bg-gray-600"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>

          {/* Synthesis Summary */}
          {signalSynthesis && (
            <p className="mt-3 text-xs text-gray-400 leading-relaxed">
              {signalSynthesis.summary}
            </p>
          )}
        </div>
      )}

      {/* Category Breakdown */}
      {signalSynthesis && signalSynthesis.categoryBreakdown.length > 0 && (
        <div className="mb-4 p-3 bg-gray-800/40 rounded-lg border border-gray-700/30">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Signal Breakdown by Category</div>
          <div className="space-y-2">
            {signalSynthesis.categoryBreakdown.map((cat) => {
              const color = signalCategoryColor(cat.category);
              const maxContribution = signalSynthesis.categoryBreakdown[0].totalContribution;
              const barWidth = maxContribution > 0 ? (cat.totalContribution / maxContribution) * 100 : 0;
              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-medium ${color.text}`}>
                      {signalCategoryLabel(cat.category)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {cat.signalCount} signal{cat.signalCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700/50 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${
                        color.text.replace("text-", "bg-")
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Recommendations */}
      {signalSynthesis && signalSynthesis.recommendations.length > 0 && (
        <div className="mb-4 p-3 bg-gray-800/40 rounded-lg border border-gray-700/30">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Recommended Actions</div>
          <div className="space-y-1.5">
            {signalSynthesis.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-2 text-xs text-gray-300 leading-relaxed">
                <span className="text-cyan-500 shrink-0 mt-0.5">{i < 3 ? ["1.", "2.", "3."][i] : `${i + 1}.`}</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Change History */}
      {scoreHistory && scoreHistory.length > 0 && (
        <div className="mb-4 p-3 bg-gray-800/40 rounded-lg border border-gray-700/30">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Score History</div>
          <div className="space-y-1.5">
            {[...scoreHistory].reverse().map((change, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-600 shrink-0 w-20">{change.date}</span>
                <ScoreLabel score={change.from} />
                <span className="text-gray-600">&rarr;</span>
                <ScoreLabel score={change.to} />
                <span className="text-gray-500 truncate" title={change.reason}>
                  (score: {change.signalScore})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inference Chain Toggle */}
      {signalSynthesis && signalSynthesis.contributions.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowInferenceChain(!showInferenceChain)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-medium uppercase tracking-wider"
          >
            {showInferenceChain ? "Hide" : "Show"} Inference Chain ({signalSynthesis.contributions.length} signals)
          </button>
          {showInferenceChain && (
            <div className="mt-2 p-3 bg-gray-800/40 rounded-lg border border-gray-700/30 space-y-1.5">
              <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 text-xs text-gray-500 pb-1 border-b border-gray-700/30 font-medium">
                <span>Signal</span>
                <span className="text-right">Raw</span>
                <span className="text-right">Decayed</span>
                <span className="text-right">Weight</span>
              </div>
              {signalSynthesis.contributions.map((c, i) => {
                const catColor = signalCategoryColor(c.signal.category);
                return (
                  <div key={i} className="grid grid-cols-[1fr_60px_60px_60px] gap-2 text-xs items-start">
                    <div className="min-w-0">
                      <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-medium mr-1 ${catColor.bg} ${catColor.text} border ${catColor.border}`}>
                        {signalTypeLabel(c.signal.type)}
                      </span>
                      <span className="text-gray-400 break-words">{c.signal.description.slice(0, 80)}{c.signal.description.length > 80 ? "..." : ""}</span>
                    </div>
                    <span className="text-gray-500 text-right">{(c.signal.strength * 100).toFixed(0)}%</span>
                    <span className="text-gray-400 text-right">{(c.decayedStrength * 100).toFixed(0)}%</span>
                    <span className={`text-right font-medium ${c.contribution >= 0.5 ? "text-cyan-400" : "text-gray-500"}`}>
                      {c.contribution.toFixed(2)}
                    </span>
                  </div>
                );
              })}
              <div className="pt-1 border-t border-gray-700/30 grid grid-cols-[1fr_60px_60px_60px] gap-2 text-xs">
                <span className="text-gray-400 font-medium">Total (before diminishing returns)</span>
                <span />
                <span />
                <span className="text-right text-cyan-400 font-medium">
                  {signalSynthesis.contributions.reduce((sum, c) => sum + c.contribution, 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signal Timeline */}
      {sorted.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">
          No signals detected yet. Run a scan to find buying signals.
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              Signal Timeline
            </span>
            {sorted.length > SIGNAL_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllSignals(!showAllSignals)}
                className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors font-medium"
              >
                {showAllSignals
                  ? "Show recent"
                  : `Show all ${sorted.length} signals`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(showAllSignals ? sorted : sorted.slice(0, SIGNAL_PREVIEW_COUNT)).map((signal, i) => (
              <SignalCard key={i} signal={signal} />
            ))}
          </div>
          {!showAllSignals && sorted.length > SIGNAL_PREVIEW_COUNT && (
            <button
              onClick={() => setShowAllSignals(true)}
              className="mt-2 w-full py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-800/60 rounded-lg hover:border-gray-700/60"
            >
              + {sorted.length - SIGNAL_PREVIEW_COUNT} more signals
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreLabel({ score }: { score: string }) {
  const colors: Record<string, string> = {
    HOT: "text-red-400",
    WARM: "text-amber-400",
    COLD: "text-blue-400",
  };
  return <span className={`font-medium ${colors[score] || "text-gray-400"}`}>{score}</span>;
}

function SignalCard({ signal }: { signal: Signal }) {
  const age = daysSince(signal.detected_at);
  const currentStrength = decayedStrength(signal);
  const catColor = signalCategoryColor(signal.category);
  const isRecent = age <= 7;

  return (
    <div className={`p-3 rounded-lg border ${catColor.border} ${catColor.bg} transition-all duration-200`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${catColor.bg} ${catColor.text} border ${catColor.border}`}>
              {signalTypeLabel(signal.type)}
            </span>
            <span className="text-xs text-gray-500">
              {signalCategoryLabel(signal.category)}
            </span>
            {isRecent && (
              <span className="text-xs text-cyan-400 font-medium">NEW</span>
            )}
          </div>
          <p className="text-sm text-gray-200 leading-relaxed">{signal.description}</p>
          {signal.source && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-xs text-gray-600">Source:</span>
              {signal.source_url ? (
                <a
                  href={signal.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors truncate"
                >
                  {signal.source}
                </a>
              ) : (
                <span className="text-xs text-gray-500">{signal.source}</span>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-500">{signal.detected_at}</div>
          <div className="text-xs text-gray-600 mt-0.5">
            {age === 0 ? "Today" : `${age}d ago`}
          </div>
        </div>
      </div>
      {/* Strength bar */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-600 w-14 shrink-0">Strength</span>
        <div className="flex-1 bg-gray-700/50 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all duration-300 ${strengthColor(currentStrength)}`}
            style={{ width: `${currentStrength * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-8 text-right">{Math.round(currentStrength * 100)}%</span>
      </div>
    </div>
  );
}
