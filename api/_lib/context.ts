import { readText, readJSON, writeJSON } from "./kvStore.js";
import type { Prospect, Signal } from "./types.js";
import { enrichProspectWithApollo, formatApolloContext } from "./apollo.js";

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

TONE RULES (CRITICAL — this is a Minnesota company selling to Minnesota businesses):
- Be warm, friendly, and approachable. We are midwesterners talking to midwesterners. Not aggressive, not pushy.
- Pain points should be framed gently — "a lot of teams we talk to are dealing with..." or "one thing that keeps coming up is..." — not "you're exposed" or "your systems are failing."
- Questions should feel like genuine curiosity, not interrogation. "How are you currently handling..." not "How confident are you in..."
- The vibe is a friendly neighbor who happens to be really good at IT, not a salesperson working a script.
- Still be direct and concise — friendly doesn't mean fluffy. Get to the point, just do it warmly.

IMPORTANT FORMATTING RULES:
- KEEP IT SHORT. Cold emails must be 60-100 words max (not counting subject line or signature). 4-6 sentences total. If you can say it in fewer words, do it. No bullet lists, no multiple paragraphs. Think: one short hook, one pain point, one value line, one CTA. That's it.
- NEVER use em dashes (—) anywhere in the email. Use commas, periods, or rewrite the sentence instead.
- Output ONLY the email. Start with "Subject: ..." then the email body. End with the signature line.
- The signature must ALWAYS be from the SENDER, not the recipient. Sign off as:\n  Matt Keating\n  Director of Sales | IT & Cybersecurity Services\n  Advanced Imaging Solutions\n  E: mattkeating@ais-mn.com\n  P: 952-516-7715
- Do NOT add any analysis, commentary, explanation, or reasoning after the email. No "Why this works", no "Notes:", no breakdown of the framework. Just the email. Nothing else.`;
}

export async function buildDeepResearchContext(prospectIndex: number): Promise<string> {
  const [activeConfig, prospects] = await Promise.all([
    getConfigContent(),
    loadProspects(),
  ]);

  const prospect = prospects[prospectIndex];
  if (!prospect) throw new Error(`Prospect at index ${prospectIndex} not found`);

  // Enrich with Apollo data if domain is available
  let apolloContext = "";
  if (prospect.website) {
    try {
      const domain = prospect.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
      const enrichment = await enrichProspectWithApollo(domain, prospect.company);
      apolloContext = formatApolloContext(enrichment);

      // Persist Apollo data onto the prospect record
      if (enrichment.organization) {
        const org = enrichment.organization;
        const key = getProspectsKey();
        const allProspects = await readJSON<Record<string, unknown>[]>(key);
        if (prospectIndex >= 0 && prospectIndex < allProspects.length) {
          const techs = org.technology_names || org.technologies || [];
          if (techs.length > 0) {
            allProspects[prospectIndex].tech_stack = techs;
          }
          allProspects[prospectIndex].apollo_enrichment = {
            estimated_num_employees: org.estimated_num_employees,
            annual_revenue_printed: org.annual_revenue_printed,
            technologies: techs,
            linkedin_url: org.linkedin_url,
            phone: org.phone,
            enrichedAt: new Date().toISOString(),
          };
          await writeJSON(key, allProspects);
        }
      }
    } catch {
      // Apollo enrichment is optional — continue without it
    }
  }

  return `# Deep Research Context
Today is ${new Date().toISOString().split("T")[0]}.

## Active Product Config
${activeConfig}

## Target Prospect — Current Data
${JSON.stringify(prospect, null, 2)}
${apolloContext ? `\n${apolloContext}\n\nThe Apollo data above is VERIFIED. Use it as your starting point — it provides confirmed employee count, revenue, tech stack, and contact details. Focus your web search on filling gaps and finding recent news, pain signals, and personalization hooks that Apollo doesn't cover.` : ""}

## Your Task
You are a sales research analyst. Deep research this specific company and enrich the prospect data. Use web search to find:

1. **Company details**: What they sell, headquarters, recent news, funding, market position
2. **Location & contact info**: Find the company's physical address (street, city, state, zip) and main phone number. For fabricators, builders, or shops — the shop/office location is critical. Search the company website footer, Google Maps, or business directories.
3. **Decision-maker contacts (TOP PRIORITY)**: Find real names and titles for CEO, CFO, CIO, CISO, IT Director, IT Manager, VP Operations, COO, Owner, or similar leadership. For EVERY contact you find, you MUST do THREE searches:
   - **LinkedIn**: Search "[Name] [Company] site:linkedin.com/in" — try multiple query variations. A real LinkedIn URL is critical for outreach.
   - **Email**: Search "[Name] [Company] email" and also search for the company's email pattern. Check the company website domain and try common patterns: first.last@domain.com, flast@domain.com, firstl@domain.com, first@domain.com. Also search "[Company] email format" or check sites like Hunter.io, RocketReach, or SignalHire results that may appear in search. Finding a real email address is just as important as LinkedIn — do not skip this step.
   - **Phone**: Search for direct phone numbers if available. Check the company website contact page for individual extensions or direct lines. If only a main company number is available, include that.
   If you cannot find a LinkedIn URL, email, or phone after searching, leave the field as an empty string — NEVER put "Unknown" or "N/A".
