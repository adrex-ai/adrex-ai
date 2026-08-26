<p align="center">
  <h1 align="center">Adrex AI</h1>
  <p align="center">
    <strong>Open-source MCP server for Google Ads &amp; Meta Ads</strong>
  </p>
  <p align="center">
    Manage your ad campaigns in plain English from Claude Code, Cursor, Codex, Gemini, or any MCP client.
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/adrex-ai"><img src="https://img.shields.io/npm/v/adrex-ai?color=8b5cf6" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/adrex-ai"><img src="https://img.shields.io/npm/dm/adrex-ai?color=06b6d4" alt="npm downloads"></a>
    <a href="LICENSE"><img src="https://img.shields.io/npm/l/adrex-ai" alt="MIT license"></a>
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> |
    <a href="#tools">62 Tools</a> |
    <a href="https://adrex.ai">Platform</a> |
    <a href="https://discord.gg/adrex">Discord</a>
  </p>
</p>

---

## What is Adrex AI?

Adrex AI is an **open-source MCP (Model Context Protocol) server** that connects AI assistants to your **Google Ads** and **Meta Ads** accounts. Instead of navigating complex dashboards, you manage campaigns, reporting, keywords, and targeting through natural language — from Claude, Cursor, Codex, or any MCP client.

> **Platforms:** Google Ads and Meta Ads (Facebook & Instagram) today — TikTok and LinkedIn coming soon.

```
You: "Show me my Google Ads performance for the last 7 days"
Claude: [calls google_ads_campaign_performance] → table with spend, clicks, CTR, ROAS

You: "Pause the campaign with the lowest ROAS"
Claude: [calls google_ads_pause_campaign] → campaign paused, no more spend

You: "Create a Meta campaign for our summer sale, $50/day budget"
Claude: [calls meta_ads_create_campaign] → campaign created PAUSED for your review
```

