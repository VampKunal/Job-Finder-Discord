/**
 * India-Fresher-First Filter v3
 * 
 * Target Candidate Fields:
 * 1. Full-Stack / Frontend / Backend / Software Engineering (Web, React, Next.js, Node.js, Python, C++)
 * 2. AI / ML / Generative AI / RAG / Computer Vision / NLP Engineering
 * 
 * STRICTLY EXCLUDES:
 * - DevOps / SRE / SysAdmin / Cloud Operations
 * - Data Analytics / Business Intelligence / Data Entry / BI Analysts
 * - Telecalling / BPO / KPO / IT Support / Helpdesk
 * - Fake / Scam / Unpaid / Experience-Letter-Only positions
 */

// ─── INDIA-SPECIFIC SOURCES (auto-pass location check) ───────────────────────
const INDIA_SOURCES = [
  "internshala", "unstop", "freshersworld", "naukri", "indeed rss (india",
  "linkedin public"
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

// ─── TARGET TECH TITLE KEYWORDS (Must match Full-Stack, Software, or AI/ML) ─
const TECH_TITLE_KEYWORDS = [
  "software", "developer", "engineer", "frontend", "front-end", "backend", "back-end",
  "fullstack", "full-stack", "full stack", "web", "ai", "ml", "machine learning",
  "deep learning", "computer vision", "nlp", "natural language", "python", "react", "node",
  "java", "c++", "cpp", "golang", "go developer", "rust", "typescript",
  "intern", "internship", "fresher", "trainee", "apprentice",
  "associate", "junior", "entry level", "entry-level", "graduate",
  "sde", "swe", "sse", "mts",
  "mobile", "android", "ios", "flutter", "react native",
  "artificial intelligence", "genai", "generative ai", "llm", "rag"
];

// ─── UNWANTED FIELD EXCLUSIONS (DevOps, Data Analytics, Support, BPO, QA) ────
const UNWANTED_FIELD_EXCLUSIONS = [
  // DevOps & Infrastructure (Not targeted by candidates)
  "devops", "sre", "site reliability", "system admin", "sysadmin", "infrastructure engineer",
  "cloud operations", "cloud architect", "network engineer", "linux administrator", "system administrator",
  "build engineer", "release engineer",

  // Data Analytics & Business Intelligence (Not targeted by candidates)
  "data analyst", "business intelligence", "bi analyst", "bi developer", "data analytics",
  "power bi", "tableau developer", "reporting analyst", "business analyst", "data operations",
  "data entry analyst",

  // IT Support, BPO, Telecalling & Helpdesk
  "it support", "technical support", "helpdesk", "desktop support", "service desk",
  "it coordinator", "system support", "bpo", "kpo", "telecaller", "tele-caller",
  "telecalling", "voice process", "non voice process", "back office", "chat support",

  // Manual QA & Testing
  "manual tester", "qa tester", "test analyst", "quality assurance analyst",

  // Non-Tech / Corporate / Sales
  "accounting", "accountant", "auditor", "hr generalist", "recruiter",
  "human resources", "talent acquisition", "sales representative",
  "business development", "marketing manager", "copywriter", "content writer",
  "logistics", "legal counsel", "lawyer", "paralegal", "graphic designer",
  "office manager", "receptionist", "customer service", "financial analyst",
  "operations manager", "nurse", "physician", "pharmacist",
  "steuerfachangestellter", "bilanzbuchhalter", "projektkoordinator",
  "vertriebsmitarbeiter", "mediengestalter", "teamleiter", "pflege"
];

// ─── NON-ENGLISH MARKERS ────────────────────────────────────────────────────
const NON_ENGLISH_MARKERS = [
  "(m/w/d)", "(f/m/d)", "all genders", "teilzeit", "vollzeit",
  "personalberatung", "systemhaus", "gesellschaften", "mitarbeiter",
  "(h/f)", "cdi", "alternance"
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
  "5+ years", "7+ years", "10+ years", "3-5 years", "5-7 years"
];

/**
 * EXPERIENCE CHECK:
 * Explicitly ALLOWS 0 exp / 0-1 / 0-2 / 0-3 yrs / freshers / interns / entry-level / graduates.
 * REJECTS positions that strictly require 2+ or 3+ years of experience (without 0-1/0-2 lower bound).
 */
export function requiresSeniorExperience(text) {
  if (!text) return false;
  const textLower = text.toLowerCase();

  // 1. Explicitly ALLOW 0 exp, 0-1 yr, 0-2 yrs, 0-3 yrs, 1-2 yrs, freshers, interns, entry-level, graduates, trainees
  if (
    /\b0\s*(?:-|to|\+)\s*[1-3]\s*(?:years?|yrs?|yoe)\b/i.test(textLower) ||
    /\b1\s*(?:-|to)\s*2\s*(?:years?|yrs?|yoe)\b/i.test(textLower) ||
    /\b(?:0|zero|no)\s*(?:years?|yrs?|yoe|exp|experience)\b/i.test(textLower) ||
    /\b(fresher|freshers|intern|internship|trainee|apprentice|entry-level|entry level|new grad|campus hire|graduate)\b/i.test(textLower)
  ) {
    return false; // Valid for 0 exp / fresher
  }

  // 2. REJECT if text explicitly requires 2+ years, 3+ years, 2-5 years, 3-5 years, or min 2+ years without 0 bound
  const seniorExpRegex = /\b(?:[2-9]|\d{2})\s*\+\s*(?:years?|yrs?|yoe)\b|\b(?:[2-9]|\d{2})\s*(?:-|to)\s*(?:[3-9]|\d{2})\s*(?:years?|yrs?|yoe)\b|\b(?:minimum|at least|requires?|with)\s+(?:[2-9]|\d{2})\+?\s*(?:years?|yrs?|yoe)\b|\b(?:[2-9]|\d{2})\s*(?:years?|yrs?|yoe)\s+(?:of\s+)?experience\b/i;

  return seniorExpRegex.test(textLower);
}

// ─── FRESHER / INTERN BOOST SIGNALS ─────────────────────────────────────────
const FRESHER_BOOST_KEYWORDS = [
  "0-1 year", "0 - 1 year", "0-2 year", "0 - 2 year", "0-3 year", "0 - 3 year",
  "0-1 yrs", "0 - 1 yrs", "0-2 yrs", "0 - 2 yrs", "0-3 yrs", "0 - 3 yrs",
  "0 to 1 year", "0 to 2 years", "0 to 3 years", "0+ years", "0 yrs", "0 yr",
  "no experience required", "no experience", "freshers welcome", "fresher", "freshers",
  "recent graduate", "new grad", "campus hire", "campus recruitment", "internship", "intern",
  "trainee", "apprentice", "graduate trainee", "entry level", "entry-level", "junior", "associate"
];

// ─── FAKE / SCAM / UNPAID EXCLUSION MARKERS ────────────────────────────────
const FAKE_AND_UNPAID_MARKERS = [
  // Unpaid / Zero stipend traps
  "unpaid", "0 stipend", "zero stipend", "no stipend", "without stipend",
  "free internship", "volunteer", "un-paid", "pay to learn", "registration fee",
  "security deposit", "training fee", "buy course", "course fee", "commission only",
  "100% commission", "pay per lead", "pay per sale", "unpaid internship",
  "no salary", "performance based stipend only", "stipend: 0", "stipend: rs 0",
  "stipend - 0", "stipend - rs 0", "stipend : 0", "stipend : rs. 0",
  "stipend: nil", "stipend: null", "certificate only", "certificate of completion",
  "experience letter only", "perks only", "lpa: 0",

  // Scam / Data Entry / Typing / Copy-Paste fraud / Telecalling
  "data entry", "form filling", "copy paste", "sms sending", "typing job",
  "online typing", "captcha typing", "survey taker", "earn money online",
  "work from home without investment", "part time typing", "packet packing",
  "handwriting job", "offline data entry", "part-time data entry",
  "telecaller", "telecalling", "tele-caller", "telemarketing", "bpo", "kpo",
  "back office", "voice process", "chat support",

  // Multi-Level Marketing (MLM) & Pyramid Schemes
  "network marketing", "herbalife", "amway", "forever living", "pyramid scheme",
  "multilevel marketing", "mlm", "direct selling",

  // Contact via Telegram / WhatsApp recruitment scams
  "whatsapp us on", "contact on whatsapp", "send resume on whatsapp",
  "apply via whatsapp", "telegram channel", "t.me/", "msg on telegram",
  "call hr at", "contact hr on whatsapp", "whatsapp your cv",

  // Fraudulent / Too-good-to-be-true promises
  "urgent hiring for freshers", "earn up to 50k", "daily payout",
  "no interview direct joining", "direct joining", "instant hiring without interview",
  "guaranteed job", "job guarantee fee", "pay us", "training charges",
  "pay for laptop", "refundable deposit", "processing fee", "documentation charges"
];

// ─── DELHI-NCR REGION MARKERS (high priority on-site/hybrid location) ────────
export const DELHI_NCR_MARKERS = [
  "noida", "gurgaon", "gurugram", "delhi", "new delhi",
  "greater noida", "ghaziabad", "faridabad", "delhi ncr", "delhi-ncr", "ncr"
];

/**
 * Detect fake, scam, unpaid, pay-to-work, or fraudulent job listings
 */
export function isFakeJob(job) {
  const titleLower = (job.title || "").toLowerCase();
  const descLower = (job.description || "").toLowerCase();
  const companyLower = (job.company || "").toLowerCase();
  const textLower = `${titleLower} ${descLower} ${companyLower}`;

  // 1. Check for fake / scam / unpaid keywords
  if (FAKE_AND_UNPAID_MARKERS.some(marker => textLower.includes(marker))) {
    return true;
  }

  // 2. Suspicious company names or placeholder companies
  const suspiciousCompanies = ["hiring team", "hr department", "job provider", "unknown", "test company", "lorem ipsum"];
  if (suspiciousCompanies.some(sc => companyLower === sc)) {
    return true;
  }

  // 3. Repeated junk phrases or missing real title
  if (/lorem ipsum|sample text|test title/i.test(textLower)) {
    return true;
  }

  return false;
}

/**
 * Check if job is located in Noida, Gurgaon, Delhi (Delhi-NCR region)
 */
export function isDelhiNCRLocation(job) {
  const locLower = (job.location || "").toLowerCase();
  const descLower = (job.description || "").toLowerCase();
  const textLower = `${locLower} ${descLower}`;
  return DELHI_NCR_MARKERS.some(m => textLower.includes(m));
}

/**
 * Check if job is Remote Paid (Remote location + explicitly not unpaid)
 */
export function isRemotePaidJob(job) {
  const locLower = (job.location || "").toLowerCase();
  const descLower = (job.description || "").toLowerCase();
  const textLower = `${job.title} ${locLower} ${descLower}`.toLowerCase();
  
  const isRemote = /remote|work from home|wfh|worldwide|anywhere|global/i.test(locLower) ||
                   GLOBAL_REMOTE_MARKERS.some(m => textLower.includes(m));
  
  const isUnpaid = FAKE_AND_UNPAID_MARKERS.some(m => textLower.includes(m));

  return isRemote && !isUnpaid;
}

/**
 * Check if a job title is tech-relevant (Fullstack/AI/Software) and fresher/intern level
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
  if (requiresSeniorExperience(textLower)) {
    return false;
  }

  // 3. Exclude Unwanted Fields (DevOps, Data Analytics, SysAdmin, Support, QA, Non-Tech)
  if (UNWANTED_FIELD_EXCLUSIONS.some(e => titleLower.includes(e))) {
    return false;
  }

  // 4. Exclude Non-English listings
  if (NON_ENGLISH_MARKERS.some(m => titleLower.includes(m))) {
    return false;
  }

  // 5. Require at least one target tech keyword in title
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
  if (!job.title || job.title.trim().length < 3) {
    return true;
  }
  if (!job.description || job.description.trim().length < 15) {
    return true; // Require basic description
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
 * Master filter: ghost check + fake/unpaid check + keyword + location
 */
export function filterJobs(jobs) {
  const stats = { total: 0, ghosted: 0, fakeJobs: 0, notTech: 0, locationFail: 0, passed: 0 };

  const result = jobs.filter(job => {
    stats.total++;

    if (isGhostListing(job)) {
      stats.ghosted++;
      return false;
    }
    if (isFakeJob(job)) {
      stats.fakeJobs++;
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

  console.log(`[Filter Stats] Total: ${stats.total} | Ghost: ${stats.ghosted} | 🚫 Fake/Unpaid: ${stats.fakeJobs} | Not-Target-Tech/Senior/DevOps/DataAnalyst: ${stats.notTech} | Location-Fail: ${stats.locationFail} | ✅ Passed: ${stats.passed}`);
  return result;
}

