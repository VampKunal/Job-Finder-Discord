/**
 * Discovery Statistics Module (/stats)
 */

import { Redis } from "@upstash/redis";
import { loadProfiles } from "../score.js";

export async function getBotStats() {
  const profiles = loadProfiles();
  let seenJobsCount = 0;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      seenJobsCount = await redis.scard("seen_jobs");
    } catch (e) {}
  }

  const candidateNames = profiles.map(p => p.name).join(", ");

  return `📊 **Job Bot System Statistics**
• **Processed & Deduplicated Jobs**: ${seenJobsCount} listings tracked
• **Active Candidates**: ${profiles.length} (${candidateNames})
• **Live Data Sources**: 10 (LinkedIn, Wellfound, RemoteOK, Himalayas, Arbeitnow, WeWorkRemotely, Remotive, Jobicy, GitHub Internships, 38+ ATS Boards)
• **LLM Scoring Engine**: Groq Llama-3.1 8B Instant
• **Cron Schedule**: Every 2 hours`;
}
