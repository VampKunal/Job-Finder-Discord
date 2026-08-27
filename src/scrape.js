/**
 * Main Single-Run Script for Job Discovery Bot v2
 * Runs all 20 sources once and exits (ideal for manual execution or GitHub Actions)
 */

import "dotenv/config";
import { fetchATSJobs } from "./sources/ats.js";
import { fetchGitHubInternships } from "./sources/github_internships.js";
import { fetchLinkedInJobs } from "./sources/linkedin.js";
import { fetchWellfoundJobs } from "./sources/wellfound.js";
import { fetchHNHiringJobs } from "./sources/hn_hiring.js";
import { fetchRedditJobs } from "./sources/reddit_jobs.js";
import { fetchIndeedRSSJobs } from "./sources/indeed_rss.js";
import { fetchInternshalaJobs } from "./sources/internshala.js";
import { fetchUnstopJobs } from "./sources/unstop.js";
import { fetchDevToJobs } from "./sources/devto_jobs.js";
import { fetchFreshersworldJobs } from "./sources/freshersworld.js";
import { fetchNaukriJobs } from "./sources/naukri.js";
import { fetchIndiaAggregatorJobs } from "./sources/india_aggregators.js";
import { runPipeline } from "./pipeline.js";

async function main() {
  console.log(`====================================================`);
  console.log(`[Job Bot v2] 🇮🇳 India-Fresher Single-Run Discovery`);
  console.log(`[Job Bot v2] Started: ${new Date().toISOString()}`);
  console.log(`====================================================`);

  const allFetchers = [
    { name: "LinkedIn India", fn: fetchLinkedInJobs },
    { name: "Indeed India RSS", fn: fetchIndeedRSSJobs },
    { name: "Internshala", fn: fetchInternshalaJobs },
    { name: "Unstop", fn: fetchUnstopJobs },
    { name: "Naukri RSS", fn: fetchNaukriJobs },
    { name: "India Aggregators (Shine/TimesJobs/Google)", fn: fetchIndiaAggregatorJobs },
    { name: "Wellfound India", fn: fetchWellfoundJobs },
    { name: "Freshersworld India", fn: fetchFreshersworldJobs },
    { name: "ATS Direct (Greenhouse/Lever)", fn: fetchATSJobs },
    { name: "GitHub Open Internships", fn: fetchGitHubInternships },
    { name: "HN Who's Hiring (India/Remote)", fn: fetchHNHiringJobs },
    { name: "Reddit Jobs (India/Remote)", fn: fetchRedditJobs },
    { name: "Dev.to Jobs", fn: fetchDevToJobs },
  ];

  const fetchResults = await Promise.allSettled(allFetchers.map(f => f.fn()));
  const rawJobs = [];

  fetchResults.forEach((result, idx) => {
    const sourceName = allFetchers[idx].name;
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      console.log(`[Source] ✅ ${sourceName}: ${result.value.length} jobs`);
      rawJobs.push(...result.value);
    } else {
      console.error(`[Source] ❌ ${sourceName}: ${result.reason || "Error"}`);
    }
  });

  console.log(`\n[Pipeline] Total raw jobs collected: ${rawJobs.length}`);
  await runPipeline(rawJobs, "Single Run");
  process.exit(0);
}

main().catch((err) => {
  console.error(`[Fatal Error] Single run crashed:`, err);
  process.exit(1);
});
