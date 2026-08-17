/**
 * Indeed RSS Feed Fetcher
 * Uses Indeed's public RSS endpoint for job searches
 * No auth, no API key — just RSS feeds with targeted queries
 */

import Parser from "rss-parser";
import crypto from "crypto";

const parser = new Parser();

const INDEED_FEEDS = [
  { query: "software intern", location: "india", label: "India Software Intern" },
  { query: "web developer fresher", location: "india", label: "India Web Dev Fresher" },
  { query: "machine learning intern", location: "remote", label: "Remote ML Intern" },
  { query: "software engineer entry level", location: "remote", label: "Remote Entry Level SWE" },
  { query: "python developer fresher", location: "india", label: "India Python Fresher" },
  { query: "react developer junior", location: "remote", label: "Remote Junior React" },
  { query: "full stack intern", location: "india", label: "India Full Stack Intern" }
];

export async function fetchIndeedRSSJobs() {
  const jobs = [];
  const seen = new Set();

  for (const feed of INDEED_FEEDS) {
    try {
      const url = `https://www.indeed.com/rss?q=${encodeURIComponent(feed.query)}&l=${encodeURIComponent(feed.location)}&sort=date&limit=25`;

      const result = await parser.parseURL(url);
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
          company: item.source || item.author || "Indeed Employer",
          link: link,
          location: feed.location === "india" ? "India" : "Remote",
          description: description.length > 50 ? description : `${title}. Found via Indeed RSS (${feed.label}).`,
          date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          source: `Indeed RSS (${feed.label})`
        });
      }
    } catch (e) {
      // Indeed may block some feeds, just skip silently
    }
  }

  return jobs;
}
