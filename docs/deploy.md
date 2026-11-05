# Putting the site online

All of this is free: Vercel Hobby, Turso Free and GitHub need no card. A custom domain is optional and is the only thing that costs money.

Only you can do these steps, because they use your own accounts. Turn on two-factor sign-in for GitHub, Vercel and Turso first. Those accounts can change the site without going through the dashboard.

## 1. Push the code

Create a public repository named `portfolio` under `Parth3557`, then:

```
git remote add origin https://github.com/Parth3557/portfolio.git
git push -u origin main
```

The name matters: `keystatic.config.ts` points at `Parth3557/portfolio`.

## 2. Create the database

In the [Turso dashboard](https://app.turso.tech), create a database and an auth token for it. Copy the database URL (it starts with `libsql://`) and the token. Keep the token out of files and chats.

## 3. Create the Vercel project

Import the repository in Vercel. Pick the project name first, because it decides the address: `https://<name>.vercel.app`.

Add these environment variables before the first deploy:

| Variable | Value | Environments |
|---|---|---|
| `SITE_ORIGIN` | `https://<name>.vercel.app`, exactly, with no trailing slash | Production and Preview |
| `TURSO_DATABASE_URL` | The `libsql://` address | Production only |
| `TURSO_AUTH_TOKEN` | The token | Production only |

Then deploy. The build stops if `SITE_ORIGIN` is missing. Preview deployments have no database on purpose, so their dashboard stays closed.

## 4. Create your passkey

In your own terminal, in the project folder, run this one command. Don't paste the output anywhere. The link in it opens your dashboard for 15 minutes.

```powershell
$env:SITE_ORIGIN="https://<name>.vercel.app"; $env:TURSO_DATABASE_URL="libsql://..."; $env:TURSO_AUTH_TOKEN="..."; npm run dashboard:setup
```

Open the link, create the passkey, then close that terminal window so the token doesn't stay in its environment.

Add a second passkey straight away, such as your phone, from **Security** on the dashboard. Without a backup, losing your device means recovering with `npm run dashboard:setup -- --reset`.

Your dashboard is now at `https://<name>.vercel.app/dashboard`.

## 5. Connect the content editor to GitHub

On Vercel, the editor saves to GitHub instead of local files, so it needs a GitHub App. On GitHub, go to **Settings > Developer settings > GitHub Apps > New GitHub App** and set:

- **Homepage URL:** `https://<name>.vercel.app`
- **Callback URL:** `https://<name>.vercel.app/api/keystatic/github/oauth/callback`
- **Request user authorization (OAuth) during installation:** on
- **Expire user authorization tokens:** on
- **Webhook:** off
- **Repository permissions:** Contents read and write, Metadata read, Pull requests read
- **Where can this be installed:** only on this account

Create it, generate a client secret, and install it on the `portfolio` repository only. Then add these in Vercel, for Production only, and redeploy:

| Variable | Value |
|---|---|
| `KEYSTATIC_GITHUB_CLIENT_ID` | The app's Client ID |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | The client secret |
| `KEYSTATIC_SECRET` | A random string of at least 32 characters |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | The app's name as it appears in its GitHub URL |

## 6. Check it on the live site

These couldn't be tested on a local machine, so do them once after the first deploy:

1. **Security headers.** Run `curl -sI https://<name>.vercel.app/`. The reply must include `content-security-policy`, `strict-transport-security` and `x-frame-options`. They come from `vercel.json`. If they're missing, the public page has lost a layer of protection, so fix that before sharing the link.
2. **Closed doors.** In a private window, `/dashboard` and `/keystatic` must send you to the sign-in page, and `/api/keystatic/tree` must answer 401.
3. **Sign-in.** Sign in with your passkey.
4. **Editing.** Open the editor from the dashboard, sign in to GitHub, and change one word. A commit should appear on GitHub, and the live site should update about a minute later. If the browser console reports a blocked address, that address needs adding to the editor's policy in `src/lib/server/guards.ts`.
5. **Counting.** Open the site in a private window. A visitor should appear on the dashboard, with a country.
6. **Resume.** Open `/resume/resume.pdf` and confirm it opens and shows no phone number.

## Later

- **Changing the address, including a custom domain.** Update `SITE_ORIGIN` and redeploy, then create new passkeys with `npm run dashboard:setup`. Passkeys are tied to the exact domain, so the old ones stop working.
- **Updating your resume.** Anything uploaded is public, so remove your phone number first. Check the file too, not just the page: this resume also held the number in a hidden `tel:` link and in an embedded `resume.meta.json` attachment.
- **Lost every passkey.** Run the command in step 4 with `npm run dashboard:setup -- --reset`. It removes all passkeys and sessions, then prints a new link.
