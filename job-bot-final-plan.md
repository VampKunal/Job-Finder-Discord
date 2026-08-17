# Job Bot — Final Implementation Plan

## What we're building

```
Public APIs + Company ATS boards
        ↓
Upstash Redis (dedup)
        ↓
Keyword filter + Ghost filter
        ↓
Groq relevance score (1-10)
        ↓
Discord embed push
  ├── LinkedIn mutual-find deep-link
  └── "You know someone here" alert (connections.json)
        ↓
Slash commands: /applied, /snooze  (Cloudflare Workers)
```

**Cost: $0/month. Runtime: GitHub Actions (cron, every 2 hrs).**

---

## Stack

| Tool | Purpose | Free Tier |
|---|---|---|
| GitHub Actions | Cron scheduler | Unlimited on public repo |
| Upstash Redis | Dedup store | 500k cmds/month |
| Groq API | Relevance scoring | 14,400 req/day, no card |
| Cloudflare Workers | Slash command endpoint | 100k req/day |
| Discord Webhook | Push notifications | Unlimited |
| RemoteOK / Himalayas / Arbeitnow / WWR | Job data | Free public APIs |
| Greenhouse / Lever JSON | Target company listings | Free public endpoints |

---

## File Structure

```
job-bot/
├── .github/
│   └── workflows/
│       ├── scrape.yml          ← main cron (every 2 hrs)
│       └── health.yml          ← monthly commit guard (prevents 60-day disable)
├── src/
│   ├── scrape.js               ← entry point, orchestrates everything
│   ├── sources/
│   │   ├── remoteok.js         ← RemoteOK API
│   │   ├── himalayas.js        ← Himalayas API
│   │   ├── arbeitnow.js        ← Arbeitnow API
│   │   ├── wwr.js              ← We Work Remotely RSS
│   │   └── ats.js              ← Greenhouse + Lever for companies.json
│   ├── dedup.js                ← Upstash Redis SADD logic
│   ├── filter.js               ← keyword match + ghost-listing rules
│   ├── score.js                ← Groq API scoring
│   ├── discord.js              ← webhook push + embed builder
│   └── referral.js             ← connections.json lookup + LinkedIn deep-link
├── worker/
│   └── index.js                ← Cloudflare Worker for /applied, /snooze
├── companies.json              ← your target companies list
├── connections.json            ← your LinkedIn connections + their companies
├── profile.json                ← your skills, role, level (used for scoring)
├── package.json
└── .env.example
```

---

## Phase 0 — Setup (⏱️ ~1 hour, do this first)

### Step 1: Create GitHub repo (must be public)
Public repo = unlimited Actions minutes on free tier.

### Step 2: Discord Webhook
```
Server Settings → Integrations → Webhooks → New Webhook
→ Pick #job-alerts channel → Copy Webhook URL
```

### Step 3: Get API keys (all free, no card)

| Key | Where |
|---|---|
| `GROQ_API_KEY` | console.groq.com → Sign up → API Keys |
| `UPSTASH_REDIS_REST_URL` | upstash.com → Create DB → REST API tab |
| `UPSTASH_REDIS_REST_TOKEN` | Same page |
| `DISCORD_WEBHOOK_URL` | From step 2 |
| `DISCORD_APP_PUBLIC_KEY` | Discord Developer Portal → New App → General (for slash cmds) |
| `DISCORD_APP_ID` | Same page |

### Step 4: Add secrets to GitHub
```
Repo → Settings → Secrets → Actions → New repository secret
```
Add all keys from Step 3.

### Step 5: Fill in your data files

**`profile.json`**
```json
{
  "role": "frontend developer",
  "level": "intern / fresher",
  "skills": "React, TypeScript, Node.js, Python",
  "locations": ["remote", "bangalore", "mumbai", "hyderabad"]
}
```

**`companies.json`**
```json
[
  { "name": "Stripe",   "greenhouse": "stripe" },
  { "name": "Linear",   "lever": "linear" },
  { "name": "Vercel",   "lever": "vercel" },
  { "name": "Notion",   "greenhouse": "notion" },
  { "name": "Razorpay", "greenhouse": "razorpay" },
  { "name": "Zepto",    "lever": "zepto" }
]
```
Greenhouse URL: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
Lever URL: `https://api.lever.co/v0/postings/{slug}?mode=json`

