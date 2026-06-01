#!/usr/bin/env node

// Load a local .env file when present (self-hosted / dev). No-op in hosted mode
// or when running via an MCP client that injects env vars directly.
try {
  process.loadEnvFile();
} catch {
  // No .env file — credentials come from the process environment.
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setGlobalDispatcher, EnvHttpProxyAgent } from "undici";
import { z } from "zod";

// Node's built-in fetch (undici) ignores HTTP(S)_PROXY env vars by default.
// In proxied/corporate networks that makes every outbound call fail. Route
// fetch through the proxy when one is configured.
if (
  process.env.HTTPS_PROXY || process.env.HTTP_PROXY ||
  process.env.https_proxy || process.env.http_proxy
) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}

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
import { isHostedMode, getProxyConfig, proxyToolCall } from "./utils/proxy.js";

const HOSTED = isHostedMode();
const proxyConfig = getProxyConfig();

function makeHandler(
  toolName: string,
  directHandler: (params: any) => Promise<string>
) {
  return async (params: any) => {
    try {
      let result: string;
      if (HOSTED && proxyConfig) {
        result = await proxyToolCall(proxyConfig, toolName, params);
      } else {
        result = await directHandler(params);
      }
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  };
}

const server = new McpServer({
  name: "adrex-ai",
  version: "1.0.4",
});

// ─── Google Ads: Accounts ───────────────────────────────────────────────────

server.registerTool(
  "google_ads_list_accounts",
  {
    description: "List all accessible Google Ads accounts",
    inputSchema: {},
  },
  makeHandler("google_ads_list_accounts", async () => googleCampaigns.listAccounts())
);

// ─── Google Ads: Campaigns ──────────────────────────────────────────────────

server.registerTool("google_ads_list_campaigns", {
  description: "List all campaigns for a Google Ads account with performance metrics",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), status: z.string().optional().describe("Filter by status: ENABLED, PAUSED") },
}, makeHandler("google_ads_list_campaigns", async ({ customer_id, status }) => googleCampaigns.listCampaigns(customer_id, status)));

server.registerTool("google_ads_get_campaign", {
  description: "Get detailed information and metrics for a specific Google Ads campaign",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID") },
}, makeHandler("google_ads_get_campaign", async ({ customer_id, campaign_id }) => googleCampaigns.getCampaign(customer_id, campaign_id)));

server.registerTool("google_ads_create_search_campaign", {
  description: "Create a new Google Ads Search campaign. Campaign is created PAUSED for safety — no money will be spent until you resume it.",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), name: z.string().describe("Campaign name"), daily_budget: z.number().describe("Daily budget in dollars"), bidding_strategy: z.enum(["MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS", "MANUAL_CPC"]).default("MAXIMIZE_CLICKS").describe("Bidding strategy"), target_countries: z.array(z.string()).default(["US"]).describe("Target country codes") },
}, makeHandler("google_ads_create_search_campaign", async ({ customer_id, name, daily_budget, bidding_strategy, target_countries }) => googleCampaigns.createSearchCampaign(customer_id, name, daily_budget, bidding_strategy, target_countries)));

server.registerTool("google_ads_update_campaign", {
  description: "Update a Google Ads campaign's name, budget, or bidding strategy",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID"), name: z.string().optional().describe("New campaign name"), daily_budget: z.number().optional().describe("New daily budget in dollars"), bidding_strategy: z.string().optional().describe("New bidding strategy") },
}, makeHandler("google_ads_update_campaign", async ({ customer_id, campaign_id, name, daily_budget, bidding_strategy }) => googleCampaigns.updateCampaign(customer_id, campaign_id, { name, dailyBudget: daily_budget, biddingStrategy: bidding_strategy })));

server.registerTool("google_ads_pause_campaign", {
  description: "Pause a Google Ads campaign — stops ad delivery immediately",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID to pause") },
}, makeHandler("google_ads_pause_campaign", async ({ customer_id, campaign_id }) => googleCampaigns.pauseCampaign(customer_id, campaign_id)));

server.registerTool("google_ads_resume_campaign", {
  description: "Resume a paused Google Ads campaign — this will start spending your budget",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID to resume") },
}, makeHandler("google_ads_resume_campaign", async ({ customer_id, campaign_id }) => { const r = await googleCampaigns.resumeCampaign(customer_id, campaign_id); return `${safetyNotice("resume")}\n\n${r}`; }));

