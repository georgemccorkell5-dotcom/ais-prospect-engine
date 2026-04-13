import { readText, readJSON } from "./kvStore.js";
import type { Prospect, Signal } from "./types.js";

export function getProspectsKey(): string {
  return "prospects:ais-leads";
}

async function loadProspects(): Promise<Prospect[]> {
  try {
    return await readJSON<Prospect[]>("prospects:ais-leads");
  } catch {
    return [];
  }
}

async function getConfigContent(): Promise<string> {
  try {
    return await readText("config:ais-mn");
  } catch {
    return "";
  }
}

export async function buildChatContext(): Promise<string> {
  const [claudeMd, activeConfig, prospects] = await Promise.all([
    readText("system:claude-md").catch(() => ""),
    getConfigContent(),
    loadProspects(),
  ]);

  const prospectSummary = prospects
    .map(
      (p, i) =>
        `[${i}] ${p.company} (${p.score}) — ${p.status} — ${p.industry} — Next: ${p.next_action}`
    )
    .join("\n");

  return `# System Context
You are the AIS Prospect Engine. Today is ${new Date().toISOString().split("T")[0]}.

## Operating Instructions
${claudeMd}

## Active Product Config
${activeConfig}

## Current Pipeline (${prospects.length} prospects)
${prospectSummary}

Remember: DRAFT ONLY — never send anything. Always present drafts for human review.`;
}

export async function buildOutreachContext(prospectIndex: number, contactIndex?: number): Promise<string> {
  const [activeConfig, playbook, prospects] = await Promise.all([
    getConfigContent(),
    readText("playbook:cold-outreach").catch(() => ""),
    loadProspects(),
  ]);

  const prospect = prospects[prospectIndex];
  if (!prospect) throw new Error(`Prospect at index ${prospectIndex} not found`);

  const signalContext = prospect.signals && prospect.signals.length > 0
    ? `\n## Recent Buying Signals (use these for personalization hooks)\n${prospect.signals
        .sort((a: Signal, b: Signal) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
        .slice(0, 5)
        .map((s: Signal) => `- [${s.type}] ${s.description} (strength: ${s.strength}, detected: ${s.detected_at})`)
        .join("\n")}\n\nPrioritize the strongest, most recent signals as your opening hook. Reference them specifically.`
    : "";

  return `# Outreach Draft Context
Today is ${new Date().toISOString().split("T")[0]}.

## Active Product Config
${activeConfig}

## Outreach Playbook
${playbook}

## Target Prospect — FULL DETAIL
${JSON.stringify(prospect, null, 2)}
${signalContext}
${contactIndex !== undefined && prospect.contacts[contactIndex] ? `\n## SELECTED TARGET CONTACT\nThis email MUST be addressed to: ${prospect.contacts[contactIndex].name} (${prospect.contacts[contactIndex].title}). Use their first name in the greeting and tailor the messaging to their specific role and responsibilities.\n` : ""}
Draft a personalized outreach email following the playbook frameworks. The opening line must be about THEM, not us. Reference specific details about this prospect.${contactIndex !== undefined && prospect.contacts[contactIndex] ? ` Address the email to ${prospect.contacts[contactIndex].name} and tailor it to their role as ${prospect.contacts[contactIndex].title}.` : " Use the RECIPIENT's name (from the contacts list above) in the greeting."}

IMPORTANT FORMATTING RULES:
- NEVER use em dashes (—) anywhere in the email. Use commas, periods, or rewrite the sentence instead.
- Output ONLY the email. Start with "Subject: ..." then the email body. End with the signature line.
- The signature must ALWAYS be from the SENDER, not the recipient. Sign off as:\n  George McCorkell\n  Monarch Technology Group
- Do NOT add any analysis, commentary, explanation, or reasoning after the email. No "Why this works", no "Notes:", no breakdown of the framework. Just the email. Nothing else.`;
}

export async function buildDeepResearchContext(prospectIndex: number): Promise<string> {
  const [activeConfig, prospects] = await Promise.all([
    getConfigContent(),
    loadProspects(),
  ]);

  const prospect = prospects[prospectIndex];
  if (!prospect) throw new Error(`Prospect at index ${prospectIndex} not found`);

  return `# Deep Research Context
Today is ${new Date().toISOString().split("T")[0]}.

## Active Product Config
${activeConfig}

## Target Prospect — Current Data
${JSON.stringify(prospect, null, 2)}

## Your Task
You are a sales research analyst. Deep research this specific company and enrich the prospect data. Use web search to find:

1. **Company details**: What they sell, headquarters, recent news, funding, market position
2. **Location & contact info**: Find the company's physical address (street, city, state, zip) and main phone number. For fabricators, builders, or shops — the shop/office location is critical. Search the company website footer, Google Maps, or business directories.
3. **Decision-maker contacts (TOP PRIORITY)**: Find real names and titles for VP Sales, CRO, CMO, Head of RevOps, CEO, CFO, IT leaders, owner, or similar leadership. For EVERY contact you find, you MUST do THREE searches:
   - **LinkedIn**: Search "[Name] [Company] site:linkedin.com/in" — try multiple query variations. A real LinkedIn URL is critical for outreach.
   - **Email**: Search "[Name] [Company] email" and also search for the company's email pattern. Check the company website domain and try common patterns: first.last@domain.com, flast@domain.com, firstl@domain.com, first@domain.com. Also search "[Company] email format" or check sites like Hunter.io, RocketReach, or SignalHire results that may appear in search. Finding a real email address is just as important as LinkedIn — do not skip this step.
   - **Phone**: Search for direct phone numbers if available. Check the company website contact page for individual extensions or direct lines. If only a main company number is available, include that.
   If you cannot find a LinkedIn URL, email, or phone after searching, leave the field as an empty string — NEVER put "Unknown" or "N/A".
4. **Tech stack signals**: What CRM, sales tools, marketing tools they use (check job postings, tech review sites, case studies)
5. **Pain signals**: Recent job postings (especially GTM Engineer, RevOps, Sales Ops roles), leadership changes, mergers/acquisitions, growth or decline indicators
6. **Personalization hooks**: Specific recent news, blog posts, press releases, or LinkedIn activity from key contacts that could be referenced in outreach

## Output Format
You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no explanation) that contains the enriched prospect fields. Include ALL original fields plus any updates. The JSON must match this structure exactly:

