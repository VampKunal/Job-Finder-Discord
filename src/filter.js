/**
 * Keyword & Ghost-Listing Filter logic
 */

const DEFAULT_KEYWORDS = ["intern", "internship", "junior", "entry-level", "entry level", "fresher", "graduate", "trainee", "associate", "early career", "new grad", "0-1", "0-2", "engineer", "developer"];
const DEFAULT_ROLES = ["software", "frontend", "backend", "fullstack", "full-stack", "full stack", "web", "python", "node", "react", "javascript", "typescript", "java", "golang", "ai", "ml", "data engineer"];
const DEFAULT_EXCLUDE = ["senior", "staff", "principal", "lead", "architect", "manager", "director", "vp", "head of", "10+ years", "8+ years", "5+ years"];

/**
 * Check if a job matches keyword/role rules and is not explicitly excluded
 */
export function matchesKeywords(job, options = {}) {
  const text = `${job.title} ${job.description}`.toLowerCase();

  const roles = options.roles || DEFAULT_ROLES;
  const keywords = options.keywords || DEFAULT_KEYWORDS;
  const excludes = options.excludes || DEFAULT_EXCLUDE;

  const isExcluded = excludes.some(e => text.includes(e.toLowerCase()));
  if (isExcluded) return false;

  const hasRole = roles.some(r => text.includes(r.toLowerCase()));
  const hasKeyword = keywords.some(k => text.includes(k.toLowerCase()));

  // Role must match, and if specified, level keyword should match if present or if the title is generally targetable
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
