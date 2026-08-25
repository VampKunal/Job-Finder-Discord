/**
 * Greenhouse and Lever ATS public JSON endpoint fetchers (Optimized)
 * Fetches listings for target companies defined in companies.json
 */

import fs from "fs";
import path from "path";
import { fetchWithTimeout } from "../tools/fetch.js";

function loadCompanies() {
  try {
    const filePath = path.resolve(process.cwd(), "companies.json");
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`[ATS] Failed to read companies.json: ${err.message}`);
  }
  return [];
}

async function fetchGreenhouseCompany(company) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company.greenhouse}/jobs?content=true`;
  try {
    const res = await fetchWithTimeout(url, {}, 6000);
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs.map(j => ({
      id: `gh-${company.greenhouse}-${j.id}`,
      title: j.title,
      company: company.name,
      link: j.absolute_url,
      location: j.location?.name || "Remote / Unspecified",
      description: (j.content || "").replace(/<[^>]*>?/gm, ""),
      date: j.updated_at ? new Date(j.updated_at).toISOString() : new Date().toISOString(),
      source: `Greenhouse (${company.name})`
    }));
  } catch (err) {
    return [];
  }
}

async function fetchLeverCompany(company) {
  const url = `https://api.lever.co/v0/postings/${company.lever}?mode=json`;
  try {
    const res = await fetchWithTimeout(url, {}, 6000);
    if (!res.ok) return [];
    const jobs = await res.json();
    if (!Array.isArray(jobs)) return [];

    return jobs.map(j => ({
      id: `lever-${company.lever}-${j.id}`,
      title: j.text || "Software Role",
      company: company.name,
      link: j.hostedUrl,
      location: j.categories?.location || "Remote / Unspecified",
      description: (j.descriptionPlain || j.description || "").replace(/<[^>]*>?/gm, ""),
      date: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
      source: `Lever (${company.name})`
    }));
  } catch (err) {
    return [];
  }
}

export async function fetchATSJobs() {
  const companies = loadCompanies();
  const tasks = [];

  for (const comp of companies) {
    if (comp.greenhouse) {
      tasks.push(fetchGreenhouseCompany(comp));
    }
    if (comp.lever) {
      tasks.push(fetchLeverCompany(comp));
    }
  }

  const results = await Promise.allSettled(tasks);
  const allJobs = [];

  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      allJobs.push(...res.value);
    }
  }

  return allJobs;
}
