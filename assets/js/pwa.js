/* =====================================================================
 * Vortex Tawla — install and offline plumbing
 * ---------------------------------------------------------------------
 * Everything here is optional: the app must work identically with no
 * service worker at all. In particular registration is skipped on
 * file://, where it is not permitted — opening index.html by
 * double-clicking has to keep working, which is why the app uses classic
 * scripts in the first place.
 * ===================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ---- install prompt -------------------------------------------- */

  var deferred = null;
  var installBtn = $('btn-install');

  window.addEventListener('beforeinstallprompt', function (e) {
    /* Chrome fires this instead of showing its own prompt once the app
       is installable; stash it and offer our own button. */
    e.preventDefault();
    deferred = e;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        installBtn.hidden = true;
      });
    });
  }

  window.addEventListener('appinstalled', function () {
    deferred = null;
    if (installBtn) installBtn.hidden = true;
  });

  /* ---- service worker -------------------------------------------- */

  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;      // not allowed, and not needed

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      /* Tell the user when a new version has been fetched and is waiting,
         rather than silently swapping the app out underneath them. */
      function watch(worker) {
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showToast(reg);
        });
      }
      if (reg.waiting && navigator.serviceWorker.controller) showToast(reg);
      watch(reg.installing);
      reg.addEventListener('updatefound', function () { watch(reg.installing); });
    })['catch'](function (err) {
      console.warn('[pwa] service worker registration failed:', err);
    });

    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  });

  function showToast(reg) {
    var toast = $('sw-toast'), btn = $('sw-reload');
    if (!toast || !btn) return;
    toast.hidden = false;
    btn.onclick = function () {
      toast.hidden = true;
      if (reg.waiting) reg.waiting.postMessage('skip-waiting');
      else location.reload();
    };
  }
})();
