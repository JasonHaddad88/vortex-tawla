/* =====================================================================
 * Vortex Tawla — lesson, glossary and drill content
 * ---------------------------------------------------------------------
 * Diagrams are declared inline as
 *     <div class="diagram" data-spec='{"24":"WW"}' data-cap="..."></div>
 * and hydrated by app.js after the lesson HTML is inserted. The spec is
 * bottom-of-stack first, so "BW" is a Black checker pinned by a White
 * one — see Engine.fromSpec.
 * ===================================================================== */
(function (root) {
  'use strict';

  var FULL_START = '{"24":"WWWWWWWWWWWWWWW","1":"BBBBBBBBBBBBBBB"}';

  var LESSONS = [
    {
      id: 'family',
      title: 'Tawleh and its three games',
      arabic: 'طاولة',
      html: `
<p><strong>Tawleh</strong> (طاولة, "the table") is what the backgammon family is called across
Lebanon, Syria, Jordan and Palestine. You will also hear the board itself called
<strong>shesh besh</strong> (شيش بيش) after the six-five roll.</p>

<p>A session is not one game. Players cycle through three different games on the same board,
with the same 15 checkers each, playing to an agreed number of points — usually 5 or 7:</p>

<ul>
  <li><strong>Fransawiyyeh</strong> (فرنساوية, "the French one") — international backgammon.
      Checkers spread over four points, you <em>hit</em> a lone enemy checker and send it to the bar.</li>
  <li><strong>Mahbooseh</strong> (محبوسة, "the imprisoned one") — no hitting at all. You land
      <em>on top of</em> a lone enemy checker and trap it underneath yours. This is the game you
      are here to learn.</li>
  <li><strong>Gulbahar</strong> (چول بارا, also Gul Bara) — no hitting and no trapping. Both
      players run the same way round the board and it becomes a pure blocking race.</li>
</ul>

<div class="callout cyan">
  <span class="h">Also known as</span>
  Mahbooseh is the same game as Greek <em>plakoto</em>, Turkish <em>mahbusa</em> and Persian
  <em>mahbooseh</em>. If you learn it here you can sit down at a board anywhere from Athens to Tehran.
</div>

<p>Mahbooseh is usually taught first, because there is no bar and nothing ever goes backwards.
Every checker only ever moves forward — but one of yours can be frozen solid for twenty turns,
and that single mechanic is the whole game.</p>
`
    },

    {
      id: 'board',
      title: 'The board and which way you run',
      arabic: 'اللوح',
      html: `
<p>The board has 24 <strong>points</strong> (بيت, <em>beit</em> — "house"), in four quadrants of six.
Throughout this app you are <span style="color:var(--chk-w)">purple</span> and your opponent is
<span style="color:var(--chk-b)">cyan</span>. Points are numbered from your point of view:</p>

<div class="diagram" data-spec='{}' data-cap="An empty board. Your home board is the bottom-right quadrant, points 1 to 6. Your opponent's home is the top-right, points 19 to 24."></div>

<ul>
  <li>You move <strong>from 24 down to 1</strong> — anticlockwise, from the top right, around
      and down into the bottom-right corner.</li>
  <li>Your opponent moves <strong>from 1 up to 24</strong> — the exact mirror.</li>
  <li>Your <strong>home board</strong> (your <em>dar</em>) is points 1–6. Every checker must reach it
      before you may start taking checkers off.</li>
</ul>

<div class="callout">
  <span class="h">Pip count</span>
  A checker on point 8 is 8 pips from being borne off. Add that up over all 15 checkers and you get
  your <strong>pip count</strong> — the total number of dice pips you still have to roll. Both counts
  are shown live in the Play view. Lower is ahead.
</div>
`
    },

    {
      id: 'setup',
      title: 'The setup: everything on one point',
      arabic: 'الترتيب',
      html: `
<p>Here is the first big difference from Fransawiyyeh. There is no spread-out opening position.
<strong>All fifteen of your checkers start stacked on a single point</strong> — your point 24, the
far corner.</p>

<div class="diagram" data-spec='${FULL_START}' data-cap="The Mahbooseh opening. Your 15 checkers on point 24, your opponent's 15 on point 1."></div>

<p>Look carefully at where those two towers sit:</p>

<ul>
  <li>Your stack on point 24 is <strong>inside your opponent's home board</strong> (their 19–24).</li>
  <li>Their stack on point 1 is <strong>inside your home board</strong> (your 1–6).</li>
</ul>

<div class="callout warn">
  <span class="h">Why this matters</span>
  Your starting point is the one square on the board your opponent most wants to occupy — and
  every checker you own has to travel the full 23 points to get home. The last checker to leave
  that corner is the most vulnerable checker in the game. Lesson 8 is about exactly that.
</div>

<p>This position is called <em>diagonally opposed</em>: both towers are on the right-hand half,
one at the top, one at the bottom, each in enemy territory.</p>
`
    },

    {
      id: 'moving',
      title: 'Rolling and moving',
      arabic: 'الرمي',
      html: `
<p>Roll two dice. Each die is one move of that many points, in your direction:</p>

<ul>
  <li>You may move <strong>two different checkers</strong>, one per die.</li>
  <li>Or move <strong>one checker twice</strong> — but each leg is checked separately. The
      intermediate point must be legal for you to land on.</li>
  <li><strong>Doubles</strong> give you four moves of that number, not two.</li>
</ul>

<div class="callout">
  <span class="h">You must use what you can</span>
  If there is any legal way to play both dice, you must play both. If only one die can be played,
  you must play the <strong>higher</strong> one. If nothing at all is legal, you forfeit the turn.
  The Play view enforces this for you — it will only ever offer moves that keep a maximal line alive.
</div>

<p>There is no doubling cube in the traditional Levantine game. The dice are thrown into your own
half of the board; a die that lands cocked or outside is thrown again.</p>
`
    },

    {
      id: 'blocking',
      title: 'Blocked points',
      arabic: 'السد',
      html: `
<p>A point holding <strong>two or more</strong> enemy checkers is closed to you. You cannot land
there, and you cannot pass <em>through</em> it as the middle stop of a two-leg move.</p>

<div class="diagram" data-spec='{"13":"WWWWW","11":"BB","10":"BB","9":"BB","8":"BB","7":"BB","6":"BB","20":"BBB","22":"WWWWWWWWWW"}' data-cap="Six consecutive blocked points, 6 through 11 — a full prime. The purple checkers on 13 cannot move past it with any single die."></div>

<p>Six blocked points in a row is a <strong>prime</strong>. No die from 1 to 6 can jump it, so
anything behind it is stuck until the wall breaks up. In Mahbooseh there is no bar to re-enter
from, so blocking and trapping are the <em>only</em> two ways to interfere with your opponent.</p>

<div class="callout cyan">
  <span class="h">Two checkers is the magic number</span>
  One checker on a point is a target. Two checkers on a point is a wall. Almost every decision in
  this game reduces to that difference.
</div>
`
    },

    {
      id: 'pin',
      title: 'The pin — el-mahbas',
      arabic: 'المحبس',
      html: `
<p>This is the heart of the game. If a point holds <strong>exactly one</strong> enemy checker, you
may land on it. Nothing is sent anywhere — <strong>you sit on top of it</strong>.</p>

<div class="diagram" data-spec='{"9":"B","13":"WWWW","20":"BBBB","4":"WWWW","1":"BBBB","24":"WWWWWWW","21":"BBBBBB"}' data-cap="Before: a lone cyan checker on point 9 — a blot. Purple on 13 can reach it with a 4."></div>

<div class="diagram" data-spec='{"9":"BW","13":"WWW","20":"BBBB","4":"WWWW","1":"BBBB","24":"WWWWWWW","21":"BBBBBB"}' data-cap="After: the cyan checker is mahboos — imprisoned. It is drawn dimmed and crossed, and it cannot move at all."></div>

<p>The rules of a pin:</p>

<ul>
  <li>The trapped checker <strong>cannot move</strong>, at all, for any dice, until every one of
      your checkers has left that point.</li>
  <li>You may pile <strong>more</strong> of your checkers on top. Now the point is both a wall and
      a prison, and the pin survives you moving one checker away.</li>
  <li>The moment your last checker leaves, the enemy checker is free again and moves normally.</li>
  <li>You can never be forced to release it. Only you decide when to leave.</li>
</ul>

<div class="callout warn">
  <span class="h">The real cost of being pinned</span>
  You cannot bear off a single checker until <em>all fifteen</em> of yours are home. A checker
  pinned on point 15 is not just slow — it makes bearing off <strong>impossible</strong> for as
  long as the pin is held. That is how Mahbooseh games are actually won.
</div>

<p>And yes, pins can stack: if your checker is pinned under one of theirs, and theirs is a lone
checker on top, you can land there yourself and pin the jailer. Both checkers are then frozen.</p>
`
    },

    {
      id: 'blots',
      title: 'Blots and how you get caught',
      arabic: 'الفرد',
      html: `
<p>Any lone checker of yours is a <strong>blot</strong>. Before you leave one, count the numbers
that reach it — the <strong>direct shots</strong>.</p>

<div class="diagram" data-spec='{"14":"W","20":"BB","18":"BB","16":"BB","13":"BB","24":"WWWWWWWWWWWWWW","1":"BBBBBBB"}' data-cap="The purple blot on 14. Cyan runs upward, so only the checkers below it can reach: the stack on 13 hits with a 1. The cyan points on 16, 18 and 20 are already past it and can never come back."></div>

<p>Your opponent moves upward, so anything they own on a <em>lower</em> number than your blot can
hit it. A blot six or fewer points ahead of an enemy stack is exposed to a direct number; further
away it needs a combination and is much safer.</p>

<ul>
  <li>A blot exposed to <strong>one</strong> number is hit about 1 time in 3 (11 rolls in 36).</li>
  <li>Exposed to <strong>four</strong> numbers, it is closer to 2 times in 3.</li>
  <li>Doubles reach further than you think — 6-6 covers 24 points in one turn.</li>
</ul>

<div class="callout">
  <span class="h">Move in pairs</span>
  The single most useful habit in Mahbooseh: when you leave a point, try to make both dice land on
  the same square. Two checkers arriving together are a wall. Two checkers landing separately are
  two targets.
</div>

<p>Not every blot is equal. A blot in your <em>own</em> home board, one or two pips from being
borne off, costs you very little if it gets pinned. A blot at the far end of the board can cost
you the entire game.</p>
`
    },

    {
      id: 'mana',
      title: 'The mana — the mother pin',
      arabic: 'المانة',
      html: `
<p>Remember that your fifteen checkers start on point 24, deep inside your opponent's home board.
As you march them out, that tower shrinks: fifteen, ten, five, three, two… and then one.</p>

<p>That last checker sitting alone on your own starting point is the <strong>mana</strong> (المانة,
"the mother"). If your opponent lands on it, you have suffered the worst thing in the game.</p>

<div class="diagram" data-spec='{"24":"WB","23":"BBB","22":"BBB","21":"BBB","20":"BBB","19":"BB","6":"WWWW","5":"WWW","4":"WWW","3":"WW","2":"WW"}' data-cap="Disaster: the last purple checker on 24 has been pinned. It owes 24 pips, it cannot move, and purple can never bear off while cyan holds that point."></div>

<div class="callout warn">
  <span class="h">Why the mana ends games</span>
  That checker is at the maximum possible distance from home and it cannot move. Your opponent has
  no reason to ever leave — the point is in their own home board, exactly where they want their
  checkers anyway. They finish their game at leisure while you sit with fourteen checkers home and
  one hostage.
</div>

<p>Because the position is so nearly hopeless, <strong>many tables score the mana as an immediate
double loss</strong> rather than play it out. Others play on. You can switch this on in the Play
view's settings — but either way, the practical advice is identical:</p>

<ul>
  <li><strong>Never break your starting point down to one checker.</strong> Leave two, or clear the
      whole point in a single turn.</li>
  <li>Plan the exit two or three turns ahead. Getting from three checkers to zero without ever
      passing through one is a dice problem — start it early, while you still have flexibility.</li>
  <li>Conversely: watch your opponent's starting point. Taking <em>their</em> mana is the fastest
      win available to you.</li>
</ul>

<div class="callout cyan">
  <span class="h">The double mana — a genuine draw</span>
  If <em>both</em> players lose their mother checker, neither side can ever bear off. In the
  extreme case — each player piling their remaining fourteen checkers onto the very point where
  they are holding the other's prisoner — <strong>neither player has a legal move with any die,
  ever</strong>, and the game is simply dead. Vortex Tawla detects this and declares a draw.
  It is a real position, and it is the cleanest argument for the house rule: score the mana as an
  immediate double loss and the situation cannot arise.
</div>
`
    },

    {
      id: 'bearoff',
      title: 'Coming home and bearing off',
      arabic: 'التنزيل',
      html: `
<p>Once <strong>all fifteen</strong> of your checkers are in your home board (points 1–6) you may
start taking them off.</p>

<ul>
  <li>A die matching a point's number bears a checker off that point: a 4 takes one off point 4.</li>
  <li>A die <strong>higher</strong> than any point you still occupy bears off from your
      highest occupied point. A 6 with your furthest checker on 4 takes that one off.</li>
  <li>A die lower than your highest point cannot overshoot — you must move within the home board
      instead.</li>
  <li>You may always choose to move a checker inside your home rather than bear one off.</li>
</ul>

<div class="diagram" data-spec='{"5":"W","4":"WWW","3":"WWW","2":"WWWW","1":"WWWW","15":"BBBBB","14":"BBBBB","13":"BBBBB"}' data-cap="All fifteen purple checkers are home and point 6 is empty, so a 6 bears off from point 5 — the highest point still occupied."></div>

<div class="callout warn">
  <span class="h">Two traps specific to Mahbooseh</span>
  A checker of yours that is <em>pinned</em> still counts as a checker that has not come home — so
  a single trapped checker stops bear-off entirely. And a pinned checker sitting inside your own
  home board still blocks overshoot bear-offs from lower points, even though you cannot move it.
</div>

<p>Holding a pin in your own home board is comfortable: you can bear off the checkers stacked on
top, and the prisoner is only released when your very last checker leaves that point — by which
time the game is usually over.</p>
`
    },

    {
      id: 'scoring',
      title: 'Scoring: singles and mars',
      arabic: 'الحساب',
      html: `
<p>The first player to bear off all fifteen checkers wins the game.</p>

<ul>
  <li>An ordinary win is worth <strong>1 point</strong>.</li>
  <li>If the loser has borne off <strong>zero</strong> checkers, it is a <strong>mars</strong>
      (مارس) — a double game, worth <strong>2 points</strong>.</li>
  <li>Where the house plays the mana as an instant loss, it is scored as a mars.</li>
</ul>

<p>Matches run to 5 or 7 points. There is no doubling cube and no backgammon/triple win in the
traditional game — a mars is the maximum.</p>

<div class="callout cyan">
  <span class="h">Practical consequence</span>
  If you are clearly losing, getting <em>one single checker</em> off is worth real points. Stop
  playing for the win and start racing one checker home to save the mars.
</div>
`
    },

    {
      id: 'strategy',
      title: 'How to actually win',
      arabic: 'الخطة',
      html: `
<p>Mahbooseh is a fight between two plans: <strong>race</strong> and <strong>trap</strong>. Read
the pip counts, decide which game you are playing, then play it consistently.</p>

<p><strong>Opening.</strong> Both towers have to unstack, and unstacking creates blots. Move in
pairs. Prefer plays where both dice land on the same point. Get the awkward checkers out of your
starting corner early, while you still have enough of them there to move two at a time.</p>

<p><strong>Middle game.</strong></p>
<ul>
  <li><strong>Pin deep.</strong> A pin in your own home board traps a checker that owes 19–24 pips.
      A pin on point 20 traps one that owes 5. Same mechanic, six times the damage.</li>
  <li><strong>Build your home board</strong> while you wait. Made points there mean an escaping
      enemy checker has nowhere safe to land.</li>
  <li><strong>Never volunteer the mana.</strong> Two on your starting point, or none.</li>
  <li>If you are <em>ahead</em> in the race, simplify — run, avoid contact, take no risks.</li>
  <li>If you are <em>behind</em>, do the opposite. Hold points, wait, and hope for a shot.</li>
</ul>

<p><strong>Holding a pin.</strong> Time it. Every turn you keep a jailer on a point, your other
checkers still have to move somewhere — and eventually you run out of safe moves and are forced to
break the pin at the worst moment. Count how many spare pips you have before you commit.</p>

<p><strong>If you are the one pinned.</strong> Don't panic and don't rush. You cannot free the
checker; only your opponent can. Use the time to stack a strong home board so that when the
release comes, you are ready to punish anything they leave loose.</p>

<div class="callout">
  <span class="h">The one-line version</span>
  Two checkers or none. Pin deep, not shallow. Never leave the mother alone.
</div>
`
    },

    {
      id: 'calls',
      title: 'Calling the dice, and table manners',
      arabic: 'الزهر',
      html: `
<p>Rolls are called aloud, in Persian-derived numbers that are shared across Levantine, Turkish and
Greek tables. The higher number is said first.</p>

<table class="dice-names">
  <thead><tr><th>Face</th><th>Called</th><th>Arabic</th></tr></thead>
  <tbody>
    <tr><td class="face">1</td><td>yek</td><td class="arabic">يك</td></tr>
    <tr><td class="face">2</td><td>du / do</td><td class="arabic">دو</td></tr>
    <tr><td class="face">3</td><td>se</td><td class="arabic">سه</td></tr>
    <tr><td class="face">4</td><td>jahar / chahar</td><td class="arabic">جهار</td></tr>
    <tr><td class="face">5</td><td>benj / penj</td><td class="arabic">بنج</td></tr>
    <tr><td class="face">6</td><td>shesh</td><td class="arabic">شيش</td></tr>
  </tbody>
</table>

<p style="margin-top:1rem">So 6-5 is <strong>shesh-besh</strong>, 6-1 is <strong>shesh-yek</strong>,
3-1 is <strong>se-yek</strong>. Doubles usually take a <em>dou-</em> prefix — 2-2 is
<strong>dubara</strong> (دوبارة), 6-6 is <strong>dou-shesh</strong>, 5-5 is
<strong>dou-benj</strong>.</p>

<div class="callout cyan">
  <span class="h">Regional variation</span>
  These calls drift from city to city and from table to table — Beirut, Damascus and Amman all
  have their own habits, and Turkish tables use <em>düşeş</em>, <em>dübeş</em>, <em>hep yek</em>.
  Nobody will mind if you use the numbers. Learning the calls just means you can follow the game
  being shouted at the next table.
</div>

<p><strong>Manners.</strong> Throw both dice into your own half of the board. A die that lands
cocked, on a checker, or outside the board is thrown again. Do not touch your checkers until you
have decided your whole move; picking a checker up is not binding, but sliding it onto a point and
letting go generally is. And the loser sets the board up for the next game.</p>
`
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Fransawiyyeh — the second game of a session.                        */

  var FR_OPENING = '{"24":"WW","13":"WWWWW","8":"WWW","6":"WWWWW","1":"BB","12":"BBBBB","17":"BBB","19":"BBBBB"}';

  var FR_LESSONS = [
    {
      id: 'fr-what',
      title: 'The French game',
      arabic: 'فرنساوية',
      html: `
<p><strong>Fransawiyyeh</strong> (فرنساوية) is international backgammon — the game the rest of the
world simply calls backgammon. It is the second of the three games in a Tawleh session, and it is
the one most people learn first outside the Levant.</p>

<p>If you have worked through Mahbooseh, four things change:</p>

<ul>
  <li><strong>The setup is spread out.</strong> Instead of one tower of fifteen, your checkers
      start on four different points.</li>
  <li><strong>You hit instead of trapping.</strong> Landing on a lone enemy checker sends it
      <em>off the board</em> to the bar, not underneath yours.</li>
  <li><strong>There is a bar,</strong> and anything on it must come all the way back before its
      owner may move anything else.</li>
  <li><strong>There is a third result.</strong> Beyond the single and the double there is a
      <em>backgammon</em>, worth three.</li>
</ul>

<div class="callout cyan">
  <span class="h">What stays the same</span>
  The direction of travel, the dice, the rule that you must use both numbers if you can, the way
  points are blocked by two or more checkers, and bearing off. Everything you learned about the
  race carries straight over.
</div>
`
    },

    {
      id: 'fr-setup',
      title: 'The setup and the race',
      arabic: 'الترتيب',
      html: `
<div class="diagram" data-spec='${FR_OPENING}' data-variant="fransawiyyeh" data-cap="The Fransawiyyeh opening: two on 24, five on 13, three on 8, five on 6 — and your opponent exactly mirrored."></div>

<p>Reading your own checkers from the far corner: <strong>two on 24, five on 13, three on 8, and
five on 6</strong>. Your opponent's position is the mirror image.</p>

<p>Add it up — 2×24 + 5×13 + 3×8 + 5×6 — and you get <strong>167 pips</strong> each. That number is
worth memorising: it is the reference point every race calculation starts from. The Play view
shows both pip counts live, so you can always see who is ahead.</p>

<div class="callout">
  <span class="h">The names of the points</span>
  Your <strong>midpoint</strong> is 13, the stack of five in enemy territory. Your
  <strong>golden point</strong> is 5 — the single most valuable point on the board to own. The two
  checkers on 24 are your <strong>back checkers</strong>, and getting them home safely is the
  central problem of the opening.
</div>
`
    },

    {
      id: 'fr-hitting',
      title: 'Hitting and the bar',
      arabic: 'الضرب',
      html: `
<p>A point with exactly one checker on it is a <strong>blot</strong>. Land on an enemy blot and you
<strong>hit</strong> it: the checker comes off the board entirely and goes on the <strong>bar</strong>,
the ridge down the middle.</p>

<div class="diagram" data-spec='{"13":"WWWWW","9":"B","8":"WWW","6":"WWWWW","4":"WW","1":"BB","12":"BBBB","17":"BBB","19":"BBBBB"}' data-variant="fransawiyyeh" data-cap="Before: a lone cyan checker on point 9. Purple on 13 hits it with a 4."></div>

<div class="diagram" data-spec='{"13":"WWWW","9":"W","8":"WWW","6":"WWWWW","4":"WW","1":"BB","12":"BBBB","17":"BBB","19":"BBBBB"}' data-bar='{"B":1}' data-variant="fransawiyyeh" data-cap="After: the cyan checker is on the bar, shown in the centre spine. It now owes the full 25 pips."></div>

<div class="callout warn">
  <span class="h">This is the real difference</span>
  In Mahbooseh a trapped checker stays where it is and simply cannot move. In Fransawiyyeh it is
  sent all the way back to the start — it owes <strong>25 pips</strong> again, however far it had
  travelled. Hitting a checker on your own 1-point costs your opponent almost nothing; hitting one
  that was nearly home is devastating.
</div>

<p>So a hit is not just an annoyance, it is the main way of winning the race from behind. And it
cuts both ways: every blot you leave is a chance for your opponent to do the same to you.</p>
`
    },

    {
      id: 'fr-bar',
      title: 'Re-entering, and the closed board',
      arabic: 'الحاجز',
      html: `
<p>While you have a checker on the bar you <strong>may not move anything else</strong>. It must
come back in first, and it re-enters in your opponent's home board — the quadrant you started
from.</p>

<ul>
  <li>A <strong>1</strong> enters on your 24-point, a <strong>2</strong> on your 23, and so on up
      to a <strong>6</strong> on your 19.</li>
  <li>You can only enter on a point that is open: empty, yours, or holding a single enemy checker —
      which you hit on the way in.</li>
  <li>If none of your numbers are open, you forfeit the whole turn. This is called
      <strong>dancing</strong>, and it is exactly as frustrating as it sounds.</li>
  <li>With two dice you must enter both checkers before anything else moves.</li>
</ul>

<div class="diagram" data-spec='{"24":"BB","23":"BB","22":"BB","21":"BB","20":"BB","19":"BBBBB","13":"WWWWW","8":"WWW","6":"WWWWW","4":"W"}' data-bar='{"W":1}' data-variant="fransawiyyeh" data-cap="A closed board. All six of cyan's home points are made, so the purple checker on the bar cannot enter on any number and forfeits every turn until a point opens."></div>

<div class="callout">
  <span class="h">Why the home board matters so much</span>
  Every point you make in your own home board is one fewer number your opponent can enter on. Make
  all six and they cannot move at all until you are forced to break one. That is why "build your
  home board" is the advice behind almost every good Fransawiyyeh move.
</div>
`
    },

    {
      id: 'fr-primes',
      title: 'Points, primes and anchors',
      arabic: 'السد',
      html: `
<p>Two checkers on a point make it yours: the opponent cannot land there or pass through it as the
middle stop of a two-leg move. Six such points in a row make a <strong>prime</strong>, and nothing
can jump it with a single die.</p>

<div class="diagram" data-spec='{"9":"WW","8":"WW","7":"WW","6":"WW","5":"WW","4":"WW","13":"WWW","1":"BBBBB","2":"BBBBB","3":"BBBBB"}' data-variant="fransawiyyeh" data-cap="A full prime from 4 to 9. Every cyan checker is behind it and none of them can get out until purple is forced to break it up."></div>

<p>The mirror of a prime is an <strong>anchor</strong>: a point of your own inside the opponent's
home board. Here the two games disagree sharply.</p>

<div class="callout warn">
  <span class="h">An anchor is good here — and bad in Mahbooseh</span>
  In Fransawiyyeh an anchor is a safe landing square and a base to hit from, so holding your
  24-point or, better, your 20-point is genuinely valuable. In Mahbooseh the same square is a
  liability: you cannot be hit there, only pinned, and you must eventually break the point, which
  is how you lose the mana. Same two checkers, opposite advice. The app's coach knows the
  difference and grades each game on its own terms.
</div>

<p>Practical priorities in the opening: make your <strong>5-point</strong> if you can, make your
<strong>bar point</strong> (7) next, keep your back checkers safe on an anchor until there is
somewhere to run to, and avoid leaving blots your opponent can hit with a direct number.</p>
`
    },

    {
      id: 'fr-scoring',
      title: 'Bearing off, and the three results',
      arabic: 'الحساب',
      html: `
<p>Bearing off works exactly as in Mahbooseh: get all fifteen checkers into your home board, then a
die matching a point's number takes a checker off it, and a die higher than any point you still
occupy takes one off your highest.</p>

<div class="diagram" data-spec='{"6":"WW","5":"WWW","4":"WWW","3":"WWW","2":"WW","1":"WW","19":"BBBBB","20":"BBBBB","21":"BBBBB"}' data-variant="fransawiyyeh" data-cap="All fifteen home and ready to bear off. Cyan is doing the same at the other end — this one is a pure race."></div>

<div class="callout warn">
  <span class="h">One rule that catches people</span>
  If you are hit while bearing off, that checker goes to the bar and must travel all the way round
  again — and you cannot take another checker off until it is home. Leaving a blot in your home
  board while your opponent still has an anchor there loses games that were already won.
</div>

<p>The three results:</p>

<ul>
  <li><strong>Single</strong> — 1 point. The loser got at least one checker off.</li>
  <li><strong>Gammon</strong> — 2 points. The loser bore off nothing.</li>
  <li><strong>Backgammon</strong> — 3 points. The loser bore off nothing <em>and</em> still has a
      checker on the bar or in the winner's home board.</li>
</ul>

<div class="callout cyan">
  <span class="h">Compare with Mahbooseh</span>
  Mahbooseh tops out at the mars, worth two. Fransawiyyeh has the extra tier, which is why
  saving a gammon — racing one checker home when the game is already lost — matters even more here.
</div>
`
    }
  ];

  /* ------------------------------------------------------------------ */

  var GLOSSARY = [
    { t: 'Tawleh', ar: 'طاولة', d: 'The board and the whole family of games played on it. Literally "table".' },
    { t: 'Shesh besh', ar: 'شيش بيش', d: 'Six-five, and by extension a common nickname for the game itself.' },
    { t: 'Mahbooseh', ar: 'محبوسة', d: 'The trapping game taught here. Known elsewhere as plakoto or mahbusa.' },
    { t: 'Mahboos', ar: 'محبوس', d: 'A checker imprisoned under an enemy checker. It cannot move until released.' },
    { t: 'Mana', ar: 'المانة', d: 'The "mother" — your last checker on your own starting point, and the pin that traps it there. Often played as an instant double loss.' },
    { t: 'Fransawiyyeh', ar: 'فرنساوية', d: 'International backgammon, with hitting and the bar. The "French" game.' },
    { t: 'Gulbahar', ar: 'چول بارا', d: 'The third game of a session: no hitting, no trapping, both players run the same way.' },
    { t: 'Mars', ar: 'مارس', d: 'A double game, scored 2 points, when the loser has borne off no checkers.' },
    { t: 'Beit', ar: 'بيت', d: 'A point on the board. Literally "house".' },
    { t: 'Zahr', ar: 'زهر', d: 'The dice.' },
    { t: 'Blot', ar: '—', d: 'A lone checker on a point, exposed to being pinned.' },
    { t: 'Prime', ar: '—', d: 'Six consecutive blocked points. Nothing can jump it with a single die.' },
    { t: 'Pip count', ar: '—', d: 'Total pips you still owe to bring every checker home and off. Lower is winning the race.' },
    { t: 'Direct shot', ar: '—', d: 'A blot within 6 points of an enemy checker, reachable with one die.' }
  ];

  /* ------------------------------------------------------------------ */
  /* Drills. `key` moves must all appear in the player's turn; `avoid`
     lists source points the player must not touch. Every position is a
     legal 15-a-side board — see tests.html. */

  var DRILLS = [
    {
      title: 'Take the mana',
      spec: { 1: 'B', 19: 'BBBB', 20: 'BBBB', 21: 'BBB', 22: 'BBB',
              4: 'W', 6: 'WWW', 8: 'WWW', 10: 'WWW', 13: 'WWW', 24: 'WW' },
      roll: [3, 5],
      q: 'Cyan has left a single checker on point 1 — their own starting point. You roll shesh… no, se-benj (3 and 5). What do you do?',
      key: [{ from: 4, to: 1 }],
      model: 'Play 4→1 with the 3, then 6→1 with the 5.',
      why: 'Point 1 is cyan\'s starting point, so the lone checker there is their mana. Pinning it means that checker owes 24 pips and can never move — cyan cannot bear off a single checker for the rest of the game. Following up with 6→1 puts a second checker on the prison so you keep the pin even when you start moving off.'
    },
    {
      title: 'Never leave the mother alone',
      spec: { 24: 'WW', 18: 'WW', 13: 'WWW', 8: 'WWWW', 6: 'WWWW',
              12: 'BB', 15: 'BB', 20: 'BBB', 21: 'BBB', 22: 'BBB', 23: 'BB' },
      roll: [6, 5],
      q: 'You have two checkers left on your starting point, 24. You roll shesh-besh (6 and 5). Cyan has checkers on 20, 21, 22 and 23. How do you play it?',
      key: [{ from: 24, to: 18 }, { from: 24, to: 19 }],
      model: 'Play 24→18 with the 6 and 24→19 with the 5, clearing point 24 completely.',
      why: 'Moving only one checker off 24 leaves the other alone — and cyan pins it from 23, 22, 21 or 20 with a 1, 2, 3 or 4. That is the mana, and the game. Playing both dice off 24 empties the point entirely, so there is nothing left to pin. The 6 lands safely on your own point at 18; the 5 does leave a blot on 19, but only a 4 from cyan\'s stack on 15 reaches it, and a checker caught on 19 owes 19 pips instead of 24.'
    },
    {
      title: 'Land them together',
      spec: { 24: 'WW', 18: 'WW', 13: 'WWWWW', 11: 'W', 6: 'WWWWW',
              4: 'BBB', 5: 'BBB', 9: 'BBB', 12: 'BBB', 15: 'BBB' },
      roll: [3, 1],
      q: 'You have a loose checker on 11 and you roll se-yek (3 and 1). Cyan holds 4, 5, 9, 12 and 15. Find the only play that leaves you with no blot at all.',
      key: [{ from: 13, to: 10 }, { from: 11, to: 10 }],
      model: 'Play 13→10 with the 3 and 11→10 with the 1, making a new point on 10.',
      why: 'Both dice land on the same empty point, so the loose checker on 11 stops being loose and you gain a wall instead. Every other legal split leaves at least one blot — and cyan\'s stack on 9 bears directly on point 10 with a 1, while 4 and 5 reach it with a 6 and a 5. Making the point is worth more than the extra pips any alternative gains.'
    },
    {
      title: 'The overshoot rule',
      spec: { 5: 'W', 4: 'WWW', 3: 'WWW', 2: 'WWWW', 1: 'WWWW',
              13: 'BBBBB', 14: 'BBBBB', 15: 'BBBBB' },
      roll: [6, 2],
      q: 'All fifteen of your checkers are home, but point 6 is empty. You roll shesh-du (6 and 2). Can you use the 6 at all?',
      key: [{ from: 5, to: 0 }],
      model: 'Yes — bear off from point 5 with the 6, then bear off from point 2 with the 2.',
      why: 'A die larger than any point you still occupy bears off from your highest occupied point. With 6 empty, the 6 takes a checker off point 5. Note that this only works because nothing of yours is on 6 — if a single checker sat there, the 6 would have to take that one instead.'
    },
    {
      title: 'Don\'t release the prisoner',
      spec: { 3: 'BW', 8: 'WWW', 10: 'WWW', 13: 'WWWW', 18: 'WWWW',
              19: 'BBBB', 20: 'BBBB', 21: 'BBB', 22: 'BBB' },
      roll: [2, 1],
      q: 'You have a cyan checker imprisoned on point 3, deep in your home board, under a single checker of yours. You roll du-yek (2 and 1). Where do you play?',
      avoid: [3],
      model: 'Anywhere except point 3 — for example 18→16 and 18→17, or 13→11 and 11→10.',
      why: 'Your checker on point 3 is the only thing holding that prisoner. Move it and the cyan checker is free — and it still owes 22 pips, so cyan is helpless while it stays trapped. The 2 and the 1 are small, awkward numbers precisely designed to tempt you into "tidying up" the home board. Spend them somewhere harmless instead. Keeping spare pips elsewhere is exactly how you avoid being forced to break a pin later.'
    }
  ];

  /* Lessons are grouped by game so the Learn view can switch between
     them; Gulbahar joins this list when its rules go in. */
  var GAMES = [
    { id: 'mahbooseh',    name: 'Mahbooseh',    arabic: 'محبوسة',  lessons: LESSONS },
    { id: 'fransawiyyeh', name: 'Fransawiyyeh', arabic: 'فرنساوية', lessons: FR_LESSONS }
  ];

  root.Content = {
    LESSONS: LESSONS, FR_LESSONS: FR_LESSONS, GAMES: GAMES,
    GLOSSARY: GLOSSARY, DRILLS: DRILLS
  };
})(typeof window !== 'undefined' ? window : globalThis);
