import "dotenv/config";
import { MongoClient } from "mongodb";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const inMemoryCache = new Set();
let mongoClient = null;
let seenJobsCol = null;
let initPromise = null;

const BACKUP_PATH = path.resolve(process.cwd(), "data", "seen_jobs_backup.json");

/**
 * Load local fallback cache if available
 */
function loadLocalBackup() {
  try {
    if (fs.existsSync(BACKUP_PATH)) {
      const content = fs.readFileSync(BACKUP_PATH, "utf-8");
      const data = JSON.parse(content);
      if (Array.isArray(data.seenJobs)) {
        for (const k of data.seenJobs) {
          if (k) inMemoryCache.add(k);
        }
      }
    }
  } catch (err) {
    console.warn(`[Dedup] Could not load backup seen jobs: ${err.message}`);
  }
}

// Load local backup on module import
loadLocalBackup();

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

        // Prime in-memory cache with the 5,000 most recent seen keys
        try {
          const recentDocs = await col
            .find({}, { projection: { key: 1 } })
            .sort({ _id: -1 })
            .limit(5000)
            .toArray();
          for (const doc of recentDocs) {
            if (doc.key) inMemoryCache.add(doc.key);
          }
          console.log(`[Dedup] Primed in-memory cache with ${recentDocs.length} recent keys from MongoDB.`);
        } catch (primeErr) {
          console.warn(`[Dedup] Cache priming error: ${primeErr.message}`);
        }

        return col;
      } catch (err) {
        console.error(`[Dedup] Failed to connect to MongoDB: ${err.message}. Falling back to in-memory/local cache.`);
        initPromise = null;
        return null;
      }
    })();
  }

  return initPromise;
}

/**
 * Normalize company name by stripping legal suffixes, regional designations, and standardizing
 */
export function normalizeCompany(rawCompany) {
  if (!rawCompany || typeof rawCompany !== "string") return "";
  let comp = rawCompany.toLowerCase().trim();

  // Strip common corporate, recruiter, and regional suffixes
  comp = comp.replace(/\b(private limited|pvt\.?\s*ltd\.?|ltd\.?|limited|inc\.?|llp|corp\.?|corporation|co\.?)\b/gi, "");
  comp = comp.replace(/\b(technologies|technology|tech|solutions|services|software|consulting|consultancy|labs|lab|systems|workforce|group|global|india)\b/gi, "");
  comp = comp.replace(/[^a-z0-9]/g, "");
  return comp || rawCompany.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 15);
}

/**
 * Normalize job title by extracting the primary role before pipe/delimiter tags,
 * stripping noise words, brackets, batch years, locations, and standardizing synonyms
 */
export function normalizeTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== "string") return "";
  let title = rawTitle.toLowerCase().trim();

  // 1. If title uses pipe or bullet delimiters (e.g. "Role | Entry Level | Fresher | Skills..."),
  // isolate the primary role component
  if (title.includes("|")) {
    const parts = title.split("|").map(p => p.trim()).filter(Boolean);
    if (parts.length > 0 && parts[0].length >= 3) {
      title = parts[0];
    }
  } else if (title.includes(" - ") || title.includes(" — ") || title.includes(" – ")) {
    const parts = title.split(/\s+[-—–]\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 0 && parts[0].length >= 3) {
      title = parts[0];
    }
  }

  // 2. Remove bracketed or parenthetical tags like (Fresher), [2025 Batch], (Gurugram), (WFH)
  title = title.replace(/\((?:[^)]+)\)/g, " ");
  title = title.replace(/\[(?:[^\]]+)\]/g, " ");

  // 3. Strip noise words and location/workplace tags
  title = title.replace(/\b(fresher|freshers|immediate joiner|immediate|urgent|hiring|batch|year|months?|off-campus|walk-in|entry-level|entry level|remote|wfh|work from home|india|hybrid|full-time|part-time)\b/gi, "");
  title = title.replace(/\b(?:202[3-9]|203[0-5])\b/g, ""); // strip years like 2024, 2025, 2026

  // 4. Standardize common tech job titles
  title = title.replace(/\b(software development engineer|software developer|software engineer|swe)\b/gi, "sde");
  title = title.replace(/\b(front[\s-]*end|ui developer|ui engineer)\b/gi, "frontend");
  title = title.replace(/\b(back[\s-]*end)\b/gi, "backend");
  title = title.replace(/\b(full[\s-]*stack|mern|mean)\b/gi, "fullstack");
  title = title.replace(/\b(machine[\s-]*learning)\b/gi, "ml");
  title = title.replace(/\b(artificial[\s-]*intelligence)\b/gi, "ai");
  title = title.replace(/\b(internship|interns|trainee|apprentice)\b/gi, "intern");
  title = title.replace(/\b(developer|engineers?|dev)\b/gi, "dev");

  // Keep only alphanumeric
  title = title.replace(/[^a-z0-9]/g, "");
  return title || rawTitle.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20);
}

/**
 * Generate stable Title + Company deduplication hash
 */
