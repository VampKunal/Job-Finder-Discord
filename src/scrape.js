/**
 * Main Orchestrator Script for Job Discovery Bot v2 (Optimized)
 * 20 Sources: India-First + Global Remote + ATS + Social/Community
 */

import "dotenv/config";
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
import { filterJobs } from "./filter.js";
import { deduplicateJobs } from "./dedup.js";
import { scoreJobForCandidates } from "./score.js";
import { pushToDiscord } from "./discord.js";

async function main() {
  console.log(`====================================================`);
  console.log(`[Job Bot v2] 🇮🇳 India-Fresher-First Discovery Cycle`);
  console.log(`[Job Bot v2] Started: ${new Date().toISOString()}`);
  console.log(`====================================================`);

  // ── Tier 1: India-Explicit Sources (highest priority) ──────────────
  const tier1 = [
    { name: "LinkedIn India (27 queries)", fn: fetchLinkedInJobs },
    { name: "Indeed India RSS (14 feeds)", fn: fetchIndeedRSSJobs },
    { name: "Internshala", fn: fetchInternshalaJobs },
    { name: "Unstop", fn: fetchUnstopJobs },
    { name: "Naukri RSS (10 feeds)", fn: fetchNaukriJobs },
    { name: "India Aggregators (Foundit/Shine/TimesJobs/Google)", fn: fetchIndiaAggregatorJobs },
    { name: "Wellfound (AngelList India)", fn: fetchWellfoundJobs },
  ];

  // ── Tier 2: Global Remote Boards (filtered for India eligibility) ──
  const tier2 = [
    { name: "Remotive", fn: fetchRemotiveJobs },
    { name: "RemoteOK", fn: fetchRemoteOKJobs },
    { name: "Himalayas", fn: fetchHimalayasJobs },
    { name: "Arbeitnow", fn: fetchArbeitnowJobs },
    { name: "WeWorkRemotely", fn: fetchWWRJobs },
    { name: "Jobicy", fn: fetchJobicyJobs },
    { name: "JustRemote + Freshersworld", fn: fetchJustRemoteJobs },
  ];

  // ── Tier 3: ATS Direct (80+ company career pages) ─────────────────
  const tier3 = [
    { name: "ATS (Greenhouse/Lever 80+ Companies)", fn: fetchATSJobs },
  ];

  // ── Tier 4: Community/Social Sources ───────────────────────────────
  const tier4 = [
    { name: "GitHub Open Internships", fn: fetchGitHubInternships },
    { name: "HN Who's Hiring", fn: fetchHNHiringJobs },
    { name: "Reddit Jobs", fn: fetchRedditJobs },
    { name: "Dev.to", fn: fetchDevToJobs },
  ];

  const allFetchers = [...tier1, ...tier2, ...tier3, ...tier4];
  const rawJobs = [];

  // ── Run all tiers concurrently ─────────────────────────────────────
  const fetchResults = await Promise.allSettled(allFetchers.map(f => f.fn()));

  let tierCounts = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };

  fetchResults.forEach((result, idx) => {
    const sourceName = allFetchers[idx].name;
    if (result.status === "fulfilled") {
      const count = result.value.length;
      console.log(`[Source] ✅ ${sourceName}: ${count} jobs`);
      rawJobs.push(...result.value);

      if (idx < tier1.length) tierCounts.tier1 += count;
      else if (idx < tier1.length + tier2.length) tierCounts.tier2 += count;
      else if (idx < tier1.length + tier2.length + tier3.length) tierCounts.tier3 += count;
      else tierCounts.tier4 += count;
    } else {
      console.error(`[Source] ❌ ${sourceName}: ${result.reason}`);
    }
  });

  console.log(`\n[Pipeline Summary]`);
  console.log(`  Tier 1 (India-Explicit): ${tierCounts.tier1} raw jobs`);
  console.log(`  Tier 2 (Global Remote):  ${tierCounts.tier2} raw jobs`);
  console.log(`  Tier 3 (ATS Direct):     ${tierCounts.tier3} raw jobs`);
  console.log(`  Tier 4 (Community):      ${tierCounts.tier4} raw jobs`);
  console.log(`  TOTAL:                   ${rawJobs.length} raw jobs from ${allFetchers.length} sources\n`);

  // ── 2. India-First Filtering ───────────────────────────────────────
  const filteredJobs = filterJobs(rawJobs);
  console.log(`[Filter] Jobs remaining after India-fresher filter: ${filteredJobs.length}`);

  if (filteredJobs.length === 0) {
    console.log("[Job Bot v2] No matching India-eligible fresh jobs found. Exiting.");
    return;
  }

  // ── 3. Deduplication ──────────────────────────────────────────────
  const newJobs = await deduplicateJobs(filteredJobs);
  console.log(`[Dedup] New unseen jobs: ${newJobs.length}`);

  if (newJobs.length === 0) {
    console.log("[Job Bot v2] All jobs were previously seen. Exiting.");
    return;
  }

  // Cap jobs to score per cycle to prevent rate-limiting or cycle bloat (max 40)
  const MAX_JOBS_PER_RUN = 40;
  const jobsToScore = newJobs.slice(0, MAX_JOBS_PER_RUN);
  if (newJobs.length > MAX_JOBS_PER_RUN) {
    console.log(`[Scoring] Processing top ${MAX_JOBS_PER_RUN} jobs out of ${newJobs.length} new jobs.`);
  }

  // ── 4. Parallel LLM Scoring & Discord Push (Concurrency 5) ──────────
  let pushedCount = 0;
  let skippedCount = 0;
  const batchSize = 2;

  for (let i = 0; i < jobsToScore.length; i += batchSize) {
    const chunk = jobsToScore.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (job) => {
        try {
          const scoreObj = await scoreJobForCandidates(job);
          const pushed = await pushToDiscord(job, scoreObj);
          if (pushed) pushedCount++;
          else skippedCount++;
        } catch (err) {
          console.error(`[Scoring Error] Failed for job ${job.title}: ${err.message}`);
          skippedCount++;
        }
      })
    );
  }

  console.log(`\n====================================================`);
  console.log(`[Job Bot v2] 🏁 Discovery Cycle Complete`);
  console.log(`[Job Bot v2] Pushed: ${pushedCount} | Skipped (low score): ${skippedCount}`);
  console.log(`====================================================`);
}

main().catch((err) => {
  console.error(`[Fatal Error] Main loop crashed:`, err);
  process.exit(1);
});
