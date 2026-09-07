# Vortex Tawla

An interactive trainer for **Tawleh** (طاولة), the Levantine backgammon family.

Two of the three games of a session are playable:

- **Mahbooseh** (محبوسة) — the trapping game, known elsewhere as Greek *plakoto* or Turkish
  *mahbusa*. Twelve lessons.
- **Fransawiyyeh** (فرنساوية) — international backgammon, with hitting, the bar and the
  backgammon triple. Six lessons.
- **Gulbahar** (چول بارا) — not implemented yet; see the note at the end.

A playable board with a real rules engine and an opponent, a coach that reviews every turn, a
game review you can step back through, matches to 5 or 7 points, two-player pass-and-play, five
graded drills, and a glossary with the Persian-derived dice calls. Your game, match score and
progress survive a refresh, and it installs as an offline app.

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
| `assets/css/themes.css` | Every colour token, for all three themes |
| `assets/css/vortex.css` | Shared chrome: layout, controls, accessibility |
| `assets/css/tawla.css` | Board, checkers, dice and app surfaces |
| `assets/js/engine.js` | Mahbooseh rules. Pure, no DOM |
| `assets/js/ai.js` | Position evaluator and the opponent |
| `assets/js/coach.js` | Turn review and pre-move risk warnings |
| `assets/js/review.js` | Per-turn history and match statistics |
| `assets/js/store.js` | localStorage persistence |
| `assets/js/board.js` | DOM board renderer |
| `assets/js/content.js` | Lessons, glossary, drills |
| `assets/js/app.js` | Routing, the play loop, drill grading |
| `assets/js/pwa.js` | Install prompt and service-worker registration |
| `sw.js` | Offline cache |
| `manifest.webmanifest` | Install metadata |
| `tools/make_icons.py` | Regenerates the PNG icons from source |
| `tools/test_sw.js` | 27 service-worker assertions, run under Node |
| `tools/bench_ai.js` | Head-to-head AI strength test with duplicate dice |
| `assets/js/tests.js` | 412 assertions: engine, coach, content, themes, offline setup |

## How the engine models the board

`points` is indexed 1..24 in absolute screen order, always as White sees it:

```
13 14 15 16 17 18 | 19 20 21 22 23 24
12 11 10  9  8  7 |  6  5  4  3  2  1
```

Everything else is expressed in a player's **own** numbering, where 24 is their starting corner and
1 is the last point before they bear off. `variant.own(p, i)` converts absolute to own and
`variant.abs(p, k)` back again — and a checker's own-number **is** its pip count, which is why the
rest of the engine can talk about movement without caring which direction a player travels or
where their home board sits.

That is the seam the games hang off. A variant supplies `own`/`abs`, a `setup`, a `canLand`, and a
`score`, plus the flags `pins` / `hits` / `hasBar`; move generation, the maximal-dice rule, the
plan enumeration, the renderer and the whole app shell are shared. Adding Gulbahar means adding
one more entry — its same-direction travel is just a different `own`/`abs` pair, which is why
those exist rather than a hardcoded direction.

Each point is stored as an **array of colours, bottom first**.

That one representation gives pinning for free. Only the contiguous top run of same-coloured
checkers is ever mobile, so a checker with an enemy above it simply generates no moves — which is
exactly what *mahboos* means. It also handles the "sandwich" (you pin the checker that is pinning
yours) without any special case. In Fransawiyyeh, where you hit rather than pin, a point only ever
holds one colour and the array degenerates to a plain stack.

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

## Themes

Six, switchable from the header, and a theme changes the entire app — banner, background, board,
checkers, dice, buttons, lesson diagrams:

- **Vortex** — the original. Black ground, purple and cyan, neon glow, palette ported from
  VortexPortal.
- **Nova** — brushed silver under glass. A light theme, so the ink inverts to dark text on a bright
  ground; cold electric-blue borders, and the checkers drop colour for graphite and near-black.
- **Atrium** — Nova taken deeper. Smoked grey glass over a dark graphite ground, lit from behind:
  translucent blurred panels, a colder cyan that actually glows, polished chrome and black-glass
  checkers.
- **GTX** — Mono's discipline with a race car's attitude. Carbon black and white, every edge red,
  every surface glossy: glass panels, a specular sheen along the board's top edge, points
  alternating white and red tint. The checkers stay black and white so the sides never depend on
  the red — the dark set just gets a red rim.
- **Mono** — no colour at all. Pure black, white text, shiny black and shiny white checkers where
  the highlight and rim do all the work. Even the status colours are drained to greys.
