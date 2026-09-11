import "dotenv/config";
import { Redis } from "@upstash/redis";
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

async function migrate() {
  console.log("🚀 Starting Upstash Redis to MongoDB Migration...");

  let seenJobs = [];
  let seenTitles = [];

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      console.log("📥 Fetching seen_jobs & seen_job_titles from Upstash Redis...");
      [seenJobs, seenTitles] = await Promise.all([
        redis.smembers("seen_jobs").catch(() => []),
        redis.smembers("seen_job_titles").catch(() => []),
      ]);
      console.log(`✅ Retrieved from Upstash: ${seenJobs.length} job IDs and ${seenTitles.length} title hashes.`);
    } catch (err) {
      console.warn(`⚠️ Warning reading from Upstash: ${err.message}`);
    }
  }

  // Backup to local JSON file
  const backupDir = path.resolve("./data");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, "seen_jobs_backup.json");
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ seenJobs, seenTitles, exportedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`💾 Saved backup locally to ${backupFile}`);

  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI not found in .env");
    return;
  }

  console.log("🔗 Connecting to MongoDB Atlas...");
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log("✅ Connected to MongoDB Atlas!");

  const db = client.db(process.env.MONGODB_DB_NAME || "job_bot");
  const seenJobsCol = db.collection("seen_jobs");

  // Ensure unique index on `key`
  await seenJobsCol.createIndex({ key: 1 }, { unique: true });
  console.log("✅ Unique index created on seen_jobs.key");

  const allKeys = new Set([...seenJobs, ...seenTitles]);
  console.log(`📦 Preparing to insert ${allKeys.size} total unique keys into MongoDB...`);

  if (allKeys.size > 0) {
    const docs = Array.from(allKeys).map((k) => ({
      key: k,
      createdAt: new Date(),
    }));

    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      try {
        const res = await seenJobsCol.insertMany(batch, { ordered: false });
        inserted += res.insertedCount;
      } catch (err) {
        if (err.code === 11000 || err.writeErrors) {
          inserted += err.result?.nInserted || (err.result?.insertedIds ? Object.keys(err.result.insertedIds).length : 0);
        } else {
          console.error(`Error in batch: ${err.message}`);
        }
      }
    }
    console.log(`🎉 Successfully migrated ${inserted} keys to MongoDB Atlas!`);
  }

  const totalInDb = await seenJobsCol.countDocuments();
  console.log(`📊 Total records now in MongoDB Atlas seen_jobs: ${totalInDb}`);

  await client.close();
  console.log("🏁 Migration completed successfully!");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
