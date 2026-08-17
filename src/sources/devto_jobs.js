/**
 * Dev.to Job Listings Fetcher
 * Uses Dev.to's free public API to fetch job-tagged articles
 * Developer community jobs — often remote-friendly and startup-focused
 */

import crypto from "crypto";

export async function fetchDevToJobs() {
  try {
    const urls = [
      "https://dev.to/api/articles?tag=hiring&per_page=30&state=rising",
      "https://dev.to/api/articles?tag=jobs&per_page=30&state=rising",
      "https://dev.to/api/listings?per_page=50&category=cfp"
    ];

    const jobs = [];
    const seen = new Set();

    // Fetch job-tagged articles
    for (const url of urls.slice(0, 2)) {
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

          const stableKey = `devto_${article.id}`;
          if (seen.has(stableKey)) continue;
          seen.add(stableKey);

          const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

          jobs.push({
            id: `devto-${hash}`,
            title: title.substring(0, 150),
            company: article.user?.name || article.organization?.name || "Dev.to Post",
            link: article.url || `https://dev.to/${article.slug}`,
            location: "Remote",
            description: (article.description || article.readable_publish_date || "").substring(0, 800),
            date: article.published_at || new Date().toISOString(),
            source: "Dev.to"
          });
        }
      } catch (e) {}
    }

    // Fetch listings (classified-style job posts)
    try {
      const res = await fetch(urls[2], {
        headers: { "User-Agent": "Mozilla/5.0 JobBot/1.0" }
      });
      if (res.ok) {
        const listings = await res.json();
        if (Array.isArray(listings)) {
          for (const listing of listings) {
            const title = (listing.title || "").trim();
            if (!title) continue;

            const stableKey = `devto-listing-${listing.id}`;
            if (seen.has(stableKey)) continue;
            seen.add(stableKey);

            const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

            jobs.push({
              id: `devto-ls-${hash}`,
              title: title.substring(0, 150),
              company: listing.user?.name || "Dev.to Listing",
              link: `https://dev.to/listings/${listing.slug}`,
              location: listing.location || "Remote",
              description: (listing.body_markdown || "").substring(0, 800),
              date: listing.published_at || new Date().toISOString(),
              source: "Dev.to Listings"
            });
          }
        }
      }
    } catch (e) {}

    return jobs;
  } catch (err) {
    console.error(`[Dev.to] Fetch failed: ${err.message}`);
    return [];
  }
}
