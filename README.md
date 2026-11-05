# Parth Jadhav: Portfolio Build Brief

This is the brief for building my personal portfolio website. Read it fully, then read `ROADMAP.md` and `CLAUDE.md`, before writing code.

---

## 1. The idea in one line

A **multi-page, animated portfolio that takes the visitor through my journey** (Kolhapur → Android developer → AI/ML at VIT → national-rank ML challenges → research), driven by my core trait, **curiosity**. It has an energetic badminton flavour, smooth page-to-page transitions, a calm neutral colour palette and a **private dashboard** where I can edit everything without touching code.

## 2. Who I am (content source of truth)

| Field | Value |
|---|---|
| Name | Parth Jadhav |
| Title | AI / ML Engineer · M.Sc. AI & ML student at VIT Vellore |
| Location | Kolhapur, India |
| Email | parth.jadhav.3557@gmail.com |
| GitHub | https://github.com/Parth3557 |
| LinkedIn | https://www.linkedin.com/in/parth3557 |
| Phone | **Do not publish anywhere.** The public resume is a cleaned copy with it removed |
| Hobby | Badminton (main hobby, part of the visual identity) |
| Core trait | **Curiosity**: "Curiosity is my biggest strength. It drives me to find out, discover and explore new things." |

### Short bio (editable later in the dashboard)
> I'm an M.Sc. Artificial Intelligence & Machine Learning student at VIT Vellore who builds multimodal deep learning, RAG and LLM applications. Curiosity is what drives me: every project starts with a "why?" and ends with something I can deploy. My multimodal pricing model placed 38th of 9,000+ teams in the Amazon ML Challenge 2025. Off the screen, you'll find me on a badminton court.

### Education
- **M.Sc. Artificial Intelligence & Machine Learning**, Vellore Institute of Technology, Vellore · 2025–2027 · CGPA 8.85/10
- **B.Sc. Computer Science**, Vivekanand College, Kolhapur · May 2023 · CGPA 8.63/10

### Experience
- **Android Developer Intern**, Dropout Technologies LLP, Pune (on-site) · Jun 2023 – Dec 2023
  - Built app modules for data handling and API integration in Kotlin with SQLite
  - Integrated APIs for wireless device communication
  - Debugging, testing and performance optimisation

