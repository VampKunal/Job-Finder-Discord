/**
 * Shared Processing Pipeline for Job Discovery Bot v2
 * Standardizes: Filtering -> Deduplication -> LLM Scoring -> Discord Notification
 */

import { filterJobs } from "./filter.js";
import { deduplicateJobs } from "./dedup.js";
import { scoreJobForCandidates } from "./score.js";
import { pushToDiscord } from "./discord.js";

export async function runPipeline(rawJobs, cycleName = "Pipeline") {
  if (!rawJobs || rawJobs.length === 0) {
    console.log(`[${cycleName}] No raw jobs provided.`);
    return { pushed: 0, skipped: 0 };
  }

  // 1. India-First Filtering
  const filteredJobs = filterJobs(rawJobs);
  console.log(`[${cycleName}] Filtered ${rawJobs.length} raw jobs -> ${filteredJobs.length} eligible fresher jobs.`);

  if (filteredJobs.length === 0) {
    return { pushed: 0, skipped: 0 };
  }

  // 2. Deduplication via Upstash Redis
  const newJobs = await deduplicateJobs(filteredJobs);
  console.log(`[${cycleName}] Dedup check: ${newJobs.length} unseen new jobs.`);

  if (newJobs.length === 0) {
    return { pushed: 0, skipped: 0 };
  }

  // Cap jobs per cycle to respect API rate limits
  const MAX_JOBS_PER_RUN = parseInt(process.env.MAX_JOBS_PER_RUN || "40", 10);
  const jobsToScore = newJobs.slice(0, MAX_JOBS_PER_RUN);
  if (newJobs.length > MAX_JOBS_PER_RUN) {
    console.log(`[${cycleName}] Processing top ${MAX_JOBS_PER_RUN} jobs out of ${newJobs.length} new jobs.`);
  }

  // 3. LLM Scoring & Discord Notification Push
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
          console.error(`[Scoring Error] Failed for job "${job.title}": ${err.message}`);
          skippedCount++;
        }
      })
    );
  }

  console.log(`[${cycleName}] Finished: ${pushedCount} pushed to Discord | ${skippedCount} skipped.`);
  return { pushed: pushedCount, skipped: skippedCount };
}
