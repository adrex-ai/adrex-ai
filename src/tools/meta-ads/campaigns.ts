import { loadMetaAdsCredentials } from "../../auth/meta-oauth.js";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

function getAccessToken(): string {
  const creds = loadMetaAdsCredentials();
  if (!creds.accessToken) {
    throw new Error("Meta Ads access token not configured. Set META_ADS_ACCESS_TOKEN.");
  }
  return creds.accessToken;
}

async function metaGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const token = getAccessToken();
  const queryParams = new URLSearchParams({ access_token: token, ...params });
  const url = `${GRAPH_URL}${path}?${queryParams}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Meta API error: ${response.statusText}`);
  }
  return response.json();
}

async function metaPost(path: string, body: Record<string, any> = {}): Promise<any> {
  const token = getAccessToken();
  const url = `${GRAPH_URL}${path}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: token, ...body }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Meta API error: ${response.statusText}`);
  }
  return response.json();
}

async function metaDelete(path: string): Promise<any> {
  const token = getAccessToken();
  const url = `${GRAPH_URL}${path}?access_token=${token}`;

  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Meta API error: ${response.statusText}`);
  }
  return response.json();
}

export async function listAccounts(): Promise<string> {
  const data = await metaGet("/me/adaccounts", {
    fields: "account_id,name,account_status,currency,timezone_name",
  });

  if (!data.data?.length) return "No Meta ad accounts found.";

  const statusMap: Record<number, string> = {
    1: "Active",
    2: "Disabled",
    3: "Unsettled",
    7: "Pending Review",
    9: "In Grace Period",
    100: "Pending Closure",
    101: "Closed",
    201: "Any Active",
    202: "Any Closed",
  };

  const lines = data.data.map((acc: any) => {
    const status = statusMap[acc.account_status] || `Status ${acc.account_status}`;
    return `- **${acc.name || acc.account_id}** (ID: ${acc.account_id}) — ${status}, ${acc.currency}`;
  });

  return `## Meta Ad Accounts\n\n${lines.join("\n")}`;
}

