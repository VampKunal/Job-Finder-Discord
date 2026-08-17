/**
 * Multi-Candidate Keyword, Location Eligibility & Ghost-Listing Filter logic
 */

import { loadProfiles } from "./score.js";

const MANDATORY_TECH_TITLE_KEYWORDS = [
  "software", "developer", "engineer", "frontend", "front-end", "backend", "back-end",
  "fullstack", "full-stack", "web", "ai", "ml", "machine learning", "data science",
  "deep learning", "computer vision", "nlp", "python", "react", "node", "java", "c++",
  "cpp", "golang", "cloud", "devops", "intern", "internship"
];

const NON_TECH_TITLE_EXCLUSIONS = [
  "accounting", "accountant", "auditor", "hr generalist", "recruiter", "human resources",
  "sales", "business development", "marketing", "copywriter", "logistics", "legal",
  "graphic designer", "office manager", "receptionist", "customer service",
  "financial analyst", "executive assistant", "steuerfachangestellter", "bilanzbuchhalter",
  "projektkoordinator", "vertriebsmitarbeiter", "mediengestalter", "teamleiter", "pflege"
];

const NON_ENGLISH_GERMAN_MARKERS = [
  "(m/w/d)", "all genders", "teilzeit", "vollzeit", "münchen", "personalberatung",
  "systemhaus", "gesellschaften", "mitarbeiter"
];

const FOREIGN_LOCATION_RESTRICTIONS = [
  "us only", "united states only", "usa only", "us & canada", "us/canada",
  "eu only", "europe only", "uk only", "canada only", "germany only", "latam only",
  "must reside in us", "must reside in the us", "must be in us", "us citizen",
  "us timezone"
];

const FOREIGN_ONSITE_CITIES = [
  "san francisco", "new york", "austin", "seattle", "chicago", "boston",
  "london", "munich", "münchen", "berlin", "hamburg", "frankfurt", "paris",
  "toronto", "vancouver", "sydney", "melbourne"
];

const DEFAULT_EXCLUDE = [
  "senior", "staff", "principal", "lead", "architect", "manager", "director",
  "vp", "head of", "10+ years", "8+ years", "5+ years"
];

/**
 * Check if job is tech-relevant and appropriate for candidate experience levels
 */
export function matchesKeywords(job) {
  const titleLower = (job.title || "").toLowerCase();
  const textLower = `${job.title} ${job.description}`.toLowerCase();

  // 1. Exclude Senior / Lead / Manager roles
  if (DEFAULT_EXCLUDE.some(e => textLower.includes(e))) {
    return false;
  }

  // 2. Exclude Non-Tech roles (HR, Accounting, Sales, etc.)
  if (NON_TECH_TITLE_EXCLUSIONS.some(e => titleLower.includes(e))) {
    return false;
  }

  // 3. Exclude Non-English / German listings
  if (NON_ENGLISH_GERMAN_MARKERS.some(m => titleLower.includes(m))) {
    return false;
  }

  // 4. Require at least one core Tech / Software / AI keyword in title
  const isTechTitle = MANDATORY_TECH_TITLE_KEYWORDS.some(k => titleLower.includes(k));
  if (!isTechTitle) {
    return false;
  }

  return true;
}

/**
 * Filter out foreign non-remote or restricted remote jobs for candidates in India
 */
export function isLocationEligible(job) {
  const locLower = (job.location || "").toLowerCase();
  const textLower = `${job.title} ${job.location} ${job.description}`.toLowerCase();

  // 1. Check for explicit foreign-only remote restrictions
  const hasRestriction = FOREIGN_LOCATION_RESTRICTIONS.some(r => textLower.includes(r));
  if (hasRestriction) {
    // If it says "US Only" but doesn't mention India or Worldwide, exclude it
    if (!textLower.includes("india") && !textLower.includes("worldwide")) {
      return false;
    }
  }

  // 2. Check for foreign on-site locations without remote / India option
  const isForeignCity = FOREIGN_ONSITE_CITIES.some(city => locLower.includes(city));
  const isRemoteOrIndia = /remote|worldwide|anywhere|global|india/i.test(locLower) || /remote (worldwide|anywhere|global)/i.test(textLower);

  if (isForeignCity && !isRemoteOrIndia) {
    return false;
  }

  return true;
}

/**
 * Rule-based Ghost-Listing filter
 */
export function isGhostListing(job) {
  if (!job.description || job.description.trim().length < 150) {
    return true; // Vague or missing JD
  }

  if (job.date) {
    const postedDate = new Date(job.date);
    if (!isNaN(postedDate.getTime())) {
      const ageDays = (Date.now() - postedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 45) {
        return true; // Stale posting (older than 45 days)
      }
    }
  }

  return false;
}

/**
 * Filter an array of jobs using keyword rules, location rules & ghost filter
 */
export function filterJobs(jobs) {
  return jobs.filter(job => {
    if (isGhostListing(job)) return false;
    if (!matchesKeywords(job)) return false;
    if (!isLocationEligible(job)) return false;
    return true;
  });
}

