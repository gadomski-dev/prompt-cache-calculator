// Run: node --test model.test.mjs
// Expected values are computed by hand from the default inputs (see README.md, "Default numbers").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('./model.js');

function close(actual, expected, eps = 1e-6, msg = '') {
  assert.ok(Math.abs(actual - expected) <= eps, `${msg} expected ${expected}, got ${actual}`);
}

const D = M.defaultState();
const R = M.computeAll(D);

test('defaults: Copilot AI credits with Claude Opus 5.5, C = 40% of 1M', () => {
  assert.equal(D['g.profile'], 'copilot-claude');
  assert.equal(D['g.model'], 'claude-opus-5-5');
  assert.equal(R.C, 400000);
  close(R.rates.read, 0.2);
  close(R.rates.writeMain, 5);
  assert.equal(R.rates.ttlMain, 5);
  assert.equal(R.rates.usdPerCredit, 0.01);
});

test('hero: one miss = C x (write - read) = 0.4 x 4.80 = $1.92 = 192 credits', () => {
  close(R.missUsd, 1.92);
  close(R.missCredits, 192);
  close(R.warmResumeUsd, 0.08);
  close(R.coldResumeUsd, 2.0);
});

test('scenario 1 Break: 15 min > 5 min TTL, 4 a day', () => {
  close(R.s1.perEventUsd, 1.92);
  close(R.s1.perDayUsd, 7.68);
  close(R.s1.perMonthUsd, 168.96);
  assert.equal(R.s1.warm, false);
});

test('scenario 1 Break with polling every 3.5 min: 4 polls x $0.0855 = $0.342', () => {
  const r = M.computeAll({ ...D, 's1.poll': true });
  // poll = 0.4 x 0.20 + 200 x 20 / 1e6 + 300 x 5 / 1e6 = 0.08 + 0.004 + 0.0015 = 0.0855
  assert.equal(r.s1.poll.polls, 4);
  close(r.s1.poll.pollUsd, 0.0855);
  close(r.s1.perEventUsd, 0.342);
  close(r.s1.perDayUsd, 1.368);
});

test('scenario 2 Reading the answer: 8 min, 10 a day', () => {
  close(R.s2.perEventUsd, 1.92);
  close(R.s2.perDayUsd, 19.2);
  close(R.s2.perMonthUsd, 422.4);
});

test('scenario 3 Long tool call: 12 min, 6 runs a day', () => {
  close(R.s3.perEventUsd, 1.92);
  close(R.s3.perDayUsd, 11.52);
  close(R.s3.perMonthUsd, 253.44);
  // Remedy figures are always computed: 3 polls at 3.5, 7, 10.5 min.
  assert.equal(R.s3.poll.polls, 3);
  close(R.s3.poll.withPollingUsd, 0.2565);
  close(R.s3.poll.breakEvenPolls, 1.92 / 0.0855);
  // Polling is cheaper while polls < 22.46, i.e. up to 22 polls = gaps up to 23 x 3.5 = 80.5 min.
  close(R.s3.poll.maxWorthwhileGapMin, 23 * 3.5);
  // Bare keep-alive read (no poll overhead): 1.92 / 0.08 = 24 polls -> 24 x 3.5 = 84 min.
  close(R.s3.poll.bareBreakEvenPolls, 24);
  close(R.s3.poll.bareMaxGapMin, 84);
});

test('the polling limit shown as a wait subtracts the generation time (gap = wait + 1 min)', () => {
  // gap 80.5 = wait 79.5; the card labels the slider value "wait", so it must show 79.5, not 80.5
  close(R.s3.maxWorthwhileWaitMin, 79.5);
  close(R.s3.bareMaxWaitMin, 83);
  const at = (w) => M.computeAll({ ...D, 's3.minutes': w, 's3.poll': true }).s3;
  // wait 79.5 -> gap 80.5 -> 22 polls x 0.0855 = 1.881 < 1.92
  assert.ok(at(79.5).perEventUsd < at(79.5).baseUsd);
  // wait 80 -> gap 81 -> 23 polls x 0.0855 = 1.9665 > 1.92
  assert.ok(at(80).perEventUsd > at(80).baseUsd);
});

