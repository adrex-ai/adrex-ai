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

export async function listAds(
  customerId: string,
  adGroupId: string
): Promise<string> {
  const customer = getCustomer(customerId);

  const rows = await customer.query(`
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.ad.type,
      ad_group_ad.status,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.final_urls,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr
    FROM ad_group_ad
    WHERE ad_group.id = ${adGroupId}
      AND ad_group_ad.status != 'REMOVED'
    ORDER BY ad_group_ad.ad.id
  `);

  if (rows.length === 0) return `No ads found in ad group ${adGroupId}.`;

  const lines = rows.map((row: any) => {
    const ad = row.ad_group_ad?.ad;
    const m = row.metrics;
    const cost = (m?.cost_micros || 0) / 1_000_000;
    const ctr = ((m?.ctr || 0) * 100).toFixed(2);

    const headlines = ad?.responsive_search_ad?.headlines
      ?.map((h: any) => h.text)
      .slice(0, 3)
      .join(" | ") || "N/A";

    return [
      `### Ad ${ad?.id}`,
      `- **Type:** ${ad?.type}`,
      `- **Status:** ${row.ad_group_ad?.status}`,
      `- **Headlines:** ${headlines}`,
      `- **Final URL:** ${ad?.final_urls?.[0] || "N/A"}`,
      `- **Impressions:** ${(m?.impressions || 0).toLocaleString()}`,
      `- **Clicks:** ${(m?.clicks || 0).toLocaleString()}`,
      `- **CTR:** ${ctr}%`,
      `- **Cost:** $${cost.toFixed(2)}`,
      `- **Conversions:** ${(m?.conversions || 0).toFixed(1)}`,
    ].join("\n");
  });

  return `## Ads in Ad Group ${adGroupId}\n\n${lines.join("\n\n")}`;
}

export async function createResponsiveSearchAd(
  customerId: string,
  adGroupId: string,
  headlines: string[],
  descriptions: string[],
  finalUrl: string
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  const headlineAssets = headlines.map((text) => ({
    text,
    pinned_field: undefined,
  }));
  const descriptionAssets = descriptions.map((text) => ({
    text,
    pinned_field: undefined,
  }));

  const result = await customer.adGroupAds.create([
    {
      ad_group: `customers/${cleanId}/adGroups/${adGroupId}`,
      status: enums.AdGroupAdStatus.PAUSED,
      ad: {
        responsive_search_ad: {
          headlines: headlineAssets,
          descriptions: descriptionAssets,
        },
        final_urls: [finalUrl],
      },
    },
  ]);

  const adId = result.results[0].resource_name.split("/").pop();

  return [
    `## Responsive Search Ad Created`,
    ``,
    `- **Ad ID:** ${adId}`,
    `- **Ad Group:** ${adGroupId}`,
    `- **Status:** PAUSED (for your review)`,
    `- **Final URL:** ${finalUrl}`,
    `- **Headlines:** ${headlines.join(" | ")}`,
    `- **Descriptions:** ${descriptions.join(" | ")}`,
    ``,
    `> Ad is paused — enable it when you're ready to start serving.`,
  ].join("\n");
}

export async function pauseAd(
  customerId: string,
  adGroupId: string,
  adId: string
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  await customer.adGroupAds.update([
    {
      resource_name: `customers/${cleanId}/adGroupAds/${adGroupId}~${adId}`,
      status: enums.AdGroupAdStatus.PAUSED,
    },
  ]);

  return `Ad ${adId} has been **paused**.`;
}

export async function enableAd(
  customerId: string,
  adGroupId: string,
  adId: string
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  await customer.adGroupAds.update([
    {
      resource_name: `customers/${cleanId}/adGroupAds/${adGroupId}~${adId}`,
      status: enums.AdGroupAdStatus.ENABLED,
    },
  ]);

  return `Ad ${adId} has been **enabled** and will start serving.`;
}

export async function deleteAd(
  customerId: string,
  adGroupId: string,
  adId: string
): Promise<string> {
  const customer = getCustomer(customerId);
  const cleanId = customerId.replace(/-/g, "");

  await customer.adGroupAds.update([
    {
      resource_name: `customers/${cleanId}/adGroupAds/${adGroupId}~${adId}`,
      status: enums.AdGroupAdStatus.REMOVED,
    },
  ]);

  return `Ad ${adId} has been **removed**. This action is irreversible.`;
}