You connect your ad accounts once in the [Adrex dashboard](https://adrex.ai) (secure OAuth — your tokens stay on our servers, never in the MCP client), then drive everything from your AI assistant. There are **two ways to connect** (see [Quick Start](#quick-start)): a **remote server with browser sign-in — no API key**, or this **npx server with an API key**.

### Safety First

These tools operate on **real ad accounts** that spend **real money**:

- All campaigns and ads are created **PAUSED** — no spend until you explicitly resume
- Destructive and spend-starting actions return clear warnings
- Read operations (metrics, lists) run freely without side effects

## Quick Start

First, sign up at **[adrex.ai](https://adrex.ai)** and connect your Google/Meta ad accounts in **Settings**. Then pick one of the two ways to connect.

### Option A — Remote server (recommended, no API key)

Connect over HTTP and authorize in your browser — nothing to copy or paste. Your client stores its own secure token. In the Adrex dashboard, **Settings → Connect to your AI (MCP)** shows a one-command connect with your server URL. It looks like:

**Claude Code:**
```bash
claude mcp add --transport http adrex-ai https://<your-adrex-server>/mcp
```

**Claude Desktop / Cursor / VS Code / other clients** (JSON) — or use the one-click **Add to Cursor / Add to VS Code** buttons in Settings:
```json
{
  "mcpServers": {
    "adrex-ai": { "type": "http", "url": "https://<your-adrex-server>/mcp" }
  }
}
```

After adding, your client opens a browser tab — sign in and click **Authorize**. The consent screen shows **which Adrex account** you're authorizing as; if a different account is already signed in on that browser, use **Not you? Switch** before approving.

You can see and revoke every connected app in **Settings → Connect to your AI → Connected AI apps**.

> **Connected the wrong account?** Every tool will report "Not connected" even though your ad accounts are linked. Revoke the app in Settings, then re-authorize. Note that re-running `claude mcp add` does nothing once the server is configured (`already exists in local config`) — instead run `/mcp` in Claude Code, pick `adrex-ai`, and clear authentication.

### Option B — npx server with an API key

Prefer the classic stdio server? Generate an **API key** in **Settings**, then add it below. Adrex ships a standard **stdio MCP server**, so it works with **any MCP client** — every config points at `npx -y adrex-ai` with your `ADREX_API_KEY`.

**Claude Code:**
```bash
claude mcp add -s user adrex-ai -e ADREX_API_KEY=your-api-key -- npx -y adrex-ai
```

**Gemini CLI:**
```bash
gemini mcp add adrex-ai -e ADREX_API_KEY=your-api-key -- npx -y adrex-ai
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`), **Cursor** (`~/.cursor/mcp.json` global or `.cursor/mcp.json` per-project), **Gemini CLI** (`~/.gemini/settings.json`), or any client using the JSON `mcpServers` format:

```json
{
  "mcpServers": {
    "adrex-ai": {
      "command": "npx",
      "args": ["-y", "adrex-ai"],
      "env": {
        "ADREX_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Codex** (`~/.codex/config.toml`) — note Codex uses TOML, not JSON:

```toml
[mcp_servers.adrex-ai]
command = "npx"
args = ["-y", "adrex-ai"]
env = { ADREX_API_KEY = "your-api-key" }
```

**Any other MCP client** (Cline, Windsurf, Zed, Continue, …): point it at command `npx -y adrex-ai` with env `ADREX_API_KEY` set to your key.

That's it — no SDK setup, no developer tokens, no OAuth juggling. The server forwards each request to the Adrex backend, which uses the ad-account credentials you connected in the dashboard.

> **Behind a corporate proxy?** v1.0.4+ automatically routes through `HTTP_PROXY` / `HTTPS_PROXY`.

## Tools

### Google Ads (34 tools)

#### Campaigns
| Tool | Description |
|---|---|
| `google_ads_list_accounts` | List all accessible Google Ads accounts |
| `google_ads_list_campaigns` | List campaigns with performance metrics |
| `google_ads_get_campaign` | Get detailed campaign info and metrics |
| `google_ads_create_search_campaign` | Create a Search campaign (created PAUSED) |
| `google_ads_update_campaign` | Update name, budget, or bidding strategy |
| `google_ads_pause_campaign` | Pause a campaign |
| `google_ads_resume_campaign` | Resume a paused campaign |
| `google_ads_delete_campaign` | Permanently remove a campaign |

#### Ad Groups
| Tool | Description |
|---|---|
| `google_ads_list_ad_groups` | List ad groups with metrics |
| `google_ads_create_ad_group` | Create an ad group with CPC bid |
| `google_ads_update_ad_group` | Update name, bid, or status |
| `google_ads_pause_ad_group` | Pause an ad group |
| `google_ads_delete_ad_group` | Remove an ad group |

#### Ads
| Tool | Description |
|---|---|
| `google_ads_list_ads` | List ads with headlines, URLs, and metrics |
| `google_ads_create_responsive_search_ad` | Create RSA with headlines & descriptions |
| `google_ads_pause_ad` | Pause an ad |
| `google_ads_enable_ad` | Enable a paused ad |
| `google_ads_delete_ad` | Remove an ad |

#### Keywords
| Tool | Description |
|---|---|
| `google_ads_list_keywords` | List keywords with quality score and metrics |
| `google_ads_add_keywords` | Add keywords (BROAD, PHRASE, EXACT) |
| `google_ads_add_negative_keywords` | Add negative keywords to a campaign |
| `google_ads_pause_keyword` | Pause a keyword |
| `google_ads_remove_keyword` | Remove a keyword |

#### Reporting
| Tool | Description |
|---|---|
| `google_ads_campaign_performance` | Performance summary across all campaigns |
| `google_ads_time_series` | Daily metrics over a date range |
| `google_ads_breakdowns` | Breakdowns by device or network |
| `google_ads_auction_insights` | Competitive auction metrics |
| `google_ads_get_budget` | Campaign budget details |

#### Analysis
| Tool | Description |
|---|---|
| `google_ads_keyword_performance` | Rank keywords by return — which keywords made the most money |
| `google_ads_keyword_insights` | Full keyword audit in one call: blocking negatives, wasted-spend themes, missing keywords, Quality Score premiums, budget vs Ad Rank caps, duplicates |
| `google_ads_ad_performance` | Rank ads by return — which ad copy actually converts |
| `google_ads_search_terms` | What people actually searched, what it cost, and which terms spent with nothing to show |
| `google_ads_conversion_health` | Check conversion tracking is working before trusting any CPA or ROAS |
| `google_ads_recent_changes` | Who changed what recently — most sudden shifts are something someone did |

### Meta Ads (26 tools)

#### Campaigns
| Tool | Description |
|---|---|
| `meta_ads_list_accounts` | List all Meta ad accounts |
| `meta_ads_list_campaigns` | List campaigns with metrics |
| `meta_ads_get_campaign` | Get detailed campaign info |
| `meta_ads_create_campaign` | Create a campaign (created PAUSED) |
| `meta_ads_update_campaign` | Update name, budget, or status |
| `meta_ads_pause_campaign` | Pause a campaign |
| `meta_ads_resume_campaign` | Activate a paused campaign |
| `meta_ads_delete_campaign` | Delete a campaign |

#### Ad Sets
| Tool | Description |
|---|---|
| `meta_ads_list_ad_sets` | List ad sets with targeting and metrics |
| `meta_ads_create_ad_set` | Create ad set with targeting options |
| `meta_ads_update_ad_set` | Update name, budget, or status |
| `meta_ads_pause_ad_set` | Pause an ad set |
| `meta_ads_delete_ad_set` | Delete an ad set |

#### Ads
| Tool | Description |
|---|---|
| `meta_ads_list_ads` | List ads with creative details and metrics |
| `meta_ads_create_ad` | Create ad with copy, image, and CTA |
| `meta_ads_pause_ad` | Pause an ad |
| `meta_ads_enable_ad` | Activate a paused ad |
| `meta_ads_delete_ad` | Delete an ad |

#### Targeting & Audiences
| Tool | Description |
|---|---|
| `meta_ads_search_interests` | Search targeting interests and behaviors |
| `meta_ads_list_audiences` | List custom audiences |
| `meta_ads_list_pages` | List your Facebook pages |
| `meta_ads_update_targeting` | Update ad set targeting |

#### Reporting
| Tool | Description |
|---|---|
| `meta_ads_campaign_performance` | Performance summary across campaigns |
| `meta_ads_time_series` | Daily performance time series |
| `meta_ads_breakdowns` | Breakdowns by device, platform, age, gender |
| `meta_ads_creative_performance` | Rank ads by return — which creative made money, and which spent for nothing |

### Cross-Platform (2 tools)
| Tool | Description |
|---|---|
| `account_review` | One call for "how are we doing" — every campaign across Google and Meta, with ranked findings |
| `campaign_diagnosis` | Why performance moved: compares the window against the one before and attributes the change |

## Use Cases

**Performance Review**
> "How are my Google Ads campaigns performing this month? Show me the ones with ROAS below 2x."

**Campaign Management**
> "Create a new Meta traffic campaign called 'Summer Sale 2026' with a $75/day budget targeting ages 25-45 in the US."

**Keyword Optimization**
> "Show me keywords in my 'Brand Terms' ad group. Pause any with quality score below 5."

**Budget Control**
> "Increase the budget on my top-performing campaign by 20% and pause the one that's losing money."

## Want More?

The MCP server gives you full campaign management from chat. The [Adrex AI Platform](https://adrex.ai) adds:

- **AI Campaign Agent** — autonomous optimization with guardrails and rollback
- **Creative Studio** — AI-generated ad copy and images
- **A/B Testing** — native platform experiments
- **Competitor Intelligence** — track competitor ads across Google and Meta
- **Budget Rules Engine** — automated rules with natural language parsing
- **Visual Dashboard** — interactive charts, breakdowns, and time-series

## Links

- [Adrex AI Platform](https://adrex.ai)
- [Documentation](https://docs.adrex.ai)
- [Discord Community](https://discord.gg/adrex)

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by the team behind <a href="https://adrex.ai">Adrex AI</a>
</p>
