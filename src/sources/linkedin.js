/**
 * LinkedIn Public Guest Jobs API Fetcher (Zero-Risk, No Auth Needed)
 * Queries LinkedIn's public guest search endpoint directly
 */

import * as cheerio from "cheerio";

export async function fetchLinkedInJobs() {
  const searchQueries = [
    { keywords: "software intern", location: "India" },
    { keywords: "full stack developer fresher", location: "India" },
    { keywords: "ai ml intern", location: "Remote" },
    { keywords: "web developer intern", location: "India" },
    { keywords: "python developer fresher", location: "India" },
    { keywords: "react developer junior", location: "Remote" },
    { keywords: "software engineer entry level", location: "Remote" },
    { keywords: "backend developer intern", location: "India" }
  ];

  const jobs = [];

  for (const q of searchQueries) {
    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(q.keywords)}&location=${encodeURIComponent(q.location)}&start=0`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });

      if (!res.ok) {
        console.warn(`[LinkedIn] Public API returned HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      $("li").each((_, el) => {
        const title = $(el).find(".base-search-card__title").text().trim();
        const company = $(el).find(".base-search-card__subtitle").text().trim();
        const location = $(el).find(".job-search-card__location").text().trim();
        const link = $(el).find("a.base-card__full-link").attr("href");
        const dateText = $(el).find("time").attr("datetime") || $(el).find("time").text().trim();

        if (title && link) {
          const cleanLink = link.split("?")[0]; // Clean tracking params
          const jobId = cleanLink.split("-").pop() || Math.random().toString(36).substring(7);

          jobs.push({
            id: `linkedin-${jobId}`,
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

    } catch (err) {
      console.warn(`[LinkedIn] Fetch error for "${q.keywords}": ${err.message}`);
    }
  }

  return jobs;
}
