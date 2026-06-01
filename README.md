<p align="center">
  <h1 align="center">Adrex AI</h1>
  <p align="center">
    <strong>Open-source MCP server for Google Ads & Meta Ads</strong>
  </p>
  <p align="center">
    Manage your ad campaigns from Claude, ChatGPT, Cursor, or any MCP-compatible AI assistant.
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> |
    <a href="#tools">54 Tools</a> |
    <a href="https://adrex.ai">Platform</a> |
    <a href="https://discord.gg/adrex">Discord</a>
  </p>
</p>

---

## What is Adrex AI?

Adrex AI is an MCP (Model Context Protocol) server that connects AI assistants directly to Google Ads and Meta Ads APIs. Instead of navigating complex dashboards, you manage campaigns through natural language conversation.

```
You: "Show me my Google Ads performance for the last 7 days"
Claude: [calls google_ads_campaign_performance] → shows table with spend, clicks, CTR, ROAS

You: "Pause the campaign with the lowest ROAS"  
Claude: [calls google_ads_pause_campaign] → campaign paused, no more spend

You: "Create a Meta campaign for our summer sale, $50/day budget"
Claude: [calls meta_ads_create_campaign] → campaign created PAUSED for your review
```

### Safety First

These tools operate on **real ad accounts** that spend **real money**. We take that seriously:

- All campaigns are created **PAUSED** — no money spent until you explicitly resume
- Destructive actions (delete, resume) include confirmation warnings
- Read operations (metrics, lists) run freely without side effects
- Authentication via OAuth — no credentials stored by the MCP server
- Fully open source — audit every line of code

## Quick Start

### Install via npx (no setup needed)

```bash
npx adrex-ai
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "adrex-ai": {
      "command": "npx",
      "args": ["-y", "adrex-ai"],
      "env": {
        "GOOGLE_ADS_CLIENT_ID": "your-client-id",
        "GOOGLE_ADS_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "your-developer-token",
        "GOOGLE_ADS_REFRESH_TOKEN": "your-refresh-token",
        "META_ADS_APP_ID": "your-app-id",
        "META_ADS_APP_SECRET": "your-app-secret",
        "META_ADS_ACCESS_TOKEN": "your-access-token"
      }
    }
  }
}
```

### Cursor

Add the same config to `.cursor/mcp.json` in your project root.

### Claude Code

```bash
claude mcp add adrex-ai -- npx -y adrex-ai
```

## Credential Setup

### Google Ads

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Ads API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Apply for a [Developer Token](https://developers.google.com/google-ads/api/docs/get-started/dev-token)
5. Generate a refresh token using the OAuth playground or the built-in OAuth flow

See [docs/setup-google.md](docs/setup-google.md) for detailed steps.

### Meta Ads

1. Create an app at [Meta for Developers](https://developers.facebook.com/)
2. Add the Marketing API product
3. Generate a long-lived access token with `ads_management` and `ads_read` permissions

See [docs/setup-meta.md](docs/setup-meta.md) for detailed steps.

> You can configure just one platform — Google-only or Meta-only setups work fine.

## Tools

### Google Ads (28 tools)

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

### Meta Ads (25 tools)

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

### Cross-Platform (1 tool)
| Tool | Description |
|---|---|
| `list_connected_platforms` | Check which platforms are configured |

## Use Cases

**Performance Review**
> "How are my Google Ads campaigns performing this month? Show me the ones with ROAS below 2x."

**Campaign Management**
> "Create a new Meta traffic campaign called 'Summer Sale 2026' with a $75/day budget targeting ages 25-45 in the US."

**Keyword Optimization**
> "Show me keywords in my 'Brand Terms' ad group. Pause any with quality score below 5."

**Budget Control**
> "Increase the budget on my top-performing campaign by 20% and pause the one that's been losing money."

**Competitive Intelligence**
> "Show me auction insights for my main Search campaign — who am I competing against?"

## Want More?

The open-source MCP server gives you full campaign management. For AI-powered optimization, creative generation, and visual analytics, check out the [Adrex AI Platform](https://adrex.ai):

- **AI Campaign Agent** — autonomous optimization with guardrails and rollback
- **Creative Studio** — AI-generated ad copy and images
- **A/B Testing** — native platform experiments with statistical analysis
- **Competitor Intelligence** — track competitor ads across Google and Meta
- **Budget Rules Engine** — automated rules with natural language parsing
- **Visual Dashboard** — interactive charts, breakdowns, and time-series

## Development

```bash
# Clone the repo
git clone https://github.com/adrex-ai/adrex-ai.git
cd adrex-ai

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

## Contributing

We welcome contributions! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

## Links

- [Adrex AI Platform](https://adrex.ai)
- [Documentation](https://docs.adrex.ai)
- [Discord Community](https://discord.gg/adrex)
- [Twitter/X](https://x.com/adrex_ai)

---

<p align="center">
  Built by the team behind <a href="https://adrex.ai">Adrex AI</a>
</p>
