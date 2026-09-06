/* =====================================================================
 * Vortex Tawla — rules engine
 * ---------------------------------------------------------------------
 * Pure logic, zero DOM. Loaded as a classic script so the whole app also
 * runs straight off the filesystem (file://) with no build step.
 *
 * ---------------------------------------------------------------------
 * BOARD NUMBERING
 *
 * `points` is indexed 1..24 in ABSOLUTE screen order, always as White
 * sees it:
 *
 *      13 14 15 16 17 18 | 19 20 21 22 23 24
 *      12 11 10  9  8  7 |  6  5  4  3  2  1
 *
 * Everything else is expressed in a player's OWN numbering, where 24 is
 * their starting corner and 1 is the last point before they bear off.
 * `variant.own(p, i)` converts absolute to own, `variant.abs(p, k)` back
 * again — and a checker's own-number IS its pip count, which is why the
 * rest of the engine can talk about movement without caring which
 * direction a player travels or where their home board sits.
 *
 * That is the seam the game variants hang off:
 *
 *   Mahbooseh     opposed directions, trapping, no bar
 *   Fransawiyyeh  opposed directions, hitting, bar and re-entry
 *   Gulbahar      same rotational direction (not implemented yet)
 *
 * ---------------------------------------------------------------------
 * STACKS
 *
 * A point is an array of colours, BOTTOM first. That gives Mahbooseh's
 * pinning for free: only the contiguous top run of same-coloured
 * checkers can ever move, so anything buried underneath is "mahboos"
 * (imprisoned) and simply generates no moves. It also handles the
 * sandwich — pinning the checker that is pinning yours — with no special
 * case. In variants that hit rather than pin, a point only ever holds
 * one colour and the array degenerates to a plain stack.
 * ===================================================================== */
