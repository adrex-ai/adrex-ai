import { GoogleAdsApi } from "google-ads-api";
import { loadGoogleAdsCredentials } from "../../auth/google-oauth.js";
import { numericId } from "../../utils/validate.js";

function getCustomer(customerId: string) {
  const creds = loadGoogleAdsCredentials();
  const client = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });
  return client.Customer({
    customer_id: customerId.replace(/-/g, ""),
    refresh_token: creds.refreshToken!,
    login_customer_id: creds.loginCustomerId?.replace(/-/g, ""),
  });
}

export async function campaignPerformance(
  customerId: string,
  days: number = 30
): Promise<string> {
  const customer = getCustomer(customerId);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE campaign.status != 'REMOVED'
      AND segments.date >= '${startStr}'
      AND segments.date <= '${endStr}'
    ORDER BY metrics.cost_micros DESC
  `);

  if (rows.length === 0) return `No performance data for the last ${days} days.`;

  let totalCost = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalConversions = 0;
  let totalConvValue = 0;

  const header = `| Campaign | Status | Budget | Impressions | Clicks | CTR | Cost | Conv | ROAS |`;
  const sep = `|---|---|---|---|---|---|---|---|---|`;

  const lines = rows.map((row: any) => {
    const budget = (row.campaign_budget?.amount_micros || 0) / 1_000_000;
    const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
    const ctr = ((row.metrics?.ctr || 0) * 100).toFixed(2);
    const convValue = row.metrics?.conversions_value || 0;
    const roas = cost > 0 ? (convValue / cost).toFixed(2) : "—";

    totalCost += cost;
    totalClicks += row.metrics?.clicks || 0;
    totalImpressions += row.metrics?.impressions || 0;
    totalConversions += row.metrics?.conversions || 0;
    totalConvValue += convValue;

    return `| ${row.campaign?.name} | ${row.campaign?.status} | $${budget.toFixed(0)} | ${(row.metrics?.impressions || 0).toLocaleString()} | ${(row.metrics?.clicks || 0).toLocaleString()} | ${ctr}% | $${cost.toFixed(2)} | ${(row.metrics?.conversions || 0).toFixed(1)} | ${roas}x |`;
  });

  const overallRoas = totalCost > 0 ? (totalConvValue / totalCost).toFixed(2) : "—";
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";

  return [
    `## Google Ads Performance Summary (Last ${days} days)`,
    ``,
    `**Total Spend:** $${totalCost.toFixed(2)} | **Impressions:** ${totalImpressions.toLocaleString()} | **Clicks:** ${totalClicks.toLocaleString()} | **CTR:** ${overallCtr}% | **Conversions:** ${totalConversions.toFixed(1)} | **ROAS:** ${overallRoas}x`,
    ``,
    header,
    sep,
    ...lines,
  ].join("\n");
}

export async function auctionInsights(
  customerId: string,
  campaignId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  const rows = await customer.query(`
    SELECT
      auction_insight.display_domain,
      auction_insight.impression_share,
      auction_insight.overlap_rate,
      auction_insight.outranking_share,
      auction_insight.position_above_rate,
      auction_insight.top_of_page_rate,
      auction_insight.abs_top_of_page_rate
    FROM campaign
    WHERE campaign.id = ${numericId(campaignId, "campaign_id")}
  `);

  if (rows.length === 0) return `No auction insights available for campaign ${campaignId}.`;

  const header = `| Competitor | Impr Share | Overlap | Outranking | Pos Above | Top of Page | Abs Top |`;
  const sep = `|---|---|---|---|---|---|---|`;

  const lines = rows.map((row: any) => {
    const ai = row.auction_insight;
    return `| ${ai?.display_domain} | ${((ai?.impression_share || 0) * 100).toFixed(1)}% | ${((ai?.overlap_rate || 0) * 100).toFixed(1)}% | ${((ai?.outranking_share || 0) * 100).toFixed(1)}% | ${((ai?.position_above_rate || 0) * 100).toFixed(1)}% | ${((ai?.top_of_page_rate || 0) * 100).toFixed(1)}% | ${((ai?.abs_top_of_page_rate || 0) * 100).toFixed(1)}% |`;
  });

  return [
    `## Auction Insights — Campaign ${campaignId}`,
    ``,
    header,
    sep,
    ...lines,
  ].join("\n");
}

export async function getBudget(
  customerId: string,
  campaignId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  const [row] = await customer.query(`
    SELECT
      campaign.name,
      campaign_budget.amount_micros,
      campaign_budget.total_amount_micros,
      campaign_budget.status,
      campaign_budget.delivery_method,
      campaign_budget.explicitly_shared,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${numericId(campaignId, "campaign_id")}
  `);

  if (!row) return `Campaign ${campaignId} not found.`;

  const daily = (row.campaign_budget?.amount_micros || 0) / 1_000_000;
  const spent = (row.metrics?.cost_micros || 0) / 1_000_000;

  return [
    `## Budget — ${row.campaign?.name}`,
    ``,
    `- **Daily Budget:** $${daily.toFixed(2)}`,
    `- **Total Spent:** $${spent.toFixed(2)}`,
    `- **Delivery:** ${row.campaign_budget?.delivery_method}`,
    `- **Status:** ${row.campaign_budget?.status}`,
    `- **Shared:** ${row.campaign_budget?.explicitly_shared ? "Yes" : "No"}`,
  ].join("\n");
}