**`connections.json`** (add your LinkedIn connections manually)
```json
[
  { "name": "Rahul Sharma", "company": "Stripe",   "linkedin": "https://linkedin.com/in/rahulsharma" },
  { "name": "Priya Mehta",  "company": "Linear",   "linkedin": "https://linkedin.com/in/priyamehta" }
]
```
You don't need many — even 5-10 connections listed here makes the referral alert useful.

---

## Phase 1 — Core Bot (⏱️ Day 1–2)

### `src/dedup.js`
```js
// Upstash Redis REST — no npm client needed, plain fetch
export async function isNew(jobId) {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/sadd/seen_jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  const { result } = await res.json();
  return result === 1; // 1 = new, 0 = already seen
}
```
Each job check = 1 HTTP call. At 50 jobs × 12 runs/day × 30 days = 18k calls/month (limit: 500k).

### `src/filter.js`
```js
const ROLE_KEYWORDS  = ["software", "frontend", "backend", "fullstack", "python", "node", "react", "developer", "engineer"];
const LEVEL_KEYWORDS = ["intern", "internship", "junior", "entry", "fresher", "graduate", "new grad"];
const EXCLUDE        = ["senior", "staff", "principal", "lead", "director", "vp", "8+ years", "10+ years"];

export function passesFilter(job) {
  const text = `${job.title} ${job.description || ""}`.toLowerCase();
  const hasRole  = ROLE_KEYWORDS.some(k => text.includes(k));
  const hasLevel = LEVEL_KEYWORDS.some(k => text.includes(k));
  const excluded = EXCLUDE.some(k => text.includes(k));
  return hasRole && hasLevel && !excluded;
}

export function isGhost(job) {
  if (!job.date) return false;
  const ageDays = (Date.now() - new Date(job.date)) / 86400000;
  if (ageDays > 30) return true;                         // stale
  if ((job.description || "").length < 150) return true; // vague JD
  return false;
}
```

### `src/score.js`
```js
import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const profile = JSON.parse(fs.readFileSync("profile.json"));

export async function scoreJob(job) {
  const prompt = `Rate this job 1-10 for a ${profile.level} ${profile.role} with skills: ${profile.skills}.
Job: ${job.title} at ${job.company}
JD excerpt: ${(job.description || "").slice(0, 400)}
Reply ONLY as JSON: {"score": N, "reason": "one sentence"}`;

  const res = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 80,
  });
  try { return JSON.parse(res.choices[0].message.content); }
  catch { return { score: 5, reason: "Could not parse score" }; }
}
```

### `src/referral.js`
```js
import connections from "../connections.json" assert { type: "json" };

export function findReferral(companyName) {
  const name = companyName.toLowerCase();
  return connections.filter(c => c.company.toLowerCase().includes(name));
}

export function linkedinSearchUrl(companyName) {
  const q = encodeURIComponent(companyName);
  // Opens LinkedIn filtered to 1st + 2nd degree connections at this company
  return `https://www.linkedin.com/search/results/people/?keywords=${q}&network=%5B%22F%22%2C%22S%22%5D`;
}
```

### `src/discord.js`
```js
export async function push(job, scored, referrals, linkedinUrl) {
  const color = scored.score >= 8 ? 0x00cc66 : scored.score >= 6 ? 0xffcc00 : 0xff6644;

  const fields = [
    { name: "📍 Location", value: job.location || "Remote",      inline: true },
    { name: "📊 Score",    value: `${scored.score}/10`,           inline: true },
    { name: "🏷️ Source",  value: job.source,                     inline: true },
    { name: "📅 Posted",  value: job.date || "Unknown",          inline: true },
    { name: "🔍 Find connections", value: `[Search LinkedIn](${linkedinUrl})`, inline: false },
  ];

  // If you personally know someone there — highlighted alert
  if (referrals.length > 0) {
    const names = referrals.map(r => `[${r.name}](${r.linkedin})`).join(", ");
    fields.push({ name: "🤝 You know someone here!", value: names, inline: false });
  }

  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: `${job.title} @ ${job.company}`,
        url: job.link,
        description: scored.reason,
        color,
        fields,
        footer: { text: `ID: ${job.id} • React ✅ to mark applied` },
      }],
    }),
  });
}
```

### `src/scrape.js` (orchestrator)
```js
import { fetchRemoteOK }  from "./sources/remoteok.js";
import { fetchHimalayas } from "./sources/himalayas.js";
import { fetchArbeitnow } from "./sources/arbeitnow.js";
import { fetchWWR }       from "./sources/wwr.js";
import { fetchATS }       from "./sources/ats.js";
import { isNew }          from "./dedup.js";
import { passesFilter, isGhost } from "./filter.js";
import { scoreJob }       from "./score.js";
import { findReferral, linkedinSearchUrl } from "./referral.js";
import { push }           from "./discord.js";

