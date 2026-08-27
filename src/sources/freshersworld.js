/**
 * Freshersworld India IT Jobs Fetcher via Jina Reader
 */
import crypto from "crypto";

const FRESHERSWORLD_URL = "https://r.jina.ai/https://www.freshersworld.com/jobs/category/it-software-jobs";

export async function fetchFreshersworldJobs() {
  const jobs = [];
  const seen = new Set();

  try {
    const res = await fetch(FRESHERSWORLD_URL, {
      headers: { "User-Agent": "Mozilla/5.0 JobBot/1.0", "X-Return-Format": "text" }
    });
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.split("\n");
    let cur = null;

    for (const line of lines) {
      const t = line.trim();
      if ((t.startsWith("### ") || t.startsWith("## ")) && t.length > 10) {
        if (cur && cur.title && cur.description.length > 30) jobs.push(cur);
        const title = t.replace(/^[#*]+\s*/, "").replace(/\[|\]|\*\*/g, "").trim();
        if (title.length < 5) continue;
        const key = `freshersworld_${title}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(key)) continue;
        seen.add(key);
        const hash = crypto.createHash("md5").update(key).digest("hex").substring(0, 12);
        cur = { 
          id: `freshersworld-${hash}`, 
          title: title.substring(0,150), 
          company: "Freshersworld Listing", 
          link: "https://www.freshersworld.com/jobs/category/it-software-jobs", 
          location: "India", 
          description: "", 
          date: new Date().toISOString(), 
          source: "Freshersworld India" 
        };
      } else if (cur && t.length > 15) {
        cur.description += ` ${t}`;
      }
    }
    if (cur && cur.title && cur.description.length > 30) jobs.push(cur);
  } catch (e) {
    console.error(`[Freshersworld Error] ${e.message}`);
  }
  return jobs.slice(0, 50);
}