4. **Tech stack signals**: What IT infrastructure, security tools, cloud platforms, and business systems they use (check job postings, tech review sites, case studies)
5. **Pain signals**: Recent job postings (especially IT, security, compliance roles), leadership changes, mergers/acquisitions, compliance pressure, growth without IT investment
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

  // Enrich with Apollo data if domain is available
  let apolloContext = "";
  if (prospect.website) {
    try {
      const domain = prospect.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
      const enrichment = await enrichProspectWithApollo(domain, prospect.company);
      apolloContext = formatApolloContext(enrichment);

      // Persist Apollo data onto the prospect record
      if (enrichment.organization) {
        const org = enrichment.organization;
        const key = getProspectsKey();
        const allProspects = await readJSON<Record<string, unknown>[]>(key);
        if (prospectIndex >= 0 && prospectIndex < allProspects.length) {
          const techs = org.technology_names || org.technologies || [];
          if (techs.length > 0) {
            allProspects[prospectIndex].tech_stack = techs;
          }
          allProspects[prospectIndex].apollo_enrichment = {
            estimated_num_employees: org.estimated_num_employees,
            annual_revenue_printed: org.annual_revenue_printed,
            technologies: techs,
            linkedin_url: org.linkedin_url,
            phone: org.phone,
            enrichedAt: new Date().toISOString(),
          };
          await writeJSON(key, allProspects);
        }
      }
    } catch {
      // Apollo enrichment is optional — continue without it
    }
  }

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
${apolloContext ? `\n${apolloContext}\n\nThe Apollo data above is VERIFIED — use it to supplement your web search. Tech stack data is especially valuable for identifying pain signals and technology gaps.` : ""}
${existingSignalsStr}

## Your Task
You are a buying signal analyst. Search for FRESH buying signals for this company that indicate they may be entering a buying cycle or have active pain points relevant to our product.

Search for:
1. **Hiring signals**: Job postings for IT Director, CISO, Security Analyst, Compliance Officer, Help Desk, Network Engineer, Systems Administrator. More postings = stronger signal (indicates understaffed IT).
2. **Leadership changes**: New CIO, IT Director, CISO, CFO, COO, VP Operations in the last 6 months. New leaders audit vendors and rebuild infrastructure within 90 days.
3. **Compliance & audit signals**: HIPAA audit findings, CMMC certification efforts, FINRA/SEC examination results, GLBA compliance gaps, cyber insurance renewal or denial, failed security assessments, vendor risk questionnaire activity.
4. **Security incidents**: Ransomware attacks, email compromise/BEC incidents, data breaches, phishing campaigns targeting the company or their industry. Even industry-wide incidents create urgency.
5. **Technology changes**: Legacy system replacements, firewall/endpoint changes, cloud migrations, new office/location IT buildouts, MSP/MSSP vendor switches or RFPs.
6. **Company news**: Expansion, new locations, acquisitions, mergers, regulatory changes affecting their industry, growth announcements. Growth = IT complexity without corresponding IT investment.
7. **Content signals**: LinkedIn posts from leadership about cybersecurity concerns, IT challenges, compliance pressure, digital transformation, or frustration with current IT support.
8. **Pain indicators**: Downtime incidents, IT outage reports, negative Glassdoor reviews mentioning IT/technology issues, public compliance violations.

## Signal Strength Guide
- 0.9-1.0: Confirmed, recent, directly relevant (e.g., ransomware incident last month, failed HIPAA audit)
- 0.7-0.8: Strong indicator, verified (e.g., 3 open IT roles posted this month, new CISO hired)
- 0.5-0.6: Moderate indicator (e.g., cyber insurance requirements tightening in their industry)
- 0.3-0.4: Weak but notable (e.g., one job posting mentions security certifications)
- 0.1-0.2: Background noise, barely relevant

## Decay Rate Guide
- "fast": Signal loses relevance in ~2 weeks (e.g., job posting may be filled)
- "medium": Signal relevant for ~30 days (e.g., leadership change, security incident response)
- "slow": Signal relevant for ~90 days (e.g., compliance deadline, M&A integration, regulatory change)

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

  const existingCompanies = prospects.map((p, i) => {
    const domain = p.website ? p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "") : "";
    return `- ${p.company}${domain ? ` | ${domain}` : ""}`;
  }).join("\n");

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

