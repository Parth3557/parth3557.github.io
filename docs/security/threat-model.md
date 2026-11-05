# Dashboard threat model

Written before the code. The dashboard has one user (the owner), controls what the public site says, and receives data from anyone on the internet. Each row names how it could be attacked, what stops it, and how that is checked.

## What needs protecting

| Asset | Why it matters |
|---|---|
| Control of the dashboard and content editing | An attacker could rewrite the portfolio and damage the owner's reputation |
| Session and passkey data | They grant that control |
| API tokens (Turso, GitHub App, Keystatic secret) | They grant direct access, bypassing the dashboard |
| Visitor data | Visitors' privacy, plus the owner's legal exposure |
| Free-tier quotas | Exhausting them pauses the site |

## Who attacks it

Automated scanners and bots, credential-stuffers, a stranger who finds the URL (the repo is public, so the URL is not a secret), a malicious site the owner visits while signed in, anyone able to send requests to the public visitor endpoint, a compromised npm package, and someone with brief access to the owner's unlocked laptop.

## Threats and defenses

### Getting in

| Threat | Defense | Checked by |
|---|---|---|
| Guessed, stuffed or phished passwords | There is no password. Login is a passkey (Windows Hello or phone), which is bound to the site's origin and can't be typed into a fake site | Browser test with a virtual authenticator |
| Stranger registers their own passkey | Registration needs a one-time, 15-minute setup token, printed only in the owner's terminal and stored hashed. Once signed in, adding a key needs a sign-in from the last 10 minutes | HTTP test |
| Setup link leaks through logs or history | The token is in the URL fragment, which browsers never send to servers | Code review, browser test |
| Passkey response replayed | Challenges are single-use, expire in 5 minutes, are tied to the browser by a cookie, and are deleted atomically when used | HTTP test |
| Cloned authenticator | The signature counter is checked by the WebAuthn library and stored after each login | Library behavior |
| Brute force or flooding of login endpoints | Per-client and global rate limits, stored in the database so they hold across serverless instances | HTTP test |
| Account probing | Errors are generic, and credential IDs are never listed to anonymous visitors | HTTP test |
| Bypassing the login check with encoded paths such as `/%64ashboard` | The middleware normalizes paths before matching, and every protected page and API checks the session again itself | HTTP test |
| Stranger signs the owner out everywhere | Signing out only acts on a valid session. An anonymous request just clears its own cookie and writes nothing | HTTP test |

### Staying in

| Threat | Defense | Checked by |
|---|---|---|
| Session cookie stolen by script | `HttpOnly`, `Secure`, `__Host-` prefix on HTTPS, and a CSP that blocks injected script | HTTP test |
| Stolen session database | Only SHA-256 hashes of tokens are stored | Code review |
| Session left open | 1 hour idle limit and 12 hour absolute limit, enforced on the server. Owner can sign out everywhere | Unit test |
| Session fixation | A new random token is issued at every login | Browser test |
| Stolen session used to add a backdoor passkey | Adding or removing passkeys needs a recent sign-in, and the last passkey can't be removed | HTTP test |

### Abusing a signed-in owner

| Threat | Defense | Checked by |
|---|---|---|
| CSRF | State changes are POST only, the `Origin` must exactly match `SITE_ORIGIN`, cookies are `SameSite=Lax`, and passkey steps use a JSON content type. Private pages use `Referrer-Policy: same-origin`, because `no-referrer` makes browsers send `Origin: null` on form posts | HTTP and browser tests |
| Clickjacking | `frame-ancestors 'none'` and `X-Frame-Options: DENY` | HTTP test |
| Open redirect | Redirects only go to fixed internal paths, and no `next` parameter is accepted | HTTP test |
| A `javascript:` link slipped into the content | Outside links must be https, and repository links must be https on github.com. The content loader refuses anything else, so a bad edit fails the build. The CSP blocks `javascript:` links as well | Unit test |
| **Stored XSS through analytics.** The visitor endpoint is public, so a crafted path or referrer could target the owner's dashboard | Paths must match an allowlist of real routes, referrers are reduced to a validated hostname, all output is auto-escaped, `set:html` is never used, and CSP blocks inline script as a second layer | Unit and browser tests |
| SQL injection | All queries are parameterized | Unit test with hostile input |
| Cached private pages | `Cache-Control: no-store` on dashboard, auth and API responses | HTTP test |
| Host header or forwarded-header spoofing | Security decisions use `SITE_ORIGIN`, never request headers | HTTP test |

### Abusing the public visitor endpoint

