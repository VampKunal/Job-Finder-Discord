/**
 * Reddit Job Subreddit Fetcher (Strict Employer Hiring Only)
 * Uses Reddit's public .json endpoint (no auth, no API key needed)
 * Scrapes: r/forhire, r/remotejobs, r/developersIndia
 */

import crypto from "crypto";

const SUBREDDITS = [
  { sub: "forhire", query: "flair:Hiring OR title:[Hiring]", sort: "new" },
  { sub: "remotejobs", query: "title:hiring", sort: "new" },
  { sub: "developersIndia", query: "flair:Hiring", sort: "new" }
];

export async function fetchRedditJobs() {
  const jobs = [];
  const seen = new Set();

  for (const { sub, query, sort } of SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=${sort}&t=week&limit=30`;

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

        const title = (p.title || "").trim();
        const titleLower = title.toLowerCase();
        const flairLower = (p.link_flair_text || "").toLowerCase();

        // 1. Instantly reject job seeker / freelancer for-hire posts
        if (
          titleLower.includes("[for hire]") || titleLower.includes("[forhire]") ||
          titleLower.includes("[hire me]") || titleLower.includes("[seeking]") ||
          titleLower.includes("looking for job") || titleLower.includes("seeking job") ||
          titleLower.includes("looking for work") || titleLower.includes("seeking internship") ||
          flairLower.includes("for hire") || flairLower.includes("seeking") ||
          flairLower.includes("question") || flairLower.includes("discussion") ||
          flairLower.includes("rant") || flairLower.includes("resume")
        ) {
          continue;
        }

        // 2. Must have explicit employer hiring marker
        const isEmployerHiring =
          titleLower.includes("[hiring]") ||
          titleLower.startsWith("hiring:") ||
          titleLower.includes("we are hiring") ||
          titleLower.includes("we're hiring") ||
          flairLower.includes("hiring");

        if (!isEmployerHiring) continue;

        const stableKey = `reddit_${p.id}`;
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const description = (p.selftext || "").replace(/\n{3,}/g, "\n\n").substring(0, 1500);
        if (description.length < 50) continue; // Skip empty/stub posts

        const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

        // Try to extract company name from title e.g. "[Hiring] Acme Corp is looking for..."
        let company = `r/${sub}`;
        const compMatch = title.match(/\[hiring\]\s*([^|\-:]+?)\s*(?:is hiring|is looking|seeks|[-|:])/i);
        if (compMatch && compMatch[1] && compMatch[1].trim().length < 40) {
          company = compMatch[1].trim();
        }

        jobs.push({
          id: `reddit-${hash}`,
          title: title.replace(/^\[hiring\]\s*/i, "").substring(0, 150),
          company: company,
          link: `https://reddit.com${p.permalink}`,
          location: "Remote",
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
