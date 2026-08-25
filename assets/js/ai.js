/* =====================================================================
 * Vortex Tawla — Mahbooseh opponent
 * ---------------------------------------------------------------------
 * One-ply search: the engine already hands us every maximal way to play
 * the roll, so we just score the resulting position and take the best.
 * Mahbooseh rewards very different things from ordinary backgammon —
 * pins are worth more than raw speed, and the mana pin is close to a
 * win outright — so the weights lean heavily that way.
 * ===================================================================== */
(function (root) {
  'use strict';

  var E = root.Engine;

  var WEIGHTS = {
    pip:        1.0,   // per pip of race advantage
    pinHeld:   14,     // each enemy checker we have trapped
    pinDepth:   3.0,   // extra per pip the trapped checker still owes
    pinSuffered: 16,   // each of our own checkers trapped
    pinnedDepth: 3.5,
    mana:      400,    // holding the opponent's mother checker
    manaAgainst: 450,
    blot:       2.2,   // per direct shot at each of our blots
    homePoint:  4,     // made points in our own home board
    anchorPoint: 2,    // made points anywhere
    borneOff:  10,
    stackTax:   0.6,   // discourage burying 6+ checkers on one point

    /* Own starting point. In backgammon an anchor in the opponent's home
       is an asset; in Mahbooseh it is a liability, because you cannot be
       hit there — only pinned — and you must eventually break it. Being
       down to exactly two is standing on the edge of the mana cliff. */
    startTax:    1.5,  // per checker still on our starting point
    startPair:  10,    // extra for being one move from leaving a blot
    manaBlot:  450     // scaled by the chance it actually gets pinned
  };

  /* Score a position from `p`'s point of view. Higher is better. */
  function evaluate(pts, off, p) {
    var o = E.opp(p), s = 0, i;

    s += (E.pipCount(pts, o) - E.pipCount(pts, p)) * WEIGHTS.pip;
    s += (off[p] - off[o]) * WEIGHTS.borneOff;

    var held = E.pinsHeldBy(pts, p);
    for (i = 0; i < held.length; i++) {
      s += WEIGHTS.pinHeld;
      /* A checker trapped far from its own home is a heavier burden. */
      s += E.pipOf(o, held[i]) * WEIGHTS.pinDepth / 6;
    }

    var stuck = E.pinnedCheckers(pts, p);
    for (i = 0; i < stuck.length; i++) {
      s -= WEIGHTS.pinSuffered;
      s -= E.pipOf(p, stuck[i]) * WEIGHTS.pinnedDepth / 6;
    }

    if (E.manaHeldBy(pts, p)) s += WEIGHTS.mana;
    if (E.manaHeldBy(pts, o)) s -= WEIGHTS.manaAgainst;

    /* Exposure: every blot is a pin waiting to happen, and the further
       from home it is caught, the worse the damage. */
    var bl = E.blots(pts, p);
    for (i = 0; i < bl.length; i++) {
      var shots = E.directShots(pts, o, bl[i]);
      if (!shots) continue;
      s -= shots * WEIGHTS.blot * (1 + E.pipOf(p, bl[i]) / 24);
    }

    /* The mother checker. Leaving exactly one exposed on our own starting
       point is not an ordinary blot — the downside is the whole game, so
       it is priced as the chance of being pinned times what the mana is
       worth, not with the generic blot weight. */
    var sp = E.startPoint(p), onStart = 0;
    for (i = 0; i < pts[sp].length; i++) if (pts[sp][i] === p) onStart++;
    if (onStart > 0) {
      s -= onStart * WEIGHTS.startTax;
      var spRun = E.topRun(pts, sp);
      if (onStart === 1 && spRun.color === p && spRun.len === 1) {
        /* Danger is not just "can they hit it this turn". Our starting
           point is the LAST point the opponent travels to, so every
           checker of theirs still short of it is a future shot. Pricing
           only the immediate shots would happily strand the mother
           checker early, while the opponent is still out of range. */
        var behind = 0;
        for (i = 1; i <= 24; i++) {
          if (E.pipOf(o, i) <= E.pipOf(o, sp)) continue;
          for (var j = 0; j < pts[i].length; j++) if (pts[i][j] === o) behind++;
        }
        if (behind > 0) {
          var k = E.directShots(pts, o, sp);
          var risk = k > 0 ? (1 - Math.pow((6 - k) / 6, 2)) : 0.35;
          s -= risk * WEIGHTS.manaBlot;
        }
      } else if (onStart === 2) {
        s -= WEIGHTS.startPair;
      }
    }

    for (i = 1; i <= 24; i++) {
      var run = E.topRun(pts, i);
      if (run.color !== p || run.len < 2) continue;
      s += WEIGHTS.anchorPoint;
      if (E.inHome(p, i)) s += WEIGHTS.homePoint;
      if (run.len > 5) s -= (run.len - 5) * WEIGHTS.stackTax;
    }

    return s;
  }

  function scorePlan(state, plan) {
    var pts = E.clonePoints(state.points);
    var off = { W: state.off.W, B: state.off.B };
    for (var i = 0; i < plan.length; i++) E.applyOn(pts, off, state.turn, plan[i]);
    return evaluate(pts, off, state.turn);
  }

  /* The moves still to come this turn.
   *
   * state.plans holds WHOLE-turn sequences fixed at roll time, so once
   * the player has played part of the turn those plans no longer line up
   * with the board. Scoring them against the current position would
   * re-apply moves already made; returning plan[0] would re-suggest a
   * move already played. Both are fixed by trimming each still-viable
   * plan by what has been played. When nothing has been played yet this
   * is exactly state.plans, so the AI's own turn is unaffected. */
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

  /* Used by the Play view's hint button — the engine's own best line for
     the human, plus a short reason drawn from what changed. */
  function hint(state) {
    var plan = choosePlan(state, 'hard');
    if (!plan || !plan.length) return null;

    var before = state.points;
    var pts = E.clonePoints(before), off = { W: state.off.W, B: state.off.B };
    var pinned = [], i;
    for (i = 0; i < plan.length; i++) {
      var r = E.applyOn(pts, off, state.turn, plan[i]);
      if (r.pinned) pinned.push(plan[i].to);
    }

    var why = [];
    if (E.manaHeldBy(pts, state.turn) && !E.manaHeldBy(before, state.turn))
      why.push('this takes the mana — the opponent can never bear off while you hold it');
    if (pinned.length)
      why.push('it pins ' + (pinned.length > 1 ? pinned.length + ' checkers' : 'a checker') +
               ' on point ' + pinned.join(' and '));
    var blotsAfter = E.blots(pts, state.turn).filter(function (q) { return E.directShots(pts, E.opp(state.turn), q) > 0; });
    var blotsBefore = E.blots(before, state.turn).filter(function (q) { return E.directShots(before, E.opp(state.turn), q) > 0; });
    if (blotsAfter.length < blotsBefore.length) why.push('it tucks a loose checker out of range');
    else if (blotsAfter.length === 0) why.push('it leaves nothing exposed');
    if (!why.length) why.push('it makes the most ground safely');

    /* plan[0] is the next move to make; the rest is the line it belongs
       to, which is worth showing because the payoff is often on move 2. */
    var label = function (m) { return m.from + '→' + (m.off ? 'off' : m.to); };
    return {
      plan: plan,
      next: plan[0],
      line: plan.map(label).join(', then '),
      why: why.join(', and ')
    };
  }

  root.AI = {
    evaluate: evaluate, scorePlan: scorePlan, remainingPlans: remainingPlans,
    choosePlan: choosePlan, hint: hint, WEIGHTS: WEIGHTS
  };
})(typeof window !== 'undefined' ? window : globalThis);
