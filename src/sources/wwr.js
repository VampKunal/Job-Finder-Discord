/**
 * WeWorkRemotely RSS feed fetcher
 * RSS URL: https://weworkremotely.com/remote-jobs.rss
 */

import Parser from "rss-parser";

const parser = new Parser();

export async function fetchWWRJobs() {
  try {
    const feed = await parser.parseURL("https://weworkremotely.com/remote-jobs.rss");
    const items = feed.items || [];

    return items.map(item => {
      // Title format is usually "Company: Title" or "Title"
      let company = "WeWorkRemotely";
      let title = item.title || "Software Role";

      if (title.includes(":")) {
        const parts = title.split(":");
        company = parts[0].trim();
        title = parts.slice(1).join(":").trim();
      }

      const cleanedDesc = (item.contentSnippet || item.content || "").replace(/<[^>]*>?/gm, "");

      return {
        id: `wwr-${item.guid || item.link || Math.random().toString(36).substring(7)}`,
        title,
        company,
        link: item.link || "https://weworkremotely.com",
        location: "Remote",
        description: cleanedDesc,
        date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        source: "WeWorkRemotely"
      };
    });
  } catch (err) {
    console.error(`[WWR] Fetch failed: ${err.message}`);
    return [];
  }
}
