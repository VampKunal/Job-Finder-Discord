/**
 * LinkedIn Public Guest Jobs API Fetcher v3 (Ultra-Fast Parallel)
 * 
 * Performance & Priority Optimizations:
 * - Reduced timeout to 5s per request via fetchWithTimeout
 * - Runs ALL search queries concurrently in parallel with Promise.allSettled
 * - Consolidates queries into top-yield tech & fresher roles for India
 * - Scrape completes in ~2 to 4 seconds total
 */

import * as cheerio from "cheerio";
import { fetchWithTimeout } from "../tools/fetch.js";

export async function fetchLinkedInJobs() {
  const searchQueries = [
    { keywords: "software intern", location: "India" },
    { keywords: "software engineer fresher", location: "India" },
    { keywords: "full stack developer", location: "India" },
    { keywords: "frontend developer", location: "India" },
    { keywords: "backend developer", location: "India" },
    { keywords: "python developer fresher", location: "India" },
    { keywords: "react developer intern", location: "India" },
    { keywords: "AI ML intern", location: "India" },
    { keywords: "SDE intern", location: "India" },
    { keywords: "software trainee", location: "India" },
    { keywords: "graduate engineer trainee", location: "India" },
    { keywords: "software intern", location: "Delhi NCR" },
    { keywords: "software engineer entry level remote", location: "India" }
  ];

  const jobs = [];
  const seen = new Set();

  async function processQuery(q) {
    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(q.keywords)}&location=${encodeURIComponent(q.location)}&sortBy=DD&f_TPR=r86400&start=0`;

      const res = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        }
      }, 5000);

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
      return [];
    }
  }

  // Execute ALL queries concurrently for maximum speed
  const results = await Promise.allSettled(searchQueries.map(q => processQuery(q)));
  results.forEach(res => {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      jobs.push(...res.value);
    }
  });

  return jobs;
}