test('scenario 3 with the background-run remedy on', () => {
  const r = M.computeAll({ ...D, 's3.poll': true });
  close(r.s3.perEventUsd, 0.2565);
  close(r.s3.perDayUsd, 1.539);
  close(r.s3.perMonthUsd, 33.858);
});

test('poll interval longer than TTL: every poll misses too', () => {
  const rates = M.ratesFromState(D);
  // gap 12, P 6: 1 poll at 6 (cold), rest 6 > 5 so the resume is cold too.
  const p = M.pollPlan(rates, 400000, 12, 6, 'main', 200, 300);
  assert.equal(p.keepsWarm, false);
  assert.equal(p.polls, 1);
  close(p.withPollingUsd, 0.0855 + 1.92 + 1.92);
});

test('poll interval longer than TTL: the final resume is warm when the rest after the last poll fits the TTL', () => {
  const rates = M.ratesFromState(D);
  // cold poll = 0.0855 + 1.92 = 2.0055
  // gap 13, P 6: polls at 6 and 12, rest 1 <= 5 -> 2 x 2.0055 = 4.011
  close(M.pollPlan(rates, 400000, 13, 6, 'main', 200, 300).withPollingUsd, 4.011);
  // gap 15, P 6: polls at 6 and 12, rest 3; P 7: polls at 7 and 14, rest 1 -> 4.011 both
  close(M.pollPlan(rates, 400000, 15, 6, 'main', 200, 300).withPollingUsd, 4.011);
  close(M.pollPlan(rates, 400000, 15, 7, 'main', 200, 300).withPollingUsd, 4.011);
  // gap 20, P 6: polls at 6, 12, 18, rest 2 -> 3 x 2.0055 = 6.0165
  close(M.pollPlan(rates, 400000, 20, 6, 'main', 200, 300).withPollingUsd, 6.0165);
});

test('GPT poll interval between 5 min and the TTL: each poll misses at 1 - hit rate, not always', () => {
  const rates = M.ratesFromState(M.defaultState('copilot-gpt', 'gpt-5-6-sol'));
  // gap 41, P 10: polls at 10, 20, 30, 40, rest 1 -> 4 x (0.329 + 0.23 x 3.68) = 4.7016
  const p = M.pollPlan(rates, 400000, 41, 10, 'main', 200, 300);
  assert.equal(p.keepsWarm, false);
  close(p.pollMissProb, 0.23);
  assert.equal(p.sureWarmIntervalMin, 5);
  close(p.withPollingUsd, 4.7016);
  // above the TTL every poll misses
  assert.equal(M.pollPlan(rates, 400000, 41, 31, 'main', 200, 300).pollMissProb, 1);
  // Claude: the sure-warm interval is the TTL
  assert.equal(M.pollPlan(M.ratesFromState(D), 400000, 16, 3.5, 'main', 200, 300).sureWarmIntervalMin, 5);
  // TTL strip: a 6-min heartbeat on GPT misses 23% of the time, not always
  const r = M.computeAll({ ...M.defaultState('copilot-gpt', 'gpt-5-6-sol'), 'strip.heartbeat': 6 });
  assert.equal(r.strip.heartbeatKeepsWarm, false);
  close(r.strip.heartbeatPollMissProb, 0.23);
  assert.ok(!/longer than TTL/.test(r.strip.rows.find((x) => x.id === 'heartbeat').note));
});

test('generation time counts against the TTL (F8): 4.5 min of reading after a 1-minute answer is a miss', () => {
  const r = M.computeAll({ ...D, 's2.minutes': 4.5 });
  assert.equal(r.s2.gap, 5.5);
  close(r.s2.perEventUsd, 1.92);
  const r0 = M.computeAll({ ...D, 's2.minutes': 4.5, 'g.genMin': 0 });
  close(r0.s2.perEventUsd, 0);
});

