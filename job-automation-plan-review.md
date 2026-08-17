# Job/Internship Discovery Bot — Implementation Plan (v2)

> **Philosophy:** Ship Phase 1 in 2 days, start applying. Add features only when the current phase creates a real bottleneck. No over-engineering.

---

## What's changed from v1

| v1 Plan | v2 Plan | Why |
|---|---|---|
| Firecrawl (1,000 credits/month) | **Jina Reader** (free, no credits) | Firecrawl burns out in days of scraping |
| `seen_jobs.json` committed to git | **Upstash Redis** (500k cmds/month free) | Git isn't a DB; file bloats, causes merge conflicts |
| Gmail alert parser in Phase 2 | **Pushed to Phase 2, built after you apply to 50 jobs** | Takes 2-3 days to build, gives marginal early value |
| 7 phases | **2 phases to start** | You need jobs, not a perfect bot |
| 30-60 min cron loop | **Every 2 hours** | APIs update hourly at best; saves Actions minutes |

---

## Tool Stack (all free, no credit card)

| Tool | Purpose | Free Tier |
|---|---|---|
| **GitHub Actions** | Cron scheduler | 2,000 min/month (public repo = unlimited) |
| **Discord Webhook** | Push notifications | Unlimited, free |
| **Upstash Redis** | Dedup store | 500,000 cmds/month |
| **Groq API** | LLM relevance scoring | 14,400 req/day (Llama 3.1 8B), no card |
| **Jina Reader** | On-demand JD fetching (future `/gap`) | Free API key, generous RPM |
| **RemoteOK / Himalayas / Arbeitnow / WWR** | Job data | Free public APIs, no auth |
| **Greenhouse / Lever JSON** | Target company listings | Free public JSON endpoints |

**Monthly cost: $0.**

---

## Dedup Strategy — Upstash Redis

Instead of a file in git, every job gets a unique ID (`source:job_id` or `hash(title+company+date)`).

```js
// Check if seen and mark atomically
const isNew = await redis.sadd("seen_jobs", jobId); // returns 1 if new, 0 if seen
if (isNew === 0) continue; // already pushed to Discord, skip
```

