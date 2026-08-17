/**
 * Main Orchestrator Script for Job Discovery Bot
 * 17 Sources: Job Boards + ATS + Social/Community + India-Specific
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
import { filterJobs } from "./filter.js";
import { deduplicateJobs } from "./dedup.js";
import { scoreJobForCandidates } from "./score.js";
import { pushToDiscord } from "./discord.js";

async function main() {
  console.log(`====================================================`);
  console.log(`[Job Bot] Discovery Cycle Started: ${new Date().toISOString()}`);
  console.log(`====================================================`);

  // 1. Fetch from all sources concurrently
  const fetchers = [
    { name: "LinkedIn Public", fn: fetchLinkedInJobs },
    { name: "Wellfound (AngelList)", fn: fetchWellfoundJobs },
    { name: "RemoteOK", fn: fetchRemoteOKJobs },
    { name: "Himalayas", fn: fetchHimalayasJobs },
    { name: "Arbeitnow", fn: fetchArbeitnowJobs },
    { name: "WeWorkRemotely", fn: fetchWWRJobs },
    { name: "Remotive", fn: fetchRemotiveJobs },
    { name: "Jobicy", fn: fetchJobicyJobs },
    { name: "GitHub Internships", fn: fetchGitHubInternships },
    { name: "ATS (Greenhouse/Lever 68 Companies)", fn: fetchATSJobs },
    { name: "HN Who's Hiring", fn: fetchHNHiringJobs },
    { name: "Reddit Jobs", fn: fetchRedditJobs },
    { name: "Indeed RSS", fn: fetchIndeedRSSJobs },
    { name: "Internshala", fn: fetchInternshalaJobs },
    { name: "Unstop", fn: fetchUnstopJobs },
    { name: "Dev.to", fn: fetchDevToJobs },
    { name: "JustRemote + Freshersworld", fn: fetchJustRemoteJobs },
  ];

  const rawJobs = [];
  const fetchResults = await Promise.allSettled(fetchers.map(f => f.fn()));

  fetchResults.forEach((result, idx) => {
    const sourceName = fetchers[idx].name;
    if (result.status === "fulfilled") {
      console.log(`[Source] ${sourceName}: fetched ${result.value.length} jobs.`);
      rawJobs.push(...result.value);
    } else {
      console.error(`[Source] ${sourceName}: failed -> ${result.reason}`);
    }
  });

  console.log(`\n[Summary] Total raw jobs across ${fetchers.length} sources: ${rawJobs.length}`);

  // 2. Entry-level keyword, location eligibility & ghost listing filtering
  const filteredJobs = filterJobs(rawJobs);
  console.log(`[Filter] Jobs remaining after filter: ${filteredJobs.length}`);

  if (filteredJobs.length === 0) {
    console.log("[Job Bot] No matching fresh jobs found. Exiting.");
    return;
  }

  // 3. Deduplication (Upstash Redis + title/company hash)
  const newJobs = await deduplicateJobs(filteredJobs);
  console.log(`[Dedup] New unseen jobs to process: ${newJobs.length}`);

  if (newJobs.length === 0) {
    console.log("[Job Bot] All jobs were previously seen. Exiting.");
    return;
  }

  // 4. Multi-Candidate LLM Relevance Scoring & Discord Push
  let pushedCount = 0;
  for (const job of newJobs) {
    const scoreObj = await scoreJobForCandidates(job);
    const pushed = await pushToDiscord(job, scoreObj);
    if (pushed) pushedCount++;
  }

  console.log(`====================================================`);
  console.log(`[Job Bot] Discovery Cycle Finished.`);
  console.log(`[Job Bot] Pushed ${pushedCount} high-relevance jobs to Discord.`);
  console.log(`====================================================`);
}

main().catch((err) => {
  console.error(`[Fatal Error] Main loop crashed:`, err);
  process.exit(1);
});

