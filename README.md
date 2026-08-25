# Vortex Tawla

An interactive trainer for **Tawleh** (طاولة), starting with **Mahbooseh** (محبوسة) — the
Levantine trapping game, known elsewhere as Greek *plakoto* or Turkish *mahbusa*.

Twelve lessons, a playable board with a real rules engine and an opponent, a coach that reviews
every turn you play, five graded drills, and a glossary with the Persian-derived dice calls.
Your game, match score and progress survive a refresh.

Styled to match the rest of the Vortex family — the palette and component CSS are ported from
VortexPortal's `hub/templates.py`, the same source Vortex Tension copies.

## Running it

No build step, no dependencies. Either:

```bash
python -m http.server 8777
```

…then open <http://localhost:8777>, or just double-click `index.html` — every script is a
classic `<script>` rather than an ES module specifically so `file://` works.

`.claude/launch.json` defines a `tawla` configuration if you want the preview pane to start the
server for you.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | App shell and the four views |
| `tests.html` | Engine self-tests — open it, it runs on load |
| `assets/css/vortex.css` | Shared Vortex theme, ported from VortexPortal |
| `assets/css/tawla.css` | Board, checkers, dice and app surfaces |
| `assets/js/engine.js` | Mahbooseh rules. Pure, no DOM |
| `assets/js/ai.js` | Position evaluator and the opponent |
| `assets/js/coach.js` | Turn review and pre-move risk warnings |
| `assets/js/store.js` | localStorage persistence |
| `assets/js/board.js` | DOM board renderer |
| `assets/js/content.js` | Lessons, glossary, drills |
| `assets/js/app.js` | Routing, the play loop, drill grading |
| `assets/js/tests.js` | 168 assertions over the engine, the coach and the content |

## How the engine models the board

Points are numbered absolutely, always from White's point of view:

```
13 14 15 16 17 18 | 19 20 21 22 23 24    <- Black's home
12 11 10  9  8  7 |  6  5  4  3  2  1    <- White's home
```

White starts with 15 checkers on point 24 and runs 24 → 1; Black starts on point 1 and runs
1 → 24. Each point is stored as an **array of colours, bottom first**.

That one representation gives pinning for free. Only the contiguous top run of same-coloured
checkers is ever mobile, so a checker with an enemy above it simply generates no moves — which is
exactly what *mahboos* means. It also handles the "sandwich" (you pin the checker that is pinning
yours) without any special case.

Two rules are worth knowing about if you touch the code:

- **Maximal dice usage.** "Play both dice if you can, and if only one is playable play the higher"
  is a property of the whole turn, not of individual moves — playing greedily can strand a die you
  were obliged to use. So `enumeratePlans` generates every terminal move sequence up front and
  keeps only the longest. The UI walks that plan list, which means it can only ever offer you a
  move that keeps a legal maximal line alive.

- **Dead positions.** If each player holds the other's *mana* and has piled their remaining
  checkers onto that same point, neither side can bear off and neither side has a legal move with
  any die — ever. `isDeadlock` detects it and `result()` reports a draw. This is reachable in real
  play and is the cleanest argument for the house rule that scores the mana as an instant double
  loss (toggleable in the Play view).

## The coach

Two things, both built on `AI.evaluate` so the coach and the opponent never disagree:

- **Turn review.** When a turn finishes, the played sequence is scored against the best line that
  was available when the dice were thrown, and the gap is graded (best / good / inaccuracy /
  mistake / blunder) with a reason drawn from what actually changed — pins gained, checkers left
  exposed, the mana taken or given away.

- **Pre-move warnings.** Candidate destinations are flagged before you commit. Ordinary exposure
  is amber; leaving your last checker alone on your own starting point is red, because that is the
  mana and it loses the game outright.

One evaluator note worth keeping in mind if you tune the weights. Ordinary backgammon likes an
anchor in the opponent's home board; Mahbooseh does not, because you cannot be hit there — only
pinned — and you must eventually break the point. The evaluator therefore taxes checkers still
sitting on your own starting point, and prices a lone mother checker as *the chance it gets
pinned* times what the mana is worth, counting every opponent checker still short of that point as
a future shot rather than only the immediate direct shots. Without that last part the engine
happily strands the mother checker early, while the opponent is still out of range.

`tests.js` asserts the evaluator's preferred line agrees with every drill's stated answer, so the
app cannot tell a learner two different things.

## Tests

Open `tests.html`. It covers setup and direction of travel, landing and blocking rules, pinning,
releasing and sandwiching, the maximal-dice and higher-die rules, bear-off including the overshoot
rule and the pinned-checker cases, mana and deadlock detection, scoring, and 40 full self-played
games checked for checker-count drift. It also validates every lesson diagram and drill position
as a legal 15-a-side board, and checks each drill's answer key is actually reachable.

Beyond the rules it covers the coach's grading and risk warnings, the evaluator/drill agreement
described above, hints staying correct mid-turn, and persistence round-trips — including that a
corrupt or unreplayable save is rejected rather than loaded as a broken board.

Current status: **168 passing, 0 failing.**

## Adding the other games

`Fransawiyyeh` (international backgammon, with hitting and a bar) and `Gulbahar` need a different
`canLand` / `applyOn` pair and a different opening, but can reuse the plan enumeration, the board
renderer and the whole app shell. The cleanest seam is to make `engine.js` export a variant object
that supplies `newGame`, `canLand` and `applyOn`, and leave everything else generic.
