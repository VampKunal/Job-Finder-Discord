/**
 * Unstop (formerly D2C) Opportunities Fetcher (Optimized)
 */

import crypto from "crypto";
import { fetchWithTimeout } from "../tools/fetch.js";

const UNSTOP_PAGES = [
  "https://r.jina.ai/https://unstop.com/internships?oppstatus=recent&searchTerm=software",
  "https://r.jina.ai/https://unstop.com/internships?oppstatus=recent&searchTerm=web+developer",
  "https://r.jina.ai/https://unstop.com/jobs?oppstatus=recent&searchTerm=fresher+software"
];

async function scrapePage(url, seen) {
  const jobs = [];
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0",
        "X-Return-Format": "text"
      }
    }, 8000);

    if (!res.ok) return [];

    const text = await res.text();
    const lines = text.split("\n");
    let currentJob = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if ((trimmed.startsWith("### ") || trimmed.startsWith("## ")) && trimmed.length > 10) {
        if (currentJob && currentJob.title && currentJob.description.length > 30) {
          jobs.push(currentJob);
        }

        const titleClean = trimmed.replace(/^[#]+\s*/, "").replace(/\[|\]/g, "").trim();
        if (titleClean.length < 5) continue;

        const stableKey = `unstop_${titleClean}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

        currentJob = {
          id: `unstop-${hash}`,
          title: titleClean.substring(0, 150),
          company: "Unstop Employer",
          link: "https://unstop.com/internships",
          location: "India",
          description: "",
          date: new Date().toISOString(),
          source: "Unstop"
        };
      } else if (currentJob && trimmed.length > 15) {
        currentJob.description += ` ${trimmed}`;
      }
    }
    if (currentJob && currentJob.title && currentJob.description.length > 30) {
      jobs.push(currentJob);
    }
  } catch (e) {
    console.warn(`[Unstop] Jina fetch failed: ${e.message}`);
  }

  return jobs;
}

export async function fetchUnstopJobs() {
  const seen = new Set();
  const results = await Promise.allSettled(UNSTOP_PAGES.map(url => scrapePage(url, seen)));
  const jobs = [];

  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      jobs.push(...res.value);
    }
  }

  return jobs.slice(0, 40);
}
