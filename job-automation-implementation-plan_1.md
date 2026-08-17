# Job/Internship Discovery Automation — Implementation Plan

## Goal
A free, background, cron-driven system that finds relevant internship/job postings as fast as they come, pushes them to Discord, stays safe on ToS-sensitive platforms (LinkedIn/Naukri/Indeed), filters ghost listings, and includes an outreach layer since board volume alone doesn't convert to interviews for a no-experience candidate.

---

## Approaches considered (and the verdict on each)

| Approach | What it is | Verdict |
|---|---|---|
| Full auto-apply bot (Playwright form-fill everywhere) | Bot fills and submits applications automatically | **Rejected** — reliable only for structured ATS (Greenhouse/Lever), fragile/risky elsewhere. Not worth the account-ban risk on LinkedIn/Naukri. |
| Direct scraping everywhere, all platforms, tight loop | Scrape LinkedIn/Naukri/Indeed frequently | **Rejected as primary channel** — LinkedIn scraping needs an authenticated session and carries real account/ban risk (LinkedIn has litigated scraping before, e.g. the hiQ Labs case). Fine for Naukri/Wellfound (no login needed) at low frequency. |
| Gmail alert-hijack (native job alerts → parsed via Gmail API) | Use each platform's own alert feature, read via email | **Corrected — LinkedIn alerts are NOT instant.** LinkedIn's own docs confirm listings refresh "at least every 24 hours" and alert emails are batched daily, not real-time — and this is structural, not a premium-only limitation (Premium doesn't improve alert speed). Naukri/Indeed alerts are comparatively more usable. **Downgraded from "primary red-tier channel" to a low-effort supplementary feed for LinkedIn**, kept as primary for Naukri/Indeed. |
| Firecrawl + Claude (friend's approach) | Chat-triggered search/scrape/analyze loop | **Adopted selectively** — great for on-demand deep JD-vs-resume analysis, but no built-in scheduling and burns paid credits at automation scale. Not a background system by itself. Repurposed as the fetch layer for hard-to-parse career pages, and as the engine behind an on-demand `/gap` command. |
| Simplify.jobs (free Copilot extension) | Chrome extension | **Corrected — this is an autofill/apply-speed tool, NOT a discovery/alert tool.** It is not true auto-apply either — you still click Submit yourself, it just fills the form faster. Doesn't replace any part of the discovery pipeline. **Adopted only as a separate, optional layer** for speeding up the actual application step once a listing is found. Note: broad "access your data on all websites" permission and an outdated privacy policy — use with that awareness. |
| Tier-1 public APIs (RemoteOK, Himalayas, WWR, Arbeitnow, Greenhouse/Lever JSON, Google Jobs schema) | Official/public structured endpoints | **Adopted — foundation layer.** Zero risk, zero cost, run frequently. |
| Telegram push | Notification channel | **Replaced by Discord per your call** — webhook-based, same free/cron-friendly pattern. |
| Discord webhook / bot with slash commands | Notification + interaction layer | **Adopted.** Webhook for push, stateless HTTP endpoint for slash commands (no always-on process needed). |

**Best overall combination:** Tier-1 public APIs + Naukri/Indeed alert-hijack as the always-on, zero-risk backbone → Firecrawl for the harder-to-parse scrape targets → throttled direct scraping only where login isn't required (Naukri/Wellfound) → ghost-listing filter → LLM relevance scoring → Discord push + slash commands → an outreach layer on top, since that's the actual conversion lever for someone with no experience.

**Honest tradeoff on LinkedIn specifically:** there is no free option that is both fast and safe. Alert-hijack is safe but slow (daily batch, structural). Scraping is fast but carries real account risk. This isn't solvable by picking a better tool — it's a real constraint. **Recommendation: don't over-invest engineering effort in automating LinkedIn discovery.** Treat it as 5-10 min of manual daily browsing using LinkedIn's own "under 10 applicants" filter to surface fresh, low-competition postings yourself — that filter alone captures most of the "early applicant" advantage without any automation risk. Put the automation budget into Tier-1 APIs + Naukri + Indeed + Greenhouse/Lever instead, where speed and safety aren't in conflict.

---

## Architecture

```
GitHub Actions (cron, free)
  ├─ Fast loop (every 30–60 min): Tier 1 public APIs + Gmail alert parser
  ├─ Slow loop (every 3–4 hrs): Naukri/Wellfound scrape (Playwright or Firecrawl)
  └─ On-demand: Discord slash commands → stateless HTTP endpoint (Vercel/Cloudflare free tier)
        ↓
  Dedup (seen_jobs.json, committed back to repo — no DB needed)
        ↓
  Ghost-listing rule filter (age, repost pattern, vague JD, salary width)
        ↓
  LLM relevance + legitimacy scoring (Groq for speed, Gemini Flash for deeper judgment)
        ↓
  Discord webhook push (embeds) + tracker update (Sheet/Notion)
```

---

## Phased build order

**Phase 0 — Infra (one-time)**
- GitHub Actions repo with scheduled workflows
- Discord webhook URL: Server Settings → Integrations → Webhooks → New Webhook → pick channel → copy URL (2 min, no bot invite/token needed for push-only)
- Groq + Gemini Flash API keys (free, no card)
- `seen_jobs.json` in repo for dedup

**Phase 1 — Tier 1 safe sources**
- RemoteOK, Himalayas, WWR, Arbeitnow public JSON APIs
- Greenhouse/Lever public JSON endpoints for target companies
- Ship this alone as a working v1 before anything else

**Phase 2 — Gmail alert-hijack (Naukri/Indeed primary; LinkedIn supplementary only)**
- Set native job alerts in your real accounts (Naukri/Indeed alerts are timely enough to automate; LinkedIn's are daily-batched by design, not worth heavy engineering effort)
- One-time Gmail API OAuth setup, refresh token as GitHub secret
- Parse alert email HTML per sender (cheerio), mark processed
- **LinkedIn: skip automation, do 5-10 min manual daily browsing instead**, using the "under 10 applicants" filter to surface fresh postings — captures the early-applicant advantage without account risk
- **Simplify.jobs (free Copilot extension):** install separately, use it purely to speed up filling out applications once you've found a listing (any source) — it's not part of the discovery pipeline, it's a submission-speed tool

**Phase 3 — Ghost-listing filter**
- Rule-based: posting age, repost frequency, vague JD, salary range width, applicant count
- Tag `⚠️` rather than hard-drop for the first couple weeks, tune thresholds after

**Phase 4 — Relevance scoring + Discord push**
- Groq/Gemini scoring pass against your profile
- Discord embed push, color-coded by risk/confidence

Webhook push implementation (from the cron script, no bot process needed):
```js
await fetch(DISCORD_WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    embeds: [{
      title: `${job.title} @ ${job.company}`,
      description: job.reason,
      url: job.link,
      color: job.risk === "high" ? 0xffcc00 : 0x00cc66,
      fields: [
        { name: "Location", value: job.location, inline: true },
        { name: "Source", value: job.source, inline: true }
      ]
    }]
  })
});
```

**Phase 5 — Yellow-tier scraping (fills gaps)**
- Naukri/Wellfound direct scrape (no login needed), throttled, every 3–4 hrs
- Firecrawl as the fetch layer for harder/JS-heavy career pages — swap in here instead of maintaining raw Playwright, budget-aware since free tier is 1,000 credits/month

**Phase 6 — Discord slash commands** (stateless endpoint, not an always-on bot)

Implementation mechanics: Discord slash commands don't require a persistent bot process. You register an "Interactions Endpoint URL" in the Discord Developer Portal — a stateless HTTP endpoint (hosted free on Vercel or Cloudflare Workers) that Discord POSTs to whenever someone runs a command. The endpoint verifies the request signature (Discord provides a public key for this) and responds. Fits the same free/serverless model as the rest of this pipeline — no server to keep running.

| Command | Purpose |
|---|---|
| `/jobs today` | Pull today's matches on demand |
| `/jobs role:<x>` | Ad hoc filter by role/keyword |
| `/applied <job_id>` | Mark applied, updates tracker |
| `/snooze company:<x>` | Exclude a company going forward |
| `/stats` | Weekly digest — seen, applied, response rate |
| `/gap <job_id>` | On-demand deep resume-vs-JD analysis (this is where Firecrawl+Claude-style reasoning gets used, per-request instead of scheduled) |
| `/search <query>` | One-off search outside the scheduled sweep |
| `/outreach <job_id>` | Draft a short personalized outreach message for the role (see below) |

If you later want reactions (e.g. react ✅ on a message to mark "applied") or a custom bot name/avatar, that needs a real bot identity instead of a plain webhook — still doesn't need an always-on process for sending messages (use the REST API `POST /channels/{id}/messages` with a bot token), but *listening* for reactions does require a persistent gateway connection, which free cron-based hosting doesn't support well. Setup path if you want this later: Developer Portal → New Application → Bot tab → copy token, enable "Message Content Intent" → OAuth2 URL generator (scope `bot`, permission Send Messages) → invite to server.

**Phase 7 — Additions for zero-experience-in-market reality**
These matter more than raw listing volume for converting applications into interviews:

1. **Early-applicant tracking** — deprioritize saturated postings (200+ applicants), surface fresh/low-applicant ones higher in ranking.
2. **Referral/outreach layer** — when a match hits, have the LLM draft a short personalized cold message referencing the specific JD; `/outreach` command surfaces it. This is the highest-ROI addition, since warm intros/fast applies beat cold applying through volume at the internship stage.
3. **Application tracker with real stages** — `seen → applied → OA/interview → rejected/offer`, simple Sheet/Notion sync. You'll want this data within a month to see which sources actually convert.
4. **Deadline extraction** — flag "closes in 2 days" separately from relevance score; campus-hiring-style postings often have deadlines distinct from posting date.
5. **Weekly retro digest (`/stats`)** — real-time pings get tuned out after week one; a rollup is what keeps you actually using the system months in.
6. **Auto-scaffold prep docs on "applied"** — since you already build company-specific interview prep (EKLAVYA/IdeaRoom style docs), trigger a prep-doc stub (company, role, JD skills extracted) the moment something moves to "applied," so prep is half-done by the time a call comes in.

---

## What to build first, this week
Phase 0 + Phase 1 + Discord push. That alone is a working, safe, useful bot. Layer in Phase 2 (Gmail alerts) next for the biggest coverage jump, then Phase 3–4 (filtering/scoring) to make the output high-signal, then Phase 5–7 as the system matures.
