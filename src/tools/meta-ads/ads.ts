import { metaGet, metaPost, metaDelete } from "../../utils/meta-client.js";

export async function listAds(adSetId: string): Promise<string> {
  const data = await metaGet(`/${adSetId}/ads`, {
    fields: "id,name,status,creative{id,title,body,image_url,thumbnail_url,link_url},created_time",
  });

  if (!data.data?.length) return `No ads found in ad set ${adSetId}.`;

  const lines = await Promise.all(
    data.data.map(async (ad: any) => {
      let metricsLine = "";
      try {
        const insights = await metaGet(`/${ad.id}/insights`, {
          fields: "impressions,clicks,ctr,spend,cpc,actions",
          date_preset: "last_30d",
        });
        if (insights.data?.[0]) {
          const m = insights.data[0];
          metricsLine = [
            `- **Impressions:** ${parseInt(m.impressions || 0).toLocaleString()}`,
            `- **Clicks:** ${parseInt(m.clicks || 0).toLocaleString()}`,
            `- **CTR:** ${parseFloat(m.ctr || 0).toFixed(2)}%`,
            `- **CPC:** $${parseFloat(m.cpc || 0).toFixed(2)}`,
            `- **Spend:** $${parseFloat(m.spend || 0).toFixed(2)}`,
          ].join("\n");
        }
      } catch {}

      const creative = ad.creative;

      return [
        `### ${ad.name}`,
        `- **ID:** ${ad.id}`,
        `- **Status:** ${ad.status}`,
        creative?.title ? `- **Title:** ${creative.title}` : "",
        creative?.body ? `- **Body:** ${creative.body.substring(0, 100)}...` : "",
        creative?.link_url ? `- **Link:** ${creative.link_url}` : "",
        metricsLine,
      ]
        .filter(Boolean)
        .join("\n");
    })
  );

  return `## Ads in Ad Set ${adSetId}\n\n${lines.join("\n\n")}`;
}

export async function createAd(
  adAccountId: string,
  adSetId: string,
  name: string,
  pageId: string,
  creative: {
    title: string;
    body: string;
    linkUrl: string;
    imageUrl?: string;
    callToAction?: string;
  }
): Promise<string> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const creativeData: Record<string, any> = {
    name: `${name} Creative`,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        message: creative.body,
        link: creative.linkUrl,
        name: creative.title,
        call_to_action: {
          type: creative.callToAction || "LEARN_MORE",
        },
      },
    },
  };

  if (creative.imageUrl) {
    creativeData.object_story_spec.link_data.picture = creative.imageUrl;
  }

  const creativeResult = await metaPost(`/${accountId}/adcreatives`, creativeData);

  const adResult = await metaPost(`/${accountId}/ads`, {
    name,
    adset_id: adSetId,
    creative: { creative_id: creativeResult.id },
    status: "PAUSED",
  });

  return [
    `## Ad Created`,
    ``,
    `- **Name:** ${name}`,
    `- **Ad ID:** ${adResult.id}`,
    `- **Creative ID:** ${creativeResult.id}`,
    `- **Ad Set:** ${adSetId}`,
    `- **Status:** PAUSED`,
    `- **Title:** ${creative.title}`,
    `- **Link:** ${creative.linkUrl}`,
    ``,
    `> Ad is paused — activate it when you're ready to start serving.`,
  ].join("\n");
}

export async function pauseAd(adId: string): Promise<string> {
  await metaPost(`/${adId}`, { status: "PAUSED" });
  return `Ad ${adId} has been **paused**.`;
}

export async function enableAd(adId: string): Promise<string> {
  await metaPost(`/${adId}`, { status: "ACTIVE" });
  return `Ad ${adId} has been **activated** and will start serving.`;
}

export async function deleteAd(adId: string): Promise<string> {
  await metaDelete(`/${adId}`);
  return `Ad ${adId} has been **deleted**. This action is irreversible.`;
}
