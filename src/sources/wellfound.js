import crypto from "crypto";

export async function fetchWellfoundJobs() {
  try {
    const targetUrls = [
      "https://r.jina.ai/https://wellfound.com/role/l/software-engineer/remote",
      "https://r.jina.ai/https://wellfound.com/location/india"
    ];

    const jobs = [];

    for (const url of targetUrls) {
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
          if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
            if (currentJob && currentJob.title) jobs.push(currentJob);
            const titleClean = trimmed.replace(/^[#]+\s*/, "").replace(/\[|\]/g, "");
            const stableHash = crypto.createHash("md5").update(`wf_${titleClean}`).digest("hex").substring(0, 12);
            currentJob = {
              id: `wf-${stableHash}`,
              title: titleClean,
              company: "Wellfound Startup",
              link: "https://wellfound.com/jobs",
              location: "Remote / India",
              description: "",
              date: new Date().toISOString(),
              source: "Wellfound (AngelList)"
            };
          } else if (currentJob && trimmed.length > 20) {
            currentJob.description += " " + trimmed;
          }
        }
        if (currentJob && currentJob.title) jobs.push(currentJob);
      } catch (e) {}
    }

    return jobs.slice(0, 30);
  } catch (err) {
    console.error(`[Wellfound] Fetch failed: ${err.message}`);
    return [];
  }
}