{
  "company": "string",
  "website": "string",
  "industry": "string",
  "what_they_sell": "Brief description of their products/services — ALWAYS fill this in",
  "hq": "City, State — ALWAYS fill this in if discoverable",
  "address": "Full street address — ALWAYS fill in if discoverable (check website footer, Google Maps)",
  "phone": "Main company phone number — ALWAYS fill in if discoverable",
  "size": "string",
  "revenue": "string",
  "funding": "funding info if available, empty string if not",
  "crm": "string",
  "contacts": [{"name": "string", "title": "string", "linkedin": "https://www.linkedin.com/in/... (MUST search)", "email": "first.last@company.com (MUST search for pattern)", "phone": "direct line or empty"}],
  "pain_signals": ["string"],
  "score": "HOT|WARM|COLD",
  "score_reasoning": "string",
  "status": "researched",
  "last_action": "Deep research completed YYYY-MM-DD",
  "next_action": "string",
  "next_action_date": "YYYY-MM-DD",
  "product_config": "ais-mn",
  "notes": "string"
}

Set status to "researched". Update last_action with today's date. Set a reasonable next_action and next_action_date. Keep any existing data that is still accurate, and enrich/update where you find better information. Add all new contacts you discover to the contacts array.

CRITICAL — For every contact, do BOTH of these searches:
1. LinkedIn: Search "[Name] [Title] [Company] LinkedIn" and look for linkedin.com/in/ URLs.
2. Email: Search "[Name] [Company] email" AND determine the company email pattern (search "[Company] email format" or check the website domain). Try patterns: first.last@domain, flast@domain, firstl@domain, first@domain. If you find the company uses a specific pattern, apply it to all contacts.

