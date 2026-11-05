// Runs before the first paint, so the page never flashes the wrong theme. An external file, so the
// Content Security Policy can forbid inline scripts.
(function () {
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  root.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.classList.add('js', 'js-wait');
  // The scroll layout is there from the first paint, so nothing jumps and the images below stay lazy.
  if (root.dataset.animations === 'full' && !matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('motion');
  // If the page's script never arrives, fall back to the plain, readable page.
  setTimeout(function () {
    root.classList.remove('js-wait');
    if (!root.dataset.ready) root.classList.remove('motion');
  }, 3500);

  // Page changes: a project's cover grows from its card into its page, and back again.
  // These two events have to be listened for before the page first renders, which is why they're here.
  if (!('onpagereveal' in window)) return;
  var NAME = 'project-cover';
  var slugIn = function (url) {
    var match = url && new URL(url).pathname.match(/^\/projects\/([a-z0-9-]+)\/?$/);
    return match ? match[1] : null;
  };
  var onScreen = function (el) {
    var box = el.getBoundingClientRect();
    return box.width > 0 && box.bottom > 0 && box.top < innerHeight;
  };
  var coverFor = function (slug) {
    var selector = '[data-cover="' + slug + '"]';
    var inPanel = document.querySelector('dialog[open] ' + selector);
    if (inPanel) return inPanel;
    var all = document.querySelectorAll(selector);
    for (var i = 0; i < all.length; i++) if (onScreen(all[i])) return all[i];
    return null;
  };
  var name = function (el, transition) {
    if (!el) return;
    var clear = function () { el.style.viewTransitionName = ''; };
    el.style.viewTransitionName = NAME;
    // A browser can abort a transition at any point. The page just changes without it.
    transition.finished.then(clear, clear);
  };
  var hero = function () { return document.querySelector('[data-cover-hero]'); };
  var prepare = function (event) {
    if (!event.viewTransition) return false;
    event.viewTransition.ready.catch(function () {});
    if (root.dataset.animations === 'full') return true;
    event.viewTransition.skipTransition();
    return false;
  };

  addEventListener('pageswap', function (event) {
    if (!prepare(event)) return;
    var to = event.activation && event.activation.entry && event.activation.entry.url;
    var slug = slugIn(to);
    name(hero() || (slug && coverFor(slug)), event.viewTransition);
  });
  addEventListener('pagereveal', function (event) {
    if (!prepare(event)) return;
    var from = window.navigation && navigation.activation && navigation.activation.from && navigation.activation.from.url;
    var slug = slugIn(from);
    name(hero() || (slug && coverFor(slug)), event.viewTransition);
  });
})();
