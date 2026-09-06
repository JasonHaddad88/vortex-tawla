/* =====================================================================
 * Vortex Tawla — engine self-tests
 * Open tests.html. Nothing here touches the app; it only exercises
 * engine.js and validates that every drill position is legal and that
 * its answer key is actually reachable.
 * ===================================================================== */
(function () {
  'use strict';

  var E = window.Engine, C = window.Content;
  var results = [], group = '';

  function describe(name) { group = name; }
  function ok(name, cond, detail) {
    results.push({ group: group, name: name, pass: !!cond, detail: cond ? '' : (detail || '') });
  }
  function eq(name, a, b) {
    ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
  }

  function has(plans, from, to, die) {
    return plans.some(function (pl) {
      return pl.some(function (m) {
        return m.from === from && m.to === to && (die === undefined || m.die === die);
      });
    });
  }
  function planWith(state, from, to) {
    return E.matchingPlans(state).filter(function (pl) {
      return pl.some(function (m) { return m.from === from && m.to === to; });
    });
  }

  /* ---------------------------------------------------------------- */
  describe('Setup');

  var g = E.newGame();
  eq('White has 15 checkers', E.countOn(g.points, 'W'), 15);
  eq('Black has 15 checkers', E.countOn(g.points, 'B'), 15);
  eq('White starts on point 24', g.points[24].length, 15);
  eq('Black starts on point 1', g.points[1].length, 15);
  eq('White opening pip count', E.pipCount(g.points, 'W'), 360);
  eq('Black opening pip count', E.pipCount(g.points, 'B'), 360);
  eq('White start point', E.startPoint('W'), 24);
  eq('Black start point', E.startPoint('B'), 1);
  ok('White home is 1-6', E.inHome('W', 1) && E.inHome('W', 6) && !E.inHome('W', 7));
  ok('Black home is 19-24', E.inHome('B', 19) && E.inHome('B', 24) && !E.inHome('B', 18));

  /* ---------------------------------------------------------------- */
  describe('Direction of travel');

  var d1 = E.fromSpec({ 13: 'W', 13.0: 'W' });
  d1 = E.fromSpec({ 13: 'W' });
  E.setRoll(d1, 5, 5);
  ok('White moves toward lower numbers', has(d1.plans, 13, 8, 5));

  var d2 = E.fromSpec({ 13: 'B' }, 'B');
  E.setRoll(d2, 5, 5);
  ok('Black moves toward higher numbers', has(d2.plans, 13, 18, 5));

  /* ---------------------------------------------------------------- */
  describe('Landing rules');

  var lp = E.fromSpec({ 10: 'B', 11: 'BB', 12: 'W', 13: 'WWWWW' });
  ok('may land on an empty point', E.canLand(lp.points, 'W', 9));
  ok('may land on own point', E.canLand(lp.points, 'W', 12));
  ok('may land on a lone enemy checker (pin)', E.canLand(lp.points, 'W', 10));
  ok('may NOT land on two enemy checkers', !E.canLand(lp.points, 'W', 11));

  /* ---------------------------------------------------------------- */
  describe('Pinning');

  var p = E.fromSpec({ 9: 'B', 13: 'WWWW', 20: 'BBBB' });
  E.setRoll(p, 4, 4);
  ok('pin is offered as a legal move', has(p.plans, 13, 9, 4));
  var pinMove = E.legalNow(p).filter(function (m) { return m.from === 13 && m.to === 9; })[0];
  var r = E.apply(p, pinMove);
  ok('applying it reports a pin', r.pinned === true);
  eq('stack is Black then White', p.points[9].join(''), 'BW');
  eq('one enemy checker held', E.pinsHeldBy(p.points, 'W').length, 1);

  var bTurn = E.fromSpec({ 9: 'BW', 20: 'BBBB' }, 'B');
  E.setRoll(bTurn, 1, 2);
  ok('a pinned checker has no moves', !has(bTurn.plans, 9, 10) && !has(bTurn.plans, 9, 11));
  eq('the owner sees it as pinned', E.pinnedCheckers(bTurn.points, 'B')[0], 9);

  var rel = E.fromSpec({ 9: 'BW', 20: 'BBBB' });
  E.setRoll(rel, 3, 3);
  var relMove = E.legalNow(rel).filter(function (m) { return m.from === 9; })[0];
  var rr = E.apply(rel, relMove);
  ok('leaving the point reports a release', rr.freed === true);
  eq('the freed checker is alone again', rel.points[9].join(''), 'B');

  /* a pin can itself be pinned — B under W, then B lands on top */
  var sand = E.fromSpec({ 9: 'BW', 5: 'BBB' }, 'B');
  ok('the jailer can be pinned in turn', E.canLand(sand.points, 'B', 9));
  E.setRoll(sand, 4, 4);
  var sm = E.legalNow(sand).filter(function (m) { return m.from === 5 && m.to === 9; })[0];
  ok('sandwich move exists', !!sm);
  if (sm) { E.apply(sand, sm); eq('stack is B, W, B', sand.points[9].join(''), 'BWB'); }

  /* ---------------------------------------------------------------- */
  describe('Dice usage rules');

  var dbl = E.fromSpec({ 13: 'WWWW' });
  E.setRoll(dbl, 2, 2);
  eq('doubles give four moves', dbl.dice.length, 4);
  eq('a maximal plan uses all four', dbl.plans[0].length, 4);

  /* Both dice playable alone, but never together: the higher must go. */
  var hi = E.fromSpec({ 13: 'W', 6: 'BB' });
  E.setRoll(hi, 5, 2);
  eq('only one die can be played', hi.plans[0].length, 1);
  eq('and it must be the higher one', hi.plans[0][0].die, 5);
  eq('landing on 8, not 11', hi.plans[0][0].to, 8);

  var stuck = E.fromSpec({ 13: 'W', 11: 'BB', 8: 'BB' });
  E.setRoll(stuck, 5, 2);
  eq('fully blocked means no moves', E.legalNow(stuck).length, 0);
  ok('turn is complete immediately', E.turnComplete(stuck));

  /* ---------------------------------------------------------------- */
  describe('Bearing off');

  var bo = E.fromSpec({ 6: 'WW', 5: 'WWW', 4: 'WWW', 3: 'WWW', 2: 'WW', 1: 'WW',
                        13: 'BBBBB', 14: 'BBBBB', 15: 'BBBBB' });
  eq('bear-off position has 15 White', E.countOn(bo.points, 'W'), 15);
  ok('all White checkers are home', E.allHome(bo.points, 'W'));
  E.setRoll(bo, 6, 3);
  ok('exact roll bears off', has(bo.plans, 6, 0, 6));

  var over = E.fromSpec({ 5: 'W', 4: 'WWW', 3: 'WWW', 2: 'WWWW', 1: 'WWWW',
                          13: 'BBBBB', 14: 'BBBBB', 15: 'BBBBB' });
  E.setRoll(over, 6, 2);
  ok('a high die bears off from the highest point', has(over.plans, 5, 0, 6));

  /* Checked against the opening move list rather than whole plans: it is
     legal to play the 1 as 6->5 first, which empties point 6 and *then*
     legitimately lets the 6 bear off from 5. */
  var noover = E.fromSpec({ 6: 'W', 5: 'W', 4: 'WWW', 3: 'WWW', 2: 'WWWW', 1: 'WWW',
                            13: 'BBBBB', 14: 'BBBBB', 15: 'BBBBB' });
  var nvMoves = E.genMoves(noover.points, 'W', [6, 1]);
  function hasMove(list, from, to, die) {
    return list.some(function (m) { return m.from === from && m.to === to && m.die === die; });
  }
  ok('but not while a higher point is occupied', !hasMove(nvMoves, 5, 0, 6));
  ok('the higher point bears off instead', hasMove(nvMoves, 6, 0, 6));

  var trapped = E.fromSpec({ 15: 'WB', 6: 'WW', 5: 'WWW', 4: 'WWW', 3: 'WWW', 2: 'WWW',
                             20: 'BBBB', 21: 'BBBB', 22: 'BBBB', 23: 'BB' });
  eq('trapped-outside position has 15 White', E.countOn(trapped.points, 'W'), 15);
  ok('a pinned checker outside home blocks bear-off', !E.allHome(trapped.points, 'W'));
  E.setRoll(trapped, 6, 5);
  ok('no bear-off moves are offered', !trapped.plans.some(function (pl) {
    return pl.some(function (m) { return m.off; });
  }));

  /* ---------------------------------------------------------------- */
  describe('Mana');

  var mana = E.fromSpec({ 1: 'BW', 20: 'BBBB' });
  ok('White holds the mana on point 1', E.manaHeldBy(mana.points, 'W'));
  ok('Black does not', !E.manaHeldBy(mana.points, 'B'));

  var notMana = E.fromSpec({ 1: 'BBW', 20: 'BBBB' });
  ok('two Black checkers there is not a mana', !E.manaHeldBy(notMana.points, 'W'));

  var manaB = E.fromSpec({ 24: 'WB' });
  ok('Black holds the mana on point 24', E.manaHeldBy(manaB.points, 'B'));

  var manaEnd = E.fromSpec({ 1: 'BW', 20: 'BBBB' }, 'W', { manaEndsGame: true });
  ok('house rule ends the game', E.result(manaEnd) && E.result(manaEnd).reason === 'mana');
  var manaPlay = E.fromSpec({ 1: 'BW', 20: 'BBBB' }, 'W', { manaEndsGame: false });
  ok('default rule plays on', E.result(manaPlay) === null);

  /* ---------------------------------------------------------------- */
  describe('Dead positions');

  /* Each side holds the other's mana and has stacked everything else on
     that same point: nobody can bear off and nobody can move. */
  var dead = E.fromSpec({ 1: 'B' + 'W'.repeat(14), 24: 'W' + 'B'.repeat(14) });
  eq('deadlock position has 15 White', E.countOn(dead.points, 'W'), 15);
  eq('deadlock position has 15 Black', E.countOn(dead.points, 'B'), 15);
  ok('both manas are held', E.manaHeldBy(dead.points, 'W') && E.manaHeldBy(dead.points, 'B'));
  ok('White cannot move on any face', E.isDead(dead.points, 'W'));
  ok('Black cannot move on any face', E.isDead(dead.points, 'B'));
  ok('the engine calls it a deadlock', E.isDeadlock(dead.points));
  eq('and reports a draw', E.result(dead).reason, 'deadlock');
  eq('with no winner', E.result(dead).winner, null);

  var live = E.newGame();
  ok('the opening position is not dead', !E.isDeadlock(live.points));
  ok('and has no result yet', E.result(live) === null);

  /* One side stuck is an ordinary forfeit, not a draw. */
  var oneStuck = E.fromSpec({ 1: 'B' + 'W'.repeat(14), 20: 'BBBBBBBBBBBBBB' });
  ok('a single stuck player is not a deadlock', !E.isDeadlock(oneStuck.points));

  /* ---------------------------------------------------------------- */
  describe('Scoring');

  var win = E.fromSpec({ 1: 'BBBBBBBBBBBBBBB' });
  eq('White has borne off 15', win.off.W, 15);
  eq('a shutout is a mars worth 2', E.result(win).points, 2);
  eq('and White is the winner', E.result(win).winner, 'W');

  var single = E.fromSpec({ 1: 'BBBBBBBBBBBBBB' });
  eq('opponent got one off: single game', E.result(single).points, 1);

  /* ---------------------------------------------------------------- */
  describe('Hints mid-turn');

  /* Regression: hints used to read whole-turn plans fixed at roll time,
     so after playing part of a turn they re-suggested a move already
     made and scored plans against a board those moves had already left. */
  (function () {
    var s = E.fromSpec({ 24: 'WWWWWWWWWWWWWWW', 1: 'BBBBBBBBBBBBBBB' }, 'W', {});
    E.setRoll(s, 1, 1);                       // doubles: four moves to make
    var h1 = window.AI.hint(s);
    ok('a hint is offered at the start of the turn', !!h1);
    eq('it suggests four moves', h1.plan.length, 4);

    E.apply(s, h1.next);                      // play the suggested move
    var h2 = window.AI.hint(s);
    ok('a hint is still offered after one move', !!h2);
    eq('and it now covers only the three remaining', h2.plan.length, 3);
    ok('it does not re-suggest the move just played',
       !(h2.next.from === h1.next.from && h2.next.to === h1.next.to && s.played.length === 1 &&
         h2.plan.length === h1.plan.length));

    /* every suggested move must be legal right now */
    var legal = E.legalNow(s);
    ok('the suggestion is a legal move in the current position',
       legal.some(function (m) { return E.sameMove(m, h2.next); }),
       'suggested ' + JSON.stringify(h2.next));

    E.apply(s, h2.next);
    E.apply(s, window.AI.hint(s).next);
    var h4 = window.AI.hint(s);
    eq('one move left on the last hint', h4.plan.length, 1);
    ok('still legal', E.legalNow(s).some(function (m) { return E.sameMove(m, h4.next); }));
    E.apply(s, h4.next);
    eq('turn is complete after playing the whole hinted line', E.legalNow(s).length, 0);
    ok('and no hint is offered with nothing left to play', window.AI.hint(s) === null);
  })();

  /* Remaining plans must always match what the engine will accept. */
  (function () {
    var s = E.newGame();
    E.setRoll(s, 6, 3);
    var steps = 0;
    while (E.legalNow(s).length && steps < 5) {
      var rp = window.AI.remainingPlans(s);
      var legal = E.legalNow(s);
      ok('remaining plans start with a legal move (step ' + steps + ')',
         rp.every(function (pl) {
           return legal.some(function (m) { return E.sameMove(m, pl[0]); });
         }));
      E.apply(s, legal[0]);
      steps++;
    }
    ok('walked the turn to completion', steps > 0);
  })();

  /* ---------------------------------------------------------------- */
  describe('Fransawiyyeh — setup and travel');

  var FR = { variant: 'fransawiyyeh' };
  var fv = E.VARIANTS.fransawiyyeh;

  (function () {
    var g = E.newGame(FR);
    eq('variant is recorded on the state', g.variantId, 'fransawiyyeh');
    eq('White has 15 checkers', E.countOn(g.points, 'W'), 15);
    eq('Black has 15 checkers', E.countOn(g.points, 'B'), 15);

    /* The standard opening, mirrored: 24x2, 13x5, 8x3, 6x5. */
    eq('White midpoint holds 5', g.points[13].length, 5);
    eq('White 6-point holds 5', g.points[6].length, 5);
    eq('White 8-point holds 3', g.points[8].length, 3);
    eq('White 24-point holds 2', g.points[24].length, 2);
    eq('Black 24-point is absolute 1', E.startPoint('B', fv), 1);
    eq('Black midpoint is absolute 12', g.points[12].join(''), 'BBBBB');
    eq('Black 6-point is absolute 19', g.points[19].join(''), 'BBBBB');

    /* 167 is the well-known opening pip count for backgammon; if the
       geometry were wrong this would not land on it. */
    eq('White opening pip count is 167', E.pipCount(g.points, 'W', fv, g.bar), 167);
    eq('Black opening pip count is 167', E.pipCount(g.points, 'B', fv, g.bar), 167);

    ok('nobody starts on the bar', g.bar.W === 0 && g.bar.B === 0);
  })();

  describe('Fransawiyyeh — hitting and the bar');

  (function () {
    var s = E.fromSpec({ 13: 'WWWWW', 9: 'B', 8: 'WWW', 6: 'WWWWW', 4: 'WW',
                         1: 'BB', 12: 'BBBB', 17: 'BBB', 19: 'BBBBB' }, 'W', FR);
    eq('position has 15 White', E.countOn(s.points, 'W'), 15);
    eq('position has 15 Black', E.countOn(s.points, 'B'), 15);

    E.setRoll(s, 4, 4);
    var hit = E.legalNow(s).filter(function (m) { return m.from === 13 && m.to === 9; })[0];
    ok('landing on a lone checker is legal', !!hit);
    var r = E.apply(s, hit);
    ok('and it is reported as a hit', r.hit === true);
    ok('not as a pin', r.pinned === false);
    eq('the point now holds only White', s.points[9].join(''), 'W');
    eq('the hit checker is on the bar', s.bar.B, 1);
    eq('Black has 14 left on the board', E.countOn(s.points, 'B'), 14);
    eq('and still owes 15 checkers in total', E.countOn(s.points, 'B') + s.bar.B + s.off.B, 15);
    /* A checker on the bar owes the full 25 pips. */
    ok('the bar checker is counted at 25 pips',
       E.pipCount(s.points, 'B', fv, s.bar) === E.pipCount(s.points, 'B', fv, { W: 0, B: 0 }) + 25);
  })();

  (function () {
    /* On the bar: nothing else may move until it re-enters. */
    var s = E.fromSpec({ 13: 'WWWWW', 8: 'WWW', 6: 'WWWWW', 4: 'W',
                         1: 'BB', 12: 'BBBBB', 17: 'BBB', 19: 'BBBBB' },
                       'W', { variant: 'fransawiyyeh', bar: { W: 1, B: 0 } });
    eq('one White checker is on the bar', s.bar.W, 1);
    eq('White still totals 15', E.countOn(s.points, 'W') + s.bar.W + s.off.W, 15);

    E.setRoll(s, 3, 5);
    var moves = E.legalNow(s);
    ok('there are moves', moves.length > 0);
    ok('every move is a re-entry', moves.every(function (m) { return m.enter === true; }),
       JSON.stringify(moves));
    ok('nothing moves from the board', !moves.some(function (m) { return m.from !== 'bar'; }));

    /* Entry lands in the opponent's home: own point 25 - die. */
    eq('White enters on 22 with a 3', E.entryPoint('W', 3, fv), 22);
    eq('White enters on 19 with a 6', E.entryPoint('W', 6, fv), 19);
    eq('Black enters on absolute 6 with a 6', E.entryPoint('B', 6, fv), 6);
    eq('Black enters on absolute 1 with a 1', E.entryPoint('B', 1, fv), 1);

    var enter = moves.filter(function (m) { return m.die === 3; })[0];
    ok('the 3 enters on point 22', enter && enter.to === 22);
    E.apply(s, enter);
    eq('the bar is now empty', s.bar.W, 0);
    eq('and the checker is on 22', s.points[22].join(''), 'W');
    ok('after entering, ordinary moves are available again',
       E.legalNow(s).some(function (m) { return m.from !== 'bar'; }));
  })();

  (function () {
    /* A closed board: every entry point held by two or more. */
    var s = E.fromSpec({ 24: 'BB', 23: 'BB', 22: 'BB', 21: 'BB', 20: 'BB', 19: 'BBB',
                         13: 'WWWWW', 8: 'WWW', 6: 'WWWWW', 12: 'BB' },
                       'W', { variant: 'fransawiyyeh', bar: { W: 2, B: 0 } });
    eq('White totals 15', E.countOn(s.points, 'W') + s.bar.W + s.off.W, 15);
    eq('Black totals 15', E.countOn(s.points, 'B') + s.bar.B + s.off.B, 15);
    E.setRoll(s, 2, 5);
    eq('a closed board means no legal move at all', E.legalNow(s).length, 0);
    ok('the turn is complete immediately', E.turnComplete(s));
  })();

  (function () {
    /* Bear-off is blocked while anything is on the bar. */
    var s = E.fromSpec({ 6: 'WW', 5: 'WWW', 4: 'WWW', 3: 'WWW', 2: 'WW', 1: 'W',
                         19: 'BBBBB', 20: 'BBBBB', 21: 'BBBBB' },
                       'W', { variant: 'fransawiyyeh', bar: { W: 1, B: 0 } });
    ok('not all home while one is on the bar', !E.allHome(s.points, 'W', fv, s.bar));
    E.setRoll(s, 6, 6);
    ok('no bear-off is offered', !E.legalNow(s).some(function (m) { return m.off; }));

    var s2 = E.fromSpec({ 6: 'WWW', 5: 'WWW', 4: 'WWW', 3: 'WWW', 2: 'WW', 1: 'W',
                          19: 'BBBBB', 20: 'BBBBB', 21: 'BBBBB' }, 'W', FR);
    ok('all home with an empty bar', E.allHome(s2.points, 'W', fv, s2.bar));
    E.setRoll(s2, 6, 1);
    ok('bear-off resumes', s2.plans.some(function (pl) {
      return pl.some(function (m) { return m.off; });
    }));
  })();

  describe('Fransawiyyeh — no pinning');

  (function () {
    var s = E.fromSpec({ 10: 'B', 13: 'WWWWW', 6: 'WWWWW', 8: 'WWW', 4: 'WW',
                         1: 'BB', 12: 'BBBB', 17: 'BBBB', 19: 'BBBB' }, 'W', FR);
    E.setRoll(s, 3, 3);
    var mv = E.legalNow(s).filter(function (m) { return m.from === 13 && m.to === 10; })[0];
    ok('the hit is available', !!mv);
    E.apply(s, mv);
    var mixed = false;
    for (var i = 1; i <= 24; i++) {
      var a = s.points[i];
      for (var k = 1; k < a.length; k++) if (a[k] !== a[0]) mixed = true;
    }
    ok('no point ever holds two colours', !mixed);
    eq('nothing is recorded as pinned', E.pinnedCheckers(s.points, 'B').length, 0);
    ok('and the mana concept does not apply', !E.manaHeldBy(s.points, 'W', fv));
  })();

  describe('Fransawiyyeh — scoring');

  (function () {
    /* Loser has borne off one: plain single. */
    var single = E.fromSpec({ 19: 'BBBBBBBBBBBBBB' }, 'W', FR);
    eq('a single game is 1 point', E.result(single).points, 1);

    /* Loser bore off none, nothing stranded: gammon. */
    var gammon = E.fromSpec({ 19: 'BBBBBBBBBBBBBBB' }, 'W', FR);
    eq('a gammon is 2 points', E.result(gammon).points, 2);
    eq('and is named', E.result(gammon).reason, 'gammon');

    /* Loser bore off none and still has a checker in White's home: back-
       gammon, the triple. */
    var bg = E.fromSpec({ 19: 'BBBBBBBBBBBBBB', 3: 'B' }, 'W', FR);
    eq('a backgammon is 3 points', E.result(bg).points, 3);
    eq('and is named', E.result(bg).reason, 'backgammon');

    var onBar = E.fromSpec({ 19: 'BBBBBBBBBBBBBB' }, 'W',
                           { variant: 'fransawiyyeh', bar: { W: 0, B: 1 } });
    eq('a checker still on the bar is also a backgammon', E.result(onBar).points, 3);

    /* Mahbooseh must be unaffected: it has no triple. */
    var mars = E.fromSpec({ 1: 'BBBBBBBBBBBBBBB' }, 'W', {});
    eq('Mahbooseh still tops out at a mars', E.result(mars).points, 2);
    eq('and calls it a mars', E.result(mars).reason, 'mars');
  })();

  describe('Fransawiyyeh — full games');

  (function () {
    var crashed = 0, finished = 0, gammons = 0;
    for (var n = 0; n < 25; n++) {
      try {
        var s = E.newGame(FR), turns = 0;
        while (!E.result(s) && turns < 800) {
          var dd = E.rollDice();
          E.setRoll(s, dd[0], dd[1]);
          (window.AI.choosePlan(s, n % 2 ? 'normal' : 'easy') || []).forEach(function (m) {
            E.apply(s, m);
          });
          if (E.result(s)) break;
          E.endTurn(s);
          turns++;
        }
        if (E.result(s)) {
          finished++;
          if (E.result(s).points > 1) gammons++;
        }
        var tw = E.countOn(s.points, 'W') + s.off.W + s.bar.W;
        var tb = E.countOn(s.points, 'B') + s.off.B + s.bar.B;
        if (tw !== 15) throw new Error('White count drifted to ' + tw);
        if (tb !== 15) throw new Error('Black count drifted to ' + tb);
      } catch (err) {
        crashed++;
        results.push({ group: group, name: 'game ' + n, pass: false, detail: String(err) });
      }
    }
    eq('25 games ran without error', crashed, 0);
    eq('and all of them finished', finished, 25);
    ok('checker counts held across every game (incl. the bar)', crashed === 0);
  })();

  /* ---------------------------------------------------------------- */
  describe('Coach — turn review');

  var Coach = window.Coach, Store = window.Store;

  (function () {
    /* Drill 1: 4→1 takes the mana. Playing it must grade as best;
       ignoring it must grade as a blunder and name the mana. */
    var d = C.DRILLS[0];
    var start = E.fromSpec(d.spec, 'W', {});
    E.setRoll(start, d.roll[0], d.roll[1]);

    var manaPlan = start.plans.filter(function (pl) {
      return pl.some(function (m) { return m.from === 4 && m.to === 1; });
    })[0];
    ok('a mana-taking plan exists', !!manaPlan);

    var r1 = Coach.reviewTurn(start, manaPlan);
    ok('taking the mana is graded best', r1 && r1.grade.key === 'best', r1 && r1.grade.key);

    /* Must ignore point 1 entirely: 6→1 with the 5 also takes the mana,
       so filtering only on 4→1 would still pick a mana-taking line. */
    var missPlan = start.plans.filter(function (pl) {
      return !pl.some(function (m) { return m.to === 1; });
    })[0];
    ok('a plan that ignores the mana exists', !!missPlan);
    var r2 = Coach.reviewTurn(start, missPlan);
    ok('missing it is graded a blunder', r2 && r2.grade.key === 'blunder', r2 && r2.grade.key);
    ok('and the cost is large', r2 && r2.loss > 100, r2 && String(r2.loss));
    ok('and the reason mentions the mana', r2 && /mana/i.test(r2.why), r2 && r2.why);
    ok('and it shows the better line', r2 && r2.bestLine.indexOf('4→1') >= 0, r2 && r2.bestLine);
  })();

  (function () {
    /* Order of the same two moves is the same play, not a mistake. */
    var s = E.fromSpec({ 13: 'WWWWW', 8: 'WWWWW', 6: 'WWWWW',
                         12: 'BBBBB', 11: 'BBBBB', 10: 'BBBBB' }, 'W', {});
    E.setRoll(s, 3, 1);
    var best = null, bs = -Infinity;
    s.plans.forEach(function (pl) { var v = window.AI.scorePlan(s, pl); if (v > bs) { bs = v; best = pl; } });
    var reversed = best.slice().reverse();
    var r = Coach.reviewTurn(s, reversed);
    ok('the same moves in the other order still grade best', r && r.grade.key === 'best', r && r.grade.key);
    ok('and are reported as the same play', r && r.same === true);
  })();

  /* The drills are the app's stated answers. If the evaluator disagrees
     with one, either the drill or the evaluator is wrong and a learner
     gets told two different things — so assert they agree. */
  (function () {
    C.DRILLS.forEach(function (d, i) {
      var tag = 'drill ' + (i + 1) + ' (' + d.title + ')';
      var s = E.fromSpec(d.spec, 'W', {});
      E.setRoll(s, d.roll[0], d.roll[1]);
      var best = null, bs = -Infinity;
      s.plans.forEach(function (pl) {
        var v = window.AI.scorePlan(s, pl);
        if (v > bs) { bs = v; best = pl; }
      });
      ok(tag + ': engine picks a line', !!best);
      if (!best) return;
      var line = Coach.line(best);
      if (d.key) {
        ok(tag + ': coach agrees with the answer key',
           d.key.every(function (k) {
             return best.some(function (m) { return m.from === k.from && (m.off ? 0 : m.to) === k.to; });
           }), 'engine prefers ' + line);
      }
      if (d.avoid) {
        ok(tag + ': coach also avoids ' + d.avoid.join(','),
           !best.some(function (m) { return d.avoid.indexOf(m.from) >= 0; }), 'engine prefers ' + line);
      }
    });
  })();

  describe('Two-ply search');

  (function () {
    var s = E.newGame();
    E.setRoll(s, 6, 5);

    var shallow = window.AI.searchPlan(s, { depth: 1 });
    eq('a shallow search reports depth 1', shallow.depth, 1);
    ok('and returns a legal plan', shallow.plan.length > 0);

    var deep = window.AI.searchPlan(s, { depth: 2, width: 4, budgetMs: 8000 });
    eq('a deep search reports depth 2', deep.depth, 2);
    ok('it examined more than one candidate', deep.searched >= 2, String(deep.searched));
    ok('and returns a plan that is legal right now',
       deep.plan.every(function (m, i) {
         return i > 0 || E.legalNow(s).some(function (l) { return E.sameMove(l, m); });
       }));

    /* An impossible budget must degrade to the shallow answer rather
       than return a half-finished average. */
    var starved = window.AI.searchPlan(s, { depth: 2, width: 8, budgetMs: -1 });
    eq('an exhausted budget falls back to depth 1', starved.depth, 1);
    ok('and still returns a plan', starved.plan.length > 0);

    /* The 21 distinct rolls must be a proper probability distribution,
       or the expectation is silently skewed. */
    eq('there are 21 distinct rolls', window.AI.ROLLS.length, 21);
    var pSum = window.AI.ROLLS.reduce(function (a, r) { return a + r.p; }, 0);
    ok('their probabilities sum to 1', Math.abs(pSum - 1) < 1e-9, String(pSum));
    eq('doubles are weighted 1/36', window.AI.ROLLS.filter(function (r) {
      return r.d[0] === r.d[1];
    }).length, 6);
  })();

  (function () {
    /* Winning outright must dominate anything positional. */
    var s = E.fromSpec({ 1: 'W', 20: 'BBBBBBBBBBBBBBB' }, 'W', {});
    s.off.W = 14;
    E.setRoll(s, 1, 1);
    var winning = E.legalNow(s).filter(function (m) { return m.off; })[0];
    ok('the winning move exists', !!winning);
    ok('and scores as a win', window.AI.expectedScore(s, [winning]) > 1000);
  })();

  /* Known limitation, pinned down deliberately rather than left to be
     rediscovered.
     Looking one reply ahead prices the IMMEDIATE risk of a blot well,
     but is blind past that reply. Mahbooseh's biggest decisions are
     long-horizon: on drill 2, keeping two checkers on your starting
     point is safe for exactly one turn and disastrous three turns later,
     when you are forced to break it. Two-ply cannot see that, so it
     keeps the point and contradicts the drill. This is why the coach
     grades at depth 1, where the evaluator's start-point term carries
     that knowledge as a heuristic. */
  (function () {
    var d = C.DRILLS[1];
    var s = E.fromSpec(d.spec, 'W', {});
    E.setRoll(s, d.roll[0], d.roll[1]);
    var clear = s.plans.filter(function (pl) {
      return pl.some(function (m) { return m.from === 24 && m.to === 18; }) &&
             pl.some(function (m) { return m.from === 24 && m.to === 19; });
    })[0];
    var keep = s.plans.filter(function (pl) {
      return !pl.some(function (m) { return m.from === 24; });
    })[0];
    ok('both candidate lines exist', !!clear && !!keep);

    ok('one-ply clears the starting point (agrees with the drill)',
       window.AI.scorePlan(s, clear) > window.AI.scorePlan(s, keep));
    ok('two-ply keeps it instead — the documented horizon limitation',
       window.AI.expectedScore(s, keep) > window.AI.expectedScore(s, clear));
  })();

  /* What actually matters to a learner: the coach, at the depth it is
     really configured to use, agrees with every drill. */
  (function () {
    C.DRILLS.forEach(function (d, i) {
      var tag = 'drill ' + (i + 1) + ' (' + d.title + ')';
      var s = E.fromSpec(d.spec, 'W', {});
      E.setRoll(s, d.roll[0], d.roll[1]);
      var best = window.AI.searchPlan(s, { depth: 1 }).plan;
      if (d.key) {
        ok(tag + ': the coach as configured agrees with the answer key',
           d.key.every(function (k) {
             return best.some(function (m) { return m.from === k.from && (m.off ? 0 : m.to) === k.to; });
           }), 'prefers ' + Coach.line(best));
      }
      if (d.avoid) {
        ok(tag + ': and avoids ' + d.avoid.join(','),
           !best.some(function (m) { return d.avoid.indexOf(m.from) >= 0; }),
           'prefers ' + Coach.line(best));
      }
    });
  })();

  (function () {
    /* A deep review must grade the played line against alternatives
       scored the same way, and say so. */
    var d = C.DRILLS[0];
    var s = E.fromSpec(d.spec, 'W', {});
    E.setRoll(s, d.roll[0], d.roll[1]);
    var manaPlan = s.plans.filter(function (pl) {
      return pl.some(function (m) { return m.from === 4 && m.to === 1; });
    })[0];
    var r = Coach.reviewTurn(s, manaPlan, { depth: 2, width: 6, budgetMs: 20000 });
    ok('a deep review is produced', !!r);
    eq('and reports its depth', r.depth, 2);
    ok('taking the mana is still graded best', r.grade.key === 'best', r.grade.key);

    var missPlan = s.plans.filter(function (pl) {
      return !pl.some(function (m) { return m.to === 1; });
    })[0];
    var r2 = Coach.reviewTurn(s, missPlan, { depth: 2, width: 6, budgetMs: 20000 });
    ok('missing it is still a blunder at depth 2', r2 && r2.grade.key === 'blunder', r2 && r2.grade.key);

    var r1 = Coach.reviewTurn(s, missPlan, { depth: 1 });
    ok('and at the depth actually used', r1 && r1.grade.key === 'blunder', r1 && r1.grade.key);
    eq('which reports depth 1', r1.depth, 1);

    /* With no time to think it must still return a usable verdict. */
    var r3 = Coach.reviewTurn(s, missPlan, { depth: 2, width: 6, budgetMs: -1 });
    ok('a starved review still grades', !!r3);
    eq('falling back to depth 1', r3.depth, 1);
  })();

  describe('Coach — move risk');

  (function () {
    /* Two checkers left on the start point; moving one leaves the mana. */
    var d = C.DRILLS[1];
    var s = E.fromSpec(d.spec, 'W', {});
    E.setRoll(s, d.roll[0], d.roll[1]);

    var leave = E.legalNow(s).filter(function (m) { return m.from === 24 && m.to === 19; })[0];
    ok('the risky move exists', !!leave);
    var risk = Coach.moveRisk(s, leave);
    ok('it is flagged', !!risk);
    eq('as a mana risk', risk && risk.level, 'mana');
    ok('naming the exposed numbers', risk && risk.shots > 0);

    /* Playing the 6 first, then the 5, clears the point: safe. */
    var first = E.legalNow(s).filter(function (m) { return m.from === 24 && m.to === 18; })[0];
    E.apply(s, first);
    var second = E.legalNow(s).filter(function (m) { return m.from === 24 && m.to === 19; })[0];
    ok('the second checker can still leave', !!second);
    var r2 = Coach.moveRisk(s, second);
    ok('and clearing the point is not a mana risk',
       !r2 || r2.level !== 'mana', r2 && r2.level);
  })();

  (function () {
    var s = E.newGame();
    E.setRoll(s, 6, 5);
    var mv = E.legalNow(s)[0];
    var risk = Coach.moveRisk(s, mv);
    ok('opening moves are not flagged as mana risks',
       !risk || risk.level !== 'mana', risk && risk.level);
  })();

  /* ---------------------------------------------------------------- */
  describe('Review');

  var Review = window.Review;

  (function () {
    /* Record a real turn and make sure the position round-trips, since
       the whole point of the review is redrawing the board for any turn
       without replaying the game. */
    var s = E.newGame();
    E.setRoll(s, 6, 5);
    var start = E.clone(s);
    var plan = window.AI.choosePlan(s, 'hard');
    plan.forEach(function (m) { E.apply(s, m); });
    var rev = Coach.reviewTurn(start, s.played);

    var entry = Review.record(start, s.played, rev);
    ok('a turn is recorded', !!entry);
    eq('with the mover', entry.who, 'W');
    eq('the roll', entry.roll.join('-'), '6-5');
    eq('and the moves', entry.played.length, plan.length);
    ok('the played line is readable', /→/.test(entry.playedLine));
    ok('the grade is carried over', !!entry.grade);

    var back = Review.stateFor(entry);
    ok('the position rebuilds', !!back);
    eq('with 15 White', E.countOn(back.points, 'W'), 15);
    eq('with 15 Black', E.countOn(back.points, 'B'), 15);
    var same = true;
    for (var i = 1; i <= 24; i++)
      if (back.points[i].join('') !== start.points[i].join('')) same = false;
    ok('and matches the board at roll time exactly', same);

    /* It must survive the same JSON trip localStorage puts it through. */
    var trip = Review.stateFor(JSON.parse(JSON.stringify(entry)));
    var same2 = true;
    for (i = 1; i <= 24; i++)
      if (trip.points[i].join('') !== start.points[i].join('')) same2 = false;
    ok('and survives a JSON round-trip', same2);

    ok('nothing is recorded for an empty turn', Review.record(start, [], null) === null);
  })();

  (function () {
    /* An opponent turn is recorded but not graded. */
    var s = E.newGame();
    s.turn = 'B';
    E.setRoll(s, 3, 1);
    var start = E.clone(s);
    var plan = window.AI.choosePlan(s, 'hard');
    plan.forEach(function (m) { E.apply(s, m); });
    var entry = Review.record(start, s.played, null);
    eq('the opponent turn is recorded', entry.who, 'B');
    eq('but carries no grade', entry.grade, null);
    eq('and no best line', entry.bestLine, null);
  })();

  (function () {
    var hist = [
      { who: 'W', grade: 'best',       loss: 0,    playedLine: 'a' },
      { who: 'W', grade: 'inaccuracy', loss: 6,    playedLine: 'b' },
      { who: 'W', grade: 'blunder',    loss: 140,  playedLine: 'c' },
      { who: 'B', grade: null,         loss: null, playedLine: 'd' },
      { who: 'W', grade: 'good',       loss: 1.5,  playedLine: 'e' }
    ];
    var sum = Review.summarise(hist, 'W');
    eq('counts only the chosen side', sum.turns, 4);
    eq('grades only the graded turns', sum.reviewed, 4);
    eq('totals the cost', sum.totalCost, 147.5);
    eq('counts blunders', sum.counts.blunder, 1);
    eq('counts errors', sum.errors, 2);
    eq('accuracy is the non-error share', sum.accuracy, 0.5);
    eq('and finds the costliest turn', sum.worst.playedLine, 'c');

    var all = Review.summarise(hist);
    eq('without a side filter it counts every turn', all.turns, 5);

    var empty = Review.summarise([], 'W');
    eq('an empty history has no turns', empty.turns, 0);
    eq('and does not divide by zero', empty.avgCost, 0);
    eq('with perfect accuracy by default', empty.accuracy, 1);
    ok('and no worst turn', empty.worst === null);
  })();

  (function () {
    /* Bar and borne-off counts have to survive, or a mid-game
       Fransawiyyeh turn redraws wrong. */
    var s = E.fromSpec({ 13: 'WWWWW', 8: 'WWW', 6: 'WWWWW', 4: 'W',
                         1: 'BB', 12: 'BBBBB', 17: 'BBB', 19: 'BBBBB' },
                       'W', { variant: 'fransawiyyeh', bar: { W: 1, B: 0 } });
    E.setRoll(s, 3, 5);
    var start = E.clone(s);
    E.apply(s, E.legalNow(s)[0]);
    var entry = Review.record(start, s.played, null);
    var back = Review.stateFor(JSON.parse(JSON.stringify(entry)));
    eq('the variant is preserved', back.variantId, 'fransawiyyeh');
    eq('the bar is preserved', back.bar.W, 1);
    eq('White still totals 15', E.countOn(back.points, 'W') + back.bar.W + back.off.W, 15);
    eq('Black still totals 15', E.countOn(back.points, 'B') + back.bar.B + back.off.B, 15);
  })();

  /* ---------------------------------------------------------------- */
  describe('Persistence');

  (function () {
    ok('localStorage is usable in this browser', Store.available);

    /* Round-trip a mid-turn game: board at roll time + roll + moves. */
    var s = E.newGame();
    E.setRoll(s, 5, 3);
    var turnStart = E.clone(s);
    E.apply(s, E.legalNow(s)[0]);
    eq('one move played', s.played.length, 1);

    var blob = JSON.parse(JSON.stringify(Store.serialiseGame(s, turnStart)));
    var back = Store.deserialiseGame(blob);
    ok('a mid-turn game round-trips', !!back);
    eq('same turn', back.state.turn, s.turn);
    eq('same played count', back.state.played.length, s.played.length);
    eq('same dice left', back.state.dice.join(), s.dice.join());
    eq('plans were rebuilt, not stored', back.state.plans.length > 0, true);
    var same = true;
    for (var i = 1; i <= 24; i++)
      if (back.state.points[i].join('') !== s.points[i].join('')) same = false;
    ok('the board matches exactly', same);
    ok('the same moves are still legal',
       E.legalNow(back.state).length === E.legalNow(s).length);

    /* Between turns there is no roll to replay. */
    var idle = E.newGame();
    var b2 = Store.deserialiseGame(JSON.parse(JSON.stringify(Store.serialiseGame(idle, null))));
    ok('an idle game round-trips', !!b2 && b2.turnStart === null);
    eq('with no dice pending', b2.state.dice.length, 0);

    /* Bear-off counts must survive, since fromSpec infers them. */
    var late = E.fromSpec({ 3: 'WW', 2: 'W', 20: 'BBBB', 21: 'BBBB' }, 'W', {});
    var b3 = Store.deserialiseGame(JSON.parse(JSON.stringify(Store.serialiseGame(late, null))));
    ok('a part-borne-off game round-trips', !!b3);
    eq('White off count survives', b3.state.off.W, late.off.W);
    eq('Black off count survives', b3.state.off.B, late.off.B);

    /* Junk must be rejected rather than loaded as a corrupt board. */
    ok('a bad version is rejected', Store.deserialiseGame({ v: 99, board: {} }) === null);
    ok('null is rejected', Store.deserialiseGame(null) === null);
    ok('a board that does not add up is rejected',
       Store.deserialiseGame({ v: 1, board: { 5: 'WW' }, off: { W: 0, B: 0 }, turn: 'W' }) === null);

    /* An impossible replay falls back to the start of the turn. */
    var bogus = Store.serialiseGame(s, turnStart);
    bogus.played = [{ from: 7, to: 99, die: 5, off: false }];
    var b4 = Store.deserialiseGame(JSON.parse(JSON.stringify(bogus)));
    ok('an unreplayable move falls back to the turn start', !!b4);
    eq('with nothing played', b4.state.played.length, 0);
  })();

  /* ---------------------------------------------------------------- */
  describe('Spoken board descriptions');

  (function () {
    var B = window.Board;
    var solo = { W: 'your', B: "the opponent's" };
    var duo = { W: 'purple', B: 'cyan' };

    var s = E.fromSpec({ 24: 'WWWWWWWWWWWWWWW', 1: 'BBBBBBBBBBBBBBB' });
    eq('a full point reads naturally',
       B.describePoint(s, 24, solo), 'Point 24, fifteen of your checkers');
    eq('and so does the opponent\'s',
       B.describePoint(s, 1, solo), "Point 1, fifteen of the opponent's checkers");
    eq('an empty point says so', B.describePoint(s, 13, solo), 'Point 13, empty');

    /* "one of your checkers", not "one of your checker". */
    var one = E.fromSpec({ 9: 'W' });
    eq('a single checker is still plural after "one of"',
       B.describePoint(one, 9, solo), 'Point 9, one of your checkers');
    eq('but a colour name stays singular',
       B.describePoint(one, 9, duo), 'Point 9, one purple checker');

    /* The layer that makes Mahbooseh what it is has to be spoken, since
       a screen reader cannot see one checker sitting on another. */
    var pinned = E.fromSpec({ 9: 'BW' });
    eq('a pin is described, not implied',
       B.describePoint(pinned, 9, solo),
       "Point 9, one of your checkers, on top of one of the opponent's checkers trapped underneath");

    var deep = E.fromSpec({ 9: 'BWW' });
    eq('so is a stack sitting on a prisoner',
       B.describePoint(deep, 9, duo),
       'Point 9, two purple checkers, on top of one cyan checker trapped underneath');

    /* The sandwich: both colours buried under the top run. */
    var sand = E.fromSpec({ 9: 'BWB' });
    ok('a sandwich names both trapped colours',
       /one cyan checker/.test(B.describePoint(sand, 9, duo)) &&
       /one purple checker/.test(B.describePoint(sand, 9, duo)),
       B.describePoint(sand, 9, duo));
  })();

  /* ---------------------------------------------------------------- */
  describe('Lesson diagrams');

  C.GAMES.forEach(function (game) {
    game.lessons.forEach(function (l, i) {
      /* Pull each diagram's whole tag so its data-bar travels with it. */
      var re = /<div class="diagram"([^>]*)><\/div>/g, m, k = 0;
      while ((m = re.exec(l.html))) {
        k++;
        var attrs = m[1];
        var tag = game.id + ' lesson ' + (i + 1) + ' diagram ' + k;
        var specRaw = (attrs.match(/data-spec='([^']*)'/) || [])[1];
        var barRaw = (attrs.match(/data-bar='([^']*)'/) || [])[1];
        var spec, bar = { W: 0, B: 0 };
        try { spec = JSON.parse(specRaw || '{}'); }
        catch (err) { ok(tag + ': spec parses', false, String(err)); continue; }
        if (barRaw) {
          try {
            var b = JSON.parse(barRaw);
            bar.W = b.W || 0; bar.B = b.B || 0;
          } catch (err2) { ok(tag + ': bar parses', false, String(err2)); continue; }
        }
        if (!Object.keys(spec).length) continue;    // deliberately empty board
        var pts = E.fromSpec(spec).points;
        eq(tag + ': 15 White checkers', E.countOn(pts, 'W') + bar.W, 15);
        eq(tag + ': 15 Black checkers', E.countOn(pts, 'B') + bar.B, 15);
        var bad = Object.keys(spec).filter(function (p) { return +p < 1 || +p > 24; });
        eq(tag + ': all points in range', bad.join(','), '');
        /* Only a variant with a bar may show checkers on it. */
        if (bar.W || bar.B) {
          var vid = (attrs.match(/data-variant="([^"]*)"/) || [])[1];
          ok(tag + ': bar is only used by a variant that has one',
             !!(vid && E.VARIANTS[vid] && E.VARIANTS[vid].hasBar), 'variant=' + vid);
        }
      }
    });
  });

  /* ---------------------------------------------------------------- */
  describe('Drill positions');

  C.DRILLS.forEach(function (d, i) {
    var tag = 'drill ' + (i + 1) + ' (' + d.title + ')';
    var st = E.fromSpec(d.spec, 'W', {});
    eq(tag + ': 15 White checkers', E.countOn(st.points, 'W'), 15);
    eq(tag + ': 15 Black checkers', E.countOn(st.points, 'B'), 15);
    E.setRoll(st, d.roll[0], d.roll[1]);
    ok(tag + ': has legal moves', E.legalNow(st).length > 0);

    if (d.key) {
      /* every key move must be reachable inside one single maximal plan */
      var viable = st.plans.filter(function (pl) {
        return d.key.every(function (k) {
          return pl.some(function (m) { return m.from === k.from && (m.off ? 0 : m.to) === k.to; });
        });
      });
      ok(tag + ': answer key is playable', viable.length > 0,
         'no maximal plan contains ' + JSON.stringify(d.key));
    }
    if (d.avoid) {
      var clean = st.plans.filter(function (pl) {
        return !pl.some(function (m) { return d.avoid.indexOf(m.from) >= 0; });
      });
      ok(tag + ': a plan avoiding ' + d.avoid.join(',') + ' exists', clean.length > 0);
      var dirty = st.plans.filter(function (pl) {
        return pl.some(function (m) { return d.avoid.indexOf(m.from) >= 0; });
      });
      ok(tag + ': the tempting wrong move is also available', dirty.length > 0);
    }
  });

  /* Drill 3 claims a unique blot-free answer — verify that claim. */
  describe('Drill 3 uniqueness');
  (function () {
    var d = C.DRILLS[2];
    var st = E.fromSpec(d.spec, 'W', {});
    E.setRoll(st, d.roll[0], d.roll[1]);
    /* Plans differing only in the order the dice are played are the same
       play, so compare order-independent move sets. */
    var safe = {};
    st.plans.forEach(function (pl) {
      var pts = E.clonePoints(st.points), off = { W: 0, B: 0 };
      pl.forEach(function (m) { E.applyOn(pts, off, 'W', m); });
      if (E.blots(pts, 'W').length === 0) {
        safe[pl.map(function (m) { return m.from + '>' + (m.off ? 'off' : m.to); }).sort().join(' ')] = 1;
      }
    });
    var keys = Object.keys(safe);
    eq('exactly one blot-free play exists', keys.length, 1);
    if (keys.length === 1) eq('and it is the answer key', keys[0], '11>10 13>10');
  })();

  /* ---------------------------------------------------------------- */
  describe('Full random games');

  (function () {
    var crashed = 0, finished = 0, longest = 0;
    for (var n = 0; n < 40; n++) {
      try {
        var s = E.newGame(), turns = 0;
        while (!E.result(s) && turns < 600) {
          var dd = E.rollDice();
          E.setRoll(s, dd[0], dd[1]);
          var plan = window.AI.choosePlan(s, n % 2 ? 'normal' : 'easy');
          (plan || []).forEach(function (m) { E.apply(s, m); });
          if (E.isDeadlock(s.points)) break;   // drawn: nothing can change
          if (E.result(s)) break;
          E.endTurn(s);
          turns++;
        }
        longest = Math.max(longest, turns);
        if (E.result(s)) finished++;
        /* invariant: nobody ever gains or loses a checker */
        var tot = E.countOn(s.points, 'W') + s.off.W;
        if (tot !== 15) throw new Error('White checker count drifted to ' + tot);
        var totB = E.countOn(s.points, 'B') + s.off.B;
        if (totB !== 15) throw new Error('Black checker count drifted to ' + totB);
      } catch (err) { crashed++; results.push({ group: group, name: 'game ' + n, pass: false, detail: String(err) }); }
    }
    eq('40 games ran without error', crashed, 0);
    ok('most games reached a result (' + finished + '/40, longest ' + longest + ' turns)', finished >= 35);
  })();

  /* ---------------------------------------------------------------- */
  /* Report                                                            */

  function report(pending) {
    var pass = results.filter(function (r) { return r.pass; }).length;
    var fail = results.length - pass;
    var out = document.getElementById('out');
    var html = '<div class="flash ' + (fail ? 'error' : 'success') + '"><strong>' +
               pass + ' passed, ' + fail + ' failed</strong> of ' + results.length +
               ' assertions.' + (pending ? ' <em>(offline checks still running…)</em>' : '') +
               '</div>';
    var lastGroup = null;
    results.forEach(function (r) {
      if (r.group !== lastGroup) {
        lastGroup = r.group;
        html += '<div class="label" style="margin:1.1rem 0 .4rem">' + r.group + '</div>';
      }
      html += '<div class="t ' + (r.pass ? 'p' : 'f') + '">' +
              '<span class="mark">' + (r.pass ? '✓' : '✕') + '</span>' + r.name +
              (r.detail ? '<span class="detail"> — ' + r.detail + '</span>' : '') + '</div>';
    });
    out.innerHTML = html;
    window.__tests = { pass: pass, fail: fail, results: results, done: !pending };
  }

  report(true);

  /* ------------------------------------------------------------------ */
  /* Offline / PWA checks. These need the network, so they run after the
     synchronous suite and refresh the report when they land.            */

  function text(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
      return r.text();
    });
  }

  describe('PWA — manifest');

  Promise.resolve()
    .then(function () { return text('manifest.webmanifest'); })
    .then(function (raw) {
      var m = JSON.parse(raw);
      ok('manifest is valid JSON', true);
      ok('has a name', !!m.name);
      ok('has a short_name that fits under an icon', !!m.short_name && m.short_name.length <= 12);
      ok('has a start_url', !!m.start_url);
      eq('display is standalone', m.display, 'standalone');
      ok('background and theme colours are set', !!m.background_color && !!m.theme_color);

      var sizes = (m.icons || []).map(function (i) { return i.sizes; });
      ok('declares a 192px icon', sizes.indexOf('192x192') >= 0, sizes.join(' '));
      ok('declares a 512px icon', sizes.indexOf('512x512') >= 0, sizes.join(' '));
      ok('declares a maskable icon',
         (m.icons || []).some(function (i) { return (i.purpose || '').indexOf('maskable') >= 0; }));

      /* Every icon must actually exist and actually be a PNG. */
      return Promise.all((m.icons || []).map(function (i) {
        return fetch(i.src, { cache: 'no-store' }).then(function (r) {
          ok('icon ' + i.src + ' is served', r.ok, r.ok ? '' : 'HTTP ' + r.status);
          return r.ok ? r.arrayBuffer() : null;
        }).then(function (buf) {
          if (!buf) return;
          var b = new Uint8Array(buf);
          ok('icon ' + i.src + ' is a real PNG',
             b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47);
        });
      }));
    })
    ['catch'](function (e) { ok('manifest loads', false, String(e)); })

    /* ---------------------------------------------------------------- */
    .then(function () {
      describe('PWA — offline completeness');
      return Promise.all([text('sw.js'), text('index.html')]);
    })
    .then(function (both) {
      var sw = both[0], page = both[1];

      var block = sw.match(/var\s+PRECACHE\s*=\s*\[([\s\S]*?)\]/);
      ok('sw.js declares a PRECACHE list', !!block);
      if (!block) return;
      var precache = (block[1].match(/'[^']*'/g) || []).map(function (s) { return s.slice(1, -1); });
      ok('PRECACHE is not empty', precache.length > 0);

      var version = sw.match(/var\s+CACHE\s*=\s*'([^']+)'/);
      ok('sw.js declares a versioned cache name', !!version, version && version[1]);

      /* Everything index.html pulls in must be precached, or the app
         breaks offline in exactly the way nobody tests for. */
      var doc = new DOMParser().parseFromString(page, 'text/html');
      var needed = [];
      Array.prototype.forEach.call(doc.querySelectorAll('script[src]'), function (s) {
        needed.push(s.getAttribute('src'));
      });
      Array.prototype.forEach.call(doc.querySelectorAll('link[rel="stylesheet"], link[rel="manifest"]'), function (l) {
        needed.push(l.getAttribute('href'));
      });

      needed.forEach(function (u) {
        ok('precached: ' + u, precache.indexOf(u) >= 0,
           'index.html loads it but sw.js does not cache it');
      });

      /* And nothing in the list may 404 — a typo here silently breaks
         the offline copy of one file only. */
      return Promise.all(precache.map(function (u) {
        return fetch(u, { cache: 'no-store' })
          .then(function (r) { ok('PRECACHE entry resolves: ' + u, r.ok, r.ok ? '' : 'HTTP ' + r.status); })
          ['catch'](function (e) { ok('PRECACHE entry resolves: ' + u, false, String(e)); });
      }));
    })
    ['catch'](function (e) { ok('offline checks ran', false, String(e)); })
    .then(function () { report(false); });
})();
