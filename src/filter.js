/**
 * India-Fresher-First Filter v2
 * 
 * DESIGN PHILOSOPHY: "India-Positive" approach.
 * Instead of trying to blacklist every possible foreign restriction (whack-a-mole),
 * we REQUIRE jobs to prove India eligibility. A job must either:
 *   (a) Explicitly mention India/Bangalore/Delhi/Mumbai/Hyderabad/etc.
 *   (b) Come from an India-specific source (Internshala, Unstop, Freshersworld, Naukri)
 *   (c) Explicitly say "Worldwide" / "Anywhere" / "Global" remote
 *   (d) Have NO location restriction at all AND be from a remote-first board
 * 
 * Everything else is rejected — no more ambiguous US/EU remote jobs leaking through.
 */

// ─── INDIA-SPECIFIC SOURCES (auto-pass location check) ───────────────────────
const INDIA_SOURCES = [
  "internshala", "unstop", "freshersworld", "naukri", "indeed rss (india",
  "linkedin public" // LinkedIn queries are already India-targeted
];

// ─── INDIAN CITIES & MARKERS ─────────────────────────────────────────────────
const INDIA_LOCATION_MARKERS = [
  "india", "bangalore", "bengaluru", "mumbai", "delhi", "new delhi",
  "hyderabad", "pune", "chennai", "kolkata", "noida", "gurgaon", "gurugram",
  "ahmedabad", "jaipur", "chandigarh", "lucknow", "kochi", "thiruvananthapuram",
  "indore", "bhopal", "coimbatore", "nagpur", "surat", "vadodara",
  "work from home", "wfh", "pan india", "anywhere in india"
];

// ─── GLOBAL REMOTE MARKERS (allow India candidates) ──────────────────────────
const GLOBAL_REMOTE_MARKERS = [
  "worldwide", "anywhere", "global", "remote - global",
  "remote worldwide", "remote - worldwide", "remote (global)",
  "remote - anywhere", "all countries", "international",
  "remote (worldwide)", "globally distributed", "fully remote",
  "remote first", "remote-first", "apac", "asia", "asia pacific"
];

// ─── EXPLICIT FOREIGN RESTRICTIONS (instant reject even if "remote") ─────────
const FOREIGN_ONLY_RESTRICTIONS = [
  "us only", "united states only", "usa only", "us & canada", "us/canada",
  "us citizen", "us citizenship", "green card", "work authorization in the us",
  "authorized to work in the us", "eu only", "europe only", "uk only",
  "canada only", "germany only", "latam only", "north america only",
  "must reside in us", "must reside in the us", "must be in us",
  "must be located in us", "must be located in the us",
  "us timezone required", "est timezone required", "pst timezone required",
  "cst timezone required", "must be authorized to work in the united states",
  "us work authorization required", "uk work authorization",
  "eu work authorization", "right to work in the uk",
  "recht zu arbeiten", "arbeitsgenehmigung",
  "americas only", "emea only", "us-based", "uk-based", "eu-based",
  "based in the us", "based in the uk", "based in europe",
  "located in the us", "located in the uk", "residents of the us",
  "us residents only", "canadian residents", "european residents"
];

// ─── FOREIGN ON-SITE CITIES (reject if not explicitly remote) ────────────────
const FOREIGN_ONSITE_CITIES = [
  "san francisco", "new york", "nyc", "austin", "seattle", "chicago", "boston",
  "los angeles", "denver", "portland", "miami", "atlanta", "dallas", "houston",
  "washington dc", "dc metro", "bay area", "silicon valley", "palo alto",
  "mountain view", "menlo park", "cupertino", "redmond", "pittsburgh",
  "london", "manchester", "cambridge uk", "edinburgh", "bristol",
  "munich", "münchen", "berlin", "hamburg", "frankfurt", "düsseldorf",
  "paris", "amsterdam", "rotterdam", "dublin", "barcelona", "madrid", "lisbon",
  "toronto", "vancouver", "montreal", "ottawa", "calgary",
  "sydney", "melbourne", "brisbane", "auckland",
  "singapore", "tokyo", "hong kong", "seoul", "shanghai", "beijing",
  "tel aviv", "são paulo", "buenos aires", "mexico city"
];