| Threat | Defense | Checked by |
|---|---|---|
| Inflating or polluting visitor counts | Same-origin check, per-client rate limit, bot filtering, schema validation, and daily caps on new referrer hosts and page paths | HTTP and unit tests |
| Burning the free quota | Rate limit, 1 KB body cap, early rejection before database writes, and a ceiling of 20,000 counted views a day, which keeps writes under the free plan. Vercel's DDoS protection sits in front. | HTTP and unit tests |
| Oversized or malformed bodies | Size is capped while reading, and parse failures return a plain 400 | HTTP test |

Fake visits can't be fully prevented: a determined attacker can imitate a browser from many addresses. The counts are good indicators, not audited figures.

### Privacy

| Threat | Defense |
|---|---|
| Tracking visitors | No cookies and no fingerprint kept. A daily visitor hash is salted with a random value that is deleted the next day, so visitors can't be linked across days or traced back |
| Storing personal data | Raw IP addresses and user agents are never stored. Only the path, referrer hostname, country code and device class are kept, as daily totals |
| Ignoring opt-outs | Do Not Track and Global Privacy Control are honored in both the browser and the server |

### Secrets and supply chain

| Threat | Defense | Checked by |
|---|---|---|
| Secrets committed to the public repo | `.env*` is git-ignored, secrets exist only in Vercel's settings, and the repo is scanned before commit | Automated check |
| Secrets in browser code | Secrets are read from `process.env` at runtime on the server only, so the build can't inline them, and no secret uses the `PUBLIC_` prefix | Scan of `dist/client` |
| Secrets in the chat or logs | The setup link goes only to the owner's terminal, and errors never echo tokens | Process |
| Malicious npm package | Exact versions, a committed lockfile, install scripts disabled, and `npm audit` | `npm audit` |
| Third-party script compromise | No CDNs or third-party scripts. Fonts and libraries are self-hosted, enforced by CSP. One exception: the content editor is allowed Google Fonts' stylesheet and font files, because Keystatic hard-codes its Inter font. That allows styles and fonts only, and scripts stay same-origin | Browser test |
| Keystatic left in local mode in production | Storage mode is chosen automatically by the Vercel build, and `/keystatic` also requires a dashboard session | Automated check |
| Private project code link leaked | A private project's repo link is removed by the content loader itself | Unit test |
| Phone number in the public resume | The public PDF is a cleaned copy. The visible number, its hidden `tel:` link and the embedded `resume.meta.json` attachment (the resume builder's full data) were all removed, and the file was rebuilt so nothing is left behind. The original stays in the git-ignored `assets/` folder | Two PDF readers plus a scan of every object in the file; HTTP test |
| Private files served by mistake | Only the built `public` files are served. Requests for `.env`, the database and source files, including path traversal spellings, all fail | HTTP test |
| The server tricked into fetching other sites (SSRF) | Astro's image route refuses remote and `file:` addresses, because no outside domains are allowed | HTTP test |

## Risks that remain

- **The owner's device.** Anyone with the unlocked laptop while a session is open has access until it expires. Lock the screen.
- **GitHub account takeover.** Content lives in the repo, so a compromised GitHub account can edit it without touching the dashboard. Turn on 2FA, ideally a passkey.
- **Vercel or Turso account takeover.** Both hold the production secrets. Turn on 2FA for both.
- **Losing every passkey.** Recovery needs the database token, by running the setup script against production. Register a second passkey (your phone) as a backup.
- **The editor's GitHub token.** Keystatic keeps its short-lived GitHub token in a cookie that page scripts can read, because the editor calls GitHub from the browser. That token can change the site's content, and the CSP is what stops an injected script from reaching it.
- **Floods.** A flood against the sign-in routes can use up the shared limit and delay sign-in for up to 15 minutes, though a signed-in session keeps working. A sustained flood could also use up the free function allowance and stop the dashboard and visitor counting until it resets. Vercel's firewall can block a flood by address.
- **A new resume upload isn't checked.** The editor can't look inside an uploaded PDF. The field warns about the phone number, and anything uploaded is public.
- **Not yet checked on a live site.** The public page's headers from `vercel.json`, Keystatic's GitHub storage, passkeys on the real domain and country data can only be tested after the first deploy. `docs/deploy.md` lists those checks.
- **This review isn't independent.** The same author wrote the code and these tests. Have someone else review it before relying on it for anything beyond a portfolio.
- **Platform and browser flaws.** No system can be proven unbreakable. This reduces the risk, and it doesn't remove it.
- **Public email address.** Showing it on the contact section and in the resume will attract some spam. That was a deliberate choice.