export function getTitleCompanyKey(job) {
  const comp = normalizeCompany(job.company || "company");
  const title = normalizeTitle(job.title || "title");
  const rawHash = crypto.createHash("md5").update(`${comp}_${title}`).digest("hex").substring(0, 16);
  return `tc_${rawHash}`;
}

/**
 * Normalize job URL by stripping tracking parameters, query noise, and fragments
 */
export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    const trimmed = rawUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;

    const parsed = new URL(trimmed);
    parsed.hash = ""; // remove fragment

    // Strip common tracking and referral query parameters
    const dropParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "source", "fbclid", "gclid", "trk", "trackingid", "position",
      "refid", "pagenum", "kid", "sourcetype", "gh_src", "lever-source"
    ];

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (dropParams.includes(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }

    let clean = parsed.toString().toLowerCase();
    // Strip trailing slash
    clean = clean.replace(/\/+$/, "");
    return clean;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Generate stable URL deduplication hash
 */
export function getUrlKey(job) {
  const cleanUrl = normalizeUrl(job.link);
  if (!cleanUrl) return null;
  const hash = crypto.createHash("md5").update(cleanUrl).digest("hex").substring(0, 16);
  return `url_${hash}`;
}

/**
 * Get all deduplication keys for a job (ID, Normalized Title+Company, and Normalized URL)
 */
export function getJobKeys(job) {
  const keys = [];

  if (job.id && typeof job.id === "string") {
    keys.push(job.id.trim());
  }

  const tcKey = getTitleCompanyKey(job);
  if (tcKey) {
    keys.push(tcKey);
  }

  const urlKey = getUrlKey(job);
  if (urlKey) {
    keys.push(urlKey);
  }

  return keys;
}

/**
 * Filter an array of jobs, returning only jobs that haven't been seen before.
 * Handles in-batch duplicates, cross-source URL deduplication, and title/company variations.
 * Persists to MongoDB Atlas (awaited) and backs up locally.
 */
export async function deduplicateJobs(jobs) {
  if (!jobs || jobs.length === 0) return [];

  const col = await getCollection();
  const candidateJobs = [];
  const candidateKeys = [];
  const seenInCurrentRun = new Set();

  for (const job of jobs) {
    const keys = getJobKeys(job);
    if (keys.length === 0) continue;

    // Fast check: if any key was already seen in memory or in this current batch run
    const isSeenLocally = keys.some(k => inMemoryCache.has(k) || seenInCurrentRun.has(k));
    if (isSeenLocally) {
      continue;
    }

    // Temporarily mark in current run to prevent intra-batch duplicates
    keys.forEach(k => seenInCurrentRun.add(k));
    candidateJobs.push({ job, keys });
    candidateKeys.push(...keys);
  }

  if (candidateJobs.length === 0) {
    return [];
  }

  // If MongoDB is available, query DB for any existing keys in bulk
  const dbSeenSet = new Set();
  if (col && candidateKeys.length > 0) {
    try {
      const existingDocs = await col
        .find({ key: { $in: candidateKeys } }, { projection: { key: 1 } })
        .toArray();

      for (const doc of existingDocs) {
        dbSeenSet.add(doc.key);
        inMemoryCache.add(doc.key);
      }
    } catch (err) {
      console.warn(`[Dedup] MongoDB bulk query error: ${err.message}. Relying on local cache.`);
    }
  }

  const newJobs = [];
  const uniqueKeysMap = new Map(); // key -> document to insert

  for (const { job, keys } of candidateJobs) {
    // If any key was found in MongoDB
    if (keys.some(k => dbSeenSet.has(k))) {
      continue;
    }

    // Mark all keys as seen in memory immediately
    keys.forEach(k => {
      inMemoryCache.add(k);
      if (!uniqueKeysMap.has(k)) {
        uniqueKeysMap.set(k, { key: k, createdAt: new Date() });
      }
    });

    newJobs.push(job);
  }

  // Bulk insert new keys into MongoDB and await completion
  const keysToInsert = Array.from(uniqueKeysMap.values());
  if (col && keysToInsert.length > 0) {
    try {
      await col.insertMany(keysToInsert, { ordered: false });
    } catch (err) {
      // Ignore duplicate key errors (code 11000)
      if (err.code !== 11000 && !err.writeErrors) {
        console.warn(`[Dedup] MongoDB insertMany warning: ${err.message}`);
      }
    }
  }

  // Update local backup file with newly seen keys asynchronously
  try {
    if (keysToInsert.length > 0) {
      const newKeysList = keysToInsert.map(d => d.key);
      let existingBackup = [];
      if (fs.existsSync(BACKUP_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf-8"));
        existingBackup = Array.isArray(parsed.seenJobs) ? parsed.seenJobs : [];
      }
      const updated = Array.from(new Set([...existingBackup, ...newKeysList]));
      // Keep up to 10,000 recent keys in backup
      const trimmed = updated.slice(-10000);
      fs.writeFileSync(BACKUP_PATH, JSON.stringify({ seenJobs: trimmed }, null, 2), "utf-8");
    }
  } catch (backupErr) {
    // Non-fatal backup warning
  }

  return newJobs;
}
