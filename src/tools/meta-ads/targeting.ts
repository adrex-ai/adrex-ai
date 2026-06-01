import { loadMetaAdsCredentials } from "../../auth/meta-oauth.js";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

async function metaGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const creds = loadMetaAdsCredentials();
  const queryParams = new URLSearchParams({ access_token: creds.accessToken!, ...params });
  const response = await fetch(`${GRAPH_URL}${path}?${queryParams}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || response.statusText);
  }
  return response.json();
}

export async function searchInterests(query: string): Promise<string> {
  const data = await metaGet("/search", {
    type: "adinterest",
    q: query,
  });

  if (!data.data?.length) return `No interests found for "${query}".`;

  const lines = data.data.slice(0, 20).map((interest: any) =>
    `- **${interest.name}** (ID: ${interest.id}) — Audience: ~${(interest.audience_size || 0).toLocaleString()}`
  );

  return `## Targeting Interests for "${query}"\n\n${lines.join("\n")}`;
}

export async function listAudiences(adAccountId: string): Promise<string> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const data = await metaGet(`/${accountId}/customaudiences`, {
    fields: "id,name,subtype,approximate_count,delivery_status,operation_status",
  });

  if (!data.data?.length) return "No custom audiences found.";

  const lines = data.data.map((aud: any) =>
    `- **${aud.name}** (ID: ${aud.id}) — ${aud.subtype}, ~${(aud.approximate_count || 0).toLocaleString()} people`
  );

  return `## Custom Audiences\n\n${lines.join("\n")}`;
}

export async function listPages(): Promise<string> {
  const data = await metaGet("/me/accounts", {
    fields: "id,name,category,fan_count",
  });

  if (!data.data?.length) return "No Facebook pages found.";

  const lines = data.data.map((page: any) =>
    `- **${page.name}** (ID: ${page.id}) — ${page.category || "Page"}, ${(page.fan_count || 0).toLocaleString()} followers`
  );

  return `## Facebook Pages\n\n${lines.join("\n")}`;
}

export async function updateTargeting(
  adSetId: string,
  targeting: {
    ageMin?: number;
    ageMax?: number;
    genders?: number[];
    countries?: string[];
    interests?: Array<{ id: string; name: string }>;
  }
): Promise<string> {
  const creds = loadMetaAdsCredentials();
  const changes: string[] = [];

  const targetingSpec: Record<string, any> = {};

  if (targeting.ageMin) {
    targetingSpec.age_min = targeting.ageMin;
    changes.push(`- Age Min → ${targeting.ageMin}`);
  }
  if (targeting.ageMax) {
    targetingSpec.age_max = targeting.ageMax;
    changes.push(`- Age Max → ${targeting.ageMax}`);
  }
  if (targeting.genders?.length) {
    targetingSpec.genders = targeting.genders;
    changes.push(`- Genders → ${targeting.genders.map(g => g === 1 ? "Male" : "Female").join(", ")}`);
  }
  if (targeting.countries?.length) {
    targetingSpec.geo_locations = { countries: targeting.countries };
    changes.push(`- Countries → ${targeting.countries.join(", ")}`);
  }
  if (targeting.interests?.length) {
    targetingSpec.flexible_spec = [{ interests: targeting.interests }];
    changes.push(`- Interests → ${targeting.interests.map(i => i.name).join(", ")}`);
  }

  const response = await fetch(`${GRAPH_URL}/${adSetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: creds.accessToken!,
      targeting: targetingSpec,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || response.statusText);
  }

  return `## Targeting Updated for Ad Set ${adSetId}\n\n${changes.join("\n")}`;
}
