/* =====================================================================
 * Vortex Tawla — Mahbooseh rules engine
 * ---------------------------------------------------------------------
 * Pure logic, zero DOM. Loaded as a classic script so the whole app also
 * runs straight off the filesystem (file://) with no build step.
 *
 * Board numbering is ABSOLUTE, always from White's point of view:
 *
 *      13 14 15 16 17 18 | 19 20 21 22 23 24   <- Black's home (19-24)
 *      12 11 10  9  8  7 |  6  5  4  3  2  1   <- White's home (1-6)
 *
 *   White starts with 15 checkers on point 24 and runs 24 -> 1.
 *   Black starts with 15 checkers on point  1 and runs  1 -> 24.
 *
 * A point is stored as an array of colours, BOTTOM first. That single
 * choice gives us pinning for free: only the top run of same-coloured
 * checkers can ever move, so anything buried underneath is "mahboos"
 * (imprisoned) and simply has no legal moves until it is uncovered.
 * ===================================================================== */
(function (root) {
  'use strict';

  var W = 'W', B = 'B';

  function opp(p)        { return p === W ? B : W; }
  function dir(p)        { return p === W ? -1 : 1; }
  function pipOf(p, pt)  { return p === W ? pt : 25 - pt; }
  function inHome(p, pt) { return pipOf(p, pt) >= 1 && pipOf(p, pt) <= 6; }
  function startPoint(p) { return p === W ? 24 : 1; }

  /* ---------------------------------------------------------------- */
  /* Board primitives                                                  */
  /* ---------------------------------------------------------------- */

  function emptyPoints() {
    var a = new Array(26);
    for (var i = 0; i <= 25; i++) a[i] = [];
    return a;
  }

  function clonePoints(pts) {
    var a = new Array(26);
    for (var i = 0; i <= 25; i++) a[i] = pts[i].slice();
    return a;
  }

  /* The contiguous run of same-coloured checkers sitting on top of a
     point. This is the only part of a stack that is ever mobile, and the
     only part that matters when deciding whether you may land there. */
  function topRun(pts, i) {
    var a = pts[i];
    if (!a || a.length === 0) return { color: null, len: 0 };
    var c = a[a.length - 1], n = 1;
    for (var k = a.length - 2; k >= 0 && a[k] === c; k--) n++;
    return { color: c, len: n };
  }

  /* Mahbooseh has no hitting: you either own the point, or you trap a
     lone enemy checker by sitting on top of it, or you are shut out. */
  function canLand(pts, p, i) {
    var run = topRun(pts, i);
    if (run.len === 0) return true;        // empty point
    if (run.color === p) return true;      // our own stack
    return run.len === 1;                  // lone blot -> we pin it
  }

  function countOn(pts, p) {
    var n = 0;
    for (var i = 1; i <= 24; i++)
      for (var k = 0; k < pts[i].length; k++) if (pts[i][k] === p) n++;
    return n;
  }

  function pipCount(pts, p) {
    var n = 0;
    for (var i = 1; i <= 24; i++)
      for (var k = 0; k < pts[i].length; k++) if (pts[i][k] === p) n += pipOf(p, i);
    return n;
  }

  /* Every checker home? Pinned checkers count too — that is precisely
     why one trapped checker can stop you bearing off all game. */
  function allHome(pts, p) {
    for (var i = 1; i <= 24; i++) {
      if (inHome(p, i)) continue;
      for (var k = 0; k < pts[i].length; k++) if (pts[i][k] === p) return false;
    }
    return true;
  }

  function hasHigherThan(pts, p, pip) {
    for (var i = 1; i <= 24; i++) {
      if (pipOf(p, i) <= pip) continue;
      for (var k = 0; k < pts[i].length; k++) if (pts[i][k] === p) return true;
    }
    return false;
  }

  /* Enemy checkers we currently hold pinned, listed by point. */
  function pinsHeldBy(pts, p) {
    var out = [];
    for (var i = 1; i <= 24; i++) {
      var run = topRun(pts, i);
      if (run.color !== p) continue;
      var a = pts[i], below = a.length - run.len - 1;
      if (below >= 0 && a[below] === opp(p)) out.push(i);
    }
    return out;
  }

  /* Our own checkers that cannot move because someone sits on them. */
  function pinnedCheckers(pts, p) {
    var out = [];
    for (var i = 1; i <= 24; i++) {
      var a = pts[i];
      for (var k = 0; k < a.length - 1; k++) {
        if (a[k] === p && a[k + 1] === opp(p)) { out.push(i); break; }
      }
    }
    return out;
  }

  /* The "mana" (mother): p holds the opponent's LAST checker trapped on
     the opponent's own starting point. That checker can never come home,
     so the opponent cannot bear off for as long as the pin is held. */
  function manaHeldBy(pts, p) {
    var q = startPoint(opp(p)), a = pts[q];
    if (a.length < 2) return false;
    if (a[0] !== opp(p)) return false;
    if (topRun(pts, q).color !== p) return false;
    var n = 0;
    for (var k = 0; k < a.length; k++) if (a[k] === opp(p)) n++;
    return n === 1;
  }

  /* A blot is a lone checker of ours with nothing of ours above it. */
  function blots(pts, p) {
    var out = [];
    for (var i = 1; i <= 24; i++) {
      var run = topRun(pts, i);
      if (run.color === p && run.len === 1) out.push(i);
    }
    return out;
  }

  /* How many of the six dice faces let `by` land on point q right now. */
  function directShots(pts, by, q) {
    var n = 0;
    for (var d = 1; d <= 6; d++) {
      var s = q - dir(by) * d;
      if (s < 1 || s > 24) continue;
      if (topRun(pts, s).color === by) n++;
    }
    return n;
  }

  /* ---------------------------------------------------------------- */
  /* Move generation                                                   */
  /* ---------------------------------------------------------------- */

  function uniq(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++)
      if (!seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); }
    return out;
  }

  /* Single-die moves available right now. to === 0 (White) or 25 (Black)
     means bearing off. */
  function genMoves(pts, p, remaining) {
    var out = [], dice = uniq(remaining), home = allHome(pts, p);
    for (var di = 0; di < dice.length; di++) {
      var d = dice[di];
      for (var s = 1; s <= 24; s++) {
        if (topRun(pts, s).color !== p) continue;
        var t = s + dir(p) * d;
        if (t >= 1 && t <= 24) {
          if (canLand(pts, p, t)) out.push({ from: s, to: t, die: d });
        } else if (home) {
          /* Running off the end of the board means pip <= d, so this is
             a bear-off: an exact roll always works, an overshoot only
             from the highest point we still occupy. */
          var pip = pipOf(p, s);
          if (pip === d || !hasHigherThan(pts, p, pip))
            out.push({ from: s, to: p === W ? 0 : 25, die: d, off: true });
        }
      }
    }
    return out;
  }

  function applyOn(pts, off, p, mv) {
    var a = pts[mv.from], pinned = false, freed = false;
    a.pop();
    if (a.length && a[a.length - 1] === opp(p)) freed = true;
    if (mv.off) {
      off[p]++;
    } else {
      var run = topRun(pts, mv.to);
      if (run.color === opp(p) && run.len === 1) pinned = true;
      pts[mv.to].push(p);
    }
    return { pinned: pinned, freed: freed };
  }

  function sameMove(a, b) {
    return !!a && !!b && a.from === b.from && a.to === b.to && a.die === b.die;
  }

  /* A player with no legal move for ANY of the six faces cannot move on
     any roll at all — every move is a single-die step, so checking the
     faces is exact. If BOTH players are dead the position can never
     change again and the game is drawn.
     This is reachable for real: if each side holds the other's mana and
     has piled its remaining checkers onto that same point, nobody can
     bear off and nobody can move. It is the reason many tables score the
     mana as an immediate double loss instead of playing it out. */
  function isDead(pts, p) {
    return genMoves(pts, p, [1, 2, 3, 4, 5, 6]).length === 0;
  }

  function isDeadlock(pts) {
    return isDead(pts, W) && isDead(pts, B);
  }

  /* All maximal ways to play the roll.
   *
   * "Use both dice if you can, and if only one is playable play the
   * higher" is a property of the WHOLE turn, not of each move in
   * isolation — playing greedily can strand a die you were obliged to
   * use. So we enumerate every terminal sequence up front and keep only
   * the longest; the UI then just walks this plan list. */
  function enumeratePlans(pts, p, dice) {
    var terminal = [], budget = 120000;

    function rec(board, remaining, seq) {
      if (budget-- < 0) { terminal.push(seq.slice()); return; }
      var moves = remaining.length ? genMoves(board, p, remaining) : [];
      if (moves.length === 0) { terminal.push(seq.slice()); return; }
      for (var i = 0; i < moves.length; i++) {
        var mv = moves[i];
        var nb = clonePoints(board), noff = { W: 0, B: 0 };
        applyOn(nb, noff, p, mv);
        var rem = remaining.slice();
        rem.splice(rem.indexOf(mv.die), 1);
        seq.push(mv);
        rec(nb, rem, seq);
        seq.pop();
      }
    }
    rec(pts, dice.slice(), []);

    var max = 0, i;
    for (i = 0; i < terminal.length; i++) max = Math.max(max, terminal[i].length);
    var plans = terminal.filter(function (s) { return s.length === max; });

    /* Exactly one die playable: it must be the higher one where that is
       a legal choice. */
    if (max === 1 && dice.length === 2 && dice[0] !== dice[1]) {
      var hi = Math.max(dice[0], dice[1]);
      var hiPlans = plans.filter(function (s) { return s[0].die === hi; });
      if (hiPlans.length) plans = hiPlans;
    }

    /* Drop duplicate orderings so the UI never offers the same choice
       twice. */
    var seen = {}, dedup = [];
    for (i = 0; i < plans.length; i++) {
      var k = plans[i].map(function (m) { return m.from + '>' + m.to + ':' + m.die; }).join('|');
      if (!seen[k]) { seen[k] = 1; dedup.push(plans[i]); }
    }
    return dedup;
  }

  /* ---------------------------------------------------------------- */
  /* Game state                                                        */
  /* ---------------------------------------------------------------- */

  function makeState(pts, turn, opts) {
    var o = { manaEndsGame: false };
    if (opts) for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    return {
      points: pts,
      off: { W: 0, B: 0 },
      turn: turn || W,
      roll: [],            // the two faces as thrown
      dice: [],            // values still unplayed this turn
      played: [],          // moves committed so far this turn
      plans: [],           // every maximal way to finish the turn
      opts: o
    };
  }

  function newGame(opts) {
    var pts = emptyPoints();
    for (var i = 0; i < 15; i++) { pts[24].push(W); pts[1].push(B); }
    return makeState(pts, (opts && opts.first) || W, opts);
  }

  /* Build a position from a compact spec for lessons and drills:
     { 24: 'WWW', 6: 'BW' } — bottom of stack first, so 'BW' is a Black
     checker pinned by a White one. */
  function fromSpec(spec, turn, opts) {
    var pts = emptyPoints();
    Object.keys(spec).forEach(function (k) {
      var s = String(spec[k]);
      for (var i = 0; i < s.length; i++) pts[+k].push(s[i] === 'W' ? W : B);
    });
    var st = makeState(pts, turn || W, opts);
    st.off.W = 15 - countOn(pts, W);
    st.off.B = 15 - countOn(pts, B);
    return st;
  }

  function clone(s) {
    return {
      points: clonePoints(s.points),
      off: { W: s.off.W, B: s.off.B },
      turn: s.turn,
      roll: s.roll.slice(),
      dice: s.dice.slice(),
      played: s.played.slice(),
      plans: s.plans.map(function (p) { return p.slice(); }),
      opts: s.opts
    };
  }

  function setRoll(s, d1, d2) {
    s.roll = [d1, d2];
    s.dice = (d1 === d2) ? [d1, d1, d1, d1] : [d1, d2];
    s.played = [];
    s.plans = enumeratePlans(s.points, s.turn, s.dice);
    return s;
  }

  function rollDice(rng) {
    var r = rng || Math.random;
    return [1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6)];
  }

  function matchingPlans(s) {
    return s.plans.filter(function (pl) {
      if (pl.length < s.played.length) return false;
      for (var j = 0; j < s.played.length; j++)
        if (!sameMove(pl[j], s.played[j])) return false;
      return true;
    });
  }

  /* The moves the player may legally choose right now: the next step of
     every still-viable maximal plan. */
  function legalNow(s) {
    var seen = {}, out = [];
    matchingPlans(s).forEach(function (pl) {
      var mv = pl[s.played.length];
      if (!mv) return;
      var k = mv.from + '>' + mv.to + ':' + mv.die;
      if (!seen[k]) { seen[k] = 1; out.push(mv); }
    });
    return out;
  }

  function turnComplete(s) { return legalNow(s).length === 0; }

  function apply(s, mv) {
    var res = applyOn(s.points, s.off, s.turn, mv);
    s.dice.splice(s.dice.indexOf(mv.die), 1);
    s.played.push(mv);
    return res;
  }

  function endTurn(s) {
    s.turn = opp(s.turn);
    s.roll = []; s.dice = []; s.played = []; s.plans = [];
    return s;
  }

  /* Result: null while the game is live, else { winner, points, reason }.
     A "mars" is a double game — the loser never got a checker off. */
  function result(s) {
    if (s.off.W === 15)
      return { winner: W, points: s.off.B === 0 ? 2 : 1, reason: s.off.B === 0 ? 'mars' : 'single' };
    if (s.off.B === 15)
      return { winner: B, points: s.off.W === 0 ? 2 : 1, reason: s.off.W === 0 ? 'mars' : 'single' };
    if (s.opts.manaEndsGame) {
      if (manaHeldBy(s.points, W)) return { winner: W, points: 2, reason: 'mana' };
      if (manaHeldBy(s.points, B)) return { winner: B, points: 2, reason: 'mana' };
    }
    if (isDeadlock(s.points)) return { winner: null, points: 0, reason: 'deadlock' };
    return null;
  }

  root.Engine = {
    W: W, B: B,
    opp: opp, dir: dir, pipOf: pipOf, inHome: inHome, startPoint: startPoint,
    emptyPoints: emptyPoints, clonePoints: clonePoints,
    topRun: topRun, canLand: canLand, countOn: countOn, pipCount: pipCount,
    allHome: allHome, pinsHeldBy: pinsHeldBy, pinnedCheckers: pinnedCheckers,
    manaHeldBy: manaHeldBy, blots: blots, directShots: directShots,
    isDead: isDead, isDeadlock: isDeadlock,
    genMoves: genMoves, enumeratePlans: enumeratePlans, applyOn: applyOn,
    newGame: newGame, fromSpec: fromSpec, clone: clone,
    setRoll: setRoll, rollDice: rollDice,
    legalNow: legalNow, turnComplete: turnComplete, matchingPlans: matchingPlans,
    apply: apply, endTurn: endTurn, result: result, sameMove: sameMove
  };
})(typeof window !== 'undefined' ? window : globalThis);
