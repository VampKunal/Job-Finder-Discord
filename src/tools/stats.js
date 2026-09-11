import "dotenv/config";
import { MongoClient } from "mongodb";
import { loadProfiles } from "../score.js";

export async function getBotStats() {
  const profiles = loadProfiles();
  let seenJobsCount = 0;

  if (process.env.MONGODB_URI) {
    let client;
    try {
      client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
      await client.connect();
      const db = client.db(process.env.MONGODB_DB_NAME || "job_bot");
      seenJobsCount = await db.collection("seen_jobs").countDocuments();
    } catch (e) {
      console.warn(`[Stats] Error querying stats: ${e.message}`);
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }

  const candidateNames = profiles.map(p => p.name).join(", ");

  return `📊 **Job Bot System Statistics**
• **Processed & Deduplicated Jobs**: ${seenJobsCount} listings tracked
• **Active Candidates**: ${profiles.length} (${candidateNames})
• **Live Data Sources**: 10 (LinkedIn, Wellfound, RemoteOK, Himalayas, Arbeitnow, WeWorkRemotely, Remotive, Jobicy, GitHub Internships, 38+ ATS Boards)
• **Database Store**: MongoDB Atlas (512MB Free Tier, Unlimited Queries)
• **LLM Scoring Engine**: Groq Llama-3.1 8B Instant / Gemini Fallback
• **Fast Polling Interval**: Every ${process.env.FAST_POLL_INTERVAL_MIN || 3} mins`;
}
