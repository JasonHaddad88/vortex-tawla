/* =====================================================================
 * Vortex Tawla — application shell
 * ---------------------------------------------------------------------
 * View routing, the Learn/Drills/Glossary renderers, and the Play loop.
 * Classic script, no modules, so index.html works straight off disk.
 * ===================================================================== */
(function () {
  'use strict';

  var E = window.Engine, AI = window.AI, Board = window.Board, C = window.Content;
  var $ = function (id) { return document.getElementById(id); };

  /* ================================================================ */
  /* Routing                                                          */
  /* ================================================================ */

  var currentView = 'learn';

  function show(view) {
    currentView = view;
    ['learn', 'play', 'drills', 'glossary'].forEach(function (v) {
      $('view-' + v).classList.toggle('active', v === view);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.navlink'), function (b) {
      b.classList.toggle('active', b.dataset.view === view);
    });
    $('topbar').classList.remove('open');
    /* Boards measure themselves, so anything drawn while hidden has to
       be drawn again once it has a size. */
    if (view === 'learn') renderLesson();
    if (view === 'play') renderPlay();
    if (view === 'drills') renderDrill();
    if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.navlink'), function (b) {
    b.addEventListener('click', function () { show(b.dataset.view); });
  });
  $('hamburger').addEventListener('click', function () { $('topbar').classList.toggle('open'); });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { show(currentView); }, 150);
  });

  /* ================================================================ */
  /* Learn                                                            */
  /* ================================================================ */

  var lessonIdx = 0;

  function buildToc() {
    var toc = $('toc');
    toc.innerHTML = '';
    C.LESSONS.forEach(function (l, i) {
      var b = document.createElement('button');
      b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' + l.title + '</span>';
      b.addEventListener('click', function () { lessonIdx = i; renderLesson(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      toc.appendChild(b);
    });
  }

  function renderLesson() {
    var l = C.LESSONS[lessonIdx];
    Array.prototype.forEach.call($('toc').children, function (b, i) {
      b.classList.toggle('active', i === lessonIdx);
    });
    $('lesson-progress').textContent = 'Lesson ' + (lessonIdx + 1) + ' of ' + C.LESSONS.length;

    var host = $('lesson');
    host.innerHTML =
      '<h3>' + l.title + '</h3>' +
      '<p class="ar">' + l.arabic + '</p>' +
      l.html +
      '<div class="lesson-nav">' +
        '<button class="btn" id="lesson-prev"' + (lessonIdx === 0 ? ' disabled' : '') + '>&larr; Previous</button>' +
        '<button class="btn btn-primary" id="lesson-next"' +
          (lessonIdx === C.LESSONS.length - 1 ? ' disabled' : '') + '>Next &rarr;</button>' +
      '</div>';

    /* Hydrate the inline diagram placeholders. */
    Array.prototype.forEach.call(host.querySelectorAll('.diagram'), function (d) {
      var spec;
      try { spec = JSON.parse(d.dataset.spec || '{}'); } catch (e) { spec = {}; }
      var cap = d.dataset.cap || '';
      d.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'board-wrap';
      d.appendChild(wrap);
      Board.diagram(wrap, spec);
      if (cap) {
        var c = document.createElement('div');
        c.className = 'cap';
        c.textContent = cap;
        d.appendChild(c);
      }
    });

    var prev = $('lesson-prev'), next = $('lesson-next');
    if (prev) prev.addEventListener('click', function () { if (lessonIdx > 0) { lessonIdx--; renderLesson(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    if (next) next.addEventListener('click', function () { if (lessonIdx < C.LESSONS.length - 1) { lessonIdx++; renderLesson(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  }

  /* ================================================================ */
  /* Glossary                                                         */
  /* ================================================================ */

  function renderGlossary() {
    var g = $('gloss');
    g.innerHTML = '';
    C.GLOSSARY.forEach(function (t) {
      var d = document.createElement('div');
      d.className = 'term';
      d.innerHTML = '<div class="t"><span>' + t.t + '</span><span class="arabic">' + t.ar + '</span></div>' +
                    '<div class="d">' + t.d + '</div>';
      g.appendChild(d);
    });

    var rows = [
      ['1', 'yek', 'يك'], ['2', 'du / do', 'دو'], ['3', 'se', 'سه'],
      ['4', 'jahar / chahar', 'جهار'], ['5', 'benj / penj', 'بنج'], ['6', 'shesh', 'شيش'],
      ['6-5', 'shesh-besh', 'شيش بيش'], ['6-1', 'shesh-yek', '—'], ['3-1', 'se-yek', '—'],
      ['2-2', 'dubara', 'دوبارة'], ['5-5', 'dou-benj', '—'], ['6-6', 'dou-shesh', '—']
    ];
    var html = '<thead><tr><th>Roll</th><th>Called</th><th>Arabic</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td class="face">' + r[0] + '</td><td>' + r[1] + '</td><td class="arabic">' + r[2] + '</td></tr>';
    });
    $('dice-table').innerHTML = html + '</tbody>';
  }

  /* ================================================================ */
  /* Play                                                             */
  /* ================================================================ */

  var G = {
    state: null,
    turnStart: null,   // snapshot for undo, taken when the roll is made
    undoStack: [],
    selected: null,
    hint: null,
    log: [],
    score: { W: 0, B: 0 },
    busy: false,
    over: false
  };

  function opts() {
    return { manaEndsGame: $('opt-mana').checked };
  }

  function newGame() {
    G.state = E.newGame(opts());
    G.undoStack = [];
    G.selected = null;
    G.hint = null;
    G.over = false;
    G.busy = false;
    G.log = [];
    flash('');
    logLine('W', 'New game. You are purple and run 24 → 1.');
    renderPlay();
  }

  function flash(msg, kind) {
    $('play-flash').innerHTML = msg ? '<div class="flash ' + (kind || 'info') + '">' + msg + '</div>' : '';
  }

  function logLine(who, text) {
    G.log.unshift({ who: who, text: text });
    if (G.log.length > 120) G.log.pop();
  }

  function diceFaces(s) {
    if (!s.roll.length) return [];
    var faces = s.roll[0] === s.roll[1] ? [s.roll[0], s.roll[0], s.roll[0], s.roll[0]] : s.roll.slice();
    var rem = s.dice.slice();
    return faces.map(function (f) {
      var i = rem.indexOf(f);
      if (i >= 0) { rem.splice(i, 1); return { v: f, spent: false }; }
      return { v: f, spent: true };
    });
  }

  function moveLabel(mv) {
    return mv.from + '→' + (mv.off ? 'off' : mv.to);
  }

  function renderPlay() {
    var s = G.state;
    if (!s) return;

    var myTurn = s.turn === E.W && !G.busy && !G.over;
    var legal = myTurn ? E.legalNow(s) : [];

    /* Sources are the points we may lift from; targets appear once a
       source is selected. */
    var sources = [], seen = {};
    legal.forEach(function (m) { if (!seen[m.from]) { seen[m.from] = 1; sources.push(m.from); } });

    var targets = [], offTarget = false;
    if (G.selected != null) {
      legal.filter(function (m) { return m.from === G.selected; }).forEach(function (m) {
        if (m.off) offTarget = true;
        else targets.push({ to: m.to, pin: E.topRun(s.points, m.to).color === E.B && E.topRun(s.points, m.to).len === 1 });
      });
    }

    Board.render($('board'), s, {
      interactive: myTurn,
      showSources: $('opt-hints').checked,
      sources: sources,
      selected: G.selected,
      targets: targets,
      offTarget: offTarget,
      hint: G.hint,
      onPoint: onPoint
    });

    /* dice */
    var dice = $('dice');
    dice.innerHTML = '';
    diceFaces(s).forEach(function (f) { dice.appendChild(Board.die(f.v, f.spent)); });

    /* hud + stats */
    var pw = E.pipCount(s.points, E.W), pb = E.pipCount(s.points, E.B);
    $('pip-w').textContent = pw;
    $('pip-b').textContent = pb;
    $('who-w').classList.toggle('active', s.turn === E.W);
    $('who-b').classList.toggle('active', s.turn === E.B);
    $('s-pip-w').textContent = pw;
    $('s-pip-b').textContent = pb;
    $('s-off').textContent = s.off.W + ' – ' + s.off.B;
    $('s-pins-w').textContent = E.pinsHeldBy(s.points, E.W).length + (E.manaHeldBy(s.points, E.W) ? '  (mana!)' : '');
    $('s-pins-b').textContent = E.pinnedCheckers(s.points, E.W).length + (E.manaHeldBy(s.points, E.B) ? '  (mana!)' : '');
    $('s-score').textContent = G.score.W + ' – ' + G.score.B;

    /* controls */
    var rolled = s.roll.length > 0;
    $('btn-roll').disabled = !myTurn || rolled || G.over;
    $('btn-undo').disabled = !myTurn || !s.played.length;
    $('btn-done').disabled = !myTurn || !rolled || E.legalNow(s).length > 0;
    $('btn-hint').disabled = !myTurn || !rolled || !E.legalNow(s).length;
    $('btn-done').classList.toggle('btn-primary', !$('btn-done').disabled);

    /* log */
    var log = $('log');
    log.innerHTML = '';
    G.log.forEach(function (l) {
      var d = document.createElement('div');
      d.className = 'entry ' + (l.who === E.W ? 'w' : 'b');
      d.innerHTML = l.text;
      log.appendChild(d);
    });
  }

  function onPoint(n) {
    var s = G.state;
    if (s.turn !== E.W || G.busy || G.over) return;
    var legal = E.legalNow(s);

    if (n === 'off') {
      var offMv = legal.filter(function (m) { return m.off && m.from === G.selected; })[0];
      if (offMv) doMove(offMv);
      return;
    }

    /* clicking the selected point again puts it back down */
    if (G.selected === n) { G.selected = null; renderPlay(); return; }

    var asTarget = legal.filter(function (m) { return m.from === G.selected && m.to === n; })[0];
    if (G.selected != null && asTarget) { doMove(asTarget); return; }

    if (legal.some(function (m) { return m.from === n; })) {
      G.selected = n;
      G.hint = null;
      renderPlay();
    }
  }

  function doMove(mv) {
    var s = G.state;
    G.undoStack.push(E.clone(s));
    var r = E.apply(s, mv);
    G.selected = null;
    G.hint = null;
    /* The old hint described the position we just left; leaving it on
       screen reads as a hint that failed to update. */
    flash('');

    var note = moveLabel(mv);
    if (r.pinned) note += ' <span class="tag">— pin!</span>';
    if (r.freed) note += ' <span class="tag">— released</span>';
    if (E.manaHeldBy(s.points, E.W) && mv.to === E.startPoint(E.B))
      note += ' <span class="tag">— MANA</span>';
    logLine(E.W, note);

    if (checkOver()) return;
    renderPlay();

    if (E.legalNow(s).length === 0) {
      /* nothing left to play; nudge but let the player undo if they want */
      renderPlay();
    }
  }

  function undo() {
    if (!G.undoStack.length) return;
    G.state = G.undoStack.pop();
    G.selected = null;
    G.hint = null;
    /* drop the log line for the move we just took back */
    if (G.log.length) G.log.shift();
    renderPlay();
  }

  function rollForPlayer() {
    var s = G.state;
    if (s.roll.length) return;
    var d = E.rollDice();
    E.setRoll(s, d[0], d[1]);
    G.undoStack = [];
    G.selected = null;
    G.hint = null;
    flash('');
    logLine(E.W, '<strong>Roll ' + d[0] + '-' + d[1] + '</strong>' + (d[0] === d[1] ? ' (double)' : ''));

    if (E.legalNow(s).length === 0) {
      /* Could be an ordinary forfeit, or a position where neither side
         can ever move again — result() tells them apart. */
      if (checkOver()) return;
      logLine(E.W, 'No legal move — turn forfeited.');
      renderPlay();
      setTimeout(endPlayerTurn, 900);
      return;
    }
    renderPlay();
  }

  function endPlayerTurn() {
    if (G.over) return;
    E.endTurn(G.state);
    G.undoStack = [];
    G.selected = null;
    G.hint = null;
    renderPlay();
    setTimeout(aiTurn, 500);
  }

  function aiTurn() {
    var s = G.state;
    if (G.over || s.turn !== E.B) return;
    G.busy = true;

    var d = E.rollDice();
    E.setRoll(s, d[0], d[1]);
    logLine(E.B, '<strong>Opponent rolls ' + d[0] + '-' + d[1] + '</strong>' + (d[0] === d[1] ? ' (double)' : ''));
    renderPlay();

    var plan = AI.choosePlan(s, $('difficulty').value);
    if (!plan || !plan.length) {
      G.busy = false;
      if (checkOver()) return;
      G.busy = true;
      logLine(E.B, 'No legal move — turn forfeited.');
      setTimeout(function () {
        G.busy = false;
        E.endTurn(s);
        renderPlay();
      }, 800);
      return;
    }

    var i = 0;
    (function step() {
      if (i >= plan.length) {
        G.busy = false;
        if (checkOver()) return;
        E.endTurn(s);
        renderPlay();
        return;
      }
      var mv = plan[i++];
      var r = E.apply(s, mv);
      var note = moveLabel(mv);
      if (r.pinned) note += ' <span class="tag">— pinned you!</span>';
      if (r.freed) note += ' <span class="tag">— released</span>';
      if (E.manaHeldBy(s.points, E.B) && mv.to === E.startPoint(E.W))
        note += ' <span class="tag">— MANA against you</span>';
      logLine(E.B, note);
      renderPlay();
      setTimeout(step, 520);
    })();
  }

  function checkOver() {
    var res = E.result(G.state);
    if (!res) return false;
    G.over = true;
    G.busy = false;

    if (res.reason === 'deadlock') {
      flash('<strong>Dead position — the game is drawn.</strong> Each side holds the other\'s mana ' +
            'and has nothing left that can legally move, so neither player can ever bear off. ' +
            'This is exactly why many tables score the mana as an instant double loss — try ' +
            'switching on <em>Mana ends game</em>.', 'info');
      logLine(E.W, '<strong>Drawn: dead position.</strong>');
      renderPlay();
      return true;
    }

    G.score[res.winner] += res.points;
    var youWon = res.winner === E.W;
    var label = res.reason === 'mars' ? 'a mars (double game)'
              : res.reason === 'mana' ? 'the mana — an instant double game'
              : 'a single game';
    flash('<strong>' + (youWon ? 'You win' : 'Opponent wins') + '</strong> — ' + label +
          ', worth ' + res.points + ' point' + (res.points > 1 ? 's' : '') +
          '. Match score ' + G.score.W + ' – ' + G.score.B + '.',
          youWon ? 'success' : 'error');
    logLine(res.winner, '<strong>Game over: ' + label + '.</strong>');
    renderPlay();
    return true;
  }

  function showHint() {
    var h = AI.hint(G.state);
    if (!h) return;
    G.hint = { from: h.next.from, to: h.next.off ? null : h.next.to };
    G.selected = null;
    var rest = h.plan.length > 1 ? ' Full line: <strong>' + h.line + '</strong>.' : '';
    flash('Try <strong>' + moveLabel(h.next) + '</strong> — ' + h.why + '.' + rest, 'info');
    renderPlay();
  }

  $('btn-roll').addEventListener('click', rollForPlayer);
  $('btn-undo').addEventListener('click', undo);
  $('btn-done').addEventListener('click', endPlayerTurn);
  $('btn-hint').addEventListener('click', showHint);
  $('btn-new').addEventListener('click', newGame);
  $('opt-hints').addEventListener('change', renderPlay);
  $('opt-mana').addEventListener('change', function () {
    if (G.state) G.state.opts.manaEndsGame = $('opt-mana').checked;
  });
  $('difficulty').addEventListener('change', function () { this.blur(); });

  /* ================================================================ */
  /* Drills                                                           */
  /* ================================================================ */

  var D = { idx: 0, state: null, selected: null, revealed: false };

  function loadDrill() {
    var d = C.DRILLS[D.idx];
    D.state = E.fromSpec(d.spec, E.W, {});
    E.setRoll(D.state, d.roll[0], d.roll[1]);
    D.selected = null;
    D.revealed = false;
    $('drill-verdict').innerHTML = '';
    renderDrill();
  }

  function renderDrill() {
    var d = C.DRILLS[D.idx], s = D.state;
    if (!s) return;

    $('drill-progress').textContent = 'Drill ' + (D.idx + 1) + ' of ' + C.DRILLS.length;
    $('drill-head').innerHTML = '<strong>' + d.title + '</strong>';
    var faces = document.createElement('div');
    faces.className = 'dice';
    diceFaces(s).forEach(function (f) { faces.appendChild(Board.die(f.v, f.spent)); });
    $('drill-head').appendChild(faces);
    $('drill-q').textContent = d.q;

    var legal = E.legalNow(s);
    var sources = [], seen = {};
    legal.forEach(function (m) { if (!seen[m.from]) { seen[m.from] = 1; sources.push(m.from); } });

    var targets = [], offTarget = false;
    if (D.selected != null) {
      legal.filter(function (m) { return m.from === D.selected; }).forEach(function (m) {
        if (m.off) offTarget = true;
        else targets.push({ to: m.to, pin: E.topRun(s.points, m.to).color === E.B && E.topRun(s.points, m.to).len === 1 });
      });
    }

    Board.render($('drill-board'), s, {
      interactive: true,
      showSources: true,
      sources: sources,
      selected: D.selected,
      targets: targets,
      offTarget: offTarget,
      onPoint: onDrillPoint
    });

    /* Left enabled deliberately: checkDrill() explains that both dice
       still have to be played, which is more use than a dead button. */
    $('drill-check').disabled = false;
    $('drill-prev').disabled = D.idx === 0;
    $('drill-next').disabled = D.idx === C.DRILLS.length - 1;
  }

  function onDrillPoint(n) {
    var s = D.state, legal = E.legalNow(s);
    if (n === 'off') {
      var offMv = legal.filter(function (m) { return m.off && m.from === D.selected; })[0];
      if (offMv) { E.apply(s, offMv); D.selected = null; renderDrill(); }
      return;
    }
    if (D.selected === n) { D.selected = null; renderDrill(); return; }
    var t = legal.filter(function (m) { return m.from === D.selected && m.to === n; })[0];
    if (D.selected != null && t) { E.apply(s, t); D.selected = null; renderDrill(); return; }
    if (legal.some(function (m) { return m.from === n; })) { D.selected = n; renderDrill(); }
  }

  function checkDrill() {
    var d = C.DRILLS[D.idx], s = D.state;
    if (E.legalNow(s).length > 0) {
      $('drill-verdict').innerHTML = '<div class="flash info">Play both dice first.</div>';
      return;
    }
    var ok = true;
    if (d.key) {
      ok = d.key.every(function (k) {
        return s.played.some(function (m) { return m.from === k.from && (m.off ? 0 : m.to) === k.to; });
      });
    }
    if (ok && d.avoid) {
      ok = !s.played.some(function (m) { return d.avoid.indexOf(m.from) >= 0; });
    }
    $('drill-verdict').innerHTML = ok
      ? '<div class="flash success"><strong>Correct.</strong> ' + d.why + '</div>'
      : '<div class="flash error"><strong>Not quite.</strong> You played ' +
        s.played.map(moveLabel).join(', ') + '. Try again, or reveal the answer.</div>';
  }

  $('drill-reset').addEventListener('click', loadDrill);
  $('drill-check').addEventListener('click', checkDrill);
  $('drill-reveal').addEventListener('click', function () {
    var d = C.DRILLS[D.idx];
    $('drill-verdict').innerHTML = '<div class="flash info"><strong>' + d.model + '</strong><br>' + d.why + '</div>';
  });
  $('drill-prev').addEventListener('click', function () { if (D.idx > 0) { D.idx--; loadDrill(); } });
  $('drill-next').addEventListener('click', function () { if (D.idx < C.DRILLS.length - 1) { D.idx++; loadDrill(); } });

  /* ================================================================ */
  /* Boot                                                             */
  /* ================================================================ */

  buildToc();
  renderGlossary();
  newGame();
  loadDrill();

  var start = location.hash.slice(1);
  show(['learn', 'play', 'drills', 'glossary'].indexOf(start) >= 0 ? start : 'learn');
})();
