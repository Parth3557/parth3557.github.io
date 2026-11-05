/**
 * Counts one page view. No cookies and nothing stored in the browser, and it respects Do Not Track
 * and Global Privacy Control. Reloads aren't counted, and neither is a browser the owner has signed
 * in from.
 */
const privacySignal = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  || navigator.doNotTrack === '1';
const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

let isOwner = false;
try {
  isOwner = localStorage.getItem('pj_owner') === '1';
} catch {
  // Storage can be refused. That only means this visit is counted.
}

if (!privacySignal && !isOwner && navigation?.type !== 'reload') {
  const body = JSON.stringify({ path: location.pathname, referrer: document.referrer });
  navigator.sendBeacon('/api/collect', new Blob([body], { type: 'application/json' }));
}
