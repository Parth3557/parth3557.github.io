# Portfolio Roadmap

Build in this order. **Each phase ends with a working, deployed site.** Don't start the next phase until the current phase's checklist passes and I've seen screenshots.

Estimated total: 8 phases, about 6–10 Claude Code sessions.

---

## Phase 0: Setup and design direction
**Goal:** agreed visual direction before any real code.

- [ ] Install the plugins and MCP servers from README §6
- [ ] `superpowers:brainstorming`: confirm audience (recruiters + research supervisors), tone, page list
- [ ] Using `frontend-design` + `theme-factory`, produce **2 hero concepts** as static HTML mockups (both using the palette in README §3) and let me pick one
- [ ] Lock design tokens: colours (light + dark), type scale, spacing, radius, shadows, motion durations and easings
- [ ] `superpowers:writing-plans`: turn this roadmap into a task plan saved as `docs/plan.md`

**Done when:** I've picked a concept and `docs/plan.md` exists.

---

## Phase 1: Project skeleton and deploy pipeline
**Goal:** an empty but live site.

- [ ] `npm create astro@latest`: TypeScript strict, Tailwind
- [ ] Add `@astrojs/vercel` adapter, `@astrojs/react`, `@astrojs/markdoc`, `@astrojs/sitemap`
- [ ] Base layout: `<head>` SEO component (title, description, Open Graph image, canonical), fonts self-hosted, theme toggle (no flash on load)
- [ ] Global tokens as CSS custom properties, mapped into the Tailwind config
- [ ] Header (logo "PJ" monogram, nav, theme toggle), footer (socials, "Built with curiosity in Kolhapur")
- [ ] Empty routes: `/`, `/journey`, `/projects`, `/about`, `/experience`, `/contact`, `404`
- [ ] Push to `Parth3557/portfolio`, connect the repo to Vercel, confirm preview + production deploys
- [ ] `.gitignore`, `.env.example`, README for the repo

**Done when:** `https://<project>.vercel.app` shows the nav and every route loads.

---

## Phase 2: Content layer and dashboard (Keystatic)
**Goal:** all content comes from editable files, and I can edit it in `/keystatic`.

- [ ] Install `@keystatic/core` + `@keystatic/astro`, create `keystatic.config.ts`
- [ ] Define singletons and collections exactly as in README §5 (profile, home, about, theme, projects, journey, experience, education, achievements, skills, certifications)
- [ ] **Seed all content from README §2** (8 projects, 7 journey milestones, education, internship, achievements, skills, certifications)
- [ ] Typed content loaders (`src/lib/content.ts`) with tests (`superpowers:test-driven-development`): sorting by `order`, featured filter, category filter, private-project handling (no repo link rendered)
- [ ] Start in **local** storage mode and verify editing at `localhost:4321/keystatic`
- [ ] Switch to **GitHub** storage mode: run the Keystatic GitHub App setup, add `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` and `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` to Vercel env vars (never commit them)
- [ ] Verify: edit my bio on the live `/keystatic` → commit appears on GitHub → Vercel redeploys → change is live
- [ ] Add `noindex` to `/keystatic` and exclude it from the sitemap

**Done when:** I can change a project title from my phone and see it live within ~2 minutes.

---

## Phase 3: Pages with real content (no heavy animation yet)
**Goal:** every page complete, responsive and accessible before motion is added.

- [ ] **Home:** hero, curiosity statement, featured projects (3), achievement counters (static numbers for now), journey teaser, CTA
- [ ] **Projects:** grid + category filter (All · GenAI/RAG · Computer Vision · Research · Android), cards with cover, tags and badges ("AIR 38", "Paper under review")
- [ ] **Project detail** `/projects/[slug]`: problem → approach → architecture image → results table → tech → links. Private projects show a "Research · code available on request" panel
- [ ] **Journey:** vertical timeline from the `journey` collection (static version)
- [ ] **About:** curiosity story, values, "Lessons from the court" badminton section, education, certifications
- [ ] **Experience:** internship card, achievements, grouped skills matrix, **Download resume** button
- [ ] **Contact:** email/LinkedIn/GitHub buttons, optional Web3Forms form with spam honeypot
- [ ] **404:** "Out! The shuttle landed outside the court."
- [ ] Responsive at 360, 768, 1024, 1440 px. Keyboard navigation and visible focus. Alt text everywhere. Colour contrast AA