export async function listCampaigns(
  adAccountId: string,
  status?: string
): Promise<string> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  let filterParam = "";
  if (status) {
    filterParam = `&filtering=[{"field":"effective_status","operator":"IN","value":["${status.toUpperCase()}"]}]`;
  }

  const fields = "id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,created_time";
  const insightsFields = "impressions,clicks,ctr,spend,actions,cost_per_action_type";

  const data = await metaGet(`/${accountId}/campaigns`, {
    fields,
    limit: "100",
  });

  if (!data.data?.length) return "No campaigns found.";

  const lines = await Promise.all(
    data.data.map(async (c: any) => {
      let metricsLine = "";
      try {
        const insights = await metaGet(`/${c.id}/insights`, {
          fields: insightsFields,
          date_preset: "last_30d",
        });
        if (insights.data?.[0]) {
          const m = insights.data[0];
          const purchases = m.actions?.find((a: any) => a.action_type === "purchase");
          metricsLine = [
            `- **Impressions:** ${parseInt(m.impressions || 0).toLocaleString()}`,
            `- **Clicks:** ${parseInt(m.clicks || 0).toLocaleString()}`,
            `- **CTR:** ${parseFloat(m.ctr || 0).toFixed(2)}%`,
            `- **Spend:** $${parseFloat(m.spend || 0).toFixed(2)}`,
            purchases ? `- **Purchases:** ${purchases.value}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        }
      } catch {
        // Insights may not be available for all campaigns
      }

      const budget = c.daily_budget
        ? `$${(parseInt(c.daily_budget) / 100).toFixed(2)}/day`
        : c.lifetime_budget
          ? `$${(parseInt(c.lifetime_budget) / 100).toFixed(2)} lifetime`
          : "No budget set";

      return [
        `### ${c.name}`,
        `- **ID:** ${c.id}`,
        `- **Status:** ${c.status}`,
        `- **Objective:** ${c.objective}`,
        `- **Budget:** ${budget}`,
        metricsLine,
      ]
        .filter(Boolean)
        .join("\n");
    })
  );

  return `## Meta Ads Campaigns\n\n${lines.join("\n\n")}`;
}

export async function getCampaign(
  campaignId: string
): Promise<string> {
  const fields = "id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,created_time,start_time,stop_time,buying_type";

  const c = await metaGet(`/${campaignId}`, { fields });

  let metricsSection = "";
  try {
    const insights = await metaGet(`/${campaignId}/insights`, {
      fields: "impressions,clicks,ctr,spend,cpc,cpm,actions,cost_per_action_type",
      date_preset: "last_30d",
    });
    if (insights.data?.[0]) {
      const m = insights.data[0];
      metricsSection = [
        ``,
        `### Performance (Last 30 days)`,
        `| Metric | Value |`,
        `|---|---|`,
        `| Impressions | ${parseInt(m.impressions || 0).toLocaleString()} |`,
        `| Clicks | ${parseInt(m.clicks || 0).toLocaleString()} |`,
        `| CTR | ${parseFloat(m.ctr || 0).toFixed(2)}% |`,
        `| CPC | $${parseFloat(m.cpc || 0).toFixed(2)} |`,
        `| CPM | $${parseFloat(m.cpm || 0).toFixed(2)} |`,
        `| Spend | $${parseFloat(m.spend || 0).toFixed(2)} |`,
      ].join("\n");
    }
  } catch {
    // Insights may not be available
  }

  const budget = c.daily_budget
    ? `$${(parseInt(c.daily_budget) / 100).toFixed(2)}/day`
    : c.lifetime_budget
      ? `$${(parseInt(c.lifetime_budget) / 100).toFixed(2)} lifetime`
      : "No budget set";

  return [
    `## ${c.name}`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| ID | ${c.id} |`,
    `| Status | ${c.status} |`,
    `| Objective | ${c.objective} |`,
    `| Buying Type | ${c.buying_type || "AUCTION"} |`,
    `| Budget | ${budget} |`,
    `| Created | ${c.created_time} |`,
    `| Start | ${c.start_time || "—"} |`,
    `| End | ${c.stop_time || "—"} |`,
    metricsSection,
  ].join("\n");
}

export async function createCampaign(
  adAccountId: string,
  name: string,
  objective: string,
  dailyBudget?: number,
  lifetimeBudget?: number
): Promise<string> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const body: Record<string, any> = {
    name,
    objective: objective.toUpperCase(),
    status: "PAUSED",
    special_ad_categories: [],
  };

  if (dailyBudget) {
    body.daily_budget = Math.round(dailyBudget * 100);
  } else if (lifetimeBudget) {
    body.lifetime_budget = Math.round(lifetimeBudget * 100);
  }

  const result = await metaPost(`/${accountId}/campaigns`, body);

  return [
    `## Meta Campaign Created`,
    ``,
    `- **Name:** ${name}`,
    `- **ID:** ${result.id}`,
    `- **Objective:** ${objective}`,
    `- **Status:** PAUSED (created paused for your review)`,
    dailyBudget ? `- **Daily Budget:** $${dailyBudget.toFixed(2)}` : "",
    lifetimeBudget ? `- **Lifetime Budget:** $${lifetimeBudget.toFixed(2)}` : "",
    ``,
    `> Campaign is paused — no money will be spent until you activate it.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function updateCampaign(
  campaignId: string,
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

  await metaPost(`/${campaignId}`, body);

  return `## Campaign ${campaignId} Updated\n\n${changes.join("\n")}`;
}

export async function pauseCampaign(campaignId: string): Promise<string> {
  await metaPost(`/${campaignId}`, { status: "PAUSED" });
  return `Campaign ${campaignId} has been **paused**. Ad delivery has stopped.`;
}

export async function resumeCampaign(campaignId: string): Promise<string> {
  await metaPost(`/${campaignId}`, { status: "ACTIVE" });
  return `Campaign ${campaignId} has been **activated**. Ad delivery is now live and budget will be spent.`;
}

export async function deleteCampaign(campaignId: string): Promise<string> {
  await metaDelete(`/${campaignId}`);
  return `Campaign ${campaignId} has been **deleted**. This action is irreversible.`;
}
