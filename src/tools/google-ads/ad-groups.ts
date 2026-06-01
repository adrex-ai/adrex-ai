import { GoogleAdsApi, enums } from "google-ads-api";
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

export async function listAdGroups(
  customerId: string,
  campaignId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  const rows = await customer.query(`
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group.type,
      ad_group.cpc_bid_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr
    FROM ad_group
    WHERE campaign.id = ${numericId(campaignId, "campaign_id")}
      AND ad_group.status != 'REMOVED'
    ORDER BY ad_group.name
  `);

  if (rows.length === 0) return `No ad groups found for campaign ${campaignId}.`;

  const lines = rows.map((row: any) => {
    const bid = (row.ad_group?.cpc_bid_micros || 0) / 1_000_000;
    const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
    const ctr = ((row.metrics?.ctr || 0) * 100).toFixed(2);
    return [
      `### ${row.ad_group?.name}`,
      `- **ID:** ${row.ad_group?.id}`,
      `- **Status:** ${row.ad_group?.status}`,
      `- **Type:** ${row.ad_group?.type}`,
      `- **CPC Bid:** $${bid.toFixed(2)}`,
      `- **Impressions:** ${(row.metrics?.impressions || 0).toLocaleString()}`,
      `- **Clicks:** ${(row.metrics?.clicks || 0).toLocaleString()}`,
      `- **CTR:** ${ctr}%`,
      `- **Cost:** $${cost.toFixed(2)}`,
      `- **Conversions:** ${(row.metrics?.conversions || 0).toFixed(1)}`,
    ].join("\n");
  });

  return `## Ad Groups for Campaign ${campaignId}\n\n${lines.join("\n\n")}`;
}

export async function createAdGroup(
  customerId: string,
  campaignId: string,
  name: string,
  cpcBid: number = 1.0
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  const result = await customer.adGroups.create([
    {
      name,
      campaign: `customers/${cleanId}/campaigns/${numericId(campaignId, "campaign_id")}`,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
      cpc_bid_micros: Math.round(cpcBid * 1_000_000),
    },
  ]);

  const adGroupId = result.results?.[0]?.resource_name?.split("/").pop() ?? "unknown";

  return [
    `## Ad Group Created`,
    ``,
    `- **Name:** ${name}`,
    `- **ID:** ${adGroupId}`,
    `- **Campaign:** ${campaignId}`,
    `- **CPC Bid:** $${cpcBid.toFixed(2)}`,
    `- **Status:** Enabled`,
  ].join("\n");
}

export async function updateAdGroup(
  customerId: string,
  adGroupId: string,
  updates: { name?: string; cpcBid?: number; status?: string }
): Promise<string> {
  const customer = getCustomer(customerId);
  const resourceName = `customers/${customerId.replace(/-/g, "")}/adGroups/${numericId(adGroupId, "ad_group_id")}`;
  const changes: string[] = [];

  const updateData: any = { resource_name: resourceName };

  if (updates.name) {
    updateData.name = updates.name;
    changes.push(`- Name → ${updates.name}`);
  }
  if (updates.cpcBid) {
    updateData.cpc_bid_micros = Math.round(updates.cpcBid * 1_000_000);
    changes.push(`- CPC Bid → $${updates.cpcBid.toFixed(2)}`);
  }
  if (updates.status) {
    updateData.status = updates.status === "PAUSED"
      ? enums.AdGroupStatus.PAUSED
      : enums.AdGroupStatus.ENABLED;
    changes.push(`- Status → ${updates.status}`);
  }

  await customer.adGroups.update([updateData]);

  return `## Ad Group ${adGroupId} Updated\n\n${changes.join("\n")}`;
}

export async function pauseAdGroup(
  customerId: string,
  adGroupId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  await customer.adGroups.update([
    {
      resource_name: `customers/${customerId.replace(/-/g, "")}/adGroups/${numericId(adGroupId, "ad_group_id")}`,
      status: enums.AdGroupStatus.PAUSED,
    },
  ]);

  return `Ad group ${adGroupId} has been **paused**.`;
}

export async function deleteAdGroup(
  customerId: string,
  adGroupId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  await customer.adGroups.update([
    {
      resource_name: `customers/${customerId.replace(/-/g, "")}/adGroups/${numericId(adGroupId, "ad_group_id")}`,
      status: enums.AdGroupStatus.REMOVED,
    },
  ]);

  return `Ad group ${adGroupId} has been **removed**. This action is irreversible.`;
}
