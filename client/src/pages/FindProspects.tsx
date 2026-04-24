import { useState, useRef, useMemo } from "react";
import { apiStream, apiFetch } from "../lib/api";
import { useConfig } from "../hooks/useConfig";
import { useProspects } from "../hooks/useProspects";
import type { Prospect } from "../lib/types";
import ScoreBadge from "../components/ScoreBadge";

function normalize(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractDomain(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return normalize(url);
  }
}

function isDuplicate(prospect: Prospect, pipelineNames: Set<string>, pipelineDomains: Set<string>): boolean {
  const name = normalize(prospect.company);
  if (!name) return false;
  if (pipelineNames.has(name)) return true;
  for (const pn of pipelineNames) {
    if (pn.length > 3 && name.length > 3 && (pn.includes(name) || name.includes(pn))) return true;
  }
  if (prospect.website) {
    const domain = extractDomain(prospect.website);
    if (domain && pipelineDomains.has(domain)) return true;
  }
  return false;
}

const COUNT_OPTIONS = [
  { value: 5, label: "5", cost: "~$0.30–0.40" },
  { value: 10, label: "10", cost: "~$0.50–0.70" },
  { value: 15, label: "15", cost: "~$0.75–1.00" },
];

function loadSession() {
  try {
    const raw = sessionStorage.getItem("findProspects");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { query: string; results: Prospect[]; summary: string; added: number[] };
    // Defend against corrupt cached results — drop anything missing a company
    if (Array.isArray(parsed.results)) {
      parsed.results = parsed.results.filter((p) => p && typeof p.company === "string" && p.company.length > 0);
    }
    return parsed;
  } catch {
    // If parsing fails, clear the bad cache so the page can load
    try { sessionStorage.removeItem("findProspects"); } catch { /* ignore */ }
    return null;
  }
}

function saveSession(query: string, results: Prospect[], summary: string, added: Set<number>) {
  try {
    sessionStorage.setItem("findProspects", JSON.stringify({ query, results, summary, added: Array.from(added) }));
  } catch { /* ignore */ }
}