Both LinkedIn and email are TOP PRIORITY for outreach. Do not skip either search. If you truly cannot find one after searching, use an empty string "" — NEVER use "Unknown", "N/A", or any placeholder text.`;
}

export async function buildSignalScanContext(prospectIndex: number): Promise<string> {
  const [activeConfig, prospects] = await Promise.all([
    getConfigContent(),
    loadProspects(),
  ]);

  const prospect = prospects[prospectIndex];
  if (!prospect) throw new Error(`Prospect at index ${prospectIndex} not found`);

  const existingSignals = prospect.signals || [];
  const existingSignalsStr = existingSignals.length > 0
    ? `\n## Existing Signals (avoid duplicates)\n${JSON.stringify(existingSignals, null, 2)}`
    : "\nNo existing structured signals.";

  return `# Signal Detection Scan
Today is ${new Date().toISOString().split("T")[0]}.

## Active Product Config
${activeConfig}

## Target Company
${JSON.stringify({
  company: prospect.company,
  website: prospect.website,
  industry: prospect.industry,
  what_they_sell: prospect.what_they_sell,
  size: prospect.size,
  revenue: prospect.revenue,
  crm: prospect.crm,
  contacts: prospect.contacts,
  pain_signals: prospect.pain_signals,
}, null, 2)}
${existingSignalsStr}

## Your Task
You are a buying signal analyst. Search for FRESH buying signals for this company that indicate they may be entering a buying cycle or have active pain points relevant to our product.

Search for:
1. **Hiring signals**: Job postings for GTM Engineer, RevOps, Sales Ops, SDR/AE roles, marketing ops. More postings = stronger signal.
2. **Leadership changes**: New CRO, VP Sales, CMO, VP Marketing, Head of RevOps in the last 6 months. New leaders audit and rebuild stacks.
3. **Funding / M&A**: Recent funding rounds, acquisitions, mergers. Growth capital = scaling pressure.
4. **Technology changes**: New tool adoptions, vendor switches, RFPs. Check job postings for tech stack clues.
5. **Company news**: Expansion, new offices, product launches, partnerships, earnings. Growth = GTM complexity.
6. **Content signals**: LinkedIn posts from leadership about AI, sales productivity, tool frustration, digital transformation.
7. **Competitive signals**: Competitors winning deals, market shifts, new entrants threatening their position.

## Signal Strength Guide
- 0.9-1.0: Confirmed, recent, directly relevant (e.g., hired a CRO last week who is known to rebuild stacks)
- 0.7-0.8: Strong indicator, verified (e.g., 5 open SDR roles posted this month)
- 0.5-0.6: Moderate indicator (e.g., company blog post about "digital transformation journey")
- 0.3-0.4: Weak but notable (e.g., one job posting mentions Salesforce experience)
- 0.1-0.2: Background noise, barely relevant

## Decay Rate Guide
- "fast": Signal loses relevance in ~2 weeks (e.g., job posting may be filled)
- "medium": Signal relevant for ~30 days (e.g., leadership change, funding round)
- "slow": Signal relevant for ~90 days (e.g., strategic shift, M&A, market repositioning)

## Output Format
Return ONLY a valid JSON object (no markdown fences, no explanation) with this structure:

{
  "signals": [
    {
      "type": "hiring|leadership_change|funding|acquisition|tech_adoption|tech_removal|job_posting|news|expansion|contraction|content_signal|partnership|product_launch|earnings|other",
      "description": "Clear, specific description of the signal. Include names, dates, numbers.",
      "source": "Where you found this (e.g., LinkedIn, company careers page, press release)",
      "source_url": "URL if available",
      "detected_at": "${new Date().toISOString().split("T")[0]}",
      "strength": 0.0,
      "category": "growth_signal|buying_cycle_trigger|tech_stack_change|leadership_change|competitive_threat|engagement_signal|pain_indicator",
      "decay_rate": "fast|medium|slow"
    }
  ],
  "signal_score": 0,
  "scan_summary": "2-3 sentence synthesis of what these signals mean together. Are they entering a buying cycle? Is this a good time to engage? What's the story?"
}

The signal_score should be 0-100 representing overall buying readiness based on ALL signals (existing + new):
- 80-100: Strong buying cycle indicators, engage immediately
- 60-79: Multiple positive signals, good timing for outreach
- 40-59: Some signals but inconclusive, monitor and gather more
- 20-39: Weak signals, low priority
- 0-19: No meaningful signals detected

IMPORTANT: Only include signals you actually found evidence for. Do NOT fabricate signals. If you find nothing new, return an empty signals array with an honest signal_score.`;
}

