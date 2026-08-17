/**
 * Multi-Candidate Keyword & Ghost-Listing Filter logic
 */

import { loadProfiles } from "./score.js";

const DEFAULT_KEYWORDS = ["intern", "internship", "junior", "entry-level", "entry level", "fresher", "graduate", "trainee", "associate", "early career", "new grad", "0-1", "0-2", "engineer", "developer"];
const DEFAULT_EXCLUDE = ["senior", "staff", "principal", "lead", "architect", "manager", "director", "vp", "head of", "10+ years", "8+ years", "5+ years"];

/**
 * Build aggregated roles and skills search list across all candidate profiles
 */
function getAggregatedSearchTerms() {
  const profiles = loadProfiles();
  const roles = new Set(["software", "frontend", "backend", "fullstack", "full-stack", "web", "developer", "engineer"]);
  const keywords = new Set(DEFAULT_KEYWORDS);

  profiles.forEach(p => {
    if (p.role) {
      p.role.split(/[\/,]/).forEach(r => roles.add(r.trim().toLowerCase()));
    }
    if (Array.isArray(p.skills)) {
      p.skills.forEach(s => roles.add(s.trim().toLowerCase()));
    }
  });

  return {
    roles: Array.from(roles).filter(Boolean),
    keywords: Array.from(keywords)
  };
}

/**
 * Check if a job matches keyword/role rules for at least one candidate profile
 */
export function matchesKeywords(job) {
  const text = `${job.title} ${job.description}`.toLowerCase();

  const isExcluded = DEFAULT_EXCLUDE.some(e => text.includes(e.toLowerCase()));
  if (isExcluded) return false;

  const { roles, keywords } = getAggregatedSearchTerms();

  const hasRole = roles.some(r => text.includes(r.toLowerCase()));
  const hasKeyword = keywords.some(k => text.includes(k.toLowerCase()));

  return hasRole && hasKeyword;
}

/**
 * Rule-based Ghost-Listing filter
 */
export function isGhostListing(job) {
  if (!job.description || job.description.trim().length < 200) {
    return true; // Vague or missing JD
  }

  if (job.date) {
    const postedDate = new Date(job.date);
    if (!isNaN(postedDate.getTime())) {
      const ageDays = (Date.now() - postedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 30) {
        return true; // Stale posting (older than 30 days)
      }
    }
  }

  return false;
}

/**
 * Filter an array of jobs using keyword rules & ghost filter
 */
export function filterJobs(jobs) {
  return jobs.filter(job => {
    if (isGhostListing(job)) return false;
    if (!matchesKeywords(job)) return false;
    return true;
  });
}