(function (root) {
  'use strict';

  var W = 'W', B = 'B';

  function opp(p) { return p === W ? B : W; }

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

  /* The contiguous run of same-coloured checkers on top of a point: the
     only part of a stack that is ever mobile, and the only part that
     matters when deciding whether you may land there. */
  function topRun(pts, i) {
    var a = pts[i];
    if (!a || a.length === 0) return { color: null, len: 0 };
    var c = a[a.length - 1], n = 1;
    for (var k = a.length - 2; k >= 0 && a[k] === c; k--) n++;
    return { color: c, len: n };
  }

  /* ---------------------------------------------------------------- */
  /* Variants                                                          */
  /* ---------------------------------------------------------------- */

  /* Opposed travel, as in Mahbooseh and Fransawiyyeh: White runs 24->1
     and Black runs 1->24, so Black's own numbering is White's mirrored. */
  function opposedOwn(p, i) { return p === W ? i : 25 - i; }
  function opposedAbs(p, k) { return p === W ? k : 25 - k; }

  /* Landing where a lone enemy checker sits is allowed (it gets pinned
     or hit, depending on the variant); two or more shut you out. */
  function canLandContact(pts, p, i) {
    var run = topRun(pts, i);
    if (run.len === 0) return true;
    if (run.color === p) return true;
    return run.len === 1;
  }

  var VARIANTS = {

    mahbooseh: {
      id: 'mahbooseh',
      name: 'Mahbooseh',
      arabic: 'محبوسة',
      blurb: 'No hitting. Land on a lone enemy checker and it is trapped underneath yours.',
      hasBar: false,
      pins: true,
      hits: false,
      own: opposedOwn,
      abs: opposedAbs,
      canLand: canLandContact,
      /* All fifteen on the far corner, inside the opponent's home. */
      setup: function (pts) {
        for (var i = 0; i < 15; i++) { pts[24].push(W); pts[1].push(B); }
      },
      /* Single game, or a mars (double) if the loser bore off nothing. */
      score: function (s, winner) {
        return s.off[opp(winner)] === 0
          ? { points: 2, reason: 'mars' }
          : { points: 1, reason: 'single' };
      }
    },

    fransawiyyeh: {
      id: 'fransawiyyeh',
      name: 'Fransawiyyeh',
      arabic: 'فرنساوية',
      blurb: 'International backgammon. Hit a lone enemy checker and it goes to the bar.',
      hasBar: true,
      pins: false,
      hits: true,
      own: opposedOwn,
      abs: opposedAbs,
      canLand: canLandContact,
      /* The standard opening, in own-numbering: 24×2, 13×5, 8×3, 6×5. */
      setup: function (pts, v) {
        [[24, 2], [13, 5], [8, 3], [6, 5]].forEach(function (pair) {
          for (var i = 0; i < pair[1]; i++) {
            pts[v.abs(W, pair[0])].push(W);
            pts[v.abs(B, pair[0])].push(B);
          }
        });
      },
      /* Backgammon (triple) if the loser bore off nothing AND still has a
         checker on the bar or stuck in the winner's home board. */
      score: function (s, winner) {
        var loser = opp(winner);
        if (s.off[loser] > 0) return { points: 1, reason: 'single' };
        var stranded = s.bar[loser] > 0;
        if (!stranded) {
          for (var i = 1; i <= 24 && !stranded; i++) {
            if (this.own(winner, i) > 18) continue;   // not winner's home
            for (var k = 0; k < s.points[i].length; k++)
              if (s.points[i][k] === loser) { stranded = true; break; }
          }
        }
        return stranded
          ? { points: 3, reason: 'backgammon' }
          : { points: 2, reason: 'gammon' };
      }
    }
  };

  var DEFAULT = VARIANTS.mahbooseh;
  function V(v) { return v || DEFAULT; }

  /* ---------------------------------------------------------------- */
  /* Geometry, in the current variant's terms                          */
  /* ---------------------------------------------------------------- */

  /* A checker's own-number is exactly the pips it still owes. */
  function pipOf(p, i, v) { return V(v).own(p, i); }
  function inHome(p, i, v) { var k = V(v).own(p, i); return k >= 1 && k <= 6; }
  function startPoint(p, v) { return V(v).abs(p, 24); }
  /* Entering from the bar lands in the opponent's home: own 19..24. */
  function entryPoint(p, die, v) { return V(v).abs(p, 25 - die); }

  function canLand(pts, p, i, v) { return V(v).canLand(pts, p, i); }

  function countOn(pts, p) {
    var n = 0;
    for (var i = 1; i <= 24; i++)
      for (var k = 0; k < pts[i].length; k++) if (pts[i][k] === p) n++;
    return n;
  }

  function pipCount(pts, p, v, bar) {
    var n = 0;
    for (var i = 1; i <= 24; i++)
      for (var k = 0; k < pts[i].length; k++) if (pts[i][k] === p) n += pipOf(p, i, v);
    /* A checker on the bar has the whole board to cross: 25 pips. */
    if (bar && bar[p]) n += bar[p] * 25;
    return n;
  }

  /* Every checker home? Pinned checkers count, and so does the bar —
     which is exactly why one trapped checker stops bear-off all game. */
  function allHome(pts, p, v, bar) {
    if (bar && bar[p] > 0) return false;
    for (var i = 1; i <= 24; i++) {
      if (inHome(p, i, v)) continue;
      for (var k = 0; k < pts[i].length; k++) if (pts[i][k] === p) return false;
    }
    return true;
  }

  function hasHigherThan(pts, p, pip, v) {
    for (var i = 1; i <= 24; i++) {
      if (pipOf(p, i, v) <= pip) continue;
      for (var k = 0; k < pts[i].length; k++) if (pts[i][k] === p) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------- */
  /* Contact analysis                                                  */
  /* ---------------------------------------------------------------- */

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
     the opponent's own starting point, so it can never come home. */
  function manaHeldBy(pts, p, v) {
    if (!V(v).pins) return false;
    var q = startPoint(opp(p), v), a = pts[q];
    if (a.length < 2) return false;
    if (a[0] !== opp(p)) return false;
    if (topRun(pts, q).color !== p) return false;
    var n = 0;
    for (var k = 0; k < a.length; k++) if (a[k] === opp(p)) n++;
    return n === 1;
  }

  function blots(pts, p) {
    var out = [];
    for (var i = 1; i <= 24; i++) {
      var run = topRun(pts, i);
      if (run.color === p && run.len === 1) out.push(i);
    }
    return out;
  }

  /* How many of the six faces let `by` land on point q right now. */
  function directShots(pts, by, q, v) {
    var n = 0, target = pipOf(by, q, v);
    for (var d = 1; d <= 6; d++) {
      var k = target + d;                     // the point d pips behind it
      if (k > 24) continue;
      var s = V(v).abs(by, k);
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

  /* Single-die moves available right now. `from === 'bar'` is a re-entry;
     `to === 0` means bearing off. */
  function genMoves(pts, p, remaining, v, bar) {
    v = V(v);
    var out = [], dice = uniq(remaining), di, d;

    /* Checkers on the bar must all come back before anything else moves. */
    if (v.hasBar && bar && bar[p] > 0) {
      for (di = 0; di < dice.length; di++) {
        d = dice[di];
        var e = entryPoint(p, d, v);
        if (v.canLand(pts, p, e)) out.push({ from: 'bar', to: e, die: d, enter: true });
      }
      return out;
    }

    var home = allHome(pts, p, v, bar);
    for (di = 0; di < dice.length; di++) {
      d = dice[di];
      for (var s = 1; s <= 24; s++) {
        if (topRun(pts, s).color !== p) continue;
        var k = v.own(p, s) - d;
        if (k >= 1) {
          var t = v.abs(p, k);
          if (v.canLand(pts, p, t)) out.push({ from: s, to: t, die: d });
        } else if (home) {
          /* Running off the end means pip <= d: an exact roll always
             works, an overshoot only from the highest point we occupy. */
          var pip = v.own(p, s);
          if (pip === d || !hasHigherThan(pts, p, pip, v))
            out.push({ from: s, to: 0, die: d, off: true });
        }
      }
    }
    return out;
  }

  function applyOn(pts, off, p, mv, v, bar) {
    v = V(v);
    var pinned = false, hit = false, freed = false;

    if (mv.enter) {
      if (bar) bar[p]--;
    } else {
      var a = pts[mv.from];
      a.pop();
      if (a.length && a[a.length - 1] === opp(p)) freed = true;
    }

    if (mv.off) { off[p]++; return { pinned: false, hit: false, freed: freed }; }

    var run = topRun(pts, mv.to);
    if (run.color === opp(p) && run.len === 1) {
      if (v.hits) {
        pts[mv.to].pop();                 // send it to the bar
        if (bar) bar[opp(p)]++;
        hit = true;
      } else {
        pinned = true;                    // sit on it instead
      }
    }
    pts[mv.to].push(p);
    return { pinned: pinned, hit: hit, freed: freed };
  }

  function sameMove(a, b) {
    return !!a && !!b && a.from === b.from && a.to === b.to && a.die === b.die;
  }

  /* A player with no legal move for ANY of the six faces cannot move on
     any roll: every move is a single-die step, so checking the faces is
     exact. If BOTH players are dead the position can never change and
     the game is drawn.
     Reachable for real in Mahbooseh: if each side holds the other's mana
     and has piled its remaining checkers onto that same point, nobody can
     bear off and nobody can move. It is the reason many tables score the
     mana as an immediate double loss. */
  function isDead(pts, p, v, bar) {
    return genMoves(pts, p, [1, 2, 3, 4, 5, 6], v, bar).length === 0;
  }

  function isDeadlock(pts, v, bar) {
    return isDead(pts, W, v, bar) && isDead(pts, B, v, bar);
  }

  /* All maximal ways to play the roll.
   *
   * "Use both dice if you can, and if only one is playable play the
   * higher" is a property of the WHOLE turn, not of each move in
   * isolation — playing greedily can strand a die you were obliged to
   * use. So enumerate every terminal sequence up front and keep only the
   * longest; the UI then just walks this plan list. */
  function enumeratePlans(pts, p, dice, v, bar) {
    v = V(v);
    var terminal = [], budget = 120000;

    function rec(board, bars, remaining, seq) {
      if (budget-- < 0) { terminal.push(seq.slice()); return; }
      var moves = remaining.length ? genMoves(board, p, remaining, v, bars) : [];
      if (moves.length === 0) { terminal.push(seq.slice()); return; }
      for (var i = 0; i < moves.length; i++) {
        var mv = moves[i];
        var nb = clonePoints(board);
        var nbar = { W: bars.W, B: bars.B };
        applyOn(nb, { W: 0, B: 0 }, p, mv, v, nbar);
        var rem = remaining.slice();
        rem.splice(rem.indexOf(mv.die), 1);
        seq.push(mv);
        rec(nb, nbar, rem, seq);
        seq.pop();
      }
    }
    rec(pts, { W: (bar && bar.W) || 0, B: (bar && bar.B) || 0 }, dice.slice(), []);

    var max = 0, i;
    for (i = 0; i < terminal.length; i++) max = Math.max(max, terminal[i].length);
    var plans = terminal.filter(function (s) { return s.length === max; });

    /* Exactly one die playable: it must be the higher one where that is a
       legal choice. */
    if (max === 1 && dice.length === 2 && dice[0] !== dice[1]) {
      var hi = Math.max(dice[0], dice[1]);
      var hiPlans = plans.filter(function (s) { return s[0].die === hi; });
      if (hiPlans.length) plans = hiPlans;
    }

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

  function makeState(pts, turn, opts, variantId) {
    var o = { manaEndsGame: false };
    if (opts) for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    var id = variantId || (opts && opts.variant) || 'mahbooseh';
    return {
      variantId: VARIANTS[id] ? id : 'mahbooseh',
      points: pts,
      off: { W: 0, B: 0 },
      bar: { W: 0, B: 0 },
      turn: turn || W,
      roll: [],            // the two faces as thrown
      dice: [],            // values still unplayed this turn
      played: [],          // moves committed so far this turn
      plans: [],           // every maximal way to finish the turn
      opts: o
    };
  }

  function variantOf(s) { return VARIANTS[s && s.variantId] || DEFAULT; }

  function newGame(opts) {
    var id = (opts && opts.variant) || 'mahbooseh';
    var v = VARIANTS[id] || DEFAULT;
    var pts = emptyPoints();
    v.setup(pts, v);
    return makeState(pts, (opts && opts.first) || W, opts, v.id);
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
    var st = makeState(pts, turn || W, opts, opts && opts.variant);
    if (opts && opts.bar) { st.bar.W = opts.bar.W || 0; st.bar.B = opts.bar.B || 0; }
    st.off.W = 15 - countOn(pts, W) - st.bar.W;
    st.off.B = 15 - countOn(pts, B) - st.bar.B;
    return st;
  }

  function clone(s) {
    return {
      variantId: s.variantId,
      points: clonePoints(s.points),
      off: { W: s.off.W, B: s.off.B },
      bar: { W: s.bar.W, B: s.bar.B },
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
    s.plans = enumeratePlans(s.points, s.turn, s.dice, variantOf(s), s.bar);
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
    var res = applyOn(s.points, s.off, s.turn, mv, variantOf(s), s.bar);
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
     winner === null with reason 'deadlock' is a draw. */
  function result(s) {
    var v = variantOf(s);
    if (s.off.W === 15) {
      var rw = v.score(s, W);
      return { winner: W, points: rw.points, reason: rw.reason };
    }
    if (s.off.B === 15) {
      var rb = v.score(s, B);
      return { winner: B, points: rb.points, reason: rb.reason };
    }
    if (s.opts.manaEndsGame && v.pins) {
      if (manaHeldBy(s.points, W, v)) return { winner: W, points: 2, reason: 'mana' };
      if (manaHeldBy(s.points, B, v)) return { winner: B, points: 2, reason: 'mana' };
    }
    if (isDeadlock(s.points, v, s.bar)) return { winner: null, points: 0, reason: 'deadlock' };
    return null;
  }

  root.Engine = {
    W: W, B: B,
    VARIANTS: VARIANTS, variantOf: variantOf,
    opp: opp, pipOf: pipOf, inHome: inHome, startPoint: startPoint, entryPoint: entryPoint,
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