## RESPONSE FORMAT — READ THIS FIRST, IT OVERRIDES EVERYTHING ELSE
Your ENTIRE response must be a SINGLE valid JSON object matching the schema at the bottom of this prompt.
- START your response with the character "{"
- END your response with the character "}"
- NO markdown headers (no "###", no "**bold**", no "---" separators)
- NO narrative text or bullet-point lists outside the JSON
- NO "Here are the prospects:" preamble
- NO summary/recommendation paragraph after the JSON
- If you are tempted to write a heading like "## SUMMARY" — STOP. Put that text inside the JSON "search_summary" field instead.

If you literally cannot find any matching companies: return {"prospects":[],"search_summary":"explanation of why"}.

## Active Product Config (ICP & Qualifiers)
${trimmedConfig || activeConfig}

## DUPLICATE BLOCKLIST — These companies are already in the pipeline. DO NOT return any of them.
${existingCompanies}

DUPLICATE CHECK RULES (CRITICAL):
- Before including ANY company in your results, check it against EVERY entry in the blocklist above.
- Match by company name (even partial: "ServiceTitan" matches "ServiceTitan Inc.") OR by website domain.
- If a company is on the blocklist, SKIP IT. Do not include it under any circumstances.
- It is better to return FEWER results than to return a duplicate. If you can only find 3 unique companies instead of ${count}, return 3.

## Search Request
The user is looking for: "${query}"
Find up to ${count} NEW companies (not in the blocklist) that match this search AND fit the ICP criteria above.

## Instructions
**Your PRIMARY JOB is to return real, matching companies. Contact enrichment is a SEPARATE flow that runs later — do not block on it here.**

1. Search the web for companies matching the user's request
2. For EACH company found, gather what you can within your search budget:
   - Basic company info (size, revenue, HQ, what they sell) — required if discoverable
   - 1-2 decision-maker names and titles — nice-to-have, NOT required
   - LinkedIn URLs for those contacts — nice-to-have, NOT required
   - Pain signals relevant to our product — include any obvious ones
3. Score each as HOT/WARM/COLD based on the ICP qualifying criteria
4. Do NOT include companies already in the pipeline

**CRITICAL RULE — DO NOT DROP COMPANIES FOR MISSING DATA:**
- If you find a real, matching company but can't find contacts within your search budget: return it anyway with `contacts: []`.
- If you find contacts but no LinkedIn URLs: return them with `"linkedin": ""`.
- NEVER return an empty prospects array just because contact data is incomplete. The user can enrich contacts later via a separate tool.
- The worst possible outcome is returning zero prospects when real matching companies exist. Return what you found.

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
- Find up to ${count} NEW companies. Returning fewer is acceptable if you cannot find ${count} unique, non-duplicate matches. NEVER pad results with duplicates.
- Do NOT fabricate companies. Every company must be real and verifiable.
- ZERO DUPLICATES. Every company you return MUST be checked against the blocklist. This is your highest priority constraint.
- If you identified real matching companies by name but could not fully enrich them with contacts/LinkedIn within your search budget: **STILL RETURN THEM** with `contacts: []` and whatever data you have. Do NOT drop companies for missing contact data.
- LinkedIn URLs must be real if provided — never guess. Empty string "" is always acceptable.
- Use the ICP as a guide but DO NOT be overly strict. If the user's search query describes a type of company, find companies matching THEIR description and score them against the ICP. A COLD score is fine — let the user decide what to pursue.
- If you cannot find any NEW companies that aren't duplicates, return an empty prospects array with a search_summary explaining why. This is better than returning duplicates.

## FINAL REMINDER — DO NOT IGNORE
Your entire response is ONE JSON object. No markdown. No "###" headers. No bullet lists. No preamble. No conclusion paragraph. Start with "{" and end with "}". If you want to summarize your findings, put that text in the "search_summary" field inside the JSON — not outside of it.

## FIELD NAMES ARE EXACT — DO NOT RENAME
Use these field names verbatim. Do NOT substitute "prettier" alternatives:
- Use "company" — NOT "company_name", "name", or "firm"
- Use "score" — NOT "icp_score", "rating", or "fit"
- Use "industry" — NOT "vertical" or "sector"
- Use "size" — NOT "employee_count" or "headcount"
- Use "revenue" — NOT "revenue_estimate" or "annual_revenue"
- Use "hq" — NOT "hq_location", "headquarters", or "location"
- Use "contacts" — NOT "decision_makers" or "people"
- Inside contacts, use "linkedin" — NOT "linkedin_url" or "linkedin_profile"
- Use "search_summary" — NOT "summary" or "overview"
Any field-name deviation will cause the UI to drop the field silently. Match the schema exactly.`;
}
