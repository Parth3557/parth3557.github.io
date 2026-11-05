/**
 * The public pages' Content Security Policy, carried in the page because GitHub Pages can't send
 * headers. It matches the header in vercel.json, minus frame-ancestors, which a page can't set.
 * Only the visitor counter's origin is ever added, so a bad address can't widen anything else.
 */
export function publicCsp(collectUrl: string | undefined): string {
  let collector = '';
  try {
    const { protocol, origin } = new URL(collectUrl ?? '');
    if (protocol === 'https:' || protocol === 'http:') collector = ` ${origin}`;
  } catch {
    // Empty or relative: the counter is on this same address, which 'self' already covers.
  }
  return `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'${collector}; base-uri 'none'; form-action 'self'; object-src 'none'`;
}
