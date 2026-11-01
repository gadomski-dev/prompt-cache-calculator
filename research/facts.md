# Episode 09: prompt-cache TTL — verified facts

As of 2026-10-28. Fact editor's resolution of the research sweeps (Anthropic, Claude Code, Copilot,
Cursor, OpenAI, forums, social, remedies). Each sweep claim was checked twice: a "sources" pass that
re-opened every URL and an "independent" pass that searched fresh and tried to refute it.

Status labels used below:

- **VERIFIED**: both checks agree and the source is primary (vendor docs, vendor code, vendor staff).
- **VERIFIED (community)**: the URL and quote were confirmed, but the source is a user measurement, not a vendor.
- **CORRECTED**: the original sweep value was wrong. The value shown is the corrected one.
- **INFERENCE**: own reasoning from verified facts. It is not a vendor statement.
- **UNVERIFIED**: no primary source, or the two checks disagree and I could not settle it.

Prices are USD per million tokens (MTok) unless stated otherwise. In Copilot, 1 AI credit = $0.01.

---

## Krystian's claims

| # | Claim | Verdict | Explanation | Source |
|---|---|---|---|---|
| K1 | Copilot uses a 5-minute cache for Claude models | **true** | GitHub never states a TTL. But the VS Code Copilot source defaults to 5 minutes. Copilot CLI's own session logs record `cacheTtlSeconds: 300` for every Claude model. Users measured 0% cache reads after an 11-minute pause, and Copilot's single Claude cache-write price is Anthropic's 5-minute rate (1.25x input). Caveat: GitHub's own tutorial says "1 hour for most others", but code and measurements contradict it (F53). | https://github.com/microsoft/vscode/blob/main/extensions/copilot/src/platform/networking/common/anthropic.ts , https://github.com/github/copilot-cli/issues/5220 |
| K2 | Copilot gives GPT models about a 30-minute cache | **partly true** | It holds for the 8 GPT-5.6-and-later models in Copilot (8 of 10 OpenAI models offered). Their default is a 30-minute **minimum** lifetime that every read refreshes. Copilot CLI logs show 1800 s for them, and users measured ~95% cache reads after 11 minutes and 0% after ~85 minutes. Writes are not free: they cost 1.25x input, the same multiplier as Claude's 5-minute write. For older GPT-5.3-Codex, VS Code requests 24-hour retention instead. GitHub itself documents none of this. | https://developers.openai.com/api/docs/guides/prompt-caching , https://github.com/xpepper/copilot-powerline/issues/82 |
| K3 | Since June 2026 Copilot bills in AI credits that convert to dollars | **true** | Announced 2026-04-27 and in effect from 2026-06-01. Tokens (input, cached input, cache write, output) are priced at each model's listed API rate, and the total is converted at 1 AI credit = $0.01. Only legacy annual Pro/Pro+ subscribers stay on premium requests until their plan expires. | https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/ , https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing |
| K4 | Cursor uses a 5-minute cache for Claude and users cannot change it | **true** | Cursor staff (Colin, Community Support Engineer) said so several times: "5 minutes for Anthropic", "We don't do anything special to keep the cache warm", and on 2026-09-16 that a 1-hour cache was tested and is "not in our plans to change". No settings page or docs page offers a TTL option. It is a staff forum statement, not documentation, so Cursor could change it without notice. | https://forum.cursor.com/t/how-long-does-cursors-prompt-cache-persist-before-expiring/165686/4 , https://forum.cursor.com/t/anthropic-models-prompt-cache/171871/5 |
| K5 | Claude Code on a subscription (Pro/Max/Team/Enterprise) uses a 1-hour TTL | **partly true** | 1 hour applies only to the **main conversation**, and only while you are within the plan's included usage. Subagents, workflows (including ultracode fan-outs), teammates, forks and compaction get 5 minutes even on a subscription. Going over the plan limit onto usage credits also drops the main conversation to 5 minutes. Team/Enterprise seats are not listed separately in the docs. Separately, an open regression report (#103673) says interactive CLI sessions have written 5-minute caches since about 2026-10-14. | https://code.claude.com/docs/en/prompt-caching |
| K6 | Claude Code on the API defaults to 5 minutes and it is configurable | **true** | With an API key, Bedrock, Google Cloud or Foundry, every request defaults to 5 minutes. Settings: `promptCacheTtl` (main conversation) and `subagentPromptCacheTtl` (everything else), values `"5m"` or `"1h"`, in `settings.json`. Equivalent env vars: `CLAUDE_CODE_PROMPT_CACHE_TTL` and `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`. `ENABLE_PROMPT_CACHING_1H=1` sets 1 hour for both buckets, and `FORCE_PROMPT_CACHING_5M=1` overrides everything. Docs say v2.1.242+; the changelog lists these settings under 2.1.243 (2026-08-24). | https://code.claude.com/docs/en/prompt-caching , https://code.claude.com/docs/en/settings-reference |
| K7 | Claude Code recently added automatic compaction when the agent is idle, and it can be turned off | **true** | "Idle compaction" shipped in v2.1.299 (published 2026-10-14). It compacts a long conversation idle for about an hour (changelog: ~54 minutes) before its 1-hour cache expires. It is on by default and turned off with `"idleCompaction": false` (key needs v2.1.290+; a `/config` row exists from v2.1.302). `DISABLE_AUTO_COMPACT=1` also turns it off. It fires only on the 1-hour TTL, at 200,000+ tokens by default, so in practice only 1M-context sessions are affected. | https://code.claude.com/docs/en/settings-reference#idlecompaction , https://github.com/anthropics/claude-code/releases/tag/v2.1.299 |
| K8 | Returning after >5 minutes with a ~90% full context costs $3-5 extra with Opus | **partly true** | Own arithmetic (table below): $3-5 holds only for a **1M** window: +$4.32 on Opus 5.5 and +$5.18 on Opus 5 / 4.8. With a **200K** window the penalty is about $0.86 (Opus 5.5) to $1.04 (Opus 5 / 4.8). Output and new input for that turn come on top. | https://platform.claude.com/docs/en/about-claude/pricing |

### K8 arithmetic (own arithmetic, from F1 and F5)

The cost of one expired-cache turn equals the context re-written at the write price minus what a warm
read would have cost. Context = 90% of the window. The output and new input of that turn are excluded.

| Model (list price) | Window | Context at 90% | Warm read | Re-write (5m TTL) | **Extra per expiry** | Re-write if 1h TTL also expired (>60 min) |
|---|---|---|---|---|---|---|
| Opus 5.5 ($5 write, $0.20 read) | 200K | 180,000 | $0.036 | $0.90 | **$0.86** (86 credits) | $1.44 |
| Opus 5.5 | 1M | 900,000 | $0.18 | $4.50 | **$4.32** (432 credits) | $7.20 |
| Opus 5 / 4.8 ($6.25 write, $0.50 read) | 200K | 180,000 | $0.09 | $1.125 | **$1.04** | $1.80 |
| Opus 5 / 4.8 | 1M | 900,000 | $0.45 | $5.625 | **$5.18** | $9.00 |

