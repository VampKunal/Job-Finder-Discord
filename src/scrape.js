/**
 * Main Single-Run Script for Job Discovery Bot v2
 * Runs all 20 sources once and exits (ideal for manual execution or GitHub Actions)
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
    { name: "India Aggregators", fn: fetchIndiaAggregatorJobs },
    { name: "Wellfound", fn: fetchWellfoundJobs },
    { name: "Remotive", fn: fetchRemotiveJobs },
    { name: "RemoteOK", fn: fetchRemoteOKJobs },
    { name: "Himalayas", fn: fetchHimalayasJobs },
    { name: "Arbeitnow", fn: fetchArbeitnowJobs },
    { name: "WeWorkRemotely", fn: fetchWWRJobs },
    { name: "Jobicy", fn: fetchJobicyJobs },
    { name: "JustRemote + Freshersworld", fn: fetchJustRemoteJobs },
    { name: "ATS (Greenhouse/Lever)", fn: fetchATSJobs },
    { name: "GitHub Open Internships", fn: fetchGitHubInternships },
    { name: "HN Who's Hiring", fn: fetchHNHiringJobs },
    { name: "Reddit Jobs", fn: fetchRedditJobs },
    { name: "Dev.to", fn: fetchDevToJobs },
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
}

main().catch((err) => {
  console.error(`[Fatal Error] Single run crashed:`, err);
  process.exit(1);
});
