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
  describe('Lesson diagrams');

  C.LESSONS.forEach(function (l, i) {
    var re = /data-spec='([^']*)'/g, m, k = 0;
    while ((m = re.exec(l.html))) {
      k++;
      var tag = 'lesson ' + (i + 1) + ' diagram ' + k;
      var spec;
      try { spec = JSON.parse(m[1]); }
      catch (err) { ok(tag + ': spec parses', false, String(err)); continue; }
      if (!Object.keys(spec).length) continue;      // deliberately empty board
      var pts = E.fromSpec(spec).points;
      eq(tag + ': 15 White checkers', E.countOn(pts, 'W'), 15);
      eq(tag + ': 15 Black checkers', E.countOn(pts, 'B'), 15);
      var bad = Object.keys(spec).filter(function (p) { return +p < 1 || +p > 24; });
      eq(tag + ': all points in range', bad.join(','), '');
    }
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

  var pass = results.filter(function (r) { return r.pass; }).length;
  var fail = results.length - pass;
  var out = document.getElementById('out');
  var html = '<div class="flash ' + (fail ? 'error' : 'success') + '"><strong>' +
             pass + ' passed, ' + fail + ' failed</strong> of ' + results.length + ' assertions.</div>';
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
  window.__tests = { pass: pass, fail: fail, results: results };
})();