### Achievements
- **Amazon ML Challenge 2025: All India Rank 38** of 9,000+ teams (multimodal price predictor)
- **Amazon ML Challenge 2026: team rank 91** of 10,000+ active teams (business entity resolution; no public code). Team Dead ReLUs Society, with Manhar Ayyar, Sumit Kothari and Raahul M. Source: [LinkedIn post](https://www.linkedin.com/posts/parth3557_amazonmlchallenge-machinelearning-entityresolution-share-7513685860068990976-7eCE/)
  - Score: F0.5 of 0.989805, which punishes a wrong merge more than a missed match
  - Task: match 1.7 million business records against nearly 10 million noisy records from two other sources (typos, abbreviations, missing addresses, renamed businesses, near-matches that are different businesses)
  - Catch: training data covered only the US and India, but 15% of the test set was unlabeled French records
  - Pipeline: fine-tuned LaBSE retriever (50 candidates per record, captures 99.9% of true matches on validation) → XLM-RoBERTa cross-encoder reranker → LightGBM decision model on 244 features, including features about records competing for the same match. Self-training on the French records, using the most confident predictions as pseudo-labels
- Research paper: *Personalized AI Powered Learning Path Generator* (IET SET conference), with Dr. Vanitha M

### Certifications
- Artificial Intelligence with Python, Friends Union Energising Lives (FUEL), Pune
- Introduction to Cybersecurity Tools & Cyberattacks, Coursera

### Skills (group them visually)
- **AI/ML:** Machine Learning, Deep Learning, Transformers, LLMs, Model Training & Evaluation, Supervised & Unsupervised Learning, Data Science
- **NLP & GenAI:** RAG, FAISS, ChromaDB, BERT, Sentence Transformers, Hugging Face
- **Computer Vision:** Vision Transformer, CNNs/ResNet, YOLO, Grad-CAM
- **Frameworks:** PyTorch, TensorFlow, scikit-learn, Pandas, NumPy
- **Languages:** Python, Java, Kotlin, SQL
- **Tools:** Flask, MySQL, SQLite, Docker, Git, VS Code

### Projects (in display order)

Use the numbers below; they come from the repos and papers. **Don't invent metrics.**

| # | Project | Repo | Visibility | Key facts |
|---|---|---|---|---|
| 1 | **Multimodal Product Price Predictor** ⭐ featured | [multimodal-price-predictor](https://github.com/Parth3557/multimodal-price-predictor) | Public | Amazon ML Challenge 2025, **AIR 38 / 9,000+**. BERT + ViT dual encoder, fusion head, SMAPE loss, AdamW + cosine LR. PyTorch |
| 2 | **AI-Powered Learning Path Generator** ⭐ featured | [ai-learning-path-generator](https://github.com/Parth3557/ai-learning-path-generator) | Public | Knowledge graph + DAG + RAG + XAI. **100% prerequisite satisfaction, 100% retrieval hit rate**, explanation cache 5.06 s → 89.6 ms. Flask, MySQL, ChromaDB, Gemini. IET SET paper |
| 3 | **RAG ML Study Assistant** ⭐ featured | [RAG](https://github.com/Parth3557/RAG) | Public | PyMuPDF + Tesseract OCR ingestion, MiniLM embeddings, FAISS IndexFlatIP, Qwen2.5-7B via HF Inference, Flask, page-cited answers |
| 4 | **Artifact-Robust GI Endoscopy Classifier** | private | **Private: show "Research · paper under review", no code link** | FastViT-SA24 + GRL + DFR, six release gates against shortcut learning. **97.99% accuracy, 97.79% tissue-only**, border-only ≈ chance (24.6%), 5 seeds |
| 5 | **Grassroots Football Talent Analytics** | private | **Private: show "Research · paper under review", no code link** | Low-cost video analytics: YOLO detection, BoT-SORT/ByteTrack/Deep-EIoU tracking, pitch calibration, RTS-smoothed kinematics → player profiles. Flask demo |
| 6 | **NeuroScan: Brain Tumor MRI Classifier** | [brain-cancer-detection](https://github.com/Parth3557/brain-cancer-detection) | Public | From-scratch ResNet-style CNN, **98.07% test accuracy**, Flask app with auth, history, admin dashboard, Gemini summaries. Team project |
| 7 | **Plant Growth Stage Classifier** | [plant-growth-stage-classifier](https://github.com/Parth3557/plant-growth-stage-classifier) | Public | EfficientNet-B0 (92%), ViT (89.75%), ResNet50V2 (94%) compared in one Flask + Docker app |
| 8 | **English Coach (Android)** | [english-coach-android](https://github.com/Parth3557/english-coach-android) | Public | Offline Kotlin app, A1–C2 path, spaced repetition, Vosk offline speech scoring, Gemini speaking coach. Based on MIT-licensed Kotoba |

Pull extra detail (architecture, diagrams, screenshots) from each public repo's README. Copy images into the site's `public/` folder rather than hot-linking GitHub.

### Journey milestones (the spine of the site)
1. **Kolhapur: where curiosity started.** B.Sc. Computer Science, Vivekanand College (graduated May 2023)
2. **First real code in production.** Android Developer Intern, Dropout Technologies, Pune (Jun–Dec 2023)
3. **Going deep into AI.** M.Sc. AI & ML, VIT Vellore (2025 →)
4. **Smash: national stage.** Amazon ML Challenge 2025, AIR 38 / 9,000+
5. **Asking better questions.** Research: learning-path generator paper, GI endoscopy robustness, football analytics
6. **Rally continues.** Amazon ML Challenge 2026, rank 91 / 10,000+ (team)
7. **What's next?** Open to AI/ML roles and internships. Call to action.

I will check the dates in the dashboard; build them as editable data, not hard-coded text.

---

## 3. Look and feel

### Personality
- **Energetic and smooth.** Motion is fast, springy and purposeful, like a badminton rally: quick acceleration, soft landing. Never janky, never slow.
- **Curiosity-led.** Section headings are phrased as questions ("What drives me?", "What have I built?", "Where am I headed?"). Small "?" details reveal hidden facts on hover.
- **Badminton motif.** A **shuttlecock** is the guide: it flies along an SVG path between journey milestones as you scroll, and "smashes" into the achievements section. Court lines are used as subtle grid and dividers.

### Colour palette (neutral, with one energetic accent)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F5F2EC` (warm paper) | `#121211` | page background |
| `--surface` | `#EBE6DC` (sand) | `#1C1B19` | cards |
| `--ink` | `#1C1B19` | `#EDEAE3` | main text |
| `--muted` | `#7A746A` (stone) | `#9C968B` | secondary text |
| `--line` | `#D6CFC2` | `#2E2C28` | borders, court lines |
| `--accent` | `#E4572E` (smash orange) | `#FF6B3D` | links, highlights, the shuttle trail |
| `--accent-2` | `#2F6F5E` (court green) | `#4FA88D` | tags, success states |

Use the **theme-factory / frontend-design** skills to refine this into a full token set. Keep the neutral base and the single strong accent. Include a light/dark toggle.

### Typography
- Display: **"Clash Display"** or **"Space Grotesk"** (bold, sporty) for headings
- Body: **"Inter"** or **"Satoshi"**
- Mono: **"JetBrains Mono"** for small tech tags and metrics

### Motion system
- **Page transitions:** Astro View Transitions (`<ClientRouter />`). Shared elements morph between pages (a project card's image grows into the project page hero).
- **Smooth scroll:** Lenis.
- **Scroll storytelling:** GSAP + ScrollTrigger (pinning, scrub), MotionPathPlugin for the shuttlecock, SplitText for headline reveals.
- **Micro-interactions:** magnetic buttons, cursor follower that turns into a "?" over curious elements, counters that count up (38, 9,000+, 98.07%).
- **Respect `prefers-reduced-motion`.** All motion degrades to simple fades. Content must never depend on animation.
- **Performance budget:** Lighthouse ≥ 90 on Performance, Accessibility, Best Practices and SEO, on mobile. 60 fps scroll. Animate `transform`/`opacity` only.

---

## 4. Pages

| Route | Page | What's on it |
|---|---|---|
| `/` | **Home** | Hero with name + animated title, "Curiosity" statement, journey teaser, 3 featured projects, achievement counters, CTA |
| `/journey` | **Journey** | Full scroll-driven timeline; shuttlecock flies milestone to milestone |
| `/projects` | **Projects** | Filterable grid (All · GenAI/RAG · Computer Vision · Research · Android) |
| `/projects/[slug]` | **Project detail** | Problem → approach → architecture diagram → results → tech → links (or "paper under review" for private ones) |
| `/about` | **About** | Curiosity story, values, badminton section ("lessons from the court"), education, certifications |
| `/experience` | **Experience & Resume** | Internship, achievements, skills matrix, **Download resume (PDF)** |
| `/contact` | **Contact** | Email, LinkedIn, GitHub; a simple form via Formspree/Web3Forms free tier (optional) |
| `/keystatic` | **My dashboard** (private) | Edit every piece of content above |
| `404` | **Not found** | Playful "Out! The shuttle landed outside the court." |

---

## 5. Architecture and hosting (all free)

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro 7** + TypeScript | Static-first and fast; built-in View Transitions for smooth multi-page navigation; islands for interactive parts |
| Styling | **Tailwind CSS** + CSS custom properties for tokens | Fast iteration, consistent tokens, dark mode |
| Animation | **GSAP** (all plugins are free, including ScrollTrigger, SplitText and MorphSVG) + **Lenis** | Best-in-class scroll animation |
| Content | **Keystatic** (git-based CMS) | All content lives as JSON/Markdoc files in the repo |
| Dashboard | **Keystatic admin at `/keystatic`**, GitHub login, **GitHub storage mode** | I edit in a UI, it commits to GitHub, the site redeploys automatically. Only accounts with write access to the repo can log in |
| Hosting | **Vercel (Hobby, free)** with `@astrojs/vercel` adapter | Keystatic's GitHub mode needs Node API routes, which GitHub Pages can't run. Pages stay pre-rendered; only `/keystatic` + `/api/keystatic` run server-side |
| Forms | Web3Forms or Formspree free tier (optional) | No backend needed |
| Analytics | Vercel Web Analytics (free) (optional) | Visitor counts |

**Repo:** create `Parth3557/portfolio` (public). Site URL: `parth3557.vercel.app` (or a custom domain later).

### Keystatic content model
- **Singletons:** `profile` (name, title, bio, curiosity statement, photo, socials, resume PDF upload, availability status), `home` (hero text, featured project picks), `about` (story, values, badminton section), `theme` (accent colour pick, enable/disable heavy animations)
- **Collections:** `projects` (title, slug, summary, problem, approach, results[], tech[], category, repoUrl, isPrivate, status label, featured, order, cover image, gallery, body), `journey` (date, title, place, description, icon, order), `experience`, `education`, `achievements` (title, metric, metricLabel, year), `skills` (group, items[]), `certifications`

---

## 6. Claude Code setup: skills, plugins and MCP

Run these **once** in Claude Code before starting:

```text
# 1. Superpowers: disciplined workflow (brainstorm → plan → build → test → review)
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace

# 2. Anthropic's official skills: frontend-design, webapp-testing, theme-factory, web-artifacts-builder
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills

# 3. GreenSock's official GSAP skills: core, timeline, scrolltrigger, plugins, performance, frameworks
/plugin marketplace add greensock/gsap-skills
```
After step 3, run `/plugin`, open the `gsap-skills` marketplace and install its plugin. Alternative: `npx skills add https://github.com/greensock/gsap-skills`.

Optional MCP servers (fresh library docs and a real browser for visual checks):
```bash
claude mcp add --transport http context7 https://mcp.context7.com/mcp
claude mcp add playwright -- npx @playwright/mcp@latest
```

### Which skill to use when

| Stage | Skill(s) |
|---|---|
| Clarify design before coding | `superpowers:brainstorming` |
| Turn this brief + roadmap into tasks | `superpowers:writing-plans` |
| Build phase by phase | `superpowers:subagent-driven-development` or `superpowers:executing-plans` |
| Visual design, layout, typography | `frontend-design`, `theme-factory` |
| GSAP / ScrollTrigger / MotionPath / SplitText | `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-performance`, `gsap-frameworks` |
| Logic (content loaders, filters, utils) | `superpowers:test-driven-development` |
| Check pages in a real browser, screenshots, mobile | `webapp-testing` + Playwright MCP |
| Bugs | `superpowers:systematic-debugging` |
| Before saying "done" | `superpowers:verification-before-completion`, `superpowers:requesting-code-review` |
| Up-to-date Astro / Keystatic / GSAP / Lenis docs | Context7 MCP |

### Inspiration repos to study (patterns, not copying)
- `withastro/astro`: `examples/portfolio` and the View Transitions docs
- `Thinkmill/keystatic`: Astro templates
- `darkroomengineering/lenis`: smooth scroll and its GSAP integration
- `greensock/GSAP`: ScrollTrigger and MotionPath demos

---

## 7. Kickoff prompt (paste into Claude Code)

> Read `README.md`, `ROADMAP.md` and `CLAUDE.md` in this folder. Use `superpowers:brainstorming` to confirm the design direction with me (show 2 hero concepts first), then `superpowers:writing-plans` to turn ROADMAP.md into a task plan. Build phase by phase. After every phase, run the site, check it in a real browser at desktop and mobile width with `webapp-testing`, and show me screenshots before moving on. Use `frontend-design` and the GSAP skills for all UI and motion work.

---

## 8. Things I still need to provide
- [ ] Profile photo (square, ≥ 800 px) → `public/images/parth.jpg`
- [ ] A badminton photo of me (optional, for the About page)
- [x] Latest resume PDF: in `assets/Parth_Jadhav_Resume.pdf` (copy to `public/resume/`)
- [ ] Confirm journey dates
- [ ] Screenshots for projects whose repos have none