// ─── MANDATORY TECH KEYWORDS (title must contain at least one) ───────────────
const TECH_TITLE_KEYWORDS = [
  "software", "developer", "engineer", "frontend", "front-end", "backend", "back-end",
  "fullstack", "full-stack", "full stack", "web", "ai", "ml", "machine learning",
  "data science", "data scientist", "data engineer", "deep learning",
  "computer vision", "nlp", "natural language", "python", "react", "node",
  "java", "c++", "cpp", "golang", "go developer", "rust", "typescript",
  "cloud", "devops", "sre", "site reliability", "platform engineer",
  "intern", "internship", "fresher", "trainee", "apprentice",
  "associate", "junior", "entry level", "entry-level", "graduate",
  "sde", "swe", "sse", "mts",
  "mobile", "android", "ios", "flutter", "react native",
  "blockchain", "smart contract", "solidity",
  "cybersecurity", "security engineer", "infosec",
  "qa", "quality assurance", "test engineer", "sdet",
  "database", "dba", "etl", "data pipeline"
];

// ─── NON-TECH EXCLUSIONS ─────────────────────────────────────────────────────
const NON_TECH_EXCLUSIONS = [
  "accounting", "accountant", "auditor", "hr generalist", "recruiter",
  "human resources", "talent acquisition", "sales representative",
  "business development", "marketing manager", "copywriter", "content writer",
  "logistics", "legal counsel", "lawyer", "paralegal",
  "graphic designer", "office manager", "receptionist", "customer service",
  "financial analyst", "executive assistant", "operations manager",
  "nurse", "physician", "pharmacist", "teacher", "professor",
  "steuerfachangestellter", "bilanzbuchhalter", "projektkoordinator",
  "vertriebsmitarbeiter", "mediengestalter", "teamleiter", "pflege"
];

// ─── NON-ENGLISH MARKERS ────────────────────────────────────────────────────
const NON_ENGLISH_MARKERS = [
  "(m/w/d)", "(f/m/d)", "all genders", "teilzeit", "vollzeit",
  "personalberatung", "systemhaus", "gesellschaften", "mitarbeiter",
  "(h/f)", "cdi", "alternance" // French job markers
];

// ─── JUNK / NON-JOB SECTION HEADER EXCLUSIONS ──────────────────────────────
const JUNK_TITLE_EXCLUSIONS = [
  "privacy policy", "terms of use", "terms of service", "terms & conditions",
  "cookie policy", "contact us", "about us", "frequently asked", "faq",
  "login", "sign in", "sign up", "signup", "register", "download app",
  "popular searches", "top categories", "top cities", "browse jobs",
  "job search", "jobs in", "internships in", "for employers", "job seekers",
  "search results", "all rights reserved", "copyright", "why join us",
  "how to apply", "company overview", "explore opportunities", "view all",
  "related jobs", "similar jobs"
];

// ─── SENIORITY EXCLUSIONS (fresher/intern only) ──────────────────────────────
const SENIORITY_EXCLUSIONS = [
  "senior", "sr.", "sr ", "staff", "principal", "lead", "architect",
  "manager", "director", "vp ", "vice president", "head of", "chief",
  "mid-level", "mid level", "intermediate", "experienced",
  "level ii", "level iii", " level 2", " level 3", " l5", " l6", " l7",
  "sde 2", "sde-2", "sde2", "sde 3", "sde-3", "sde3", "sde ii", "sde-ii", "sde iii", "sde-iii",
  "software engineer 2", "software engineer ii", "software engineer 3", "software engineer iii",
  "swe 2", "swe-2", "swe2", "swe 3", "swe-3", "swe3",
  "5+ years", "7+ years", "10+ years", "3-5 years", "5-7 years", "2+ years", "3+ years"
];

// ─── EXPERIENCE REGEX (2+ years = too senior) ───────────────────────────────
const EXP_REQUIREMENT_REGEX = /(?:[2-9]|\d{2})\+?\s*(?:-\s*[2-9]\d?)?\s*(?:years?|yrs?|yoe)\b|(?:minimum|at least|requires?|with)\s*(?:[2-9]|\d{2})\+?\s*(?:years?|yrs?|yoe)\b|\b[2-9]\s*\+\s*(?:years?|yrs?|yoe)\b/i;

// ─── FRESHER / INTERN BOOST SIGNALS ─────────────────────────────────────────
const FRESHER_BOOST_KEYWORDS = [
  "0-1 year", "0 - 1 year", "0-2 year", "no experience required",
  "freshers welcome", "fresher", "recent graduate", "new grad",
  "campus hire", "campus recruitment", "internship", "intern",
  "trainee", "apprentice", "graduate trainee", "entry level",
  "entry-level", "junior", "associate"
];

/**
 * Check if a job title is tech-relevant and fresher/intern level
 */
