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

export async function campaignPerformance(
  adAccountId: string,
  days: number = 30
): Promise<string> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const datePresetMap: Record<number, string> = {
    7: "last_7d",
    14: "last_14d",
    28: "last_28d",
    30: "last_30d",
    90: "last_90d",
  };
  const datePreset = datePresetMap[days] || "last_30d";

  const data = await metaGet(`/${accountId}/insights`, {
    fields: "campaign_id,campaign_name,impressions,clicks,ctr,spend,cpc,cpm,actions,cost_per_action_type",
    level: "campaign",
    date_preset: datePreset,
    limit: "100",
  });

  if (!data.data?.length) return `No performance data for the last ${days} days.`;

  let totalSpend = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  const header = `| Campaign | Impressions | Clicks | CTR | CPC | Spend |`;
  const sep = `|---|---|---|---|---|---|`;

  const lines = data.data.map((row: any) => {
    const impressions = parseInt(row.impressions || 0);
    const clicks = parseInt(row.clicks || 0);
    const spend = parseFloat(row.spend || 0);

    totalSpend += spend;
    totalClicks += clicks;
    totalImpressions += impressions;

    return `| ${row.campaign_name} | ${impressions.toLocaleString()} | ${clicks.toLocaleString()} | ${parseFloat(row.ctr || 0).toFixed(2)}% | $${parseFloat(row.cpc || 0).toFixed(2)} | $${spend.toFixed(2)} |`;
  });

  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";

  return [
    `## Meta Ads Performance Summary (Last ${days} days)`,
    ``,
    `**Total Spend:** $${totalSpend.toFixed(2)} | **Impressions:** ${totalImpressions.toLocaleString()} | **Clicks:** ${totalClicks.toLocaleString()} | **CTR:** ${overallCtr}%`,
    ``,
    header,
    sep,
    ...lines,
  ].join("\n");
}

export async function campaignTimeSeries(
  campaignId: string,
  days: number = 30
): Promise<string> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const data = await metaGet(`/${campaignId}/insights`, {
    fields: "impressions,clicks,ctr,spend,cpc,actions",
    time_range: JSON.stringify({
      since: startDate.toISOString().split("T")[0],
      until: endDate.toISOString().split("T")[0],
    }),
    time_increment: "1",
  });

  if (!data.data?.length) return `No daily data for campaign ${campaignId} in the last ${days} days.`;

  const header = `| Date | Impressions | Clicks | CTR | Spend |`;
  const sep = `|---|---|---|---|---|`;

  const lines = data.data.map((row: any) =>
    `| ${row.date_start} | ${parseInt(row.impressions || 0).toLocaleString()} | ${parseInt(row.clicks || 0).toLocaleString()} | ${parseFloat(row.ctr || 0).toFixed(2)}% | $${parseFloat(row.spend || 0).toFixed(2)} |`
  );

  return [
    `## Daily Performance — Campaign ${campaignId} (Last ${days} days)`,
    ``,
    header,
    sep,
    ...lines,
  ].join("\n");
}

export async function campaignBreakdowns(
  campaignId: string,
  breakdownType: string = "device_platform"
): Promise<string> {
  const validBreakdowns = ["device_platform", "publisher_platform", "platform_position", "age", "gender"];
  const breakdown = validBreakdowns.includes(breakdownType) ? breakdownType : "device_platform";

  const data = await metaGet(`/${campaignId}/insights`, {
    fields: "impressions,clicks,ctr,spend,cpc",
    breakdowns: breakdown,
    date_preset: "last_30d",
  });

  if (!data.data?.length) return `No breakdown data for campaign ${campaignId}.`;

  const label = breakdown.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const header = `| ${label} | Impressions | Clicks | CTR | Spend |`;
  const sep = `|---|---|---|---|---|`;

  const lines = data.data.map((row: any) => {
    const segValue = row[breakdown] || "Unknown";
    return `| ${segValue} | ${parseInt(row.impressions || 0).toLocaleString()} | ${parseInt(row.clicks || 0).toLocaleString()} | ${parseFloat(row.ctr || 0).toFixed(2)}% | $${parseFloat(row.spend || 0).toFixed(2)} |`;
  });

  return [
    `## ${label} Breakdown — Campaign ${campaignId}`,
    ``,
    header,
    sep,
    ...lines,
  ].join("\n");
}
