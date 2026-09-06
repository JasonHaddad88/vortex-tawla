#!/usr/bin/env node
/* =====================================================================
 * Vortex Tawla — does searching a move deeper actually play better?
 * ---------------------------------------------------------------------
 * Plays the two-ply searcher against the one-ply static evaluator, head
 * to head, alternating who moves first so neither side gets the opening
 * advantage. Reports match points, not just games, since a gammon counts
 * double and a backgammon triple.
 *
 * Backgammon is extremely high variance, so a few dozen games proves
 * nothing. Run several hundred before believing a small edge.
 *
 *     node tools/bench_ai.js [games] [variant]
 * ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'assets', 'js');
['engine.js', 'ai.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
});

const E = globalThis.Engine, AI = globalThis.AI;

const GAMES = parseInt(process.argv[2], 10) || 100;
const VARIANT = process.argv[3] || 'mahbooseh';
/* The same budget the app would give it. Left generous and it is not a
   benchmark any more — a single tangled position can take 20 seconds per
   move and the run never finishes. When the budget runs out the search
   falls back to one ply, which is exactly what the app would do, so the
   comparison stays honest. */
const WIDTH = 6, BUDGET = 800;

/* Deterministic dice so both configurations meet the same sequence: the
   only difference between the two arms is the decision, not the luck. */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

function pick(state, deep) {
  if (deep) {
    return AI.searchPlan(state, { depth: 2, width: WIDTH, budgetMs: BUDGET }).plan || [];
  }
  return AI.searchPlan(state, { depth: 1 }).plan || [];
}

function playGame(seed, deepSide, variant, first) {
  const rng = makeRng(seed);
  const s = E.newGame({ variant: variant, first: first });
  let turns = 0;
  while (!E.result(s) && turns < 1000) {
    const d = E.rollDice(rng);
    E.setRoll(s, d[0], d[1]);
    pick(s, s.turn === deepSide).forEach(function (m) { E.apply(s, m); });
    if (E.result(s)) break;
    E.endTurn(s);
    turns++;
  }
  return E.result(s);
}

console.log('variant: ' + VARIANT + ', games: ' + GAMES +
            ' (two-ply width ' + WIDTH + ' vs one-ply static)');

/* Duplicate ("paired") scoring. Each seed is played twice with the SAME
   dice stream, once with the deep player as White and once as Black. Most
   of the luck then cancels between the two halves, which is the only way
   to see a small edge without playing thousands of games. The per-pair
   difference is what we actually measure. */
let deepPts = 0, shallowPts = 0, deepWins = 0, draws = 0, t0 = Date.now();
const diffs = [];

for (let g = 0; g < GAMES; g++) {
  const seed = 0xC0FFEE + g * 7919;
  const first = g % 2 === 0 ? 'W' : 'B';
  let pairDiff = 0;

  ['W', 'B'].forEach(function (deepSide) {
    const res = playGame(seed, deepSide, VARIANT, first);
    if (!res || res.winner === null) { draws++; return; }
    if (res.winner === deepSide) { deepPts += res.points; deepWins++; pairDiff += res.points; }
    else { shallowPts += res.points; pairDiff -= res.points; }
  });
  diffs.push(pairDiff);

  if ((g + 1) % 20 === 0) {
    process.stdout.write('  ' + (g + 1) + '/' + GAMES + ' pairs  deep ' +
      deepPts + ' – ' + shallowPts + ' shallow\n');
  }
}

const decided = GAMES * 2 - draws;
const secs = ((Date.now() - t0) / 1000).toFixed(1);

/* Paired t-ish statistic on the per-pair point difference. */
const n = diffs.length;
const mean = diffs.reduce(function (a, b) { return a + b; }, 0) / n;
const varr = diffs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (n - 1);
const se = Math.sqrt(varr / n);
const z = se > 0 ? mean / se : 0;

console.log('');
console.log('  games decided : ' + decided + (draws ? '  (' + draws + ' drawn)' : ''));
console.log('  game wins     : two-ply ' + deepWins + ' / ' + decided +
            '  (' + (100 * deepWins / decided).toFixed(1) + '%)');
console.log('  match points  : two-ply ' + deepPts + '  vs  one-ply ' + shallowPts);
console.log('  per-pair mean : ' + mean.toFixed(3) + ' points  (se ' + se.toFixed(3) + ')');
console.log('  z             : ' + z.toFixed(2) +
            (Math.abs(z) >= 1.96 ? '   <- significant at 95%' : '   <- NOT significant'));
console.log('  elapsed       : ' + secs + 's');
console.log('');
