/**
 * Upstash Redis Deduplication Store with Dual-Layer Deduplication (Job ID + Company & Title)
 * Batch-Optimized for ultra-fast execution (<1s)
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

async function checkAndAddJob(job) {
  const jobId = job.id || getTitleCompanyKey(job);
  const titleKey = getTitleCompanyKey(job);

  if (redisClient) {
    try {
      const [addedId, addedTitle] = await Promise.all([
        redisClient.sadd("seen_jobs", jobId),
        redisClient.sadd("seen_job_titles", titleKey)
      ]);

      if (addedId === 1 && addedTitle === 1) {
        return job;
      }
      return null;
    } catch (err) {
      console.error(`[Dedup] Redis sadd failed: ${err.message}. Using fallback.`);
      if (!fallbackSet.has(jobId) && !fallbackSet.has(titleKey)) {
        fallbackSet.add(jobId);
        fallbackSet.add(titleKey);
        return job;
      }
      return null;
    }
  } else {
    if (!fallbackSet.has(jobId) && !fallbackSet.has(titleKey)) {
      fallbackSet.add(jobId);
      fallbackSet.add(titleKey);
      return job;
    }
    return null;
  }
}

/**
 * Filter an array of jobs, returning only jobs that haven't been seen before.
 * Runs Redis deduplication checks concurrently in chunks.
 */
export async function deduplicateJobs(jobs) {
  const newJobs = [];
  const chunkSize = 25;

  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(job => checkAndAddJob(job)));
    for (const res of results) {
      if (res) newJobs.push(res);
    }
  }

  return newJobs;
}
