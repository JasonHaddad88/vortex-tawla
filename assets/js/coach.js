/* =====================================================================
 * Vortex Tawla — the coach
 * ---------------------------------------------------------------------
 *   reviewTurn()  after a turn is finished, compare what was played
 *                 against the best line available when the dice were
 *                 thrown, and say what the difference cost.
 *
 *   moveRisk()    before a move is committed, flag destinations that
 *                 leave something expensive hanging — above all the mana
 *                 in Mahbooseh, the one mistake that loses outright.
 *
 * Both reuse AI.evaluate, so the coach and the opponent always agree
 * about what a good position looks like.
 * ===================================================================== */
(function (root) {
  'use strict';

  var E = root.Engine, AI = root.AI;

  /* Thresholds in AI.evaluate units: one pip of race is 1.0, an extra
     pin is ~14, the mana is 400. So "blunder" is roughly "you gave up a
     pin, or thirty pips of race". */
  var GRADES = [
    { max: 0.5,      key: 'best',       label: 'Best play',  tone: 'ok'   },
    { max: 3,        key: 'good',       label: 'Good',       tone: 'ok'   },
    { max: 10,       key: 'inaccuracy', label: 'Inaccuracy', tone: 'warn' },
    { max: 30,       key: 'mistake',    label: 'Mistake',    tone: 'warn' },
    { max: Infinity, key: 'blunder',    label: 'Blunder',    tone: 'bad'  }
  ];

  /* Worth interrupting the player about. Below this the difference is
     noise and saying "better was..." would just be nagging. */
  function isMistake(g) {
    return !!g && (g.key === 'inaccuracy' || g.key === 'mistake' || g.key === 'blunder');
  }

  function gradeFor(loss) {
    for (var i = 0; i < GRADES.length; i++) if (loss < GRADES[i].max) return GRADES[i];
    return GRADES[GRADES.length - 1];
  }

  function label(m) {
    return (m.enter ? 'bar' : m.from) + '→' + (m.off ? 'off' : m.to);
  }
  function line(seq) { return seq.map(label).join(', '); }

  function applySeq(start, seq) {
    var v = E.variantOf(start);
    var pts = E.clonePoints(start.points);
    var off = { W: start.off.W, B: start.off.B };
    var bar = { W: start.bar.W, B: start.bar.B };
    seq.forEach(function (m) { E.applyOn(pts, off, start.turn, m, v, bar); });
    return { pts: pts, off: off, bar: bar, v: v };
  }

  /* Blots the opponent can reach with a single die. */
  function exposed(pts, p, v) {
    return E.blots(pts, p).filter(function (q) { return E.directShots(pts, E.opp(p), q, v) > 0; });
  }

  /* ---------------------------------------------------------------- */

  function explain(start, best, played) {
    var p = start.turn, o = E.opp(p);
    var A = applySeq(start, best), Bd = applySeq(start, played);
    var v = A.v, why = [], n;

    if (v.pins) {
      if (E.manaHeldBy(A.pts, p, v) && !E.manaHeldBy(Bd.pts, p, v))
        why.push('it takes the mana on point ' + E.startPoint(o, v));

      var sp = E.startPoint(p, v);
      if (exposed(Bd.pts, p, v).indexOf(sp) >= 0 && exposed(A.pts, p, v).indexOf(sp) < 0)
        why.push('your line leaves the mother checker alone on point ' + sp);

      n = E.pinsHeldBy(A.pts, p).length - E.pinsHeldBy(Bd.pts, p).length;
      if (n > 0) why.push('it pins ' + n + ' more checker' + (n > 1 ? 's' : ''));

      n = E.pinnedCheckers(Bd.pts, p).length - E.pinnedCheckers(A.pts, p).length;
      if (n > 0) why.push('it keeps ' + n + ' of yours out of prison');
    }

    if (v.hasBar) {
      n = A.bar[o] - Bd.bar[o];
      if (n > 0) why.push('it puts ' + n + ' more of theirs on the bar');
      n = Bd.bar[p] - A.bar[p];
      if (n > 0) why.push('it keeps ' + n + ' of yours off the bar');
    }

    var expA = exposed(A.pts, p, v), expB = exposed(Bd.pts, p, v);
    n = expB.length - expA.length;
    if (n > 0) why.push('it leaves ' + n + ' fewer checker' + (n > 1 ? 's' : '') + ' exposed');

    if (!why.length) {
      n = E.pipCount(Bd.pts, p, v, Bd.bar) - E.pipCount(A.pts, p, v, A.bar);
      if (n > 0) why.push('it gains ' + n + ' more pip' + (n > 1 ? 's' : ''));
      else why.push('it leaves a stronger position');
    }
    return why.join(', and ');
  }

  function sameLine(a, b) {
    if (a.length !== b.length) return false;
    return a.map(label).sort().join() === b.map(label).sort().join();
  }

  /* Score the played line and the plausible alternatives at the SAME
     depth, so the comparison is like for like. Returns null if the
     deeper search could not finish in the time allowed, and the caller
     falls back to the static verdict rather than mixing the two. */
  function deepRank(start, played, width, budgetMs) {
    var ranked = start.plans
      .map(function (pl) { return { pl: pl, s: AI.scorePlan(start, pl) }; })
      .sort(function (a, b) { return b.s - a.s; });

    var top = ranked.slice(0, width).map(function (r) { return r.pl; });
    /* The player's own line has to be in the comparison even when the
       static ranking would not have shortlisted it. */
    if (!top.some(function (pl) { return sameLine(pl, played); })) top.push(played);

    var deadline = Date.now() + budgetMs;
    var best = null, bestScore = -Infinity, playedScore = null;
    for (var i = 0; i < top.length; i++) {
      var ev = AI.expectedScore(start, top[i], deadline);
      if (ev === null) return null;                 // ran out of time
      if (sameLine(top[i], played)) playedScore = ev;
      if (ev > bestScore) { bestScore = ev; best = top[i]; }
    }
    if (playedScore === null) return null;
    return { best: best, bestScore: bestScore, playedScore: playedScore };
  }

  /* `start` is the state as it stood immediately after the roll, with its
     plans intact; `played` is what the player actually did.
     opts.depth === 2 looks a move ahead, which is slower but much less
     dependent on the hand-tuned weights being exactly right. */
  function reviewTurn(start, played, opts) {
    if (!start || !start.plans.length || !played.length) return null;

    var best = null, bestScore = -Infinity, playedScore = null, depth = 1;

    if (opts && opts.depth === 2 && start.plans.length > 1) {
      var deep = deepRank(start, played, opts.width || 6, opts.budgetMs || 800);
      if (deep) {
        best = deep.best; bestScore = deep.bestScore; playedScore = deep.playedScore;
        depth = 2;
      }
    }

    if (!best) {
      start.plans.forEach(function (pl) {
        var sc = AI.scorePlan(start, pl);
        if (sc > bestScore) { bestScore = sc; best = pl; }
      });
      playedScore = AI.scorePlan(start, played);
      depth = 1;
    }
    if (!best) return null;

    var loss = Math.max(0, bestScore - playedScore);
    /* Different orderings of the same moves are the same play. */
    var same = loss < 0.5 ||
      played.map(label).sort().join() === best.map(label).sort().join();

    return {
      loss: loss,
      depth: depth,
      grade: same ? GRADES[0] : gradeFor(loss),
      same: same,
      best: best,
      bestLine: line(best),
      playedLine: line(played),
      why: same ? null : explain(start, best, played),
      alternatives: start.plans.length
    };
  }

  /* ---------------------------------------------------------------- */

  /* What a candidate move would expose; null when it is safe. Level
     'mana' is the game-losing one and is always worth showing; 'blot' is
     ordinary exposure and is advisory. */
  function moveRisk(state, mv) {
    var v = E.variantOf(state);
    var p = state.turn, o = E.opp(p);
    var pts = E.clonePoints(state.points);
    var off = { W: state.off.W, B: state.off.B };
    var bar = { W: state.bar.W, B: state.bar.B };
    E.applyOn(pts, off, p, mv, v, bar);

    if (v.pins) {
      var sp = E.startPoint(p, v);
      if (mv.from === sp) {
        var run = E.topRun(pts, sp);
        var mine = pts[sp].filter(function (c) { return c === p; }).length;
        if (mine === 1 && run.color === p && run.len === 1) {
          var shots = E.directShots(pts, o, sp, v);
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
    }

    var before = exposed(state.points, p, v), after = exposed(pts, p, v);
    var fresh = after.filter(function (q) { return before.indexOf(q) < 0; });
    if (fresh.length) {
      var worst = fresh.reduce(function (a, b) {
        return E.directShots(pts, o, b, v) > E.directShots(pts, o, a, v) ? b : a;
      });
      var n = E.directShots(pts, o, worst, v);
      return {
        level: 'blot',
        shots: n,
        text: 'Leaves a blot on point ' + worst + ', exposed to ' + n + ' number' +
              (n > 1 ? 's' : '') + '.' +
              (v.hits ? ' If it is hit it goes back to the bar and starts again.' : '')
      };
    }
    return null;
  }

  root.Coach = {
    reviewTurn: reviewTurn, moveRisk: moveRisk, isMistake: isMistake,
    exposed: exposed, GRADES: GRADES, gradeFor: gradeFor, line: line, label: label
  };
})(typeof window !== 'undefined' ? window : globalThis);
