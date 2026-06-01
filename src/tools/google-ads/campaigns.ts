import { GoogleAdsApi, enums } from "google-ads-api";
import { loadGoogleAdsCredentials, type GoogleAdsCredentials } from "../auth/google-oauth.js";

let clientInstance: GoogleAdsApi | null = null;

function getClient(): GoogleAdsApi {
  if (clientInstance) return clientInstance;

  const creds = loadGoogleAdsCredentials();
  clientInstance = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });
  return clientInstance;
}

function getCustomer(customerId: string) {
  const creds = loadGoogleAdsCredentials();
  return getClient().Customer({
    customer_id: customerId.replace(/-/g, ""),
    refresh_token: creds.refreshToken!,
    login_customer_id: creds.loginCustomerId?.replace(/-/g, ""),
  });
}

export async function listAccounts(): Promise<string> {
  const client = getClient();
  const creds = loadGoogleAdsCredentials();

  const customers = await client.listAccessibleCustomers(creds.refreshToken!);
  const accounts: Array<{ id: string; name: string }> = [];

  for (const resourceName of customers.resource_names) {
    const customerId = resourceName.split("/")[1];
    try {
      const customer = getCustomer(customerId);
      const [result] = await customer.query(`
        SELECT customer.id, customer.descriptive_name
        FROM customer
        LIMIT 1
      `);
      accounts.push({
        id: customerId,
        name: result.customer?.descriptive_name || `Account ${customerId}`,
      });
    } catch {
      // Skip inaccessible accounts
    }
  }

  if (accounts.length === 0) return "No accessible Google Ads accounts found.";

  const lines = accounts.map((a) => `- **${a.name}** (ID: ${a.id})`);
  return `## Google Ads Accounts\n\n${lines.join("\n")}`;
}

export async function listCampaigns(
  customerId: string,
  status?: string
): Promise<string> {
  const customer = getCustomer(customerId);

  let whereClause = "WHERE campaign.status != 'REMOVED'";
  if (status) {
    whereClause += ` AND campaign.status = '${status.toUpperCase()}'`;
  }

  const campaigns = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    ${whereClause}
    ORDER BY campaign.name
  `);

  if (campaigns.length === 0) return "No campaigns found.";

  const lines = campaigns.map((row: any) => {
    const budget = (row.campaign_budget?.amount_micros || 0) / 1_000_000;
    const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
    const ctr = ((row.metrics?.ctr || 0) * 100).toFixed(2);
    return [
      `### ${row.campaign?.name}`,
      `- **ID:** ${row.campaign?.id}`,
      `- **Status:** ${row.campaign?.status}`,
      `- **Type:** ${row.campaign?.advertising_channel_type}`,
      `- **Bidding:** ${row.campaign?.bidding_strategy_type}`,
      `- **Daily Budget:** $${budget.toFixed(2)}`,
      `- **Impressions:** ${(row.metrics?.impressions || 0).toLocaleString()}`,
      `- **Clicks:** ${(row.metrics?.clicks || 0).toLocaleString()}`,
      `- **CTR:** ${ctr}%`,
      `- **Cost:** $${cost.toFixed(2)}`,
      `- **Conversions:** ${(row.metrics?.conversions || 0).toFixed(1)}`,
    ].join("\n");
  });

  return `## Campaigns for Account ${customerId}\n\n${lines.join("\n\n")}`;
}