test('scenario 4 Orchestrator: reference night ($14.40 hub)', () => {
  const L = R.s4.layouts;
  // hub: 3 x 0.4 x 5 + 12 x 0.1 x 5 + 0.08 x 5 + 0.4 x 5 = 6 + 6 + 0.4 + 2 = 14.40
  close(L.hub.usd, 14.4);
  close(L.hub.missUsd, 3 * 1.92 + 12 * 0.48 + 1.92);
  // sequential: C_avg = 250K; 12 x 0.25 x 5 + 0.4 + 0.25 x 5 = 15 + 0.4 + 1.25 = 16.65
  close(L.sequential.usd, 16.65);
  close(L.sequential.missUsd, 12 * 1.2 + 1.2);
  // code: 12 x 0.1 x 5 + 2 x 0.08 x 5 = 6 + 0.8 = 6.80
  close(L.code.usd, 6.8);
  close(L.code.missUsd, 5.76);
  close(R.s4.heroUsd, 14.4);
  close(R.s4.savingCodeVsHubUsd, 7.6);
  close(R.s4.perDayUsd, 14.4);
  close(R.s4.perMonthUsd, 316.8);
  close(R.s4.missPerDayUsd, 13.44);
});

test('scenario 4 on a Claude Code subscription: subagents stay on 5 min; the 1-hour main TTL keeps the hub warm but writes it at $8', () => {
  const st = M.defaultState('claude-code-subscription', 'claude-opus-5-5');
  const r = M.computeAll(st);
  assert.equal(r.rates.ttlMain, 60);
  assert.equal(r.rates.ttlSub, 5);
  close(r.rates.writeMain, 8);
  close(r.rates.writeSub, 5);
  // hub: 3 x 0.08 + 12 x 0.5 + 0.4 + 0.08 + hub premium 0.4 x (8 - 5) = 6.72 + 1.20 = 7.92
  close(r.s4.layouts.hub.usd, 7.92);
  // sequential: 12 x 0.05 + 0.4 + 0.05 + 0.4 x 3 = 1.05 + 1.20 = 2.25
  close(r.s4.layouts.sequential.usd, 2.25);
  // code: spokes on 5 min, no premium: 6.80
  close(r.s4.layouts.code.usd, 6.8);
  close(r.s4.savingCodeVsHubUsd, 1.12);
  assert.equal(r.subscription, true);
});

test('scenario 4 with an API key on 1 h: every context pays the 1-hour write premium', () => {
  const r = M.computeAll(M.defaultState('claude-code-api-1h', 'claude-opus-5-5'));
  const L = r.s4.layouts;
  // hub: 3 x 0.08 + 12 x 0.02 + 0.08 x 8 + 0.08 + premiums 0.4 x 3 + 12 x 0.1 x 3 = 1.20 + 1.20 + 3.60 = 6.00
  close(L.hub.usd, 6.0);
  // code: 12 x 0.02 + 2 x 0.64 + 3.60 = 0.24 + 1.28 + 3.60 = 5.12
  close(L.code.usd, 5.12);
  // sequential: 12 x 0.05 + 0.64 + 0.05 + 1.20 = 2.49
  close(L.sequential.usd, 2.49);
  // a 1-hour spoke with one wait: 0.02 read + 0.30 premium = 0.32 (polling nets more)
  close(M.resumeUsd(r.rates, 100000, 8, 'sub') + 0.1 * M.ttlPremiumPerMtok(r.rates, 100000, 'sub'), 0.32);
});

test('scenario 5 Parallel agents: 5 agents x 3 min, 180K each', () => {
  // gap = (5 - 1) x 3 + 1 min generation = 13
  assert.equal(R.s5.gap, 13);
  close(R.s5.perReturnUsd, 0.864);
  close(R.s5.perHourUsd, 17.28);
  close(R.s5.perDayUsd, 17.28);
  close(R.s5.perMonthUsd, 380.16);
  // largest warm N = floor((TTL - generation) / R) + 1 = floor(4 / 3) + 1 = 2
  assert.equal(R.s5.largestWarmN, 2);
  // max minutes each = (5 - 1) / (5 - 1) = 1
  close(R.s5.maxMinutesEach, 1);
});

test('scenario 5 largest warm N = floor((TTL - generation) / R) + 1 at 1 h', () => {
  const st = M.defaultState('claude-code-api-1h', 'claude-opus-5-5');
  // floor(59 / 3) + 1 = 20
  assert.equal(M.computeAll(st).s5.largestWarmN, 20);
});

