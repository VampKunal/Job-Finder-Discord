import "dotenv/config";
import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in environment.");
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function cleanRedis() {
  console.log("Fetching seen_jobs from Redis...");
  const seenJobs = await redis.smembers("seen_jobs");
  console.log(`Total seen_jobs in Redis: ${seenJobs.length}`);

  const interndoorKeys = seenJobs.filter(id => id.includes("interndoor"));
  const githubKeys = seenJobs.filter(id => id.includes("gh-") || id.includes("github"));

  console.log(`Found ${interndoorKeys.length} InternDoor keys to remove.`);
  console.log(`Found ${githubKeys.length} GitHub keys to remove.`);

  const toRemove = [...interndoorKeys, ...githubKeys];

  if (toRemove.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < toRemove.length; i += chunkSize) {
      const chunk = toRemove.slice(i, i + chunkSize);
      await redis.srem("seen_jobs", ...chunk);
    }
    console.log(`Successfully removed ${toRemove.length} keys from seen_jobs.`);
  }

  const remaining = await redis.smembers("seen_jobs");
  console.log(`Remaining seen_jobs count: ${remaining.length}`);

  await redis.del("seen_job_titles");
  console.log("Cleared seen_job_titles set in Redis.");
}

cleanRedis().catch(err => {
  console.error("Error cleaning Redis:", err);
  process.exit(1);
});
