import { useParams, Link } from "react-router-dom";
import { useState, useRef, useCallback } from "react";
import { useProspect } from "../hooks/useProspects";
import { apiStream, apiFetch } from "../lib/api";
import ScoreBadge from "../components/ScoreBadge";
import DraftEditor from "../components/DraftEditor";

const FRAMEWORKS = [
  { id: "Pain-Bridge", label: "Pain-Bridge", desc: "Hook → Pain → Bridge → Proof → CTA" },
  { id: "Question Opener", label: "Question Opener", desc: "Thought-provoking question lead" },
  { id: "Follow-up 1", label: "Follow-up #1 (Day 3)", desc: "New angle, short and direct" },
  { id: "Follow-up 2", label: "Follow-up #2 (Day 7)", desc: "Value-add with insight" },
  { id: "Follow-up 3", label: "Follow-up #3 (Day 14)", desc: "Break-up email, last touch" },
];

export default function Outreach() {
  const { index } = useParams();
  const idx = index !== undefined ? parseInt(index, 10) : null;
  const { prospect, loading, error } = useProspect(idx);

  const [framework, setFramework] = useState("Pain-Bridge");
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ linkedin?: string; email?: string; email_confidence?: string; notes?: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(() => {
    if (idx === null) return;
    setGenerating(true);
    setBody("");
    setSubject("");
    setSaved(false);
    let accumulated = "";

    controllerRef.current = apiStream(
      "/chat/outreach",
      {
        prospectIndex: idx,
        framework,
        ...(selectedContact !== null ? { contactIndex: selectedContact } : {}),
        messages: [
          {
            role: "user" as const,
            content: `Draft a personalized cold email using the "${framework}" framework.${selectedContact !== null && prospect ? ` Target this email specifically to ${prospect.contacts[selectedContact]?.name}.` : ""} Include a subject line at the top formatted as "Subject: ..."`,
          },
        ],
      },
      {
        onText: (text) => {
          accumulated += text;
          const subjectMatch = accumulated.match(/Subject:\s*(.+?)(?:\n|$)/);
          if (subjectMatch) {
            setSubject(subjectMatch[1].trim());
            const bodyStart = accumulated.indexOf("\n", accumulated.indexOf(subjectMatch[0]));
            setBody(stripAnalysis(accumulated.slice(bodyStart + 1).trim()));
          } else {
            setBody(stripAnalysis(accumulated));
          }
        },
        onDone: () => setGenerating(false),
        onError: () => setGenerating(false),
      }
    );
  }, [idx, framework, selectedContact, prospect]);

  const enrichContact = useCallback(() => {
    if (idx === null || selectedContact === null) return;
    setEnriching(true);
    setEnrichResult(null);

    apiStream(
      "/chat/contact-enrich",
      { prospectIndex: idx, contactIndex: selectedContact },
      {
        onText: () => {},
        onDone: () => setEnriching(false),
        onError: () => setEnriching(false),
        onSaved: (data: Record<string, unknown>) => {
          setEnrichResult(data as { linkedin?: string; email?: string; email_confidence?: string; notes?: string });
        },
      }
    );
  }, [idx, selectedContact]);

  const handleSave = async () => {
    if (!prospect || idx === null) return;
    setSaving(true);
    try {
      await apiFetch("/drafts", {
        method: "POST",
        body: JSON.stringify({
          prospectIndex: idx,
          prospectCompany: prospect.company,
          framework,
          subject,
          body,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(text);
  };

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (error) return <div className="p-6 text-red-400">Error: {error}</div>;
  if (!prospect) return <div className="p-6 text-gray-500">Prospect not found</div>;

  return (
    <div className="flex h-full">
      {/* Left: Prospect Context */}
      <div className="w-80 border-r border-gray-800/50 overflow-y-auto p-5 shrink-0">
        <Link to={`/prospect/${index}`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          &larr; Back to detail
        </Link>
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-white">{prospect.company}</h3>
            <ScoreBadge score={prospect.score} />
          </div>
          <div className="text-sm text-gray-400 mb-4">{prospect.industry}</div>

          <div className="space-y-1">
            <InfoCard icon="💰" label="Revenue" value={prospect.revenue} />
            <InfoCard icon="👥" label="Size" value={prospect.size} />
            <InfoCard icon="🔧" label="CRM" value={prospect.crm} />

            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">
                <span>👤</span> Contacts
                {selectedContact !== null && (
                  <span className="ml-auto text-[10px] text-blue-400 font-normal normal-case tracking-normal">targeting selected</span>
                )}
              </div>
              {(prospect.contacts || []).map((c, i) => {
                const isSelected = selectedContact === i;
                const contactEnriched = enrichResult && selectedContact === i;
                const rawLinkedin = (contactEnriched && enrichResult?.linkedin) || c.linkedin;
                const linkedinUrl = rawLinkedin && rawLinkedin.startsWith("http") ? rawLinkedin : "";
                const hasLinkedin = !!linkedinUrl;
                const hasEmail = c.email || (contactEnriched && enrichResult?.email);
                const emailAddr = (contactEnriched && enrichResult?.email) || c.email;

                return (
                  <div key={i} className="mb-3 last:mb-0">
                    <button
                      onClick={() => {
                        setSelectedContact(isSelected ? null : i);
                        if (!isSelected) setEnrichResult(null);
                      }}
                      className={`w-full text-left p-2 -mx-2 rounded-lg transition-all duration-150 ${
                        isSelected
                          ? "bg-blue-500/15 ring-1 ring-blue-500/40"
                          : "hover:bg-gray-700/30 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`text-base font-semibold ${isSelected ? "text-blue-300" : "text-gray-200"}`}>{c.name}</div>
                        {(c.linkedin || c.email) && (
                          <div className="flex items-center gap-1">
                            {c.linkedin && <span className="w-2 h-2 rounded-full bg-blue-400" title="LinkedIn found" />}
                            {c.email && <span className="w-2 h-2 rounded-full bg-green-400" title="Email found" />}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mt-0.5">{c.title}</div>
                    </button>

                    {isSelected && (
                      <div className="ml-2 mt-2 space-y-2">
                        {/* Show existing or enriched contact info */}
                        {hasLinkedin && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-14 shrink-0">LinkedIn</span>
                            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 underline truncate">{linkedinUrl}</a>
                          </div>
                        )}
                        {hasEmail && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-14 shrink-0">Email</span>
                            <span className="text-sm text-green-400">{emailAddr}</span>
                            {contactEnriched && enrichResult?.email_confidence && enrichResult.email_confidence !== "verified" && (
                              <span className="text-xs text-yellow-500/70">({enrichResult.email_confidence})</span>
                            )}
                          </div>
                        )}
                        {contactEnriched && enrichResult?.notes && (
                          <div className="text-xs text-gray-500 leading-relaxed mt-1">{enrichResult.notes}</div>
                        )}
                        {contactEnriched && !enrichResult?.linkedin && !enrichResult?.email && (
                          <div className="text-sm text-gray-500">No results found. {enrichResult?.notes}</div>
                        )}

                        {/* Research button */}
                        {(!hasLinkedin || !hasEmail) && (
                          <button
                            onClick={enrichContact}
                            disabled={enriching}
                            className={`w-full px-3 py-2 text-sm rounded-lg font-medium transition-all duration-200 mt-1 ${
                              enriching
                                ? "bg-purple-600/20 text-purple-300 border border-purple-500/30 animate-pulse"
                                : "bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 hover:text-purple-300"
                            }`}
                          >
                            {enriching ? "Researching..." : "Find Email & LinkedIn"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">
                <span>⚡</span> Pain Signals
              </div>
              {(prospect.pain_signals || []).map((s, i) => (
                <div key={i} className="text-sm text-gray-400 mb-1.5 last:mb-0 leading-relaxed">• {s}</div>
              ))}
            </div>

            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">
                <span>🎯</span> Score Reasoning
              </div>
              <div className="text-sm text-gray-400 leading-relaxed">{prospect.score_reasoning}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Draft Workspace */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-xl font-semibold text-white mb-5">
          Draft Outreach — {prospect.company}
        </h2>

        {/* Framework Selector */}
        <div className="mb-5">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Framework</div>
          <div className="flex flex-wrap gap-2">
            {FRAMEWORKS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFramework(f.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 font-medium ${
                  framework === f.id
                    ? "border-blue-500 bg-blue-500/20 text-blue-400 shadow-sm shadow-blue-500/10"
                    : "border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                }`}
                title={f.desc}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generating ? () => controllerRef.current?.abort() : generate}
          className={`mb-6 px-5 py-2.5 text-sm rounded-xl font-medium transition-all duration-200 ${
            generating
              ? "bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30"
              : "bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-600/20 hover:shadow-blue-500/30"
          }`}
        >
          {generating ? "Stop Generating" : "Generate Draft"}
        </button>

        {/* Editor */}
        <DraftEditor
          subject={subject}
          body={body}
          onSubjectChange={setSubject}
          onBodyChange={setBody}
          onSave={handleSave}
          onCopy={handleCopy}
          saving={saving}
          saved={saved}
        />
      </div>
    </div>
  );
}

/** Strip AI analysis/commentary that appears after the email signature */
function stripAnalysis(text: string): string {
  // Cut at common analysis markers
  const markers = [
    /\n---\s*\n/,
    /\n##\s/,
    /\nWhy [Tt]his [Ww]orks/,
    /\nNotes?:/,
    /\nAnalysis:/,
    /\nBreakdown:/,
    /\nKey [Pp]oints:/,
    /\nFramework:/,
    /\n\*\*Why/,
    /\n\*\*Hook/,
    /\n\*\*Note/,
  ];
  let result = text;
  for (const marker of markers) {
    const match = result.match(marker);
    if (match && match.index !== undefined) {
      result = result.slice(0, match.index).trim();
    }
  }
  return result;
}

function InfoCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">
        <span>{icon}</span> {label}
      </div>
      <div className="text-sm font-medium text-gray-200">{value}</div>
    </div>
  );
}
