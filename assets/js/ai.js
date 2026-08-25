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
    stackTax:   0.6    // discourage burying 6+ checkers on one point
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
