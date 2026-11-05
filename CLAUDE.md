# CLAUDE.md: rules for building Parth's portfolio

## Read first
1. `README.md`: content, design, architecture, skills setup
2. `ROADMAP.md`: build phases and their "done when" checks
3. `docs/plan.md` (once created): the current task plan

## Workflow
- Use the **superpowers** workflow: brainstorm → write plan → execute phase by phase → verify → review.
- Use **frontend-design** (and **theme-factory**) for every UI decision. Avoid generic template looks.
- Use the **GSAP skills** (gsap-core, gsap-timeline, gsap-scrolltrigger, gsap-plugins, gsap-performance, gsap-frameworks) for all animation code.
- Use **Context7** for current Astro, Keystatic, GSAP and Lenis APIs instead of relying on memory.
- After each phase: run `npm run build`, open the site in a real browser (`webapp-testing` / Playwright MCP) at 375 px and 1440 px, and show me screenshots. Never say a phase is done without that evidence.
- Commit after each completed task with a clear message. Never force-push `main`.

## Content rules
- **All content comes from Keystatic files.** Don't hard-code bio, projects, dates or metrics in components.
- **Never invent metrics, dates, employers or links.** Use only the numbers in README §2. If something is missing, leave a clear `TODO` in the content file and tell me.
- Private projects (`isPrivate: true`, the GI endoscopy and football analytics projects) must **never** render a repo link. Show "Research · paper under review · code on request".
- Don't publish my phone number anywhere on the site.

## Code rules
- Astro 7 + TypeScript strict + Tailwind. (Moved from Astro 5, whose critical and high security advisories are only fixed in newer majors.) Islands (React) only where interactivity needs them (the Keystatic UI, filters if needed).
- Design tokens live in one place (`src/styles/tokens.css`) and are used through Tailwind.
- Animation: only `transform` and `opacity`; register GSAP plugins once; kill ScrollTriggers and Lenis listeners on `astro:before-swap`; re-init on `astro:page-load`.
- Respect `prefers-reduced-motion` everywhere. Content must be fully readable with JS disabled.
- Accessibility: semantic HTML, alt text, focus states, contrast AA, skip-to-content link.
- Secrets (`KEYSTATIC_*`, form keys) only in `.env` / Vercel env vars, never committed. Keep `.env.example` up to date.
- `/keystatic` must be `noindex` and excluded from the sitemap.
- The public pages are served by GitHub Pages, so they can't rely on response headers or any server code. The dashboard, the editor and the visitor counter run on Vercel. `docs/deploy.md` explains the split.

## Definition of done (every page)
- Builds without warnings, no console errors
- Looks right at 375 / 768 / 1440 px, in light and dark mode
- Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- Works with reduced motion on
- Content editable from the dashboard