server.registerTool("google_ads_delete_campaign", {
  description: "Permanently remove a Google Ads campaign — this action is IRREVERSIBLE",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID to delete") },
}, makeHandler("google_ads_delete_campaign", async ({ customer_id, campaign_id }) => `${safetyNotice("delete")}\n\n${await googleCampaigns.deleteCampaign(customer_id, campaign_id)}`));

// ─── Google Ads: Ad Groups ──────────────────────────────────────────────────

server.registerTool("google_ads_list_ad_groups", {
  description: "List all ad groups for a Google Ads campaign with performance metrics",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID") },
}, makeHandler("google_ads_list_ad_groups", async ({ customer_id, campaign_id }) => googleAdGroups.listAdGroups(customer_id, campaign_id)));

server.registerTool("google_ads_create_ad_group", {
  description: "Create a new ad group within a Google Ads campaign",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID"), name: z.string().describe("Ad group name"), cpc_bid: z.number().default(1.0).describe("Max CPC bid in dollars") },
}, makeHandler("google_ads_create_ad_group", async ({ customer_id, campaign_id, name, cpc_bid }) => googleAdGroups.createAdGroup(customer_id, campaign_id, name, cpc_bid)));

server.registerTool("google_ads_update_ad_group", {
  description: "Update a Google Ads ad group's name, bid, or status",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID"), name: z.string().optional().describe("New name"), cpc_bid: z.number().optional().describe("New CPC bid in dollars"), status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New status") },
}, makeHandler("google_ads_update_ad_group", async ({ customer_id, ad_group_id, name, cpc_bid, status }) => googleAdGroups.updateAdGroup(customer_id, ad_group_id, { name, cpcBid: cpc_bid, status })));

server.registerTool("google_ads_pause_ad_group", {
  description: "Pause a Google Ads ad group",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID to pause") },
}, makeHandler("google_ads_pause_ad_group", async ({ customer_id, ad_group_id }) => googleAdGroups.pauseAdGroup(customer_id, ad_group_id)));

server.registerTool("google_ads_delete_ad_group", {
  description: "Permanently remove a Google Ads ad group — IRREVERSIBLE",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID to delete") },
}, makeHandler("google_ads_delete_ad_group", async ({ customer_id, ad_group_id }) => `${safetyNotice("delete")}\n\n${await googleAdGroups.deleteAdGroup(customer_id, ad_group_id)}`));

// ─── Google Ads: Ads ────────────────────────────────────────────────────────

server.registerTool("google_ads_list_ads", {
  description: "List all ads in a Google Ads ad group with performance metrics",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID") },
}, makeHandler("google_ads_list_ads", async ({ customer_id, ad_group_id }) => googleAds.listAds(customer_id, ad_group_id)));

server.registerTool("google_ads_create_responsive_search_ad", {
  description: "Create a Responsive Search Ad with multiple headlines and descriptions. Ad is created PAUSED for review.",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID"), headlines: z.array(z.string()).min(3).max(15).describe("3-15 headlines (max 30 chars each)"), descriptions: z.array(z.string()).min(2).max(4).describe("2-4 descriptions (max 90 chars each)"), final_url: z.string().url().describe("Landing page URL") },
}, makeHandler("google_ads_create_responsive_search_ad", async ({ customer_id, ad_group_id, headlines, descriptions, final_url }) => googleAds.createResponsiveSearchAd(customer_id, ad_group_id, headlines, descriptions, final_url)));

server.registerTool("google_ads_pause_ad", {
  description: "Pause a Google Ads ad",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID"), ad_id: z.string().describe("Ad ID to pause") },
}, makeHandler("google_ads_pause_ad", async ({ customer_id, ad_group_id, ad_id }) => googleAds.pauseAd(customer_id, ad_group_id, ad_id)));

server.registerTool("google_ads_enable_ad", {
  description: "Enable a paused Google Ads ad — it will start serving",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID"), ad_id: z.string().describe("Ad ID to enable") },
}, makeHandler("google_ads_enable_ad", async ({ customer_id, ad_group_id, ad_id }) => googleAds.enableAd(customer_id, ad_group_id, ad_id)));

server.registerTool("google_ads_delete_ad", {
  description: "Permanently remove a Google Ads ad — IRREVERSIBLE",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID"), ad_id: z.string().describe("Ad ID to delete") },
}, makeHandler("google_ads_delete_ad", async ({ customer_id, ad_group_id, ad_id }) => `${safetyNotice("delete")}\n\n${await googleAds.deleteAd(customer_id, ad_group_id, ad_id)}`));