- **Qahwa** (قهوة) — the coffeehouse table. Walnut frame, points inlaid in two woods, bone and
  dark-walnut checkers, brass fittings.

Renaming a theme keeps working for anyone who already chose it: `THEME_ALIASES` in `app.js` maps
the old id to the new one (and the pre-paint boot script does the same), so a saved `novaplus`
loads as Atrium and is rewritten on the next save rather than silently falling back to Vortex.

Selects are drawn with `appearance: none` and a CSS chevron, because a native `<select>` keeps the
OS chrome and ignores the palette entirely — which is exactly how the theme picker ended up being
the one control that did not follow its own theme.

Every colour in the app comes from a token in `assets/css/themes.css`; **nothing else hardcodes
one**, which is what makes a whole-app reskin a single attribute on `<html>`. Adding a theme means
filling in that file's documented contract and touching nothing else. The choice is saved, and a
tiny inline script in `<head>` applies it before first paint so there is no flash of the default
palette on load. The PWA's `theme-color` follows the theme too, so an installed Nova doesn't sit in
a black system frame.

`tests.html` measures each theme rather than trusting the eye: every token is defined, `--text`,
`--muted` and `--subtle` all clear WCAG AA 4.5:1 on all three surfaces, dice pips are legible, and
the checkers stand out from the board they sit on. That last check earned its keep immediately —
Nova's silver checkers are only 1.8:1 against a silver board and were being given a **white** rim,
which outlined nothing at 1.16:1. Both Nova and Qahwa now let the rim carry the contrast.

## Accessibility

The board was the hard part: visually it is obvious that a purple disc sits on top of a cyan one,
but to a screen reader it was an unnamed `<div>` full of unnamed `<div>`s — nothing to say at all.

- The board is a `grid` with a **roving tabindex**: one tab stop, arrow keys to move between points,
  Enter to pick up and drop. 26 tab stops would be unusable.
- Every point, the bar and both trays announce their contents *and* their state — "Point 9, two of
  your checkers, on top of one opponent's checker trapped underneath. You can move from here."
  Layers are spoken because in Mahbooseh they are the whole game.
- A polite live region narrates rolls, moves, hits, pins, the coach's verdict and the result. The
  opponent's turn is announced once as a summary rather than five times in two seconds, which would
  just lose the earlier lines.
- Focus is restored after every move — the board is rebuilt on each change, so without this a
  keyboard user is thrown back to the top of the page each time they play a checker.
- The two sides are never distinguished by hue alone: the cyan checkers carry an inset ring. Vortex's
  brand purple and cyan sit at only 2.7:1 in luminance, so the ring is doing real work.
- `prefers-reduced-motion` is honoured, focus rings are visible on every surface (the default is
  near-invisible on a dark ground), and there is a skip link.

Verified through the accessibility tree, not by eye. **Not** verified with an actual screen reader —
NVDA is free, and hearing whether the phrasing flows is the obvious next step.

## Naming the two sides

Never by colour. Across the five themes the sides are purple/cyan, graphite/black, bone/walnut and
plain white/black, so any colour word is wrong in most of them. Against the computer they are
**You** and **Opponent**; in two-player mode they are **Player 1** and **Player 2**. Player 1 always
runs 24 → 1. The lessons are written the same way — "your checkers" and "the opponent's" — so the
teaching text stays true whichever theme is on.

## The opening roll

As at a real table: each side throws **one** die, the higher number starts, and the winner plays
those two numbers as their first turn. A tie is thrown again — which is also why the first turn can
never be a double. The two dice are shown captioned with who rolled what before play begins.

## The coach

Two things, both built on `AI.evaluate` so the coach and the opponent never disagree:

- **Turn review.** When a turn finishes, the played sequence is scored against the best line that
  was available when the dice were thrown, and the gap is graded (best / good / inaccuracy /
  mistake / blunder) with a reason drawn from what actually changed — pins gained, checkers left
  exposed, the mana taken or given away.

- **Pre-move warnings.** Candidate destinations are flagged before you commit. Ordinary exposure
  is amber; leaving your last checker alone on your own starting point is red, because that is the
  mana and it loses the game outright.

One evaluator note worth keeping in mind if you tune the weights, because the two games want
opposite things in the same place. **Fransawiyyeh likes an anchor in the opponent's home board** —
it is somewhere safe to land and a base to hit from. **Mahbooseh does not**, because you cannot be
hit there, only pinned, and you must eventually break the point. So under Mahbooseh the evaluator
taxes checkers still sitting on your own starting point, and prices a lone mother checker as *the
chance it gets pinned* times what the mana is worth, counting every opponent checker still short of
that point as a future shot rather than only the immediate direct shots. Without that last part the
engine happily strands the mother checker early, while the opponent is still out of range. Under
Fransawiyyeh those terms are switched off entirely and exposure is priced as *chance of being hit*
times *the pips the blot would lose*, since a hit checker restarts from 25.