const sources = [fetchRemoteOK, fetchHimalayas, fetchArbeitnow, fetchWWR, fetchATS];

for (const fetch of sources) {
  const jobs = await fetch();
  for (const job of jobs) {
    if (isGhost(job))         continue; // stale or vague
    if (!passesFilter(job))   continue; // wrong role/level
    if (!(await isNew(job.id))) continue; // already seen

    const scored    = await scoreJob(job);
    if (scored.score < 5)     continue; // too irrelevant

    const referrals = findReferral(job.company);
    const liUrl     = linkedinSearchUrl(job.company);

    await push(job, scored, referrals, liUrl);
    await new Promise(r => setTimeout(r, 1000)); // rate limit: 1 Discord msg/sec
  }
}
```

### `.github/workflows/scrape.yml`
```yaml
name: Job Scraper
on:
  schedule:
    - cron: "17 */2 * * *"  # every 2 hrs, offset from top-of-hour
  workflow_dispatch:          # manual trigger for testing

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: node src/scrape.js
        env:
          DISCORD_WEBHOOK_URL:       ${{ secrets.DISCORD_WEBHOOK_URL }}
          GROQ_API_KEY:              ${{ secrets.GROQ_API_KEY }}
          UPSTASH_REDIS_REST_URL:    ${{ secrets.UPSTASH_REDIS_REST_URL }}
          UPSTASH_REDIS_REST_TOKEN:  ${{ secrets.UPSTASH_REDIS_REST_TOKEN }}
```

### `.github/workflows/health.yml` (prevents 60-day auto-disable)
```yaml
name: Health Check
on:
  schedule:
    - cron: "0 9 1 * *"  # 1st of every month
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Bot alive $(date)" >> health.log
      - uses: stefanzweifel/git-auto-commit-action@v5
        with: { commit_message: "chore: monthly health ping" }
```

---

## Phase 1 — Slash Commands (⏱️ Day 2–3)

Deploy on **Cloudflare Workers** (not Vercel — faster cold starts, no 3s timeout risk).

### Register commands once (run locally)
```bash
curl -X POST https://discord.com/api/v10/applications/$APP_ID/commands \
  -H "Authorization: Bot $BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {"name":"applied","description":"Mark a job as applied","options":[{"name":"job_id","type":3,"description":"Job ID from Discord embed footer","required":true}]},
    {"name":"snooze","description":"Stop showing a company","options":[{"name":"company","type":3,"description":"Company name","required":true}]}
  ]'
```

### `worker/index.js`
```js
import { verifyKey } from "discord-interactions";

export default {
  async fetch(req, env) {
    // Discord requires signature verification
    const signature = req.headers.get("X-Signature-Ed25519");
    const timestamp  = req.headers.get("X-Signature-Timestamp");
    const body       = await req.text();
    const isValid    = verifyKey(body, signature, timestamp, env.DISCORD_APP_PUBLIC_KEY);
    if (!isValid) return new Response("Unauthorized", { status: 401 });

    const interaction = JSON.parse(body);

    // Discord PING — must respond immediately
    if (interaction.type === 1) return json({ type: 1 });

    const cmd = interaction.data.name;

    if (cmd === "applied") {
      const jobId = interaction.data.options[0].value;
      // Store in Upstash Redis under "applied" set
      await redis(env, `sadd/applied_jobs/${jobId}`);
      return json({ type: 4, data: { content: `✅ Marked **${jobId}** as applied. Good luck!` } });
    }

    if (cmd === "snooze") {
      const company = interaction.data.options[0].value.toLowerCase();
      await redis(env, `sadd/snoozed_companies/${company}`);
      return json({ type: 4, data: { content: `🔕 Snoozed **${company}** — won't appear again.` } });
    }

    return json({ type: 4, data: { content: "Unknown command." } });
  },
};

