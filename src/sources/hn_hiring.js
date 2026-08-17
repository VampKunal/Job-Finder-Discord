/**
 * Hacker News "Who's Hiring" Monthly Thread Fetcher
 * Uses Algolia HN Search API (free, no auth, no rate limit issues)
 * Captures startup/tech jobs posted monthly by founders and hiring managers
 */

import crypto from "crypto";

export async function fetchHNHiringJobs() {
  try {
    // Search for recent "Who is hiring" and "Who wants to be hired" story comments
    const queries = [
      "https://hn.algolia.com/api/v1/search?query=&tags=comment,ask_hn&filters=author:whoishiring&hitsPerPage=200",
      "https://hn.algolia.com/api/v1/search_by_date?query=hiring+intern+remote&tags=comment&hitsPerPage=100"
    ];

    const jobs = [];
    const seen = new Set();

    for (const url of queries) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 JobBot/1.0" }
        });

        if (!res.ok) continue;
        const data = await res.json();
        const hits = data.hits || [];

        for (const hit of hits) {
          const text = hit.comment_text || "";
          if (text.length < 100) continue;

          // HN hiring comments usually start with "Company Name | Role | Location | ..."
          const cleanText = text.replace(/<[^>]*>?/gm, " ").replace(/&[a-z]+;/gi, " ").trim();
          const firstLine = cleanText.split("\n")[0].trim();
          const parts = firstLine.split("|").map(p => p.trim());

          if (parts.length < 2) continue;

          const company = parts[0].substring(0, 80) || "HN Startup";
          const title = parts[1].substring(0, 120) || "Software Role";
          const location = parts[2] || "Remote";

          const stableKey = `${company}_${title}`.toLowerCase().replace(/[^a-z0-9]/g, "");
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
      } catch (e) {}
    }

    return jobs;
  } catch (err) {
    console.error(`[HN Hiring] Fetch failed: ${err.message}`);
    return [];
  }
}
