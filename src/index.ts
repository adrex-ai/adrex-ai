#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getProxyConfig, proxyToolCall, getProxyStatus } from "./utils/proxy.js";

// Node's built-in fetch ignores HTTP(S)_PROXY env vars by default. In proxied/
// corporate networks that makes outbound calls fail. We route fetch through the
// proxy ONLY when one is configured — and load `undici` lazily so the package
// never imports it (and can't crash on older Node) when no proxy is in play.
async function configureProxy(): Promise<void> {
  const hasProxy =
    process.env.HTTPS_PROXY || process.env.HTTP_PROXY ||
    process.env.https_proxy || process.env.http_proxy;
  if (!hasProxy) return;
  try {
    const { setGlobalDispatcher, EnvHttpProxyAgent } = await import("undici");
    setGlobalDispatcher(new EnvHttpProxyAgent());
  } catch (err: any) {
    console.error(`Proxy setup skipped (${err?.message}). Set Node >= 18.17 if you are behind a proxy.`);
  }
}

const proxyConfig = getProxyConfig();

const NO_KEY_MESSAGE =
  "Adrex requires an API key. Set ADREX_API_KEY in your MCP config — get one at https://adrex.ai/settings";

/**
 * Every tool is a thin proxy: it forwards the (validated) params to the Adrex
 * backend, which holds your connected ad-account credentials and runs the call.
 */
function makeHandler(toolName: string) {
  return async (params: any) => {
    if (!proxyConfig) {
      return { content: [{ type: "text" as const, text: NO_KEY_MESSAGE }], isError: true };
    }
    try {
      const result = await proxyToolCall(proxyConfig, toolName, params ?? {});
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  };
}

// Sent to the client on initialize. The reader is a marketing manager running
// their own ad accounts, not an analyst — this sets what a useful answer looks
// like for them. Keep in sync with SERVER_INSTRUCTIONS in the backend's
// mcp_http.py, which serves the same tools over the remote transport.
const INSTRUCTIONS = `Adrex AI — the user's live Google Ads and Meta Ads accounts.

You are talking to the person responsible for these campaigns and their budget.
They want to know what to do next, not to read a metrics dump.

- Lead with the answer in one sentence, then the supporting numbers.
- Always state the date window; every tool takes a \`days\` parameter (default 30).
- Speak in money and outcomes — spend, cost per conversion, ROAS, wasted spend —
  rather than impressions and clicks, unless they asked about reach.
- Tool results include a "Worth a look" section of flagged facts. Use it: it is
  where budget caps, zero-conversion spend, and delivery problems surface.
- Under ~30 conversions the numbers are noisy. Say so instead of over-reading a
  CPA swing.
- Never invent benchmarks or industry averages. Compare campaigns to each other,
  to their own history, or to a target the user gave you.
- Writes (budgets, pausing, new campaigns) change a live account and spend real
  money. Confirm the specific change and the campaign it applies to before
  calling a write tool, and report exactly what the platform accepted.`;

const server = new McpServer(
  {
    name: "adrex-ai",
    version: "1.0.14",
  },
  { instructions: INSTRUCTIONS }
);

function tool(
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodTypeAny>
) {
  server.registerTool(name, { description, inputSchema }, makeHandler(name));
}

// ─── Google Ads: Accounts & Campaigns ────────────────────────────────────────

tool("google_ads_list_accounts", "List all accessible Google Ads accounts", {});

tool("google_ads_list_campaigns", "List all campaigns for a Google Ads account with spend, conversions, CPA and ROAS over a chosen window", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  status: z.string().optional().describe("Filter by status: ENABLED, PAUSED"),
  days: z.number().default(30).describe("Metrics lookback window in days (default 30)"),
});

tool("google_ads_get_campaign", "Get detailed metrics for one Google Ads campaign over a chosen window", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
  days: z.number().default(30).describe("Metrics lookback window in days (default 30)"),
});

tool("google_ads_create_search_campaign", "Create a new Google Ads Search campaign. Campaign is created PAUSED for safety — no money will be spent until you resume it.", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  name: z.string().describe("Campaign name"),
  daily_budget: z.number().describe("Daily budget in dollars"),
  bidding_strategy: z.enum(["MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS", "MANUAL_CPC"]).default("MAXIMIZE_CLICKS").describe("Bidding strategy"),
  target_countries: z.array(z.string()).default(["US"]).describe("Target country codes"),
});

