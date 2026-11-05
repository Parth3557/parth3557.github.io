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
})();