test('scenario 6 Monthly budget', () => {
  const s = R.s6;
  // extras: 7.68 + 19.20 + 11.52 + 13.44 + 17.28 = 69.12
  close(s.extraDayUsd, 69.12);
  // warm request: 0.2 x 0.2 + 0.002 x 5 + 0.0008 x 20 = 0.066; x 400 = 26.40
  close(s.warmDayUsd, 26.4);
  close(s.realDayUsd, 95.52);
  close(s.realMonthUsd, 2101.44);
  close(s.warmMonthUsd, 580.8);
  // no cache: (0.2 + 0.002) x 4 + 0.0008 x 20 = 0.824; x 400 x 22 = 7251.20
  close(s.noCacheMonthUsd, 7251.2);
  close(s.rewriteShare, 69.12 / 95.52);
  close(s.daysReal, 200 / 95.52);
  close(s.daysWarm, 200 / 26.4);
});

test('TTL comparison strip', () => {
  const rows = Object.fromEntries(R.strip.rows.map((r) => [r.id, r]));
  close(rows.ttl5.dayUsd, 69.12);
  assert.equal(rows.ttl5.isYours, true);
  close(rows.ttl30.dayUsd, 0);
  assert.equal(rows.ttl30.hypothetical, true); // no 30-minute tier on Claude
  // 1 h: no gap over 60 min. Written per day = max(400 x 2,000 = 0.8M, contexts) where contexts =
  // 400K main + 400K hub + 12 x 100K spokes + 5 x 180K agents = 2.9M -> 2.9 x (8 - 5) = 8.70
  assert.equal(R.strip.writtenTokensPerDay, 2900000);
  close(rows.ttl60.premiumUsd, 8.7);
  close(rows.ttl60.dayUsd, 8.7);
  // agent poll every 4 min, gaps include 1 min generation; poll = 0.0855 (400K), 0.0255 (100K), 0.0415 (180K)
  // s1 16 min: 3 x 0.0855 x 4 = 1.026; s2 9: 2 x 0.0855 x 10 = 1.71; s3 13: 3 x 0.0855 x 6 = 1.539;
  // hub 13: 3 x 0.0855 x 3 = 0.7695; spokes 8: 1 x 0.0255 x 12 = 0.306; duck 9: 2 x 0.0855 = 0.171;
  // s5 13: 3 x 0.0415 x 20 = 2.49. Total 8.0115
  close(rows.heartbeat.dayUsd, 8.0115);
  // bare keep-alive read (F14, C x read only): 0.96 + 1.6 + 1.44 + 0.72 + 0.24 + 0.16 + 2.16 = 7.28
  close(rows.heartbeat.bareUsd, 7.28);
  close(rows.ttl5.monthUsd, 69.12 * 22);
  assert.equal(R.strip.yours.shown, false);
});

test('TTL strip heartbeat with a poll interval above the TTL: the final resume is warm when the rest fits', () => {
  const r = M.computeAll({ ...D, 'strip.heartbeat': 6, 'g.genMin': 0 });
  const hb = r.strip.rows.find((x) => x.id === 'heartbeat');
  // the finding's reference value (gaps without generation time)
  close(hb.dayUsd, 114.89, 0.005);
});

test('TTL strip on a subscription: per-bucket premium and a "Your setup" tile for the mixed TTLs', () => {
  const r = M.computeAll(M.defaultState('claude-code-subscription', 'claude-opus-5-5'));
  const rows = Object.fromEntries(r.strip.rows.map((x) => [x.id, x]));
  close(rows.ttl5.rewriteUsd, 69.12);
  // main contexts 0.4 + 0.4 + 0.9 = 1.7M x (5 - 8) = -5.10; spokes 1.2M already at 5 -> 0
  close(rows.ttl5.premiumUsd, -5.1);
  close(rows.ttl5.dayUsd, 64.02);
  // 1 h: spokes 1.2M x (8 - 5) = 3.60, no misses
  close(rows.ttl60.dayUsd, 3.6);
  // your setup: main 60 min (warm), subagents 5 min: 12 spokes x 0.48 = 5.76
  assert.equal(r.strip.yours.shown, true);
  close(r.strip.yours.dayUsd, 5.76);
});