**Done when:** `webapp-testing` screenshots of every page at mobile and desktop look right, and Lighthouse accessibility is ≥ 95.

---

## Phase 4: Motion foundation
**Goal:** the site feels smooth and fluid. (Use the GSAP skills.)

- [ ] Install `gsap` and `lenis`; one `src/lib/motion.ts` that registers plugins, wires Lenis to ScrollTrigger's ticker, and exposes a `prefersReducedMotion` flag
- [ ] **Astro View Transitions** (`<ClientRouter />`): page fade/slide transition; `transition:name` so project card images morph into the detail-page hero
- [ ] Re-init GSAP on `astro:page-load` and clean up on `astro:before-swap` (no duplicate ScrollTriggers after navigation)
- [ ] Headline reveals with SplitText (chars/words, staggered)
- [ ] Section reveal-on-scroll (fade + rise, batched)
- [ ] Count-up counters (38 · 9,000+ · 98.07% · 97.99%)
- [ ] Reduced-motion mode: everything becomes instant or simple opacity fades

**Done when:** navigating Home → Projects → Project → back feels seamless, with no layout jumps and no console errors.

---

## Phase 5: Signature experiences (the "wow")
**Goal:** the personal, energetic moments people remember.

- [ ] **Shuttlecock journey:** on `/journey`, an SVG shuttlecock follows a hand-drawn rally path (MotionPathPlugin, scrubbed by scroll), pausing at each milestone card as it pins in. A light trail in `--accent`
- [ ] **Smash moment:** at the Amazon ML milestone, the shuttle accelerates into a "smash" with a short screen-shake / impact ring, and the AIR 38 counter fires
- [ ] **Curiosity cursor:** a custom cursor follower that becomes "?" over elements with `data-curious`; hovering reveals a hidden fun fact (editable in the dashboard)
- [ ] **Hero:** name assembles letter by letter; subtle court-line grid draws in (DrawSVG-style stroke animation)
- [ ] **Magnetic buttons** and card tilt on hover (desktop only)
- [ ] Horizontal-scroll "Featured projects" strip on Home (pinned section)
- [ ] All signature effects **off on touch devices if they hurt performance**, with an elegant static fallback

**Done when:** the journey page plays smoothly at 60 fps on a mid-range laptop and stays usable on a phone.

---

## Phase 6: Polish, SEO and performance
- [ ] Open Graph images per page (auto-generated with name + page title on the neutral palette)
- [ ] `sitemap.xml`, `robots.txt`, JSON-LD `Person` schema (name, jobTitle, alumniOf, sameAs links)
- [ ] Image optimisation with `astro:assets` (AVIF/WebP, sizes), lazy loading, font preloading
- [ ] Lighthouse mobile ≥ 90 on all four categories; fix any CLS from animations
- [ ] Favicon set from the "PJ" monogram / shuttlecock
- [ ] Optional: Vercel Web Analytics

**Done when:** Lighthouse report screenshots meet the targets on Home, Journey and a project page.

---

## Phase 7: Review and launch
- [ ] `superpowers:requesting-code-review` over the whole codebase
- [ ] Cross-browser check: Chrome, Edge, Firefox, Safari/iOS (via Playwright WebKit)
- [ ] Final content proofread against README §2 (no invented numbers, private projects have no code links, phone number not shown)
- [ ] Update GitHub profile README (`Parth3557/Parth3557`) with a link to the portfolio
- [ ] Add the portfolio link to LinkedIn and the resume

**Done when:** the site is live, I've approved it, and the dashboard works for me.

---

## Later ideas (not in v1)
- Blog / "Curiosity log" collection (short write-ups of things I explored)
- "Ask my portfolio" RAG chatbot over my projects (fits my RAG work), via a serverless function
- Custom domain (e.g. `parthjadhav.dev`)
- Live badminton stats or a mini shuttle game on the 404 page
