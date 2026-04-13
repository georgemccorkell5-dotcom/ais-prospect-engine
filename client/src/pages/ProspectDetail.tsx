import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useProspect } from "../hooks/useProspects";
import { apiStream } from "../lib/api";
import ScoreBadge from "../components/ScoreBadge";
import StatusBadge from "../components/StatusBadge";
import SignalPanel from "../components/SignalPanel";
import type { Prospect, Contact } from "../lib/types";

const SCORES = ["HOT", "WARM", "COLD"] as const;
const STATUSES = ["new", "researched", "contacted", "replied", "meeting", "disqualified"] as const;

export default function ProspectDetail() {
  const { index } = useParams();
  const idx = index !== undefined ? parseInt(index, 10) : null;
  const { prospect, loading, error, save, reload } = useProspect(idx);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Prospect>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchStatus, setResearchStatus] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  useEffect(() => {
    if (prospect) setForm(prospect);
  }, [prospect]);

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (error) return <div className="p-6 text-red-400">Error: {error}</div>;
  if (!prospect) return <div className="p-6 text-gray-500">Not found</div>;

  const handleDeepResearch = () => {
    if (researching || idx === null) return;
    setResearching(true);
    setResearchStatus("Starting research...");

    apiStream(
      "/chat/deep-research",
      { prospectIndex: idx },
      {
        onText: () => {},
        onSearching: (query) => setResearchStatus(`Searching: ${query}`),
        onDone: () => {
          setResearching(false);
          setResearchStatus("");
          reload();
        },
        onError: (err) => {
          setResearching(false);
          setResearchStatus(`Error: ${err}`);
          setTimeout(() => setResearchStatus(""), 5000);
        },
      }
    );
  };

  const handleSignalScan = () => {
    if (scanning || idx === null) return;
    setScanning(true);
    setScanStatus("Starting signal scan...");

    apiStream(
      "/chat/signal-scan",
      { prospectIndex: idx },
      {
        onText: () => {},
        onSearching: (query) => setScanStatus(`Searching: ${query}`),
        onDone: () => {
          setScanning(false);
          setScanStatus("");
          reload();
        },
        onError: (err) => {
          setScanning(false);
          setScanStatus(`Error: ${err}`);
          setTimeout(() => setScanStatus(""), 5000);
        },
      }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await save(form);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateField = <K extends keyof Prospect>(key: K, val: Prospect[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const updateContact = (ci: number, field: keyof Contact, val: string) => {
    const contacts = [...(form.contacts || [])];
    contacts[ci] = { ...contacts[ci], [field]: val };
    setForm((prev) => ({ ...prev, contacts }));
  };

  const addContact = () => {
    setForm((prev) => ({
      ...prev,
      contacts: [...(prev.contacts || []), { name: "", title: "", linkedin: "", email: "" }],
    }));
  };

  const removeContact = (ci: number) => {
    setForm((prev) => ({
      ...prev,
      contacts: (prev.contacts || []).filter((_, i) => i !== ci),
    }));
  };

  const updatePainSignal = (pi: number, val: string) => {
    const signals = [...(form.pain_signals || [])];
    signals[pi] = val;
    setForm((prev) => ({ ...prev, pain_signals: signals }));
  };

  const addPainSignal = () => {
    setForm((prev) => ({
      ...prev,
      pain_signals: [...(prev.pain_signals || []), ""],
    }));
  };

  const removePainSignal = (pi: number) => {
    setForm((prev) => ({
      ...prev,
      pain_signals: (prev.pain_signals || []).filter((_, i) => i !== pi),
    }));
  };

  return (
    <div className="h-full overflow-y-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          &larr; Pipeline
        </Link>
        <span className="text-gray-700">/</span>
        <h2 className="text-xl font-semibold text-white">{prospect.company}</h2>
        <ScoreBadge score={prospect.score} />
        <StatusBadge status={prospect.status} />
      </div>

      {saved && (
        <div className="mb-4 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
          Changes saved.
        </div>
      )}

      <div className="flex gap-3 mb-6">
        {!editing ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 text-sm bg-gray-800/70 border border-gray-700/50 rounded-xl hover:bg-gray-800 text-gray-300 transition-all duration-200 font-medium"
            >
              Edit
            </button>
            <Link
              to={`/outreach/${index}`}
              className="px-4 py-2 text-sm bg-blue-600/15 border border-blue-500/30 rounded-xl hover:bg-blue-600/25 text-blue-400 transition-all duration-200 font-medium"
            >
              Draft Outreach
            </Link>
            <button
              onClick={handleDeepResearch}
              disabled={researching}
              className={`px-4 py-2 text-sm rounded-xl transition-all duration-200 font-medium border ${
                researching
                  ? "bg-purple-600/10 border-purple-500/20 text-purple-500 cursor-not-allowed"
                  : "bg-purple-600/15 border-purple-500/30 hover:bg-purple-600/25 text-purple-400"
              }`}
            >
              {researching ? "Researching..." : "Deep Research"}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 rounded-xl hover:bg-blue-500 text-white disabled:opacity-50 transition-all duration-200 font-medium shadow-sm shadow-blue-600/20"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setForm(prospect); }}
              className="px-4 py-2 text-sm bg-gray-800/70 border border-gray-700/50 rounded-xl hover:bg-gray-800 text-gray-300 transition-all duration-200 font-medium"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {researching && (
        <div className="mb-6 px-4 py-3 bg-purple-900/20 border border-purple-700/30 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-purple-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-purple-300">{researchStatus}</span>
          </div>
        </div>
      )}
      {!researching && researchStatus && (
        <div className="mb-6 px-4 py-3 bg-red-900/20 border border-red-700/30 rounded-xl text-sm text-red-400">
          {researchStatus}
        </div>
      )}

      <div className="space-y-6">
        {/* Company Info */}
        <Section title="Company Info" icon="🏢">
          <Field label="Company" value={form.company} editing={editing} onChange={(v) => updateField("company", v)} />
          <Field label="Website" value={form.website} editing={editing} onChange={(v) => updateField("website", v)} />
          <Field label="Industry" value={form.industry} editing={editing} onChange={(v) => updateField("industry", v)} />
          <Field label="What They Sell" value={form.what_they_sell} editing={editing} onChange={(v) => updateField("what_they_sell", v)} />
          <Field label="HQ" value={form.hq} editing={editing} onChange={(v) => updateField("hq", v)} />
          <Field label="Size" value={form.size} editing={editing} onChange={(v) => updateField("size", v)} />
          <Field label="Revenue" value={form.revenue} editing={editing} onChange={(v) => updateField("revenue", v)} />
          <Field label="Funding" value={form.funding} editing={editing} onChange={(v) => updateField("funding", v)} />
          <Field label="CRM" value={form.crm} editing={editing} onChange={(v) => updateField("crm", v)} />
          <Field label="Sales Motion" value={form.sales_motion} editing={editing} onChange={(v) => updateField("sales_motion", v)} multiline />
        </Section>

        {/* Score & Status */}
        <Section title="Qualification" icon="🎯">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Score</label>
              {editing ? (
                <select
                  value={form.score}
                  onChange={(e) => updateField("score", e.target.value as Prospect["score"])}
                  className="w-full bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-1.5 text-sm text-gray-200"
                >
                  {SCORES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <ScoreBadge score={prospect.score} />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Status</label>
              {editing ? (
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value as Prospect["status"])}
                  className="w-full bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-1.5 text-sm text-gray-200"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <StatusBadge status={prospect.status} />
              )}
            </div>
          </div>
          <Field label="Score Reasoning" value={form.score_reasoning} editing={editing} onChange={(v) => updateField("score_reasoning", v)} multiline />
        </Section>

        {/* Contacts */}
        <Section title="Contacts" icon="👤">
          {(form.contacts || []).map((c, ci) => (
            <div key={ci} className="bg-gray-800/40 rounded-lg p-3 mb-2 border border-gray-700/30">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={c.name} onChange={(e) => updateContact(ci, "name", e.target.value)} placeholder="Name" className="flex-1 bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-1 text-sm text-gray-200" />
                    <input value={c.title} onChange={(e) => updateContact(ci, "title", e.target.value)} placeholder="Title" className="flex-1 bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-1 text-sm text-gray-200" />
                  </div>
                  <div className="flex gap-2">
                    <input value={c.email || ""} onChange={(e) => updateContact(ci, "email", e.target.value)} placeholder="Email" className="flex-1 bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-1 text-sm text-gray-200" />
                    <input value={c.linkedin || ""} onChange={(e) => updateContact(ci, "linkedin", e.target.value)} placeholder="LinkedIn URL" className="flex-1 bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-1 text-sm text-gray-200" />
                  </div>
                  <button onClick={() => removeContact(ci)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
                </div>
              ) : (
                <>
                  <div className="font-medium text-sm text-white">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.title}</div>
                  {c.email && <div className="text-xs text-gray-500 mt-1">{c.email}</div>}
                  {c.linkedin && c.linkedin.startsWith("http") && (
                    <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 mt-0.5 block transition-colors">
                      LinkedIn
                    </a>
                  )}
                  {c.notes && <div className="text-xs text-gray-500 mt-1">{c.notes}</div>}
                </>
              )}
            </div>
          ))}
          {editing && (
            <button onClick={addContact} className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
              + Add Contact
            </button>
          )}
        </Section>

        {/* Signal Detection */}
        <SignalPanel
          signals={prospect.signals || []}
          signalScore={prospect.signal_score}
          signalSynthesis={prospect.signal_synthesis}
          scoreHistory={prospect.score_history}
          lastScanDate={prospect.last_signal_scan}
          onScan={handleSignalScan}
          scanning={scanning}
          scanStatus={scanStatus}
        />

        {/* Pain Signals (Legacy) */}
        <Section title="Pain Signals (Legacy)" icon="⚡">
          {(form.pain_signals || []).map((s, pi) => (
            <div key={pi} className="flex gap-2 mb-1">
              {editing ? (
                <>
                  <input
                    value={s}
                    onChange={(e) => updatePainSignal(pi, e.target.value)}
                    className="flex-1 bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-1 text-sm text-gray-200"
                  />
                  <button onClick={() => removePainSignal(pi)} className="text-xs text-red-400 hover:text-red-300 transition-colors">X</button>
                </>
              ) : (
                <div className="text-sm text-gray-300">• {s}</div>
              )}
            </div>
          ))}
          {editing && (
            <button onClick={addPainSignal} className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors font-medium">
              + Add Signal
            </button>
          )}
        </Section>

        {/* Actions & Notes */}
        <Section title="Actions & Notes" icon="📝">
          <Field label="Last Action" value={form.last_action} editing={editing} onChange={(v) => updateField("last_action", v)} />
          <Field label="Next Action" value={form.next_action} editing={editing} onChange={(v) => updateField("next_action", v)} />
          <Field label="Next Action Date" value={form.next_action_date} editing={editing} onChange={(v) => updateField("next_action_date", v)} />
          <Field label="Notes" value={form.notes} editing={editing} onChange={(v) => updateField("notes", v)} multiline />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-800/60 rounded-xl p-5 bg-gray-900/30">
      <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
        <span>{icon}</span>
        <span className="uppercase tracking-wider">{title}</span>
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  editing,
  onChange,
  multiline,
}: {
  label: string;
  value?: string;
  editing: boolean;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
      {editing ? (
        multiline ? (
          <textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full bg-gray-800/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
          />
        ) : (
          <input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-gray-800/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
          />
        )
      ) : (
        <div className="text-sm text-gray-200">{value || "—"}</div>
      )}
    </div>
  );
}
