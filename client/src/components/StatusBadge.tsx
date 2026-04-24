const colors: Record<string, string> = {
  new: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  researched: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  contacted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  replied: "bg-green-500/20 text-green-400 border-green-500/30",
  meeting: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  disqualified: "bg-gray-700/20 text-gray-500 border-gray-600/30",
};

export default function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status && typeof status === "string" ? status : "new";
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full border ${colors[s] || colors.new}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}
