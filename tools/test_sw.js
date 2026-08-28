#!/usr/bin/env node
/* =====================================================================
 * Vortex Tawla — service worker logic tests
 * ---------------------------------------------------------------------
 * sw.js can only really run inside a browser, and not every browser will
 * register one (the embedded preview browser refuses outright). So we
 * load it into a stubbed ServiceWorkerGlobalScope here and drive its
 * install / activate / fetch handlers directly. That covers the routing
 * logic — the part most likely to be wrong and least likely to be
 * noticed, since a mistake only shows up when you are offline.
 *
 *     node tools/test_sw.js
 * ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SW_PATH = path.join(__dirname, '..', 'sw.js');
const ORIGIN = 'http://localhost:8777';

let passed = 0, failed = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { passed++; return; }
  failed++;
  failures.push(name + (detail ? ' — ' + detail : ''));
}
function eq(name, a, b) {
  ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}

/* ---- minimal Fetch API stubs ------------------------------------- */

class Res {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status === undefined ? 200 : init.status;
    this.type = init.type === undefined ? 'basic' : init.type;
  }
  get ok() { return this.status >= 200 && this.status < 300; }
  clone() { return new Res(this.body, { status: this.status, type: this.type }); }
}

class Req {
  constructor(url, init = {}) {
    this.url = new URL(url, ORIGIN + '/').href;
    this.method = init.method || 'GET';
    this.mode = init.mode || 'no-cors';
    this.cache = init.cache;
  }
}

const keyOf = (r) => (typeof r === 'string' ? new URL(r, ORIGIN + '/').href : r.url);

class Cache {
  constructor() { this.map = new Map(); }
  async add(req) {
    const res = await ctx.fetch(req);
    if (!res || !res.ok) throw new Error('bad response for ' + keyOf(req));
    this.map.set(keyOf(req), res);
  }
  async put(req, res) { this.map.set(keyOf(req), res); }
  async match(req) { return this.map.get(keyOf(req)); }
  get size() { return this.map.size; }
}

const stores = new Map();
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Cache());
    return stores.get(name);
  },
  async keys() { return Array.from(stores.keys()); },
  async delete(name) { return stores.delete(name); },
  async match(req) {
    for (const c of stores.values()) {
      const hit = await c.match(req);
      if (hit) return hit;
    }
    return undefined;
  }
};

/* Network stub. `netFail` forces offline; `netMissing` 404s one URL. */
let netFail = false;
let netMissing = null;
let netHits = [];

async function fakeFetch(req) {
  const url = keyOf(req);
  netHits.push(url);
  if (netFail) throw new TypeError('Failed to fetch');
  if (netMissing && url === new URL(netMissing, ORIGIN + '/').href) {
    return new Res('not found', { status: 404 });
  }
  return new Res('NET:' + url, { status: 200, type: 'basic' });
}

/* ---- the stubbed global scope ------------------------------------ */

const handlers = {};
let skipWaitingCalls = 0, claimCalls = 0;

const ctx = {
  console,
  URL,
  TypeError,
  Promise,
  Request: Req,
  Response: Res,
  caches,
  fetch: fakeFetch,
  addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
  skipWaiting: async () => { skipWaitingCalls++; },
  clients: { claim: async () => { claimCalls++; } },
  location: { origin: ORIGIN }
};
ctx.self = ctx;
ctx.globalThis = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SW_PATH, 'utf8'), ctx, { filename: 'sw.js' });

/* ---- event drivers ----------------------------------------------- */

async function fire(type, extra) {
  const waits = [];
  const evt = Object.assign({ waitUntil: (p) => waits.push(p) }, extra);
  for (const fn of handlers[type] || []) fn(evt);
  await Promise.all(waits);
  return evt;
}

async function fireFetch(request) {
  let responded;
  const evt = {
    request,
    respondWith: (p) => { responded = p; },
    waitUntil: () => {}
  };
  for (const fn of handlers['fetch'] || []) fn(evt);
  if (responded === undefined) return { handled: false };
  return { handled: true, response: await responded };
}

const tick = () => new Promise((r) => setImmediate(r));

/* ---- the tests ---------------------------------------------------- */

