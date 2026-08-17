/**
 * JustRemote & Freshersworld Fetcher via Jina Reader
 */
import crypto from "crypto";

const PAGES = [
  { url: "https://r.jina.ai/https://justremote.co/remote-developer-jobs", source: "JustRemote", location: "Remote" },
  { url: "https://r.jina.ai/https://www.freshersworld.com/jobs/category/it-software-jobs", source: "Freshersworld", location: "India" }
];

export async function fetchJustRemoteJobs() {
  const jobs = [];
  const seen = new Set();

  for (const page of PAGES) {
    try {
      const res = await fetch(page.url, {
        headers: { "User-Agent": "Mozilla/5.0 JobBot/1.0", "X-Return-Format": "text" }
      });
      if (!res.ok) continue;
      const text = await res.text();
      const lines = text.split("\n");
      let cur = null;

      for (const line of lines) {
        const t = line.trim();
        if ((t.startsWith("### ") || t.startsWith("## ")) && t.length > 10) {
          if (cur && cur.title && cur.description.length > 30) jobs.push(cur);
          const title = t.replace(/^[#*]+\s*/, "").replace(/\[|\]|\*\*/g, "").trim();
          if (title.length < 5) continue;
          const key = `${page.source}_${title}`.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (seen.has(key)) continue;
          seen.add(key);
          const hash = crypto.createHash("md5").update(key).digest("hex").substring(0, 12);
          cur = { id: `${page.source.toLowerCase().replace(/\s/g,"")}-${hash}`, title: title.substring(0,150), company: `${page.source} Employer`, link: page.url.replace("https://r.jina.ai/",""), location: page.location, description: "", date: new Date().toISOString(), source: page.source };
        } else if (cur && t.length > 15) {
          cur.description += ` ${t}`;
        }
      }
      if (cur && cur.title && cur.description.length > 30) jobs.push(cur);
    } catch (e) {}
  }
  return jobs.slice(0, 50);
}
