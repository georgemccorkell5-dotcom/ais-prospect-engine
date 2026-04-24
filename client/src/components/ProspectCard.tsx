import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ScoreBadge from "./ScoreBadge";
import type { Prospect } from "../lib/types";
import { apiFetch } from "../lib/api";
import { recentSignalCount, signalScoreColor } from "../lib/signals";

const STATUSES = ["new", "researched", "contacted", "replied", "meeting", "disqualified"] as const;

const statusColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  new:          { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/40", dot: "bg-yellow-400" },
  researched:   { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/40", dot: "bg-purple-400" },
  contacted:    { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/40",   dot: "bg-blue-400" },
  replied:      { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/40",  dot: "bg-green-400" },
  meeting:      { text: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/40",dot: "bg-emerald-400" },
  disqualified: { text: "text-gray-500",   bg: "bg-gray-700/10",   border: "border-gray-600/40",   dot: "bg-gray-500" },
};

function capitalize(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ProspectCard({
  prospect,
  index,
  onStatusChange,
}: {
  prospect: Prospect;
  index: number;
  onStatusChange?: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recentSignals = recentSignalCount(prospect.signals || [], 14);
  const hasSignalScore = prospect.signal_score !== undefined && prospect.signal_score > 0;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleStatusSelect = async (newStatus: string) => {
    setOpen(false);
    if (newStatus === prospect.status) return;
    try {
      await apiFetch(`/prospects/${index}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange?.();
    } catch (e) {
      console.error("Status update failed:", e);
    }
  };

  const colors = statusColors[prospect.status] || statusColors.new;

  return (
    <div
      onClick={() => navigate(`/prospect/${index}`)}
      className="group bg-gray-900/80 border border-gray-800/60 rounded-xl p-5 hover:border-gray-600/80 hover:bg-gray-900 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">{prospect.company}</h3>
        <div className="flex items-center gap-2">
          {hasSignalScore && (
            <span className={`text-xs font-bold ${signalScoreColor(prospect.signal_score!)}`} title={`Signal Score: ${prospect.signal_score}`}>
              {prospect.signal_score}
            </span>
          )}
          {recentSignals > 0 && (
            <span className="relative flex h-2 w-2" title={`${recentSignals} new signal${recentSignals !== 1 ? "s" : ""}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
          )}
          <ScoreBadge score={prospect.score} />
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-3 line-clamp-1">{prospect.industry}</p>
      <div className="flex items-center gap-2 mb-3">
        <div ref={dropdownRef} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${colors.bg} ${colors.border} ${colors.text} transition-all duration-200 hover:brightness-125`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            {capitalize(prospect.status)}
            <svg className={`w-3 h-3 ml-0.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute z-50 top-full left-0 mt-1 w-40 bg-gray-900 border border-gray-700/50 rounded-lg shadow-xl shadow-black/40 py-1 overflow-hidden"
            >
              {STATUSES.map((s) => {
                const sc = statusColors[s];
                const isActive = s === prospect.status;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusSelect(s)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                      isActive ? `${sc.bg} ${sc.text} font-medium` : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                    {capitalize(s)}
                    {isActive && (
                      <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500">{prospect.size}</span>
      </div>
      <div className="text-xs text-gray-500 mb-1">{prospect.revenue}</div>
      <div className="text-xs mt-2 text-gray-500">
        {prospect.next_action}
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800/50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/outreach/${index}`);
          }}
          className="text-xs px-3 py-1.5 bg-blue-900/60 text-blue-300 rounded-lg hover:bg-blue-800/70 transition-all duration-200 font-medium border border-blue-800/40"
        >
          Draft Outreach
        </button>
      </div>
    </div>
  );
}
