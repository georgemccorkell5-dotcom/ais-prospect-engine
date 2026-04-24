import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProspects } from "../hooks/useProspects";
import { useConfig } from "../hooks/useConfig";
import { apiFetch } from "../lib/api";
import ProspectCard from "../components/ProspectCard";
import FilterBar from "../components/FilterBar";
import { recentSignalCount } from "../lib/signals";

function getVertical(industry: string | null | undefined): string {
  if (!industry || typeof industry !== "string") return "";
  const match = industry.match(/^(.+?)(?:\s[—\-]\s)/);
  return match ? match[1] : industry;
}

export default function Dashboard() {
  const { prospects, loading, error, reload: load } = useProspects();
  const { active } = useConfig();
  const navigate = useNavigate();
  const [activeScores, setActiveScores] = useState<Set<string>>(new Set());
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [activeVertical, setActiveVertical] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNewSignals, setShowNewSignals] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ company: "", website: "" });
  const [adding, setAdding] = useState(false);

  const handleAddProspect = async () => {
    if (!addForm.company.trim()) return;
    setAdding(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await apiFetch<{ index: number }>("/prospects", {
        method: "POST",
        body: JSON.stringify({
          company: addForm.company.trim(),
          website: addForm.website.trim(),
          industry: "",
          what_they_sell: "",
          hq: "",
          size: "",
          revenue: "",
          funding: "",
          crm: "Unknown",
          contacts: [],
          pain_signals: [],
          score: "COLD" as const,
          score_reasoning: "Newly added — needs research",
          status: "new" as const,
          last_action: `Added to pipeline ${today}`,
          next_action: "Run deep research",
          next_action_date: today,
          product_config: active?.name || "unknown",
          notes: "",
        }),
      });
      setShowAddModal(false);
      setAddForm({ company: "", website: "" });
      navigate(`/prospect/${res.index}`);
    } catch (e) {
      alert("Failed to add prospect: " + String(e));
    } finally {
      setAdding(false);
    }
  };

  const verticals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prospects) {
      const v = getVertical(p.industry);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [prospects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return prospects.filter((p) => {
      if (q && !(p.company || "").toLowerCase().includes(q)) return false;
      if (activeVertical && getVertical(p.industry) !== activeVertical) return false;
      if (activeScores.size > 0 && !activeScores.has(p.score)) return false;
      if (showNewSignals && !(p.signals && recentSignalCount(p.signals, 14) > 0)) return false;
      if (activeStatuses.size > 0) {
        if (!activeStatuses.has(p.status)) return false;
      } else {
        if (p.status === "disqualified") return false;
      }
      return true;
    });
  }, [prospects, activeScores, activeStatuses, activeVertical, search, showNewSignals]);

  const stats = useMemo(() => {
    const pool = (activeVertical
      ? prospects.filter((p) => getVertical(p.industry) === activeVertical)
      : prospects
    ).filter((p) => p.status !== "disqualified");
    const hot = pool.filter((p) => p.score === "HOT").length;
    const warm = pool.filter((p) => p.score === "WARM").length;
    const cold = pool.filter((p) => p.score === "COLD").length;
    const withNewSignals = pool.filter(
      (p) => p.signals && recentSignalCount(p.signals, 14) > 0
    ).length;
    return { total: pool.length, hot, warm, cold, withNewSignals };
  }, [prospects, activeVertical]);

  const toggleScore = (s: string) => {
    setActiveScores((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const toggleStatus = (s: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-gray-500">Loading pipeline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Pipeline</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies..."
                className="pl-9 pr-3 py-2 w-64 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              title="Add prospect"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 mb-4">
          <StatCard label="Total" value={stats.total} color="text-white" accent="from-gray-800 to-gray-900" />
          <StatCard label="HOT" value={stats.hot} color="text-red-400" accent="from-gray-800 to-gray-900" />
          <StatCard label="WARM" value={stats.warm} color="text-amber-400" accent="from-gray-800 to-gray-900" />
          <StatCard label="COLD" value={stats.cold} color="text-blue-400" accent="from-gray-800 to-gray-900" />
          <StatCard
            label="New Signals"
            value={stats.withNewSignals}
            color={stats.withNewSignals > 0 ? "text-cyan-400" : "text-gray-400"}
            accent="from-gray-800 to-gray-900"
          />
        </div>
      </div>

      {/* Vertical Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          onClick={() => setActiveVertical(null)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 font-medium ${
            activeVertical === null
              ? "border-purple-500 bg-purple-500/20 text-purple-400"
              : "border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600"
          }`}
        >
          All ({prospects.length})
        </button>
        {verticals.map((v) => (
          <button
            key={v.name}
            onClick={() => setActiveVertical(activeVertical === v.name ? null : v.name)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 font-medium ${
              activeVertical === v.name
                ? "border-purple-500 bg-purple-500/20 text-purple-400"
                : "border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}
          >
            {v.name} ({v.count})
          </button>
        ))}
      </div>

      <div className="mb-4">
        <FilterBar
          activeScores={activeScores}
          activeStatuses={activeStatuses}
          showNewSignals={showNewSignals}
          onToggleScore={toggleScore}
          onToggleStatus={toggleStatus}
          onToggleNewSignals={() => setShowNewSignals(!showNewSignals)}
          onClear={() => {
            setActiveScores(new Set());
            setActiveStatuses(new Set());
            setActiveVertical(null);
            setShowNewSignals(false);
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p, i) => {
          // Find the original index in the unfiltered list
          const originalIndex = prospects.indexOf(p);
          return (
            <ProspectCard key={originalIndex} prospect={p} index={originalIndex} onStatusChange={load} />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          No prospects match the current filters.
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Add Prospect</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Company Name *</label>
                <input
                  type="text"
                  value={addForm.company}
                  onChange={(e) => setAddForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Fastenal Construction Supplies"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAddProspect()}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Website</label>
                <input
                  type="text"
                  value={addForm.website}
                  onChange={(e) => setAddForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="e.g. https://fastenal.com"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleAddProspect()}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setShowAddModal(false); setAddForm({ company: "", website: "" }); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProspect}
                disabled={adding || !addForm.company.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                {adding ? "Adding..." : "Add & Research"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  accent,
}: {
  label: string;
  value: number;
  color: string;
  accent: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${accent} border border-gray-800/60 rounded-xl p-4`}>
      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