function json(data) {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

async function redis(env, path) {
  return fetch(`${env.UPSTASH_REDIS_REST_URL}/${path}`, {
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
  });
}
```

**In `scrape.js`** — check snooze before pushing:
```js
// Check if company is snoozed before pushing
const snoozed = await fetch(`${UPSTASH_URL}/sismember/snoozed_companies/${job.company.toLowerCase()}`, {
  headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
});
const { result } = await snoozed.json();
if (result === 1) continue; // company is snoozed
```

### Deploy Worker
```bash
npm install -g wrangler
cd worker
wrangler deploy
# Paste the Worker URL into Discord Developer Portal → App → Interactions Endpoint URL
```

---

## Phase 2 — Email Alerts: Naukri + Indeed (build after Phase 1 is running)

### Setup (manual, 10 min)
1. **Naukri** → Job Alerts → Create alert → keywords matching your profile → frequency: Daily
2. **Indeed** → Search your role → bottom of results page → "Get jobs by email" → Daily

### What you build
A second GitHub Actions workflow (`email.yml`) that runs daily at 9am:
1. Reads unread emails from Naukri/Indeed senders via Gmail API
2. Extracts job URLs from email HTML (cheerio)
3. Fetches each JD as clean text via **Jina Reader** (free, no credits)
4. Runs through the same dedup → filter → score → Discord pipeline

### Jina Reader (Firecrawl replacement)
```js
// Fetch any job page as readable text — free API key, no credit cap
async function fetchJD(url) {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
  });
  return res.text(); // returns clean markdown of the page
}
```
Get your free key at [jina.ai](https://jina.ai). Works for ~300 pages/month easily.

---

## Build Order (Day by Day)

| Day | What to build | Done when |
|---|---|---|
| **Day 1 AM** | Phase 0 setup — repo, webhook, API keys, secrets, `profile.json`, `companies.json` | Bot secrets are in GitHub, Discord channel exists |
| **Day 1 PM** | `remoteok.js`, `himalayas.js`, `arbeitnow.js`, `dedup.js`, `discord.js` | First Discord message appears when you run `node src/scrape.js` locally |
| **Day 2 AM** | `ats.js` (Greenhouse + Lever), `filter.js`, `score.js`, `wwr.js` | Jobs are scored and color-coded in Discord |
| **Day 2 PM** | `referral.js`, `connections.json`, LinkedIn deep-link in embeds, `scrape.yml` cron | Bot runs on schedule, embeds have LinkedIn search links |
| **Day 3** | Cloudflare Worker (`/applied`, `/snooze`), `health.yml` | Slash commands work in Discord |
| **After Phase 1 is live** | Gmail API + Jina Reader (Phase 2) | Naukri/Indeed alerts appear in Discord |

---

## Day-to-Day Usage

### What the Discord embed looks like
```
🟢  Junior Frontend Engineer @ Linear
    "Strong match — React + TypeScript in JD, new grad explicitly mentioned"

    📍 Remote   📊 9/10   🏷️ Lever   📅 2 days ago
    🔍 Find connections  →  [Search LinkedIn]
    🤝 You know someone here! → Rahul Sharma

    [Click title → opens job page]
    Footer: ID: lever:linear:abc123
```

### Your daily routine (10 min)
1. Open Discord → `#job-alerts`
2. 🟢 Green (8-10): Apply today. Click → apply → `/applied lever:linear:abc123`
3. 🟡 Yellow (6-7): Read the JD. Apply if it fits.
4. 🔴 Red (<6): Skip. Or `/snooze company:recruiterspam` to hide forever.
5. When you see 🤝 "You know someone here" → message that person on LinkedIn before applying

### Tuning (when needed)
- Too many bad matches → raise min score threshold in `scrape.js` to 6 or 7
- Too few results → add more companies to `companies.json`, broaden ROLE_KEYWORDS
- Annoying company keeps appearing → `/snooze company:<name>`
- Want to see what you've applied to → query Upstash dashboard → `applied_jobs` set

---

## Cost Summary

| Service | Monthly Usage | Cost |
|---|---|---|
| GitHub Actions (public repo) | ~1,000 min | $0 |
| Upstash Redis | ~20,000 cmds | $0 |
| Groq API | ~500 scoring calls | $0 |
| Cloudflare Workers | <1,000 slash cmd calls | $0 |
| Discord | Unlimited | $0 |
| All job APIs | Unlimited | $0 |
| **Total** | | **$0/month** |
