# Codex Usage Tracker

A CLI tool for tracking and analyzing OpenAI Codex CLI token usage by repository, date, and model.

## Features

- 📊 **Repository Breakdown**: See which projects consume the most tokens
- 📅 **Daily Reports**: Track usage over time with daily aggregations
- 🤖 **Model Distribution**: Understand which Codex models you're using
- 💰 **Cost Tracking**: Calculate estimated costs based on model pricing

## Pricing

Costs are estimated based on OpenAI's Standard tier pricing. Actual costs may vary based on:
- Pricing tier (Batch, Flex, Standard, Priority)
- Volume discounts
- Enterprise agreements
- Currency conversion
- Special Codex pricing tiers

For the most accurate costs, check your OpenAI billing dashboard or use `npx @ccusage/codex@latest` which fetches live pricing from LiteLLM.
- 🎨 **Beautiful Tables**: Colorful, formatted terminal output
- 📄 **JSON Export**: Get structured data for further analysis

## Installation

```bash
# Install globally
npm install -g codex-usage

# Or run with npx
npx codex-usage
```

## Usage

### Repository Usage (Default)
Shows token usage grouped by repository/folder:
```bash
codex-usage repos
codex-usage repos --top 10              # Show only top 10 repos
codex-usage repos --since 2026-01-01    # Filter by date
codex-usage repos --json                # JSON output
```

### Daily Reports
Shows daily token usage:
```bash
codex-usage daily
codex-usage daily --since 7days         # Last 7 days
codex-usage daily --until 2025-12-31    # Until specific date
```

### Model Breakdown
Shows usage grouped by Codex model:
```bash
codex-usage models
```

### Summary
Shows overall usage summary:
```bash
codex-usage summary
```

### Options
- `--codex-dir <path>`: Codex data directory (default: `~/.codex`)
- `--json`: Output as JSON
- `--since <date>`: Start date (YYYY-MM-DD or relative: 7days, 1month)
- `--until <date>`: End date (YYYY-MM-DD)
- `--top <n>`: Limit results (repos command)

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║ Codex Token Usage by Repository                            ║
╚════════════════════════════════════════════════════════════╝
  Sep 15, 2025 - Jan 10, 2026

┌──────────────────────────────────────────────────────┬───────────────┬───────────┬─────────┐
│ Repository                                           │  Total Tokens │      Cost │ % Total │
├──────────────────────────────────────────────────────┼───────────────┼───────────┼─────────┤
│ ~/Projects/acme/alpha-app                            │   821,324,637 │   $654.35 │   25.2% │
│ ~/Projects/acme/beta-service                         │   688,790,294 │   $555.88 │   21.1% │
│ ~/Projects/acme/gamma-tool                           │   399,651,942 │   $322.35 │   12.3% │
├──────────────────────────────────────────────────────┼───────────────┼───────────┼─────────┤
│ TOTAL                                                │ 3,259,607,066 │ $2,614.47 │    100% │
└──────────────────────────────────────────────────────┴───────────────┴───────────┴─────────┘

🤖 Model Distribution
──────────────────────────────────────────────────
  gpt-5.2-codex        2,123,184,604 65.1%
  gpt-5.1-codex-max    432,212,433  13.3%
  gpt-5-codex          310,992,712  9.5%
```

## Pricing

The tool uses current OpenAI Codex pricing:
- **GPT-5.1 Codex**: $0.0015/1K input, $0.0060/1K output
- **GPT-5.0 Codex**: $0.0010/1K input, $0.0040/1K output
- Cache reads are discounted at 50%

Pricing is hardcoded for reliability. For the latest pricing, visit [OpenAI's pricing page](https://openai.com/pricing).

## Data Source

The tool reads Codex session data from `~/.codex/sessions/` (or custom path with `--codex-dir`).

Each session file contains JSONL records with:
- Session metadata (cwd, model, git info)
- Turn context (working directory, model changes)
- Token usage events with detailed breakdowns

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start -- repos

# Development mode (watch)
npm run dev
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or PR.
