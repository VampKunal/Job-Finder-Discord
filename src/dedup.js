import "dotenv/config";
import { MongoClient } from "mongodb";
import crypto from "crypto";

const inMemoryCache = new Set();
let mongoClient = null;
let seenJobsCol = null;
let initPromise = null;

async function getCollection() {
  if (seenJobsCol) return seenJobsCol;
  if (!process.env.MONGODB_URI) {
    return null;
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        mongoClient = new MongoClient(process.env.MONGODB_URI, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
        });
        await mongoClient.connect();
        const db = mongoClient.db(process.env.MONGODB_DB_NAME || "job_bot");
        const col = db.collection("seen_jobs");
        await col.createIndex({ key: 1 }, { unique: true }).catch(() => {});
        seenJobsCol = col;
        console.log("[Dedup] Connected to MongoDB Atlas deduplication store.");
        return col;
      } catch (err) {
        console.error(`[Dedup] Failed to connect to MongoDB: ${err.message}. Falling back to in-memory cache.`);
        initPromise = null;
        return null;
      }
    })();
  }

  return initPromise;
}

export function getTitleCompanyKey(job) {
  const comp = (job.company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const title = (job.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return crypto.createHash("md5").update(`${comp}_${title}`).digest("hex").substring(0, 16);
}

/**
 * Filter an array of jobs, returning only jobs that haven't been seen before.
 * Uses in-memory cache + single bulk query in MongoDB.
 */
export async function deduplicateJobs(jobs) {
  if (!jobs || jobs.length === 0) return [];

  const col = await getCollection();
  const candidateJobs = [];
  const candidateKeys = [];

  for (const job of jobs) {
    const jobId = job.id || getTitleCompanyKey(job);
    const titleKey = getTitleCompanyKey(job);

    // Fast check in memory cache
    if (inMemoryCache.has(jobId) || inMemoryCache.has(titleKey)) {
      continue;
    }

    candidateJobs.push({ job, jobId, titleKey });
    candidateKeys.push(jobId, titleKey);
  }

  if (candidateJobs.length === 0) {
    return [];
  }

  // If MongoDB is available, query DB for any existing keys in bulk
  let dbSeenSet = new Set();
  if (col) {
    try {
      const existingDocs = await col
        .find({ key: { $in: candidateKeys } }, { projection: { key: 1 } })
        .toArray();

      for (const doc of existingDocs) {
        dbSeenSet.add(doc.key);
        inMemoryCache.add(doc.key); // Populate memory cache
      }
    } catch (err) {
      console.warn(`[Dedup] MongoDB bulk query error: ${err.message}. Using local memory cache.`);
    }
  }

  const newJobs = [];
  const newKeysToInsert = [];

  for (const { job, jobId, titleKey } of candidateJobs) {
    if (dbSeenSet.has(jobId) || dbSeenSet.has(titleKey)) {
      continue;
    }

    // Mark in memory immediately
    inMemoryCache.add(jobId);
    inMemoryCache.add(titleKey);
    newKeysToInsert.push({ key: jobId, createdAt: new Date() });
    newKeysToInsert.push({ key: titleKey, createdAt: new Date() });
    newJobs.push(job);
  }

  // Bulk insert new keys into MongoDB in background
  if (col && newKeysToInsert.length > 0) {
    col.insertMany(newKeysToInsert, { ordered: false }).catch((err) => {
      // Ignore duplicate key errors (code 11000)
      if (err.code !== 11000 && !err.writeErrors) {
        console.warn(`[Dedup] MongoDB insertMany warning: ${err.message}`);
      }
    });
  }

  return newJobs;
}