- **SADD** is 1 command per job check. At 50 jobs × 12 runs/day × 30 days = **18,000 cmds/month** — well inside the 500k free limit.
- No git bloat. No merge conflicts. TTL can auto-expire old entries after 90 days.
- Setup: sign up at [upstash.com](https://upstash.com) → Create Database → copy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

---

## Phase 0 — One-Time Setup (⏱️ ~1 hour)

### 1. GitHub Repository
- Create a **public** repo (required for unlimited Actions minutes on free tier)
- Add a `.github/workflows/bot.yml` (created in Phase 1)

### 2. Discord Webhook
```
Your Discord Server → Settings → Integrations → Webhooks → New Webhook
→ Pick channel (e.g. #job-alerts) → Copy Webhook URL
```
No bot, no invite, no token. Just a URL.

### 3. API Keys (all free, no card)
| Key | Where to get |
|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → Sign up → API Keys |
| `UPSTASH_REDIS_REST_URL` | [upstash.com](https://upstash.com) → Create DB → REST API tab |
| `UPSTASH_REDIS_REST_TOKEN` | Same page as above |
| `JINA_API_KEY` (optional now) | [jina.ai](https://jina.ai) → Sign up → free key (for Phase 3+) |

### 4. GitHub Secrets
```
Repo → Settings → Secrets and Variables → Actions → New repository secret
```
Add: `DISCORD_WEBHOOK_URL`, `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### 5. Your target companies list
Create a file `companies.json` in the repo:
```json
[
  { "name": "Stripe", "greenhouse": "stripe" },
  { "name": "Linear", "lever": "linear" },
  { "name": "Vercel", "lever": "vercel" },
  { "name": "Notion", "greenhouse": "notion" }
]
```
Add/remove companies as you research. Greenhouse URL format: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
Lever URL format: `https://api.lever.co/v0/postings/{slug}?mode=json`

---

## Phase 1 — Tier-1 APIs + Discord Push (⏱️ ~1 day of building)

### What it does
Every 2 hours, GitHub Actions runs a script that:
1. Fetches jobs from public APIs
2. Fetches your target companies' Greenhouse/Lever boards
3. Deduplicates via Upstash Redis
4. Filters by keywords and ghost-listing rules
5. Scores relevance via Groq
6. Pushes color-coded embeds to Discord

### Data sources (all free, no scraping)

| Source | Endpoint | What you get |
|---|---|---|
| RemoteOK | `https://remoteok.com/api` | Remote roles, JSON, no auth |
| Himalayas | `https://himalayas.app/jobs/api?q=intern` | Remote roles, filtered |
| Arbeitnow | `https://www.arbeitnow.com/api/job-board-api` | EU + Remote, good for dev roles |
| We Work Remotely | RSS feed `https://weworkremotely.com/remote-jobs.rss` | Parse with rss-parser |
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{company}/jobs` | Direct from ATS, reliable |
| Lever | `https://api.lever.co/v0/postings/{company}?mode=json` | Direct from ATS, reliable |

### Keyword filter (tune to your profile)
```js
const KEYWORDS = ["intern", "internship", "junior", "entry-level", "fresher", "graduate"];
const ROLES = ["software", "frontend", "backend", "fullstack", "python", "node", "react"];
const EXCLUDE = ["senior", "staff", "principal", "lead", "10+ years", "8+ years"];

function matches(job) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const hasRole = ROLES.some(r => text.includes(r));
  const hasLevel = KEYWORDS.some(k => text.includes(k));
  const isExcluded = EXCLUDE.some(e => text.includes(e));
  return hasRole && hasLevel && !isExcluded;
}
```

### Ghost-listing filter (rule-based, no LLM needed)
```js
function isGhost(job) {
  const postedDate = new Date(job.date || job.updated_at);
  const ageDays = (Date.now() - postedDate) / (1000 * 60 * 60 * 24);
  
  if (ageDays > 30) return true; // stale posting
  if (!job.description || job.description.length < 200) return true; // vague JD
  
  return false;
}
```

### Groq relevance scoring
```js
async function scoreJob(job, profile) {
  const prompt = `
Rate this job 1-10 for a ${profile.level} ${profile.role} candidate with these skills: ${profile.skills}.

Job: ${job.title} at ${job.company}
Description excerpt: ${job.description.slice(0, 500)}

Reply with ONLY a JSON: {"score": N, "reason": "one sentence"}
`;
  const res = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 80,
  });
  return JSON.parse(res.choices[0].message.content);
}
```

### Discord push
```js
async function pushToDiscord(job, score) {
  const color = score >= 8 ? 0x00cc66 : score >= 6 ? 0xffcc00 : 0xff6644;
  
  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: `${job.title} @ ${job.company}`,
        url: job.link,
        description: score.reason,
        color,
        fields: [
          { name: "📍 Location", value: job.location || "Remote", inline: true },
          { name: "📊 Score", value: `${score.score}/10`, inline: true },
          { name: "🏷️ Source", value: job.source, inline: true },
          { name: "📅 Posted", value: job.date || "Unknown", inline: true },
        ],
        footer: { text: `ID: ${job.id}` }
      }]
    })
  });
}
```

### GitHub Actions workflow
```yaml
# .github/workflows/bot.yml
name: Job Bot

on:
  schedule:
    - cron: "17 */2 * * *"   # every 2 hours, offset to avoid top-of-hour congestion
  workflow_dispatch:           # manual trigger for testing

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: node src/scrape.js
        env:
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN }}
```

> [!IMPORTANT]
> **60-day inactivity guard:** GitHub auto-disables cron workflows if there's no commit in 60 days. Add `workflow_dispatch` (already in the YAML above) so you can always re-trigger manually. Also, push a small README update monthly if the bot is in maintenance mode.

### Phase 1 file structure
```
job-bot/
├── .github/
│   └── workflows/
│       └── bot.yml
├── src/
│   ├── scrape.js          ← main entry point
│   ├── sources/
│   │   ├── remoteok.js
│   │   ├── himalayas.js
│   │   ├── arbeitnow.js
│   │   ├── wwr.js
│   │   └── ats.js         ← Greenhouse + Lever
│   ├── filter.js          ← keyword + ghost filter
│   ├── score.js           ← Groq scoring
│   ├── dedup.js           ← Upstash Redis
│   └── discord.js         ← webhook push
├── companies.json          ← your target company list
├── profile.json            ← your skills, role, level
├── package.json
└── .env.example
```

---

## Phase 2 — Naukri + Indeed Email Alerts (⏱️ ~1 day, build AFTER applying to 50+ jobs from Phase 1)

> Build this only when you feel like you're missing Indian market roles or want more volume. Don't build it before Phase 1 is running and you've been actively applying.

### Why email alerts instead of scraping Naukri directly
- Naukri's full JD pages require login in many cases — scraping is unreliable
- Their own email alert system is their curated, filtered feed
- Indeed alerts are fast and reliable
- Building an HTML scraper that breaks whenever they change their layout is not worth it

### Setup (manual, 10 min)
1. **Naukri:** Login → Job Alerts → Create Alert for your profile (keywords: "intern", "junior developer", "fresher") → Set frequency to **Daily**
2. **Indeed:** Go to Indeed.com → search "intern software" → scroll to bottom → "Get new jobs for this search in email" → set to **Daily**
3. Both send to your Gmail.

### What you build
A GitHub Actions job (separate workflow, runs daily at 9am) that:
1. Reads unread emails from Naukri/Indeed senders via Gmail API
2. Parses the job links out of the email HTML
3. Fetches each job page using **Jina Reader** (`r.jina.ai`) to get the JD text
4. Runs through same dedup → filter → score → Discord pipeline as Phase 1

### Jina Reader (Firecrawl replacement, free)
```js
// Fetch any job page as clean text — no credits, no scraping rules, no headless browser
async function fetchJobPage(url) {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      "X-Return-Format": "text",
      "Authorization": `Bearer ${process.env.JINA_API_KEY}`, // free key from jina.ai
    }
  });
  return res.text(); // clean markdown/text of the job page
}
```

**Why Jina over Firecrawl:** Jina Reader has a free API key tier (no monthly credit cap for moderate use) and works great for fetching individual job pages on-demand. You're only fetching ~10-30 pages/day from emails — well within free limits. Firecrawl's 1,000 credits/month = 1,000 pages total, which runs out in days if used in scheduled scraping.

### Gmail API setup (one-time)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. New project → Enable Gmail API
3. OAuth consent screen → External → your email as test user
4. Credentials → OAuth client ID → Desktop app → Download JSON
5. Run the auth flow locally once to get a refresh token
6. Store `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` as GitHub secrets

### Email parsing
```js
// Only fetch from known senders — avoids noise
const ALERT_SENDERS = [
  "alerts@naukri.com",
  "jobalerts@indeed.com",
  "no-reply@linkedin.com" // LinkedIn alerts (supplementary, slow but free)
];

// Parse job URLs from email HTML
function extractJobLinks(emailHtml, sender) {
  const $ = cheerio.load(emailHtml);
  if (sender.includes("naukri")) {
    return $("a[href*='naukri.com/job']").map((_, el) => $(el).attr("href")).get();
  }
  if (sender.includes("indeed")) {
    return $("a[href*='indeed.com/viewjob']").map((_, el) => $(el).attr("href")).get();
  }
  return [];
}
```

---

## After Phase 2: What's Next (build only if needed)

| Phase | What | When to build |
|---|---|---|
| **Phase 3** | `/gap` slash command — paste a JD, get a skill gap analysis vs your resume | When you're applying and want fast JD analysis |
| **Phase 4** | `/outreach` command — draft a cold DM for a specific job | When you start sending DMs to recruiters/employees |
| **Phase 5** | Application tracker sync to Notion/Sheet | When you've applied to 30+ jobs and are losing track |
| **Phase 6** | Weekly digest `/stats` | When you want to see what sources convert to interviews |

---

## User Guide — How to Actually Use This

### Day 0: After Phase 0 + 1 setup

**What you do once:**
- Add your `profile.json` (role, skills, experience level, preferred locations)
- Add 10-20 companies to `companies.json`
- Trigger the bot manually via GitHub Actions → `workflow_dispatch` → "Run workflow"
- Check your Discord `#job-alerts` channel

**What the bot does automatically (every 2 hours):**
- Finds new jobs → deduplicates → filters → scores → pushes to Discord
- You wake up to a digest of scored, filtered, fresh postings

---

### Day-to-Day: Phase 1 Usage

**In Discord, each posting looks like:**

```
🟢 Junior Frontend Engineer @ Linear
   "Strong match — React + TypeScript listed, internship/new grad explicitly mentioned"
   
   📍 Remote    📊 9/10    🏷️ Lever    📅 2 days ago
   
   [Click title to open job page]
```

**Color codes:**
- 🟢 Green embed = score 8-10 → apply immediately
- 🟡 Yellow embed = score 6-7 → read JD, apply if interested
- 🔴 Red embed = score < 6 → skip or skim

**Your daily routine (10 min):**
1. Open Discord → `#job-alerts`
2. Scroll through since yesterday
3. Click every green/yellow embed → open the job page
4. Apply to 3-5 right now using your existing resume
5. Log in a simple Notion table: `Company | Role | Date Applied | Status`

> [!TIP]
> **Apply the same day you see it.** The bot surfaces jobs within hours of posting. Being in the first 50 applicants (vs 500) meaningfully improves response rate for entry-level roles.

---

### Day-to-Day: Phase 2 Usage (Email Alerts)

**Additional Discord channel:** `#naukri-indeed-alerts`

**Your daily routine addition (5 min):**
1. The bot already parsed last night's Naukri/Indeed alert emails
2. Indian market roles now appear in Discord too, scored and filtered
3. You do the same thing: click, apply, log

**Manually:** LinkedIn alerts come to your email but aren't parsed (not worth the engineering). Spend 5 min browsing LinkedIn with the "under 10 applicants" filter manually — that alone captures fresh postings before the crowd.

---

### How to Tune the Bot

**If you're getting too many irrelevant jobs:**
- Add more terms to `EXCLUDE` in `filter.js`
- Raise the Groq minimum score threshold (e.g., only push score ≥ 7)

**If you're not seeing enough jobs:**
- Lower the minimum score threshold
- Add more companies to `companies.json`
- Add keywords to `ROLES` in `filter.js`

**If the bot stops running:**
- Go to GitHub repo → Actions tab → check last run
- If it says "disabled due to inactivity" → push any small commit (add a company to the list) → it re-enables

---

## Cost Breakdown (Phase 0 through Phase 2)

| Service | Monthly Usage | Monthly Cost |
|---|---|---|
| GitHub Actions | ~1,000 min/month (public repo) | **$0** |
| Upstash Redis | ~20,000 cmds/month (well under 500k) | **$0** |
| Groq API | ~500 scoring calls/month | **$0** |
| Discord | Unlimited webhooks | **$0** |
| Public job APIs | Unlimited (with attribution) | **$0** |
| Gmail API | ~300 email reads/month | **$0** |
| Jina Reader | ~300 page fetches/month (Phase 2 only) | **$0** |
| **Total** | | **$0/month** |

---

## Success Criteria Before Moving to Phase 3

Don't move to Phase 3 until:
- [ ] Phase 1 bot has run for at least 1 week without errors
- [ ] You've applied to at least 50 jobs from the bot's output
- [ ] You've received at least 2-3 responses (OAs or rejections) to calibrate quality
- [ ] Phase 2 (email alerts) is running and adding Indian market coverage

Only then — build `/gap` and `/outreach`. By that point you'll know exactly which parts of the workflow actually need automation.