Cross-checks:

- **Copilot.** Copilot's Opus 5.5 rates equal Anthropic's list prices, so the credits column applies there as well. A user's real measurement fits the formula: at ~540K tokens, a pause over 5 minutes cost ~270 credits against ~13 for a normal turn (538K x $5 = $2.69).
- **Cursor Teams.** The $0.25/MTok surcharge adds to both read and write, so the extra per expiry stays $4.32 at 900K.
- **Tokenizer.** Claude 4.7 and later produce about 30% more tokens for the same text (F11).
- **Open point.** The size of Copilot's Opus 5.5 context window is not verified. The 540K measurement shows it is larger than 200K.

---

## Prices and TTLs

### Anthropic API (platform.claude.com)

| ID | Fact | Value | Status | Source | Short quote | Date |
|---|---|---|---|---|---|---|
| F1 | Opus 5.5 prices | $4 input / $5 5-min write / $8 1-hour write / $0.20 read / $20 output | VERIFIED | https://platform.claude.com/docs/en/about-claude/pricing | "Claude Opus 5.5 \| $4 / MTok \| $5 / MTok \| $8 / MTok \| $0.20 / MTok \| $20 / MTok" | fetched 2026-10-28 |
| F2 | Sonnet 5.5 prices | $2 / $2.50 / $4 / $0.10 / $10. The read was $0.20 at launch (2026-09-28) and was cut on 2026-10-07 | VERIFIED | https://platform.claude.com/docs/en/release-notes/overview | "lowered the price of prompt cache reads on Claude Sonnet 5.5 from $0.20 USD to $0.10 USD" | 2026-10-07 |
| F3 | Haiku 5.5 long-context tier | ≤100K prompt: $0.10 / $0.125 / $0.20 / $0.01 / $0.50. >100K: $0.50 / $0.625 / $1 / $0.05 / $2.50. Cache reads and writes count toward the threshold | VERIFIED | https://platform.claude.com/docs/en/about-claude/pricing#long-context-pricing | "A request's prompt length counts all of its input tokens, including cache reads and cache writes." | fetched 2026-10-28 |
| F4 | Fable 5.1 prices | $10 / $12.50 / $20 / $0.25 (0.025x) / $50. The legacy Fable 5 read stays at $1 | VERIFIED | https://platform.claude.com/docs/en/about-claude/pricing | "Claude Fable 5.1 \| $10 / MTok \| $12.50 / MTok \| $20 / MTok \| $0.25 / MTok \| $50 / MTok" | fetched 2026-10-28 |
| F5 | Legacy Opus 5, 4.8, 4.7, 4.6, 4.5 | $5 / $6.25 / $10 / $0.50 / $25 | VERIFIED | https://platform.claude.com/docs/en/about-claude/pricing | "Claude Opus 4.8 \| $5 / MTok \| $6.25 / MTok \| $10 / MTok \| $0.50 / MTok \| $25 / MTok" | fetched 2026-10-28 |
| F6 | Context windows | 1M on Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5, Opus 5, Opus 4.8/4.7/4.6, Sonnet 5, Sonnet 4.6 (and Mythos). 200K on Opus 4.5, Sonnet 4.5 and Haiku 4.5. Only Haiku 5.5 carries a long-context surcharge | CORRECTED | https://platform.claude.com/docs/en/build-with-claude/context-windows | "A 900k-token request is billed at the same per-token rate as a 9k-token request." | fetched 2026-10-28 |
| F7 | Cache multipliers | 5-min write 1.25x, 1-hour write 2x, read 0.1x. Reads are 0.05x on Opus 5.5 and Sonnet 5.5, and 0.025x on Fable 5.1 and Mythos 5.1 | VERIFIED | https://platform.claude.com/docs/en/about-claude/pricing#prompt-caching | "0.025x on Claude Fable 5.1 and Claude Mythos 5.1; 0.05x on Claude Opus 5.5 and Claude Sonnet 5.5" | fetched 2026-10-28 |
| F8 | Default TTL and refresh | 5 minutes, refreshed free on every hit, measured from the **start** of the request. Generation time counts against it | VERIFIED | https://platform.claude.com/docs/en/build-with-claude/prompt-caching | "By default, the cache has a 5-minute lifetime. The cache is refreshed for no additional cost each time the cached content is used." | fetched 2026-10-28 |
| F9 | 1-hour TTL syntax | `"cache_control": {"type": "ephemeral", "ttl": "1h"}`. A request can mix TTLs, but 1-hour entries must come before 5-minute ones | VERIFIED | https://platform.claude.com/docs/en/build-with-claude/prompt-caching#1-hour-cache-duration | "when an agentic side-agent will take longer than 5 minutes" | fetched 2026-10-28 |
| F10 | A miss re-bills the whole prefix | Whole prefix at the write price: 1.25x on the 5-min TTL, 2x on the 1-hour TTL | VERIFIED | https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence#pick-the-cache-duration | "A miss on either duration bills the whole prefix at the write price instead of the read price." | fetched 2026-10-28 |
| F11 | Tokenizer | Claude 4.7 and later produce about 30% more tokens for the same text | VERIFIED | https://platform.claude.com/docs/en/about-claude/pricing | "produces approximately 30% more tokens for the same text" | fetched 2026-10-28 |
| F12 | Add-ons | US-only inference multiplies every token category by 1.1x. Opus 5.5 fast mode is $8 input / $40 output, with the cache multipliers on top | VERIFIED | https://platform.claude.com/docs/en/about-claude/pricing | (pricing page, US-only inference and fast-mode sections) | fetched 2026-10-28 |
| F13 | Minimum cacheable prefix | 512 tokens (Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1, Opus 5); 1,024 (Opus 4.8, Sonnet 5, Sonnet 4.6); 2,048 (Opus 4.7); 4,096 (Opus 4.6, 4.5, Haiku 4.5). Shorter prefixes are not cached and no error is returned | VERIFIED (Bedrock lists Opus 4.7 at 4,096, see Open questions) | https://platform.claude.com/docs/en/build-with-claude/prompt-caching | "processed without caching, and no error is returned" | fetched 2026-10-28 |
| F14 | Keep-alive (API only) | Re-send the previous request unchanged with `max_tokens: 0` every 4 minutes from the previous request's start. It is billed as a cache read and bills zero output. It is rejected with `stream: true`, `thinking.type: "enabled"`, structured outputs, a forced tool choice and Message Batches | VERIFIED | https://platform.claude.com/docs/en/build-with-claude/prompt-caching | "Zero output tokens are billed." | measured by Anthropic 2026-10-20 |
| F15 | Anthropic's TTL rule of thumb | Switch to 1 hour once about 1 turn in 20 follows a 5-60 minute pause (break-even about 1 in 30). Sonnet 5.5 with 1 turn in 10 paused: the 5-min TTL cost 54% more (36-73% across runs). With no pauses, 5 minutes is 15-19% cheaper. If 60% or more of pauses run past an hour, stay on 5 minutes | CORRECTED (keep-alive figure) | https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence#pick-the-cache-duration | "at 1 turn in 10 the 5-minute setting cost 54% more" | measured Sep-Oct 2026 |
| F16 | Keep-alive vs 1-hour TTL on Opus 5.5 | Keep-alive was 8-13% cheaper than the 1-hour TTL at default effort with 5-10% of turns paused. It was 4-58% dearer when every turn was paused | CORRECTED | same page, reference 16 | "8% to 13% less at its default effort, medium" | measured 2026-09-19/20 |
| F17 | Switching models | Each model has its own cache, so a switch re-writes the whole prefix. Different speeds do not share prefixes either | VERIFIED | https://code.claude.com/docs/en/prompt-caching | "Switching models recomputes the entire request even when the content is identical" | fetched 2026-10-28 |
| F18 | Changing the TTL mid-conversation | One full re-write: $0.80 at 100K tokens on Opus 5.5, against $0.02 for a cached turn | VERIFIED | https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence#pick-the-cache-duration | "Choose the cache duration when a conversation starts." | fetched 2026-10-28 |
| F19 | Hosts that serve Copilot's Claude | Amazon Bedrock, Google Cloud and the Anthropic API all offer the 1-hour TTL for current Claude models. A 5-minute TTL in Copilot is therefore GitHub's choice, not a platform limit (inference) | VERIFIED + INFERENCE | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html | "Claude Opus 5.5 \| anthropic.claude-opus-5-5 \| Generally Available \| 512 \| 4 \| 5 minutes, 1 hour" | fetched 2026-10-28 |