// ─── Google Ads: Keywords ───────────────────────────────────────────────────

server.registerTool("google_ads_list_keywords", {
  description: "List keywords in a Google Ads ad group with quality score and performance metrics",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID") },
}, makeHandler("google_ads_list_keywords", async ({ customer_id, ad_group_id }) => googleKeywords.listKeywords(customer_id, ad_group_id)));

server.registerTool("google_ads_add_keywords", {
  description: "Add keywords to a Google Ads ad group with specified match types",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID"), keywords: z.array(z.object({ text: z.string().describe("Keyword text"), matchType: z.enum(["BROAD", "PHRASE", "EXACT"]).describe("Match type") })).describe("Keywords to add") },
}, makeHandler("google_ads_add_keywords", async ({ customer_id, ad_group_id, keywords }) => googleKeywords.addKeywords(customer_id, ad_group_id, keywords)));

server.registerTool("google_ads_add_negative_keywords", {
  description: "Add negative keywords to a Google Ads campaign to exclude irrelevant searches",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID"), keywords: z.array(z.string()).describe("Negative keyword texts") },
}, makeHandler("google_ads_add_negative_keywords", async ({ customer_id, campaign_id, keywords }) => googleKeywords.addNegativeKeywords(customer_id, campaign_id, keywords)));

server.registerTool("google_ads_pause_keyword", {
  description: "Pause a keyword in a Google Ads ad group",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID"), criterion_id: z.string().describe("Keyword criterion ID") },
}, makeHandler("google_ads_pause_keyword", async ({ customer_id, ad_group_id, criterion_id }) => googleKeywords.pauseKeyword(customer_id, ad_group_id, criterion_id)));

server.registerTool("google_ads_remove_keyword", {
  description: "Permanently remove a keyword from a Google Ads ad group — IRREVERSIBLE",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), ad_group_id: z.string().describe("Ad group ID"), criterion_id: z.string().describe("Keyword criterion ID") },
}, makeHandler("google_ads_remove_keyword", async ({ customer_id, ad_group_id, criterion_id }) => `${safetyNotice("delete")}\n\n${await googleKeywords.removeKeyword(customer_id, ad_group_id, criterion_id)}`));

// ─── Google Ads: Metrics & Reporting ────────────────────────────────────────

server.registerTool("google_ads_campaign_performance", {
  description: "Get performance summary across all Google Ads campaigns with spend, clicks, conversions, and ROAS",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), days: z.number().default(30).describe("Number of days to look back (default 30)") },
}, makeHandler("google_ads_campaign_performance", async ({ customer_id, days }) => googleMetrics.campaignPerformance(customer_id, days)));

server.registerTool("google_ads_time_series", {
  description: "Get daily performance time series for a Google Ads campaign",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID"), days: z.number().default(30).describe("Number of days (default 30)") },
}, makeHandler("google_ads_time_series", async ({ customer_id, campaign_id, days }) => googleCampaigns.getCampaignTimeSeries(customer_id, campaign_id, days)));

server.registerTool("google_ads_breakdowns", {
  description: "Get campaign breakdowns by device or network for a Google Ads campaign",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID"), breakdown_type: z.enum(["device", "network"]).default("device").describe("Breakdown dimension") },
}, makeHandler("google_ads_breakdowns", async ({ customer_id, campaign_id, breakdown_type }) => googleCampaigns.getCampaignBreakdowns(customer_id, campaign_id, breakdown_type)));

server.registerTool("google_ads_auction_insights", {
  description: "Get competitive auction insights showing how you compare against other advertisers",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID") },
}, makeHandler("google_ads_auction_insights", async ({ customer_id, campaign_id }) => googleMetrics.auctionInsights(customer_id, campaign_id)));

server.registerTool("google_ads_get_budget", {
  description: "Get budget details for a Google Ads campaign",
  inputSchema: { customer_id: z.string().describe("Google Ads customer/account ID"), campaign_id: z.string().describe("Campaign ID") },
}, makeHandler("google_ads_get_budget", async ({ customer_id, campaign_id }) => googleMetrics.getBudget(customer_id, campaign_id)));

// ─── Meta Ads: Accounts ─────────────────────────────────────────────────────

server.registerTool("meta_ads_list_accounts", {
  description: "List all accessible Meta (Facebook) ad accounts",
  inputSchema: {},
}, makeHandler("meta_ads_list_accounts", async () => metaCampaigns.listAccounts()));

// ─── Meta Ads: Campaigns ────────────────────────────────────────────────────

