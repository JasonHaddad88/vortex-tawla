/* =====================================================================
 * Vortex Tawla — game review
 * ---------------------------------------------------------------------
 * Records one entry per turn so a finished game can be walked through
 * afterwards. Each entry keeps the position as it stood when the dice
 * were thrown, which is what makes the review a review rather than a
 * list: the board can be redrawn for any turn without replaying from the
 * start.
 *
 * Positions are stored in the compact bottom-first spec form, so a whole
 * game is a few kilobytes and survives in localStorage alongside
 * everything else.
 * ===================================================================== */
(function (root) {
  'use strict';

  var E = root.Engine;

  function pointsToSpec(pts) {
    var spec = {};
    for (var i = 1; i <= 24; i++) if (pts[i].length) spec[i] = pts[i].join('');
    return spec;
  }

  function moveData(m) {
    return { from: m.from, to: m.to, die: m.die, off: !!m.off, enter: !!m.enter };
  }

  function label(m) {
    return (m.enter ? 'bar' : m.from) + '→' + (m.off ? 'off' : m.to);
  }

  /* `turnStart` is the state right after the roll; `played` is what was
     actually done; `review` is Coach.reviewTurn's result, or null for the
     opponent's turns (which are recorded but not graded). */
  function record(turnStart, played, review) {
    if (!turnStart || !played || !played.length) return null;
    return {
      who: turnStart.turn,
      variant: turnStart.variantId,
      roll: turnStart.roll.slice(),
      spec: pointsToSpec(turnStart.points),
      bar: { W: turnStart.bar.W, B: turnStart.bar.B },
      off: { W: turnStart.off.W, B: turnStart.off.B },
      played: played.map(moveData),
      playedLine: played.map(label).join(', '),
      bestLine: review ? review.bestLine : null,
      /* Carried rather than re-derived by comparing strings: two
         orderings of the same moves are the same play, and only the
         coach knows that. */
      same: review ? !!review.same : null,
      why: review ? review.why : null,
      loss: review ? review.loss : null,
      grade: review ? review.grade.key : null,
      gradeLabel: review ? review.grade.label : null,
      tone: review ? review.grade.tone : null
    };
  }

  var ORDER = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'];

  function summarise(history, who) {
    var counts = { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    var total = 0, reviewed = 0, worst = null, turns = 0;

    (history || []).forEach(function (h) {
      if (who && h.who !== who) return;
      turns++;
      if (h.grade == null) return;
      reviewed++;
      if (counts[h.grade] !== undefined) counts[h.grade]++;
      total += h.loss || 0;
      if (!worst || (h.loss || 0) > (worst.loss || 0)) worst = h;
    });

    /* Only count the ones that actually cost something as errors. */
    var errors = counts.inaccuracy + counts.mistake + counts.blunder;
    return {
      turns: turns,
      reviewed: reviewed,
      counts: counts,
      errors: errors,
      totalCost: total,
      avgCost: reviewed ? total / reviewed : 0,
      accuracy: reviewed ? (reviewed - errors) / reviewed : 1,
      worst: worst && worst.loss > 0 ? worst : null
    };
  }

  /* Rebuild the state for one recorded turn so the board can be drawn. */
  function stateFor(entry) {
    if (!entry) return null;
    var st = E.fromSpec(entry.spec, entry.who, {
      variant: entry.variant,
      bar: entry.bar
    });
    st.off.W = entry.off.W;
    st.off.B = entry.off.B;
    return st;
  }

  /* The moves of one entry, as engine-shaped objects the board can
     highlight. */
  function movesOf(entry) {
    return (entry && entry.played) || [];
  }

  root.Review = {
    record: record, summarise: summarise, stateFor: stateFor, movesOf: movesOf,
    pointsToSpec: pointsToSpec, label: label, ORDER: ORDER
  };
})(typeof window !== 'undefined' ? window : globalThis);
