/* =====================================================================
 * Vortex Tawla — opponent and position evaluator
 * ---------------------------------------------------------------------
 * One-ply search: the engine already hands us every maximal way to play
 * the roll, so we score the resulting position and take the best.
 *
 * The weights are variant-aware, because the two games reward opposite
 * things in one important place. In Fransawiyyeh an anchor in the
 * opponent's home board is an asset — it is somewhere safe to land and a
 * base to hit from. In Mahbooseh it is a liability: you cannot be hit
 * there, only pinned, and you must eventually break the point, which is
 * how you lose your mother checker. Same square, opposite sign.
 * ===================================================================== */
(function (root) {
  'use strict';

  var E = root.Engine;

  var WEIGHTS = {
    pip:         1.0,   // per pip of race advantage
    borneOff:   10,
    anchorPoint: 2,     // any made point
    homePoint:   4,     // extra for one in our own home board
    stackTax:    0.6,   // discourage burying 6+ checkers on one point

    /* Mahbooseh: trapping */
    pinHeld:    14,
    pinDepth:    3.0,
    pinSuffered: 16,
    pinnedDepth: 3.5,
    mana:      400,
    manaAgainst: 450,
    blot:        2.2,

    /* Mahbooseh: our own starting point is a liability, and being down
       to exactly two checkers there is the edge of the mana cliff. */
    startTax:    1.5,
    startPair:  10,
    manaBlot:  450,

    /* Fransawiyyeh: hitting */
    hitCost:     0.9,   // per pip the blot would lose, times hit chance
    onBar:      12,     // positional, on top of the 25 pips already owed
    barVsBoard:  4      // each home point made while they sit on the bar
  };

  /* Chance at least one of `k` distinct faces shows on two dice. */
  function chanceOf(k) { return k > 0 ? 1 - Math.pow((6 - k) / 6, 2) : 0; }

  /* Score a position from `p`'s point of view. Higher is better. */
  function evaluate(pts, off, p, v, bar) {
    v = v || E.VARIANTS.mahbooseh;
    bar = bar || { W: 0, B: 0 };
    var o = E.opp(p), s = 0, i;

    s += (E.pipCount(pts, o, v, bar) - E.pipCount(pts, p, v, bar)) * WEIGHTS.pip;
    s += (off[p] - off[o]) * WEIGHTS.borneOff;

    if (v.pins) {
      var held = E.pinsHeldBy(pts, p);
      for (i = 0; i < held.length; i++) {
        s += WEIGHTS.pinHeld;
        /* A checker trapped far from its own home is a heavier burden. */
        s += E.pipOf(o, held[i], v) * WEIGHTS.pinDepth / 6;
      }

      var stuck = E.pinnedCheckers(pts, p);
      for (i = 0; i < stuck.length; i++) {
        s -= WEIGHTS.pinSuffered;
        s -= E.pipOf(p, stuck[i], v) * WEIGHTS.pinnedDepth / 6;
      }

      if (E.manaHeldBy(pts, p, v)) s += WEIGHTS.mana;
      if (E.manaHeldBy(pts, o, v)) s -= WEIGHTS.manaAgainst;

      /* Our own starting point: see the note at the top of the file. */
      var sp = E.startPoint(p, v), onStart = 0;
      for (i = 0; i < pts[sp].length; i++) if (pts[sp][i] === p) onStart++;
      if (onStart > 0) {
        s -= onStart * WEIGHTS.startTax;
        var spRun = E.topRun(pts, sp);
        if (onStart === 1 && spRun.color === p && spRun.len === 1) {
          /* Danger is not just "can they hit it this turn". Our starting
             point is the LAST point the opponent travels to, so every
             checker of theirs still short of it is a future shot.
             Pricing only immediate shots strands the mother checker
             early, while the opponent is still out of range. */
          var behind = 0;
          for (i = 1; i <= 24; i++) {
            if (E.pipOf(o, i, v) <= E.pipOf(o, sp, v)) continue;
            for (var j = 0; j < pts[i].length; j++) if (pts[i][j] === o) behind++;
          }
          if (behind > 0) {
            var k = E.directShots(pts, o, sp, v);
            s -= (k > 0 ? chanceOf(k) : 0.35) * WEIGHTS.manaBlot;
          }
        } else if (onStart === 2) {
          s -= WEIGHTS.startPair;
        }
      }
    }

    if (v.hasBar) {
      s -= bar[p] * WEIGHTS.onBar;
      s += bar[o] * WEIGHTS.onBar;
      /* Points made in our home board are worth much more while the
         opponent has to re-enter through them. */
      if (bar[o] > 0) {
        for (i = 1; i <= 24; i++) {
          var r2 = E.topRun(pts, i);
          if (r2.color === p && r2.len >= 2 && E.inHome(p, i, v)) s += WEIGHTS.barVsBoard;
        }
      }
    }

    /* Exposure. Being hit costs the blot everything it has travelled;
       being pinned costs it its freedom, which is worse the further from
       home it happens. */
    var bl = E.blots(pts, p);
    for (i = 0; i < bl.length; i++) {
      var shots = E.directShots(pts, o, bl[i], v);
      if (!shots) continue;
      if (v.hits) s -= chanceOf(shots) * (25 - E.pipOf(p, bl[i], v)) * WEIGHTS.hitCost;
      else s -= shots * WEIGHTS.blot * (1 + E.pipOf(p, bl[i], v) / 24);
    }

    for (i = 1; i <= 24; i++) {
      var run = E.topRun(pts, i);
      if (run.color !== p || run.len < 2) continue;
      s += WEIGHTS.anchorPoint;
      if (E.inHome(p, i, v)) s += WEIGHTS.homePoint;
      if (run.len > 5) s -= (run.len - 5) * WEIGHTS.stackTax;
    }

    return s;
  }

  function scorePlan(state, plan) {
    var v = E.variantOf(state);
    var pts = E.clonePoints(state.points);
    var off = { W: state.off.W, B: state.off.B };
    var bar = { W: state.bar.W, B: state.bar.B };
    for (var i = 0; i < plan.length; i++) E.applyOn(pts, off, state.turn, plan[i], v, bar);
    return evaluate(pts, off, state.turn, v, bar);
  }

  /* The moves still to come this turn.
   *
   * state.plans holds WHOLE-turn sequences fixed at roll time, so once
   * part of the turn has been played those plans no longer line up with
   * the board. Scoring them against the current position would re-apply
   * moves already made; returning plan[0] would re-suggest a move already
   * played. Both are fixed by trimming each still-viable plan by what has
   * been played. With nothing played yet this is exactly state.plans, so
   * the opponent's own turn is unaffected. */
  function remainingPlans(state) {
    var n = state.played.length, seen = {}, out = [];
    E.matchingPlans(state).forEach(function (pl) {
      var rest = pl.slice(n);
      if (!rest.length) return;
      var k = rest.map(function (m) { return m.from + '>' + m.to + ':' + m.die; }).join('|');
      if (!seen[k]) { seen[k] = 1; out.push(rest); }
    });
    return out;
  }

  /* level: 'easy' | 'normal' | 'hard' */
  function choosePlan(state, level) {
    var plans = remainingPlans(state);
    if (!plans.length) return [];
    if (level === 'easy') return plans[Math.floor(Math.random() * plans.length)];

    var noise = level === 'hard' ? 0 : 9;
    var best = null, bestScore = -Infinity;
    for (var i = 0; i < plans.length; i++) {
      var sc = scorePlan(state, plans[i]) + (noise ? (Math.random() - 0.5) * noise : 0);
      if (sc > bestScore) { bestScore = sc; best = plans[i]; }
    }
    return best;
  }

  function hint(state) {
    var plan = choosePlan(state, 'hard');
    if (!plan || !plan.length) return null;

    var v = E.variantOf(state);
    var before = state.points;
    var pts = E.clonePoints(before);
    var off = { W: state.off.W, B: state.off.B };
    var bar = { W: state.bar.W, B: state.bar.B };
    var caught = [], i;
    for (i = 0; i < plan.length; i++) {
      var r = E.applyOn(pts, off, state.turn, plan[i], v, bar);
      if (r.pinned || r.hit) caught.push(plan[i].to);
    }

    var why = [];
    if (v.pins && E.manaHeldBy(pts, state.turn, v) && !E.manaHeldBy(before, state.turn, v))
      why.push('this takes the mana — the opponent can never bear off while you hold it');
    if (caught.length)
      why.push('it ' + (v.hits ? 'hits ' : 'pins ') +
               (caught.length > 1 ? caught.length + ' checkers' : 'a checker') +
               ' on point ' + caught.join(' and '));

    var o = E.opp(state.turn);
    var after = E.blots(pts, state.turn).filter(function (q) { return E.directShots(pts, o, q, v) > 0; });
    var was = E.blots(before, state.turn).filter(function (q) { return E.directShots(before, o, q, v) > 0; });
    if (after.length < was.length) why.push('it tucks a loose checker out of range');
    else if (after.length === 0) why.push('it leaves nothing exposed');
    if (!why.length) why.push('it makes the most ground safely');

    var label = function (m) {
      return (m.enter ? 'bar' : m.from) + '→' + (m.off ? 'off' : m.to);
    };
    return {
      plan: plan,
      next: plan[0],
      line: plan.map(label).join(', then '),
      why: why.join(', and ')
    };
  }

  root.AI = {
    evaluate: evaluate, scorePlan: scorePlan, remainingPlans: remainingPlans,
    choosePlan: choosePlan, hint: hint, chanceOf: chanceOf, WEIGHTS: WEIGHTS
  };
})(typeof window !== 'undefined' ? window : globalThis);
