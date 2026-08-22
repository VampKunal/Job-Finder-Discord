/**
 * Google Jobs / SerpAPI-Free RSS Fetcher for India Fresher Jobs
 * Uses Google's job search RSS/Atom-like endpoints
 * Also scrapes Google Careers (google.com/about/careers) for India intern roles
 */

import crypto from "crypto";

const GOOGLE_CAREER_PAGES = [
  // Google's own careers API for India
  "https://r.jina.ai/https://www.google.com/about/careers/applications/jobs/results?location=India&target_level=INTERN_AND_APPRENTICE&category=SOFTWARE_ENGINEERING",
  "https://r.jina.ai/https://www.google.com/about/careers/applications/jobs/results?location=India&target_level=EARLY&category=SOFTWARE_ENGINEERING"
];

// Additional India-focused job aggregator pages via Jina
const INDIA_JOB_PAGES = [
  { url: "https://r.jina.ai/https://www.foundit.in/srp/results?searchType=personalised&query=software+intern&locations=india&experienceRanges=0~1", source: "Foundit (Monster India)", location: "India" },
  { url: "https://r.jina.ai/https://www.shine.com/job-search/software-engineer-fresher-jobs", source: "Shine", location: "India" },
  { url: "https://r.jina.ai/https://www.timesjobs.com/candidate/job-search.html?searchType=personalise&from=submit&searchTextSrc=&searchTextText=software+developer&txtKeywords=software+developer+fresher&txtLocation=india&cboWorkExp1=0", source: "TimesJobs", location: "India" }
];

async function scrapeJinaPage(url, source, location) {
  const jobs = [];
  const seen = new Set();

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0",
        "X-Return-Format": "text"
      }
    });

    if (!res.ok) return [];

    const text = await res.text();
    const lines = text.split("\n");
    let currentJob = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if ((trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("**")) && trimmed.length > 10) {
        if (currentJob && currentJob.title && currentJob.description.length > 30) {
          jobs.push(currentJob);
        }

        const titleClean = trimmed.replace(/^[#*]+\s*/, "").replace(/\*\*/g, "").replace(/\[|\]/g, "").trim();
        if (titleClean.length < 5) continue;

        const stableKey = `${source}_${titleClean}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

        currentJob = {
          id: `${source.toLowerCase().replace(/[^a-z0-9]/g, "")}-${hash}`,
          title: titleClean.substring(0, 150),
          company: `${source} Employer`,
          link: url.replace("https://r.jina.ai/", ""),
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
    if (currentJob && currentJob.title && currentJob.description.length > 30) {
      jobs.push(currentJob);
    }
  } catch (e) {
    console.warn(`[${source}] Jina scrape failed: ${e.message}`);
  }

  return jobs;
}

export async function fetchIndiaAggregatorJobs() {
  const allJobs = [];

  // Fetch all India aggregator pages concurrently
  const tasks = [
    ...GOOGLE_CAREER_PAGES.map(url => scrapeJinaPage(url, "Google Careers India", "India")),
    ...INDIA_JOB_PAGES.map(p => scrapeJinaPage(p.url, p.source, p.location))
  ];

  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      allJobs.push(...result.value);
    }
  }

  return allJobs.slice(0, 80);
}
