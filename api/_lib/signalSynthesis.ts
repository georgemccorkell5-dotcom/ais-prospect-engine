import type {
  Signal,
  SignalCategory,
  SignalSynthesis,
  SignalContribution,
  CategoryBreakdown,
} from "./types.js";

const DECAY_HALF_LIFE: Record<string, number> = {
  fast: 14,
  medium: 30,
  slow: 90,
};

const CATEGORY_WEIGHTS: Record<SignalCategory, number> = {
  buying_cycle_trigger: 1.5,
  leadership_change: 1.3,
  tech_stack_change: 1.2,
  pain_indicator: 1.1,
  growth_signal: 1.0,
  engagement_signal: 0.9,
  competitive_threat: 0.8,
};

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

function decayedStrength(signal: Signal): number {
  const age = daysSince(signal.detected_at);
  const halfLife = DECAY_HALF_LIFE[signal.decay_rate] || 30;
  const decay = Math.pow(0.5, age / halfLife);
  return Math.round(signal.strength * decay * 1000) / 1000;
}

function scoreToRating(score: number): "HOT" | "WARM" | "COLD" {
  if (score >= 70) return "HOT";
  if (score >= 40) return "WARM";
  return "COLD";
}

export function synthesizeSignals(signals: Signal[], companyName: string): SignalSynthesis {
  const weights = CATEGORY_WEIGHTS;
  const scoreDivisor = 5;
  const today = new Date().toISOString().split("T")[0];

  if (!signals || signals.length === 0) {
    return {
      computedScore: 0,
      recommendedRating: "COLD",
      contributions: [],
      categoryBreakdown: [],
      summary: `No structured signals detected for ${companyName}. Run a signal scan to identify buying indicators.`,
      recommendations: ["Run a signal scan to detect buying indicators before outreach."],
      synthesizedAt: today,
    };
  }

  const contributions: SignalContribution[] = signals
    .map((signal) => {
      const ds = decayedStrength(signal);
      const cw = weights[signal.category] || 1.0;
      return {
        signal,
        decayedStrength: ds,
        categoryWeight: cw,
        contribution: Math.round(ds * cw * 1000) / 1000,
      };
    })
    .sort((a, b) => b.contribution - a.contribution);

  const topN = contributions.slice(0, 10);
  const totalContribution = topN.reduce((sum, c) => sum + c.contribution, 0);
  const computedScore = Math.round(100 * (1 - Math.exp(-totalContribution / scoreDivisor)));

  const catMap = new Map<SignalCategory, { signals: SignalContribution[]; total: number }>();
  for (const c of contributions) {
    const existing = catMap.get(c.signal.category);
    if (existing) {
      existing.signals.push(c);
      existing.total += c.contribution;
    } else {
      catMap.set(c.signal.category, { signals: [c], total: c.contribution });
    }
  }

  const categoryBreakdown: CategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      signalCount: data.signals.length,
      totalContribution: Math.round(data.total * 1000) / 1000,
      topSignal: data.signals[0].signal.description,
    }))
    .sort((a, b) => b.totalContribution - a.totalContribution);

  const recommendedRating = scoreToRating(computedScore);

  const recentCount = signals.filter((s) => daysSince(s.detected_at) <= 14).length;
  const topCategories = categoryBreakdown.slice(0, 3).map((c) => categoryLabel(c.category));
  const strongestSignal = contributions[0];

  let summary = `${companyName} has ${signals.length} signal${signals.length !== 1 ? "s" : ""} detected`;
  if (recentCount > 0) {
    summary += ` (${recentCount} in the last 14 days)`;
  }
  summary += `. `;

  if (computedScore >= 70) {
    summary += `Strong buying indicators present, primarily in ${topCategories.join(", ")}. The strongest signal is: "${strongestSignal.signal.description}" Active engagement recommended.`;
  } else if (computedScore >= 40) {
    summary += `Moderate buying indicators in ${topCategories.join(", ")}. The strongest signal is: "${strongestSignal.signal.description}" Good timing for exploratory outreach.`;
  } else {
    summary += `Weak or decaying signals in ${topCategories.join(", ")}. ${recentCount === 0 ? "No recent activity detected. " : ""}Consider rescanning or deprioritizing.`;
  }

  const recommendations = generateRecommendations(
    computedScore,
    contributions,
    categoryBreakdown,
    recentCount,
    companyName
  );

  return {
    computedScore,
    recommendedRating,
    contributions,
    categoryBreakdown,
    summary,
    recommendations,
    synthesizedAt: today,
  };
}

function generateRecommendations(
  score: number,
  contributions: SignalContribution[],
  categories: CategoryBreakdown[],
  recentCount: number,
  company: string
): string[] {
  const recs: string[] = [];
  const strongest = contributions[0];

  if (score >= 80) {
    recs.push(`Engage ${company} immediately. Multiple strong buying signals detected.`);
    if (strongest) {
      recs.push(`Lead with "${strongest.signal.description}" as your opening hook in outreach.`);
    }
    recs.push("Research the buying committee before outreach to maximize first-touch impact.");
  } else if (score >= 60) {
    recs.push(`Good timing for outreach to ${company}. Active signals suggest evaluation may be underway.`);
    if (strongest) {
      recs.push(`Reference "${strongest.signal.description}" for personalization.`);
    }
    recs.push("Consider a signal rescan in 1-2 weeks to track signal momentum.");
  } else if (score >= 40) {
    recs.push(`${company} shows moderate signals. Monitor before committing outreach resources.`);
    recs.push("Run another signal scan in 2 weeks to see if signals strengthen or decay.");
    if (recentCount === 0) {
      recs.push("No recent signals detected. Prioritize prospects with fresher buying indicators.");
    }
  } else {
    recs.push(`${company} has weak or stale signals. Low priority for outreach.`);
    recs.push("Focus efforts on higher-scored prospects. Revisit in 30 days with a fresh scan.");
  }

  const hasLeadership = categories.some((c) => c.category === "leadership_change");
  const hasHiring = categories.some(
    (c) => c.category === "growth_signal" && c.topSignal.toLowerCase().includes("hiring")
  );

  if (hasLeadership && score >= 40) {
    recs.push("Leadership change detected. New leaders often audit and rebuild the stack within 90 days.");
  }
  if (hasHiring && score >= 40) {
    recs.push("Hiring signals suggest scaling pressure. Position around efficiency and ramp time.");
  }

  return recs;
}

function categoryLabel(cat: SignalCategory): string {
  const labels: Record<SignalCategory, string> = {
    growth_signal: "growth",
    buying_cycle_trigger: "buying cycle",
    tech_stack_change: "tech stack",
    leadership_change: "leadership",
    competitive_threat: "competitive",
    engagement_signal: "engagement",
    pain_indicator: "pain",
  };
  return labels[cat] || cat;
}
