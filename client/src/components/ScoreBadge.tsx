const colors = {
  HOT: "bg-red-500/20 text-red-400 border-red-500/30 shadow-red-500/10",
  WARM: "bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-amber-500/10",
  COLD: "bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-blue-500/10",
};

export default function ScoreBadge({ score }: { score: "HOT" | "WARM" | "COLD" }) {
  return (
    <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full border shadow-sm tracking-wide ${colors[score]}`}>
      {score}
    </span>
  );
}
