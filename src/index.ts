#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import * as googleCampaigns from "./tools/google-ads/campaigns.js";
import * as googleAdGroups from "./tools/google-ads/ad-groups.js";
import * as googleAds from "./tools/google-ads/ads.js";
import * as googleKeywords from "./tools/google-ads/keywords.js";
import * as googleMetrics from "./tools/google-ads/metrics.js";

import * as metaCampaigns from "./tools/meta-ads/campaigns.js";
import * as metaAdSets from "./tools/meta-ads/ad-sets.js";
import * as metaAds from "./tools/meta-ads/ads.js";
import * as metaTargeting from "./tools/meta-ads/targeting.js";
import * as metaMetrics from "./tools/meta-ads/metrics.js";

import { isGoogleAdsConfigured } from "./auth/google-oauth.js";
import { isMetaAdsConfigured } from "./auth/meta-oauth.js";
import { safetyNotice } from "./utils/safety.js";

const server = new McpServer({
  name: "adrex-ai",
  version: "1.0.0",
});

// ─── Google Ads: Accounts ───────────────────────────────────────────────────

server.registerTool(
  "google_ads_list_accounts",
  {
    description: "List all accessible Google Ads accounts",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await googleCampaigns.listAccounts();
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Google Ads: Campaigns ──────────────────────────────────────────────────

server.registerTool(
  "google_ads_list_campaigns",
  {
    description: "List all campaigns for a Google Ads account with performance metrics",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      status: z.string().optional().describe("Filter by status: ENABLED, PAUSED"),
    },
  },
  async ({ customer_id, status }) => {
    try {
      const result = await googleCampaigns.listCampaigns(customer_id, status);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_get_campaign",
  {
    description: "Get detailed information and metrics for a specific Google Ads campaign",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
    },
  },
  async ({ customer_id, campaign_id }) => {
    try {
      const result = await googleCampaigns.getCampaign(customer_id, campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_create_search_campaign",
  {
    description: "Create a new Google Ads Search campaign. Campaign is created PAUSED for safety — no money will be spent until you resume it.",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      name: z.string().describe("Campaign name"),
      daily_budget: z.number().describe("Daily budget in dollars"),
      bidding_strategy: z.enum(["MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS", "MANUAL_CPC"]).default("MAXIMIZE_CLICKS").describe("Bidding strategy"),
      target_countries: z.array(z.string()).default(["US"]).describe("Target country codes"),
    },
  },
  async ({ customer_id, name, daily_budget, bidding_strategy, target_countries }) => {
    try {
      const result = await googleCampaigns.createSearchCampaign(customer_id, name, daily_budget, bidding_strategy, target_countries);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_update_campaign",
  {
    description: "Update a Google Ads campaign's name, budget, or bidding strategy",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
      name: z.string().optional().describe("New campaign name"),
      daily_budget: z.number().optional().describe("New daily budget in dollars"),
      bidding_strategy: z.string().optional().describe("New bidding strategy"),
    },
  },
  async ({ customer_id, campaign_id, name, daily_budget, bidding_strategy }) => {
    try {
      const result = await googleCampaigns.updateCampaign(customer_id, campaign_id, { name, dailyBudget: daily_budget, biddingStrategy: bidding_strategy });
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_pause_campaign",
  {
    description: "Pause a Google Ads campaign — stops ad delivery immediately",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID to pause"),
    },
  },
  async ({ customer_id, campaign_id }) => {
    try {
      const result = await googleCampaigns.pauseCampaign(customer_id, campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_resume_campaign",
  {
    description: "Resume a paused Google Ads campaign — this will start spending your budget",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID to resume"),
    },
  },
  async ({ customer_id, campaign_id }) => {
    try {
      const result = await googleCampaigns.resumeCampaign(customer_id, campaign_id);
      return { content: [{ type: "text", text: `${safetyNotice("resume")}\n\n${result}` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_delete_campaign",
  {
    description: "Permanently remove a Google Ads campaign — this action is IRREVERSIBLE",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID to delete"),
    },
  },
  async ({ customer_id, campaign_id }) => {
    try {
      const result = await googleCampaigns.deleteCampaign(customer_id, campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Google Ads: Ad Groups ──────────────────────────────────────────────────

server.registerTool(
  "google_ads_list_ad_groups",
  {
    description: "List all ad groups for a Google Ads campaign with performance metrics",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
    },
  },
  async ({ customer_id, campaign_id }) => {
    try {
      const result = await googleAdGroups.listAdGroups(customer_id, campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_create_ad_group",
  {
    description: "Create a new ad group within a Google Ads campaign",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
      name: z.string().describe("Ad group name"),
      cpc_bid: z.number().default(1.0).describe("Max CPC bid in dollars"),
    },
  },
  async ({ customer_id, campaign_id, name, cpc_bid }) => {
    try {
      const result = await googleAdGroups.createAdGroup(customer_id, campaign_id, name, cpc_bid);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_update_ad_group",
  {
    description: "Update a Google Ads ad group's name, bid, or status",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      name: z.string().optional().describe("New name"),
      cpc_bid: z.number().optional().describe("New CPC bid in dollars"),
      status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New status"),
    },
  },
  async ({ customer_id, ad_group_id, name, cpc_bid, status }) => {
    try {
      const result = await googleAdGroups.updateAdGroup(customer_id, ad_group_id, { name, cpcBid: cpc_bid, status });
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_pause_ad_group",
  {
    description: "Pause a Google Ads ad group",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID to pause"),
    },
  },
  async ({ customer_id, ad_group_id }) => {
    try {
      const result = await googleAdGroups.pauseAdGroup(customer_id, ad_group_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_delete_ad_group",
  {
    description: "Permanently remove a Google Ads ad group — IRREVERSIBLE",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID to delete"),
    },
  },
  async ({ customer_id, ad_group_id }) => {
    try {
      const result = await googleAdGroups.deleteAdGroup(customer_id, ad_group_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Google Ads: Ads ────────────────────────────────────────────────────────

server.registerTool(
  "google_ads_list_ads",
  {
    description: "List all ads in a Google Ads ad group with performance metrics",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
    },
  },
  async ({ customer_id, ad_group_id }) => {
    try {
      const result = await googleAds.listAds(customer_id, ad_group_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_create_responsive_search_ad",
  {
    description: "Create a Responsive Search Ad with multiple headlines and descriptions. Ad is created PAUSED for review.",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      headlines: z.array(z.string()).min(3).max(15).describe("3-15 headlines (max 30 chars each)"),
      descriptions: z.array(z.string()).min(2).max(4).describe("2-4 descriptions (max 90 chars each)"),
      final_url: z.string().url().describe("Landing page URL"),
    },
  },
  async ({ customer_id, ad_group_id, headlines, descriptions, final_url }) => {
    try {
      const result = await googleAds.createResponsiveSearchAd(customer_id, ad_group_id, headlines, descriptions, final_url);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_pause_ad",
  {
    description: "Pause a Google Ads ad",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      ad_id: z.string().describe("Ad ID to pause"),
    },
  },
  async ({ customer_id, ad_group_id, ad_id }) => {
    try {
      const result = await googleAds.pauseAd(customer_id, ad_group_id, ad_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_enable_ad",
  {
    description: "Enable a paused Google Ads ad — it will start serving",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      ad_id: z.string().describe("Ad ID to enable"),
    },
  },
  async ({ customer_id, ad_group_id, ad_id }) => {
    try {
      const result = await googleAds.enableAd(customer_id, ad_group_id, ad_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_delete_ad",
  {
    description: "Permanently remove a Google Ads ad — IRREVERSIBLE",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      ad_id: z.string().describe("Ad ID to delete"),
    },
  },
  async ({ customer_id, ad_group_id, ad_id }) => {
    try {
      const result = await googleAds.deleteAd(customer_id, ad_group_id, ad_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Google Ads: Keywords ───────────────────────────────────────────────────

server.registerTool(
  "google_ads_list_keywords",
  {
    description: "List keywords in a Google Ads ad group with quality score and performance metrics",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
    },
  },
  async ({ customer_id, ad_group_id }) => {
    try {
      const result = await googleKeywords.listKeywords(customer_id, ad_group_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_add_keywords",
  {
    description: "Add keywords to a Google Ads ad group with specified match types",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      keywords: z.array(z.object({
        text: z.string().describe("Keyword text"),
        matchType: z.enum(["BROAD", "PHRASE", "EXACT"]).describe("Match type"),
      })).describe("Keywords to add"),
    },
  },
  async ({ customer_id, ad_group_id, keywords }) => {
    try {
      const result = await googleKeywords.addKeywords(customer_id, ad_group_id, keywords);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_add_negative_keywords",
  {
    description: "Add negative keywords to a Google Ads campaign to exclude irrelevant searches",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
      keywords: z.array(z.string()).describe("Negative keyword texts"),
    },
  },
  async ({ customer_id, campaign_id, keywords }) => {
    try {
      const result = await googleKeywords.addNegativeKeywords(customer_id, campaign_id, keywords);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_pause_keyword",
  {
    description: "Pause a keyword in a Google Ads ad group",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      criterion_id: z.string().describe("Keyword criterion ID"),
    },
  },
  async ({ customer_id, ad_group_id, criterion_id }) => {
    try {
      const result = await googleKeywords.pauseKeyword(customer_id, ad_group_id, criterion_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_remove_keyword",
  {
    description: "Permanently remove a keyword from a Google Ads ad group — IRREVERSIBLE",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      criterion_id: z.string().describe("Keyword criterion ID"),
    },
  },
  async ({ customer_id, ad_group_id, criterion_id }) => {
    try {
      const result = await googleKeywords.removeKeyword(customer_id, ad_group_id, criterion_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Google Ads: Metrics & Reporting ────────────────────────────────────────

server.registerTool(
  "google_ads_campaign_performance",
  {
    description: "Get performance summary across all Google Ads campaigns with spend, clicks, conversions, and ROAS",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      days: z.number().default(30).describe("Number of days to look back (default 30)"),
    },
  },
  async ({ customer_id, days }) => {
    try {
      const result = await googleMetrics.campaignPerformance(customer_id, days);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_time_series",
  {
    description: "Get daily performance time series for a Google Ads campaign",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
      days: z.number().default(30).describe("Number of days (default 30)"),
    },
  },
  async ({ customer_id, campaign_id, days }) => {
    try {
      const result = await googleCampaigns.getCampaignTimeSeries(customer_id, campaign_id, days);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_breakdowns",
  {
    description: "Get campaign breakdowns by device or network for a Google Ads campaign",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
      breakdown_type: z.enum(["device", "network"]).default("device").describe("Breakdown dimension"),
    },
  },
  async ({ customer_id, campaign_id, breakdown_type }) => {
    try {
      const result = await googleCampaigns.getCampaignBreakdowns(customer_id, campaign_id, breakdown_type);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_auction_insights",
  {
    description: "Get competitive auction insights showing how you compare against other advertisers",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
    },
  },
  async ({ customer_id, campaign_id }) => {
    try {
      const result = await googleMetrics.auctionInsights(customer_id, campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "google_ads_get_budget",
  {
    description: "Get budget details for a Google Ads campaign",
    inputSchema: {
      customer_id: z.string().describe("Google Ads customer/account ID"),
      campaign_id: z.string().describe("Campaign ID"),
    },
  },
  async ({ customer_id, campaign_id }) => {
    try {
      const result = await googleMetrics.getBudget(customer_id, campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Meta Ads: Accounts ─────────────────────────────────────────────────────

server.registerTool(
  "meta_ads_list_accounts",
  {
    description: "List all accessible Meta (Facebook) ad accounts",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await metaCampaigns.listAccounts();
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Meta Ads: Campaigns ────────────────────────────────────────────────────

server.registerTool(
  "meta_ads_list_campaigns",
  {
    description: "List all campaigns for a Meta ad account with performance metrics",
    inputSchema: {
      ad_account_id: z.string().describe("Meta ad account ID (with or without act_ prefix)"),
      status: z.string().optional().describe("Filter by status: ACTIVE, PAUSED"),
    },
  },
  async ({ ad_account_id, status }) => {
    try {
      const result = await metaCampaigns.listCampaigns(ad_account_id, status);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_get_campaign",
  {
    description: "Get detailed information and metrics for a specific Meta campaign",
    inputSchema: {
      campaign_id: z.string().describe("Meta campaign ID"),
    },
  },
  async ({ campaign_id }) => {
    try {
      const result = await metaCampaigns.getCampaign(campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_create_campaign",
  {
    description: "Create a new Meta Ads campaign. Created PAUSED for safety — no money spent until you activate it.",
    inputSchema: {
      ad_account_id: z.string().describe("Meta ad account ID"),
      name: z.string().describe("Campaign name"),
      objective: z.enum(["OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_AWARENESS"]).describe("Campaign objective"),
      daily_budget: z.number().optional().describe("Daily budget in dollars"),
      lifetime_budget: z.number().optional().describe("Lifetime budget in dollars (alternative to daily)"),
    },
  },
  async ({ ad_account_id, name, objective, daily_budget, lifetime_budget }) => {
    try {
      const result = await metaCampaigns.createCampaign(ad_account_id, name, objective, daily_budget, lifetime_budget);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_update_campaign",
  {
    description: "Update a Meta campaign's name, budget, or status",
    inputSchema: {
      campaign_id: z.string().describe("Meta campaign ID"),
      name: z.string().optional().describe("New campaign name"),
      daily_budget: z.number().optional().describe("New daily budget in dollars"),
      status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status"),
    },
  },
  async ({ campaign_id, name, daily_budget, status }) => {
    try {
      const result = await metaCampaigns.updateCampaign(campaign_id, { name, dailyBudget: daily_budget, status });
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_pause_campaign",
  {
    description: "Pause a Meta campaign — stops ad delivery immediately",
    inputSchema: {
      campaign_id: z.string().describe("Meta campaign ID to pause"),
    },
  },
  async ({ campaign_id }) => {
    try {
      const result = await metaCampaigns.pauseCampaign(campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_resume_campaign",
  {
    description: "Activate a paused Meta campaign — this will start spending your budget",
    inputSchema: {
      campaign_id: z.string().describe("Meta campaign ID to activate"),
    },
  },
  async ({ campaign_id }) => {
    try {
      const result = await metaCampaigns.resumeCampaign(campaign_id);
      return { content: [{ type: "text", text: `${safetyNotice("resume")}\n\n${result}` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_delete_campaign",
  {
    description: "Permanently delete a Meta campaign — IRREVERSIBLE",
    inputSchema: {
      campaign_id: z.string().describe("Meta campaign ID to delete"),
    },
  },
  async ({ campaign_id }) => {
    try {
      const result = await metaCampaigns.deleteCampaign(campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Meta Ads: Ad Sets ──────────────────────────────────────────────────────

server.registerTool(
  "meta_ads_list_ad_sets",
  {
    description: "List all ad sets for a Meta campaign with targeting and metrics",
    inputSchema: {
      campaign_id: z.string().describe("Meta campaign ID"),
    },
  },
  async ({ campaign_id }) => {
    try {
      const result = await metaAdSets.listAdSets(campaign_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_create_ad_set",
  {
    description: "Create a new ad set in a Meta campaign with targeting options",
    inputSchema: {
      ad_account_id: z.string().describe("Meta ad account ID"),
      campaign_id: z.string().describe("Campaign ID"),
      name: z.string().describe("Ad set name"),
      daily_budget: z.number().describe("Daily budget in dollars"),
      optimization_goal: z.enum(["LINK_CLICKS", "IMPRESSIONS", "REACH", "LEAD_GENERATION", "OFFSITE_CONVERSIONS"]).default("LINK_CLICKS").describe("Optimization goal"),
      age_min: z.number().default(18).describe("Minimum age"),
      age_max: z.number().default(65).describe("Maximum age"),
      countries: z.array(z.string()).default(["US"]).describe("Target country codes"),
      genders: z.array(z.number()).optional().describe("Genders: 1=Male, 2=Female"),
    },
  },
  async ({ ad_account_id, campaign_id, name, daily_budget, optimization_goal, age_min, age_max, countries, genders }) => {
    try {
      const result = await metaAdSets.createAdSet(ad_account_id, campaign_id, name, daily_budget, optimization_goal, {
        ageMin: age_min, ageMax: age_max, countries, genders,
      });
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_update_ad_set",
  {
    description: "Update a Meta ad set's name, budget, or status",
    inputSchema: {
      ad_set_id: z.string().describe("Meta ad set ID"),
      name: z.string().optional().describe("New name"),
      daily_budget: z.number().optional().describe("New daily budget in dollars"),
      status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status"),
    },
  },
  async ({ ad_set_id, name, daily_budget, status }) => {
    try {
      const result = await metaAdSets.updateAdSet(ad_set_id, { name, dailyBudget: daily_budget, status });
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_pause_ad_set",
  {
    description: "Pause a Meta ad set",
    inputSchema: {
      ad_set_id: z.string().describe("Meta ad set ID to pause"),
    },
  },
  async ({ ad_set_id }) => {
    try {
      const result = await metaAdSets.pauseAdSet(ad_set_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_delete_ad_set",
  {
    description: "Permanently delete a Meta ad set — IRREVERSIBLE",
    inputSchema: {
      ad_set_id: z.string().describe("Meta ad set ID to delete"),
    },
  },
  async ({ ad_set_id }) => {
    try {
      const result = await metaAdSets.deleteAdSet(ad_set_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Meta Ads: Ads ──────────────────────────────────────────────────────────

server.registerTool(
  "meta_ads_list_ads",
  {
    description: "List all ads in a Meta ad set with creative details and metrics",
    inputSchema: {
      ad_set_id: z.string().describe("Meta ad set ID"),
    },
  },
  async ({ ad_set_id }) => {
    try {
      const result = await metaAds.listAds(ad_set_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_create_ad",
  {
    description: "Create a new Meta ad with creative (image, copy, link). Ad is created PAUSED for review.",
    inputSchema: {
      ad_account_id: z.string().describe("Meta ad account ID"),
      ad_set_id: z.string().describe("Ad set ID"),
      name: z.string().describe("Ad name"),
      page_id: z.string().describe("Facebook page ID"),
      title: z.string().describe("Ad headline/title"),
      body: z.string().describe("Ad body text"),
      link_url: z.string().url().describe("Destination URL"),
      image_url: z.string().optional().describe("Image URL for the ad creative"),
      call_to_action: z.enum(["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "GET_OFFER", "APPLY_NOW"]).default("LEARN_MORE").describe("Call to action button"),
    },
  },
  async ({ ad_account_id, ad_set_id, name, page_id, title, body, link_url, image_url, call_to_action }) => {
    try {
      const result = await metaAds.createAd(ad_account_id, ad_set_id, name, page_id, {
        title, body, linkUrl: link_url, imageUrl: image_url, callToAction: call_to_action,
      });
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_pause_ad",
  {
    description: "Pause a Meta ad",
    inputSchema: {
      ad_id: z.string().describe("Meta ad ID to pause"),
    },
  },
  async ({ ad_id }) => {
    try {
      const result = await metaAds.pauseAd(ad_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_enable_ad",
  {
    description: "Activate a paused Meta ad — it will start serving",
    inputSchema: {
      ad_id: z.string().describe("Meta ad ID to activate"),
    },
  },
  async ({ ad_id }) => {
    try {
      const result = await metaAds.enableAd(ad_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_delete_ad",
  {
    description: "Permanently delete a Meta ad — IRREVERSIBLE",
    inputSchema: {
      ad_id: z.string().describe("Meta ad ID to delete"),
    },
  },
  async ({ ad_id }) => {
    try {
      const result = await metaAds.deleteAd(ad_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Meta Ads: Targeting ────────────────────────────────────────────────────

server.registerTool(
  "meta_ads_search_interests",
  {
    description: "Search Meta's targeting interests and behaviors for audience building",
    inputSchema: {
      query: z.string().describe("Search term (e.g., 'fitness', 'cooking', 'real estate')"),
    },
  },
  async ({ query }) => {
    try {
      const result = await metaTargeting.searchInterests(query);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_list_audiences",
  {
    description: "List custom audiences for a Meta ad account",
    inputSchema: {
      ad_account_id: z.string().describe("Meta ad account ID"),
    },
  },
  async ({ ad_account_id }) => {
    try {
      const result = await metaTargeting.listAudiences(ad_account_id);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_list_pages",
  {
    description: "List Facebook pages you manage (needed for creating ads)",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await metaTargeting.listPages();
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_update_targeting",
  {
    description: "Update targeting settings on a Meta ad set (age, gender, countries, interests)",
    inputSchema: {
      ad_set_id: z.string().describe("Meta ad set ID"),
      age_min: z.number().optional().describe("Minimum age"),
      age_max: z.number().optional().describe("Maximum age"),
      genders: z.array(z.number()).optional().describe("Genders: 1=Male, 2=Female"),
      countries: z.array(z.string()).optional().describe("Target country codes"),
      interests: z.array(z.object({
        id: z.string(),
        name: z.string(),
      })).optional().describe("Interest targeting"),
    },
  },
  async ({ ad_set_id, age_min, age_max, genders, countries, interests }) => {
    try {
      const result = await metaTargeting.updateTargeting(ad_set_id, {
        ageMin: age_min, ageMax: age_max, genders, countries, interests,
      });
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Meta Ads: Metrics & Reporting ──────────────────────────────────────────

server.registerTool(
  "meta_ads_campaign_performance",
  {
    description: "Get performance summary across all Meta campaigns with spend, clicks, and conversions",
    inputSchema: {
      ad_account_id: z.string().describe("Meta ad account ID"),
      days: z.number().default(30).describe("Number of days to look back (default 30)"),
    },
  },
  async ({ ad_account_id, days }) => {
    try {
      const result = await metaMetrics.campaignPerformance(ad_account_id, days);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_time_series",
  {
    description: "Get daily performance time series for a Meta campaign",
    inputSchema: {
      campaign_id: z.string().describe("Meta campaign ID"),
      days: z.number().default(30).describe("Number of days (default 30)"),
    },
  },
  async ({ campaign_id, days }) => {
    try {
      const result = await metaMetrics.campaignTimeSeries(campaign_id, days);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "meta_ads_breakdowns",
  {
    description: "Get campaign breakdowns by device, platform, placement, age, or gender",
    inputSchema: {
      campaign_id: z.string().describe("Meta campaign ID"),
      breakdown_type: z.enum(["device_platform", "publisher_platform", "platform_position", "age", "gender"]).default("device_platform").describe("Breakdown dimension"),
    },
  },
  async ({ campaign_id, breakdown_type }) => {
    try {
      const result = await metaMetrics.campaignBreakdowns(campaign_id, breakdown_type);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Cross-Platform Tools ───────────────────────────────────────────────────

server.registerTool(
  "list_connected_platforms",
  {
    description: "Check which ad platforms are configured and ready to use",
    inputSchema: {},
  },
  async () => {
    const google = isGoogleAdsConfigured();
    const meta = isMetaAdsConfigured();

    const lines = [
      `## Connected Platforms`,
      ``,
      `| Platform | Status |`,
      `|---|---|`,
      `| Google Ads | ${google ? "Connected" : "Not configured"} |`,
      `| Meta Ads | ${meta ? "Connected" : "Not configured"} |`,
    ];

    if (!google && !meta) {
      lines.push(
        ``,
        `### Setup Instructions`,
        `Set the following environment variables:`,
        ``,
        `**Google Ads:** GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_REFRESH_TOKEN`,
        ``,
        `**Meta Ads:** META_ADS_APP_ID, META_ADS_APP_SECRET, META_ADS_ACCESS_TOKEN`,
      );
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ─── Start Server ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Adrex AI MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