`tests.js` asserts the evaluator's preferred line agrees with every drill's stated answer, so the
app cannot tell a learner two different things.

**A caveat worth stating plainly.** The coach grades one-ply: it scores the position each legal way
of playing the roll leads to, with hand-tuned weights, and picks the best. That is enough to catch
real mistakes — it will always spot a missed mana or a blot left in range — but "best play" is a
strong opinion, not a solved answer, and in quiet positions the gap between its top few lines is
mostly noise.

### Why the coach does not search deeper

A two-ply search exists (`AI.searchPlan` / `AI.expectedScore`): for each candidate it plays the
line out, then averages the opponent's best reply over all 21 rolls. It is more accurate about the
*immediate* consequences of a move — it prices blot exposure properly instead of by heuristic —
and it is deliberately **not** used for coaching, for two measured reasons.

**It is not measurably stronger.** `tools/bench_ai.js` plays it head to head against the one-ply
evaluator with duplicate dice — each seed played twice with the sides swapped, so most of the luck
cancels between the halves — and reports a paired z-score. Over 40 pairs (80 Mahbooseh games) the
two-ply search took 55% of games and 59 match points to 45, a mean of **+0.35 points per pair with
a standard error of 0.28: z = 1.26, not significant**. An unpaired 120-game run before that landed
at z ≈ 0.4. So: possibly a small edge, not a demonstrated one, in exchange for up to 800ms of
thinking per move.

Backgammon variance is brutal. Treat anything under a few hundred pairs as inconclusive and run it
yourself before believing a claim in either direction:

```bash
node tools/bench_ai.js 200 mahbooseh
```

**And on Mahbooseh's most important decision it is worse.** Looking one reply ahead is blind past
that reply, and this game's big decisions are long-horizon. On drill 2, keeping two checkers on your
own starting point is perfectly safe for exactly one turn and disastrous three turns later, when you
are forced to break it. Two-ply sees the safe turn, misses the disaster, and keeps the point —
contradicting the drill. At one ply the evaluator's start-point term carries that knowledge as a
heuristic and gets it right. The numbers, from the test suite:

| line | one-ply | two-ply |
| --- | --- | --- |
| clear point 24 (`24→18, 24→19`) | **−73.9** | −92.0 |
| keep it (`8→2, 6→1`) | −81.0 | **−88.8** |

Both behaviours are pinned by tests, so neither can drift unnoticed. Getting past this needs a
deeper search or a proper rollout, not another weight.

## Accessibility

The board is the hard part: it is a pile of `div`s whose entire meaning is carried by colour and
position, so without work it is invisible to a screen reader and unreachable from a keyboard.

**It reads.** Every point, the bar and both trays carry a description of what is actually on them,
and crucially of the *layers* — a screen reader cannot see one checker sitting on another, and in
Mahbooseh that stack is the whole game:

> Point 1, one of your checkers, on top of one of the opponent's checkers trapped underneath

State comes after contents, so exploring the board also tells you what you can do with it: *"You
can move from here"*, *"Legal move, traps a checker"*, *"Legal move, warning: leaves the mana"*.

**It is keyboard-playable.** The board is a `grid` with a roving tabindex — one tab stop for the
whole thing, arrow keys to move between points, Home/End for the ends of a row, Enter to pick a
checker up and to put it down. A full turn needs no mouse. Because the board is rebuilt from
scratch on every change, focus is explicitly restored afterwards; without that the cursor is thrown
back to the top of the page after every single move. Clicking with the mouse moves the keyboard
cursor too, so the two do not fight.

**It narrates.** A polite live region announces rolls, each move (including hits, pins and
releases), the coach's verdict, and the result. The opponent's turn is announced once as a summary
rather than as five separate updates, because a live region that changes five times in two seconds
just loses the first four.

**Other bits.** Skip link; `aria-current` on the active section; `prefers-reduced-motion` honoured;
a visible focus ring drawn as an inset shadow on the points, since an outline on a clipped triangle
gets sliced in half. Cyan checkers carry an inset ring so the two sides are not distinguished by
hue alone. Under Windows High Contrast the checkers would otherwise vanish outright — they are
background gradients — so they opt out of forced colours and fall back to the system's two colours.

One palette deviation was needed: the Portal's `--muted` (`#6b7280`) is 3.8:1 on our darkest
surface and is used for real body text, so it failed WCAG AA. It is `#7c8492` here, which measures
4.85:1. Everything else in the palette already passed.