server.registerTool("meta_ads_list_campaigns", {
  description: "List all campaigns for a Meta ad account with performance metrics",
  inputSchema: { ad_account_id: z.string().describe("Meta ad account ID (with or without act_ prefix)"), status: z.string().optional().describe("Filter by status: ACTIVE, PAUSED") },
}, makeHandler("meta_ads_list_campaigns", async ({ ad_account_id, status }) => metaCampaigns.listCampaigns(ad_account_id, status)));

server.registerTool("meta_ads_get_campaign", {
  description: "Get detailed information and metrics for a specific Meta campaign",
  inputSchema: { campaign_id: z.string().describe("Meta campaign ID") },
}, makeHandler("meta_ads_get_campaign", async ({ campaign_id }) => metaCampaigns.getCampaign(campaign_id)));

server.registerTool("meta_ads_create_campaign", {
  description: "Create a new Meta Ads campaign. Created PAUSED for safety — no money spent until you activate it.",
  inputSchema: { ad_account_id: z.string().describe("Meta ad account ID"), name: z.string().describe("Campaign name"), objective: z.enum(["OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_AWARENESS"]).describe("Campaign objective"), daily_budget: z.number().optional().describe("Daily budget in dollars"), lifetime_budget: z.number().optional().describe("Lifetime budget in dollars (alternative to daily)") },
}, makeHandler("meta_ads_create_campaign", async ({ ad_account_id, name, objective, daily_budget, lifetime_budget }) => metaCampaigns.createCampaign(ad_account_id, name, objective, daily_budget, lifetime_budget)));

