import { GoogleAdsApi, enums } from "google-ads-api";
import { loadGoogleAdsCredentials } from "../auth/google-oauth.js";

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

export async function listKeywords(
  customerId: string,
  adGroupId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  const rows = await customer.query(`
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc
    FROM keyword_view
    WHERE ad_group.id = ${adGroupId}
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.impressions DESC
  `);

  if (rows.length === 0) return `No keywords found in ad group ${adGroupId}.`;

  const header = `| Keyword | Match Type | Status | QS | Impressions | Clicks | CTR | CPC | Cost | Conv |`;
  const sep = `|---|---|---|---|---|---|---|---|---|---|`;

  const lines = rows.map((row: any) => {
    const kw = row.ad_group_criterion;
    const m = row.metrics;
    const cost = (m?.cost_micros || 0) / 1_000_000;
    const cpc = (m?.average_cpc || 0) / 1_000_000;
    const ctr = ((m?.ctr || 0) * 100).toFixed(2);
    const qs = kw?.quality_info?.quality_score || "—";

    return `| ${kw?.keyword?.text} | ${kw?.keyword?.match_type} | ${kw?.status} | ${qs} | ${m?.impressions || 0} | ${m?.clicks || 0} | ${ctr}% | $${cpc.toFixed(2)} | $${cost.toFixed(2)} | ${(m?.conversions || 0).toFixed(1)} |`;
  });

  return `## Keywords in Ad Group ${adGroupId}\n\n${header}\n${sep}\n${lines.join("\n")}`;
}

export async function addKeywords(
  customerId: string,
  adGroupId: string,
  keywords: Array<{ text: string; matchType: string }>
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  const matchTypeMap: Record<string, any> = {
    BROAD: enums.KeywordMatchType.BROAD,
    PHRASE: enums.KeywordMatchType.PHRASE,
    EXACT: enums.KeywordMatchType.EXACT,
  };

  const operations = keywords.map((kw) => ({
    ad_group: `customers/${cleanId}/adGroups/${adGroupId}`,
    status: enums.AdGroupCriterionStatus.ENABLED,
    keyword: {
      text: kw.text,
      match_type: matchTypeMap[kw.matchType.toUpperCase()] || enums.KeywordMatchType.BROAD,
    },
  }));

  const result = await customer.adGroupCriteria.create(operations);

  const added = keywords
    .map((kw) => `- **${kw.text}** (${kw.matchType})`)
    .join("\n");

  return `## ${keywords.length} Keyword(s) Added to Ad Group ${adGroupId}\n\n${added}`;
}

export async function addNegativeKeywords(
  customerId: string,
  campaignId: string,
  keywords: string[]
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  const operations = keywords.map((text) => ({
    campaign: `customers/${cleanId}/campaigns/${campaignId}`,
    negative: true,
    keyword: {
      text,
      match_type: enums.KeywordMatchType.EXACT,
    },
  }));

  await customer.campaignCriteria.create(operations);

  const added = keywords.map((kw) => `- ${kw}`).join("\n");

  return `## ${keywords.length} Negative Keyword(s) Added to Campaign ${campaignId}\n\n${added}`;
}

export async function pauseKeyword(
  customerId: string,
  adGroupId: string,
  criterionId: string
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  await customer.adGroupCriteria.update([
    {
      resource_name: `customers/${cleanId}/adGroupCriteria/${adGroupId}~${criterionId}`,
      status: enums.AdGroupCriterionStatus.PAUSED,
    },
  ]);

  return `Keyword ${criterionId} has been **paused**.`;
}

export async function removeKeyword(
  customerId: string,
  adGroupId: string,
  criterionId: string
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  await customer.adGroupCriteria.remove([
    `customers/${cleanId}/adGroupCriteria/${adGroupId}~${criterionId}`,
  ]);

  return `Keyword ${criterionId} has been **removed**. This action is irreversible.`;
}
