/**
 * Reddit Job Subreddit Fetcher (Strict Employer Hiring Only)
 * Uses Reddit's public RSS search feeds to bypass JSON 403 bot blocks
 */

import Parser from "rss-parser";
import crypto from "crypto";

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
  }
});

const SUBREDDIT_FEEDS = [
  { sub: "developersIndia", url: "https://www.reddit.com/r/developersIndia/search.rss?q=flair:Hiring&restrict_sr=1&sort=new" },
  { sub: "forhire", url: "https://www.reddit.com/r/forhire/search.rss?q=flair:Hiring&restrict_sr=1&sort=new" },
  { sub: "remotejobs", url: "https://www.reddit.com/r/remotejobs/search.rss?q=title:hiring&restrict_sr=1&sort=new" }
];

export async function fetchRedditJobs() {
  const jobs = [];
  const seen = new Set();

  for (const { sub, url } of SUBREDDIT_FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      const items = feed.items || [];

      for (const item of items) {
        const title = (item.title || "").trim();
        const titleLower = title.toLowerCase();

        // 1. Instantly reject job seeker / freelancer for-hire posts
        if (
          titleLower.includes("[for hire]") || titleLower.includes("[forhire]") ||
          titleLower.includes("[hire me]") || titleLower.includes("[seeking]") ||
          titleLower.includes("looking for job") || titleLower.includes("seeking job") ||
          titleLower.includes("looking for work") || titleLower.includes("seeking internship") ||
          titleLower.includes("rant") || titleLower.includes("resume") ||
          titleLower.includes("discussion") || titleLower.includes("question")
        ) {
          continue;
        }

        // 2. Must have explicit employer hiring marker
        const isEmployerHiring =
          titleLower.includes("[hiring]") ||
          titleLower.startsWith("hiring:") ||
          titleLower.includes("we are hiring") ||
          titleLower.includes("we're hiring") ||
          titleLower.includes("hiring for") ||
          titleLower.includes("job opening") ||
          titleLower.includes("hiring mega");

        if (!isEmployerHiring) continue;

        const rawLink = (item.link || "").trim();
        if (!rawLink) continue;

        const stableKey = `reddit_${title}_${rawLink}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const description = (item.contentSnippet || item.content || "").replace(/<[^>]*>?/gm, "").replace(/\n{3,}/g, "\n\n").substring(0, 1500);
        if (description.length < 30) continue;

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
          link: rawLink,
          location: "Remote",
          description: description,
          date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          source: `Reddit (r/${sub})`
        });
      }
    } catch (e) {
      console.warn(`[Reddit] r/${sub} RSS fetch failed: ${e.message}`);
    }
  }

  return jobs;
}
