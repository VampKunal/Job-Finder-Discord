/**
 * Internshala Job/Internship Fetcher
 * Uses Jina Reader to scrape Internshala's internship listings
 * Internshala is the #1 Indian internship platform for freshers
 */

import crypto from "crypto";

const INTERNSHALA_PAGES = [
  "https://r.jina.ai/https://internshala.com/internships/software-development-internship",
  "https://r.jina.ai/https://internshala.com/internships/web-development-internship",
  "https://r.jina.ai/https://internshala.com/internships/python-django-internship",
  "https://r.jina.ai/https://internshala.com/internships/machine-learning-internship",
  "https://r.jina.ai/https://internshala.com/internships/full-stack-development-internship",
  "https://r.jina.ai/https://internshala.com/internships/work-from-home-computer-science-internships"
];

export async function fetchInternshalaJobs() {
  const jobs = [];
  const seen = new Set();

  for (const url of INTERNSHALA_PAGES) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0",
          "X-Return-Format": "text"
        }
      });

      if (!res.ok) continue;

      const text = await res.text();
      const lines = text.split("\n");
      let currentJob = null;

      for (const line of lines) {
        const trimmed = line.trim();

        // Internshala listings show up as headers or bold text in Jina
        if ((trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("**")) && trimmed.length > 10) {
          if (currentJob && currentJob.title && currentJob.description.length > 50) {
            jobs.push(currentJob);
          }

          const titleClean = trimmed.replace(/^[#*]+\s*/, "").replace(/\*\*/g, "").replace(/\[|\]/g, "").trim();
          if (titleClean.length < 5) continue;

          const stableKey = `internshala_${titleClean}`.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (seen.has(stableKey)) continue;
          seen.add(stableKey);

          const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

          currentJob = {
            id: `internshala-${hash}`,
            title: titleClean.substring(0, 150),
            company: "Internshala Employer",
            link: "https://internshala.com/internships",
            location: "India / Work From Home",
            description: "",
            date: new Date().toISOString(),
            source: "Internshala"
          };
        } else if (currentJob && trimmed.length > 15) {
          // Check for company name patterns
          if (/^at\s|^company:\s|^employer:\s/i.test(trimmed)) {
            currentJob.company = trimmed.replace(/^(at|company:|employer:)\s*/i, "").trim();
          } else if (/stipend|duration|location|apply by/i.test(trimmed)) {
            currentJob.description += ` ${trimmed}`;
            if (/location/i.test(trimmed)) {
              const loc = trimmed.replace(/.*location\s*[:–-]?\s*/i, "").trim();
              if (loc) currentJob.location = loc;
            }
          } else {
            currentJob.description += ` ${trimmed}`;
          }
        }
      }
      if (currentJob && currentJob.title && currentJob.description.length > 50) {
        jobs.push(currentJob);
      }
    } catch (e) {
      console.warn(`[Internshala] Jina fetch failed: ${e.message}`);
    }
  }

  return jobs.slice(0, 50);
}
