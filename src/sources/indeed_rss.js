/**
 * Indeed RSS Feed Fetcher v2 — India-Only
 * Uses Indeed India's RSS endpoint for job searches
 * No auth, no API key — just RSS feeds with India-targeted queries
 */

import Parser from "rss-parser";
import crypto from "crypto";

const parser = new Parser();

const INDEED_FEEDS = [
  // Indeed India (in.indeed.com)
  { url: "https://in.indeed.com/rss?q=software+intern&l=india&sort=date&limit=25", label: "India Software Intern" },
  { url: "https://in.indeed.com/rss?q=web+developer+fresher&l=india&sort=date&limit=25", label: "India Web Dev Fresher" },
  { url: "https://in.indeed.com/rss?q=python+developer+fresher&l=india&sort=date&limit=25", label: "India Python Fresher" },
  { url: "https://in.indeed.com/rss?q=full+stack+intern&l=india&sort=date&limit=25", label: "India Full Stack Intern" },
  { url: "https://in.indeed.com/rss?q=react+developer+fresher&l=india&sort=date&limit=25", label: "India React Fresher" },
  { url: "https://in.indeed.com/rss?q=machine+learning+intern&l=india&sort=date&limit=25", label: "India ML Intern" },
  { url: "https://in.indeed.com/rss?q=software+engineer+entry+level&l=india&sort=date&limit=25", label: "India Entry Level SWE" },
  { url: "https://in.indeed.com/rss?q=data+science+fresher&l=india&sort=date&limit=25", label: "India Data Science" },
  { url: "https://in.indeed.com/rss?q=java+developer+fresher&l=india&sort=date&limit=25", label: "India Java Fresher" },
  { url: "https://in.indeed.com/rss?q=backend+developer+intern&l=india&sort=date&limit=25", label: "India Backend Intern" },
  // City-specific for higher volume
  { url: "https://in.indeed.com/rss?q=software+intern&l=bangalore&sort=date&limit=25", label: "Bangalore SWE Intern" },
  { url: "https://in.indeed.com/rss?q=software+intern&l=hyderabad&sort=date&limit=25", label: "Hyderabad SWE Intern" },
  { url: "https://in.indeed.com/rss?q=software+intern&l=pune&sort=date&limit=25", label: "Pune SWE Intern" },
  { url: "https://in.indeed.com/rss?q=software+intern&l=delhi&sort=date&limit=25", label: "Delhi SWE Intern" }
];

export async function fetchIndeedRSSJobs() {
  const jobs = [];
  const seen = new Set();

  for (const feed of INDEED_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      const items = result.items || [];

      for (const item of items) {
        const title = (item.title || "").trim();
        const link = (item.link || "").trim();
        if (!title || !link) continue;

        const stableKey = `indeed_${title}_${link}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);
        const description = (item.contentSnippet || item.content || "").replace(/<[^>]*>?/gm, "");

        jobs.push({
          id: `indeed-${hash}`,
          title: title,
          company: item.source || item.author || "Indeed India Employer",
          link: link,
          location: "India",
          description: description.length > 50 ? description : `${title}. Found via Indeed India RSS (${feed.label}).`,
          date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          source: `Indeed India (${feed.label})`
        });
      }
    } catch (e) {
      // Indeed may block some feeds, just skip silently
    }
  }

  return jobs;
}
