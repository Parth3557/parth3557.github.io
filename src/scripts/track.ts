/**
 * Counts one page view. No cookies, and it respects Do Not Track and Global Privacy Control. Reloads
 * aren't counted, and neither is a browser the owner has signed in from or opened the site from
 * through the dashboard. That mark is the only thing this ever stores, and only the owner gets it.
 */
const privacySignal = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  || navigator.doNotTrack === '1';
const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

// Unset means this same server. Empty means nowhere, for a host with no server behind it.
const collectUrl: string = import.meta.env.PUBLIC_COLLECT_URL ?? '/api/collect';

let isOwner = false;
try {
  // The dashboard can live on another address, so its View site link carries the mark across.
  if (location.hash === '#owner') {
    localStorage.setItem('pj_owner', '1');
    history.replaceState(history.state, '', location.pathname + location.search);
  }
  isOwner = localStorage.getItem('pj_owner') === '1';
} catch {
  // Storage can be refused. That only means this visit is counted.
}

if (collectUrl && !privacySignal && !isOwner && navigation?.type !== 'reload') {
  const body = JSON.stringify({ path: location.pathname, referrer: document.referrer });
  // Not sendBeacon, which always sends cookies, even to another address. By default fetch only does on this one.
  void fetch(collectUrl, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body }).catch(() => {});
}
