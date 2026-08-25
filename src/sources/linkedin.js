/**
 * LinkedIn Public Guest Jobs API Fetcher v2 (Optimized)
 * 
 * Changes from v1:
 * - Added strict request timeouts (7s) via fetchWithTimeout
 * - Batch concurrent query fetching (chunk size 5) to cut fetch time from 2min -> ~10sec
 * - All queries target India explicitly or Global Remote for India candidates
 */

import * as cheerio from "cheerio";
import { fetchWithTimeout } from "../tools/fetch.js";

export async function fetchLinkedInJobs() {
  const searchQueries = [
    // ── India-Explicit Queries ───────────────────────────────────────────
    { keywords: "software intern", location: "India" },
    { keywords: "software engineer fresher", location: "India" },
    { keywords: "full stack developer fresher", location: "India" },
    { keywords: "web developer intern", location: "India" },
    { keywords: "python developer fresher", location: "India" },
    { keywords: "react developer intern", location: "India" },
    { keywords: "backend developer intern", location: "India" },
    { keywords: "frontend developer fresher", location: "India" },
    { keywords: "machine learning intern", location: "India" },
    { keywords: "data science intern", location: "India" },
    { keywords: "AI intern", location: "India" },
    { keywords: "cloud engineer fresher", location: "India" },
    { keywords: "devops intern", location: "India" },
    { keywords: "java developer fresher", location: "India" },
    { keywords: "node.js developer fresher", location: "India" },
    { keywords: "software trainee", location: "India" },
    { keywords: "graduate engineer trainee", location: "India" },
    { keywords: "SDE intern", location: "India" },
    // ── Specific Indian Cities ───────────────────────────────────────────
    { keywords: "software intern", location: "Bangalore" },
    { keywords: "software intern", location: "Hyderabad" },
    { keywords: "software intern", location: "Pune" },
    { keywords: "software intern", location: "Delhi NCR" },
    { keywords: "software intern", location: "Mumbai" },
    // ── Remote (but India eligible) ──────────────────────────────────────
    { keywords: "software engineer entry level remote worldwide", location: "India" },
    { keywords: "intern remote global", location: "India" }
  ];

  const jobs = [];
  const seen = new Set();

  async function processQuery(q) {
    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(q.keywords)}&location=${encodeURIComponent(q.location)}&start=0`;

      const res = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        }
      }, 7000);

      if (!res.ok) return [];

      const html = await res.text();
      const $ = cheerio.load(html);
      const queryJobs = [];

      $("li").each((_, el) => {
        const title = $(el).find(".base-search-card__title").text().trim();
        const company = $(el).find(".base-search-card__subtitle").text().trim();
        const location = $(el).find(".job-search-card__location").text().trim();
        const link = $(el).find("a.base-card__full-link").attr("href");
        const dateText = $(el).find("time").attr("datetime") || $(el).find("time").text().trim();

        if (title && link) {
          const cleanLink = link.split("?")[0];
          const jobId = cleanLink.split("-").pop() || Math.random().toString(36).substring(7);
          const dedupKey = `linkedin-${jobId}`;

          if (seen.has(dedupKey)) return;
          seen.add(dedupKey);

          queryJobs.push({
            id: dedupKey,
            title,
            company: company || "LinkedIn Employer",
            link: cleanLink,
            location: location || q.location,
            description: `${title} at ${company || "Company"}. Location: ${location || q.location}. Found via LinkedIn Public Jobs Search.`,
            date: dateText ? new Date(dateText).toISOString() : new Date().toISOString(),
            source: "LinkedIn Public"
          });
        }
      });

      return queryJobs;
    } catch (err) {
      console.warn(`[LinkedIn] Fetch error for "${q.keywords}": ${err.message}`);
      return [];
    }
  }

  // Chunk queries into batches of 5 for parallel fetching
  const chunkSize = 5;
  for (let i = 0; i < searchQueries.length; i += chunkSize) {
    const chunk = searchQueries.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(q => processQuery(q)));
    chunkResults.forEach(res => jobs.push(...res));
  }

  return jobs;
}