### Claude Code

| ID | Fact | Value | Status | Source | Short quote | Date |
|---|---|---|---|---|---|---|
| F20 | TTL per bucket | Subscription within plan usage: main conversation 1h. Everything else (subagents, workflows, in-process teammates, forks, compaction, session titles) 5m, apart from a few server-controlled helper requests at 1h. API key / cloud provider: 5m for all | VERIFIED | https://code.claude.com/docs/en/prompt-caching | "Subagents fall outside the main-conversation TTL bucket, so they get five minutes even on a subscription until you choose a longer one." | fetched 2026-10-28 |
| F21 | Usage credits | Over the plan limit, on usage credits, the main conversation drops to 5m unless `promptCacheTtl` / env var / `ENABLE_PROMPT_CACHING_1H` keeps 1h | VERIFIED | https://code.claude.com/docs/en/prompt-caching | "Claude Code drops the main conversation to the five-minute TTL" | fetched 2026-10-28 |
| F22 | Per-bucket TTL settings | `promptCacheTtl`, `subagentPromptCacheTtl` (`"5m"`/`"1h"`), env `CLAUDE_CODE_PROMPT_CACHE_TTL`, `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`. Docs say v2.1.242+; the changelog lists them under 2.1.243. Say "2.1.243" on camera | VERIFIED | https://code.claude.com/docs/en/settings-reference | "Choose how long the prompt cache holds the main conversation. ... Requires Claude Code v2.1.242 or later." | 2026-08-24 |
| F23 | Global switches and precedence | `ENABLE_PROMPT_CACHING_1H=1` and `FORCE_PROMPT_CACHING_5M=1`, both added in v2.1.108 (2026-04-14). Precedence: FORCE_5M > bucket env var > bucket setting > subagent frontmatter `experimental.cacheTtl` (v2.1.248+) > ENABLE_1H > default | VERIFIED | https://code.claude.com/docs/en/prompt-caching | "Claude Code takes the first match in this order: 1. FORCE_PROMPT_CACHING_5M=1" | fetched 2026-10-28 |
| F24 | Idle compaction | Default on. Runs on the 1h TTL only, after about an hour idle with the computer awake, at ≥200,000 tokens (`CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS`, floor 100,000). Off with `idleCompaction: false` (v2.1.290+) or `DISABLE_AUTO_COMPACT=1`. Shipped in v2.1.299 (2026-10-14); `/config` row from v2.1.302 (2026-10-16) | VERIFIED | https://code.claude.com/docs/en/settings-reference#idlecompaction | "To turn idle compaction off, set idleCompaction to false, which requires Claude Code v2.1.290 or later." | 2026-10-14 |
| F25 | Workflow (ultracode) agents | 5m by default, including on a subscription. Same-prefix agents in a fan-out wait up to 5,000 ms (`CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS`) to read the first agent's cache. 16 concurrent agents by default, 1,000 per run | VERIFIED | https://code.claude.com/docs/en/workflows | "its cache holds for five minutes by default, including on a Claude subscription" | fetched 2026-10-28 |
| F26 | Cache scope | One machine and one directory. Parallel sessions in separate git worktrees never share a cache. A subagent's first request does not read the parent cache; a fork's does | VERIFIED | https://code.claude.com/docs/en/prompt-caching#cache-scope | "In Claude Code, the cache is effectively scoped to one machine and directory." | fetched 2026-10-28 |
| F27 | Checking the TTL live | `/usage` "Prompt cache (main)" line (v2.1.251+, main conversation only). `claude -p "hello" --output-format json` → `usage.cache_creation.ephemeral_1h_input_tokens` vs `ephemeral_5m_input_tokens`. Status-line `prompt_cache` object. Cache clock in the VS Code extension | VERIFIED | https://code.claude.com/docs/en/costs | "warm (1h TTL, last activity 40s ago)" | fetched 2026-10-28 |
| F28 | Cache breakers | Model switch (incl. opusplan and fallback), fast-mode toggle, effort change (except Opus/Sonnet/Haiku 5.5 and Fable 5.1 on API key or subscription), MCP server add/remove or tool deny **only when tool search is off**, compaction, image eviction, upgrades. A cold `/compact` re-processes the whole history uncached | CORRECTED | https://code.claude.com/docs/en/prompt-caching | "This is why /compact costs the most when you resume an old session." | fetched 2026-10-28 |
| F29 | Subagents run in the background by default | Fork mode is on by default (v2.1.302 in all interactive surfaces), so the main conversation is not blocked | VERIFIED | https://code.claude.com/docs/en/sub-agents | "With nothing configured, a subagent that Claude spawns from your main conversation starts in the background." | fetched 2026-10-28 |
| F30 | Agent SDK | 1-hour TTL via `ENABLE_PROMPT_CACHING_1H` in `options.env` (TypeScript: spread `process.env`). `total_cost_usd` is a client-side estimate that includes subagents; `usage` excludes them | VERIFIED | https://code.claude.com/docs/en/agent-sdk/cost-tracking | "`ENABLE_PROMPT_CACHING_1H` asks for the 1-hour TTL on every request in both buckets." | fetched 2026-10-28 |
| F31 | Staff rationale for 5m subagents | Subagents are rarely resumed, so a 1h premium would be wasted. API customers are not defaulted to 1h | VERIFIED (staff) | https://github.com/anthropics/claude-code/issues/46829 | "we actually keep it at 5m for many queries also (eg. subagents, which are rarely resumed ...)" | 2026-04-13 |

