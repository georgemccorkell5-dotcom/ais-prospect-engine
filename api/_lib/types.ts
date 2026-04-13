export interface Contact {
  name: string;
  title: string;
  linkedin?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export type SignalCategory =
  | "growth_signal"
  | "buying_cycle_trigger"
  | "tech_stack_change"
  | "leadership_change"
  | "competitive_threat"
  | "engagement_signal"
  | "pain_indicator";

export type SignalType =
  | "hiring"
  | "leadership_change"
  | "funding"
  | "acquisition"
  | "tech_adoption"
  | "tech_removal"
  | "job_posting"
  | "news"
  | "expansion"
  | "contraction"
  | "content_signal"
  | "partnership"
  | "product_launch"
  | "earnings"
  | "other";

export interface Signal {
  type: SignalType;
  description: string;
  source?: string;
  source_url?: string;
  detected_at: string;
  strength: number;
  category: SignalCategory;
  decay_rate: "fast" | "medium" | "slow";
}

export interface SignalContribution {
  signal: Signal;
  decayedStrength: number;
  categoryWeight: number;
  contribution: number;
}

export interface CategoryBreakdown {
  category: SignalCategory;
  signalCount: number;
  totalContribution: number;
  topSignal: string;
}

export interface SignalSynthesis {
  computedScore: number;
  recommendedRating: "HOT" | "WARM" | "COLD";
  contributions: SignalContribution[];
  categoryBreakdown: CategoryBreakdown[];
  summary: string;
  recommendations: string[];
  synthesizedAt: string;
}

export interface ScoreChange {
  date: string;
  from: "HOT" | "WARM" | "COLD";
  to: "HOT" | "WARM" | "COLD";
  reason: string;
  signalScore: number;
}

export interface Prospect {
  company: string;
  website: string;
  industry: string;
  what_they_sell?: string;
  hq?: string;
  address?: string;
  phone?: string;
  size: string;
  revenue: string;
  funding?: string;
  sales_motion?: string;
  crm: string;
  contacts: Contact[];
  pain_signals: string[];
  signals?: Signal[];
  signal_score?: number;
  signal_synthesis?: SignalSynthesis;
  score_history?: ScoreChange[];
  last_signal_scan?: string;
  score: "HOT" | "WARM" | "COLD";
  score_reasoning: string;
  status: "new" | "researched" | "contacted" | "replied" | "meeting" | "disqualified";
  last_action: string;
  next_action: string;
  next_action_date: string;
  product_config: string;
  notes: string;
}

export interface Draft {
  id: string;
  prospectIndex: number;
  prospectCompany: string;
  framework: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  productConfig: string;
  createdAt: string;
  updatedAt: string;
}
