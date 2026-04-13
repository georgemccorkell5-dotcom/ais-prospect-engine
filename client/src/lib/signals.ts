import type { Signal } from "./types";

const DECAY_DAYS: Record<string, number> = {
  fast: 14,
  medium: 30,
  slow: 90,
};

/** Calculate decayed strength based on age and decay rate */
export function decayedStrength(signal: Signal): number {
  const age = daysSince(signal.detected_at);
  const halfLife = DECAY_DAYS[signal.decay_rate] || 30;
  const decay = Math.pow(0.5, age / halfLife);
  return Math.round(signal.strength * decay * 100) / 100;
}

/** Days since a date string */
export function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Count signals detected in the last N days */
export function recentSignalCount(signals: Signal[], days: number = 7): number {
  return signals.filter((s) => daysSince(s.detected_at) <= days).length;
}

/** Human-readable signal type label */
export function signalTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    hiring: "Hiring",
    leadership_change: "Leadership Change",
    funding: "Funding",
    acquisition: "Acquisition",
    tech_adoption: "Tech Adoption",
    tech_removal: "Tech Removal",
    job_posting: "Job Posting",
    news: "News",
    expansion: "Expansion",
    contraction: "Contraction",
    content_signal: "Content Signal",
    partnership: "Partnership",
    product_launch: "Product Launch",
    earnings: "Earnings",
    other: "Other",
  };
  return labels[type] || type;
}

/** Human-readable category label */
export function signalCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    growth_signal: "Growth",
    buying_cycle_trigger: "Buying Cycle",
    tech_stack_change: "Tech Stack",
    leadership_change: "Leadership",
    competitive_threat: "Competitive",
    engagement_signal: "Engagement",
    pain_indicator: "Pain",
  };
  return labels[cat] || cat;
}

/** Color for signal category */
export function signalCategoryColor(cat: string): { text: string; bg: string; border: string } {
  const colors: Record<string, { text: string; bg: string; border: string }> = {
    growth_signal:       { text: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30" },
    buying_cycle_trigger:{ text: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30" },
    tech_stack_change:   { text: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
    leadership_change:   { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30" },
    competitive_threat:  { text: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
    engagement_signal:   { text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
    pain_indicator:      { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  };
  return colors[cat] || { text: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/30" };
}

/** Strength bar color */
export function strengthColor(strength: number): string {
  if (strength >= 0.8) return "bg-red-500";
  if (strength >= 0.6) return "bg-orange-500";
  if (strength >= 0.4) return "bg-amber-500";
  if (strength >= 0.2) return "bg-blue-500";
  return "bg-gray-500";
}

/** Signal score color */
export function signalScoreColor(score: number): string {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-amber-400";
  if (score >= 20) return "text-blue-400";
  return "text-gray-500";
}

/** Signal score label */
export function signalScoreLabel(score: number): string {
  if (score >= 80) return "Strong Buy Signals";
  if (score >= 60) return "Active Signals";
  if (score >= 40) return "Moderate Signals";
  if (score >= 20) return "Weak Signals";
  return "No Signals";
}
