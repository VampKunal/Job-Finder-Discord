/**
 * Hybrid 24/7 Continuous Daemon for Job Discovery Bot v2
 * 
 * Features:
 *  - Micro-polling (Fast Cycle): Queries lightweight JSON APIs, RSS feeds & ATS every X minutes (default: 3 mins)
 *  - Deep Scraping (Batch Cycle): Runs heavy HTML scrapers & social aggregators every Y minutes (default: 60 mins)
 *  - Built-in HTTP Health Check Server: Prevents free cloud hosts (Render Web Service) from sleeping
 */

import "dotenv/config";
import http from "http";
import { fetchRemoteOKJobs } from "./sources/remoteok.js";
import { fetchHimalayasJobs } from "./sources/himalayas.js";
import { fetchArbeitnowJobs } from "./sources/arbeitnow.js";
import { fetchWWRJobs } from "./sources/wwr.js";
import { fetchATSJobs } from "./sources/ats.js";
import { fetchRemotiveJobs } from "./sources/remotive.js";
import { fetchJobicyJobs } from "./sources/jobicy.js";
import { fetchGitHubInternships } from "./sources/github_internships.js";
import { fetchLinkedInJobs } from "./sources/linkedin.js";
import { fetchWellfoundJobs } from "./sources/wellfound.js";
import { fetchHNHiringJobs } from "./sources/hn_hiring.js";
import { fetchRedditJobs } from "./sources/reddit_jobs.js";
import { fetchIndeedRSSJobs } from "./sources/indeed_rss.js";
import { fetchInternshalaJobs } from "./sources/internshala.js";
import { fetchUnstopJobs } from "./sources/unstop.js";
import { fetchDevToJobs } from "./sources/devto_jobs.js";
import { fetchJustRemoteJobs } from "./sources/justremote.js";
import { fetchNaukriJobs } from "./sources/naukri.js";
import { fetchIndiaAggregatorJobs } from "./sources/india_aggregators.js";
import { runPipeline } from "./pipeline.js";

// Configurable intervals via environment variables (in minutes)
const FAST_POLL_INTERVAL_MIN = parseInt(process.env.FAST_POLL_INTERVAL_MIN || "3", 10);
const DEEP_SCRAPE_INTERVAL_MIN = parseInt(process.env.DEEP_SCRAPE_INTERVAL_MIN || "60", 10);

// ── FAST INSTANT SOURCES (Lightweight JSON APIs, RSS & ATS) ─────────
const fastSources = [
  { name: "ATS Direct (Greenhouse & Lever 80+ Companies)", fn: fetchATSJobs },
  { name: "Indeed India RSS", fn: fetchIndeedRSSJobs },
  { name: "Reddit Jobs (.json feeds)", fn: fetchRedditJobs },
  { name: "Dev.to Jobs API", fn: fetchDevToJobs },
  { name: "GitHub Open Internships", fn: fetchGitHubInternships },
  { name: "HN Who's Hiring API", fn: fetchHNHiringJobs },
  { name: "Remotive API", fn: fetchRemotiveJobs },
  { name: "RemoteOK API", fn: fetchRemoteOKJobs },
  { name: "Himalayas API", fn: fetchHimalayasJobs },
  { name: "Arbeitnow API", fn: fetchArbeitnowJobs },
  { name: "WeWorkRemotely RSS", fn: fetchWWRJobs },
  { name: "Jobicy API", fn: fetchJobicyJobs },
];

// ── DEEP SCRAPING SOURCES (Heavy Scrapers & Aggregators) ─────────────
const deepSources = [
  { name: "LinkedIn India", fn: fetchLinkedInJobs },
  { name: "Internshala Scraper", fn: fetchInternshalaJobs },
  { name: "Unstop Scraper", fn: fetchUnstopJobs },
  { name: "Naukri RSS & Aggregator", fn: fetchNaukriJobs },
  { name: "India Aggregators (Shine/TimesJobs/Google)", fn: fetchIndiaAggregatorJobs },
  { name: "Wellfound (AngelList)", fn: fetchWellfoundJobs },
  { name: "JustRemote & Freshersworld", fn: fetchJustRemoteJobs },
];

let isFastCycleRunning = false;
let isDeepCycleRunning = false;

// ── Built-in HTTP Health Check Server ────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: "online",
    service: "Job Discovery Bot v2",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, () => {
  console.log(`🌐 [HTTP Server] Health check server active on port ${PORT}`);
});

async function runFastCycle() {
  if (isFastCycleRunning) return;
  isFastCycleRunning = true;
  const startTime = new Date();
  console.log(`\n⚡ [Fast Micro-Poll] Started at ${startTime.toLocaleTimeString()}`);

  try {
    const fetchResults = await Promise.allSettled(fastSources.map(s => s.fn()));
    const rawJobs = [];

    fetchResults.forEach((res, idx) => {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        if (res.value.length > 0) {
          console.log(`   └─ ✅ ${fastSources[idx].name}: ${res.value.length} jobs`);
        }
        rawJobs.push(...res.value);
      }
    });

    console.log(`⚡ [Fast Micro-Poll] Collected ${rawJobs.length} raw jobs across ${fastSources.length} instant feeds.`);
    await runPipeline(rawJobs, "Fast Micro-Poll");
  } catch (err) {
    console.error(`⚡ [Fast Micro-Poll Error]`, err.message);
  } finally {
    isFastCycleRunning = false;
  }
}

async function runDeepCycle() {
  if (isDeepCycleRunning) return;
  isDeepCycleRunning = true;
  const startTime = new Date();
  console.log(`\n🔍 [Deep Scrape Batch] Started at ${startTime.toLocaleTimeString()}`);

  try {
    const fetchResults = await Promise.allSettled(deepSources.map(s => s.fn()));
    const rawJobs = [];

    fetchResults.forEach((res, idx) => {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        console.log(`   └─ ✅ ${deepSources[idx].name}: ${res.value.length} jobs`);
        rawJobs.push(...res.value);
      }
    });

    console.log(`🔍 [Deep Scrape Batch] Collected ${rawJobs.length} raw jobs across ${deepSources.length} heavy scrapers.`);
    await runPipeline(rawJobs, "Deep Scrape Batch");
  } catch (err) {
    console.error(`🔍 [Deep Scrape Batch Error]`, err.message);
  } finally {
    isDeepCycleRunning = false;
  }
}

async function startDaemon() {
  console.log(`====================================================`);
  console.log(`🚀 [Job Bot Daemon] Starting 24/7 Hybrid Continuous Engine`);
  console.log(`⏱️  Fast Micro-Poll Interval : Every ${FAST_POLL_INTERVAL_MIN} minutes`);
  console.log(`⏱️  Deep Scrape Batch Interval : Every ${DEEP_SCRAPE_INTERVAL_MIN} minutes`);
  console.log(`====================================================\n`);

  // Run initial fast & deep cycles on startup
  await runFastCycle();
  await runDeepCycle();

  // Schedule intervals
  setInterval(runFastCycle, FAST_POLL_INTERVAL_MIN * 60 * 1000);
  setInterval(runDeepCycle, DEEP_SCRAPE_INTERVAL_MIN * 60 * 1000);
}

startDaemon().catch((err) => {
  console.error(`[Daemon Fatal Error]`, err);
  process.exit(1);
});
