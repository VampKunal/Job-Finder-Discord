/**
 * Hacker News "Who's Hiring" Monthly Thread Fetcher
 * Uses Algolia HN Search API (free, no auth, no rate limit issues)
 * Captures startup/tech jobs posted monthly by founders and hiring managers
 */

import crypto from "crypto";

export async function fetchHNHiringJobs() {
  try {
    // 1. Fetch the latest official "Ask HN: Who is hiring?" monthly thread
    const storyRes = await fetch("https://hn.algolia.com/api/v1/search_by_date?query=Ask%20HN:%20Who%20is%20hiring&tags=story,author_whoishiring&hitsPerPage=1", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0" }
    });

    if (!storyRes.ok) return [];
    const storyData = await storyRes.json();
    const story = storyData.hits?.[0];

    if (!story || !story.objectID) {
      return [];
    }

    // 2. Fetch top-level hiring submissions on this active monthly thread
    const commentsRes = await fetch(`https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_${story.objectID}&hitsPerPage=100`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0" }
    });

    if (!commentsRes.ok) return [];
    const commentsData = await commentsRes.json();
    const hits = commentsData.hits || [];

    const jobs = [];
    const seen = new Set();

    for (const hit of hits) {
      // Focus on top-level comments posted under the main thread
      if (hit.parent_id && hit.parent_id !== parseInt(story.objectID, 10)) {
        continue;
      }

      const text = hit.comment_text || "";
      if (text.length < 80) continue;

      // Reject candidates seeking work
      const textLower = text.toLowerCase();
      if (
        textLower.includes("seeking work") || textLower.includes("seeking freelancer") ||
        textLower.includes("looking for work") || textLower.includes("looking for a job") ||
        textLower.includes("[for hire]")
      ) {
        continue;
      }

      // HN hiring comments start with "Company Name | Role | Location | ..."
      const cleanText = text.replace(/<[^>]*>?/gm, " ").replace(/&[a-z]+;/gi, " ").trim();
      const firstLine = cleanText.split("\n")[0].trim();
      const parts = firstLine.split("|").map(p => p.trim());

      if (parts.length < 2) continue;

      const company = parts[0].substring(0, 80) || "HN Startup";
      const title = parts[1].substring(0, 120) || "Software Role";
      const location = parts[2] || "Remote";

      // Skip if company or title indicates seeker
      if (/seeking|looking for work|hire me/i.test(company) || /seeking|looking for work|hire me/i.test(title)) {
        continue;
      }

      const stableKey = `hn_${company}_${title}`.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(stableKey)) continue;
      seen.add(stableKey);

      const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

      jobs.push({
        id: `hn-${hash}`,
        title: title,
        company: company,
        link: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        location: location,
        description: cleanText.substring(0, 1500),
        date: hit.created_at ? new Date(hit.created_at).toISOString() : new Date().toISOString(),
        source: "Hacker News (Who's Hiring)"
      });
    }

    return jobs;
  } catch (err) {
    console.error(`[HN Hiring] Fetch failed: ${err.message}`);
    return [];
  }
}
