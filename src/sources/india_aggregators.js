/**
 * Google Jobs / Free India Aggregator Direct Listings Fetcher
 * Only emits opportunities with verified individual job links (rejects search landing pages)
 */

import crypto from "crypto";
import { fetchWithTimeout } from "../tools/fetch.js";

const INDIA_JOB_PAGES = [
  { url: "https://r.jina.ai/https://www.foundit.in/srp/results?searchType=personalised&query=software+intern&locations=india&experienceRanges=0~1", source: "Foundit India", location: "India" },
  { url: "https://r.jina.ai/https://www.shine.com/job-search/software-engineer-fresher-jobs", source: "Shine", location: "India" },
  { url: "https://r.jina.ai/https://www.timesjobs.com/candidate/job-search.html?searchType=personalise&from=submit&searchTextSrc=&searchTextText=software+developer&txtKeywords=software+developer+fresher&txtLocation=india&cboWorkExp1=0", source: "TimesJobs", location: "India" }
];

async function scrapeJinaPage(url, source, location) {
  const jobs = [];
  const seen = new Set();

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

      if ((trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("**")) && trimmed.length > 10) {
        // Push previous job if it has a real individual application link
        if (currentJob && currentJob.title && currentJob.link && currentJob.description.length > 30) {
          jobs.push(currentJob);
        }
        currentJob = null;

        // Must find a markdown link to a specific job post
        const linkMatch = trimmed.match(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/);
        if (!linkMatch) continue;

        const directLink = linkMatch[2].trim();
        // Reject if the link is just another search results or landing page
        if (
          !directLink ||
          directLink.includes("/job-search") ||
          directLink.includes("/srp/") ||
          directLink.includes("/candidate/") ||
          directLink.includes("/results?") ||
          directLink.endsWith(".com") ||
          directLink.endsWith(".in") ||
          directLink.endsWith(".com/") ||
          directLink.endsWith(".in/")
        ) {
          continue;
        }

        const titleClean = linkMatch[1].replace(/^[#*]+\s*/, "").replace(/\*\*/g, "").replace(/\[|\]/g, "").trim();
        if (titleClean.length < 5) continue;

        const stableKey = `${source}_${titleClean}_${directLink}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

        currentJob = {
          id: `${source.toLowerCase().replace(/[^a-z0-9]/g, "")}-${hash}`,
          title: titleClean.substring(0, 150),
          company: `${source} Listing`,
          link: directLink,
          location: location,
          description: "",
          date: new Date().toISOString(),
          source: source
        };
      } else if (currentJob && trimmed.length > 15) {
        if (/^at\s|^company:\s|^employer:\s/i.test(trimmed)) {
          currentJob.company = trimmed.replace(/^(at|company:|employer:)\s*/i, "").trim();
        } else {
          currentJob.description += ` ${trimmed}`;
        }
      }
    }

    if (currentJob && currentJob.title && currentJob.link && currentJob.description.length > 30) {
      jobs.push(currentJob);
    }
  } catch (e) {
    console.warn(`[${source}] Jina scrape failed: ${e.message}`);
  }

  return jobs;
}

export async function fetchIndiaAggregatorJobs() {
  const tasks = INDIA_JOB_PAGES.map(p => scrapeJinaPage(p.url, p.source, p.location));
  const results = await Promise.allSettled(tasks);
  const allJobs = [];

  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      allJobs.push(...result.value);
    }
  }

  return allJobs.slice(0, 40);
}
