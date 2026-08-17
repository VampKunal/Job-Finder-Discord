/**
 * Reddit Job Subreddit Fetcher
 * Uses Reddit's public .json endpoint (no auth, no API key needed)
 * Scrapes: r/forhire, r/remotejobs, r/cscareerquestions, r/developersIndia
 */

import crypto from "crypto";

const SUBREDDITS = [
  { sub: "forhire", query: "hiring", sort: "new" },
  { sub: "remotejobs", query: "", sort: "new" },
  { sub: "developersIndia", query: "hiring OR internship OR job", sort: "new" },
  { sub: "cscareerquestions", query: "hiring thread", sort: "new" },
  { sub: "remotejs", query: "", sort: "new" },
  { sub: "techjobs", query: "", sort: "new" }
];

export async function fetchRedditJobs() {
  const jobs = [];
  const seen = new Set();

  for (const { sub, query, sort } of SUBREDDITS) {
    try {
      const url = query
        ? `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=${sort}&t=week&limit=50`
        : `https://www.reddit.com/r/${sub}/${sort}.json?limit=50`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0",
          "Accept": "application/json"
        }
      });

      if (!res.ok) continue;
      const data = await res.json();
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const p = post.data;
        if (!p || p.removed_by_category) continue;

        const titleLower = (p.title || "").toLowerCase();
        // Only pick up posts that look like job postings
        const isJobPost = /\bhir(ing|e)\b|\bjob\b|\bintern\b|\bfresher\b|\bremote\b|\bdeveloper\b|\bengineer\b|\bopening\b/i.test(titleLower);
        if (!isJobPost) continue;

        const stableKey = `reddit_${p.id}`;
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const description = (p.selftext || "").replace(/\n{3,}/g, "\n\n").substring(0, 1500);
        if (description.length < 80) continue; // Skip low-effort posts

        const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

        jobs.push({
          id: `reddit-${hash}`,
          title: (p.title || "Job Posting").substring(0, 150),
          company: `r/${sub}`,
          link: `https://reddit.com${p.permalink}`,
          location: "Remote / Unspecified",
          description: description,
          date: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
          source: `Reddit (r/${sub})`
        });
      }
    } catch (e) {
      console.warn(`[Reddit] r/${sub} fetch failed: ${e.message}`);
    }
  }

  return jobs;
}
