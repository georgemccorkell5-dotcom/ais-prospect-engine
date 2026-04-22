const APOLLO_BASE = "https://api.apollo.io";

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY not configured");
  return key;
}

async function apolloFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": getApiKey(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo API ${res.status}: ${text}`);
  }
  return res.json();
}

async function apolloGet<T>(path: string): Promise<T> {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": getApiKey(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo API ${res.status}: ${text}`);
  }
  return res.json();
}

// --- Organization Enrichment ---

export interface ApolloOrganization {
  name?: string;
  website_url?: string;
  linkedin_url?: string;
  estimated_num_employees?: number;
  industry?: string;
  keywords?: string[];
  city?: string;
  state?: string;
  country?: string;
  annual_revenue?: number;
  annual_revenue_printed?: string;
  total_funding?: number;
  total_funding_printed?: string;
  latest_funding_round_date?: string;
  technologies?: string[];
  technology_names?: string[];
  phone?: string;
}

export async function enrichOrganization(domain: string): Promise<ApolloOrganization | null> {
  try {
    const data = await apolloGet<{ organization?: ApolloOrganization }>(
      `/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`
    );
    return data.organization || null;
  } catch {
    return null;
  }
}

// --- People / Contact Search ---

export interface ApolloContact {
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  linkedin_url?: string;
  email?: string;
  phone_numbers?: Array<{ raw_number: string; type: string }>;
  organization?: { name?: string };
  city?: string;
  state?: string;
}

export async function searchContacts(
  domain: string,
  titles: string[] = ["CEO", "CFO", "CIO", "CISO", "IT Director", "IT Manager", "VP Operations"],
  limit: number = 5
): Promise<ApolloContact[]> {
  try {
    const data = await apolloFetch<{ contacts?: ApolloContact[]; people?: ApolloContact[] }>(
      "/v1/mixed_people/search",
      {
        organization_domains: [domain],
        person_titles: titles,
        per_page: limit,
      }
    );
    return data.people || data.contacts || [];
  } catch {
    return [];
  }
}

// --- Organization Search (find companies matching criteria) ---

export interface ApolloOrgSearchResult {
  name?: string;
  website_url?: string;
  linkedin_url?: string;
  estimated_num_employees?: number;
  industry?: string;
  city?: string;
  state?: string;
  phone?: string;
}

export async function searchOrganizations(params: {
  locations?: string[];
  industries?: string[];
  minEmployees?: number;
  maxEmployees?: number;
  limit?: number;
}): Promise<ApolloOrgSearchResult[]> {
  try {
    const body: Record<string, unknown> = {
      per_page: params.limit || 10,
    };
    if (params.locations) body.organization_locations = params.locations;
    if (params.industries) body.organization_industry_tag_ids = params.industries;
    if (params.minEmployees || params.maxEmployees) {
      body.organization_num_employees_ranges = [
        `${params.minEmployees || 1},${params.maxEmployees || 500}`,
      ];
    }
    const data = await apolloFetch<{ organizations?: ApolloOrgSearchResult[] }>(
      "/v1/mixed_companies/search",
      body
    );
    return data.organizations || [];
  } catch {
    return [];
  }
}

// --- People Match (enrich a specific person) ---

export async function matchPerson(params: {
  name?: string;
  email?: string;
  linkedinUrl?: string;
  organizationName?: string;
}): Promise<ApolloContact | null> {
  try {
    const body: Record<string, unknown> = {};
    if (params.name) body.name = params.name;
    if (params.email) body.email = params.email;
    if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl;
    if (params.organizationName) body.organization_name = params.organizationName;

    const data = await apolloFetch<{ person?: ApolloContact }>("/v1/people/match", body);
    return data.person || null;
  } catch {
    return null;
  }
}

// --- Aggregate enrichment for signal scans ---

export interface ApolloEnrichmentResult {
  organization: ApolloOrganization | null;
  contacts: ApolloContact[];
  enrichedAt: string;
}

export async function enrichProspectWithApollo(
  domain: string,
  companyName: string
): Promise<ApolloEnrichmentResult> {
  const [organization, contacts] = await Promise.all([
    enrichOrganization(domain),
    searchContacts(domain),
  ]);

  return {
    organization,
    contacts,
    enrichedAt: new Date().toISOString(),
  };
}

// --- Format Apollo data as context for Claude prompts ---

export function formatApolloContext(enrichment: ApolloEnrichmentResult): string {
  const parts: string[] = [];

  if (enrichment.organization) {
    const org = enrichment.organization;
    parts.push("## Apollo Enrichment Data (verified)");
    const details: string[] = [];
    if (org.estimated_num_employees) details.push(`- Employees: ${org.estimated_num_employees}`);
    if (org.annual_revenue_printed) details.push(`- Revenue: ${org.annual_revenue_printed}`);
    if (org.industry) details.push(`- Industry: ${org.industry}`);
    if (org.city && org.state) details.push(`- Location: ${org.city}, ${org.state}`);
    if (org.linkedin_url) details.push(`- LinkedIn: ${org.linkedin_url}`);
    if (org.phone) details.push(`- Phone: ${org.phone}`);
    const techs = org.technology_names || org.technologies || [];
    if (techs.length > 0) {
      details.push(`- Tech Stack: ${techs.slice(0, 15).join(", ")}`);
    }
    if (org.total_funding_printed) details.push(`- Total Funding: ${org.total_funding_printed}`);
    if (org.latest_funding_round_date) details.push(`- Latest Funding: ${org.latest_funding_round_date}`);
    if (org.keywords && org.keywords.length > 0) {
      details.push(`- Keywords: ${org.keywords.slice(0, 10).join(", ")}`);
    }
    parts.push(details.join("\n"));
  }

  if (enrichment.contacts.length > 0) {
    parts.push("\n## Apollo Contacts (verified)");
    for (const c of enrichment.contacts.slice(0, 5)) {
      const line = [`- ${c.name || `${c.first_name} ${c.last_name}`} — ${c.title || "Unknown title"}`];
      if (c.linkedin_url) line.push(`  LinkedIn: ${c.linkedin_url}`);
      if (c.email) line.push(`  Email: ${c.email}`);
      if (c.phone_numbers && c.phone_numbers.length > 0) {
        line.push(`  Phone: ${c.phone_numbers[0].raw_number}`);
      }
      parts.push(line.join("\n"));
    }
  }

  return parts.length > 0 ? parts.join("\n") : "";
}