### GitHub Copilot

| ID | Fact | Value | Status | Source | Short quote | Date |
|---|---|---|---|---|---|---|
| F40 | Usage-based billing | Announced 2026-04-27, effective 2026-06-01. Premium requests replaced by AI credits | VERIFIED | https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/ | "Usage will be calculated based on token consumption, including input, output, and cached tokens, using the listed API rates for each model." | 2026-04-27 |
| F41 | Credit conversion | 1 AI credit = $0.01. Code completions and next-edit suggestions are not billed | VERIFIED | https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing | "the total is converted into AI credits, where 1 AI credit = $0.01 USD" | fetched 2026-10-28 |
| F42 | Individual plans | Pro $10 = 1,000 base + 500 flex = 1,500 credits; Pro+ $39 = 3,900 + 3,100 = 7,000; Max $100 = 10,000 + 10,000 = 20,000. Flex is "variable". No carry-over; resets 00:00 UTC on the 1st | VERIFIED | https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals | "Copilot Pro $10 USD 1,000 500 1,500" | fetched 2026-10-28 |
| F43 | Business / Enterprise | 1,900 / 3,900 credits per user per month, pooled across the organization. Paid overage is on by default | VERIFIED | https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-organizations-and-enterprises | "a shared pool of 190,000 AI credits rather than 100 individual buckets" | fetched 2026-10-28 |
| F44 | Overage | Same per-token rate, no surcharge. Budgets are set in USD ($10 = 1,000 credits) | VERIFIED | https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing | "additional usage is billed in GitHub AI Credits at the per-token rates shown" | fetched 2026-10-28 |
| F45 | Claude rates in Copilot (input / cached / cache write / output) | Opus 5.5 $4.00 / $0.20 / $5.00 / $20.00. Opus 5 and 4.8 $5.00 / $0.50 / $6.25 / $25.00. Sonnet 5.5 $2.00 / $0.10 / $2.50 / $10.00. Fable 5.1 $10 / $0.25 / $12.50 / $50. All equal Anthropic list prices; Opus 5.5 has no long-context tier | VERIFIED | https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing | "Claude Opus 5.5 GA Powerful Default Not applicable $4.00 $0.20 $5.00 $20.00" | fetched 2026-10-28 |
| F46 | GPT rates in Copilot | GPT-5.6 Sol ≤272K $4.00 / $0.40 / $5.00 / $20.00, >272K $8.00 / $0.80 / $10.00 / $30.00. GPT-6.1 Sol ≤272K $2.00 / $0.10 / $2.50 (write $5.00 above 272K). GPT-5.6 Luna ≤200K $0.20 / $0.02 / $0.25 / $1.20, >200K $0.40 / $0.04 / $0.50 / $1.80. GPT-5.3-Codex $1.75 / $0.175 / none / $14.00 | VERIFIED | https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing | "Earlier OpenAI models have no cache write cost." | fetched 2026-10-28 |
| F47 | Only one cache-write price | Every Claude write price is 1.25x input, Anthropic's 5-minute tier. No 1-hour (2x) price is listed. This suggests 5-minute billing but does not prove it | VERIFIED + INFERENCE | https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing | "Anthropic models include a cache write cost in addition to cached input." | fetched 2026-10-28 |
| F48 | Opus is not on Copilot Pro | Opus 4.8 / 5 / 5.5 and Fable 5 / 5.1 are "Not included" on Pro, only on Pro+ and Max | VERIFIED | https://docs.github.com/en/copilot/get-started/plans | (plans table: Not included on Pro) | fetched 2026-10-28 |
| F49 | Discounts (individual paid plans) | Auto model selection -10%. Copilot Fusion -30% through 2026-11-30 | VERIFIED | https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals | (discounts section) | fetched 2026-10-28 |
| F50 | VS Code 1-hour setting | `github.copilot.chat.anthropic.promptCaching.extendedTtl` is experimental, defaults to false and is tagged `onExp` (GitHub can switch it on server-side for some users). It covers tools and the system prompt only; conversation history needs `extendedTtlMessages` too. Main agent conversation only, never subagents. The model gate covers Fable 5, Opus 4.5-4.8, Sonnet 4.5/4.6 and Haiku 4.5, **not** Claude 5.x. Fix PR #340831 was still open on 2026-10-28 | CORRECTED | https://github.com/microsoft/vscode/blob/main/extensions/copilot/src/platform/networking/common/anthropic.ts | "Subagent requests are short-lived and would not benefit from the 1h TTL." | main branch 2026-10-28 |
| F51 | VS Code keep-alive | `github.copilot.chat.agent.longToolCallCachePreservation.enabled` is experimental and off by default. It probes every 4 minutes with at most 1 probe, Anthropic only, during execution-subagent tool calls only. It does not cover a person pausing | VERIFIED | https://github.com/microsoft/vscode/blob/main/extensions/copilot/src/extension/intents/node/toolCallingLoop.ts | "periodic keep-alive probes are sent during long-running tool calls to keep the server-side prompt cache warm" | main branch 2026-10-28 |
| F52 | Copilot CLI | No TTL option up to v1.0.105 (2026-10-27/28). Local session logs (`~/.copilot/session-state/<id>/events.jsonl`, `data.modelCacheState.cacheTtlSeconds`) show 300 for every Claude model and 1800 for GPT-5.6/6/6.1 | VERIFIED (community) | https://github.com/xpepper/copilot-powerline/issues/82 | "every Claude model 300, GPT-5.6, GPT-6, GPT-6.1 and mai-code-1.1-flash 1800" | 2026-10-10 |
| F53 | GitHub's own tutorial is wrong | It says 24h for OpenAI and 1h "for most others" (sentence added 2026-06-18, never edited). Code and measurements contradict it for Claude and for GPT-5.6+. It also says cached tokens are "typically billed at 10%", but Opus 5.5 reads cost 5% | CORRECTED | https://docs.github.com/en/copilot/tutorials/optimize-ai-usage | "Caches expire after a period of inactivity (24 hours for OpenAI models and 1 hour for most others)." | live 2026-10-28 |
| F54 | VS Code extends caching for older GPT only | VS Code turned on `prompt_cache_retention: "24h"` for supported older OpenAI models. It made no TTL change for Anthropic models, whose agentic hit rate is about 94% with 4 breakpoints | VERIFIED | https://code.visualstudio.com/blogs/2026/06/17/improving-token-efficiency-in-github-copilot | "we enabled extended prompt caching for supported models through the `prompt_cache_retention` body parameter" | 2026-06-17 |
| F55 | Hosting | Claude runs on AWS, Anthropic and Google Cloud; GitHub "uses prompt caching". GPT runs on OpenAI and GitHub's Azure, under a zero-data-retention agreement with OpenAI. No TTL is stated for either | VERIFIED | https://docs.github.com/en/copilot/reference/ai-models/model-hosting | "To provide better service quality and reduce latency, GitHub uses prompt caching." | fetched 2026-10-28 |
| F56 | Visibility | github.com/settings/billing → AI usage shows credits and cost per model, **not** per request. The VS Code Cache Explorer shows hit % per turn. Copilot CLI `/usage` shows cache write tokens (since 1.0.60) | VERIFIED | https://docs.github.com/en/copilot/how-tos/manage-and-track-spending/monitor-ai-usage | "you generally cannot trace consumed credits to specific prompts, sessions, or exact features at a per-request level" | fetched 2026-10-28 |
| F57 | Legacy annual plans | Premium requests at $0.04 each. Pro 300 / Pro+ 1,500 per month. No access to new models | VERIFIED | https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/model-multipliers-for-annual-plans | "Purchase additional premium requests at $0.04/request" | fetched 2026-10-28 |

