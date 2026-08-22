/**
 * Naukri.com RSS Fetcher — India's #1 Job Portal
 * Uses Naukri's public RSS feeds for targeted fresher/intern job searches
 * These feeds are freely available with no auth required
 */

import Parser from "rss-parser";
import crypto from "crypto";

const parser = new Parser({
  customFields: { item: ["company"] }
});

const NAUKRI_FEEDS = [
  { url: "https://www.naukri.com/rss?ql=software+engineer+fresher&l=india&experience=0&qf=", label: "SWE Fresher" },
  { url: "https://www.naukri.com/rss?ql=web+developer+fresher&l=india&experience=0&qf=", label: "Web Dev Fresher" },
  { url: "https://www.naukri.com/rss?ql=python+developer+fresher&l=india&experience=0&qf=", label: "Python Fresher" },
  { url: "https://www.naukri.com/rss?ql=react+developer+fresher&l=india&experience=0&qf=", label: "React Fresher" },
  { url: "https://www.naukri.com/rss?ql=full+stack+developer+fresher&l=india&experience=0&qf=", label: "Full Stack Fresher" },
  { url: "https://www.naukri.com/rss?ql=machine+learning+intern&l=india&experience=0&qf=", label: "ML Intern" },
  { url: "https://www.naukri.com/rss?ql=software+intern&l=india&experience=0&qf=", label: "SWE Intern" },
  { url: "https://www.naukri.com/rss?ql=data+science+fresher&l=india&experience=0&qf=", label: "Data Science Fresher" },
  { url: "https://www.naukri.com/rss?ql=node+developer+fresher&l=india&experience=0&qf=", label: "Node Fresher" },
  { url: "https://www.naukri.com/rss?ql=java+developer+fresher&l=india&experience=0&qf=", label: "Java Fresher" }
];

export async function fetchNaukriJobs() {
  const jobs = [];
  const seen = new Set();

  for (const feed of NAUKRI_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      const items = result.items || [];

      for (const item of items) {
        const title = (item.title || "").trim();
        const link = (item.link || "").trim();
        if (!title || !link) continue;

        const stableKey = `naukri_${title}_${link}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);
        const description = (item.contentSnippet || item.content || "").replace(/<[^>]*>?/gm, "");

        jobs.push({
          id: `naukri-${hash}`,
          title,
          company: item.company || item.creator || "Naukri Employer",
          link,
          location: "India",
          description: description.length > 50 ? description : `${title}. Found via Naukri RSS (${feed.label}).`,
          date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          source: `Naukri (${feed.label})`
        });
      }
    } catch (e) {
      // Naukri may throttle — skip silently
    }
  }

  return jobs;
}
