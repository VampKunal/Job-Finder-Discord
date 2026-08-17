/**
 * Upstash Redis Deduplication Store with Dual-Layer Deduplication (Job ID + Company & Title)
 */

import { Redis } from "@upstash/redis";
import crypto from "crypto";

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

function getTitleCompanyKey(job) {
  const comp = (job.company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const title = (job.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return crypto.createHash("md5").update(`${comp}_${title}`).digest("hex").substring(0, 16);
}

/**
 * Filter an array of jobs, returning only jobs that haven't been seen before.
 * Adds newly seen job IDs and title-company hashes to Upstash Redis sets 'seen_jobs' and 'seen_job_titles'.
 */
export async function deduplicateJobs(jobs) {
  const newJobs = [];

  for (const job of jobs) {
    const jobId = job.id || getTitleCompanyKey(job);
    const titleKey = getTitleCompanyKey(job);

    if (redisClient) {
      try {
        // sadd returns 1 if added (new), 0 if already existed
        const addedId = await redisClient.sadd("seen_jobs", jobId);
        const addedTitle = await redisClient.sadd("seen_job_titles", titleKey);

        if (addedId === 1 && addedTitle === 1) {
          newJobs.push(job);
        } else {
          // If either ID or title was already seen, treat as duplicate
          if (addedId === 1) {
            // Rollback/keep clean: title already existed
          }
        }
      } catch (err) {
        console.error(`[Dedup] Redis sadd failed: ${err.message}. Using fallback.`);
        if (!fallbackSet.has(jobId) && !fallbackSet.has(titleKey)) {
          fallbackSet.add(jobId);
          fallbackSet.add(titleKey);
          newJobs.push(job);
        }
      }
    } else {
      if (!fallbackSet.has(jobId) && !fallbackSet.has(titleKey)) {
        fallbackSet.add(jobId);
        fallbackSet.add(titleKey);
        newJobs.push(job);
      }
    }
  }

  return newJobs;
}