## Review

Every completed turn is recorded with the position **as it stood when the dice were thrown**, which
is what makes the Review tab a review rather than a list — the board can be redrawn for any turn
without replaying the game. Positions are stored in the same compact bottom-first spec form the
lessons use, so a whole match is a few kilobytes and survives in localStorage.

The tab shows accuracy and total cost for the match, a timeline of your turns coloured by grade
(click a bar to see that position), and the costliest turn called out. Opponent turns are recorded
for context but not graded — except in two-player mode, where both sides are.

## Installing it

Served over http(s) the app is a PWA: it installs to a home screen and works fully offline, which
is the point — a backgammon trainer is most useful on a train. An Install button appears in the
header once the browser reports it is installable, and a toast offers a reload when a new version
has been fetched.

None of that is load-bearing. Service workers are not permitted on `file://`, so registration is
skipped there and the app behaves identically — which is also why it uses classic scripts rather
than modules.

Icons are generated, not committed by hand:

```bash
python tools/make_icons.py
```

That draws the Vortex mark and writes real PNGs using only the standard library (no Pillow), with
edges antialiased from a rounded-rectangle distance field. Re-run it if the brand colours move.

`sw.js` keeps a versioned cache: bump `CACHE` whenever a precached file changes, and the old cache
is dropped on activate. Navigations are network-first so updates land immediately; everything else
is cache-first with a background refresh, so it is fast offline and at most one load stale.

## Tests

Open `tests.html`. It covers setup and direction of travel, landing and blocking rules, pinning,
releasing and sandwiching, the maximal-dice and higher-die rules, bear-off including the overshoot
rule and the pinned-checker cases, mana and deadlock detection, scoring, and 40 full self-played
games checked for checker-count drift. It also validates every lesson diagram and drill position
as a legal 15-a-side board, and checks each drill's answer key is actually reachable.

Beyond the rules it covers the coach's grading and risk warnings, the evaluator/drill agreement
described above, hints staying correct mid-turn, and persistence round-trips — including that a
corrupt or unreplayable save is rejected rather than loaded as a broken board.

It also checks the offline setup: the manifest is valid and every icon it names is a real PNG, and
`sw.js`'s precache list covers every script and stylesheet `index.html` actually loads, with no
entry that 404s. A file missing from that list only shows up as a broken app on a train, which is
the worst possible time to find out.

The service worker itself cannot run in a plain page, and some browsers refuse to register one at
all — the embedded preview browser does. So its routing logic is driven directly under Node
against a stubbed global scope:

```bash
node tools/test_sw.js
```

That covers precaching (including that a single 404 does not abort the whole install), stale-cache
cleanup on activate, cross-origin and non-GET passthrough, network-first navigation with a shell
fallback for deep links, cache-first assets with background revalidation, and that error responses
are never cached as if they were the real file.

Fransawiyyeh has its own group covering the setup (checked against the well-known 167 opening pip
count, which only lands if the geometry is right), hitting and the bar, forced re-entry, the closed
board, bear-off being blocked while anything is on the bar, gammon and backgammon scoring, and 25
self-played games checked for checker drift across the bar.

The review module is covered too: that a recorded position rebuilds to exactly the board it was
taken from, that it survives the JSON round-trip localStorage puts it through, that bar and
borne-off counts are preserved, and that the match statistics do not divide by zero on an empty
history.

The two-ply search is covered as well: that the 21 rolls form a proper probability distribution,
that an exhausted time budget degrades cleanly to the one-ply answer instead of returning a
half-finished average, and — as a pinned, documented divergence — that one ply and two ply disagree
about drill 2 in exactly the way described above.

The spoken board descriptions are covered too — including that a pin is described rather than
implied, that a sandwich names both trapped colours, and that "one of your checkers" stays plural
where "one purple checker" does not.

Current status: **362 browser assertions and 27 service-worker assertions, 0 failing.**

## Still to do: Gulbahar

`Gulbahar` (چول بارا, also Gul Bara) is the third game of a session and is not implemented. The
engine seam is ready for it — both players travel the same way round the board, which is only a
different `own`/`abs` pair — but its rules vary noticeably from table to table, and getting them
wrong in a teaching app is worse than leaving them out. The two points to settle before writing it:

- whether a single enemy checker blocks a point outright (it usually does), and how the
  "no six consecutive points" restriction is applied locally;
- the doubles chain — after rolling doubles you play that number, then continue up through the
  higher doubles, but tables disagree about the conditions and where it stops.