export async function getCampaign(
  customerId: string,
  campaignId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  const [row] = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE campaign.id = ${campaignId}
  `);

  if (!row) return `Campaign ${campaignId} not found.`;

  const c = row.campaign!;
  const m = row.metrics!;
  const budget = (row.campaign_budget?.amount_micros || 0) / 1_000_000;
  const cost = (m.cost_micros || 0) / 1_000_000;
  const roas = cost > 0 ? ((m.conversions_value || 0) / cost).toFixed(2) : "N/A";
  const cpa = (m.conversions || 0) > 0 ? (cost / m.conversions!).toFixed(2) : "N/A";

  return [
    `## ${c.name}`,
    `| Metric | Value |`,
    `|---|---|`,
    `| Status | ${c.status} |`,
    `| Type | ${c.advertising_channel_type} |`,
    `| Bidding | ${c.bidding_strategy_type} |`,
    `| Daily Budget | $${budget.toFixed(2)} |`,
    `| Start Date | ${c.start_date || "N/A"} |`,
    `| End Date | ${c.end_date || "N/A"} |`,
    `| Impressions | ${(m.impressions || 0).toLocaleString()} |`,
    `| Clicks | ${(m.clicks || 0).toLocaleString()} |`,
    `| CTR | ${((m.ctr || 0) * 100).toFixed(2)}% |`,
    `| Avg CPC | $${((m.average_cpc || 0) / 1_000_000).toFixed(2)} |`,
    `| Cost | $${cost.toFixed(2)} |`,
    `| Conversions | ${(m.conversions || 0).toFixed(1)} |`,
    `| Conv Value | $${(m.conversions_value || 0).toFixed(2)} |`,
    `| ROAS | ${roas} |`,
    `| CPA | $${cpa} |`,
  ].join("\n");
}

export async function createSearchCampaign(
  customerId: string,
  name: string,
  dailyBudget: number,
  biddingStrategy: string = "MAXIMIZE_CLICKS",
  targetCountries: string[] = ["US"]
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  const budget = await customer.campaignBudgets.create([
    {
      name: `${name} Budget - ${Date.now()}`,
      amount_micros: Math.round(dailyBudget * 1_000_000),
      delivery_method: enums.BudgetDeliveryMethod.STANDARD,
      explicitly_shared: false,
    },
  ]);

  const budgetResourceName = budget.results[0].resource_name;

  const campaignData: any = {
    name,
    campaign_budget: budgetResourceName,
    advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
    status: enums.CampaignStatus.PAUSED,
    network_settings: {
      target_google_search: true,
      target_search_network: true,
    },
  };

  const strategyMap: Record<string, string> = {
    MAXIMIZE_CLICKS: "target_spend",
    MAXIMIZE_CONVERSIONS: "maximize_conversions",
    MANUAL_CPC: "manual_cpc",
  };

  const strategyField = strategyMap[biddingStrategy] || "target_spend";
  campaignData[strategyField] = strategyField === "manual_cpc"
    ? { enhanced_cpc_enabled: true }
    : {};

  const result = await customer.campaigns.create([campaignData]);
  const campaignResourceName = result.results[0].resource_name;
  const newCampaignId = campaignResourceName.split("/").pop();

  return [
    `## Campaign Created Successfully`,
    ``,
    `- **Name:** ${name}`,
    `- **ID:** ${newCampaignId}`,
    `- **Status:** PAUSED (created paused for your review)`,
    `- **Daily Budget:** $${dailyBudget.toFixed(2)}`,
    `- **Bidding Strategy:** ${biddingStrategy}`,
    `- **Type:** Search`,
    ``,
    `> Campaign is paused — no money will be spent until you resume it.`,
  ].join("\n");
}

export async function pauseCampaign(
  customerId: string,
  campaignId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  await customer.campaigns.update([
    {
      resource_name: `customers/${customerId.replace(/-/g, "")}/campaigns/${campaignId}`,
      status: enums.CampaignStatus.PAUSED,
    },
  ]);

  return `Campaign ${campaignId} has been **paused**. Ad delivery has stopped.`;
}

export async function resumeCampaign(
  customerId: string,
  campaignId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  await customer.campaigns.update([
    {
      resource_name: `customers/${customerId.replace(/-/g, "")}/campaigns/${campaignId}`,
      status: enums.CampaignStatus.ENABLED,
    },
  ]);

  return `Campaign ${campaignId} has been **resumed**. Ad delivery is now active and budget will be spent.`;
}

