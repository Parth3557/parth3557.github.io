# Putting the site online

All of this is free: GitHub Pages, Vercel Hobby and Turso Free need no card. A custom domain is optional and is the only thing that costs money.

Turn on two-factor sign-in for GitHub, Vercel and Turso first. Those accounts can change the site without going through the dashboard.

## Where everything lives

| Part | Host | Address |
|---|---|---|
| Public pages | GitHub Pages | `https://parth3557.github.io` |
| Dashboard, content editor, visitor counter | Vercel | `https://parth3557.vercel.app` |
| Visitor counts, passkeys, sessions | Turso | Private |

A `github.io` address can only serve GitHub Pages, and GitHub Pages only serves files, so it can't run the dashboard. That's why the site is in two parts. The public pages send visits to Vercel, and Vercel accepts them from the exact address above and from no other site.

## 1. Publish the public pages

Create a **public** repository named exactly `parth3557.github.io` under `Parth3557`. Only that name serves the site from the root of the address, and a free account needs it to be public. Then:

```
git remote add origin https://github.com/Parth3557/parth3557.github.io.git
git push -u origin main
```

In the repository, go to **Settings > Pages** and set **Source** to **GitHub Actions**. From then on, every push to `main` runs `.github/workflows/pages.yml`, which tests and builds the site and publishes it. If a test or the build fails, the last good version stays live.

## 2. Create the database

In the [Turso dashboard](https://app.turso.tech), create a database in **Mumbai** (`aws-ap-south-1`) and an auth token for it. `vercel.json` runs the dashboard in Mumbai too. If you pick another region, change `regions` there to match, because every dashboard request talks to the database several times.

Copy the database URL (it starts with `libsql://`) and the token. Keep the token out of files and chats.

## 3. Create the Vercel project

Import the repository in Vercel and name the project `parth3557`, which gives it the address above. If you use another name, update it in `.env.example` and in step 4.

Add these environment variables before the first deploy:

| Variable | Value | Environments |
|---|---|---|
| `SITE_ORIGIN` | `https://parth3557.vercel.app`, exactly, with no trailing slash | Production and Preview |
| `PUBLIC_SITE_ORIGIN` | `https://parth3557.github.io`, exactly, with no trailing slash | Production and Preview |
| `TURSO_DATABASE_URL` | The `libsql://` address | Production only |
| `TURSO_AUTH_TOKEN` | The token | Production only |

Then deploy. The build stops if `SITE_ORIGIN` is missing. Preview deployments have no database on purpose, so their dashboard stays closed.

## 4. Turn on visitor counting

In the GitHub repository, go to **Settings > Secrets and variables > Actions > Variables** and add `PUBLIC_COLLECT_URL` with the value `https://parth3557.vercel.app/api/collect`. It isn't a secret. Then run **Publish the site** again from the **Actions** tab.

Until this is set, the public pages count nothing and send nothing.

## 5. Create your passkey

In your own terminal, in the project folder, run this one command. Don't paste the output anywhere. The link in it opens your dashboard for 15 minutes.

```powershell
$env:SITE_ORIGIN="https://parth3557.vercel.app"; $env:TURSO_DATABASE_URL="libsql://..."; $env:TURSO_AUTH_TOKEN="..."; npm run dashboard:setup
```

Open the link, create the passkey, then close that terminal window so the token doesn't stay in its environment.

Add a second passkey straight away, such as your phone, from **Security** on the dashboard. Without a backup, losing your device means recovering with `npm run dashboard:setup -- --reset`.

Your dashboard is now at `https://parth3557.vercel.app/dashboard`.

So your own visits aren't counted, open your site once from the dashboard's **View site** link, in each browser you use. The public pages are on another address, so signing in alone can't mark that browser.

## 6. Connect the content editor to GitHub

On Vercel, the editor saves to GitHub instead of local files, so it needs a GitHub App. On GitHub, go to **Settings > Developer settings > GitHub Apps > New GitHub App** and set:

- **Homepage URL:** `https://parth3557.vercel.app`
- **Callback URL:** `https://parth3557.vercel.app/api/keystatic/github/oauth/callback`
- **Request user authorization (OAuth) during installation:** on
- **Expire user authorization tokens:** on
- **Webhook:** off
- **Repository permissions:** Contents read and write, Metadata read, Pull requests read
- **Where can this be installed:** only on this account

Create it, generate a client secret, and install it on the `parth3557.github.io` repository only. Then add these in Vercel, for Production only, and redeploy:

| Variable | Value |
|---|---|
| `KEYSTATIC_GITHUB_CLIENT_ID` | The app's Client ID |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | The client secret |
| `KEYSTATIC_SECRET` | A random string of at least 32 characters |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | The app's name as it appears in its GitHub URL |

Each save makes a commit, and the public pages update a few minutes later.

## 7. Check it on the live site

These couldn't be tested on a local machine, so do them once after the first deploy:

1. **Public pages.** Open `https://parth3557.github.io` and click through every page, including a project. View the page source: the `Content-Security-Policy` tag must be near the top. GitHub Pages can't send custom headers, so that tag is the public pages' only policy.
2. **The two addresses.** `https://parth3557.vercel.app/` and `/journey` must send you to the `github.io` address.
3. **Dashboard headers.** Run `curl -sI https://parth3557.vercel.app/dashboard/login`. The reply must include `content-security-policy`, `strict-transport-security` and `x-frame-options`.
4. **Closed doors.** In a private window, `/dashboard` and `/keystatic` must send you to the sign-in page, and `/api/keystatic/tree` must answer 401.
5. **Sign-in.** Sign in with your passkey.
6. **Editing.** Open the editor from the dashboard, sign in to GitHub, and change one word. A commit should appear on GitHub, and the live site should update a few minutes later. If the browser console reports a blocked address, that address needs adding to the editor's policy in `src/lib/server/guards.ts`.
7. **Counting.** Open the site in a private window. A visitor should appear on the dashboard, with a country.
8. **Resume.** Open `/resume/resume.pdf` and confirm it opens and shows no phone number.

## Later

- **Changing the dashboard's address, including a custom domain.** Update `SITE_ORIGIN` and redeploy, then create new passkeys with `npm run dashboard:setup`. Passkeys are tied to the exact domain, so the old ones stop working. Update `PUBLIC_COLLECT_URL` as well.
- **Changing the public address, including a custom domain.** Update `PUBLIC_SITE_ORIGIN` in Vercel and in `.github/workflows/pages.yml`, and the two redirects in `vercel.json`. Your passkeys keep working.
- **Updating your resume.** Anything uploaded is public, so remove your phone number first. Check the file too, not just the page: this resume also held the number in a hidden `tel:` link and in an embedded `resume.meta.json` attachment.
- **Lost every passkey.** Run the command in step 5 with `npm run dashboard:setup -- --reset`. It removes all passkeys and sessions, then prints a new link.