(async function main() {
  const src = fs.readFileSync(SW_PATH, 'utf8');
  const cacheName = (src.match(/var\s+CACHE\s*=\s*'([^']+)'/) || [])[1];
  const precache = ((src.match(/var\s+PRECACHE\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '')
    .match(/'[^']*'/g).map((s) => s.slice(1, -1));

  ok('sw.js registers install/activate/fetch handlers',
     handlers.install && handlers.activate && handlers.fetch);

  /* -- install -- */
  await fire('install');
  const cache = await caches.open(cacheName);
  eq('install precaches every listed file', cache.size, precache.length);
  ok('install calls skipWaiting', skipWaitingCalls === 1);
  ok('index.html is cached', !!(await cache.match('index.html')));
  ok('the app shell root is cached', !!(await cache.match('./')));

  /* -- install is resilient to one bad entry -- */
  stores.clear();
  netMissing = precache[2];
  await fire('install');
  const partial = await caches.open(cacheName);
  eq('a 404 on one file does not abort the whole install',
     partial.size, precache.length - 1);
  ok('and the rest are still cached', partial.size > 0);
  netMissing = null;

  /* -- activate clears older versions -- */
  stores.clear();
  await caches.open('vortex-tawla-vOLD');
  await fire('install');
  await fire('activate');
  const names = await caches.keys();
  ok('activate drops stale caches', names.indexOf('vortex-tawla-vOLD') === -1, names.join(','));
  ok('activate keeps the current cache', names.indexOf(cacheName) >= 0);
  ok('activate claims open clients', claimCalls === 1);

  /* -- requests it must ignore -- */
  let r = await fireFetch(new Req('/index.html', { method: 'POST' }));
  ok('POST requests are passed through untouched', !r.handled);

  r = await fireFetch(new Req('https://example.com/x.js'));
  ok('cross-origin requests are passed through untouched', !r.handled);

  /* -- navigation: network first -- */
  netFail = false;
  netHits = [];
  r = await fireFetch(new Req('/index.html', { mode: 'navigate' }));
  ok('navigation is handled', r.handled);
  ok('navigation prefers the network', String(r.response.body).startsWith('NET:'),
     String(r.response && r.response.body));

  /* -- navigation offline: falls back to the cached shell --
     Seed a marker first: the online navigation above legitimately stored
     its network response, so without this we would just be reading that
     back and proving nothing. */
  netFail = true;
  const cNav = await caches.open(cacheName);
  await cNav.put('index.html', new Res('SHELL-FROM-CACHE'));
  r = await fireFetch(new Req('/index.html', { mode: 'navigate' }));
  ok('navigation offline still returns a page', r.handled && !!r.response);
  eq('and it comes from the cache', r.response && r.response.body, 'SHELL-FROM-CACHE');

  /* A deep link the cache has never seen must still resolve to the shell,
     otherwise "#play" is a blank page on a train. */
  r = await fireFetch(new Req('/never-visited.html', { mode: 'navigate' }));
  ok('an uncached route offline is handled', r.handled && !!r.response);
  eq('and falls back to the app shell', r.response && r.response.body, 'SHELL-FROM-CACHE');

  /* -- assets: cache first -- */
  netFail = false;
  const c2 = await caches.open(cacheName);
  await c2.put('assets/js/engine.js', new Res('CACHED-ENGINE'));
  r = await fireFetch(new Req('/assets/js/engine.js'));
  ok('a cached asset is served from cache', r.handled && r.response.body === 'CACHED-ENGINE',
     r.response && String(r.response.body));

  await tick();  // background revalidate
  ok('and is refreshed from the network behind the scenes',
     netHits.some((u) => u.endsWith('/assets/js/engine.js')));

  /* -- assets: miss goes to network and is stored -- */
  r = await fireFetch(new Req('/assets/js/brand-new.js'));
  ok('an uncached asset comes from the network',
     r.handled && String(r.response.body).startsWith('NET:'));
  await tick();
  ok('and is added to the cache for next time',
     !!(await c2.match('assets/js/brand-new.js')));

  /* -- assets: offline miss must not throw -- */
  netFail = true;
  r = await fireFetch(new Req('/assets/js/nowhere.js'));
  ok('an uncached asset offline resolves without throwing', r.handled);

  /* -- assets: offline hit --
     Re-seed for the same reason as above: the cache-first test triggered
     a background revalidate that has since replaced the entry. */
  await c2.put('assets/js/engine.js', new Res('CACHED-OFFLINE'));
  r = await fireFetch(new Req('/assets/js/engine.js'));
  ok('a cached asset still works offline', r.handled && !!r.response);
  eq('serving the cached copy', r.response && r.response.body, 'CACHED-OFFLINE');
  netFail = false;

  /* -- a 404 must never be cached as if it were the real file -- */
  netMissing = 'assets/js/gone.js';
  await fireFetch(new Req('/assets/js/gone.js'));
  await tick();
  ok('error responses are not cached', !(await c2.match('assets/js/gone.js')));
  netMissing = null;

  /* -- skip-waiting message -- */
  const before = skipWaitingCalls;
  for (const fn of handlers.message || []) fn({ data: 'skip-waiting' });
  await tick();
  ok('a skip-waiting message activates the new worker', skipWaitingCalls === before + 1);

  /* ---- report ---- */
  console.log('');
  if (failed) {
    console.log('  ' + failures.length + ' FAILED:');
    failures.forEach((f) => console.log('   ✕ ' + f));
  }
  console.log('  service worker: ' + passed + ' passed, ' + failed + ' failed');
  console.log('');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('harness error:', e);
  process.exit(2);
});