test('TTL strip on long-context Haiku 5.5 uses the tile\'s long-context write price', () => {
  const a = M.computeAll(M.defaultState('claude-code-api-1h', 'claude-haiku-5-5'));
  const rows = Object.fromEntries(a.strip.rows.map((x) => [x.id, x]));
  // every event is above 100K with new input, so 5-min tile = C x (0.625 - 0.05):
  // s1 4 x 0.23 + s2 10 x 0.23 + s3 6 x 0.23 + hub 3 x 0.23 + spokes 12 x 0.0575 + duck 0.23 + s5 20 x 0.1035 = 8.28
  close(rows.ttl5.rewriteUsd, 8.28);
  // premium 2.9M x (0.625 - 1.00) = -1.0875
  close(rows.ttl5.premiumUsd, -1.0875);
  const b = M.computeAll(M.defaultState('claude-code-api-5m', 'claude-haiku-5-5'));
  close(b.strip.rows.find((x) => x.id === 'ttl60').premiumUsd, 1.0875);
});

test('long-context premium: Haiku 5.5 above 100K, GPT-5.6 Sol above 272K', () => {
  const h = M.computeAll(M.defaultState('copilot-claude', 'claude-haiku-5-5'));
  close(h.missUsd, 0.4 * (0.625 - 0.05));
  const g = M.computeAll(M.defaultState('copilot-gpt', 'gpt-5-6-sol'));
  assert.equal(g.rates.ttlMain, 30);
  close(g.missUsd, 0.4 * (10 - 0.8));
});

test('long-context threshold counts the new input too (F3): a 100K Haiku 5.5 spoke is priced above 100K', () => {
  const rates = M.ratesFromState(M.defaultState('copilot-claude', 'claude-haiku-5-5'));
  // 100,000 + 2,000 new > 100,000 -> 0.1 x (0.625 - 0.05) = 0.0575
  close(M.missExtraUsd(rates, 100000, 'sub'), 0.0575);
  const r0 = M.ratesFromState({ ...M.defaultState('copilot-claude', 'claude-haiku-5-5'), 's6.newTok': 0 });
  close(M.missExtraUsd(r0, 100000, 'sub'), 0.0115);
});

test('GPT gaps of 5-30 min miss at 1 - hit rate (E4 77%), not 0', () => {
  const g = M.computeAll(M.defaultState('copilot-gpt', 'gpt-5-6-sol'));
  // reading 8 + 1 = 9 min: 0.23 x 0.4 x (10 - 0.8) = 0.8464
  close(g.s2.perEventUsd, 0.8464);
  close(g.s1.perEventUsd, 0.8464);
  assert.equal(g.s2.partial, true);
  const g95 = M.computeAll({ ...M.defaultState('copilot-gpt', 'gpt-5-6-sol'), 'g.gptHit': 95 });
  close(g95.s2.perEventUsd, 0.05 * 3.68);
  // a gap of 4 min (3 + 1) is a sure hit
  close(M.computeAll({ ...M.defaultState('copilot-gpt', 'gpt-5-6-sol'), 's2.minutes': 3 }).s2.perEventUsd, 0);
});

test('GPT polling break-even inside the lifetime uses the expected miss, (1 - hit rate) x miss', () => {
  const st = { ...M.defaultState('copilot-gpt', 'gpt-5-6-sol'), 's3.poll': true };
  const s3 = M.computeAll(st).s3; // wait 12 + 1 = gap 13, inside the 30-min lifetime
  // one poll = 0.4 x 0.80 + 200 x 30 / 1e6 + 300 x 10 / 1e6 = 0.329; miss = 0.4 x (10 - 0.8) = 3.68
  close(s3.poll.pollUsd, 0.329);
  // 3 polls x 0.329 = 0.987 > 0.23 x 3.68 = 0.8464: polling loses at this wait
  close(s3.perEventUsd, 0.987);
  close(s3.baseUsd, 0.8464);
  // expected break-even 0.8464 / 0.329 = 2.57 polls -> gaps up to 3 x 3.5 = 10.5 min (wait 9.5)
  close(s3.poll.partialMaxGapMin, 10.5);
  close(s3.partialMaxWaitMin, 9.5);
  // past the lifetime a miss is certain: 3.68 / 0.329 = 11.19 polls -> gaps up to 12 x 3.5 = 42 min
  close(s3.poll.maxWorthwhileGapMin, 42);
  const at = (w) => M.computeAll({ ...st, 's3.minutes': w }).s3;
  assert.ok(at(9.5).perEventUsd < at(9.5).baseUsd); // gap 10.5: 2 polls 0.658 < 0.8464
  assert.ok(at(10).perEventUsd > at(10).baseUsd); // gap 11: 3 polls 0.987 > 0.8464
  assert.ok(at(35).perEventUsd < at(35).baseUsd); // gap 36 > 30: certain miss, 10 polls 3.29 < 3.68
  // Claude has no partial window
  assert.equal(R.s3.poll.partialMaxGapMin, null);
  // a 100% hit rate leaves nothing to save inside the window
  assert.equal(M.computeAll({ ...st, 'g.gptHit': 100 }).s3.poll.partialMaxGapMin, 0);
});

