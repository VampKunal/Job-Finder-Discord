/**
 * Indeed RSS Feed Fetcher v2 — India-Only (Optimized)
 */

import Parser from "rss-parser";
import crypto from "crypto";

const parser = new Parser({ timeout: 7000 });

const INDEED_FEEDS = [
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
  { url: "https://in.indeed.com/rss?q=software+intern&l=bangalore&sort=date&limit=25", label: "Bangalore SWE Intern" },
  { url: "https://in.indeed.com/rss?q=software+intern&l=hyderabad&sort=date&limit=25", label: "Hyderabad SWE Intern" },
  { url: "https://in.indeed.com/rss?q=software+intern&l=pune&sort=date&limit=25", label: "Pune SWE Intern" },
  { url: "https://in.indeed.com/rss?q=software+intern&l=delhi&sort=date&limit=25", label: "Delhi SWE Intern" }
];

async function fetchFeed(feed, seen) {
  const jobs = [];
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
    // Indeed feeds may be blocked or throttled; skip safely
  }
  return jobs;
}

export async function fetchIndeedRSSJobs() {
  const seen = new Set();
  const results = await Promise.allSettled(INDEED_FEEDS.map(f => fetchFeed(f, seen)));
  const jobs = [];

  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      jobs.push(...res.value);
    }
  }

  return jobs;
}