tool("google_ads_update_campaign", "Update a Google Ads campaign's name, budget, or bidding strategy", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
  name: z.string().optional().describe("New campaign name"),
  daily_budget: z.number().optional().describe("New daily budget in dollars"),
  bidding_strategy: z.string().optional().describe("New bidding strategy"),
});

tool("google_ads_pause_campaign", "Pause a Google Ads campaign — stops ad delivery immediately", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID to pause"),
});

tool("google_ads_resume_campaign", "Resume a paused Google Ads campaign — this will start spending your budget", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID to resume"),
});

tool("google_ads_delete_campaign", "Permanently remove a Google Ads campaign — this action is IRREVERSIBLE", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID to delete"),
});

// ─── Google Ads: Ad Groups ────────────────────────────────────────────────────

tool("google_ads_list_ad_groups", "List all ad groups for a Google Ads campaign with performance metrics", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
});

tool("google_ads_create_ad_group", "Create a new ad group within a Google Ads campaign", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
  name: z.string().describe("Ad group name"),
  cpc_bid: z.number().default(1.0).describe("Max CPC bid in dollars"),
});

tool("google_ads_update_ad_group", "Update a Google Ads ad group's name, bid, or status", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
  name: z.string().optional().describe("New name"),
  cpc_bid: z.number().optional().describe("New CPC bid in dollars"),
  status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New status"),
});

tool("google_ads_pause_ad_group", "Pause a Google Ads ad group", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID to pause"),
});

tool("google_ads_delete_ad_group", "Permanently remove a Google Ads ad group — IRREVERSIBLE", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID to delete"),
});

// ─── Google Ads: Ads ──────────────────────────────────────────────────────────

tool("google_ads_list_ads", "List all ads in a Google Ads ad group with performance metrics", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
});

tool("google_ads_create_responsive_search_ad", "Create a Responsive Search Ad with multiple headlines and descriptions. Ad is created PAUSED for review.", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
  headlines: z.array(z.string()).min(3).max(15).describe("3-15 headlines (max 30 chars each)"),
  descriptions: z.array(z.string()).min(2).max(4).describe("2-4 descriptions (max 90 chars each)"),
  final_url: z.string().url().describe("Landing page URL"),
});

tool("google_ads_pause_ad", "Pause a Google Ads ad", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
  ad_id: z.string().describe("Ad ID to pause"),
});

tool("google_ads_enable_ad", "Enable a paused Google Ads ad — it will start serving", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
  ad_id: z.string().describe("Ad ID to enable"),
});

tool("google_ads_delete_ad", "Permanently remove a Google Ads ad — IRREVERSIBLE", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
  ad_id: z.string().describe("Ad ID to delete"),
});

// ─── Google Ads: Keywords ─────────────────────────────────────────────────────

tool("google_ads_list_keywords", "List keywords in a Google Ads ad group with quality score and performance metrics", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
});

tool("google_ads_add_keywords", "Add keywords to a Google Ads ad group with specified match types", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
  keywords: z.array(z.object({
    text: z.string().describe("Keyword text"),
    matchType: z.enum(["BROAD", "PHRASE", "EXACT"]).describe("Match type"),
  })).describe("Keywords to add"),
});

tool("google_ads_add_negative_keywords", "Add negative keywords to a Google Ads campaign to exclude irrelevant searches", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
  keywords: z.array(z.string()).describe("Negative keyword texts"),
});

tool("google_ads_pause_keyword", "Pause a keyword in a Google Ads ad group", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
  criterion_id: z.string().describe("Keyword criterion ID"),
});

tool("google_ads_remove_keyword", "Permanently remove a keyword from a Google Ads ad group — IRREVERSIBLE", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  ad_group_id: z.string().describe("Ad group ID"),
  criterion_id: z.string().describe("Keyword criterion ID"),
});

// ─── Google Ads: Metrics & Reporting ──────────────────────────────────────────

tool("google_ads_campaign_performance", "Get performance summary across all Google Ads campaigns with spend, clicks, conversions, and ROAS", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  days: z.number().default(30).describe("Number of days to look back (default 30)"),
});

tool("google_ads_time_series", "Get daily performance time series for a Google Ads campaign", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
  days: z.number().default(30).describe("Number of days (default 30)"),
});

tool("google_ads_breakdowns", "Get campaign breakdowns by device or network for a Google Ads campaign", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
  breakdown_type: z.enum(["device", "network"]).default("device").describe("Breakdown dimension"),
});

tool("google_ads_auction_insights", "Get competitive auction insights showing how you compare against other advertisers", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
});

