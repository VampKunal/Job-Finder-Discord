/**
 * Unstop Opportunities Fetcher (Direct Public JSON API)
 * Directly queries Unstop's public API for fresh internships & jobs
 */

import crypto from "crypto";
import { fetchWithTimeout } from "../tools/fetch.js";

const UNSTOP_ENDPOINTS = [
  { url: "https://unstop.com/api/public/opportunity/search-result?opportunity=internships&per_page=25&searchTerm=software", type: "Internship" },
  { url: "https://unstop.com/api/public/opportunity/search-result?opportunity=internships&per_page=25&searchTerm=web+developer", type: "Internship" },
  { url: "https://unstop.com/api/public/opportunity/search-result?opportunity=internships&per_page=25&searchTerm=python", type: "Internship" },
  { url: "https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&per_page=25&searchTerm=fresher+software", type: "Job" },
  { url: "https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&per_page=25&searchTerm=web+developer", type: "Job" },
];

async function fetchUnstopEndpoint(endpoint, seen) {
  const jobs = [];
  try {
    const res = await fetchWithTimeout(endpoint.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    }, 8000);

    if (!res.ok) return [];

    const json = await res.json();
    const items = json.data?.data || json.data || [];

    if (!Array.isArray(items)) return [];

    for (const item of items) {
      const title = (item.title || "").trim();
      if (!title || title.length < 4) continue;

      const rawLink = item.public_url || item.seo_url || "";
      const link = rawLink.startsWith("http")
        ? rawLink
        : `https://unstop.com/${rawLink.replace(/^\/+/, "")}`;

      if (!link || link === "https://unstop.com/") continue;

      const company = item.organisation?.name || item.reg_types?.name || "Unstop Employer";
      const stableKey = `unstop_${title}_${company}_${item.id || link}`.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (seen.has(stableKey)) continue;
      seen.add(stableKey);

      const hash = crypto.createHash("md5").update(stableKey).digest("hex").substring(0, 12);

      // Build description from job details / eligible criteria
      const descParts = [
        item.job_detail?.about || "",
        item.job_detail?.responsibilities || "",
        item.job_detail?.requirements || "",
        item.eligibility || ""
      ].filter(Boolean);

      const description = descParts.length > 0
        ? descParts.join("\n\n").replace(/<[^>]*>?/gm, "").substring(0, 1200)
        : `${title} at ${company}. Type: ${endpoint.type}. Found via Unstop.`;

      const location = item.job_detail?.locations?.[0] || item.location || "India";

      jobs.push({
        id: `unstop-${hash}`,
        title: title,
        company: company,
        link: link,
        location: location,
        description: description,
        date: item.start_date ? new Date(item.start_date).toISOString() : new Date().toISOString(),
        source: "Unstop"
      });
    }
  } catch (err) {
    console.warn(`[Unstop API] Failed to fetch ${endpoint.url}: ${err.message}`);
  }

  return jobs;
}

export async function fetchUnstopJobs() {
  const seen = new Set();
  const results = await Promise.allSettled(UNSTOP_ENDPOINTS.map(ep => fetchUnstopEndpoint(ep, seen)));
  const jobs = [];

  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      jobs.push(...res.value);
    }
  }

  return jobs.slice(0, 50);
}