export default function FindProspects() {
  const { active } = useConfig();
  const { prospects: pipeline } = useProspects();
  const cached = useRef(loadSession()).current;
  const [query, setQuery] = useState(cached?.query || "");
  const [count, setCount] = useState(5);
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [results, setResults] = useState<Prospect[]>(cached?.results || []);
  const [summary, setSummary] = useState(cached?.summary || "");
  const [error, setError] = useState("");

  // Build lookup sets from current pipeline for duplicate detection
  const { pipelineNames, pipelineDomains } = useMemo(() => {
    const names = new Set(pipeline.map((p) => normalize(p.company)));
    const domains = new Set(pipeline.filter((p) => p.website).map((p) => extractDomain(p.website)));
    return { pipelineNames: names, pipelineDomains: domains };
  }, [pipeline]);
  const [added, setAdded] = useState<Set<number>>(new Set(cached?.added || []));
  const [adding, setAdding] = useState<Set<number>>(new Set());
  const controllerRef = useRef<AbortController | null>(null);

  const estimatedCost = COUNT_OPTIONS.find((c) => c.value === count)?.cost || "~$0.30";

  // Persist results across navigation
  const saveResults = (r: Prospect[], s: string, a: Set<number>) => {
    saveSession(query, r, s, a);
  };

  const handleSearch = () => {
    if (query.trim().length < 5) return;
    setSearching(true);
    setSearchStatus("Starting search...");
    setResults([]);
    setSummary("");
    setError("");
    setAdded(new Set());

    controllerRef.current = apiStream("/chat/prospect-search", { query: query.trim(), count }, {
      onText: () => {},
      onSearching: (q) => setSearchStatus(`Searching: ${q}`),
      onSources: () => {},
      onSaved: (data) => {
        const d = data as { prospects?: Prospect[]; summary?: string };
        if (d.prospects) {
          setResults(d.prospects);
          const s = d.summary || "";
          setSummary(s);
          saveSession(query, d.prospects, s, new Set());
        }
      },
      onDone: () => { setSearching(false); setSearchStatus(""); },
      onError: (e) => {
        const msg = e.includes("rate_limit")
          ? "Rate limit hit. Wait a minute and try again."
          : e.includes("Could not parse")
          ? "Search completed but couldn't parse results. Try a more specific query."
          : e.length > 200 ? "Something went wrong. Try again in a moment." : e;
        setError(msg);
        setSearching(false);
        setSearchStatus("");
      },
    });

    // Also listen for "results" event via the saved handler
    // The apiStream treats "results" as unknown, but we handle it via onSaved
  };

  const handleCancel = () => {
    controllerRef.current?.abort();
    setSearching(false);
    setSearchStatus("");
  };

  const handleAdd = async (idx: number) => {
    const prospect = results[idx];
    if (!prospect) return;
    setAdding((prev) => new Set(prev).add(idx));
    try {
      await apiFetch("/prospects", {
        method: "POST",
        body: JSON.stringify(prospect),
      });
      setAdded((prev) => {
        const next = new Set(prev).add(idx);
        saveSession(query, results, summary, next);
        return next;
      });
    } catch (e) {
      console.error("Failed to add prospect:", e);
    } finally {
      setAdding((prev) => { const next = new Set(prev); next.delete(idx); return next; });
    }
  };

  const handleAddAll = async () => {
    for (let i = 0; i < results.length; i++) {
      if (!added.has(i)) {
        await handleAdd(i);
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">Find Prospects</h2>
        <p className="text-sm text-gray-500">
          Search for new ICP-matching companies. Results are scored against the active product config.
        </p>
        {active?.name && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-xs text-blue-300 font-medium">
              Searching for: {active.name.replace(/-/g, " ")}
            </span>
          </div>
        )}
      </div>

      {/* Search Form */}
      <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5 mb-6">
        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">
            What are you looking for?
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !searching && query.trim().length >= 5 && handleSearch()}
            placeholder='e.g. "community banks in Twin Cities under 200 employees" or "B2B SaaS companies in Minnesota with 50+ sales reps"'
            className="w-full bg-gray-800/70 border border-gray-700/50 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            disabled={searching}
          />
        </div>

        <div className="flex items-end gap-4">
          {/* Count Selector */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">
              How many?
            </label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCount(opt.value)}
                  disabled={searching}
                  className={`px-4 py-2 text-sm rounded-lg border transition-all duration-200 ${
                    count === opt.value
                      ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
                      : "border-gray-700/50 text-gray-400 hover:text-gray-300 hover:border-gray-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Estimated API cost: <span className="text-gray-400 font-medium">{estimatedCost}</span></span>
            </div>
          </div>

          {/* Search / Cancel Button */}
          {searching ? (
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 text-sm rounded-lg bg-red-900/40 text-red-400 border border-red-800/40 hover:bg-red-900/60 transition-all duration-200 font-medium"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleSearch}
              disabled={query.trim().length < 5}
              className="px-5 py-2.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all duration-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Search
            </button>
          )}
        </div>
      </div>

      {/* Search Status */}
      {searching && (
        <div className="mb-6 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">{searchStatus}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-800/40 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Found {results.length} prospect{results.length !== 1 ? "s" : ""}
              </h3>
              {summary && <p className="text-xs text-gray-500 mt-1">{summary}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {added.size} of {results.length} added
              </span>
              {added.size < results.length && (
                <button
                  onClick={handleAddAll}
                  className="px-3 py-1.5 text-xs rounded-lg bg-green-900/40 text-green-400 border border-green-800/40 hover:bg-green-900/60 transition-all duration-200 font-medium"
                >
                  Add All to Pipeline
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {results.map((prospect, idx) => (
              <ResultCard
                key={idx}
                prospect={prospect}
                isAdded={added.has(idx)}
                isAdding={adding.has(idx)}
                isDuplicate={isDuplicate(prospect, pipelineNames, pipelineDomains)}
                onAdd={() => handleAdd(idx)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Summary with no results */}
      {!searching && results.length === 0 && summary && !error && (
        <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-2">No prospects found</h3>
          <p className="text-sm text-gray-400">{summary}</p>
          <p className="text-xs text-gray-500 mt-3">Try broadening your search or switching the active product tab.</p>
        </div>
      )}

      {/* Empty State */}
      {!searching && results.length === 0 && !summary && !error && (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-gray-500 text-sm">
            Describe the type of companies you're looking for and we'll find ICP matches.
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Results are matched against the active product config. Switch tabs first if needed.
          </p>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  prospect,
  isAdded,
  isAdding,
  isDuplicate: dup,
  onAdd,
}: {
  prospect: Prospect;
  isAdded: boolean;
  isAdding: boolean;
  isDuplicate: boolean;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden ${
      dup ? "border-amber-500/40" : "border-gray-800/60"
    }`}>
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Add Button */}
        <div className="shrink-0">
          {dup && !isAdded ? (
            <span
              className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400"
              title="Possible duplicate — already in pipeline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </span>
          ) : isAdded ? (
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              disabled={isAdding}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-700/50 text-gray-400 hover:text-green-400 hover:border-green-500/40 hover:bg-green-500/10 transition-all duration-200 disabled:opacity-50"
              title="Add to pipeline"
            >
              {isAdding ? (
                <div className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Main Info */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-4 text-left min-w-0"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white truncate">{prospect.company}</span>
              {dup && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium shrink-0">
                  POSSIBLE DUPLICATE
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">{prospect.industry}</div>
          </div>
          <div className="hidden md:block text-xs text-gray-400 w-28 text-right">{prospect.size}</div>
          <div className="hidden lg:block text-xs text-gray-400 w-28 text-right">{prospect.revenue}</div>
          <ScoreBadge score={prospect.score} />
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-700/30 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Detail label="Website" value={prospect.website} isLink />
            <Detail label="HQ" value={prospect.hq} />
            <Detail label="CRM" value={prospect.crm} />
            <Detail label="What They Sell" value={prospect.what_they_sell} />
          </div>

          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Score Reasoning</div>
            <div className="text-xs text-gray-300">{prospect.score_reasoning}</div>
          </div>

          {prospect.pain_signals?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Pain Signals</div>
              <div className="flex flex-wrap gap-1.5">
                {prospect.pain_signals.map((s, i) => (
                  <span key={i} className="px-2 py-1 text-xs rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {prospect.contacts?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Contacts</div>
              <div className="space-y-1.5">
                {prospect.contacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-white font-medium">{c.name}</span>
                    <span className="text-gray-500">{c.title}</span>
                    {c.linkedin && c.linkedin.startsWith("http") && (
                      <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        LinkedIn
                      </a>
                    )}
                    {c.email && <span className="text-gray-400">{c.email}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, isLink }: { label: string; value?: string; isLink?: boolean }) {
  if (!value || value === "Unknown") return null;
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      {isLink ? (
        <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate block text-xs">
          {value}
        </a>
      ) : (
        <div className="text-gray-300 truncate text-xs">{value}</div>
      )}
    </div>
  );
}
