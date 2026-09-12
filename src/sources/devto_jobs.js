/**
 * Dev.to Job Listings Fetcher (Strict Hiring Only)
 * Filters Dev.to community posts to only genuine employer hiring announcements
 */

import crypto from "crypto";

export async function fetchDevToJobs() {
  try {
    const urls = [
      "https://dev.to/api/articles?tag=hiring&per_page=30&state=fresh",
      "https://dev.to/api/articles?tag=jobsearch&per_page=30&state=fresh"
    ];

    const jobs = [];
    const seen = new Set();

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 JobBot/1.0" }
        });
        if (!res.ok) continue;
        const articles = await res.json();
        if (!Array.isArray(articles)) continue;

        for (const article of articles) {
          const title = (article.title || "").trim();
          if (!title || title.length < 10) continue;

          const titleLower = title.toLowerCase();

          // Reject blog posts, tutorials, and career advice
          if (
            titleLower.includes("how to") || titleLower.includes("tips for") ||
            titleLower.includes("guide to") || titleLower.includes("why you should") ||
            titleLower.includes("my experience") || titleLower.includes("looking for job") ||
            titleLower.includes("looking for work") || titleLower.includes("[for hire]") ||
            titleLower.includes("interview questions") || titleLower.includes("roadmap")
          ) {
            continue;
          }

          // Must have explicit hiring indication in title
          const isHiring =
            titleLower.includes("[hiring]") ||
            titleLower.startsWith("hiring:") ||
            titleLower.includes("we are hiring") ||
            titleLower.includes("we're hiring") ||
            titleLower.includes("job opening") ||
            titleLower.includes("is hiring");

          if (!isHiring) continue;

          const stableKey = `devto_${article.id}`;
          if (seen.has(stableKey)) continue;
          seen.add(stableKey);

          const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);
          const company = article.organization?.name || article.user?.name || "Tech Startup";

          jobs.push({
            id: `devto-${hash}`,
            title: title.replace(/^\[hiring\]\s*/i, "").substring(0, 150),
            company: company,
            link: article.url || `https://dev.to/${article.slug}`,
            location: "Remote",
            description: (article.description || article.readable_publish_date || "").substring(0, 800),
            date: article.published_at || new Date().toISOString(),
            source: "Dev.to"
          });
        }
      } catch (e) {}
    }

    return jobs;
  } catch (err) {
    console.error(`[Dev.to] Fetch failed: ${err.message}`);
    return [];
  }
}