server.registerTool("meta_ads_update_campaign", {
  description: "Update a Meta campaign's name, budget, or status",
  inputSchema: { campaign_id: z.string().describe("Meta campaign ID"), name: z.string().optional().describe("New campaign name"), daily_budget: z.number().optional().describe("New daily budget in dollars"), status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status") },
}, makeHandler("meta_ads_update_campaign", async ({ campaign_id, name, daily_budget, status }) => metaCampaigns.updateCampaign(campaign_id, { name, dailyBudget: daily_budget, status })));

server.registerTool("meta_ads_pause_campaign", {
  description: "Pause a Meta campaign — stops ad delivery immediately",
  inputSchema: { campaign_id: z.string().describe("Meta campaign ID to pause") },
}, makeHandler("meta_ads_pause_campaign", async ({ campaign_id }) => metaCampaigns.pauseCampaign(campaign_id)));

server.registerTool("meta_ads_resume_campaign", {
  description: "Activate a paused Meta campaign — this will start spending your budget",
  inputSchema: { campaign_id: z.string().describe("Meta campaign ID to activate") },
}, makeHandler("meta_ads_resume_campaign", async ({ campaign_id }) => { const r = await metaCampaigns.resumeCampaign(campaign_id); return `${safetyNotice("resume")}\n\n${r}`; }));

server.registerTool("meta_ads_delete_campaign", {
  description: "Permanently delete a Meta campaign — IRREVERSIBLE",
  inputSchema: { campaign_id: z.string().describe("Meta campaign ID to delete") },
}, makeHandler("meta_ads_delete_campaign", async ({ campaign_id }) => `${safetyNotice("delete")}\n\n${await metaCampaigns.deleteCampaign(campaign_id)}`));

// ─── Meta Ads: Ad Sets ──────────────────────────────────────────────────────

server.registerTool("meta_ads_list_ad_sets", {
  description: "List all ad sets for a Meta campaign with targeting and metrics",
  inputSchema: { campaign_id: z.string().describe("Meta campaign ID") },
}, makeHandler("meta_ads_list_ad_sets", async ({ campaign_id }) => metaAdSets.listAdSets(campaign_id)));

server.registerTool("meta_ads_create_ad_set", {
  description: "Create a new ad set in a Meta campaign with targeting options",
  inputSchema: { ad_account_id: z.string().describe("Meta ad account ID"), campaign_id: z.string().describe("Campaign ID"), name: z.string().describe("Ad set name"), daily_budget: z.number().describe("Daily budget in dollars"), optimization_goal: z.enum(["LINK_CLICKS", "IMPRESSIONS", "REACH", "LEAD_GENERATION", "OFFSITE_CONVERSIONS"]).default("LINK_CLICKS").describe("Optimization goal"), age_min: z.number().default(18).describe("Minimum age"), age_max: z.number().default(65).describe("Maximum age"), countries: z.array(z.string()).default(["US"]).describe("Target country codes"), genders: z.array(z.number()).optional().describe("Genders: 1=Male, 2=Female") },
}, makeHandler("meta_ads_create_ad_set", async ({ ad_account_id, campaign_id, name, daily_budget, optimization_goal, age_min, age_max, countries, genders }) => metaAdSets.createAdSet(ad_account_id, campaign_id, name, daily_budget, optimization_goal, { ageMin: age_min, ageMax: age_max, countries, genders })));

server.registerTool("meta_ads_update_ad_set", {
  description: "Update a Meta ad set's name, budget, or status",
  inputSchema: { ad_set_id: z.string().describe("Meta ad set ID"), name: z.string().optional().describe("New name"), daily_budget: z.number().optional().describe("New daily budget in dollars"), status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status") },
}, makeHandler("meta_ads_update_ad_set", async ({ ad_set_id, name, daily_budget, status }) => metaAdSets.updateAdSet(ad_set_id, { name, dailyBudget: daily_budget, status })));

server.registerTool("meta_ads_pause_ad_set", {
  description: "Pause a Meta ad set",
  inputSchema: { ad_set_id: z.string().describe("Meta ad set ID to pause") },
}, makeHandler("meta_ads_pause_ad_set", async ({ ad_set_id }) => metaAdSets.pauseAdSet(ad_set_id)));

server.registerTool("meta_ads_delete_ad_set", {
  description: "Permanently delete a Meta ad set — IRREVERSIBLE",
  inputSchema: { ad_set_id: z.string().describe("Meta ad set ID to delete") },
}, makeHandler("meta_ads_delete_ad_set", async ({ ad_set_id }) => `${safetyNotice("delete")}\n\n${await metaAdSets.deleteAdSet(ad_set_id)}`));

// ─── Meta Ads: Ads ──────────────────────────────────────────────────────────

server.registerTool("meta_ads_list_ads", {
  description: "List all ads in a Meta ad set with creative details and metrics",
  inputSchema: { ad_set_id: z.string().describe("Meta ad set ID") },
}, makeHandler("meta_ads_list_ads", async ({ ad_set_id }) => metaAds.listAds(ad_set_id)));

server.registerTool("meta_ads_create_ad", {
  description: "Create a new Meta ad with creative (image, copy, link). Ad is created PAUSED for review.",
  inputSchema: { ad_account_id: z.string().describe("Meta ad account ID"), ad_set_id: z.string().describe("Ad set ID"), name: z.string().describe("Ad name"), page_id: z.string().describe("Facebook page ID"), title: z.string().describe("Ad headline/title"), body: z.string().describe("Ad body text"), link_url: z.string().url().describe("Destination URL"), image_url: z.string().optional().describe("Image URL for the ad creative"), call_to_action: z.enum(["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "GET_OFFER", "APPLY_NOW"]).default("LEARN_MORE").describe("Call to action button") },
}, makeHandler("meta_ads_create_ad", async ({ ad_account_id, ad_set_id, name, page_id, title, body, link_url, image_url, call_to_action }) => metaAds.createAd(ad_account_id, ad_set_id, name, page_id, { title, body, linkUrl: link_url, imageUrl: image_url, callToAction: call_to_action })));

server.registerTool("meta_ads_pause_ad", {
  description: "Pause a Meta ad",
  inputSchema: { ad_id: z.string().describe("Meta ad ID to pause") },
}, makeHandler("meta_ads_pause_ad", async ({ ad_id }) => metaAds.pauseAd(ad_id)));

server.registerTool("meta_ads_enable_ad", {
  description: "Activate a paused Meta ad — it will start serving",
  inputSchema: { ad_id: z.string().describe("Meta ad ID to activate") },
}, makeHandler("meta_ads_enable_ad", async ({ ad_id }) => metaAds.enableAd(ad_id)));

server.registerTool("meta_ads_delete_ad", {
  description: "Permanently delete a Meta ad — IRREVERSIBLE",
  inputSchema: { ad_id: z.string().describe("Meta ad ID to delete") },
}, makeHandler("meta_ads_delete_ad", async ({ ad_id }) => `${safetyNotice("delete")}\n\n${await metaAds.deleteAd(ad_id)}`));

// ─── Meta Ads: Targeting ────────────────────────────────────────────────────

server.registerTool("meta_ads_search_interests", {
  description: "Search Meta's targeting interests and behaviors for audience building",
  inputSchema: { query: z.string().describe("Search term (e.g., 'fitness', 'cooking', 'real estate')") },
}, makeHandler("meta_ads_search_interests", async ({ query }) => metaTargeting.searchInterests(query)));

server.registerTool("meta_ads_list_audiences", {
  description: "List custom audiences for a Meta ad account",
  inputSchema: { ad_account_id: z.string().describe("Meta ad account ID") },
}, makeHandler("meta_ads_list_audiences", async ({ ad_account_id }) => metaTargeting.listAudiences(ad_account_id)));

server.registerTool("meta_ads_list_pages", {
  description: "List Facebook pages you manage (needed for creating ads)",
  inputSchema: {},
}, makeHandler("meta_ads_list_pages", async () => metaTargeting.listPages()));

server.registerTool("meta_ads_update_targeting", {
  description: "Update targeting settings on a Meta ad set (age, gender, countries, interests)",
  inputSchema: { ad_set_id: z.string().describe("Meta ad set ID"), age_min: z.number().optional().describe("Minimum age"), age_max: z.number().optional().describe("Maximum age"), genders: z.array(z.number()).optional().describe("Genders: 1=Male, 2=Female"), countries: z.array(z.string()).optional().describe("Target country codes"), interests: z.array(z.object({ id: z.string(), name: z.string() })).optional().describe("Interest targeting") },
}, makeHandler("meta_ads_update_targeting", async ({ ad_set_id, age_min, age_max, genders, countries, interests }) => metaTargeting.updateTargeting(ad_set_id, { ageMin: age_min, ageMax: age_max, genders, countries, interests })));

// ─── Meta Ads: Metrics & Reporting ──────────────────────────────────────────

server.registerTool("meta_ads_campaign_performance", {
  description: "Get performance summary across all Meta campaigns with spend, clicks, and conversions",
  inputSchema: { ad_account_id: z.string().describe("Meta ad account ID"), days: z.number().default(30).describe("Number of days to look back (default 30)") },
}, makeHandler("meta_ads_campaign_performance", async ({ ad_account_id, days }) => metaMetrics.campaignPerformance(ad_account_id, days)));

server.registerTool("meta_ads_time_series", {
  description: "Get daily performance time series for a Meta campaign",
  inputSchema: { campaign_id: z.string().describe("Meta campaign ID"), days: z.number().default(30).describe("Number of days (default 30)") },
}, makeHandler("meta_ads_time_series", async ({ campaign_id, days }) => metaMetrics.campaignTimeSeries(campaign_id, days)));

server.registerTool("meta_ads_breakdowns", {
  description: "Get campaign breakdowns by device, platform, placement, age, or gender",
  inputSchema: { campaign_id: z.string().describe("Meta campaign ID"), breakdown_type: z.enum(["device_platform", "publisher_platform", "platform_position", "age", "gender"]).default("device_platform").describe("Breakdown dimension") },
}, makeHandler("meta_ads_breakdowns", async ({ campaign_id, breakdown_type }) => metaMetrics.campaignBreakdowns(campaign_id, breakdown_type)));

// ─── Cross-Platform Tools ───────────────────────────────────────────────────

server.registerTool(
  "list_connected_platforms",
  {
    description: "Check which ad platforms are configured and ready to use",
    inputSchema: {},
  },
  async () => {
    if (HOSTED && proxyConfig) {
      try {
        const status = await (await import("./utils/proxy.js")).getProxyStatus(proxyConfig);
        const g = status.google_ads?.connected ? "Connected" : "Not connected";
        const m = status.meta_ads?.connected ? "Connected" : "Not connected";
        const usage = status.usage;

        const lines = [
          `## Connected Platforms (Hosted Mode)`,
          ``,
          `| Platform | Status |`,
          `|---|---|`,
          `| Google Ads | ${g} |`,
          `| Meta Ads | ${m} |`,
          ``,
          `**Usage today:** ${usage?.calls_today || 0} / ${usage?.limit || "?"} calls`,
        ];

        if (!status.google_ads?.connected && !status.meta_ads?.connected) {
          lines.push(``, `Connect your ad accounts at https://adrex.ai/settings`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error connecting to Adrex: ${err.message}` }], isError: true };
      }
    }

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
        `### Quick Setup (Recommended)`,
        `Sign up at https://adrex.ai and get an API key — no credential setup needed.`,
        ``,
        `### Manual Setup`,
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
  const mode = HOSTED ? "hosted (via adrex.ai)" : "direct (self-hosted)";
  console.error(`Adrex AI MCP server running on stdio [${mode}]`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
