/**
 * InternDoor Scraper for India, UK, and US Internships & Entry-Level Jobs
 * Fetches structured job data directly from InternDoor's public JSON feeds.
 */

import crypto from "crypto";
import { fetchWithTimeout } from "../tools/fetch.js";

const INTERNDOOR_FEEDS = [
  { url: "https://interndoor.com/data/jobs.json", location: "India" }
];

export async function fetchInternDoorJobs() {
  const allJobs = [];

  for (const feed of INTERNDOOR_FEEDS) {
    try {
      const res = await fetchWithTimeout(feed.url, {}, 15000);

      if (!res.ok) {
        console.warn(`[InternDoor] Failed to fetch feed ${feed.url}: Status ${res.status}`);
        continue;
      }

      const data = await res.json();
      const jobList = Array.isArray(data.jobs) ? data.jobs : [];

      for (const job of jobList) {
        if (!job.title || !job.company) continue;

        // Prefer direct apply/source URL; fallback to actual job link on interndoor.com
        let link = job.applyUrl || job.url;
        if (!link || link === "null") {
          const slugCompany = job.company.toLowerCase().replace(/[^a-z0-9]/g, "-");
          const slugTitle = job.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
          link = `https://interndoor.com/jobs/${slugCompany}-${slugTitle}-${job.id}`;
        }

        // Build a rich description from summary, bullets, and key skills
        const bulletsText = Array.isArray(job.bullets) && job.bullets.length > 0
          ? job.bullets.map(b => `• ${b}`).join("\n")
          : "";
        const skillsText = Array.isArray(job.skills) && job.skills.length > 0
          ? `Skills: ${job.skills.join(", ")}`
          : "";

        const description = [
          job.summary || "",
          bulletsText,
          skillsText,
          job.degreeText ? `Degree: ${job.degreeText}` : "",
          job.workplaceType ? `Workplace: ${job.workplaceType}` : ""
        ].filter(Boolean).join("\n\n").trim() || `InternDoor listing for ${job.title} at ${job.company}`;

        const locationStr = job.location ? `${job.location} (${feed.location})` : feed.location;
        const jobHash = job.id || crypto.createHash("md5").update(`${job.company}_${job.title}`).digest("hex").substring(0, 12);

        allJobs.push({
          id: `interndoor-${jobHash}`,
          title: job.title,
          company: job.company,
          link: link,
          location: locationStr,
          description: description,
          date: job.postedAt ? new Date(job.postedAt).toISOString() : new Date().toISOString(),
          source: "InternDoor"
        });
      }
    } catch (err) {
      console.warn(`[InternDoor] Scrape failed for ${feed.url}: ${err.message}`);
    }
  }

  return allJobs;
}

