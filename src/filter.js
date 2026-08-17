/**
 * Multi-Candidate Keyword, Strict 0-Exp Entry Level & Location Eligibility Filter logic
 */

const MANDATORY_TECH_TITLE_KEYWORDS = [
  "software", "developer", "engineer", "frontend", "front-end", "backend", "back-end",
  "fullstack", "full-stack", "web", "ai", "ml", "machine learning", "data science",
  "deep learning", "computer vision", "nlp", "python", "react", "node", "java", "c++",
  "cpp", "golang", "cloud", "devops", "intern", "internship", "fresher", "trainee",
  "associate", "junior", "entry level", "entry-level"
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

// Higher experience / seniority titles to exclude (Freshers / Interns / 0-1 yr only)
const SENIORITY_EXCLUSIONS = [
  "senior", "sr.", "sr ", "staff", "principal", "lead", "architect", "manager",
  "director", "vp", "head of", "mid-level", "mid level", "intermediate",
  "level ii", "level iii", " level 2", " level 3", " l5", " l6", " l7"
];

// Experience requirement regex in description for 2+ years
const EXP_REQUIREMENT_REGEX = /(?:minimum|at least|requires?|with)\s*(?:[2-9]|\d{2})\+?\s*(?:years|yrs)\b|(?:[2-9]|\d{2})\+?\s*(?:years|yrs)\s*(?:of)?\s*(?:experience|exp)/i;

// Strict location restriction phrases (places where Indian candidates cannot apply)
const STRICT_FOREIGN_RESTRICTIONS = [
  "us only", "united states only", "usa only", "us & canada", "us/canada",
  "us citizen", "us citizenship", "green card", "work authorization in the us",
  "authorized to work in the us", "eu only", "europe only", "uk only", "canada only",
  "germany only", "latam only", "north america only", "must reside in us",
  "must reside in the us", "must be in us", "must be located in us",
  "must be located in the us", "us timezone", "est timezone", "pst timezone", "cst timezone"
];

const FOREIGN_ONSITE_LOCATIONS = [
  "san francisco", "new york", "austin", "seattle", "chicago", "boston",
  "london", "munich", "münchen", "berlin", "hamburg", "frankfurt", "paris",
  "toronto", "vancouver", "sydney", "melbourne", "singapore", "tokyo", "dublin"
];

/**
 * Check if job is strictly for freshers / interns / 0-1 yr experience and tech-focused
 */
export function matchesKeywords(job) {
  const titleLower = (job.title || "").toLowerCase();
  const textLower = `${job.title} ${job.description}`.toLowerCase();

  // 1. Exclude Senior / Mid-Level / Lead / Manager roles
  if (SENIORITY_EXCLUSIONS.some(e => titleLower.includes(e) || textLower.includes(` ${e} `))) {
    return false;
  }

  // 2. Exclude postings requiring 2+ years of experience
  if (EXP_REQUIREMENT_REGEX.test(textLower)) {
    return false;
  }

  // 3. Exclude Non-Tech roles (HR, Accounting, Sales, etc.)
  if (NON_TECH_TITLE_EXCLUSIONS.some(e => titleLower.includes(e))) {
    return false;
  }

  // 4. Exclude Non-English / German listings
  if (NON_ENGLISH_GERMAN_MARKERS.some(m => titleLower.includes(m))) {
    return false;
  }

  // 5. Require at least one core Tech / Software / AI / Intern keyword in title
  const isTechTitle = MANDATORY_TECH_TITLE_KEYWORDS.some(k => titleLower.includes(k));
  if (!isTechTitle) {
    return false;
  }

  return true;
}

/**
 * Filter out foreign non-remote or restricted remote jobs where candidates in India cannot apply
 */
export function isLocationEligible(job) {
  const locLower = (job.location || "").toLowerCase();
  const textLower = `${job.title} ${job.location} ${job.description}`.toLowerCase();

  // 1. Check for explicit foreign-only remote restrictions
  const hasRestriction = STRICT_FOREIGN_RESTRICTIONS.some(r => textLower.includes(r));
  if (hasRestriction) {
    // If restricted, only allow if explicitly mentions India, Worldwide, Global, or Anywhere
    const allowsIndia = /india|worldwide|global|anywhere/i.test(textLower);
    if (!allowsIndia) {
      return false;
    }
  }

  // 2. Check for foreign on-site locations without remote / India option
  const isForeignCity = FOREIGN_ONSITE_LOCATIONS.some(city => locLower.includes(city));
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


