/*
 * Polish text for model.js. index.pl.html loads it right after model.js.
 *
 * model.js stays the only source of the maths and of the English text, and this file never computes
 * a cost. It does two things:
 *   1. swaps the English labels and notes of the constants (models, profiles, assumptions,
 *      scenarios) by id;
 *   2. wraps the two exported functions that build English sentences, fieldStatus and computeAll,
 *      and translates only the strings they return. Numbers, keys, statuses and fact ids pass
 *      through untouched, so EN and PL show the same results for the same URL hash.
 *
 * A sentence with no Polish rule stays in English and is recorded in CacheModel.PL.missing, so a new
 * English sentence in model.js shows up instead of hiding (model.pl.test.mjs checks every
 * tool + model pair).
 *
 * Browser: localizes window.CacheModel in place. Node: module.exports = the localized model.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model.js'));
  } else {
    factory(root.CacheModel);
  }
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  if (!M) return M;

  // ---------------------------------------------------------------------------
  // Polish number formatting: decimal comma, non-breaking space between thousands,
  // currency after the number ("1 440,50 $"). Shared with index.pl.html via CacheModel.PL.fmt.
  // ---------------------------------------------------------------------------

  var NB = ' ';

  /** "1234567" -> "1 234 567" (non-breaking spaces). Polish CLDR skips 4-digit grouping; this does not. */
  function group(digits) { return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }

  /** Like toLocaleString with minimumFractionDigits / maximumFractionDigits (default 0 / 3), in Polish. */
  function num(x, minFrac, maxFrac) {
    x = +x;
    if (x === Infinity) return '∞';
    if (!isFinite(x)) return '–';
    minFrac = minFrac || 0;
    maxFrac = maxFrac == null ? 3 : Math.max(minFrac, maxFrac);
    var s = Math.abs(x).toFixed(maxFrac);
    var i = s.indexOf('.');
    var ip = i < 0 ? s : s.slice(0, i), fp = i < 0 ? '' : s.slice(i + 1);
    while (fp.length > minFrac && fp.charAt(fp.length - 1) === '0') fp = fp.slice(0, -1);
    var neg = x < 0 && /[1-9]/.test(ip + fp);
    return (neg ? '−' : '') + group(ip) + (fp ? ',' + fp : '');
  }

  /** Same thresholds as the English fmtUsd: 4 decimals below $0.01, 3 below $0.10, whole dollars from $1,000. */
  function usd(x) {
    if (x === Infinity) return '∞';
    if (!isFinite(x)) return '–';
    var a = Math.abs(x);
    var sign = x < -5e-5 ? '−' : '';
    var s;
    if (a >= 1000) s = group(String(Math.round(a)));
    else if (a >= 5e-5 && a < 0.01) s = a.toFixed(4).replace('.', ',');
    else if (a >= 5e-5 && a < 0.1) s = a.toFixed(3).replace('.', ',');
    else s = a.toFixed(2).replace('.', ',');
    return sign + s + NB + '$';
  }

  /**
   * Polish plural form. forms = [one, few, many, fraction]: 1 kredyt, 2 kredyty, 5 kredytów,
   * 2,5 kredytu. 12-14 take "many"; a non-integer takes "fraction" (or "many" when not given).
   */
  function plural(n, forms) {
    n = Math.abs(+n);
    if (n !== Math.floor(n)) return forms[3] || forms[2];
    if (n === 1) return forms[0];
    var t = n % 10, h = n % 100;
    if (t >= 2 && t <= 4 && !(h >= 12 && h <= 14)) return forms[1];
    return forms[2];
  }

  /** Number parsed from an English sentence, back in Polish format. */
  function pn(s) { return num(parseFloat(s)); }

  // ---------------------------------------------------------------------------
  // Constants by id
  // ---------------------------------------------------------------------------

  var MODEL_PL = {
    'claude-opus-5-5': {
      note: 'Te same stawki w Anthropic API, Copilocie i Cursorze (konto indywidualne). Copilot podaje tylko cenę zapisu 5 min. Okno kontekstu w Copilocie niezweryfikowane (zmierzono sesję 540K). Tokenizer modeli 4.7+ daje ~30% więcej tokenów niż Opus 4.6/4.5 dla tego samego tekstu (F11).'
    },
    'claude-sonnet-5-5': { note: 'Odczyt z cache obniżony z 0,20 do 0,10 dnia 2026-10-07. Dostępny w Copilot Pro.' },
    'claude-haiku-5-5': { note: 'Próg liczy cały input, także odczyty i zapisy cache; każde zapytanie jest wyceniane osobno.' },
    'claude-fable-5-1': { note: 'Odczyt to 0,025× input. Niedostępny w Copilot Pro.' },
    'claude-opus-5': { label: 'Claude Opus 5 (starszy)', note: 'Ceny jak w Opus 4.8 / 4.7 / 4.6 / 4.5.' },
    'claude-opus-4-8': { label: 'Claude Opus 4.8 (starszy)', note: 'Obejmuje go eksperymentalny TTL 1 h w Copilocie w VS Code (domyślnie wyłączony).' },
    'claude-opus-4-5': { label: 'Claude Opus 4.5 (starszy)', note: 'Starszy tokenizer: ten sam tekst to ~30% mniej tokenów niż w Opus 4.7+.' },
    'gpt-5-6-sol': {
      note: 'Zapis kosztuje 1,25× input przy domyślnym minimalnym czasie życia 30 min (opcja 12 h za 2,5×, tylko Responses API, według cennika Copilot jej nie używa). Cena promocyjna co najmniej do 2026-11-21. Okno kontekstu niezweryfikowane, więc null.'
    },
    'gpt-6-1-sol': {
      note: 'Odczyt to 0,05×. Powyżej 272K: 4,00 / 0,20 / 5,00 / 15,00 (cennik Copilota i cennik OpenAI API, sprawdzone 2026-10-30).'
    },
    'gpt-6-astra': { note: 'Zweryfikowana cena z cennika OpenAI API; wiersza Copilota dla tego modelu nie sprawdzono.' },
    'gpt-5-6-luna': { note: 'Próg długiego kontekstu to 200K w Copilocie i 272K w Cursorze (profile Cursora go nadpisują). Stawki takie same.' },
    'gpt-5-3-codex': {
      note: 'Model sprzed 5.6: bez dopłaty za zapis do cache, miss kosztuje zwykły input. Wycofany z OpenAI API. TTL w Copilocie zależy od żądanej retencji (VS Code: 24 h; CLI: niezweryfikowane). W Cursorze: ukryty domyślnie, okno kontekstu 272K.'
    }
  };

  var PROFILE_PL = {
    'claude-code-subscription': {
      short: 'Claude Code, abonament',
      label: 'Claude Code w abonamencie Claude (w limicie planu)',
      note: '60 dotyczy tylko głównej rozmowy. Subagenci, agenci workflow/ultracode, teammates, forki i kompaktowanie dostają 5, chyba że subagentPromptCacheTtl to "1h". Otwarta regresja #103673: interaktywne CLI zapisuje 5m od ok. 2026-10-14, więc sprawdź ephemeral_1h_input_tokens albo ustaw promptCacheTtl "1h".'
    },
    'claude-code-api-5m': {
      short: 'Claude Code, klucz API, 5 min',
      label: 'Claude Code z kluczem API, domyślny TTL 5 min',
      note: 'Domyślnie dla klucza API, Bedrocka, Google Cloud i Foundry. Inferencja tylko w USA mnoży każdą kategorię przez 1,1 (F12).'
    },
    'claude-code-api-1h': {
      short: 'Claude Code, klucz API, 1 h',
      label: 'Claude Code z kluczem API, TTL 1 h',
      note: 'Ustaw promptCacheTtl i subagentPromptCacheTtl na "1h" albo ENABLE_PROMPT_CACHING_1H=1. Bez przerw domyślne 5m jest tańsze o 15–19%. Wybierz na starcie rozmowy.'
    },
    'cursor-claude': {
      short: 'Cursor, konto indywidualne',
      label: 'Cursor (indywidualny Premium/Super/Ultra) z Claude lub GPT',
      note: 'TTL pochodzi z postów pracowników na forum, nie z dokumentacji. openai 30 dotyczy GPT-5.6 (pracownicy, lipiec 2026); od 2026-10-20 OpenAI oferuje też 12 godzin, a Cursor nie powiedział, czy z tego korzysta (jego cena zapisu 1,25× pasuje do 30 min). Starsze modele OpenAI „24 godziny” według pracowników, co OpenAI opisuje jako górną granicę, zwykle ok. 30 min. Endpointy regionalne i tylko w USA +10%. Starsze plany Pro/Pro+/Ultra mają wliczoną pulę Other Models, której tu nie liczymy.'
    },
    'cursor-teams-claude': {
      short: 'Cursor, Teams/Enterprise',
      label: 'Cursor Teams/Enterprise z Claude lub GPT',
      note: 'Cena z cennika API plus stałe 0,25 USD za milion tokenów na input, output, odczyty i zapisy cache. Haiku 5.5 i GPT-5.6 Luna zwolnione.'
    },
    'copilot-claude': {
      short: 'Copilot, kredyty AI, Claude',
      label: 'GitHub Copilot (kredyty AI) z Claude',
      note: '5 min pochodzi z kodu VS Code i logów Copilot CLI, GitHub tego nie podaje (tutorial GitHuba błędnie mówi 1 h). Modele Opus tylko w Pro+ i Max.'
    },
    'copilot-gpt': {
      short: 'Copilot, kredyty AI, GPT',
      label: 'GitHub Copilot (kredyty AI) z GPT-5.6 lub nowszym',
      note: '30 to minimalny czas życia odświeżany przy każdym odczycie (dokumentacja OpenAI), zgodny z logami Copilot CLI (1800 s); GitHub tego nie podaje. Dla GPT-5.3-Codex VS Code żąda retencji 24 h; zachowanie CLI niezweryfikowane.'
    }
  };

  var ASSUMPTION_PL = {
    pollOutputTokens: 'remedies.md, sekcja 0: ping dodaje ok. 200 tokenów output',
    pollNewInputTokens: 'remedies.md, sekcja 0: ping dodaje ok. 300 nowych tokenów input',
    heartbeatMinutes: 'F14: keep-alive Anthropic ponawia zapytanie co 4 minuty',
    generationMinutes: 'F8: TTL liczy się od startu zapytania; ok. 1 minuta generowania na turę agenta to założenie',
    gptHitPct: 'E4: 77% wywołań GPT 5–30 min po poprzednim trafiło w cache (243 z 314 wywołań GPT, jedno konto, copilot-powerline #67); E2: ~95% po 11 min. Oba pomiary z Copilota; dla Cursora pomiaru nie ma'
  };

  var SCENARIO_PL = {
    s1: 'Przerwa', s2: 'Czytanie odpowiedzi', s3: 'Długie wywołanie narzędzia',
    s4: 'Orkiestrator czeka na subagentów', s5: 'Równoległe agenty w worktree',
    s6: 'Budżet miesięczny', strip: 'Porównanie TTL'
  };

  // Strings that are Polish already (applied below), so tr() does not report them as missing.
  var KNOWN_PL = {};
  function known(s) { if (s) KNOWN_PL[s] = true; return s; }

  M.MODELS.forEach(function (m) {
    var t = MODEL_PL[m.id];
    if (!t) return;
    if (t.label) m.label = known(t.label);
    if (t.note) m.note = known(t.note);
    if (t.unverified_note && m.long_context) m.long_context.unverified_note = known(t.unverified_note);
  });
  M.PROFILES.forEach(function (p) {
    var t = PROFILE_PL[p.id];
    if (!t) return;
    p.short = known(t.short); p.label = known(t.label); p.note = known(t.note);
  });
  Object.keys(ASSUMPTION_PL).forEach(function (k) { if (M.ASSUMPTIONS[k]) M.ASSUMPTIONS[k].source = known(ASSUMPTION_PL[k]); });
  M.SCENARIOS.forEach(function (s) { if (SCENARIO_PL[s.id]) s.name = known(SCENARIO_PL[s.id]); });

  // ---------------------------------------------------------------------------
  // Sentences built inside model.js functions: exact strings first, then patterns
  // ---------------------------------------------------------------------------

  var GITHUB_TTL_TAIL = ' GitHub nie podaje TTL; jego tutorial mówi 1 h dla większości modeli, czemu przeczą kod i pomiary (F53).';
  var CURSOR_TAIL = ' Nie ma tego w dokumentacji Cursora; może się zmienić bez zapowiedzi.';

  var EXACT = {
    // fieldStatus badges
    'unverified - edit me': 'niezweryfikowane – popraw',
    'from client source, not GitHub docs': 'z kodu klienta, nie z dokumentacji',
    'from staff forum posts, not docs': 'od pracowników na forum, nie z dokumentacji',
    // fieldStatus notes
    'Context window of Claude inside Copilot is not verified; a 540K session was measured (facts.md open question 2).':
      'Okno kontekstu Claude w Copilocie niezweryfikowane; zmierzono sesję 540K (facts.md, otwarte pytanie 2).',
    '5 min comes from the VS Code Copilot source and Copilot CLI logs (300 s). GitHub does not state a TTL; its own tutorial says 1 h for most models, which code and measurements contradict (F53).':
      '5 min pochodzi z kodu Copilota w VS Code i logów Copilot CLI (300 s).' + GITHUB_TTL_TAIL,
    '30 min comes from Copilot CLI logs (1800 s) and OpenAI docs. GitHub does not state a TTL; its own tutorial says 1 h for most models, which code and measurements contradict (F53).':
      '30 min pochodzi z logów Copilot CLI (1800 s) i dokumentacji OpenAI.' + GITHUB_TTL_TAIL,
    'Cursor staff on the forum: "5 minutes for Anthropic" (K4). Not in Cursor docs; can change without notice.':
      'Pracownicy Cursora na forum: „5 minut dla Anthropic” (K4).' + CURSOR_TAIL,
    'Cursor staff on the forum: "in the case of GPT 5.6 it would be 30 minutes" (F66, July 2026). Since 2026-10-20 OpenAI also offers 12 hours; Cursor has not said whether it uses it. Not in Cursor docs; can change without notice.':
      'Pracownicy Cursora na forum: „w przypadku GPT 5.6 będzie to 30 minut” (F66, lipiec 2026). Od 2026-10-20 OpenAI oferuje też 12 godzin; Cursor nie powiedział, czy z tego korzysta.' + CURSOR_TAIL,
    'measured in Copilot, not Cursor': 'zmierzone w Copilocie, nie w Cursorze',
    'The hit rate comes from Copilot logs (E4, one account). Nobody has measured it in Cursor.':
      'Odsetek trafień pochodzi z logów Copilota (E4, jedno konto). W Cursorze nikt go nie zmierzył.',
    'As announced by OpenAI, Cursor will no longer offer GPT models from November 12, 2026.':
      'Zgodnie z zapowiedzią OpenAI od 12 listopada 2026 Cursor nie będzie miał modeli GPT.',
    'Docs say 1 hour, but open regression #103673 reports 5-minute writes in the interactive CLI since about 2026-10-14. Check /usage or set "promptCacheTtl": "1h".':
      'Dokumentacja mówi 1 godzina, ale otwarta regresja #103673 zgłasza zapisy 5-minutowe w interaktywnym CLI od ok. 2026-10-14. Sprawdź /usage albo ustaw "promptCacheTtl": "1h".',
    'No Cursor source gives a TTL for GPT-5.3-Codex. Staff said "24 hours for most OpenAI models" (F66), which OpenAI calls a ceiling, typically about 30 minutes. 30 minutes is a placeholder.':
      'Żadne źródło Cursora nie podaje TTL dla GPT-5.3-Codex. Pracownicy mówili o „24 godzinach dla większości modeli OpenAI” (F66), co OpenAI opisuje jako górną granicę, zwykle ok. 30 minut. 30 minut to wartość zastępcza.',
    'GPT-5.3-Codex TTL depends on the retention the client requests (VS Code 24h; Copilot CLI undocumented).':
      'TTL GPT-5.3-Codex zależy od retencji, o którą prosi klient (VS Code 24 h; Copilot CLI bez dokumentacji).',

    // Scenario 4 lines (orchestratorScenario)
    'Hub resumes after each wave': 'Hub wraca po każdej fali',
    'Subagents resume after their tool wait': 'Subagenci wracają po czekaniu na narzędzie',
    'Rubber duck reads the handoff': 'Gumowa kaczka czyta plik przekazania',
    'Hub resumes after the duck discussion': 'Hub wraca po rozmowie z kaczką',
    'Hub context written at the longer-TTL price': 'Kontekst huba zapisany po cenie dłuższego TTL',
    'Subagent contexts written at the longer-TTL price': 'Konteksty subagentów zapisane po cenie dłuższego TTL',
    'Single agent resumes after each task\'s tool wait': 'Jeden agent wraca po czekaniu na narzędzie w każdym zadaniu',
    'Agent resumes after the duck discussion': 'Agent wraca po rozmowie z kaczką',
    'Agent context written at the longer-TTL price': 'Kontekst agenta zapisany po cenie dłuższego TTL',
    'Fresh patcher and rubber duck read the handoff file': 'Nowy agent naprawczy i kaczka czytają plik przekazania',
    'W x resume(C_o, D)': 'W × wznowienie(C_o, D)',
    'W x S x resume(C_s, wait)': 'W × S × wznowienie(C_s, czekanie)',
    'problems x H x write': 'problemy × H × zapis',
    'problems x resume(C_o, problem minutes)': 'problemy × wznowienie(C_o, minuty problemu)',
    'C_o x (write - 5-min write)': 'C_o × (zapis − zapis 5 min)',
    'W x S x C_s x (write - 5-min write)': 'W × S × C_s × (zapis − zapis 5 min)',
    'W x S x resume((C_s + C_o) / 2, wait)': 'W × S × wznowienie((C_s + C_o) / 2, czekanie)',
    'problems x resume((C_s + C_o) / 2, problem minutes)': 'problemy × wznowienie((C_s + C_o) / 2, minuty problemu)',
    '2 x problems x H x write': '2 × problemy × H × zapis',

    // TTL strip (ttlStrip)
    '5 min': '5 min', '30 min': '30 min', '1 h': '1 h',
    'Your setup': 'U ciebie',
    'no 5-minute tier on GPT: hypothetical at your write price': 'GPT nie ma progu 5 min: hipotetycznie po twojej cenie zapisu',
    'writes at the 5-minute price': 'zapis po cenie 5-minutowej',
    'writes at your (30-minute) write price': 'zapis po twojej (30-minutowej) cenie',
    'no 30-minute tier on Claude: hypothetical at the 5-minute price': 'Claude nie ma progu 30 min: hipotetycznie po cenie 5-minutowej',
    'no 1-hour tier on GPT: hypothetical at your write price': 'GPT nie ma progu 1 h: hipotetycznie po twojej cenie zapisu',
    'writes at the 1-hour price': 'zapis po cenie 1-godzinnej',
    'your tool offers no 1-hour lifetime: hypothetical at the 1-hour price': 'twoje narzędzie nie oferuje 1 h: hipotetycznie po cenie 1-godzinnej'
  };

  var RULES = [
    // fieldStatus: tool + model pair no source lists
    [/^No source lists (.+) rates in (.+); the vendor list price( plus the Cursor Token Rate)? is used\. Verified in this tool: (.+)\.$/, function (m) {
      return 'Żadne źródło nie podaje stawek ' + m[1] + ' w „' + m[2] + '”; użyto cennika dostawcy' + (m[3] ? ' plus Cursor Token Rate' : '') + '. Zweryfikowane w tym narzędziu: ' + m[4] + '.';
    }],
    [/^No verified context window for (.+) \(constants\.json has null\)\. 1,000,000 is a placeholder\.$/, function (m) {
      return 'Brak zweryfikowanego okna kontekstu dla ' + m[1] + ' (constants.json ma null). 1' + NB + '000' + NB + '000 to wartość przykładowa.';
    }],
    // computeAll warnings
    [/^Context C \((.+?)\) is larger than the context window \((.+?)\)\.$/, function (m) {
      return 'Kontekst C (' + pn(m[1]) + ') jest większy niż okno kontekstu (' + pn(m[2]) + ').';
    }],
    [/^(.+) above (\d+(?:\.\d+)?) tokens: only the \$(\d+(?:\.\d+)?) cache write is verified \(F46\); input, read and output of that tier are inferred or assumed\.$/, function (m) {
      return m[1] + ' powyżej ' + pn(m[2]) + ' tokenów: zweryfikowany jest tylko zapis do cache po ' + num(parseFloat(m[3]), 2, 2) + NB + '$ (F46); input, odczyt i output tego progu są wyliczone lub założone.';
    }],
    [/^Context C \((\d+)\) is above the default context window of (.+) in Cursor \((\d+)\); it needs the larger context setting \(up to (\d+)\)\.$/, function (m) {
      return 'Kontekst C (' + pn(m[1]) + ') przekracza domyślne okno kontekstu ' + m[2] + ' w Cursorze (' + pn(m[3]) + '); potrzebne jest większe ustawienie kontekstu (do ' + pn(m[4]) + ').';
    }],
    [/^(.+) is not on Copilot Pro, only on Pro\+ and Max \(F48\)\.$/, function (m) {
      return m[1] + ' nie jest dostępny w Copilot Pro, tylko w Pro+ i Max (F48).';
    }],
    // ttlStrip
    [/^Agent poll · (.+) min$/, function (m) { return 'Ping co ' + pn(m[1]) + NB + 'min'; }],
    [/^the agent polls every (.+?) min at your TTL, each poll = C × read \+ poll output \+ poll input( \(interval longer than TTL: polls miss\))?$/, function (m) {
      return 'agent pinguje co ' + pn(m[1]) + ' min przy twoim TTL, każdy ping = C × odczyt + output pinga + input pinga' +
        (m[2] ? ' (interwał dłuższy niż TTL: każdy ping to miss)' : '');
    }],
    [/^main (.+?) min, subagents (.+?) min, your write prices$/, function (m) {
      return 'główna rozmowa ' + pn(m[1]) + ' min, subagenci ' + pn(m[2]) + ' min, twoje ceny zapisu';
    }]
  ];

  var missing = [];

  /** Polish version of one English sentence from model.js. Unknown sentences stay English and are recorded. */
  function tr(s) {
    if (s == null || s === '' || typeof s !== 'string') return s;
    if (Object.prototype.hasOwnProperty.call(EXACT, s)) return EXACT[s];
    for (var i = 0; i < RULES.length; i++) {
      var m = RULES[i][0].exec(s);
      if (m) return RULES[i][1](m);
    }
    if (!KNOWN_PL[s] && missing.indexOf(s) < 0) missing.push(s);
    return s;
  }

  // ---------------------------------------------------------------------------
  // Wrapped functions: same maths, Polish text
  // ---------------------------------------------------------------------------

  var fieldStatusEn = M.fieldStatus;
  var computeAllEn = M.computeAll;
  var shutoffNoticeEn = M.shutoffNotice;

  M.shutoffNotice = function (profileId, modelId) { return tr(shutoffNoticeEn(profileId, modelId)); };

  M.fieldStatus = function (profileId, modelId) {
    var out = fieldStatusEn(profileId, modelId);
    var res = {};
    Object.keys(out).forEach(function (k) {
      var s = out[k];
      res[k] = { status: s.status, badge: tr(s.badge), note: tr(s.note), facts: s.facts };
    });
    return res;
  };

  M.computeAll = function (st) {
    var R = computeAllEn(st);
    R.warnings = R.warnings.map(tr);
    R.s6.extras.forEach(function (e) { e.name = SCENARIO_PL[e.id] || tr(e.name); });
    Object.keys(R.s4.layouts).forEach(function (k) {
      R.s4.layouts[k].lines.forEach(function (l) { l.label = tr(l.label); l.formula = tr(l.formula); });
    });
    R.strip.rows.concat([R.strip.yours]).forEach(function (r) { r.label = tr(r.label); r.note = tr(r.note); });
    return R;
  };

  M.LANG = 'pl';
  M.PL = {
    fmt: { NB: NB, group: group, num: num, usd: usd, plural: plural },
    tr: tr,
    missing: missing,
    en: { fieldStatus: fieldStatusEn, computeAll: computeAllEn, shutoffNotice: shutoffNoticeEn }
  };
  return M;
});
