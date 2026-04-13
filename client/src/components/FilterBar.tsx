const scores = ["HOT", "WARM", "COLD"] as const;
const statuses = ["new", "researched", "contacted", "replied", "meeting", "disqualified"] as const;

const scoreColors: Record<string, string> = {
  HOT: "border-red-500 bg-red-500/20 text-red-400",
  WARM: "border-amber-500 bg-amber-500/20 text-amber-400",
  COLD: "border-blue-500 bg-blue-500/20 text-blue-400",
};

interface Props {
  activeScores: Set<string>;
  activeStatuses: Set<string>;
  showNewSignals?: boolean;
  onToggleScore: (score: string) => void;
  onToggleStatus: (status: string) => void;
  onToggleNewSignals?: () => void;
  onClear: () => void;
}

export default function FilterBar({
  activeScores,
  activeStatuses,
  showNewSignals,
  onToggleScore,
  onToggleStatus,
  onToggleNewSignals,
  onClear,
}: Props) {
  const hasFilters = activeScores.size > 0 || activeStatuses.size > 0 || showNewSignals;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500 mr-1 uppercase tracking-wider font-medium">Score:</span>
      {scores.map((s) => (
        <button
          key={s}
          onClick={() => onToggleScore(s)}
          className={`px-2.5 py-1 text-xs rounded-lg border transition-all duration-200 font-medium ${
            activeScores.has(s)
              ? scoreColors[s]
              : "border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600"
          }`}
        >
          {s}
        </button>
      ))}
      {onToggleNewSignals && (
        <button
          onClick={onToggleNewSignals}
          className={`px-2.5 py-1 text-xs rounded-lg border transition-all duration-200 font-medium ${
            showNewSignals
              ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
              : "border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600"
          }`}
        >
          NEW SIGNALS
        </button>
      )}
      <span className="text-gray-700/50 mx-1">|</span>
      <span className="text-xs text-gray-500 mr-1 uppercase tracking-wider font-medium">Status:</span>
      {statuses.map((s) => (
        <button
          key={s}
          onClick={() => onToggleStatus(s)}
          className={`px-2.5 py-1 text-xs rounded-lg border transition-all duration-200 ${
            activeStatuses.has(s)
              ? "border-blue-500 bg-blue-500/20 text-blue-400"
              : "border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600"
          }`}
        >
          {s}
        </button>
      ))}
      {hasFilters && (
        <button
          onClick={onClear}
          className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