tool("google_ads_get_budget", "Get budget details for a Google Ads campaign", {
  customer_id: z.string().describe("Google Ads customer/account ID"),
  campaign_id: z.string().describe("Campaign ID"),
});

// ─── Meta Ads: Accounts & Campaigns ───────────────────────────────────────────

tool("meta_ads_list_accounts", "List all accessible Meta (Facebook) ad accounts", {});

tool("meta_ads_list_campaigns", "List all campaigns for a Meta ad account with spend, conversions, CPA and ROAS over a chosen window", {
  ad_account_id: z.string().describe("Meta ad account ID (with or without act_ prefix)"),
  status: z.string().optional().describe("Filter by status: ACTIVE, PAUSED"),
  days: z.number().default(30).describe("Metrics lookback window in days (default 30)"),
});

tool("meta_ads_get_campaign", "Get detailed metrics for one Meta campaign over a chosen window", {
  campaign_id: z.string().describe("Meta campaign ID"),
  days: z.number().default(30).describe("Metrics lookback window in days (default 30)"),
});

tool("meta_ads_create_campaign", "Create a new Meta Ads campaign. Created PAUSED for safety — no money spent until you activate it.", {
  ad_account_id: z.string().describe("Meta ad account ID"),
  name: z.string().describe("Campaign name"),
  objective: z.enum(["OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_AWARENESS"]).describe("Campaign objective"),
  daily_budget: z.number().optional().describe("Daily budget in dollars"),
  lifetime_budget: z.number().optional().describe("Lifetime budget in dollars (alternative to daily)"),
});

tool("meta_ads_update_campaign", "Update a Meta campaign's name, budget, or status", {
  campaign_id: z.string().describe("Meta campaign ID"),
  name: z.string().optional().describe("New campaign name"),
  daily_budget: z.number().optional().describe("New daily budget in dollars"),
  status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status"),
});

tool("meta_ads_pause_campaign", "Pause a Meta campaign — stops ad delivery immediately", {
  campaign_id: z.string().describe("Meta campaign ID to pause"),
});

tool("meta_ads_resume_campaign", "Activate a paused Meta campaign — this will start spending your budget", {
  campaign_id: z.string().describe("Meta campaign ID to activate"),
});

tool("meta_ads_delete_campaign", "Permanently delete a Meta campaign — IRREVERSIBLE", {
  campaign_id: z.string().describe("Meta campaign ID to delete"),
});

// ─── Meta Ads: Ad Sets ────────────────────────────────────────────────────────

tool("meta_ads_list_ad_sets", "List all ad sets for a Meta campaign with targeting and metrics", {
  campaign_id: z.string().describe("Meta campaign ID"),
});

tool("meta_ads_create_ad_set", "Create a new ad set in a Meta campaign with targeting options", {
  ad_account_id: z.string().describe("Meta ad account ID"),
  campaign_id: z.string().describe("Campaign ID"),
  name: z.string().describe("Ad set name"),
  daily_budget: z.number().describe("Daily budget in dollars"),
  optimization_goal: z.enum(["LINK_CLICKS", "IMPRESSIONS", "REACH", "LEAD_GENERATION", "OFFSITE_CONVERSIONS"]).default("LINK_CLICKS").describe("Optimization goal"),
  age_min: z.number().default(18).describe("Minimum age"),
  age_max: z.number().default(65).describe("Maximum age"),
  countries: z.array(z.string()).default(["US"]).describe("Target country codes"),
  genders: z.array(z.number()).optional().describe("Genders: 1=Male, 2=Female"),
});

tool("meta_ads_update_ad_set", "Update a Meta ad set's name, budget, or status", {
  ad_set_id: z.string().describe("Meta ad set ID"),
  name: z.string().optional().describe("New name"),
  daily_budget: z.number().optional().describe("New daily budget in dollars"),
  status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status"),
});

tool("meta_ads_pause_ad_set", "Pause a Meta ad set", {
  ad_set_id: z.string().describe("Meta ad set ID to pause"),
});

tool("meta_ads_delete_ad_set", "Permanently delete a Meta ad set — IRREVERSIBLE", {
  ad_set_id: z.string().describe("Meta ad set ID to delete"),
});

// ─── Meta Ads: Ads ────────────────────────────────────────────────────────────

tool("meta_ads_list_ads", "List all ads in a Meta ad set with creative details and metrics", {
  ad_set_id: z.string().describe("Meta ad set ID"),
});

