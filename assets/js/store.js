/* =====================================================================
 * Vortex Tawla — persistence
 * ---------------------------------------------------------------------
 * localStorage, defensively. It can be missing, disabled, full, or (on
 * some file:// origins) throw on access, and none of that should stop
 * you playing — every entry point degrades to "no saved state".
 *
 * Note what is NOT stored: state.plans. A turn's plan list can run to
 * thousands of sequences, and it is fully determined by the position and
 * the roll. So we save the board as it stood at the START of the turn
 * plus the roll and the moves played since, and rebuild by replaying.
 * That is both far smaller and self-validating — a replay that does not
 * reproduce a legal turn is simply discarded.
 * ===================================================================== */
(function (root) {
  'use strict';

  var E = root.Engine;
  var KEY = 'vortex-tawla/v1';

  function available() {
    try {
      var k = KEY + '/probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  var ok = available();

  function readAll() {
    if (!ok) return {};
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function writeAll(obj) {
    if (!ok) return false;
    try { localStorage.setItem(KEY, JSON.stringify(obj)); return true; }
    catch (e) { return false; }   // quota, private mode, etc.
  }

  function patch(fields) {
    var all = readAll();
    Object.keys(fields).forEach(function (k) { all[k] = fields[k]; });
    return writeAll(all);
  }

  function get(key, fallback) {
    var all = readAll();
    return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : fallback;
  }

  function clear() {
    if (!ok) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing useful to do */ }
  }

  /* ---------------------------------------------------------------- */
  /* Game serialisation                                                */

  function pointsToSpec(pts) {
    var spec = {};
    for (var i = 1; i <= 24; i++) if (pts[i].length) spec[i] = pts[i].join('');
    return spec;
  }

  /* `turnStart` is the state as it was right after the roll, or null when
     no roll is in progress. */
  function serialiseGame(state, turnStart) {
    var base = turnStart || state;
    return {
      v: 1,
      variant: state.variantId || 'mahbooseh',
      turn: base.turn,
      board: pointsToSpec(base.points),
      off: { W: base.off.W, B: base.off.B },
      bar: { W: base.bar.W, B: base.bar.B },
      roll: turnStart ? state.roll.slice() : null,
      played: turnStart ? state.played.map(function (m) {
        return { from: m.from, to: m.to, die: m.die, off: !!m.off, enter: !!m.enter };
      }) : [],
      opts: { manaEndsGame: !!state.opts.manaEndsGame }
    };
  }

  /* Returns { state, turnStart } or null if the blob is unusable. */
  function deserialiseGame(g) {
    if (!g || g.v !== 1 || !g.board) return null;
    try {
      var o = g.opts || {};
      o.variant = g.variant || 'mahbooseh';
      if (!E.VARIANTS[o.variant]) return null;
      o.bar = g.bar || { W: 0, B: 0 };

      var st = E.fromSpec(g.board, g.turn, o);
      st.off.W = g.off.W; st.off.B = g.off.B;
      st.bar.W = o.bar.W || 0; st.bar.B = o.bar.B || 0;

      /* fromSpec infers off from the checker count; a saved game must
         still add up to 15 a side, bar included, or the blob is wrong. */
      if (E.countOn(st.points, 'W') + st.off.W + st.bar.W !== 15) return null;
      if (E.countOn(st.points, 'B') + st.off.B + st.bar.B !== 15) return null;

      if (!g.roll || !g.roll.length) return { state: st, turnStart: null };

      E.setRoll(st, g.roll[0], g.roll[1]);
      var turnStart = E.clone(st);

      /* Replay the moves, checking each against what the engine actually
         offers. Anything that does not line up means a stale or edited
         blob, so fall back to the start of the turn rather than loading a
         corrupt board. */
      for (var i = 0; i < (g.played || []).length; i++) {
        var want = g.played[i];
        var legal = E.legalNow(st).filter(function (m) {
          return m.from === want.from && m.to === want.to && m.die === want.die;
        })[0];
        if (!legal) return { state: E.clone(turnStart), turnStart: turnStart };
        E.apply(st, legal);
      }
      return { state: st, turnStart: turnStart };
    } catch (e) {
      return null;
    }
  }

  root.Store = {
    available: ok,
    get: get, patch: patch, clear: clear, readAll: readAll,
    serialiseGame: serialiseGame, deserialiseGame: deserialiseGame,
    pointsToSpec: pointsToSpec
  };
})(typeof window !== 'undefined' ? window : globalThis);
