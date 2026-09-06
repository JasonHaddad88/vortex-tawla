/* =====================================================================
 * Vortex Tawla — application shell
 * ---------------------------------------------------------------------
 * View routing, the Learn/Drills/Glossary renderers, and the Play loop.
 * Classic script, no modules, so index.html works straight off disk.
 * ===================================================================== */
(function () {
  'use strict';

  var E = window.Engine, AI = window.AI, Board = window.Board, C = window.Content;
  var Coach = window.Coach, Store = window.Store;
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
  var gameIdx = 0;

  function lessons() { return C.GAMES[gameIdx].lessons; }

  function buildGameTabs() {
    var host = $('gametabs');
    host.innerHTML = '';
    C.GAMES.forEach(function (g, i) {
      var b = document.createElement('button');
      b.className = 'gametab' + (i === gameIdx ? ' active' : '');
      b.innerHTML = g.name + ' <span class="ar">' + g.arabic + '</span>';
      b.addEventListener('click', function () {
        if (gameIdx === i) return;
        gameIdx = i;
        lessonIdx = 0;
        buildGameTabs();
        buildToc();
        renderLesson();
        saveProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      host.appendChild(b);
    });
  }

  function buildToc() {
    var toc = $('toc');
    toc.innerHTML = '';
    lessons().forEach(function (l, i) {
      var b = document.createElement('button');
      b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' + l.title + '</span>';
      b.addEventListener('click', function () { lessonIdx = i; renderLesson(); saveProgress(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      toc.appendChild(b);
    });
  }

  function renderLesson() {
    var list = lessons();
    if (lessonIdx >= list.length) lessonIdx = 0;
    var l = list[lessonIdx];
    var game = C.GAMES[gameIdx];
    $('learn-title').textContent = game.name + ' — ' + game.arabic;
    Array.prototype.forEach.call($('toc').children, function (b, i) {
      b.classList.toggle('active', i === lessonIdx);
    });
    $('lesson-progress').textContent = 'Lesson ' + (lessonIdx + 1) + ' of ' + list.length;

    var host = $('lesson');
    host.innerHTML =
      '<h3>' + l.title + '</h3>' +
      '<p class="ar">' + l.arabic + '</p>' +
      l.html +
      '<div class="lesson-nav">' +
        '<button class="btn" id="lesson-prev"' + (lessonIdx === 0 ? ' disabled' : '') + '>&larr; Previous</button>' +
        '<button class="btn btn-primary" id="lesson-next"' +
          (lessonIdx === list.length - 1 ? ' disabled' : '') + '>Next &rarr;</button>' +
      '</div>';

    /* Hydrate the inline diagram placeholders. */
    Array.prototype.forEach.call(host.querySelectorAll('.diagram'), function (d) {
      var spec, bar;
      try { spec = JSON.parse(d.dataset.spec || '{}'); } catch (e) { spec = {}; }
      try { bar = JSON.parse(d.dataset.bar || 'null'); } catch (e) { bar = null; }
      var cap = d.dataset.cap || '';
      d.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'board-wrap';
      d.appendChild(wrap);
      Board.diagram(wrap, spec, { variant: d.dataset.variant, bar: bar });
      if (cap) {
        var c = document.createElement('div');
        c.className = 'cap';
        c.textContent = cap;
        d.appendChild(c);
      }
    });

    var prev = $('lesson-prev'), next = $('lesson-next');
    if (prev) prev.addEventListener('click', function () { if (lessonIdx > 0) { lessonIdx--; renderLesson(); saveProgress(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    if (next) next.addEventListener('click', function () { if (lessonIdx < list.length - 1) { lessonIdx++; renderLesson(); saveProgress(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
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
    turnStart: null,   // state as it stood right after the roll
    undoStack: [],
    selected: null,
    hint: null,
    review: null,      // last Coach.reviewTurn result
    log: [],
    score: { W: 0, B: 0 },
    busy: false,
    over: false
  };

  function opts() {
    return { manaEndsGame: $('opt-mana').checked, variant: $('variant').value };
  }

  function newGame() {
    G.state = E.newGame(opts());
    G.turnStart = null;
    G.undoStack = [];
    G.selected = null;
    G.hint = null;
    G.review = null;
    G.over = false;
    G.busy = false;
    G.log = [];
    flash('');
    var v = E.variantOf(G.state);
    logLine('W', 'New game — <strong>' + v.name + '</strong>. You are purple and run 24 → 1.');
    renderPlay();
    save();
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
    return (mv.enter ? 'bar' : mv.from) + '→' + (mv.off ? 'off' : mv.to);
  }

  function renderPlay() {
    var s = G.state;
    if (!s) return;

    var myTurn = s.turn === E.W && !G.busy && !G.over;
    var legal = myTurn ? E.legalNow(s) : [];

    var v = E.variantOf(s);

    /* Sources are the points we may lift from ('bar' included); targets
       appear once a source is selected. */
    var sources = [], seen = {};
    legal.forEach(function (m) {
      var key = m.enter ? 'bar' : m.from;
      if (!seen[key]) { seen[key] = 1; sources.push(key); }
    });

    /* With checkers on the bar there is nothing else to choose, so pick
       it up automatically rather than making the player click a spine
       that is their only option. */
    if (G.selected == null && sources.length === 1 && sources[0] === 'bar') G.selected = 'bar';

    var coaching = $('opt-coach').checked;
    var targets = [], offTarget = false;
    if (G.selected != null) {
      legal.filter(function (m) {
        return (m.enter ? 'bar' : m.from) === G.selected;
      }).forEach(function (m) {
        if (m.off) { offTarget = true; return; }
        var run = E.topRun(s.points, m.to);
        /* Ask the coach what each destination would cost, so the warning
           is on the board before the move rather than after it. */
        var risk = coaching ? Coach.moveRisk(s, m) : null;
        targets.push({
          to: m.to,
          pin: run.color === E.B && run.len === 1,
          risk: risk ? risk.level : null,
          title: risk ? risk.text : null
        });
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

    renderCoach(targets);

    /* dice */
    var dice = $('dice');
    dice.innerHTML = '';
    diceFaces(s).forEach(function (f) { dice.appendChild(Board.die(f.v, f.spent)); });

    /* hud + stats */
    var pw = E.pipCount(s.points, E.W, v, s.bar), pb = E.pipCount(s.points, E.B, v, s.bar);
    $('pip-w').textContent = pw;
    $('pip-b').textContent = pb;
    $('who-w').classList.toggle('active', s.turn === E.W);
    $('who-b').classList.toggle('active', s.turn === E.B);
    $('s-pip-w').textContent = pw;
    $('s-pip-b').textContent = pb;
    $('s-off').textContent = s.off.W + ' – ' + s.off.B;
    $('s-score').textContent = G.score.W + ' – ' + G.score.B;
    $('play-title').textContent = 'Play ' + v.name;

    /* The two games care about different things, so show the stats that
       actually apply to the one being played. */
    $('row-bar').hidden = !v.hasBar;
    $('row-pins-w').hidden = !v.pins;
    $('row-pins-b').hidden = !v.pins;
    if (v.hasBar) $('s-bar').textContent = s.bar.W + ' – ' + s.bar.B;
    if (v.pins) {
      $('s-pins-w').textContent = E.pinsHeldBy(s.points, E.W).length +
        (E.manaHeldBy(s.points, E.W, v) ? '  (mana!)' : '');
      $('s-pins-b').textContent = E.pinnedCheckers(s.points, E.W).length +
        (E.manaHeldBy(s.points, E.B, v) ? '  (mana!)' : '');
    }

    /* controls */
    var rolled = s.roll.length > 0;
    $('btn-roll').disabled = !myTurn || rolled || G.over;
    $('btn-undo').disabled = !myTurn || !G.undoStack.length;
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

  /* The Coach card shows a live warning while a move is pending, and the
     review of the last completed turn otherwise. */
  function renderCoach(targets) {
    var body = $('coach-body');
    if (!$('opt-coach').checked) {
      body.className = 'coach-empty';
      body.textContent = 'Coach is off.';
      return;
    }

    var pending = (targets || []).filter(function (t) { return t.risk; });
    if (pending.length) {
      var worst = pending.filter(function (t) { return t.risk === 'mana'; })[0] || pending[0];
      body.className = '';
      body.innerHTML = '<div class="coach-warn' + (worst.risk === 'mana' ? '' : ' mild') + '">' +
        '<span class="h">' + (worst.risk === 'mana' ? 'Mana warning' : 'Leaves a blot') + '</span>' +
        worst.title + '</div>';
      return;
    }

    var r = G.review;
    if (!r) {
      body.className = 'coach-empty';
      body.textContent = "Finish a turn and I'll review it.";
      return;
    }

    body.className = 'coach-body';
    var badge = '<span class="badge ' + r.grade.tone + '">' + r.grade.label + '</span>';
    var cost = r.same ? '' : '<span class="cost">cost ' + r.loss.toFixed(1) + '</span>';
    var html = '<div class="coach-verdict">' + badge + cost + '</div>';
    if (r.same) {
      html += 'You played <span class="better">' + r.playedLine + '</span>' +
              '<p class="lead">That was the best line available' +
              (r.alternatives > 1 ? ' out of ' + r.alternatives + ' legal ways to play the roll' : '') +
              '.</p>';
    } else if (!Coach.isMistake(r.grade)) {
      /* A fraction of a pip apart. Show the alternative, but do not dress
         it up as a correction. */
      html += 'You played <span class="neutral">' + r.playedLine + '</span>' +
              '<p class="lead">Sound. The engine marginally prefers <strong>' + r.bestLine +
              '</strong>, but there is next to nothing in it.</p>';
    } else {
      html += 'You played <span class="played">' + r.playedLine + '</span>' +
              'Better was <span class="better">' + r.bestLine + '</span>' +
              '<p class="lead">Because ' + r.why + '.</p>';
    }
    body.innerHTML = html;
  }

  function onPoint(n) {
    var s = G.state;
    if (s.turn !== E.W || G.busy || G.over) return;
    var legal = E.legalNow(s);

    var srcOf = function (m) { return m.enter ? 'bar' : m.from; };

    if (n === 'off') {
      var offMv = legal.filter(function (m) { return m.off && srcOf(m) === G.selected; })[0];
      if (offMv) doMove(offMv);
      return;
    }

    /* clicking the selected point again puts it back down */
    if (G.selected === n) { G.selected = null; renderPlay(); return; }

    var asTarget = legal.filter(function (m) {
      return srcOf(m) === G.selected && m.to === n;
    })[0];
    if (G.selected != null && asTarget) { doMove(asTarget); return; }

    if (legal.some(function (m) { return srcOf(m) === n; })) {
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

    var v = E.variantOf(s);
    var note = moveLabel(mv);
    if (r.pinned) note += ' <span class="tag">— pin!</span>';
    if (r.hit) note += ' <span class="tag">— hit!</span>';
    if (r.freed) note += ' <span class="tag">— released</span>';
    if (v.pins && E.manaHeldBy(s.points, E.W, v) && mv.to === E.startPoint(E.B, v))
      note += ' <span class="tag">— MANA</span>';
    logLine(E.W, note);

    /* The turn is only worth reviewing once it is actually finished —
       a half-played turn has no meaningful cost yet. */
    if (E.legalNow(s).length === 0) reviewTurn();

    if (checkOver()) return;
    renderPlay();
    save();
  }

  function reviewTurn() {
    if (!$('opt-coach').checked || !G.turnStart || !G.state.played.length) { G.review = null; return; }
    G.review = Coach.reviewTurn(G.turnStart, G.state.played);
    if (G.review && !G.review.same && Coach.isMistake(G.review.grade)) {
      logLine(E.W, '<span class="tag">' + G.review.grade.label + '</span> — better was ' +
                   G.review.bestLine);
    }
  }

  function undo() {
    if (!G.undoStack.length) return;
    G.state = G.undoStack.pop();
    G.selected = null;
    G.hint = null;
    G.review = null;         // the turn is unfinished again
    /* drop the log line for the move we just took back */
    if (G.log.length) G.log.shift();
    renderPlay();
    save();
  }

  function rollForPlayer() {
    var s = G.state;
    if (s.roll.length) return;
    var d = E.rollDice();
    E.setRoll(s, d[0], d[1]);
    G.turnStart = E.clone(s);      // for the coach and for mid-turn saves
    G.undoStack = [];
    G.selected = null;
    G.hint = null;
    G.review = null;
    flash('');
    logLine(E.W, '<strong>Roll ' + d[0] + '-' + d[1] + '</strong>' + (d[0] === d[1] ? ' (double)' : ''));
    save();

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
    G.turnStart = null;
    G.undoStack = [];
    G.selected = null;
    G.hint = null;
    renderPlay();
    save();
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
        save();
        return;
      }
      var mv = plan[i];
      i++;
      var r = E.apply(s, mv);
      var vb = E.variantOf(s);
      var note = moveLabel(mv);
      if (r.pinned) note += ' <span class="tag">— pinned you!</span>';
      if (r.hit) note += ' <span class="tag">— hit you!</span>';
      if (r.freed) note += ' <span class="tag">— released</span>';
      if (vb.pins && E.manaHeldBy(s.points, E.B, vb) && mv.to === E.startPoint(E.W, vb))
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
              : res.reason === 'gammon' ? 'a gammon (double game)'
              : res.reason === 'backgammon' ? 'a backgammon (triple game)'
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

  /* ---------------------------------------------------------------- */
  /* Persistence                                                       */

  function settings() {
    return {
      variant: $('variant').value,
      difficulty: $('difficulty').value,
      hints: $('opt-hints').checked,
      coach: $('opt-coach').checked,
      mana: $('opt-mana').checked
    };
  }

  function save() {
    if (!Store.available || !G.state) return;
    Store.patch({
      game: Store.serialiseGame(G.state, G.turnStart),
      score: G.score,
      over: G.over,
      log: G.log.slice(0, 60),
      settings: settings()
    });
  }

  function loadSettings() {
    var s = Store.get('settings', null);
    if (!s) return;
    if (s.difficulty) $('difficulty').value = s.difficulty;
    if (s.variant && E.VARIANTS[s.variant]) $('variant').value = s.variant;
    $('opt-hints').checked = s.hints !== false;
    $('opt-coach').checked = s.coach !== false;
    $('opt-mana').checked = !!s.mana;
  }

  function restoreGame() {
    var blob = Store.get('game', null);
    if (!blob) return false;
    var r = Store.deserialiseGame(blob);
    if (!r) return false;

    G.state = r.state;
    G.turnStart = r.turnStart;
    G.state.opts.manaEndsGame = $('opt-mana').checked;
    /* Keep the picker in step with the game we actually restored. */
    $('variant').value = G.state.variantId;

    /* Rebuild the undo history by walking the turn again, so Undo still
       works after a refresh instead of being a button that does nothing. */
    G.undoStack = [];
    if (r.turnStart && r.state.played.length) {
      var walk = E.clone(r.turnStart);
      r.state.played.forEach(function (m) {
        G.undoStack.push(E.clone(walk));
        E.apply(walk, m);
      });
    }
    G.selected = null;
    G.hint = null;
    G.review = null;
    G.busy = false;
    G.score = Store.get('score', { W: 0, B: 0 });
    G.log = Store.get('log', []);

    /* The score was already banked when the game ended, so restore the
       over-flag without running it through checkOver again. */
    var res = E.result(G.state);
    G.over = !!res;
    if (res) {
      flash(res.reason === 'deadlock'
        ? 'This game ended in a dead position — a draw. Start a new game when you are ready.'
        : '<strong>' + (res.winner === E.W ? 'You won' : 'Opponent won') + '</strong> this game. ' +
          'Match score ' + G.score.W + ' – ' + G.score.B + '. Start a new game when you are ready.',
        res.winner === E.W ? 'success' : 'info');
    }
    return true;
  }

  $('btn-roll').addEventListener('click', rollForPlayer);
  $('btn-undo').addEventListener('click', undo);
  $('btn-done').addEventListener('click', endPlayerTurn);
  $('btn-hint').addEventListener('click', showHint);
  $('btn-new').addEventListener('click', newGame);
  $('opt-hints').addEventListener('change', function () { renderPlay(); save(); });
  $('opt-coach').addEventListener('change', function () {
    if (!$('opt-coach').checked) G.review = null;
    else if (G.state && E.legalNow(G.state).length === 0) reviewTurn();
    renderPlay();
    save();
  });
  $('opt-mana').addEventListener('change', function () {
    if (G.state) G.state.opts.manaEndsGame = $('opt-mana').checked;
    save();
  });
  $('difficulty').addEventListener('change', function () { this.blur(); save(); });
  /* Switching game starts a fresh one — the two variants do not share a
     position, and the match score carries over. */
  $('variant').addEventListener('change', function () { this.blur(); newGame(); });

  /* ================================================================ */
  /* Drills                                                           */
  /* ================================================================ */

  var D = { idx: 0, state: null, selected: null, revealed: false, solved: {} };

  function saveProgress() {
    if (!Store.available) return;
    Store.patch({ progress: {
      gameIdx: gameIdx, lessonIdx: lessonIdx, drillIdx: D.idx, solved: D.solved
    } });
  }

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

    var done = Object.keys(D.solved).length;
    $('drill-progress').innerHTML = 'Drill ' + (D.idx + 1) + ' of ' + C.DRILLS.length +
      (done ? ' · <span class="drill-tick">' + done + ' solved</span>' : '');
    $('drill-head').innerHTML = '<strong>' + d.title + '</strong>' +
      (D.solved[D.idx] ? ' <span class="drill-tick">✓</span>' : '');
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
    if (ok) { D.solved[D.idx] = true; saveProgress(); }
    $('drill-verdict').innerHTML = ok
      ? '<div class="flash success"><strong>Correct.</strong> ' + d.why + '</div>'
      : '<div class="flash error"><strong>Not quite.</strong> You played ' +
        s.played.map(moveLabel).join(', ') + '. Try again, or reveal the answer.</div>';
    renderDrill();
  }

  $('drill-reset').addEventListener('click', loadDrill);
  $('drill-check').addEventListener('click', checkDrill);
  $('drill-reveal').addEventListener('click', function () {
    var d = C.DRILLS[D.idx];
    $('drill-verdict').innerHTML = '<div class="flash info"><strong>' + d.model + '</strong><br>' + d.why + '</div>';
  });
  $('drill-prev').addEventListener('click', function () { if (D.idx > 0) { D.idx--; loadDrill(); saveProgress(); } });
  $('drill-next').addEventListener('click', function () { if (D.idx < C.DRILLS.length - 1) { D.idx++; loadDrill(); saveProgress(); } });

  /* ================================================================ */
  /* Boot                                                             */
  /* ================================================================ */

  loadSettings();

  var progress = Store.get('progress', null);
  if (progress) {
    if (typeof progress.gameIdx === 'number')
      gameIdx = Math.min(Math.max(0, progress.gameIdx), C.GAMES.length - 1);
    if (typeof progress.lessonIdx === 'number')
      lessonIdx = Math.min(Math.max(0, progress.lessonIdx), C.GAMES[gameIdx].lessons.length - 1);
    if (typeof progress.drillIdx === 'number')
      D.idx = Math.min(Math.max(0, progress.drillIdx), C.DRILLS.length - 1);
    if (progress.solved && typeof progress.solved === 'object') D.solved = progress.solved;
  }

  buildGameTabs();
  buildToc();
  renderGlossary();

  var resumed = restoreGame();
  if (!resumed) newGame();
  loadDrill();

  var start = location.hash.slice(1);
  show(['learn', 'play', 'drills', 'glossary'].indexOf(start) >= 0 ? start : 'learn');

  /* A game saved mid-AI-turn resumes with the opponent still on move. */
  if (resumed && !G.over && G.state.turn === E.B) setTimeout(aiTurn, 600);

  /* Belt and braces for phones, where the tab is often killed rather
     than closed. */
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { save(); saveProgress(); }
  });
})();