test('GPT-6.1 Sol above 272K uses the published long-context row (F46, checked 2026-10-30)', () => {
  const r = M.computeAll(M.defaultState('copilot-gpt', 'gpt-6-1-sol'));
  assert.equal(r.main.long, true);
  close(r.coldResumeUsd, 2.0); // 0.4 x 5.00
  close(r.missUsd, 1.92); // 0.4 x (5.00 - 0.20 read)
  assert.equal(M.fieldStatus('copilot-gpt', 'gpt-6-1-sol')['r.lcRead'], undefined);
  assert.equal(M.fieldStatus('copilot-gpt', 'gpt-6-1-sol')['r.lcWriteMain'], undefined);
});

test('providers without write surcharge write at base input (GPT-5.3-Codex)', () => {
  const r = M.computeAll(M.defaultState('copilot-gpt', 'gpt-5-3-codex'));
  close(r.rates.writeMain, 1.75);
  close(r.missUsd, 0.4 * (1.75 - 0.175));
});

test('Cursor Teams flat surcharge leaves the miss extra unchanged', () => {
  const r = M.computeAll(M.defaultState('cursor-teams-claude', 'claude-opus-5-5'));
  close(r.rates.read, 0.45);
  close(r.rates.writeMain, 5.25);
  close(r.missUsd, 1.92);
  assert.equal(r.missCredits, null);
});

test('profiles filter models by provider', () => {
  assert.ok(M.allowedModels('copilot-gpt').every((m) => m.provider === 'openai'));
  assert.ok(M.allowedModels('claude-code-api-5m').every((m) => m.provider === 'anthropic'));
  assert.equal(M.defaultState('copilot-gpt')['g.model'], 'gpt-5-6-sol');
});

test('unverified badges', () => {
  assert.equal(M.fieldStatus('copilot-claude', 'claude-opus-5-5')['g.window'].status, 'unverified');
  assert.equal(M.fieldStatus('claude-code-subscription', 'claude-opus-5-5')['r.ttlMain'].status, 'unverified');
  assert.equal(M.fieldStatus('copilot-gpt', 'gpt-6-astra')['r.read'].status, 'unverified');
  assert.equal(M.fieldStatus('claude-code-api-5m', 'claude-opus-5-5')['g.window'], undefined);
  assert.equal(M.fieldStatus('claude-code-api-5m', 'claude-opus-5-5')['r.read'], undefined);
});

