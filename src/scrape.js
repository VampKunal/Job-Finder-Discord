/**
 * Main Orchestrator Script for Job Discovery Bot (Phase 1)
 */

import "dotenv/config";
import { fetchRemoteOKJobs } from "./sources/remoteok.js";
import { fetchHimalayasJobs } from "./sources/himalayas.js";
import { fetchArbeitnowJobs } from "./sources/arbeitnow.js";
import { fetchWWRJobs } from "./sources/wwr.js";
import { fetchATSJobs } from "./sources/ats.js";
import { filterJobs } from "./filter.js";
import { deduplicateJobs } from "./dedup.js";
import { scoreJob } from "./score.js";
import { pushToDiscord } from "./discord.js";

async function main() {
  console.log(`====================================================`);
  console.log(`[Job Bot] Phase 1 Discovery Cycle Started: ${new Date().toISOString()}`);
  console.log(`====================================================`);

  // 1. Fetch from all Tier-1 sources concurrently
  const fetchers = [
    { name: "RemoteOK", fn: fetchRemoteOKJobs },
    { name: "Himalayas", fn: fetchHimalayasJobs },
    { name: "Arbeitnow", fn: fetchArbeitnowJobs },
    { name: "WeWorkRemotely", fn: fetchWWRJobs },
    { name: "ATS (Greenhouse/Lever)", fn: fetchATSJobs },
  ];

  const rawJobs = [];
  const fetchResults = await Promise.allSettled(fetchers.map(f => f.fn()));

  fetchResults.forEach((result, idx) => {
    const sourceName = fetchers[idx].name;
    if (result.status === "fulfilled") {
      console.log(`[Source] ${sourceName}: fetched ${result.value.length} jobs.`);
      rawJobs.push(...result.value);
    } else {
      console.error(`[Source] ${sourceName}: failed with error -> ${result.reason}`);
    }
  });

  console.log(`\n[Summary] Total raw jobs collected: ${rawJobs.length}`);

  // 2. Keyword & Ghost listing filtering
  const filteredJobs = filterJobs(rawJobs);
  console.log(`[Filter] Jobs remaining after keyword & ghost filter: ${filteredJobs.length}`);

  if (filteredJobs.length === 0) {
    console.log("[Job Bot] No matching fresh jobs found in this run. Exiting.");
    return;
  }

  // 3. Deduplication (Upstash Redis)
  const newJobs = await deduplicateJobs(filteredJobs);
  console.log(`[Dedup] New unseen jobs to process: ${newJobs.length}`);

  if (newJobs.length === 0) {
    console.log("[Job Bot] All jobs were previously seen. Exiting.");
    return;
  }

  // 4. LLM Relevance Scoring & Discord Push
  let pushedCount = 0;
  for (const job of newJobs) {
    const scoreObj = await scoreJob(job);
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
