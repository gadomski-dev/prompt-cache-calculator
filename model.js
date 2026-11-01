/*
 * Prompt cache TTL cost model. Pure functions only: no DOM, no network.
 * Works as a browser global (window.CacheModel) and as a Node module (module.exports).
 *
 * All money is USD. Prices are USD per million tokens (MTok).
 * Constants are copied from research/constants.json (as_of 2026-10-28), with their
 * status and the fact ids from research/facts.md. file:// cannot fetch JSON, hence the copy.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CacheModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MTOK = 1000000;
  var AS_OF = '2026-10-28';

  // ---------------------------------------------------------------------------
  // Constants copied from constants.json
  // ---------------------------------------------------------------------------

  var MODELS = [
    {
      id: 'claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'anthropic',
      input_per_mtok: 4.0, output_per_mtok: 20.0,
      cache_write_5m_per_mtok: 5.0, cache_write_1h_per_mtok: 8.0, cache_read_per_mtok: 0.2,
      cache_write_per_mtok_if_no_ttl_choice: 5.0,
      context_window: 1000000, long_context: null,
      status: 'verified', fact_ids: ['F1', 'F6', 'F7', 'F45', 'F63'],
      note: 'Same rates on Anthropic API, Copilot and Cursor (individual). Copilot exposes only the 5m write price. Context window inside Copilot is unverified (a 540K session was measured). Tokenizer of 4.7+ models produces ~30% more tokens than Opus 4.6/4.5 for the same text (F11).'
    },
    {
      id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic',
      input_per_mtok: 2.0, output_per_mtok: 10.0,
      cache_write_5m_per_mtok: 2.5, cache_write_1h_per_mtok: 4.0, cache_read_per_mtok: 0.1,
      cache_write_per_mtok_if_no_ttl_choice: 2.5,
      context_window: 1000000, long_context: null,
      status: 'verified', fact_ids: ['F2', 'F6', 'F7', 'F45'],
      note: 'Cache read cut from 0.20 to 0.10 on 2026-10-07. Available on Copilot Pro.'
    },
    {
      id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', provider: 'anthropic',
      input_per_mtok: 0.1, output_per_mtok: 0.5,
      cache_write_5m_per_mtok: 0.125, cache_write_1h_per_mtok: 0.2, cache_read_per_mtok: 0.01,
      cache_write_per_mtok_if_no_ttl_choice: 0.125,
      context_window: 1000000,
      long_context: {
        threshold_tokens: 100000, input_per_mtok: 0.5, output_per_mtok: 2.5,
        cache_write_5m_per_mtok: 0.625, cache_write_1h_per_mtok: 1.0, cache_read_per_mtok: 0.05
      },
      status: 'verified', fact_ids: ['F3', 'F6'],
      note: 'Threshold counts all input tokens including cache reads and writes; each request priced on its own.'
    },
    {
      id: 'claude-fable-5-1', label: 'Claude Fable 5.1', provider: 'anthropic',
      input_per_mtok: 10.0, output_per_mtok: 50.0,
      cache_write_5m_per_mtok: 12.5, cache_write_1h_per_mtok: 20.0, cache_read_per_mtok: 0.25,
      cache_write_per_mtok_if_no_ttl_choice: 12.5,
      context_window: 1000000, long_context: null,
      status: 'verified', fact_ids: ['F4', 'F6', 'F7', 'F45'],
      note: 'Read is 0.025x input. Not on Copilot Pro.'
    },
    {
      id: 'claude-opus-5', label: 'Claude Opus 5 (legacy)', provider: 'anthropic',
      input_per_mtok: 5.0, output_per_mtok: 25.0,
      cache_write_5m_per_mtok: 6.25, cache_write_1h_per_mtok: 10.0, cache_read_per_mtok: 0.5,
      cache_write_per_mtok_if_no_ttl_choice: 6.25,
      context_window: 1000000, long_context: null,
      status: 'verified', fact_ids: ['F5', 'F6', 'F45'],
      note: 'Same prices as Opus 4.8 / 4.7 / 4.6 / 4.5.'
    },
    {
      id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (legacy)', provider: 'anthropic',
      input_per_mtok: 5.0, output_per_mtok: 25.0,
      cache_write_5m_per_mtok: 6.25, cache_write_1h_per_mtok: 10.0, cache_read_per_mtok: 0.5,
      cache_write_per_mtok_if_no_ttl_choice: 6.25,
      context_window: 1000000, long_context: null,
      status: 'verified', fact_ids: ['F5', 'F6', 'F45'],
      note: 'Eligible for the experimental 1h TTL in VS Code Copilot (off by default).'
    },
    {
      id: 'claude-opus-4-5', label: 'Claude Opus 4.5 (legacy)', provider: 'anthropic',
      input_per_mtok: 5.0, output_per_mtok: 25.0,
      cache_write_5m_per_mtok: 6.25, cache_write_1h_per_mtok: 10.0, cache_read_per_mtok: 0.5,
      cache_write_per_mtok_if_no_ttl_choice: 6.25,
      context_window: 200000, long_context: null,
      status: 'verified', fact_ids: ['F5', 'F6'],
      note: 'Older tokenizer: same text is ~30% fewer tokens than on Opus 4.7+.'
    },
    {
      id: 'gpt-5-6-sol', label: 'GPT-5.6 Sol', provider: 'openai',
      input_per_mtok: 4.0, output_per_mtok: 20.0,
      cache_write_5m_per_mtok: null, cache_write_1h_per_mtok: null, cache_read_per_mtok: 0.4,
      cache_write_per_mtok_if_no_ttl_choice: 5.0,
      cache_write_30m_per_mtok: 5.0, cache_write_12h_per_mtok: 10.0,
      context_window: null,
      long_context: {
        threshold_tokens: 272000, input_per_mtok: 8.0, output_per_mtok: 30.0,
        cache_write_5m_per_mtok: null, cache_write_1h_per_mtok: null, cache_read_per_mtok: 0.8,
        cache_write_per_mtok_if_no_ttl_choice: 10.0, cache_write_12h_per_mtok: 20.0
      },
      status: 'verified', fact_ids: ['F46', 'F71', 'F80', 'F85', 'F86'],
      note: 'Writes are 1.25x input for the default 30-minute minimum lifetime (12h option at 2.5x, Responses API only, not used by Copilot per its price table). Promotional price at least through 2026-11-21. Context window not verified, so null.'
    },
    {
      id: 'gpt-6-1-sol', label: 'GPT-6.1 Sol', provider: 'openai',
      input_per_mtok: 2.0, output_per_mtok: 10.0,
      cache_write_5m_per_mtok: null, cache_write_1h_per_mtok: null, cache_read_per_mtok: 0.1,
      cache_write_per_mtok_if_no_ttl_choice: 2.5,
      cache_write_30m_per_mtok: 2.5, cache_write_12h_per_mtok: 5.0,
      context_window: null,
      // Long-context row above 272K: 4.00 / 0.20 / 5.00 / 15.00, published in both the Copilot price
      // table and the OpenAI API price list (both checked 2026-10-30).
      long_context: {
        threshold_tokens: 272000, input_per_mtok: 4.0, output_per_mtok: 15.0,
        cache_write_5m_per_mtok: null, cache_write_1h_per_mtok: null, cache_read_per_mtok: 0.2,
        cache_write_per_mtok_if_no_ttl_choice: 5.0, cache_write_30m_per_mtok: 5.0
      },
      status: 'verified', fact_ids: ['F46', 'F82', 'F85'],
      note: 'Read is 0.05x. Above 272K: 4.00 / 0.20 / 5.00 / 15.00 (Copilot price table and OpenAI API price list, checked 2026-10-30).'
    },
    {
      id: 'gpt-6-astra', label: 'GPT-6 Astra', provider: 'openai',
      input_per_mtok: 10.0, output_per_mtok: 50.0,
      cache_write_5m_per_mtok: null, cache_write_1h_per_mtok: null, cache_read_per_mtok: 1.0,
      cache_write_per_mtok_if_no_ttl_choice: 12.5,
      cache_write_30m_per_mtok: 12.5, cache_write_12h_per_mtok: 25.0,
      context_window: null, long_context: null,
      status: 'unverified', fact_ids: ['F85'],
      note: 'OpenAI API list price verified; the Copilot row for this model was not checked.'
    },
    {
      id: 'gpt-5-6-luna', label: 'GPT-5.6 Luna', provider: 'openai',
      input_per_mtok: 0.2, output_per_mtok: 1.2,
      cache_write_5m_per_mtok: null, cache_write_1h_per_mtok: null, cache_read_per_mtok: 0.02,
      cache_write_per_mtok_if_no_ttl_choice: 0.25,
      context_window: null,
      long_context: {
        threshold_tokens: 200000, input_per_mtok: 0.4, output_per_mtok: 1.8,
        cache_write_5m_per_mtok: null, cache_write_1h_per_mtok: null, cache_read_per_mtok: 0.04,
        cache_write_per_mtok_if_no_ttl_choice: 0.5
      },
      status: 'verified', fact_ids: ['F46'],
      note: 'Long-context threshold is 200K in Copilot and 272K in Cursor (the Cursor profiles override it). Same rates in both.'
    },
    {
      id: 'gpt-5-3-codex', label: 'GPT-5.3-Codex', provider: 'openai',
      input_per_mtok: 1.75, output_per_mtok: 14.0,
      cache_write_5m_per_mtok: null, cache_write_1h_per_mtok: null, cache_read_per_mtok: 0.175,
      cache_write_per_mtok_if_no_ttl_choice: 1.75,
      context_window: null, long_context: null,
      status: 'verified', fact_ids: ['F46', 'F83'],
      note: 'Pre-5.6 model: no cache-write surcharge, a miss costs plain input. Deprecated on the OpenAI API. TTL in Copilot depends on retention requested (VS Code: 24h; CLI: unverified). In Cursor: hidden by default, 272K context window.'
    }
  ];

  // Cursor facts shared by both Cursor profiles (cursor.com/docs, fetched 2026-11-01).
  var CURSOR_OFFERED_TTLS = { anthropic: [5], openai: [30] }; // F65, F67, F68: no TTL setting, 1 h rejected
  var CURSOR_VERIFIED_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1',
    'claude-opus-5', 'claude-opus-4-8', 'gpt-5-6-sol', 'gpt-5-6-luna', 'gpt-5-3-codex'];
  var CURSOR_NOT_OFFERED = ['claude-opus-4-5', 'gpt-6-1-sol', 'gpt-6-astra'];
  var CURSOR_LC_THRESHOLDS = { 'gpt-5-6-luna': 272000 }; // Copilot uses 200K
  // Default context window and the largest one Cursor offers ("Context window" / "Max context" on each model page).
  var CURSOR_CONTEXT_WINDOWS = {
    'claude-opus-5-5': { def: 300000, max: 1000000 },
    'gpt-5-6-sol': { def: 272000, max: 1000000 },
    'gpt-5-6-luna': { def: 272000, max: 1000000 },
    'gpt-5-3-codex': { def: 272000, max: 272000 }
  };
  // OpenAI, 2026-08-28: "a proposed shutoff date of November 12, 2026" for OpenAI models in Cursor.
  var CURSOR_GPT_SHUTOFF = '2026-11-12';

  var PROFILES = [
    {
      id: 'claude-code-subscription', short: 'Claude Code, subscription',
      label: 'Claude Code on a Claude subscription (within plan usage)',
      tool: 'claude-code', billing: 'subscription', usd_per_credit: null,
      ttl_minutes: { anthropic: 60, openai: null }, ttl_minutes_subagents: 5,
      flat_surcharge_per_mtok: 0, ttl_configurable: true, verified_models: null,
      status: 'verified', fact_ids: ['F20', 'F21', 'F22', 'F23', 'F24', 'F25'],
      note: '60 applies to the main conversation only. Subagents, workflows/ultracode agents, teammates, forks and compaction get 5 unless subagentPromptCacheTtl is "1h". Open regression #103673: interactive CLI writing 5m since about 2026-10-14, so check ephemeral_1h_input_tokens or set promptCacheTtl "1h".'
    },
    {
      id: 'claude-code-api-5m', short: 'Claude Code, API key, 5 min',
      label: 'Claude Code with API key, default 5-minute TTL',
      tool: 'claude-code', billing: 'usd_per_token', usd_per_credit: null,
      ttl_minutes: { anthropic: 5, openai: null }, ttl_minutes_subagents: 5,
      flat_surcharge_per_mtok: 0, ttl_configurable: true, verified_models: null,
      status: 'verified', fact_ids: ['F1', 'F7', 'F8', 'F10', 'F20', 'F22'],
      note: 'Default for API key, Bedrock, Google Cloud and Foundry. US-only inference adds 1.1x to every category (F12).'
    },
    {
      id: 'claude-code-api-1h', short: 'Claude Code, API key, 1 h',
      label: 'Claude Code with API key, 1-hour TTL',
      tool: 'claude-code', billing: 'usd_per_token', usd_per_credit: null,
      ttl_minutes: { anthropic: 60, openai: null }, ttl_minutes_subagents: 60,
      flat_surcharge_per_mtok: 0, ttl_configurable: true, verified_models: null,
      status: 'verified', fact_ids: ['F1', 'F7', 'F9', 'F15', 'F22', 'F23'],
      note: 'Set promptCacheTtl and subagentPromptCacheTtl to "1h", or ENABLE_PROMPT_CACHING_1H=1. With no pauses the 5m default is 15-19% cheaper. Choose at conversation start.'
    },
    {
      id: 'cursor-claude', short: 'Cursor, individual',
      label: 'Cursor (individual Premium/Super/Ultra) with Claude or GPT',
      tool: 'cursor', billing: 'usd_per_token', usd_per_credit: null,
      ttl_minutes: { anthropic: 5, openai: 30 },
      // Lifetimes the user can actually get in this tool; any other tile in the TTL strip is hypothetical.
      offered_ttls: CURSOR_OFFERED_TTLS,
      flat_surcharge_per_mtok: 0, ttl_configurable: false,
      // Cursor's Models & Pricing table (fetched 2026-11-01) lists these at the same rates as model.js.
      verified_models: CURSOR_VERIFIED_MODELS,
      // Not in Cursor's model table: GPT-6 / 6.1 (OpenAI gives Cursor no new models, docs pages 404), Opus 4.5.
      not_offered: CURSOR_NOT_OFFERED,
      lc_threshold_override: CURSOR_LC_THRESHOLDS,
      context_windows: CURSOR_CONTEXT_WINDOWS,
      gpt_shutoff: CURSOR_GPT_SHUTOFF,
      ttl_source: 'staff', // F65, F66: forum posts by Cursor staff, not docs
      status: 'verified', fact_ids: ['F62', 'F63', 'F65', 'F66', 'F67', 'F68'],
      note: 'TTL comes from staff forum posts, not docs. openai 30 is for GPT-5.6 (staff, July 2026); since 2026-10-20 OpenAI also offers 12 hours and Cursor has not said whether it uses it (its 1.25x write price fits 30 min). Older OpenAI models "24 hours" per staff, which OpenAI calls a ceiling, typically about 30 min. Regional/US-only endpoints +10%. Legacy Pro/Pro+/Ultra plans include an Other Models allowance that is not modelled.'
    },
    {
      id: 'cursor-teams-claude', short: 'Cursor, Teams/Enterprise',
      label: 'Cursor Teams/Enterprise with Claude or GPT',
      tool: 'cursor', billing: 'usd_per_token', usd_per_credit: null,
      ttl_minutes: { anthropic: 5, openai: 30 },
      offered_ttls: CURSOR_OFFERED_TTLS,
      // Cursor Token Rate exclusion list (models-and-pricing, fetched 2026-11-01): of the models here, Haiku 5.5 and GPT-5.6 Luna.
      flat_surcharge_per_mtok: 0.25, surcharge_exempt_models: ['claude-haiku-5-5', 'gpt-5-6-luna'], ttl_configurable: false,
      verified_models: CURSOR_VERIFIED_MODELS,
      not_offered: CURSOR_NOT_OFFERED,
      lc_threshold_override: CURSOR_LC_THRESHOLDS,
      context_windows: CURSOR_CONTEXT_WINDOWS,
      gpt_shutoff: CURSOR_GPT_SHUTOFF,
      // Unconfirmed lead (one research pass, 2026-11-01): Cursor's client code defines a per-team Claude cache
      // setting STANDARD_5M / EXTENDED_1H since build 2026.08.04. No doc or staff post mentions it, so it is not modelled.
      ttl_source: 'staff',
      status: 'verified', fact_ids: ['F64', 'F65', 'F66'],
      note: 'API list price plus a flat 0.25 USD per million tokens on input, output, cache reads and cache writes. Haiku 5.5 and GPT-5.6 Luna exempt.'
    },
    {
      id: 'copilot-claude', short: 'Copilot AI credits, Claude',
      label: 'GitHub Copilot (AI credits) with Claude',
      tool: 'copilot', billing: 'ai_credits', usd_per_credit: 0.01,
      ttl_minutes: { anthropic: 5, openai: 30 },
      flat_surcharge_per_mtok: 0, ttl_configurable: false,
      included_credits: { pro: 1500, pro_plus: 7000, max: 20000, business_per_user: 1900, enterprise_per_user: 3900 },
      // F45 (Claude rates) and F46 (GPT rates) in the Copilot price table. Haiku 5.5, Opus 4.5 and GPT-6 Astra are not in it.
      verified_models: ['claude-opus-5-5', 'claude-opus-5', 'claude-opus-4-8', 'claude-sonnet-5-5', 'claude-fable-5-1',
        'gpt-5-6-sol', 'gpt-6-1-sol', 'gpt-5-6-luna', 'gpt-5-3-codex'],
      not_on_pro: ['claude-opus-5-5', 'claude-opus-5', 'claude-opus-4-8', 'claude-fable-5-1'], // F48
      ttl_source: 'client', // K1, K2, F52: VS Code source and Copilot CLI logs, not GitHub docs (F53 says 1 h)
      status: 'verified', fact_ids: ['F40', 'F41', 'F42', 'F43', 'F44', 'F45', 'F47', 'F48', 'F50', 'F52', 'F53'],
      note: '5 min is from VS Code source and Copilot CLI logs, not stated by GitHub (GitHub\'s tutorial wrongly says 1h). Opus models only on Pro+ and Max.'
    },
    {
      id: 'copilot-gpt', short: 'Copilot AI credits, GPT',
      label: 'GitHub Copilot (AI credits) with GPT-5.6 or later',
      tool: 'copilot', billing: 'ai_credits', usd_per_credit: 0.01,
      ttl_minutes: { anthropic: null, openai: 30 },
      flat_surcharge_per_mtok: 0, ttl_configurable: false,
      included_credits: { pro: 1500, pro_plus: 7000, max: 20000, business_per_user: 1900, enterprise_per_user: 3900 },
      verified_models: ['gpt-5-6-sol', 'gpt-6-1-sol', 'gpt-5-6-luna', 'gpt-5-3-codex'], // F46
      ttl_source: 'client',
      status: 'verified', fact_ids: ['F41', 'F46', 'F52', 'F54', 'F80', 'F84'],
      note: '30 is a minimum lifetime refreshed on each read (OpenAI docs), matched by Copilot CLI logs (1800 s); GitHub does not state it. For GPT-5.3-Codex VS Code requests 24h retention; CLI behaviour unverified.'
    }
  ];

  // Assumptions that are not vendor facts: the calculator's own estimate of what one poll adds.
  var ASSUMPTIONS = {
    pollOutputTokens: { value: 200, status: 'assumption', source: 'Our estimate: a short poll turn adds about 200 output tokens' },
    pollNewInputTokens: { value: 300, status: 'assumption', source: 'Our estimate: a short poll turn adds about 300 new input tokens' },
    // 4 minutes is the interval of Anthropic's API keep-alive (F14). F14's keep-alive bills only C x read;
    // the agent poll priced here also pays its output and new input, because Copilot, Cursor and Claude Code
    // cannot send an F14 keep-alive.
    heartbeatMinutes: { value: 4, status: 'verified', source: 'F14: Anthropic keep-alive re-sends the request every 4 minutes' },
    // F8: the TTL runs from the START of the previous request, so the generation time of that turn counts.
    generationMinutes: { value: 1, status: 'assumption', source: 'F8: the TTL is measured from the start of the request; about 1 minute of generation per agent turn is an assumption' },
    // E4 (243 of 314 GPT calls, one account, copilot-powerline #67): 77% of GPT calls 5-30 min after the previous one were still cached.
    // E2: about 95% after an 11-minute gap. F80: 30 min is a minimum eligibility window, not a guarantee.
    gptHitPct: { value: 77, status: 'community', source: 'E4: 77% of GPT calls 5-30 min after the previous one were cached (243 of 314 GPT calls, one account, copilot-powerline #67); E2: ~95% after 11 min. Both measured in Copilot; no measurement exists for Cursor' }
  };

  /** Gaps up to this many minutes count as a sure hit on GPT; above it, up to the TTL, the hit rate applies. */
  var GPT_SURE_WARM_MIN = 5;

  var SCENARIOS = [
    { id: 's1', name: 'Break' },
    { id: 's2', name: 'Reading the answer' },
    { id: 's3', name: 'Long tool call' },
    { id: 's4', name: 'Orchestrator waiting on subagents' },
    { id: 's5', name: 'Parallel agents in worktrees' },
    { id: 's6', name: 'Monthly budget' },
    { id: 'strip', name: 'TTL comparison' }
  ];

  function findModel(id) {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i];
    return null;
  }
  function findProfile(id) {
    for (var i = 0; i < PROFILES.length; i++) if (PROFILES[i].id === id) return PROFILES[i];
    return null;
  }

  /** Models a profile can run: those whose provider has a TTL in the profile, minus the ones the tool does not offer. */
  function allowedModels(profileId) {
    var p = findProfile(profileId);
    if (!p) return [];
    return MODELS.filter(function (m) {
      return p.ttl_minutes[m.provider] != null && (p.not_offered || []).indexOf(m.id) < 0;
    });
  }

  /**
   * Notice shown when a profile + model pair will stop working on a known date (Cursor + GPT: OpenAI ends
   * its contract with Cursor). null when there is nothing to say.
   */
  function shutoffNotice(profileId, modelId) {
    var p = findProfile(profileId);
    var m = findModel(modelId);
    if (!p || !m || !p.gpt_shutoff || m.provider !== 'openai') return null;
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var d = p.gpt_shutoff.split('-');
    return 'As announced by OpenAI, Cursor will no longer offer GPT models from ' + MONTHS[+d[1] - 1] + ' ' + (+d[2]) + ', ' + d[0] + '.';
  }

  function defaultModelFor(profileId) {
    var allowed = allowedModels(profileId);
    for (var i = 0; i < allowed.length; i++) {
      if (allowed[i].id === 'claude-opus-5-5' || allowed[i].id === 'gpt-5-6-sol') return allowed[i].id;
    }
    return allowed.length ? allowed[0].id : null;
  }

  // ---------------------------------------------------------------------------
  // Preset resolution: profile + model -> editable rate fields
  // ---------------------------------------------------------------------------

  /** Write price of one price tier for a TTL. Providers without a TTL write tier write at base input. */
  function writePriceOfTier(tier, provider, ttlMinutes) {
    if (provider === 'anthropic') {
      return ttlMinutes >= 60 ? tier.cache_write_1h_per_mtok : tier.cache_write_5m_per_mtok;
    }
    if (tier.cache_write_30m_per_mtok != null) return tier.cache_write_30m_per_mtok;
    if (tier.cache_write_per_mtok_if_no_ttl_choice != null) return tier.cache_write_per_mtok_if_no_ttl_choice;
    return tier.input_per_mtok;
  }

  function round6(x) { return Math.round(x * 1e6) / 1e6; }

  /**
   * Rate fields for a profile + model pair. Every field becomes an editable input in the UI.
   * Keys: r.input, r.output, r.read, r.writeMain, r.writeSub, r.write5m, r.write1h, r.ttlMain, r.ttlSub,
   * r.usdPerCredit, r.lcThreshold, r.lcInput, r.lcOutput, r.lcRead, r.lcWriteMain, r.lcWriteSub,
   * r.lcWrite5m, r.lcWrite1h, g.window.
   */
  function presetFields(profileId, modelId) {
    var p = findProfile(profileId);
    var m = findModel(modelId);
    if (!p || !m) throw new Error('Unknown profile or model: ' + profileId + ' / ' + modelId);
    var exempt = (p.surcharge_exempt_models || []).indexOf(m.id) >= 0;
    var s = exempt ? 0 : (p.flat_surcharge_per_mtok || 0);
    var ttlMain = p.ttl_minutes[m.provider];
    if (ttlMain == null) ttlMain = 5;
    var ttlSub = p.ttl_minutes_subagents != null && m.provider === 'anthropic' ? p.ttl_minutes_subagents : ttlMain;
    function plus(x) { return x != null ? round6(x + s) : null; }
    var f = {
      'r.input': round6(m.input_per_mtok + s),
      'r.output': round6(m.output_per_mtok + s),
      'r.read': round6(m.cache_read_per_mtok + s),
      'r.writeMain': round6(writePriceOfTier(m, m.provider, ttlMain) + s),
      'r.writeSub': round6(writePriceOfTier(m, m.provider, ttlSub) + s),
      'r.write5m': plus(m.cache_write_5m_per_mtok),
      'r.write1h': plus(m.cache_write_1h_per_mtok),
      'r.ttlMain': ttlMain,
      'r.ttlSub': ttlSub,
      'r.usdPerCredit': p.usd_per_credit,
      'r.lcThreshold': null, 'r.lcInput': null, 'r.lcOutput': null, 'r.lcRead': null,
      'r.lcWriteMain': null, 'r.lcWriteSub': null, 'r.lcWrite5m': null, 'r.lcWrite1h': null,
      'g.window': p.context_windows && p.context_windows[m.id] ? p.context_windows[m.id].max
        : (m.context_window != null ? m.context_window : 1000000)
    };
    if (m.long_context) {
      var lc = m.long_context;
      f['r.lcThreshold'] = p.lc_threshold_override && p.lc_threshold_override[m.id] != null ? p.lc_threshold_override[m.id] : lc.threshold_tokens;
      f['r.lcInput'] = round6(lc.input_per_mtok + s);
      f['r.lcOutput'] = round6(lc.output_per_mtok + s);
      f['r.lcRead'] = round6(lc.cache_read_per_mtok + s);
      f['r.lcWriteMain'] = round6(writePriceOfTier(lc, m.provider, ttlMain) + s);
      f['r.lcWriteSub'] = round6(writePriceOfTier(lc, m.provider, ttlSub) + s);
      f['r.lcWrite5m'] = plus(lc.cache_write_5m_per_mtok);
      f['r.lcWrite1h'] = plus(lc.cache_write_1h_per_mtok);
    }
    return f;
  }

  var RATE_FIELDS = ['r.input', 'r.output', 'r.read', 'r.writeMain', 'r.writeSub', 'r.write5m', 'r.write1h'];
  var LC_RATE_FIELDS = ['r.lcInput', 'r.lcOutput', 'r.lcRead', 'r.lcWriteMain', 'r.lcWriteSub', 'r.lcWrite5m', 'r.lcWrite1h'];

  /**
   * Status of each preset field for the badges. Returns { key: { status, badge, note, facts } } for the
   * fields that need one. status 'unverified' = no primary source for this value in this tool;
   * status 'source' = the value is sourced, but not from the vendor's own docs (badge text says from where).
   */
  function fieldStatus(profileId, modelId) {
    var p = findProfile(profileId);
    var m = findModel(modelId);
    var out = {};
    if (!p || !m) return out;
    function unv(note, facts) { return { status: 'unverified', badge: 'unverified - edit me', note: note, facts: facts }; }
    var verifiedHere = !p.verified_models || p.verified_models.indexOf(m.id) >= 0;
    var rateNote = null;
    if (m.status !== 'verified') rateNote = m.note;
    else if (!verifiedHere) {
      var surcharged = p.flat_surcharge_per_mtok && (p.surcharge_exempt_models || []).indexOf(m.id) < 0;
      rateNote = 'No source lists ' + m.label + ' rates in ' + p.short + '; the vendor list price' + (surcharged ? ' plus the Cursor Token Rate' : '') + ' is used. Verified in this tool: ' +
        p.verified_models.map(function (id) { var x = findModel(id); return x ? x.label : id; }).join(', ') + '.';
    }
    if (rateNote) {
      RATE_FIELDS.concat(m.long_context ? LC_RATE_FIELDS : []).forEach(function (k) { out[k] = unv(rateNote, m.fact_ids); });
    }
    if (m.long_context && m.long_context.unverified_fields) {
      m.long_context.unverified_fields.forEach(function (k) { out[k] = unv(m.long_context.unverified_note, m.fact_ids); });
    }
    var cw = p.context_windows && p.context_windows[m.id];
    if (cw) {
      // Cursor documents the window: no badge; computeAll warns when C passes the default window.
    } else if (m.context_window == null) {
      out['g.window'] = unv('No verified context window for ' + m.label + ' (constants.json has null). 1,000,000 is a placeholder.', m.fact_ids);
    } else if (p.tool === 'copilot' && m.provider === 'anthropic') {
      out['g.window'] = unv('Context window of Claude inside Copilot is not verified; a 540K session was measured (facts.md open question 2).', ['F45', 'E1']);
    }
    if (p.ttl_source === 'client' && m.id !== 'gpt-5-3-codex') {
      out['r.ttlMain'] = { status: 'source', badge: 'from client source, not GitHub docs',
        note: (m.provider === 'anthropic' ? '5 min comes from the VS Code Copilot source and Copilot CLI logs (300 s).' : '30 min comes from Copilot CLI logs (1800 s) and OpenAI docs.') +
          ' GitHub does not state a TTL; its own tutorial says 1 h for most models, which code and measurements contradict (F53).',
        facts: m.provider === 'anthropic' ? ['K1', 'F52', 'F53'] : ['K2', 'F52', 'F80', 'F53'] };
      out['r.ttlSub'] = out['r.ttlMain'];
    } else if (p.ttl_source === 'staff' && m.id !== 'gpt-5-3-codex') {
      out['r.ttlMain'] = { status: 'source', badge: 'from staff forum posts, not docs',
        note: 'Cursor staff on the forum: ' + (m.provider === 'anthropic' ? '"5 minutes for Anthropic" (K4).'
          : '"in the case of GPT 5.6 it would be 30 minutes" (F66, July 2026). Since 2026-10-20 OpenAI also offers 12 hours; Cursor has not said whether it uses it.') +
          ' Not in Cursor docs; can change without notice.',
        facts: m.provider === 'anthropic' ? ['K4', 'F65'] : ['F66'] };
      out['r.ttlSub'] = out['r.ttlMain'];
    }
    if (p.tool === 'cursor' && m.provider === 'openai') {
      out['g.gptHit'] = { status: 'source', badge: 'measured in Copilot, not Cursor',
        note: 'The hit rate comes from Copilot logs (E4, one account). Nobody has measured it in Cursor.', facts: ['E4'] };
    }
    if (p.id === 'claude-code-subscription') {
      out['r.ttlMain'] = unv('Docs say 1 hour, but open regression #103673 reports 5-minute writes in the interactive CLI since about 2026-10-14. Check /usage or set "promptCacheTtl": "1h".', ['F20', 'F27']);
    }
    if (m.id === 'gpt-5-3-codex') {
      out['r.ttlMain'] = unv(p.tool === 'cursor'
        ? 'No Cursor source gives a TTL for GPT-5.3-Codex. Staff said "24 hours for most OpenAI models" (F66), which OpenAI calls a ceiling, typically about 30 minutes. 30 minutes is a placeholder.'
        : 'GPT-5.3-Codex TTL depends on the retention the client requests (VS Code 24h; Copilot CLI undocumented).',
        p.tool === 'cursor' ? ['F66'] : ['F54', 'F83']);
      out['r.ttlSub'] = out['r.ttlMain'];
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Default state
  // ---------------------------------------------------------------------------

  var DEFAULT_PROFILE = 'copilot-claude';

  /** Usage inputs. All are placeholders for a heavy agent user; Krystian sets his own. */
  var USAGE_DEFAULTS = {
    'g.fillPct': 40, 'g.useAbs': false, 'g.absTokens': 400000,
    'g.days': 22, 'g.budget': 200,
    'g.pollOut': ASSUMPTIONS.pollOutputTokens.value, 'g.pollIn': ASSUMPTIONS.pollNewInputTokens.value,
    'g.genMin': ASSUMPTIONS.generationMinutes.value, 'g.gptHit': ASSUMPTIONS.gptHitPct.value,
    's1.minutes': 15, 's1.perDay': 4, 's1.poll': false, 's1.pollEvery': 3.5, 's1.inc': true,
    's2.minutes': 8, 's2.perDay': 10, 's2.inc': true,
    's3.minutes': 12, 's3.perDay': 6, 's3.poll': false, 's3.pollEvery': 3.5, 's3.inc': true,
    's4.co': 400000, 's4.waves': 3, 's4.subs': 4, 's4.dur': 12, 's4.cs': 100000, 's4.wait': 7,
    's4.h': 80000, 's4.problems': 1, 's4.problemMin': 8, 's4.runs': 1, 's4.layout': 'hub', 's4.inc': true,
    's5.n': 5, 's5.r': 3, 's5.ca': 180000, 's5.hours': 1, 's5.inc': true,
    's6.requests': 400, 's6.avgPct': 50, 's6.newTok': 2000, 's6.outTok': 800,
    'strip.heartbeat': ASSUMPTIONS.heartbeatMinutes.value,
    'ui.focus': 's1'
  };

  function defaultState(profileId, modelId) {
    var pid = profileId && findProfile(profileId) ? profileId : DEFAULT_PROFILE;
    var mid = modelId && allowedModels(pid).some(function (m) { return m.id === modelId; }) ? modelId : defaultModelFor(pid);
    var st = { 'g.profile': pid, 'g.model': mid };
    var k;
    var pf = presetFields(pid, mid);
    for (k in pf) st[k] = pf[k];
    for (k in USAGE_DEFAULTS) st[k] = USAGE_DEFAULTS[k];
    return st;
  }

  // ---------------------------------------------------------------------------
  // Core maths
  // ---------------------------------------------------------------------------

  function num(x, fallback) {
    var n = typeof x === 'number' ? x : parseFloat(x);
    return isFinite(n) ? n : (fallback || 0);
  }
  function optNum(x) { return x == null || x === '' ? null : num(x); }

  /** Build the rates object the maths uses from a state. */
  function ratesFromState(st) {
    var lc = null;
    if (st['r.lcThreshold'] != null && st['r.lcThreshold'] !== '' && isFinite(parseFloat(st['r.lcThreshold'])) &&
        st['r.lcRead'] != null && st['r.lcRead'] !== '') {
      lc = {
        threshold: num(st['r.lcThreshold']),
        input: num(st['r.lcInput']), output: num(st['r.lcOutput']), read: num(st['r.lcRead']),
        writeMain: num(st['r.lcWriteMain']), writeSub: num(st['r.lcWriteSub']),
        write5m: optNum(st['r.lcWrite5m']), write1h: optNum(st['r.lcWrite1h'])
      };
    }
    var p = findProfile(st['g.profile']);
    var m = findModel(st['g.model']);
    return {
      input: num(st['r.input']), output: num(st['r.output']), read: num(st['r.read']),
      writeMain: num(st['r.writeMain']), writeSub: num(st['r.writeSub']),
      write5m: optNum(st['r.write5m']), write1h: optNum(st['r.write1h']),
      ttlMain: num(st['r.ttlMain']), ttlSub: num(st['r.ttlSub']),
      usdPerCredit: optNum(st['r.usdPerCredit']),
      billing: p ? p.billing : 'usd_per_token',
      provider: m ? m.provider : 'anthropic',
      // Lifetimes the tool lets the user have, or null when any tier the provider sells is reachable.
      offeredTtls: p && p.offered_ttls && m ? p.offered_ttls[m.provider] || null : null,
      // F8: the TTL runs from the start of the previous request, so its generation time counts.
      genMin: Math.max(0, num(st['g.genMin'])),
      // GPT only: share of requests 5 min to TTL after the previous one that still hit (E2, E4, F80).
      gptHit: Math.min(1, Math.max(0, num(st['g.gptHit'], 100) / 100)),
      // F3: the long-context threshold counts all input tokens, so every request is C + this.
      newTok: Math.max(0, num(st['s6.newTok'])),
      lc: lc
    };
  }

  /** Price tier for a request whose whole input is `tokens` long (long-context premium above the threshold). */
  function tierAt(rates, tokens) {
    if (rates.lc && tokens > rates.lc.threshold) {
      return { input: rates.lc.input, output: rates.lc.output, read: rates.lc.read,
        writeMain: rates.lc.writeMain, writeSub: rates.lc.writeSub,
        write5m: rates.lc.write5m, write1h: rates.lc.write1h, long: true };
    }
    return { input: rates.input, output: rates.output, read: rates.read,
      writeMain: rates.writeMain, writeSub: rates.writeSub,
      write5m: rates.write5m, write1h: rates.write1h, long: false };
  }

  /**
   * Prices and TTL of a request that carries a C-token cached prefix plus one turn of new input.
   * The tier is tested on C + new input, because the threshold counts all input tokens (F3).
   */
  function bucketOf(rates, C, bucket) {
    var t = tierAt(rates, C + (rates.newTok || 0));
    var sub = bucket === 'sub';
    return { ttl: sub ? rates.ttlSub : rates.ttlMain, write: sub ? t.writeSub : t.writeMain,
      read: t.read, input: t.input, output: t.output, write5m: t.write5m, write1h: t.write1h, long: t.long };
  }

  function usd(tokens, perMtok) { return tokens / MTOK * perMtok; }

  /** Gap the cache sees: the idle minutes plus the generation time of the turn before them (F8). */
  function effGap(rates, idleMinutes) { return idleMinutes + (rates.genMin || 0); }

  /**
   * Probability that a request `gap` minutes after the previous one on the prefix misses, under a lifetime
   * of `ttl` minutes. Claude: 0 or 1. GPT: 1 - hit rate for gaps above 5 minutes up to the TTL (F80 says the
   * 30 minutes make a prefix eligible, they do not guarantee a hit; E4 measured 77%).
   */
  function missProbAt(rates, gap, ttl) {
    if (gap > ttl) return 1;
    if (rates.provider === 'openai' && gap > GPT_SURE_WARM_MIN) return 1 - rates.gptHit;
    return 0;
  }

  /** Extra cost of one miss: C x (write - read). The hero number. */
  function missExtraUsd(rates, C, bucket) {
    var b = bucketOf(rates, C, bucket);
    return usd(C, b.write - b.read);
  }

  /** Expected cost of the request that resumes a C-token prefix after `gap` minutes: C x read + P(miss) x C x (write - read). */
  function resumeUsd(rates, C, gap, bucket) {
    var b = bucketOf(rates, C, bucket);
    return usd(C, b.read) + missProbAt(rates, gap, b.ttl) * usd(C, b.write - b.read);
  }

  /** Expected extra over a warm resume for one wait: P(miss) x C x (write - read). */
  function waitExtraUsd(rates, C, gap, bucket) {
    var b = bucketOf(rates, C, bucket);
    return missProbAt(rates, gap, b.ttl) * usd(C, b.write - b.read);
  }

  /** Write price of the bucket above the 5-minute write of the same tier, per MTok. 0 on 5-minute and GPT buckets. */
  function ttlPremiumPerMtok(rates, C, bucket) {
    var b = bucketOf(rates, C, bucket);
    return b.write5m == null ? 0 : b.write - b.write5m;
  }

  /** Cost of one poll that keeps a C-token prefix warm: C x read + poll output x output + poll new input x write. */
  function pollUsd(rates, C, bucket, pollOut, pollIn) {
    var b = bucketOf(rates, C, bucket);
    return usd(C, b.read) + usd(pollOut, b.output) + usd(pollIn, b.write);
  }

  /**
   * Remedy "background run + poll every P minutes" for one wait of `gap` minutes (gap as the cache sees it).
   * polls = ceil(gap / P) - 1, only if the wait would miss. Each poll misses itself when P > TTL, and the
   * final resume misses only when the rest after the last poll, gap - polls x P, is also longer than the TTL.
   * Polling is cheaper than one miss while polls < miss / one poll, i.e. for gaps up to ceil(break-even) x P.
   */
  function pollPlan(rates, C, gap, interval, bucket, pollOut, pollIn) {
    var b = bucketOf(rates, C, bucket);
    var P = interval > 0 ? interval : 1e-9;
    var qGap = missProbAt(rates, gap, b.ttl);
    var needed = qGap > 0;
    var polls = needed ? Math.max(0, Math.ceil(gap / P - 1e-9) - 1) : 0;
    var onePoll = pollUsd(rates, C, bucket, pollOut, pollIn);
    var miss = usd(C, b.write - b.read);
    var qPoll = missProbAt(rates, P, b.ttl);
    var rest = gap - polls * P;
    var qLast = missProbAt(rates, rest, b.ttl);
    var keepsWarm = qPoll === 0;
    var withPolling = !needed ? 0 : polls * (onePoll + qPoll * miss) + qLast * miss;
    var withoutPolling = qGap * miss;
    var breakEvenPolls = onePoll > 0 ? miss / onePoll : Infinity;
    var bareRead = usd(C, b.read);
    var bareBreakEvenPolls = bareRead > 0 ? miss / bareRead : Infinity;
    return {
      needed: needed, polls: polls, pollUsd: onePoll, missUsd: miss, missProb: qGap, keepsWarm: keepsWarm,
      restMin: rest, lastMissProb: qLast,
      withPollingUsd: withPolling, withoutPollingUsd: withoutPolling,
      savingUsd: withoutPolling - withPolling,
      breakEvenPolls: breakEvenPolls,
      maxWorthwhileGapMin: isFinite(breakEvenPolls) ? Math.ceil(breakEvenPolls - 1e-9) * P : Infinity,
      // Same with a bare keep-alive read (no poll output, no poll input), the floor any keep-alive costs.
      bareBreakEvenPolls: bareBreakEvenPolls,
      bareMaxGapMin: isFinite(bareBreakEvenPolls) ? Math.ceil(bareBreakEvenPolls - 1e-9) * P : Infinity
    };
  }

  function contextTokens(st) {
    if (st['g.useAbs']) return Math.max(0, num(st['g.absTokens']));
    return Math.max(0, Math.round(num(st['g.window']) * num(st['g.fillPct']) / 100));
  }

  function credits(usdValue, rates) {
    return rates.usdPerCredit ? usdValue / rates.usdPerCredit : null;
  }

  // ---------------------------------------------------------------------------
  // Scenarios
  // ---------------------------------------------------------------------------

  /** Scenarios 1-3: an idle wait of `minutes`, `perDay` times a day, on the main conversation with context C. */
  function waitScenario(rates, C, days, minutes, perDay, poll, pollEvery, pollOut, pollIn) {
    var gap = effGap(rates, minutes);
    var b = bucketOf(rates, C, 'main');
    var q = missProbAt(rates, gap, b.ttl);
    var base = q * usd(C, b.write - b.read);
    var plan = pollPlan(rates, C, gap, pollEvery, 'main', pollOut, pollIn);
    var perEvent = poll ? plan.withPollingUsd : base;
    return {
      ttl: b.ttl, gap: gap, genMin: rates.genMin, missProb: q, warm: q === 0, partial: q > 0 && q < 1, longContext: b.long,
      baseUsd: base, perEventUsd: perEvent, perDayUsd: perEvent * perDay, perMonthUsd: perEvent * perDay * days,
      remedyOn: !!poll, poll: plan,
      events: [{ C: C, gap: gap, perDay: perDay, bucket: 'main' }]
    };
  }

  /**
   * Scenario 4. Cost of waiting and handoffs per run (resume costs, warm or cold, plus handoff seeds).
   * Genuinely new input is left out because it is the same in every layout at the 5-minute write price.
   * On a longer-TTL bucket every context is written at a higher price; that
   * premium over the 5-minute write is added per context (hub of 400K on 1 h = 0.4 x $3 = $1.20).
   */
  function orchestratorScenario(rates, inp, days) {
    var Co = inp.co, W = inp.waves, S = inp.subs, D = inp.dur, Cs = inp.cs, Tw = inp.wait,
      H = inp.h, P = inp.problems, Tp = inp.problemMin, runs = inp.runs;
    var tasks = W * S;
    var Cavg = (Cs + Co) / 2;
    var gD = effGap(rates, D), gW = effGap(rates, Tw), gP = effGap(rates, Tp);
    var seedSub = usd(H, bucketOf(rates, H, 'sub').write);

    function line(label, formula, count, C, gap, bucket) {
      var q = missProbAt(rates, gap, bucketOf(rates, C, bucket).ttl);
      return { label: label, formula: formula, count: count, C: C, gap: gap, bucket: bucket,
        usd: count * resumeUsd(rates, C, gap, bucket), missUsd: count * waitExtraUsd(rates, C, gap, bucket),
        cold: q >= 1, partial: q > 0 && q < 1, missProb: q };
    }
    function seed(label, formula, count) {
      return { label: label, formula: formula, count: count, C: H, gap: null, bucket: 'sub',
        usd: count * seedSub, missUsd: 0, cold: false, kind: 'seed' };
    }
    function premium(label, formula, count, C, bucket) {
      return { label: label, formula: formula, count: count, C: C, gap: null, bucket: bucket,
        usd: count * usd(C, ttlPremiumPerMtok(rates, C, bucket)), missUsd: 0, cold: false, kind: 'premium' };
    }
    function total(lines) {
      lines = lines.filter(function (l) { return !(l.kind === 'premium' && Math.abs(l.usd) < 1e-12); });
      var t = 0, mi = 0;
      lines.forEach(function (l) { t += l.usd; mi += l.missUsd; });
      return { lines: lines, usd: t, missUsd: mi };
    }

    var hub = total([
      line('Hub resumes after each wave', 'W x resume(C_o, D)', W, Co, gD, 'main'),
      line('Subagents resume after their tool wait', 'W x S x resume(C_s, wait)', tasks, Cs, gW, 'sub'),
      seed('Rubber duck reads the handoff', 'problems x H x write', P),
      line('Hub resumes after the duck discussion', 'problems x resume(C_o, problem minutes)', P, Co, gP, 'main'),
      premium('Hub context written at the longer-TTL price', 'C_o x (write - 5-min write)', 1, Co, 'main'),
      premium('Subagent contexts written at the longer-TTL price', 'W x S x C_s x (write - 5-min write)', tasks, Cs, 'sub')
    ]);
    var seq = total([
      line('Single agent resumes after each task\'s tool wait', 'W x S x resume((C_s + C_o) / 2, wait)', tasks, Cavg, gW, 'main'),
      seed('Rubber duck reads the handoff', 'problems x H x write', P),
      line('Agent resumes after the duck discussion', 'problems x resume((C_s + C_o) / 2, problem minutes)', P, Cavg, gP, 'main'),
      premium('Agent context written at the longer-TTL price', 'C_o x (write - 5-min write)', 1, Co, 'main')
    ]);
    var code = total([
      line('Subagents resume after their tool wait', 'W x S x resume(C_s, wait)', tasks, Cs, gW, 'sub'),
      seed('Fresh patcher and rubber duck read the handoff file', '2 x problems x H x write', 2 * P),
      premium('Subagent contexts written at the longer-TTL price', 'W x S x C_s x (write - 5-min write)', tasks, Cs, 'sub')
    ]);
    var layouts = { hub: hub, sequential: seq, code: code };
    var key = inp.layout in layouts ? inp.layout : 'hub';
    var chosen = layouts[key];
    var events = [];
    chosen.lines.forEach(function (l) {
      if (l.gap != null && l.count > 0) events.push({ C: l.C, gap: l.gap, perDay: l.count * runs, bucket: l.bucket });
    });
    // Contexts this layout builds per day (for the TTL strip's write premium).
    var built = { hub: [{ C: Co, count: 1, bucket: 'main' }, { C: Cs, count: tasks, bucket: 'sub' }],
      sequential: [{ C: Co, count: 1, bucket: 'main' }], code: [{ C: Cs, count: tasks, bucket: 'sub' }] }[key];
    return {
      layouts: layouts, layout: key, cAvg: Cavg, gaps: { dur: gD, wait: gW, problem: gP },
      heroUsd: hub.usd,
      savingCodeVsHubUsd: hub.usd - code.usd,
      perRunUsd: chosen.usd,
      perDayUsd: chosen.usd * runs, perMonthUsd: chosen.usd * runs * days,
      missPerDayUsd: chosen.missUsd * runs,
      events: events,
      written: built.map(function (w) { return { C: w.C, count: w.count * runs, bucket: w.bucket }; })
    };
  }

  /** Scenario 5: N agents, R minutes with each in round-robin. Each waits (N - 1) x R after its last turn started. */
  function parallelScenario(rates, inp, days) {
    var N = Math.max(1, Math.round(inp.n)), R = inp.r, Ca = inp.ca, hours = inp.hours;
    var b = bucketOf(rates, Ca, 'main');
    var gap = effGap(rates, (N - 1) * R);
    var q = missProbAt(rates, gap, b.ttl);
    var returnsPerHour = R > 0 && N > 1 ? 60 / R : 0;
    var perReturn = q * usd(Ca, b.write - b.read);
    var perHour = returnsPerHour * perReturn;
    var room = Math.max(0, b.ttl - rates.genMin);
    return {
      ttl: b.ttl, gap: gap, idleMin: (N - 1) * R, warm: q === 0, partial: q > 0 && q < 1, missProb: q,
      returnsPerHour: returnsPerHour,
      perReturnUsd: perReturn, heroUsd: perHour, perHourUsd: perHour,
      perDayUsd: perHour * hours, perMonthUsd: perHour * hours * days,
      // (N - 1) x R + generation <= TTL
      largestWarmN: R > 0 ? Math.max(1, Math.floor(room / R + 1e-9) + 1) : Infinity,
      maxMinutesEach: N > 1 ? room / (N - 1) : Infinity,
      events: returnsPerHour > 0 ? [{ C: Ca, gap: gap, perDay: returnsPerHour * hours, bucket: 'main' }] : [],
      written: [{ C: Ca, count: N, bucket: 'main' }]
    };
  }

  /**
   * Scenario 6. Warm day = requests x (C_avg x read + new x write + output x output price).
   * Real day = warm day + re-write extras of the included scenarios. No cache = requests x ((C_avg + new) x input + output).
   */
  function monthlyScenario(rates, C, inp, days, budget, extras) {
    var Cavg = C * inp.avgPct / 100;
    var t = tierAt(rates, Cavg + inp.newTok);
    var warmReq = usd(Cavg, t.read) + usd(inp.newTok, t.writeMain) + usd(inp.outTok, t.output);
    var noCacheReq = usd(Cavg + inp.newTok, t.input) + usd(inp.outTok, t.output);
    var warmDay = inp.requests * warmReq;
    var extraDay = 0;
    extras.forEach(function (e) { extraDay += e.usd; });
    var realDay = warmDay + extraDay;
    return {
      cAvg: Cavg, warmPerRequestUsd: warmReq, noCachePerRequestUsd: noCacheReq,
      warmDayUsd: warmDay, extraDayUsd: extraDay, realDayUsd: realDay, noCacheDayUsd: inp.requests * noCacheReq,
      warmMonthUsd: warmDay * days, realMonthUsd: realDay * days, noCacheMonthUsd: inp.requests * noCacheReq * days,
      extraMonthUsd: extraDay * days,
      rewriteShare: realDay > 0 ? extraDay / realDay : 0,
      daysReal: realDay > 0 ? budget / realDay : Infinity,
      daysWarm: warmDay > 0 ? budget / warmDay : Infinity,
      daysNoCache: noCacheReq > 0 && inp.requests > 0 ? budget / (inp.requests * noCacheReq) : Infinity,
      heroDays: realDay > 0 ? budget / realDay : Infinity,
      perDayUsd: realDay, perMonthUsd: realDay * days,
      extras: extras
    };
  }

  /**
   * TTL comparison strip over the wait events of the included scenarios (before remedies).
   * Each tile applies one TTL to every bucket and the write price of that tier, per price tier
   * (a long-context request uses the long-context 5-minute or 1-hour write):
   * 5 min -> 5-minute write; 30 min -> GPT's own write, hypothetical at the 5-minute write for Claude;
   * 1 h -> 1-hour write. GPT has one write price, so its 5-min and 1-h tiles are hypothetical at that price.
   * Write premium: tokens written per day x (tile write - your write of that bucket). Tokens written per day
   * = the larger of requests x new tokens (Monthly card) and the contexts the included scenarios build
   * (main conversation C once, scenario 4 per layout and run, scenario 5 N agents).
   * "Your setup" = your own TTL per bucket (main and subagents can differ, e.g. the Claude Code subscription).
   * Agent poll: every `heartbeat` minutes at your TTL and prices; also priced as a bare keep-alive read (F14).
   */
  function ttlStrip(rates, events, written, inp, days) {
    var openai = rates.provider === 'openai';
    function tileWrite(b, ttl) {
      if (openai) return b.write;
      var w = ttl >= 60 ? b.write1h : b.write5m;
      return w != null ? w : b.write;
    }
    function at(ttl) {
      var total = 0;
      events.forEach(function (e) {
        var b = bucketOf(rates, e.C, e.bucket);
        total += e.perDay * missProbAt(rates, e.gap, ttl) * usd(e.C, tileWrite(b, ttl) - b.read);
      });
      return total;
    }
    var trafficTok = inp.requests * inp.newTok;
    var contexts = (written || []).map(function (w) { return { C: w.C, tokens: w.C * w.count, bucket: w.bucket }; });
    var contextTok = contexts.reduce(function (s, w) { return s + w.tokens; }, 0);
    var useContexts = contextTok > trafficTok;
    var items = useContexts ? contexts : [{ C: inp.cAvg, tokens: trafficTok, bucket: 'main' }];
    function premium(ttl) {
      var t = 0;
      items.forEach(function (it) {
        var b = bucketOf(rates, it.C, it.bucket);
        t += usd(it.tokens, tileWrite(b, ttl) - b.write);
      });
      return t;
    }
    var heart = 0, bare = 0, heartWarm = true, yours = 0;
    events.forEach(function (e) {
      yours += e.perDay * waitExtraUsd(rates, e.C, e.gap, e.bucket);
      var plan = pollPlan(rates, e.C, e.gap, inp.heartbeat, e.bucket, inp.pollOut, inp.pollIn);
      var plan0 = pollPlan(rates, e.C, e.gap, inp.heartbeat, e.bucket, 0, 0);
      if (plan.needed) {
        heart += e.perDay * plan.withPollingUsd;
        bare += e.perDay * plan0.withPollingUsd;
        if (!plan.keepsWarm) heartWarm = false;
      }
    });
    var same = rates.ttlMain === rates.ttlSub;
    function notOffered(ttl) { return !!rates.offeredTtls && rates.offeredTtls.indexOf(ttl) < 0; }
    var rows = [
      { id: 'ttl5', label: '5 min', ttl: 5, rewriteUsd: at(5), premiumUsd: premium(5), hypothetical: openai,
        note: openai ? 'no 5-minute tier on GPT: hypothetical at your write price' : 'writes at the 5-minute price' },
      { id: 'ttl30', label: '30 min', ttl: 30, rewriteUsd: at(30), premiumUsd: premium(30), hypothetical: !openai,
        note: openai ? 'writes at your (30-minute) write price' : 'no 30-minute tier on Claude: hypothetical at the 5-minute price' },
      { id: 'ttl60', label: '1 h', ttl: 60, rewriteUsd: at(60), premiumUsd: premium(60), hypothetical: openai || notOffered(60),
        note: openai ? 'no 1-hour tier on GPT: hypothetical at your write price'
          : (notOffered(60) ? 'your tool offers no 1-hour lifetime: hypothetical at the 1-hour price' : 'writes at the 1-hour price') },
      { id: 'heartbeat', label: 'Agent poll · ' + inp.heartbeat + ' min', ttl: null, rewriteUsd: heart, premiumUsd: 0, hypothetical: false,
        bareUsd: bare,
        note: 'the agent polls every ' + inp.heartbeat + ' min at your TTL, each poll = C × read + poll output + poll input' + (heartWarm ? '' : ' (interval longer than TTL: polls miss)') }
    ];
    rows.forEach(function (r) {
      r.dayUsd = r.rewriteUsd + r.premiumUsd; r.monthUsd = r.dayUsd * days;
      r.isYours = r.ttl != null && !r.hypothetical && same && r.ttl === rates.ttlMain;
    });
    var yoursRow = { id: 'yours', label: 'Your setup', ttl: null, rewriteUsd: yours, premiumUsd: 0, hypothetical: false,
      dayUsd: yours, monthUsd: yours * days, isYours: true,
      note: 'main ' + rates.ttlMain + ' min, subagents ' + rates.ttlSub + ' min, your write prices',
      shown: !rows.some(function (r) { return r.isYours; }) };
    return { rows: rows, yours: yoursRow, heartbeatKeepsWarm: heartWarm,
      writtenTokensPerDay: useContexts ? contextTok : trafficTok, writtenFrom: useContexts ? 'contexts' : 'traffic' };
  }

  // ---------------------------------------------------------------------------
  // Everything at once
  // ---------------------------------------------------------------------------

  function computeAll(st) {
    var rates = ratesFromState(st);
    var C = contextTokens(st);
    var days = num(st['g.days']);
    var budget = num(st['g.budget']);
    var pollOut = num(st['g.pollOut']), pollIn = num(st['g.pollIn']);
    var window = num(st['g.window']);
    var model = findModel(st['g.model']);
    var profile = findProfile(st['g.profile']);
    var mainB = bucketOf(rates, C, 'main');

    var s1 = waitScenario(rates, C, days, num(st['s1.minutes']), num(st['s1.perDay']), !!st['s1.poll'], num(st['s1.pollEvery']), pollOut, pollIn);
    var s2 = waitScenario(rates, C, days, num(st['s2.minutes']), num(st['s2.perDay']), false, 1, pollOut, pollIn);
    var s3 = waitScenario(rates, C, days, num(st['s3.minutes']), num(st['s3.perDay']), !!st['s3.poll'], num(st['s3.pollEvery']), pollOut, pollIn);
    var s4 = orchestratorScenario(rates, {
      co: num(st['s4.co']), waves: num(st['s4.waves']), subs: num(st['s4.subs']), dur: num(st['s4.dur']),
      cs: num(st['s4.cs']), wait: num(st['s4.wait']), h: num(st['s4.h']), problems: num(st['s4.problems']),
      problemMin: num(st['s4.problemMin']), runs: num(st['s4.runs']), layout: st['s4.layout']
    }, days);
    var s5 = parallelScenario(rates, { n: num(st['s5.n']), r: num(st['s5.r']), ca: num(st['s5.ca']), hours: num(st['s5.hours']) }, days);

    var extras = [];
    var events = [];
    var written = [];
    if (st['s1.inc']) { extras.push({ id: 's1', name: 'Break', usd: s1.perDayUsd }); events = events.concat(s1.events); }
    if (st['s2.inc']) { extras.push({ id: 's2', name: 'Reading the answer', usd: s2.perDayUsd }); events = events.concat(s2.events); }
    if (st['s3.inc']) { extras.push({ id: 's3', name: 'Long tool call', usd: s3.perDayUsd }); events = events.concat(s3.events); }
    if (st['s1.inc'] || st['s2.inc'] || st['s3.inc']) written.push({ C: C, count: 1, bucket: 'main' });
    if (st['s4.inc']) { extras.push({ id: 's4', name: 'Orchestrator waiting on subagents', usd: s4.missPerDayUsd }); events = events.concat(s4.events); written = written.concat(s4.written); }
    if (st['s5.inc']) { extras.push({ id: 's5', name: 'Parallel agents in worktrees', usd: s5.perDayUsd }); events = events.concat(s5.events); written = written.concat(s5.written); }

    var s6inp = { requests: num(st['s6.requests']), avgPct: num(st['s6.avgPct']), newTok: num(st['s6.newTok']), outTok: num(st['s6.outTok']) };
    var s6 = monthlyScenario(rates, C, s6inp, days, budget, extras);
    var strip = ttlStrip(rates, events, written, {
      requests: s6inp.requests, newTok: s6inp.newTok, cAvg: s6.cAvg, heartbeat: num(st['strip.heartbeat']), pollOut: pollOut, pollIn: pollIn
    }, days);

    var warnings = [];
    if (C > window) warnings.push('Context C (' + C + ') is larger than the context window (' + window + ').');
    if (model && model.long_context && model.long_context.unverified_fields && C + rates.newTok > model.long_context.threshold_tokens) {
      warnings.push(model.label + ' above ' + model.long_context.threshold_tokens + ' tokens: only the $' + model.long_context.cache_write_30m_per_mtok.toFixed(2) +
        ' cache write is verified (F46); input, read and output of that tier are inferred or assumed.');
    }
    var cwin = profile && model && profile.context_windows && profile.context_windows[model.id];
    if (cwin && C > cwin.def && C <= cwin.max) {
      warnings.push('Context C (' + C + ') is above the default context window of ' + model.label + ' in Cursor (' + cwin.def + '); it needs the larger context setting (up to ' + cwin.max + ').');
    }
    if (profile && model && (profile.not_on_pro || []).indexOf(model.id) >= 0) {
      warnings.push(model.label + ' is not on Copilot Pro, only on Pro+ and Max (F48).');
    }

    return {
      rates: rates, C: C, days: days, budget: budget, model: model, profile: profile,
      subscription: rates.billing === 'subscription',
      main: mainB,
      missUsd: missExtraUsd(rates, C, 'main'),
      missCredits: credits(missExtraUsd(rates, C, 'main'), rates),
      warmResumeUsd: usd(C, mainB.read), coldResumeUsd: usd(C, mainB.write),
      s1: s1, s2: s2, s3: s3, s4: s4, s5: s5, s6: s6, strip: strip,
      warnings: warnings
    };
  }

  // ---------------------------------------------------------------------------
  // URL hash state (pure string <-> object)
  // ---------------------------------------------------------------------------

  /** Encode only the keys that differ from the defaults of the state's own profile and model. */
  function encodeState(st) {
    var d = defaultState(st['g.profile'], st['g.model']);
    var parts = ['g.profile=' + encodeURIComponent(st['g.profile']), 'g.model=' + encodeURIComponent(st['g.model'])];
    Object.keys(d).forEach(function (k) {
      if (k === 'g.profile' || k === 'g.model') return;
      var v = st[k];
      if (v === d[k]) return;
      if (v == null) v = '';
      if (typeof v === 'boolean') v = v ? '1' : '0';
      parts.push(k + '=' + encodeURIComponent(String(v)));
    });
    return parts.join('&');
  }

  /** Decode a hash (with or without '#') onto the defaults of its profile and model. */
  function decodeState(hash) {
    var h = (hash || '').replace(/^#/, '');
    var map = {};
    h.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      if (i < 0) return;
      try { map[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1)); } catch (e) { /* ignore bad pair */ }
    });
    var st = defaultState(map['g.profile'], map['g.model']);
    Object.keys(st).forEach(function (k) {
      if (k === 'g.profile' || k === 'g.model' || !(k in map)) return;
      var raw = map[k];
      var def = st[k];
      if (typeof def === 'boolean') st[k] = raw === '1' || raw === 'true';
      else if (typeof def === 'number' || def === null) {
        if (raw === '') st[k] = null;
        else { var n = parseFloat(raw); if (isFinite(n)) st[k] = n; }
      } else st[k] = raw;
    });
    if (!SCENARIOS.some(function (s) { return s.id === st['ui.focus']; })) st['ui.focus'] = 's1';
    return st;
  }

  return {
    AS_OF: AS_OF, MTOK: MTOK,
    MODELS: MODELS, PROFILES: PROFILES, ASSUMPTIONS: ASSUMPTIONS, SCENARIOS: SCENARIOS,
    USAGE_DEFAULTS: USAGE_DEFAULTS, DEFAULT_PROFILE: DEFAULT_PROFILE,
    findModel: findModel, findProfile: findProfile, allowedModels: allowedModels, defaultModelFor: defaultModelFor,
    shutoffNotice: shutoffNotice,
    presetFields: presetFields, fieldStatus: fieldStatus, defaultState: defaultState,
    ratesFromState: ratesFromState, tierAt: tierAt, bucketOf: bucketOf, contextTokens: contextTokens,
    effGap: effGap, missProbAt: missProbAt, ttlPremiumPerMtok: ttlPremiumPerMtok, GPT_SURE_WARM_MIN: GPT_SURE_WARM_MIN,
    missExtraUsd: missExtraUsd, resumeUsd: resumeUsd, waitExtraUsd: waitExtraUsd,
    pollUsd: pollUsd, pollPlan: pollPlan, credits: credits,
    waitScenario: waitScenario, orchestratorScenario: orchestratorScenario,
    parallelScenario: parallelScenario, monthlyScenario: monthlyScenario, ttlStrip: ttlStrip,
    computeAll: computeAll, encodeState: encodeState, decodeState: decodeState
  };
});