test('per-tool verified model lists', () => {
  // F45 does not list Haiku 5.5 or Opus 4.5 in Copilot
  assert.equal(M.fieldStatus('copilot-claude', 'claude-haiku-5-5')['r.read'].status, 'unverified');
  assert.equal(M.fieldStatus('copilot-claude', 'claude-haiku-5-5')['r.lcRead'].status, 'unverified');
  assert.equal(M.fieldStatus('copilot-claude', 'claude-opus-4-5')['r.writeMain'].status, 'unverified');
  assert.equal(M.fieldStatus('copilot-claude', 'claude-sonnet-5-5')['r.read'], undefined);
  // Cursor's Models & Pricing table (2026-11-01) lists Sonnet 5.5 and GPT-5.6 Sol at the model.js rates
  assert.equal(M.fieldStatus('cursor-claude', 'claude-sonnet-5-5')['r.read'], undefined);
  assert.equal(M.fieldStatus('cursor-claude', 'gpt-5-6-sol')['r.read'], undefined);
  // Cursor GPT-5.3-Codex: no Cursor TTL source for this model; F66 (staff on older OpenAI models) is the closest
  assert.deepEqual(M.fieldStatus('cursor-claude', 'gpt-5-3-codex')['r.ttlMain'].facts, ['F66']);
  // Copilot TTLs come from client source, not GitHub docs
  assert.equal(M.fieldStatus('copilot-claude', 'claude-opus-5-5')['r.ttlMain'].status, 'source');
  assert.equal(M.fieldStatus('copilot-gpt', 'gpt-5-6-sol')['r.ttlMain'].status, 'source');
  // F53: GitHub's tutorial says 24 h for OpenAI models and 1 h for most others
  assert.match(M.fieldStatus('copilot-gpt', 'gpt-5-6-sol')['r.ttlMain'].note, /24 h for OpenAI models/);
  assert.match(M.fieldStatus('copilot-claude', 'claude-opus-5-5')['r.ttlMain'].note, /1 h for most models/);
  // Opus is not on Copilot Pro (F48)
  assert.ok(R.warnings.some((w) => /not on Copilot Pro/.test(w)));
});

test('URL hash round trip', () => {
  const st = { ...M.defaultState('cursor-claude', 'claude-sonnet-5-5'), 's1.minutes': 22, 's3.poll': true, 'r.read': 0.15 };
  const hash = M.encodeState(st);
  const back = M.decodeState('#' + hash);
  assert.deepEqual(back, st);
  assert.equal(M.encodeState(M.defaultState()), 'g.profile=copilot-claude&g.model=claude-opus-5-5');
});

test('unknown ui.focus in the hash falls back to scenario 1', () => {
  assert.equal(M.decodeState('#ui.focus=s9&ui.rec=1')['ui.focus'], 's1');
  assert.equal(M.decodeState('#ui.focus=s4')['ui.focus'], 's4');
});

// ---------------------------------------------------------------------------
// Cursor facts re-checked 2026-11-01 (cursor.com/docs/models-and-pricing and model pages)
// ---------------------------------------------------------------------------

test('Cursor does not offer GPT-6 / 6.1 or Opus 4.5', () => {
  for (const p of ['cursor-claude', 'cursor-teams-claude']) {
    const ids = M.allowedModels(p).map((m) => m.id);
    for (const gone of ['gpt-6-1-sol', 'gpt-6-astra', 'claude-opus-4-5']) assert.ok(!ids.includes(gone), p + ' ' + gone);
    assert.ok(ids.includes('gpt-5-6-sol') && ids.includes('gpt-5-6-luna'));
  }
  // A shared link with Cursor + GPT-6.1 Sol falls back to the profile default
  assert.equal(M.decodeState('g.profile=cursor-claude&g.model=gpt-6-1-sol')['g.model'], 'claude-opus-5-5');
  // Copilot keeps them
  assert.ok(M.allowedModels('copilot-gpt').some((m) => m.id === 'gpt-6-1-sol'));
});

test('Cursor Teams exempts GPT-5.6 Luna from the Token Rate', () => {
  const st = M.defaultState('cursor-teams-claude', 'gpt-5-6-luna');
  assert.equal(st['r.input'], 0.2);
  assert.equal(st['r.read'], 0.02);
  assert.equal(st['r.writeMain'], 0.25);
  // Sol still pays it
  assert.equal(M.defaultState('cursor-teams-claude', 'gpt-5-6-sol')['r.read'], 0.65);
});

test('GPT-5.6 Luna long context starts at 272K in Cursor, 200K in Copilot', () => {
  assert.equal(M.defaultState('cursor-claude', 'gpt-5-6-luna')['r.lcThreshold'], 272000);
  assert.equal(M.defaultState('copilot-gpt', 'gpt-5-6-luna')['r.lcThreshold'], 200000);
  // 250K context: base rate in Cursor, long-context rate in Copilot
  const at250 = (p) => M.computeAll({ ...M.defaultState(p, 'gpt-5-6-luna'), 'g.fillPct': 25 });
  assert.equal(at250('cursor-claude').main.long, false);
  assert.equal(at250('copilot-gpt').main.long, true);
});

