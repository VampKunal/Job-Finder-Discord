/**
 * Upstash Redis Deduplication Store
 */

import { Redis } from "@upstash/redis";

const fallbackSet = new Set();
let redisClient = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (err) {
    console.warn(`[Dedup] Failed to initialize Upstash Redis: ${err.message}. Falling back to in-memory set.`);
  }
} else {
  console.warn("[Dedup] UPSTASH_REDIS_REST_URL/TOKEN missing in environment. Using in-memory fallback.");
}

/**
 * Filter an array of jobs, returning only jobs that haven't been seen before.
 * Adds newly seen job IDs to Upstash Redis set 'seen_jobs'.
 */
export async function deduplicateJobs(jobs) {
  const newJobs = [];

  for (const job of jobs) {
    const jobId = job.id;
    if (!jobId) continue;

    if (redisClient) {
      try {
        // sadd returns 1 if the element was added (new), 0 if already existed
        const addedCount = await redisClient.sadd("seen_jobs", jobId);
        if (addedCount === 1) {
          newJobs.push(job);
        }
      } catch (err) {
        console.error(`[Dedup] Redis sadd failed for ${jobId}: ${err.message}`);
        // Fallback check if Redis call fails
        if (!fallbackSet.has(jobId)) {
          fallbackSet.add(jobId);
          newJobs.push(job);
        }
      }
    } else {
      if (!fallbackSet.has(jobId)) {
        fallbackSet.add(jobId);
        newJobs.push(job);
      }
    }
  }

  return newJobs;
}
