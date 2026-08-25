/* =====================================================================
 * Vortex Tawla — board renderer
 * ---------------------------------------------------------------------
 * Plain DOM, no canvas: the board is a 14-column CSS grid and every
 * checker is an absolutely positioned circle. Rebuilding the whole board
 * on each change is well under a millisecond at this size and keeps the
 * render a pure function of the state.
 *
 * Screen layout (absolute White numbering, as in engine.js):
 *
 *   top     13 14 15 16 17 18 | 19 20 21 22 23 24   Black bears off ->
 *   bottom  12 11 10  9  8  7 |  6  5  4  3  2  1   White bears off ->
 * ===================================================================== */
(function (root) {
  'use strict';

  var E = root.Engine;

  var TOP = [13, 14, 15, 16, 17, 18, 'bar', 19, 20, 21, 22, 23, 24];
  var BOT = [12, 11, 10, 9, 8, 7, 'bar', 6, 5, 4, 3, 2, 1];

  var PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* A single die face as a 3x3 grid of pips. */
  function die(value, spent, rolling) {
    var d = el('div', 'die' + (spent ? ' spent' : '') + (rolling ? ' rolling' : ''));
    var on = PIPS[value] || [];
    for (var i = 0; i < 9; i++) {
      var pip = el('i', on.indexOf(i) >= 0 ? 'on' : '', d);
      pip.setAttribute('aria-hidden', 'true');
    }
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', 'die showing ' + value + (spent ? ', already played' : ''));
    return d;
  }

  /* ---------------------------------------------------------------- */

  function pointClasses(n, isTop) {
    var c = ['pt', isTop ? 'top' : 'bot'];
    if (n % 2 === 0) c.push('alt');
    if (E.inHome('W', n)) c.push('home-w');
    if (E.inHome('B', n)) c.push('home-b');
    return c.join(' ');
  }

  /* opts:
   *   interactive   – attach click handlers
   *   selected      – point number currently picked up
   *   targets       – [{to, pin}] legal destinations for the selection
   *   offTarget     – true if bearing off is a legal destination
   *   sources       – points the player may move from
   *   hint          – {from, to} to glow
   *   numbers       – draw point numbers (default true)
   *   onPoint(n)    – click callback, n is 1..24 or 'off'
   */
  function render(host, state, opts) {
    opts = opts || {};
    var numbers = opts.numbers !== false;
    var targets = {}, i;
    (opts.targets || []).forEach(function (t) { targets[t.to] = t; });
    var sources = {};
    (opts.sources || []).forEach(function (s) { sources[s] = true; });

    host.innerHTML = '';
    var board = el('div', 'board', host);
    board.setAttribute('role', 'group');
    board.setAttribute('aria-label', 'Mahbooseh board');

    var cells = [];

    function addRow(list, isTop) {
      for (var c = 0; c < list.length; c++) {
        var n = list[c];
        if (n === 'bar') {
          if (isTop) el('div', 'bar', board);   // spans both rows
          continue;
        }
        var pt = el('div', pointClasses(n, isTop), board);
        pt.style.gridColumn = String(c + 1);
        pt.style.gridRow = isTop ? '1' : '2';
        el('div', 'tri', pt);
        if (numbers) el('div', 'num', pt).textContent = n;

        if (opts.selected === n) pt.classList.add('selected');
        /* `movable` is the hint tint; it can be switched off without
           losing the ability to pick the checker up. */
        if (sources[n] && opts.showSources !== false) pt.classList.add('movable');
        if (targets[n]) pt.classList.add(targets[n].pin ? 'target-pin' : 'target');
        if (opts.hint && opts.hint.from === n) pt.classList.add('hintsrc');
        if (opts.hint && opts.hint.to === n) pt.classList.add('hintdst');

        if (opts.interactive && (sources[n] || targets[n] || opts.selected === n)) {
          pt.classList.add('clickable');
          pt.tabIndex = 0;
          pt.setAttribute('role', 'button');
          (function (num) {
            pt.addEventListener('click', function () { opts.onPoint && opts.onPoint(num); });
            pt.addEventListener('keydown', function (ev) {
              if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); opts.onPoint && opts.onPoint(num); }
            });
          })(n);
        }
        cells.push({ n: n, node: pt, isTop: isTop });
      }
    }

    addRow(TOP, true);
    addRow(BOT, false);

    /* bear-off trays: Black's at the top, White's at the bottom, both on
       the right where each player's home board ends. */
    ['b', 'w'].forEach(function (side) {
      var tray = el('div', 'tray ' + side, board);
      var colour = side === 'w' ? 'W' : 'B';
      var n = state.off[colour];
      el('div', 'tray-label', tray).textContent = (side === 'w' ? 'YOU' : 'OPP') + ' ' + n;
      for (var k = 0; k < n; k++) el('div', 'slab ' + side, tray);
      if (opts.offTarget && ((side === 'w' && state.turn === 'W') || (side === 'b' && state.turn === 'B'))) {
        tray.classList.add('target');
        tray.addEventListener('click', function () { opts.onPoint && opts.onPoint('off'); });
      }
      tray.title = (side === 'w' ? 'Your' : "Opponent's") + ' borne-off checkers: ' + n;
    });

    /* Second pass: now that the grid has been laid out we know the real
       point geometry, so checkers can be sized and stacked to fit. */
    for (i = 0; i < cells.length; i++) placeCheckers(cells[i], state);

    return board;
  }

  function placeCheckers(cell, state) {
    var stack = state.points[cell.n];
    var n = stack.length;
    if (!n) return;

    var r = cell.node.getBoundingClientRect();
    var w = r.width, h = r.height;
    if (!w || !h) return;                       // host is hidden; skip

    var d = Math.max(8, Math.min(w * 0.86, h * 0.19));
    var step = n > 1 ? Math.min(d * 1.04, (h - d) / (n - 1)) : 0;

    /* If they would overlap into an unreadable smear, show what fits and
       cap the rest with a count chip. */
    var visible = n, overflow = 0;
    if (n > 1 && step < d * 0.26) {
      step = d * 0.26;
      visible = Math.max(2, Math.floor((h - d) / step) + 1);
      if (visible < n) { overflow = n - visible + 1; visible = visible - 1; }
    }

    var run = E.topRun(state.points, cell.n);
    var firstOfTopRun = n - run.len;
    var jailed = firstOfTopRun > 0 && stack[firstOfTopRun - 1] !== run.color;

    for (var i = 0; i < visible; i++) {
      var c = el('div', 'chk ' + (stack[i] === 'W' ? 'w' : 'b'), cell.node);
      c.style.width = d + 'px';
      c.style.height = d + 'px';
      c.style[cell.isTop ? 'top' : 'bottom'] = (i * step) + 'px';
      /* Anything below the top run is immobile — that is what mahboos
         means, and the board should say so at a glance. */
      if (i < firstOfTopRun) c.classList.add('pinned');
      if (jailed && i === firstOfTopRun) c.classList.add('top-of-pin');
    }

    if (overflow) {
      var chip = el('div', 'chk overflow-count', cell.node);
      chip.style.width = d + 'px';
      chip.style.height = d + 'px';
      chip.style[cell.isTop ? 'top' : 'bottom'] = (visible * step) + 'px';
      chip.textContent = '+' + overflow;
    }
  }

  /* Static diagram for lessons and drills. `spec` is the compact
     bottom-first form understood by Engine.fromSpec. */
  function diagram(host, spec, opts) {
    var st = E.fromSpec(spec);
    return render(host, st, Object.assign({ interactive: false }, opts || {}));
  }

  root.Board = { render: render, diagram: diagram, die: die, TOP: TOP, BOT: BOT };
})(typeof window !== 'undefined' ? window : globalThis);