test('TTL strip: no 1-hour lifetime in Cursor or Copilot, still one in Claude Code', () => {
  const row = (p) => M.computeAll(M.defaultState(p, 'claude-opus-5-5')).strip.rows.find((r) => r.id === 'ttl60');
  assert.equal(row('cursor-claude').hypothetical, true);
  assert.equal(row('cursor-teams-claude').hypothetical, true);
  assert.equal(row('claude-code-api-5m').hypothetical, false);
  // F47: Copilot lists no 1-hour write price; F50: its 1-hour setting skips Claude 5.x
  assert.equal(row('copilot-claude').hypothetical, true);
  assert.match(row('copilot-claude').note, /no 1-hour write price/);
  assert.equal(M.fieldStatus('copilot-claude', 'claude-opus-5-5')['r.write1h'].status, 'unverified');
  assert.equal(M.fieldStatus('claude-code-api-5m', 'claude-opus-5-5')['r.write1h'], undefined);
  // with a 2-min poll the 1 h tile ($8.70/day) is no longer a "real option"; the agent poll is the cheapest real one
  const r = M.computeAll({ ...M.defaultState('copilot-claude', 'claude-opus-5-5'), 'strip.heartbeat': 2 });
  const best = r.strip.rows.filter((x) => !x.hypothetical).sort((a, b) => a.dayUsd - b.dayUsd)[0];
  assert.equal(best.id, 'heartbeat');
});

test('Cursor context windows: default window warning, documented windows carry no badge', () => {
  const r = M.computeAll(M.defaultState('cursor-claude', 'claude-opus-5-5')); // C = 40% of 1M = 400K
  assert.ok(r.warnings.some((w) => /default context window of Claude Opus 5\.5 in Cursor \(300000\)/.test(w)));
  assert.equal(M.fieldStatus('cursor-claude', 'gpt-5-6-sol')['g.window'], undefined);
  assert.equal(M.defaultState('cursor-claude', 'gpt-5-3-codex')['g.window'], 272000);
  // Copilot keeps the placeholder badge for GPT-5.6 Sol
  assert.equal(M.fieldStatus('copilot-gpt', 'gpt-5-6-sol')['g.window'].status, 'unverified');
});

test('Cursor + GPT shows the OpenAI shutoff notice, nothing else does', () => {
  // OpenAI's own words: "a proposed shutoff date of November 12, 2026"
  assert.equal(M.shutoffNotice('cursor-claude', 'gpt-5-6-sol', '2026-11-01'), 'OpenAI has proposed ending GPT access in Cursor on November 12, 2026. These numbers may stop applying then.');
  // from the date on: past tense and a check, never a future-tense promise
  assert.equal(M.shutoffNotice('cursor-claude', 'gpt-5-6-sol', '2026-11-12'), 'OpenAI proposed ending GPT access in Cursor on November 12, 2026. Check that Cursor still offers GPT-5.6 Sol before you rely on these numbers.');
  assert.match(M.shutoffNotice('cursor-claude', 'gpt-5-6-sol', '2027-01-05'), /^OpenAI proposed /);
  assert.ok(M.shutoffNotice('cursor-teams-claude', 'gpt-5-3-codex'));
  assert.equal(M.shutoffNotice('cursor-claude', 'claude-opus-5-5'), null);
  assert.equal(M.shutoffNotice('copilot-gpt', 'gpt-5-6-sol'), null);
});

test('GPT-5.6 Sol warns that its price is promotional (F85), other models do not', () => {
  const w = (p, m) => M.computeAll(M.defaultState(p, m)).warnings.join(' ');
  assert.match(w('copilot-gpt', 'gpt-5-6-sol'), /promotional rate, promised at least through November 21, 2026 \(F85\)/);
  assert.match(w('cursor-claude', 'gpt-5-6-sol'), /promotional/);
  assert.doesNotMatch(w('copilot-gpt', 'gpt-6-1-sol'), /promotional/);
});

test('Cursor GPT hit rate is flagged as measured in Copilot', () => {
  assert.equal(M.fieldStatus('cursor-claude', 'gpt-5-6-sol')['g.gptHit'].status, 'source');
  assert.equal(M.fieldStatus('copilot-gpt', 'gpt-5-6-sol')['g.gptHit'], undefined);
});
