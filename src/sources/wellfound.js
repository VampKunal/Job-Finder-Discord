import crypto from "crypto";
import { fetchWithTimeout } from "../tools/fetch.js";

export async function fetchWellfoundJobs() {
  try {
    const targetUrls = [
      "https://r.jina.ai/https://wellfound.com/role/l/software-engineer/remote",
      "https://r.jina.ai/https://wellfound.com/location/india"
    ];

    const jobs = [];
    const seen = new Set();

    for (const url of targetUrls) {
      try {
        const res = await fetchWithTimeout(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0",
            "X-Return-Format": "markdown"
          }
        }, 12000);

        if (!res.ok) continue;

        const text = await res.text();
        const lines = text.split("\n");
        let currentJob = null;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
            if (currentJob && currentJob.title && currentJob.link && currentJob.description.length > 20) {
              jobs.push(currentJob);
            }
            currentJob = null;

            const linkMatch = trimmed.match(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/);
            if (!linkMatch) continue;

            const directLink = linkMatch[2].trim();
            // Must be an actual job posting on Wellfound, not the generic homepage/jobs root
            if (!directLink || directLink === "https://wellfound.com/jobs" || (!directLink.includes("/jobs/") && !directLink.includes("/company/"))) {
              continue;
            }

            const titleClean = linkMatch[1].replace(/^[#*]+\s*/, "").replace(/\[|\]|\*\*/g, "").trim();
            if (titleClean.length < 5) continue;

            const stableHash = crypto.createHash("md5").update(`wf_${titleClean}_${directLink}`).digest("hex").substring(0, 12);
            if (seen.has(stableHash)) continue;
            seen.add(stableHash);

            currentJob = {
              id: `wf-${stableHash}`,
              title: titleClean,
              company: "Wellfound Startup",
              link: directLink,
              location: "India / Remote",
              description: "",
              date: new Date().toISOString(),
              source: "Wellfound (AngelList)"
            };
          } else if (currentJob && trimmed.length > 20) {
            if (/^at\s|^company:\s/i.test(trimmed)) {
              currentJob.company = trimmed.replace(/^(at|company:)\s*/i, "").trim();
            } else {
              currentJob.description += " " + trimmed;
            }
          }
        }
        if (currentJob && currentJob.title && currentJob.link && currentJob.description.length > 20) {
          jobs.push(currentJob);
        }
      } catch (e) {}
    }

    return jobs.slice(0, 30);
  } catch (err) {
    console.error(`[Wellfound] Fetch failed: ${err.message}`);
    return [];
  }
}