### Cursor

| ID | Fact | Value | Status | Source | Short quote | Date |
|---|---|---|---|---|---|---|
| F60 | Sold inside The X Subscription | One subscription for Grok, Cursor and X with a weekly pool for Cursor's own models; Claude and GPT sit outside the pool. Announced 2026-10-12; existing plans continue | VERIFIED | https://cursor.com/docs/models-and-pricing | "Cursor is sold as part of The X Subscription, one subscription for Grok, Cursor, and X." | fetched 2026-10-28 |
| F61 | Plans | Free $0, Plus $8, Premium $30, Super $100, Ultra $200 per month. Teams $30 / $100 / $200 per seat. Enterprise custom. Allowance refreshes weekly | VERIFIED | https://cursor.com/pricing | "We recommend Premium for new AI users, Super for daily agent users, and Ultra for power users." | fetched 2026-10-28 |
| F62 | Claude billing | Premium and above: API list price from prepaid credit, from the first request, $0 included. Plus and Free: no third-party models. Teams and Enterprise: list price + $0.25/MTok | CORRECTED | https://cursor.com/docs/models-and-pricing | "available in Cursor at the model's API list price from the first request, paid from your prepaid credit" | fetched 2026-10-28 |
| F63 | Opus 5.5 in Cursor | $4 input / $5 cache write / $0.20 read / $20 output. Fast mode $8 / $10 / $0.40 / $40. No long-context multiplier up to 1M. Regional or US-only endpoints +10% | VERIFIED | https://cursor.com/docs/models/claude-opus-5-5 | "There is no separate long-context multiplier for Opus 5.5." | fetched 2026-10-28 |
| F64 | Cursor Token Rate | +$0.25/MTok on input, output **and cached** tokens for Teams/Enterprise, including BYOK and Router routes. Exempt (list added between 2026-10-17 and 2026-10-23, no announcement; re-checked 2026-11-01): Claude Haiku 5.5 and GPT-5.6 Luna among the models here, 15 models in total; individual plans don't pay it. The rate covers cache writes too: Cursor's Pricing Policy counts "input, output, and cache (read and write)" tokens, and a measured Teams bill matches it (t3code #21408). So on Teams an Opus 5.5 read costs $0.45 and a write $5.25 | VERIFIED | https://cursor.com/help/models-and-usage/token-rate | "the rate applies to input tokens, output tokens, and cached tokens" | fetched 2026-10-28 |
| F65 | Claude TTL in Cursor | ~5 minutes, sliding (each hit extends it). Idle more than ~5 minutes means a full re-seed | VERIFIED (staff) | https://forum.cursor.com/t/understanding-write-cache/156915/5 | "If a conversation with a Claude model sits idle for more than ~5 minutes, the next turn will be a full re-seed (and a new cache write)!" | 2026-04-09 |
| F66 | GPT TTL in Cursor | GPT-5.6 gets 30 minutes; older OpenAI models up to 24 hours. 30 minutes is OpenAI's default, not its maximum (12h exists). Unknown since OpenAI's 12h option of 2026-10-20: Cursor has not said whether it requests it; its 1.25x write prices fit 30 min (inference). No measurement of GPT cache hits after a gap exists in Cursor | CORRECTED | https://forum.cursor.com/t/how-long-does-cursors-prompt-cache-persist-before-expiring/165686/7 | "in the case of GPT 5.6 it would be 30 minutes" | 2026-07-16 |
| F67 | 1-hour TTL rejected | Cursor tested a 1-hour TTL on real traffic; the average request came out slightly more expensive. No plan to change | VERIFIED (staff) | https://forum.cursor.com/t/anthropic-models-prompt-cache/171871/5 | "right now not in our plans to change" | 2026-09-16 |
| F68 | No user setting | Cache markers are placed server-side; there is no toggle | VERIFIED (staff) | https://forum.cursor.com/t/anthropic-prompt-caching/160861 | "There's no user-facing setting to enable or disable it." | 2026-05-18 |
| F69 | Legacy plans | Pro $20, Pro+ $60, Ultra $200, Teams Standard $40 / Premium $120. Two monthly pools (Cursor Models, Other Models). Individual overage at API rates with no markup; legacy Teams also pay the Token Rate. Moving to The X Subscription is permanent and drops the included Claude allowance | CORRECTED | https://cursor.com/docs/account/pricing/legacy-cursor-plans | "Switching to The X Subscription is optional and permanent." | fetched 2026-10-28 |
| F70 | Cursor's own models | Grok and Composer charge no cache write | VERIFIED (staff) | https://forum.cursor.com/t/how-long-does-cursors-prompt-cache-persist-before-expiring/165686/9 | "Cursor Grok (like Composer) doesn't charge for cache writes" | 2026-07-21 |
| F71 | GPT-5.6 Sol in Cursor | $4 / $5 write / $0.40 read / $20. Input doubles above 272K. The 272K threshold applies to all three GPT-5.6 models in Cursor (Sol, Terra, Luna; Copilot uses 200K for Luna). Default context window 272K, max 1M | VERIFIED | https://cursor.com/docs/models/gpt-5-6-sol | (pricing table) | fetched 2026-10-28 |
| F72 | Usage dashboard | One row = one user message, summing every model call. A cache expiry mid-turn shows only as a bigger Cache Write in that row (inference) . DISPUTED: another staff member (Colin, 2026-10-30, forum post 176786/4) says "a single request that involves three model calls will show three usage events" | DISPUTED (staff) + INFERENCE | https://forum.cursor.com/t/bug-report-abnormal-cache-token-counting-billing-display-issue-in-cursor-usage-dashboard/173469/6 | "Each row is one message you sent, and it adds up every model call the agent made while working on it." | 2026-10-01 |

### OpenAI (for the GPT side of Copilot and Cursor)

| ID | Fact | Value | Status | Source | Short quote | Date |
|---|---|---|---|---|---|---|
| F80 | GPT-5.6+ write charge and TTL | Writes cost 1.25x input for the default 30-minute **minimum** lifetime. Each read refreshes coverage to at least 30 minutes. Writes were free before GPT-5.6 (launched 2026-07-09) | VERIFIED | https://developers.openai.com/api/docs/guides/prompt-caching | "For GPT-5.6 and later, cache writes cost 1.25× the standard, uncached input-token rate for the default 30-minute lifetime." | fetched 2026-10-28 |
| F81 | 12-hour option | Responses API only, writes at 2.5x, launched 2026-10-20. Not available on Azure | VERIFIED | https://developers.openai.com/api/docs/changelog | "12-hour cache writes cost 2.5x the input token price." | 2026-10-20 |
| F82 | Read price | 0.1x input; 0.05x on GPT-6.1 Sol and Terra | VERIFIED | https://developers.openai.com/api/docs/guides/prompt-caching | "Subsequent reads cost 0.1× the ordinary input rate on most of these models" | fetched 2026-10-28 |
| F83 | Pre-5.6 models | No write charge. `in_memory` keeps entries about 5-10 minutes idle (max 1h); `24h` about 30 minutes (max 24h). GPT-5.5 supports 24h only | CORRECTED | https://developers.openai.com/api/docs/guides/prompt-caching | "No additional cache-write charge" | fetched 2026-10-28 |
| F84 | Azure OpenAI | GPT-5.6+: `30m` is the default and only value | VERIFIED | https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching | "The 30m value is the default and the only supported value." | 2026-08-11 |
| F85 | OpenAI API prices (input / cached / 30m write / 12h write / output) | GPT-6.1 Sol $2.00 / $0.10 / $2.50 / $5.00 / $10.00. GPT-6 Astra $10 / $1 / $12.50 / $25 / $50. GPT-5.6 Sol $4 / $0.40 / $5 / $10 / $20, a promotional price "at least through November 21, 2026" | VERIFIED | https://developers.openai.com/api/docs/pricing | "GPT-5.6 Sol's promotional pricing is available at least through November 21, 2026." | fetched 2026-10-28 |
| F86 | GPT-5.6 Sol long context | Above 272K input: 2x input and 1.5x output for the whole request | VERIFIED | https://developers.openai.com/api/docs/models/gpt-5.6-sol | "Prompts with >272K input tokens are priced at 2x input and 1.5x output for the full request." | fetched 2026-10-28 |
| F87 | Implicit mode writes every turn | The default breakpoint sits on the latest message, so each turn pays 1.25x on the tokens it adds (up to 4 writes per request) | VERIFIED | https://developers.openai.com/api/docs/guides/prompt-caching | "Each request can create up to four cache writes." | fetched 2026-10-28 |

---

## How each tool bills

### GitHub Copilot (AI credits, from 2026-06-01)

Rules for the calculator:

1. `cost_usd = Σ(tokens_category / 1,000,000 × rate_category)`. The categories are input, cached input, cache write and output. Rates are per model (F45, F46) and equal the vendor's list price (no markup).
2. `credits = cost_usd / 0.01`, because 1 credit = $0.01 (F41).
3. Each plan includes a monthly allowance (F42, F43). Beyond it, usage is billed at the same rate, and only if a budget is set (individuals) or the policy is on (orgs, default on). Credits do not carry over.
4. Claude: assume a 5-minute TTL (K1). After a gap of more than 5 minutes, the whole context is billed at the cache-write rate (1.25x input). Otherwise it is billed at the cached-input rate. New tokens each turn are cache writes.
5. GPT-5.6 and later: assume a 30-minute TTL. Write 1.25x input, read 0.1x (0.05x on GPT-6.1 Sol/Terra). GPT-5.3-Codex has no write charge: a miss costs plain input.
6. Long-context tiers switch on the input size of the request (272K for GPT-5.6 Sol and 6.1 Sol, 200K for GPT-5.6 Luna). Claude Opus 5.5 has none in Copilot.
7. Optional discounts: auto model selection -10%, Copilot Fusion -30% until 2026-11-30 (F49).
8. Plan constraint: Opus is only on Pro+ and Max (F48).

### Cursor

1. **The X Subscription (current).** Claude and GPT are billed at the API list price from prepaid credit, from the first request (F62). Premium ($30) or higher is required.
2. **Teams and Enterprise.** Add a flat $0.25/MTok on every token category, cached included (F64). Haiku 5.5 is exempt.
3. **Data residency.** Regional or US-only endpoints cost +10% (F63).
4. **Legacy plans.** Claude draws from a monthly "Other Models" pool at API price. Cursor no longer publishes the pool size in dollars (staff, 2026-09-25). Overage is at API rates.
5. **TTL.** Claude 5 minutes, not configurable (F65, F68). GPT-5.6 30 minutes (F66). Cursor's own Grok and Composer charge no cache write (F70).

### Claude Code

1. **Subscription (Pro / Max / Team / Enterprise), within plan usage.** There is no per-token charge; tokens count against the 5-hour session and weekly limits. The main conversation is on 1h, everything else on 5m (F20). Per the episode framing, the calculator assumes work fits inside the 5-hour limit. Cache misses still burn more of the limit.
2. **Subscription over the limit (usage credits).** Billed usage; the main conversation drops to 5m (F21). Whether usage credits are charged exactly at API list price was not verified in this sweep.
3. **API key / Bedrock / Google Cloud / Foundry.** Anthropic list price per token (F1-F7), 5m by default for everything. Configurable with `promptCacheTtl` / `subagentPromptCacheTtl` or `ENABLE_PROMPT_CACHING_1H=1` (F22, F23).
4. **Per-turn formula on the API.**
   - Warm turn: `prefix × read + new_tokens × write(TTL) + output × out_rate`.
   - Turn after a gap longer than the TTL: `whole_context × write(TTL) + output × out_rate`.
   - Write price: 1.25x input on the 5-minute TTL, 2x on the 1-hour TTL.

---

## Evidence wall

Every URL and quote below was re-opened by both verification passes.

| # | URL | Tool | Date | Quote | Supports / contradicts |
|---|---|---|---|---|---|
| E1 | https://github.com/microsoft/vscode/issues/321551 (comment by aguileradiego) | Copilot Chat in VS Code 1.141.0, Opus 5.5, ~540K context | 2026-10-09 | "Each pause > 5 min rewrites the whole context: ~270 credits instead of ~13, about 20× for that turn." | Supports |
| E2 | https://github.com/github/copilot-cli/issues/5220 | Copilot CLI 1.0.102-1, ~35K context | 2026-10-21 | "0% cache read (~100% cache write)" (Claude 5.5 after an 11-minute gap; GPT ~95%) | Supports (Claude 5 min, GPT longer) |
| E3 | https://github.com/xpepper/copilot-powerline/issues/82 | Copilot CLI 1.0.95 session logs, 4,458 checkpoints | 2026-10-10 | "Every Claude model is 300 s: no sign of the 1-hour cache." | Supports |
| E4 | https://github.com/xpepper/copilot-powerline/issues/67 | Copilot CLI, 32,735 calls | 2026-10-09 | "77% of GPT calls made 5 to 30 minutes after the previous one were still cached." | Supports (GPT ~30 min) |
| E5 | https://github.com/microsoft/vscode/issues/340830 | Copilot Chat in VS Code 1.141.0, Opus 5.5 | 2026-10-10 | "Every request uses the default 5 minute TTL." | Supports (even with the 1h setting on) |
| E6 | https://forum.cursor.com/t/understanding-write-cache/156915/5 | Cursor (staff, Colin) | 2026-04-09 | "If a conversation with a Claude model sits idle for more than ~5 minutes, the next turn will be a full re-seed (and a new cache write)!" | Supports |
| E7 | https://forum.cursor.com/t/anthropic-models-prompt-cache/171871/5 | Cursor (staff, Colin) | 2026-09-16 | "that extra write cost slightly outweighed the savings from fewer cache misses" | Contradicts: the vendor says 1h does not pay on average |
| E8 | https://github.com/microsoft/vscode/issues/321551 (comment by bhavyaus, VS Code team) | Copilot Chat | 2026-06-22 | "some of this is expected. a longer cache ttl might help but is also expensive based on the model." | Contradicts: the vendor defends 5 min |
| E9 | https://github.com/anthropics/claude-code/issues/103309 | Claude Code 2.1.299, Max 20x, subagents waiting on 10-15 min test runs | 2026-10-18 | "54% of my weekly limit was used in under 24 hours." | Supports the long-test scenario, and shows Claude Code subagents are on 5 min too |
| E10 | https://x.com/lydiahallie/status/2108637982005833973 | Claude Code (Anthropic staff) | 2026-10-09 | "1h on a sub, 5 mins for subagents and API billing" | Supports K5/K6, and qualifies K5 for subagents |

Reserve items, confirmed but weaker or narrower:

- https://github.com/anthropics/claude-code/issues/103673 (2026-10-20). Subscription interactive CLI on 5m since about 2026-10-14. Quote: "Main conversation cache expires after 5 minutes idle, including while waiting on background subagents."
- https://news.ycombinator.com/item?id=50148558 (viccis, 2026-10-19). Quote: "their constant waits for ~10 min tests or similar tasks would destroy my 5h usage".
- https://github.com/github/copilot-cli/issues/3808 (ntvf, 2026-10-12). Replaying 30 days with a 1h TTL gave "about 8% fewer AI credits, even after paying the 2× write price". The vendor-neutral size of the effect.

---

## Remedy guidance from sources

**Anthropic (API docs)**

- Choose the TTL when a conversation starts; switching later costs one full re-write (F18).
- Use 1 hour once about 1 turn in 20 follows a 5-60 minute pause. With no pauses, stay on 5 minutes (F15).
- Use 1 hour for agentic side-agents that take longer than 5 minutes (F9).
- Put 1-hour breakpoints on the stable prefix before 5-minute ones (F9).
- Keep-alive: re-send the identical request with `max_tokens: 0` every 4 minutes (F14). This only works in your own API harness, not in Copilot, Cursor or Claude Code. On Opus 5.5 it beats the 1-hour TTL only when 1-2 gaps in 20 are paused and none runs past ~30 minutes.

**Claude Code team**

- Never change tools or the model mid-session. Use subagents to switch models. The team treats a drop in cache hit rate as an incident. Source: https://claude.dev/blog/lessons-from-building-claude-code-prompt-caching-is-everything/ (2026-04-30).
- Claude Code docs:
  - Set `subagentPromptCacheTtl: "1h"` for subagents that wait on long jobs (F22).
  - Check live with `/usage` (F27).
  - Idle compaction avoids an uncached cold `/compact` (F24).
  - `/rewind` keeps the cache (F28).
- Long-running work: hand off through a progress file plus git history instead of relying on compaction. Source: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents (2025-11-26).
- Anthropic warns that "overly aggressive compaction can result in the loss of subtle but critical context". Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents (2025-09-29).

**GitHub (optimize-ai-usage tutorial)**

- Don't switch models, effort, context size or tools/MCP servers mid-session.
- After time away, start a new session or run `/compact` in Copilot CLI.
- Run subagents on cheaper models.
- Copilot Fusion keeps one model and gives -30%.
- The TTL figures on that same page are wrong (F53).

**VS Code (experimental, off by default)**

- `extendedTtl` + `extendedTtlMessages` give 1h, but not on Claude 5.x until PR #340831 lands (F50).
- `longToolCallCachePreservation` is a keep-alive for execution-subagent tool calls only (F51).

**Cursor staff**

- Keep the early part of the conversation stable.
- Switching models, editing an earlier message or toggling tools/rules re-seeds the cache even inside 5 minutes. Source: https://forum.cursor.com/t/understanding-write-cache/156915/5.

**OpenAI**

- Give the stable prefix a `12h` breakpoint and session context `30m`.
- Explicit mode with no breakpoints turns caching (and write charges) off (F87; source: OpenAI prompt-caching guide).

---

## Refuted or corrected

| What was claimed | Correct value | Source |
|---|---|---|
| GitHub tutorial: caches last "24 hours for OpenAI models and 1 hour for most others" | Claude in Copilot is 5 minutes (code + logs). GPT-5.6+ is a 30-minute minimum. Only older GPT models get 24h retention (VS Code blog). | F50, F52, F53, F54 |
| GitHub tutorial: cached tokens "typically billed at 10%" | 5% on Opus 5.5 and Sonnet 5.5; 2.5% on Fable 5.1 | F7 |
| Copilot pricing note implies only Anthropic models have a cache-write cost | GPT-5.6 and later also bill cache writes at 1.25x | F46, F80 |
| "Pro covers ~15 Opus 5.5 re-writes" | Opus is not on Copilot Pro. At 200K: Pro+ (7,000 credits) ≈ 70 re-writes, Max (20,000) ≈ 200; Sonnet 5.5 on Pro ≈ 30 | F48 |
| VS Code `extendedTtl` gives the conversation 1 hour | It covers tools and system only; messages need `extendedTtlMessages`. Its model gate covers Fable 5, Opus 4.5-4.8, Sonnet 4.5/4.6 and Haiku 4.5, not Claude 5.x | F50 |
| VS Code fix PR #340831 "open as of 2026-10-10" | Still open and unmerged on 2026-10-28 | F50 |
| #322775 is an "internal" VS Code issue | It is a public issue (P0, open), framed around GitHub's own cost of serving | https://github.com/microsoft/vscode/issues/322775 |
| Cursor: GPT-5.6 30 minutes is the provider maximum | It is OpenAI's default; a 12-hour option exists at 2.5x write | F66, F81 |
| Cursor: Claude at "API list price" on all current plans | Individual plans only; Teams/Enterprise add $0.25/MTok | F62, F64 |
| Cursor legacy overage "no markup" for all | Legacy Teams also pay the Token Rate | F69 |
| Cursor: "one long pause already makes 1h cheaper" | Only if the pause lands at ≥62.5% of the final context (≥125K of 200K) and lasts 5-60 minutes | own arithmetic from F1 |
| Anthropic context windows: "Opus 4.5 and other older models have 200K" | Sonnet 4.6, Sonnet 5 and Fable 5 (legacy) have 1M; 200K is Opus 4.5, Sonnet 4.5, Haiku 4.5 | F6 |
| Anthropic keep-alive = "empty ping", 8-18% cheaper | It re-sends the full previous request with `max_tokens: 0`. It is 8-13% cheaper at default effort (8-18% only across medium and high) | F14, F16 |
| Claude Code idle-compaction quote sourced to settings-reference | The `200000` default quote is on the env-vars page; values below 100,000 are raised to 100,000 | https://code.claude.com/docs/en/env-vars |
| Claude Code `ENABLE_PROMPT_CACHING_1H` "since v2.1.242" | Added in v2.1.108 (2026-04-14); only the per-bucket settings date from 2.1.242/243 | F23 |
| March 2026 "silent regression from 1h to 5m" (#46829) with no official confirmation | Staff said the per-request TTL selection was deliberate (subagents moved to 5m). Two related client bugs were fixed in v2.1.108 and v2.1.129. The reporter later retracted his cost figure. The 165 thumbs-down went to the vendor reply, not a rebuttal | https://github.com/anthropics/claude-code/issues/46829 |
| Claude Code: denying a tool always breaks the cache | Only when tool search is off; the effort exception applies per model and per provider | F28 |
| "Cache writes dominate cost" (#6857) | Writes were 1.9% of tokens but 33.6% of cost: disproportionate, not dominant (reads were 45.6%) | https://github.com/anthropics/claude-plugins-official/issues/6857 |
| #97758: orchestrator waits of 42/44 min were costly | Both were still cache hits on the 1h TTL; $7.20 is the projected cost for a wait over 60 min | https://github.com/anthropics/claude-code/issues/97758 |
| HN (2026-05-31): "you cannot pay OpenAI for a longer cache", so it contradicts 30 min | Outdated. GPT-5.6+ defaults to 30m and offers a paid 12h; this supports K2 | F80, F81 |
| GPT-5.6 Sol cache write is "half the Opus rate" | GPT-5.6 Sol write $5.00 = Opus 5.5; only GPT-6 / 6.1 Sol ≤272K write at $2.50 | F46 |
| OpenAI: 30-minute window "guarantees" the read price | It makes an identical ≥1,024-token prefix *eligible* for the read price; reuse and speed are not promised | F80 |
| Azure: "older models default to in-memory" | gpt-5.4 and older do; gpt-5.5 has 24h on by default | F84 |
| Claude Code API skill bundled 2026-10-06: Sonnet 5.5 read $0.20 | **Bug in that skill:** the live price is $0.10 since 2026-10-07 | F2 |
| claude-thermos labelled "(API key)" | The README does not say how the sessions were billed | https://github.com/izeigerman/claude-thermos |
| Copilot Desktop comment (github/app #3688) as proof of a 5-minute hosted TTL | The parent issue is about a BYOK custom provider; ambiguous single anecdote | https://github.com/github/app/issues/3688 |

---

## Open questions

1. **Does Copilot bill a 1-hour Claude write at 2x?** The rate table lists only the 1.25x price. One community user (copilot-cli #3808) saw about 2x on Sonnet 5.5 when a third-party client requested 1h. No GitHub statement exists.
2. **Context window of Opus 5.5 in Copilot.** It is not verified. A 540K session proves it is larger than 200K, but 1M is not confirmed.
3. **Is the VS Code `onExp` experiment live for some users?** GitHub can enable `extendedTtl` server-side, but there is no public rollout data. It would not cover Claude 5.x anyway until PR #340831 merges.
4. **Claude Code subscription regression (#103673, open since 2026-10-20).** Interactive sessions write 5m caches; a commenter saw it from 2026-10-14 on 2.1.294, which points to a server-side cause. Before recording, Krystian should check his own transcripts (`ephemeral_1h_input_tokens`) or set `"promptCacheTtl": "1h"`. This takes about 1 minute.
5. **Team/Enterprise seats.** The docs say "Claude subscription within your plan's included usage" without naming Team/Enterprise. The 1h behaviour there rests on user reports (shajz, Team seat).
6. **Usage-credit rate on a Claude subscription over the limit.** It was not verified whether this equals API list price.
7. **GPT-5.3-Codex TTL in Copilot CLI.** VS Code requests 24h, but which retention the CLI requests is undocumented (the ZDR default would be 5-10 min).
8. **Cursor: one tool call longer than 5 minutes.** Staff say "every tool call and model step is a hit", but no model call happens while a long test runs. By inference the cache expires; no source confirms it.
9. **Copilot flex allotment** is officially variable. Recheck Pro 1,500 / Pro+ 7,000 / Max 20,000 on recording day. The Business $30 / Enterprise $70 promotion (June-August) has no end notice.
10. **Opus 4.7 minimum prefix.** Anthropic says 2,048, Bedrock says 4,096. It is irrelevant for large contexts.
11. **Copilot routing across three Claude hosts.** If a request lands on a different host, the cache plausibly misses. This is a hypothesis; it is not documented.
12. **Idle-compaction timing.** The changelog says ~54 minutes, the docs say "about an hour"; the key needs v2.1.290 while the feature shipped in 2.1.299. Say "about an hour" and "v2.1.299" on camera.
