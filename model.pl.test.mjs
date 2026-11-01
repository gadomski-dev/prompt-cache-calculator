// Run: node --test model.pl.test.mjs
// The Polish layer (model.pl.js) must translate every sentence model.js returns and change no number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const EN = require('./model.js');
delete require.cache[require.resolve('./model.js')];
const PL = require('./model.pl.js'); // localizes its own fresh copy of model.js
const NB = ' ';

/** States that reach every branch with text: all tool + model pairs, plus the edge cases below. */
function states() {
  const out = [];
  EN.PROFILES.forEach((p) => EN.allowedModels(p.id).forEach((m) => {
    const d = EN.defaultState(p.id, m.id);
    out.push(d);
    out.push({ ...d, 'g.useAbs': true, 'g.absTokens': 1500000, 'g.window': 1000000 }); // C > window, long context
    out.push({ ...d, 'strip.heartbeat': 70, 's1.poll': true, 's1.pollEvery': 70, 's4.layout': 'code' }); // polls miss
    out.push({ ...d, 's4.layout': 'sequential', 's1.inc': false, 's2.inc': false, 's3.inc': false, 's4.inc': false, 's5.inc': false });
  }));
  return out;
}

/** Every number in a, at the same path in b. Strings are skipped: they are the translated part. */
function sameNumbers(a, b, path = 'R') {
  if (typeof a === 'number') { assert.ok(Object.is(a, b), `${path}: EN ${a}, PL ${b}`); return; }
  if (typeof a === 'boolean' || a == null) { assert.equal(a, b, path); return; }
  if (typeof a !== 'object') return;
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path);
  Object.keys(a).forEach((k) => sameNumbers(a[k], b[k], path + '.' + k));
}

test('PL numbers are identical to EN for every tool + model pair and edge state', () => {
  states().forEach((st) => sameNumbers(EN.computeAll(st), PL.computeAll({ ...st })));
});

test('PL fieldStatus keeps keys, statuses and facts', () => {
  EN.PROFILES.forEach((p) => EN.allowedModels(p.id).forEach((m) => {
    const en = EN.fieldStatus(p.id, m.id), pl = PL.fieldStatus(p.id, m.id);
    assert.deepEqual(Object.keys(pl), Object.keys(en));
    Object.keys(en).forEach((k) => {
      assert.equal(pl[k].status, en[k].status);
      assert.deepEqual(pl[k].facts, en[k].facts);
      assert.notEqual(pl[k].note, en[k].note, `${p.id} / ${m.id} / ${k} note untranslated`);
    });
  }));
});

test('no sentence from model.js is left in English', () => {
  states().forEach((st) => PL.computeAll(st));
  EN.PROFILES.forEach((p) => EN.allowedModels(p.id).forEach((m) => PL.fieldStatus(p.id, m.id)));
  assert.deepEqual(PL.PL.missing, []);
});

test('the English model stays English', () => {
  assert.equal(EN.findModel('claude-opus-5').label, 'Claude Opus 5 (legacy)');
  assert.equal(EN.SCENARIOS[0].name, 'Break');
  assert.equal(PL.findModel('claude-opus-5').label, 'Claude Opus 5 (starszy)');
  assert.equal(PL.SCENARIOS[0].name, 'Przerwa');
  assert.ok(EN.computeAll(EN.defaultState()).warnings.some((w) => /not on Copilot Pro/.test(w)));
  assert.ok(PL.computeAll(PL.defaultState()).warnings.some((w) => /nie jest dostępny w Copilot Pro/.test(w)));
});

test('URL hash is shared: the same string decodes to the same state in both languages', () => {
  const st = { ...EN.defaultState('cursor-claude', 'claude-sonnet-5-5'), 's1.minutes': 22, 's3.poll': true, 'r.read': 0.15 };
  const hash = EN.encodeState(st);
  assert.equal(PL.encodeState(st), hash);
  assert.deepEqual(PL.decodeState('#' + hash), EN.decodeState('#' + hash));
});

test('Polish number format: decimal comma, non-breaking thousands, currency after the number', () => {
  const f = PL.PL.fmt;
  assert.equal(f.usd(1.92), '1,92' + NB + '$');
  assert.equal(f.usd(14.4), '14,40' + NB + '$');
  assert.equal(f.usd(0.08), '0,080' + NB + '$');
  assert.equal(f.usd(2101.4), '2' + NB + '101' + NB + '$');
  assert.equal(f.usd(-1.2), '−1,20' + NB + '$');
  assert.equal(f.num(1440), '1' + NB + '440');
  assert.equal(f.num(400000), '400' + NB + '000');
  assert.equal(f.num(1.5), '1,5');
  assert.equal(f.num(5, 2, 4), '5,00');
  assert.equal(f.num(0.125, 2, 4), '0,125');
  const kredyt = ['kredyt', 'kredyty', 'kredytów', 'kredytu'];
  assert.deepEqual([1, 2, 4, 5, 12, 14, 22, 192, 1440, 2.5].map((n) => f.plural(n, kredyt)),
    ['kredyt', 'kredyty', 'kredyty', 'kredytów', 'kredytów', 'kredytów', 'kredyty', 'kredyty', 'kredytów', 'kredytu']);
});
