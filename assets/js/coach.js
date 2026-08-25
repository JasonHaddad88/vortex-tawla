/* =====================================================================
 * Vortex Tawla — the coach
 * ---------------------------------------------------------------------
 * Two jobs:
 *
 *   reviewTurn()  after a turn is finished, compare what was actually
 *                 played against the best line that was available when
 *                 the dice were thrown, and say what the difference cost.
 *
 *   moveRisk()    before a move is committed, flag the destinations that
 *                 would leave something expensive hanging — above all the
 *                 mana, which is the single most costly mistake in the
 *                 game.
 *
 * Both reuse AI.evaluate, so the coach and the opponent always agree
 * about what a good position looks like.
 * ===================================================================== */
(function (root) {
  'use strict';

  var E = root.Engine, AI = root.AI;

  /* Thresholds are in AI.evaluate units: one pip of race is 1.0, holding
     an extra pin is ~14, and the mana is 400. So "blunder" is roughly
     "you gave up a pin or thirty pips of race". */
  var GRADES = [
    { max: 0.5,      key: 'best',       label: 'Best play',  tone: 'ok'      },
    { max: 3,        key: 'good',       label: 'Good',       tone: 'ok'      },
    { max: 10,       key: 'inaccuracy', label: 'Inaccuracy', tone: 'warn'    },
    { max: 30,       key: 'mistake',    label: 'Mistake',    tone: 'warn'    },
    { max: Infinity, key: 'blunder',    label: 'Blunder',    tone: 'bad'     }
  ];

  /* Worth interrupting the player about. Below this the difference is
     noise and saying "better was..." would just be nagging. */
  function isMistake(g) {
    return g && (g.key === 'inaccuracy' || g.key === 'mistake' || g.key === 'blunder');
  }

  function gradeFor(loss) {
    for (var i = 0; i < GRADES.length; i++) if (loss < GRADES[i].max) return GRADES[i];
    return GRADES[GRADES.length - 1];
  }

  function label(m) { return m.from + '→' + (m.off ? 'off' : m.to); }
  function line(seq) { return seq.map(label).join(', '); }

  function applySeq(start, seq) {
    var pts = E.clonePoints(start.points);
    var off = { W: start.off.W, B: start.off.B };
    seq.forEach(function (m) { E.applyOn(pts, off, start.turn, m); });
    return { pts: pts, off: off };
  }

  /* Blots the opponent can actually reach with a single die. */
  function exposed(pts, p) {
    return E.blots(pts, p).filter(function (q) { return E.directShots(pts, E.opp(p), q) > 0; });
  }

  /* ---------------------------------------------------------------- */

  function explain(start, best, played) {
    var p = start.turn, o = E.opp(p);
    var A = applySeq(start, best), Bd = applySeq(start, played);
    var why = [], n;

    if (E.manaHeldBy(A.pts, p) && !E.manaHeldBy(Bd.pts, p))
      why.push('it takes the mana on point ' + E.startPoint(o));

    var sp = E.startPoint(p);
    var expA = exposed(A.pts, p), expB = exposed(Bd.pts, p);
    if (expB.indexOf(sp) >= 0 && expA.indexOf(sp) < 0)
      why.push('your line leaves the mother checker alone on point ' + sp);

    n = E.pinsHeldBy(A.pts, p).length - E.pinsHeldBy(Bd.pts, p).length;
    if (n > 0) why.push('it pins ' + n + ' more checker' + (n > 1 ? 's' : ''));

    n = E.pinnedCheckers(Bd.pts, p).length - E.pinnedCheckers(A.pts, p).length;
    if (n > 0) why.push('it keeps ' + n + ' of yours out of prison');

    n = expB.length - expA.length;
    if (n > 0) why.push('it leaves ' + n + ' fewer checker' + (n > 1 ? 's' : '') + ' exposed');

    if (!why.length) {
      n = E.pipCount(Bd.pts, p) - E.pipCount(A.pts, p);
      if (n > 0) why.push('it gains ' + n + ' more pip' + (n > 1 ? 's' : ''));
      else why.push('it leaves a stronger position');
    }
    return why.join(', and ');
  }

  /* `start` is the state as it was immediately after the roll (with its
     plans intact); `played` is the sequence the player actually made. */
  function reviewTurn(start, played) {
    if (!start || !start.plans.length || !played.length) return null;

    var best = null, bestScore = -Infinity;
    start.plans.forEach(function (pl) {
      var sc = AI.scorePlan(start, pl);
      if (sc > bestScore) { bestScore = sc; best = pl; }
    });
    if (!best) return null;

    var playedScore = AI.scorePlan(start, played);
    var loss = Math.max(0, bestScore - playedScore);
    var g = gradeFor(loss);
    var playedLine = line(played), bestLine = line(best);
    /* Different orderings of the same moves are the same play. */
    var same = loss < 0.5 ||
      played.map(label).sort().join() === best.map(label).sort().join();

    return {
      loss: loss,
      grade: same ? GRADES[0] : g,
      same: same,
      best: best,
      bestLine: bestLine,
      playedLine: playedLine,
      why: same ? null : explain(start, best, played),
      alternatives: start.plans.length
    };
  }

  /* ---------------------------------------------------------------- */

  /* What a candidate move would expose. Returns null when it is safe.
     level 'mana' is the game-losing one and is always worth showing;
     'blot' is ordinary exposure and is advisory. */
  function moveRisk(state, mv) {
    var p = state.turn, o = E.opp(p), sp = E.startPoint(p);
    var pts = E.clonePoints(state.points), off = { W: state.off.W, B: state.off.B };
    E.applyOn(pts, off, p, mv);

    if (mv.from === sp) {
      var run = E.topRun(pts, sp);
      var mine = pts[sp].filter(function (c) { return c === p; }).length;
      if (mine === 1 && run.color === p && run.len === 1) {
        var shots = E.directShots(pts, o, sp);
        if (shots > 0) {
          return {
            level: 'mana',
            shots: shots,
            text: 'This leaves your last checker alone on point ' + sp + ' — your own starting ' +
                  'point. ' + shots + ' number' + (shots > 1 ? 's' : '') + ' pin it for the mana, ' +
                  'and you would never bear off. Move both checkers out, or neither.'
          };
        }
      }
    }

    var before = exposed(state.points, p), after = exposed(pts, p);
    var fresh = after.filter(function (q) { return before.indexOf(q) < 0; });
    if (fresh.length) {
      var worst = fresh.reduce(function (a, b) {
        return E.directShots(pts, o, b) > E.directShots(pts, o, a) ? b : a;
      });
      return {
        level: 'blot',
        shots: E.directShots(pts, o, worst),
        text: 'Leaves a blot on point ' + worst + ', exposed to ' +
              E.directShots(pts, o, worst) + ' number' +
              (E.directShots(pts, o, worst) > 1 ? 's' : '') + '.'
      };
    }
    return null;
  }

  root.Coach = {
    reviewTurn: reviewTurn, moveRisk: moveRisk, isMistake: isMistake,
    exposed: exposed, GRADES: GRADES, gradeFor: gradeFor, line: line
  };
})(typeof window !== 'undefined' ? window : globalThis);