tool("meta_ads_create_ad", "Create a new Meta ad with creative (image, copy, link). Ad is created PAUSED for review.", {
  ad_account_id: z.string().describe("Meta ad account ID"),
  ad_set_id: z.string().describe("Ad set ID"),
  name: z.string().describe("Ad name"),
  page_id: z.string().describe("Facebook page ID"),
  title: z.string().describe("Ad headline/title"),
  body: z.string().describe("Ad body text"),
  link_url: z.string().url().describe("Destination URL"),
  image_url: z.string().optional().describe("Image URL for the ad creative"),
  call_to_action: z.enum(["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "GET_OFFER", "APPLY_NOW"]).default("LEARN_MORE").describe("Call to action button"),
});

tool("meta_ads_pause_ad", "Pause a Meta ad", {
  ad_id: z.string().describe("Meta ad ID to pause"),
});

tool("meta_ads_enable_ad", "Activate a paused Meta ad — it will start serving", {
  ad_id: z.string().describe("Meta ad ID to activate"),
});

tool("meta_ads_delete_ad", "Permanently delete a Meta ad — IRREVERSIBLE", {
  ad_id: z.string().describe("Meta ad ID to delete"),
});

// ─── Meta Ads: Targeting & Audiences ──────────────────────────────────────────

tool("meta_ads_search_interests", "Search Meta's targeting interests and behaviors for audience building", {
  query: z.string().describe("Search term (e.g., 'fitness', 'cooking', 'real estate')"),
});

tool("meta_ads_list_audiences", "List custom audiences for a Meta ad account", {
  ad_account_id: z.string().describe("Meta ad account ID"),
});

tool("meta_ads_list_pages", "List Facebook pages you manage (needed for creating ads)", {});

tool("meta_ads_update_targeting", "Update targeting settings on a Meta ad set (age, gender, countries, interests)", {
  ad_set_id: z.string().describe("Meta ad set ID"),
  age_min: z.number().optional().describe("Minimum age"),
  age_max: z.number().optional().describe("Maximum age"),
  genders: z.array(z.number()).optional().describe("Genders: 1=Male, 2=Female"),
  countries: z.array(z.string()).optional().describe("Target country codes"),
  interests: z.array(z.object({ id: z.string(), name: z.string() })).optional().describe("Interest targeting"),
});

// ─── Meta Ads: Metrics & Reporting ────────────────────────────────────────────

tool("meta_ads_campaign_performance", "Get performance summary across all Meta campaigns with spend, clicks, and conversions", {
  ad_account_id: z.string().describe("Meta ad account ID"),
  days: z.number().default(30).describe("Number of days to look back (default 30)"),
});

tool("meta_ads_time_series", "Get daily performance time series for a Meta campaign", {
  campaign_id: z.string().describe("Meta campaign ID"),
  days: z.number().default(30).describe("Number of days (default 30)"),
});

tool("meta_ads_breakdowns", "Get campaign breakdowns by device, platform, placement, age, or gender", {
  campaign_id: z.string().describe("Meta campaign ID"),
  breakdown_type: z.enum(["device_platform", "publisher_platform", "platform_position", "age", "gender"]).default("device_platform").describe("Breakdown dimension"),
});

// ─── Cross-Platform ───────────────────────────────────────────────────────────

server.registerTool(
  "list_connected_platforms",
  { description: "Check which ad platforms are configured and ready to use", inputSchema: {} },
  async () => {
    if (!proxyConfig) {
      return { content: [{ type: "text" as const, text: NO_KEY_MESSAGE }], isError: true };
    }
    try {
      const status = await getProxyStatus(proxyConfig);
      const g = status.google_ads?.connected ? "Connected" : "Not connected";
      const m = status.meta_ads?.connected ? "Connected" : "Not connected";
      const usage = status.usage;
      const lines = [
        `## Connected Platforms`,
        ``,
        `| Platform | Status |`,
        `|---|---|`,
        `| Google Ads | ${g} |`,
        `| Meta Ads | ${m} |`,
        ``,
        `**Usage this month:** ${usage?.calls_used ?? 0} / ${usage?.limit ?? "?"} calls`,
      ];
      if (!status.google_ads?.connected && !status.meta_ads?.connected) {
        lines.push(``, `Connect your ad accounts at https://adrex.ai/settings`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error connecting to Adrex: ${err.message}` }], isError: true };
    }
  }
);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main() {
  await configureProxy();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    proxyConfig
      ? "Adrex AI MCP server running on stdio [hosted]"
      : "Adrex AI MCP server running on stdio [no ADREX_API_KEY — set one at https://adrex.ai/settings]"
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