export function matchesKeywords(job) {
  const titleLower = (job.title || "").toLowerCase();
  const textLower = `${job.title} ${job.description}`.toLowerCase();

  // 0. Exclude non-job section headers scraped from website footers/navbars
  if (JUNK_TITLE_EXCLUSIONS.some(junk => titleLower.includes(junk))) {
    return false;
  }

  // 1. Exclude Senior / Mid-Level roles
  if (SENIORITY_EXCLUSIONS.some(e => titleLower.includes(e))) {
    return false;
  }

  // 2. Exclude postings requiring 2+ years of experience
  if (EXP_REQUIREMENT_REGEX.test(textLower)) {
    return false;
  }

  // 3. Exclude Non-Tech roles
  if (NON_TECH_EXCLUSIONS.some(e => titleLower.includes(e))) {
    return false;
  }

  // 4. Exclude Non-English listings
  if (NON_ENGLISH_MARKERS.some(m => titleLower.includes(m))) {
    return false;
  }

  // 5. Require at least one tech keyword in title
  const isTechTitle = TECH_TITLE_KEYWORDS.some(k => titleLower.includes(k));
  if (!isTechTitle) {
    return false;
  }

  return true;
}

/**
 * STRICT India-eligibility check.
 * The key insight: instead of trying to block every foreign country,
 * we REQUIRE proof that India candidates can apply.
 */
export function isLocationEligible(job) {
  const locLower = (job.location || "").toLowerCase();
  const descLower = (job.description || "").toLowerCase();
  const sourceLower = (job.source || "").toLowerCase();
  const textLower = `${job.title} ${locLower} ${descLower}`.toLowerCase();

  // ── STEP 1: Instant REJECT if explicit foreign-only restriction ────────
  if (FOREIGN_ONLY_RESTRICTIONS.some(r => textLower.includes(r))) {
    return false;
  }

  // ── STEP 2: Auto-PASS if from an India-specific source ─────────────────
  if (INDIA_SOURCES.some(s => sourceLower.includes(s))) {
    return true;
  }

  // ── STEP 3: PASS if location explicitly mentions India ─────────────────
  if (INDIA_LOCATION_MARKERS.some(m => locLower.includes(m) || descLower.includes(m))) {
    return true;
  }

  // ── STEP 4: PASS if explicitly "global/worldwide/anywhere" remote ──────
  if (GLOBAL_REMOTE_MARKERS.some(m => locLower.includes(m) || textLower.includes(m))) {
    return true;
  }

  // ── STEP 5: REJECT if location is a foreign city without remote ────────
  if (FOREIGN_ONSITE_CITIES.some(city => locLower.includes(city))) {
    return false;
  }

  // ── STEP 6: For purely "Remote" jobs without any geo qualifier ─────────
  if (/^remote$/i.test(locLower.trim()) || locLower.includes("unspecified")) {
    const hasForeignHint = /\b(us|usa|united states|uk|canada|europe|eu|germany|france|australia)\b/i.test(descLower)
      && !/\bindia\b|\bworldwide\b|\bglobal\b|\banywhere\b/i.test(descLower);
    if (hasForeignHint) {
      return false;
    }
    const isFresherJob = FRESHER_BOOST_KEYWORDS.some(k => textLower.includes(k));
    return isFresherJob;
  }

  // ── STEP 7: Default REJECT ─────────────────────────────────────────────
  return false;
}

/**
 * Ghost listing detection (stale/vague posts)
 */
export function isGhostListing(job) {
  if (!job.description || job.description.trim().length < 100) {
    return true; // Too vague
  }

  if (job.date) {
    const postedDate = new Date(job.date);
    if (!isNaN(postedDate.getTime())) {
      const ageDays = (Date.now() - postedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 30) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Master filter: keyword + location + ghost check
 */
export function filterJobs(jobs) {
  const stats = { total: 0, ghosted: 0, notTech: 0, locationFail: 0, passed: 0 };

  const result = jobs.filter(job => {
    stats.total++;

    if (isGhostListing(job)) {
      stats.ghosted++;
      return false;
    }
    if (!matchesKeywords(job)) {
      stats.notTech++;
      return false;
    }
    if (!isLocationEligible(job)) {
      stats.locationFail++;
      return false;
    }

    stats.passed++;
    return true;
  });

  console.log(`[Filter Stats] Total: ${stats.total} | Ghost: ${stats.ghosted} | Not-Tech/Senior: ${stats.notTech} | Location-Fail: ${stats.locationFail} | ✅ Passed: ${stats.passed}`);
  return result;
}
