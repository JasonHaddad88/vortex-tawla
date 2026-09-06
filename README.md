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
| `assets/css/vortex.css` | Shared Vortex theme, ported from VortexPortal |
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
| `assets/js/tests.js` | 214 assertions over the engine, coach, content and offline setup |

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

**A caveat worth stating plainly.** The coach and the opponent are one-ply: they score the
positions each legal way of playing the roll leads to, with hand-tuned weights, and pick the best.
There is no lookahead. That is enough to catch real mistakes — it will always spot a missed mana or
a blot left in range — but "best play" is a strong opinion, not a solved answer, and in quiet
positions the difference between its top few lines is mostly noise. Searching a move deeper
(averaging the opponent's best reply over all 21 dice combinations) is the obvious next
improvement, and would raise the opponent and the coach together.

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

Current status: **326 browser assertions and 27 service-worker assertions, 0 failing.**

## Still to do: Gulbahar

`Gulbahar` (چول بارا, also Gul Bara) is the third game of a session and is not implemented. The
engine seam is ready for it — both players travel the same way round the board, which is only a
different `own`/`abs` pair — but its rules vary noticeably from table to table, and getting them
wrong in a teaching app is worse than leaving them out. The two points to settle before writing it:

- whether a single enemy checker blocks a point outright (it usually does), and how the
  "no six consecutive points" restriction is applied locally;
- the doubles chain — after rolling doubles you play that number, then continue up through the
  higher doubles, but tables disagree about the conditions and where it stops.
