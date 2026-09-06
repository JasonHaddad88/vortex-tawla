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

  /* ---------------------------------------------------------------- */
  /* Spoken descriptions                                               */
  /* ---------------------------------------------------------------- */

  var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
               'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
               'fourteen', 'fifteen'];

  function count(n) { return WORDS[n] || String(n); }
  function plural(n, w) { return count(n) + ' ' + w + (n === 1 ? '' : 's'); }

  /* Whose checkers, in words. `names` lets the caller say "your" and
     "the opponent's" in a solo game and "purple"/"cyan" in a two-player
     one, where "your" would be ambiguous. */
  function owner(names, c) { return (names && names[c]) || (c === 'W' ? 'purple' : 'cyan'); }

  /* Possessives need "three OF your checkers"; plain adjectives do not
     ("three purple checkers"). */
  function isPossessive(w) { return w === 'your' || /'s$/.test(w); }

  function checkers(n, names, c) {
    var who = owner(names, c);
    /* "one of your checkers" — the "one of" construction stays plural,
       unlike "one purple checker". */
    return isPossessive(who)
      ? count(n) + ' of ' + who + ' checkers'
      : plural(n, who + ' checker');
  }

  /* A point read aloud. Layers matter: in Mahbooseh a stack can be an
     enemy checker with yours sitting on top of it, and that is the whole
     game, so it has to be said rather than implied by a colour. */
  function describePoint(state, i, names) {
    var stack = state.points[i];
    if (!stack.length) return 'Point ' + i + ', empty';

    var run = E.topRun(state.points, i);
    var below = stack.length - run.len;
    var s = 'Point ' + i + ', ' + checkers(run.len, names, run.color);

    if (below > 0) {
      /* Everything under the top run is immobile. */
      var trapped = {};
      for (var k = 0; k < below; k++) trapped[stack[k]] = (trapped[stack[k]] || 0) + 1;
      var parts = [];
      Object.keys(trapped).forEach(function (c) {
        parts.push(checkers(trapped[c], names, c));
      });
      s += ', on top of ' + parts.join(' and ') + ' trapped underneath';
    }
    return s;
  }

  function describeState(state, i, opts, targets, sources) {
    var bits = [];
    if (opts.selected === i) bits.push('selected');
    if (sources && sources.indexOf(i) >= 0) bits.push('you can move from here');
    if (targets && targets[i]) {
      bits.push(targets[i].risk === 'mana' ? 'legal move, warning: leaves the mana'
              : targets[i].risk === 'blot' ? 'legal move, leaves a blot'
              : targets[i].pin ? 'legal move, traps a checker'
              : 'legal move');
    }
    if (!bits.length) return '';
    var s = bits.join(', ');
    return '. ' + s.charAt(0).toUpperCase() + s.slice(1);
  }

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
    var names = opts.names;

    /* One tab stop for the whole board with arrow keys inside it, rather
       than 26 tab stops. `grid` is the closest standard role: two rows of
       cells that are navigated spatially. */
    board.setAttribute('role', opts.interactive ? 'grid' : 'group');
    board.setAttribute('aria-label', opts.label || 'Board');

    var cells = [];
    var nav = [];                       // [row][col] -> element, for arrows
    function place(row, col, node) {
      (nav[row] = nav[row] || [])[col] = node;
    }

    function addRow(list, isTop) {
      var row = isTop ? 0 : 1;
      for (var c = 0; c < list.length; c++) {
        var n = list[c];
        if (n === 'bar') {
          /* One element spanning both rows, reachable from either. */
          var barNode = isTop ? addBar(board, state, opts, targets) : nav[0] && nav[0][c];
          if (barNode) place(row, c, barNode);
          continue;
        }
        var pt = el('div', pointClasses(n, isTop), board);
        pt.style.gridColumn = String(c + 1);
        pt.style.gridRow = isTop ? '1' : '2';
        el('div', 'tri', pt);
        if (numbers) el('div', 'num', pt).textContent = n;

        pt.setAttribute('role', opts.interactive ? 'gridcell' : 'img');
        pt.dataset.row = row;
        pt.dataset.col = c;
        pt.dataset.point = n;
        place(row, c, pt);

        if (opts.selected === n) pt.classList.add('selected');
        /* `movable` is the hint tint; it can be switched off without
           losing the ability to pick the checker up. */
        if (sources[n] && opts.showSources !== false) pt.classList.add('movable');
        if (targets[n]) {
          pt.classList.add(targets[n].pin ? 'target-pin' : 'target');
          /* A coach warning overrides the plain destination tint. */
          if (targets[n].risk) pt.classList.add('risk-' + targets[n].risk);
          if (targets[n].title) pt.title = targets[n].title;
        }
        if (opts.hint && opts.hint.from === n) pt.classList.add('hintsrc');
        if (opts.hint && opts.hint.to === n) pt.classList.add('hintdst');

        /* Read out the contents and then the state, so a blind player
           can explore the position without seeing it. */
        pt.setAttribute('aria-label',
          describePoint(state, n, names) +
          describeState(state, n, opts, targets, opts.sources || []));
        if (opts.interactive && (sources[n] || targets[n] || opts.selected === n)) {
          pt.classList.add('clickable');
          pt.setAttribute('aria-selected', opts.selected === n ? 'true' : 'false');
          (function (num) {
            pt.addEventListener('click', function () { opts.onPoint && opts.onPoint(num); });
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
      var who = owner(names, colour);
      el('div', 'tray-label', tray).textContent = (side === 'w' ? 'YOU' : 'OPP') + ' ' + n;
      for (var k = 0; k < n; k++) el('div', 'slab ' + side, tray);

      var label = who.charAt(0).toUpperCase() + who.slice(1) +
                  (isPossessive(who) ? '' : "'s") + ' bear-off tray, ' +
                  plural(n, 'checker') + ' off';
      var canBearOff = opts.offTarget &&
        ((side === 'w' && state.turn === 'W') || (side === 'b' && state.turn === 'B'));
      if (canBearOff) {
        tray.classList.add('target');
        label += '. Legal move, bear off';
        tray.addEventListener('click', function () { opts.onPoint && opts.onPoint('off'); });
      }
      tray.setAttribute('role', opts.interactive ? 'gridcell' : 'img');
      tray.setAttribute('aria-label', label);
      tray.title = label;
      place(side === 'w' ? 1 : 0, 13, tray);
    });

    /* Roving tabindex: exactly one cell is tabbable, arrows move between
       them. Everything else is -1 so the board is a single tab stop. */
    if (opts.interactive) {
      var fr = opts.focus && opts.focus.row, fc = opts.focus && opts.focus.col;
      if (!nav[fr] || !nav[fr][fc]) {
        /* Start where the player is most likely to act: the first point
           they can move from, rather than an empty tray in the corner. */
        fr = 1; fc = 13;
        var firstSrc = (opts.sources || []).filter(function (x) { return x !== 'bar'; })[0];
        if (firstSrc !== undefined) {
          var found = board.querySelector('.pt[data-point="' + firstSrc + '"]');
          if (found) { fr = +found.dataset.row; fc = +found.dataset.col; }
        }
      }
      for (var r = 0; r < nav.length; r++) {
        for (var c2 = 0; nav[r] && c2 < nav[r].length; c2++) {
          var node = nav[r][c2];
          if (!node) continue;
          node.tabIndex = (r === fr && c2 === fc) ? 0 : -1;
        }
      }
      board.addEventListener('keydown', function (ev) {
        var t = ev.target;
        if (!t || t.dataset.row === undefined && !t.classList.contains('tray') &&
            !t.classList.contains('bar')) return;

        var row = +t.dataset.row, col = +t.dataset.col;
        if (isNaN(row) || isNaN(col)) {
          /* Bar and trays are placed but do not carry dataset coords. */
          outer: for (var a = 0; a < nav.length; a++)
            for (var b = 0; nav[a] && b < nav[a].length; b++)
              if (nav[a][b] === t) { row = a; col = b; break outer; }
        }
        if (isNaN(row) || row === undefined) return;

        var dr = 0, dc = 0;
        switch (ev.key) {
          case 'ArrowRight': dc = 1; break;
          case 'ArrowLeft':  dc = -1; break;
          case 'ArrowDown':  dr = 1; break;
          case 'ArrowUp':    dr = -1; break;
          case 'Home':       col = -1; dc = 1; break;
          case 'End':        col = 14; dc = -1; break;
          case 'Enter':
          case ' ':
            ev.preventDefault();
            t.click();
            return;
          default: return;
        }
        ev.preventDefault();

        /* Step until we land on a real cell, so gaps never trap focus. */
        var nr = Math.min(1, Math.max(0, row + dr)), nc = col + dc;
        for (var guard = 0; guard < 16; guard++) {
          if (nc < 0) { nc = 0; break; }
          if (nc > 13) { nc = 13; break; }
          if (nav[nr] && nav[nr][nc]) break;
          nc += (dc || 1);
        }
        var next = nav[nr] && nav[nr][nc];
        if (!next) return;
        if (opts.onFocusMove) opts.onFocusMove(nr, nc);
        next.tabIndex = 0;
        t.tabIndex = -1;
        next.focus();
      });
    }

    /* Second pass: now that the grid has been laid out we know the real
       point geometry, so checkers can be sized and stacked to fit. */
    for (i = 0; i < cells.length; i++) placeCheckers(cells[i], state);

    return board;
  }

  /* The centre spine. In Mahbooseh it is pure decoration — nothing is
     ever sent back — so it only becomes interactive for variants that
     actually have a bar. */
  function addBar(board, state, opts, targets) {
    var bar = el('div', 'bar', board);
    var v = E.variantOf(state);
    /* In Mahbooseh the spine is pure decoration — nothing is ever sent
       back — so it is hidden from assistive tech and left out of the
       keyboard grid rather than sitting there as a silent dead stop. */
    if (!v.hasBar) {
      bar.setAttribute('aria-hidden', 'true');
      return null;
    }
    bar.classList.add('live');

    [['B', 'b', 'up'], ['W', 'w', 'down']].forEach(function (cfg) {
      var n = state.bar[cfg[0]];
      if (!n) return;
      var stack = el('div', 'barstack ' + cfg[2], bar);
      for (var i = 0; i < Math.min(n, 4); i++) el('div', 'chk ' + cfg[1], stack);
      if (n > 4) el('div', 'barcount', stack).textContent = '+' + (n - 4);
    });

    /* Checkers on the bar must come back before anything else moves, so
       when the bar is the only legal source we say so loudly. */
    var names = opts.names;
    var label = 'Bar: ' + checkers(state.bar.W, names, 'W') + ' and ' +
                checkers(state.bar.B, names, 'B');
    if (opts.sources && opts.sources.indexOf('bar') >= 0) {
      bar.classList.add('movable');
      if (opts.selected === 'bar') bar.classList.add('selected');
      label += '. You must re-enter before moving anything else';
      if (opts.selected === 'bar') label += ', selected';
      if (opts.interactive) {
        bar.classList.add('clickable');
        bar.setAttribute('aria-selected', opts.selected === 'bar' ? 'true' : 'false');
        bar.addEventListener('click', function () { opts.onPoint && opts.onPoint('bar'); });
      }
    }
    bar.setAttribute('role', opts.interactive ? 'gridcell' : 'img');
    bar.setAttribute('aria-label', label);
    return bar;
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
     bottom-first form understood by Engine.fromSpec; `opts.variant` and
     `opts.bar` are passed through to it so a diagram can show a bar. */
  function diagram(host, spec, opts) {
    opts = opts || {};
    var st = E.fromSpec(spec, 'W', { variant: opts.variant, bar: opts.bar });
    return render(host, st, Object.assign({ interactive: false }, opts));
  }

  root.Board = {
    render: render, diagram: diagram, die: die,
    describePoint: describePoint, TOP: TOP, BOT: BOT
  };
})(typeof window !== 'undefined' ? window : globalThis);