export async function buildResearchContext(): Promise<string> {
  const [claudeMd, activeConfig, prospects] = await Promise.all([
    readText("system:claude-md").catch(() => ""),
    getConfigContent(),
    loadProspects(),
  ]);

  const existingCompanies = prospects.map((p) => p.company).join(", ");

  return `# Research Context
Today is ${new Date().toISOString().split("T")[0]}.

## Operating Instructions (Research Section)
${claudeMd}

## Active Product Config (ICP & Qualifiers)
${activeConfig}

## Already in Pipeline (avoid duplicates)
${existingCompanies}

Research thoroughly. Score leads as HOT/WARM/COLD with reasoning. Follow the ICP criteria strictly.`;
}

export async function buildProspectSearchContext(query: string, count: number): Promise<string> {
  const [activeConfig, prospects] = await Promise.all([
    getConfigContent(),
    loadProspects(),
  ]);

  const existingCompanies = prospects.map((p) => {
    const domain = p.website ? p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "") : "";
    return domain ? `${p.company} (${domain})` : p.company;
  }).join(", ");

  const icpMatch = activeConfig.match(/## ICP[\s\S]*?(?=\n## MESSAGING|## COMPETITIVE|$)/i);
  const qualMatch = activeConfig.match(/## QUALIFYING[\s\S]*$/i);
  const productMatch = activeConfig.match(/## PRODUCT[\s\S]*?(?=\n---)/i);
  const trimmedConfig = [
    productMatch?.[0] || "",
    icpMatch?.[0] || "",
    qualMatch?.[0] || "",
  ].filter(Boolean).join("\n\n---\n\n");

  return `# Prospect Discovery Search
Today is ${new Date().toISOString().split("T")[0]}.

## Active Product Config (ICP & Qualifiers)
${trimmedConfig || activeConfig}

## Already in Pipeline (DO NOT include these — check both company name AND website domain)
${existingCompanies}

If a company you find matches ANY of the above by name (even partial match like "ServiceTitan" vs "ServiceTitan Inc.") or by website domain, SKIP it entirely.

## Search Request
The user is looking for: "${query}"
Find exactly ${count} companies that match this search AND fit the ICP criteria above.

## Instructions
1. Search the web for companies matching the user's request
2. For EACH company found, search for:
   - Basic company info (size, revenue, HQ, what they sell)
   - At least 1-2 decision-maker contacts with titles
   - For EVERY contact, search for their LinkedIn profile URL (search "[Name] [Company] site:linkedin.com/in"). This is critical.
   - Pain signals relevant to our product
3. Score each as HOT/WARM/COLD based on the ICP qualifying criteria
4. Do NOT include companies already in the pipeline

## Output Format
Return ONLY a valid JSON object (no markdown fences, no explanation):

{
  "prospects": [
    {
      "company": "Company Name",
      "website": "https://...",
      "industry": "Industry - Sub-category",
      "what_they_sell": "Brief description",
      "hq": "City, State",
      "size": "employee count or range",
      "revenue": "revenue estimate",
      "crm": "if discoverable, otherwise Unknown",
      "contacts": [
        {
          "name": "Full Name",
          "title": "Job Title",
          "linkedin": "https://www.linkedin.com/in/... (MUST search for this)",
          "email": "email if found, empty string if not"
        }
      ],
      "pain_signals": ["signal 1", "signal 2"],
      "score": "HOT|WARM|COLD",
      "score_reasoning": "Why this score — reference specific ICP criteria",
      "status": "new",
      "last_action": "Discovered via prospect search",
      "next_action": "Review and qualify",
      "next_action_date": "${new Date().toISOString().split("T")[0]}",
      "product_config": "ais-mn",
      "notes": ""
    }
  ],
  "search_summary": "Brief summary of what you searched for and what you found"
}

IMPORTANT:
- Find exactly ${count} companies. This is your primary objective.
- Do NOT fabricate companies. Every company must be real and verifiable.
- Do NOT include companies already in the pipeline
- LinkedIn URLs must be real — search for them, don't guess
- If you can't find a LinkedIn URL after searching, use empty string "" — NEVER "Unknown"
- Use the ICP as a guide but DO NOT be overly strict. If the user's search query describes a type of company, find companies matching THEIR description and score them against the ICP. A COLD score is fine — let the user decide what to pursue.
- NEVER return an empty prospects array. If perfect ICP matches don't exist, return the closest matches you can find and score them COLD with honest reasoning.
- You MUST return valid JSON. Do NOT include any conversational text, explanations, or questions before or after the JSON. ONLY the JSON object.`;
}
