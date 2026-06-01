import { loadMetaAdsCredentials } from "../auth/meta-oauth.js";

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

async function metaPost(path: string, body: Record<string, any> = {}): Promise<any> {
  const creds = loadMetaAdsCredentials();
  const response = await fetch(`${GRAPH_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: creds.accessToken!, ...body }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || response.statusText);
  }
  return response.json();
}

async function metaDelete(path: string): Promise<any> {
  const creds = loadMetaAdsCredentials();
  const response = await fetch(`${GRAPH_URL}${path}?access_token=${creds.accessToken!}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || response.statusText);
  }
  return response.json();
}

export async function listAdSets(
  campaignId: string
): Promise<string> {
  const data = await metaGet(`/${campaignId}/adsets`, {
    fields: "id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting,created_time",
  });

  if (!data.data?.length) return `No ad sets found for campaign ${campaignId}.`;

  const lines = await Promise.all(
    data.data.map(async (adset: any) => {
      let metricsLine = "";
      try {
        const insights = await metaGet(`/${adset.id}/insights`, {
          fields: "impressions,clicks,ctr,spend,actions",
          date_preset: "last_30d",
        });
        if (insights.data?.[0]) {
          const m = insights.data[0];
          metricsLine = [
            `- **Impressions:** ${parseInt(m.impressions || 0).toLocaleString()}`,
            `- **Clicks:** ${parseInt(m.clicks || 0).toLocaleString()}`,
            `- **CTR:** ${parseFloat(m.ctr || 0).toFixed(2)}%`,
            `- **Spend:** $${parseFloat(m.spend || 0).toFixed(2)}`,
          ].join("\n");
        }
      } catch {}

      const budget = adset.daily_budget
        ? `$${(parseInt(adset.daily_budget) / 100).toFixed(2)}/day`
        : adset.lifetime_budget
          ? `$${(parseInt(adset.lifetime_budget) / 100).toFixed(2)} lifetime`
          : "CBO";

      const targeting = adset.targeting;
      const ageRange = targeting
        ? `${targeting.age_min || 18}-${targeting.age_max || 65}`
        : "—";
      const genders = targeting?.genders?.length
        ? targeting.genders.map((g: number) => (g === 1 ? "Male" : "Female")).join(", ")
        : "All";

      return [
        `### ${adset.name}`,
        `- **ID:** ${adset.id}`,
        `- **Status:** ${adset.status}`,
        `- **Budget:** ${budget}`,
        `- **Optimization:** ${adset.optimization_goal || "—"}`,
        `- **Age:** ${ageRange}`,
        `- **Gender:** ${genders}`,
        metricsLine,
      ]
        .filter(Boolean)
        .join("\n");
    })
  );

  return `## Ad Sets for Campaign ${campaignId}\n\n${lines.join("\n\n")}`;
}

export async function createAdSet(
  adAccountId: string,
  campaignId: string,
  name: string,
  dailyBudget: number,
  optimizationGoal: string = "LINK_CLICKS",
  targeting: {
    ageMin?: number;
    ageMax?: number;
    genders?: number[];
    countries?: string[];
    interests?: Array<{ id: string; name: string }>;
  } = {}
): Promise<string> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const targetingSpec: Record<string, any> = {
    age_min: targeting.ageMin || 18,
    age_max: targeting.ageMax || 65,
    geo_locations: {
      countries: targeting.countries || ["US"],
    },
  };

  if (targeting.genders?.length) {
    targetingSpec.genders = targeting.genders;
  }
  if (targeting.interests?.length) {
    targetingSpec.flexible_spec = [{ interests: targeting.interests }];
  }

  const body: Record<string, any> = {
    name,
    campaign_id: campaignId,
    daily_budget: Math.round(dailyBudget * 100),
    optimization_goal: optimizationGoal.toUpperCase(),
    billing_event: "IMPRESSIONS",
    targeting: targetingSpec,
    status: "PAUSED",
  };

  const result = await metaPost(`/${accountId}/adsets`, body);

  return [
    `## Ad Set Created`,
    ``,
    `- **Name:** ${name}`,
    `- **ID:** ${result.id}`,
    `- **Campaign:** ${campaignId}`,
    `- **Daily Budget:** $${dailyBudget.toFixed(2)}`,
    `- **Optimization:** ${optimizationGoal}`,
    `- **Status:** PAUSED`,
    `- **Countries:** ${(targeting.countries || ["US"]).join(", ")}`,
    `- **Age:** ${targeting.ageMin || 18}-${targeting.ageMax || 65}`,
  ].join("\n");
}

export async function updateAdSet(
  adSetId: string,
  updates: { name?: string; dailyBudget?: number; status?: string }
): Promise<string> {
  const body: Record<string, any> = {};
  const changes: string[] = [];

  if (updates.name) {
    body.name = updates.name;
    changes.push(`- Name → ${updates.name}`);
  }
  if (updates.dailyBudget) {
    body.daily_budget = Math.round(updates.dailyBudget * 100);
    changes.push(`- Daily Budget → $${updates.dailyBudget.toFixed(2)}`);
  }
  if (updates.status) {
    body.status = updates.status.toUpperCase();
    changes.push(`- Status → ${updates.status}`);
  }

  await metaPost(`/${adSetId}`, body);

  return `## Ad Set ${adSetId} Updated\n\n${changes.join("\n")}`;
}

export async function pauseAdSet(adSetId: string): Promise<string> {
  await metaPost(`/${adSetId}`, { status: "PAUSED" });
  return `Ad set ${adSetId} has been **paused**.`;
}

export async function deleteAdSet(adSetId: string): Promise<string> {
  await metaDelete(`/${adSetId}`);
  return `Ad set ${adSetId} has been **deleted**. This action is irreversible.`;
}