export async function updateCampaign(
  customerId: string,
  campaignId: string,
  updates: { name?: string; dailyBudget?: number; biddingStrategy?: string }
): Promise<string> {
  const customer = getCustomer(customerId);
  const resourceName = `customers/${customerId.replace(/-/g, "")}/campaigns/${campaignId}`;

  const changes: string[] = [];

  if (updates.name) {
    await customer.campaigns.update([
      { resource_name: resourceName, name: updates.name },
    ]);
    changes.push(`- Name → ${updates.name}`);
  }

  if (updates.dailyBudget) {
    const [campaign] = await customer.query(`
      SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${campaignId}
    `);
    if (campaign?.campaign?.campaign_budget) {
      await customer.campaignBudgets.update([
        {
          resource_name: campaign.campaign.campaign_budget,
          amount_micros: Math.round(updates.dailyBudget * 1_000_000),
        },
      ]);
      changes.push(`- Daily Budget → $${updates.dailyBudget.toFixed(2)}`);
    }
  }

  if (changes.length === 0) return "No changes specified.";

  return `## Campaign ${campaignId} Updated\n\n${changes.join("\n")}`;
}

export async function deleteCampaign(
  customerId: string,
  campaignId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  await customer.campaigns.update([
    {
      resource_name: `customers/${customerId.replace(/-/g, "")}/campaigns/${campaignId}`,
      status: enums.CampaignStatus.REMOVED,
    },
  ]);

  return `Campaign ${campaignId} has been **removed**. This action is irreversible.`;
}

export async function getCampaignTimeSeries(
  customerId: string,
  campaignId: string,
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
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr
    FROM campaign
    WHERE campaign.id = ${campaignId}
      AND segments.date >= '${startStr}'
      AND segments.date <= '${endStr}'
    ORDER BY segments.date
  `);

  if (rows.length === 0) return `No data for campaign ${campaignId} in the last ${days} days.`;

  const lines = rows.map((row: any) => {
    const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
    const ctr = ((row.metrics?.ctr || 0) * 100).toFixed(2);
    return `| ${row.segments?.date} | ${row.metrics?.impressions || 0} | ${row.metrics?.clicks || 0} | ${ctr}% | $${cost.toFixed(2)} | ${(row.metrics?.conversions || 0).toFixed(1)} |`;
  });

  return [
    `## Daily Performance — Campaign ${campaignId} (Last ${days} days)`,
    ``,
    `| Date | Impressions | Clicks | CTR | Cost | Conversions |`,
    `|---|---|---|---|---|---|`,
    ...lines,
  ].join("\n");
}

export async function getCampaignBreakdowns(
  customerId: string,
  campaignId: string,
  breakdownType: string = "device"
): Promise<string> {
  const customer = getCustomer(customerId);

  const segmentMap: Record<string, string> = {
    device: "segments.device",
    network: "segments.ad_network_type",
  };

  const segment = segmentMap[breakdownType] || "segments.device";

  const rows = await customer.query(`
    SELECT
      ${segment},
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr
    FROM campaign
    WHERE campaign.id = ${campaignId}
      AND campaign.status != 'REMOVED'
  `);

  if (rows.length === 0) return `No breakdown data for campaign ${campaignId}.`;

  const lines = rows.map((row: any) => {
    const segVal = breakdownType === "device"
      ? row.segments?.device
      : row.segments?.ad_network_type;
    const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
    const ctr = ((row.metrics?.ctr || 0) * 100).toFixed(2);
    return `| ${segVal} | ${row.metrics?.impressions || 0} | ${row.metrics?.clicks || 0} | ${ctr}% | $${cost.toFixed(2)} | ${(row.metrics?.conversions || 0).toFixed(1)} |`;
  });

  return [
    `## ${breakdownType.charAt(0).toUpperCase() + breakdownType.slice(1)} Breakdown — Campaign ${campaignId}`,
    ``,
    `| ${breakdownType.charAt(0).toUpperCase() + breakdownType.slice(1)} | Impressions | Clicks | CTR | Cost | Conversions |`,
    `|---|---|---|---|---|---|`,
    ...lines,
  ].join("\n");
}
