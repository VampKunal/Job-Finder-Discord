/**
 * Multi-Candidate Groq LLM Relevance & India-Eligibility Scoring Module v2
 * 
 * Key changes:
 * - Heuristic scoring now HEAVILY penalizes non-India/non-global jobs
 * - Fresher/intern roles get strong boost
 * - India-explicit roles get strong boost
 * - Foreign timezone/onsite hints = hard cap at score 3
 * - LLM prompt is now laser-focused on Indian fresher eligibility
 */

import Groq from "groq-sdk";
import fs from "fs";
import path from "path";

let groq = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// Active Groq models in order of priority
const GROQ_MODELS = [
  "qwen/qwen3.6-27b",
  "groq/compound-mini",
  "groq/compound",
  "allam-2-7b"
];

// ─── India eligibility signals ─────────────────────────────────────────
const INDIA_POSITIVE = [
  "india", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad",
  "pune", "chennai", "kolkata", "noida", "gurgaon", "gurugram",
  "work from home", "wfh", "pan india"
];

const GLOBAL_POSITIVE = [
  "worldwide", "anywhere", "global", "apac", "asia", "international",
  "remote-first", "fully remote", "globally distributed"
];

const FOREIGN_NEGATIVE = [
  "us only", "usa only", "us citizen", "green card",
  "eu only", "uk only", "canada only", "us timezone",
  "est timezone", "pst timezone", "must reside in us",
  "work authorization in the us", "north america only"
];

/**
 * Load all candidate profiles from the profiles/ directory
 */
export function loadProfiles() {
  const profilesDir = path.resolve(process.cwd(), "profiles");
  const profiles = [];

  if (fs.existsSync(profilesDir)) {
    const files = fs.readdirSync(profilesDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const content = fs.readFileSync(path.join(profilesDir, file), "utf-8");
          const parsed = JSON.parse(content);
          if (parsed.name) profiles.push(parsed);
        } catch (err) {
          console.warn(`[Score] Failed reading profile file ${file}: ${err.message}`);
        }
      }
    }
  }

  // Fallback to legacy profile.json if profiles directory has no valid profiles
  if (profiles.length === 0) {
    const legacyPath = path.resolve(process.cwd(), "profile.json");
    if (fs.existsSync(legacyPath)) {
      try {
        const legacyProfile = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
        profiles.push({ name: "Kunal Rai", ...legacyProfile });
      } catch (e) {}
    }
  }

  return profiles;
}

/**
 * Determine India eligibility tier
 * Returns: "india-explicit" | "global-remote" | "ambiguous" | "foreign-restricted"
 */
function getIndiaEligibility(job) {
  const text = `${job.title} ${job.location} ${job.description}`.toLowerCase();
  const locLower = (job.location || "").toLowerCase();
  const sourceLower = (job.source || "").toLowerCase();

  // Check for foreign restrictions first
  if (FOREIGN_NEGATIVE.some(r => text.includes(r))) {
    return "foreign-restricted";
  }

  // India-specific source
  if (["internshala", "unstop", "freshersworld", "naukri"].some(s => sourceLower.includes(s))) {
    return "india-explicit";
  }

  // Explicit India location
  if (INDIA_POSITIVE.some(m => locLower.includes(m) || text.includes(m))) {
    return "india-explicit";
  }

  // Global/worldwide remote
  if (GLOBAL_POSITIVE.some(m => locLower.includes(m) || text.includes(m))) {
    return "global-remote";
  }

  return "ambiguous";
}

/**
 * Smart local heuristic scoring with India-first bias
 */
export function evaluateHeuristicScoring(job, profiles) {
  const text = `${job.title} ${job.company} ${job.location} ${job.description}`.toLowerCase();
  const eligibility = getIndiaEligibility(job);

  // ── Location-based score ceiling ──────────────────────────────────────
  let locationCeiling = 10;
  let remoteLabel = "Unsure";

  switch (eligibility) {
    case "india-explicit":
      locationCeiling = 10;
      remoteLabel = "✅ India (Explicit)";
      break;
    case "global-remote":
      locationCeiling = 9;
      remoteLabel = "✅ Global Remote";
      break;
    case "ambiguous":
      locationCeiling = 5; // Hard cap — don't let ambiguous jobs rank high
      remoteLabel = "⚠️ Ambiguous (No India Confirmation)";
      break;
    case "foreign-restricted":
      locationCeiling = 2; // Should have been filtered, but safety net
      remoteLabel = "❌ Foreign Restricted";
      break;
  }

  const candidateScores = profiles.map(p => {
    let score = 4; // Base score
    let matchedSkills = [];

    const pSkills = (p.skills || []).map(s => s.toLowerCase());
    const pRole = (p.role || "").toLowerCase();

    // ── Skill matching ──────────────────────────────────────────────────
    pSkills.forEach(skill => {
      if (text.includes(skill.toLowerCase())) {
        score += 0.5;
        if (matchedSkills.length < 5) matchedSkills.push(skill);
      }
    });

    // ── Role alignment ──────────────────────────────────────────────────
    if (pRole.includes("full-stack") || pRole.includes("full stack")) {
      if (/fullstack|full-stack|full stack|frontend|backend|web|react|next\.js|node/i.test(job.title)) {
        score += 2;
      }
    }
    if (pRole.includes("ai") || pRole.includes("ml") || pRole.includes("generative")) {
      if (/ai|ml|machine learning|deep learning|computer vision|nlp|python|rag|llm|model|gen\s?ai/i.test(job.title)) {
        score += 2;
      }
    }

    // ── Fresher/Intern boost ────────────────────────────────────────────
    if (/intern|internship|fresher|graduate|junior|entry-level|trainee|apprentice/i.test(job.title)) {
      score += 1.5;
    }

    // ── India-explicit boost ────────────────────────────────────────────
    if (eligibility === "india-explicit") {
      score += 1;
    }

    // ── Apply location ceiling ──────────────────────────────────────────
    score = Math.min(Math.max(Math.round(score), 2), locationCeiling);

    const matchedStr = matchedSkills.length > 0 ? matchedSkills.slice(0, 4).join(", ") : "general tech requirements";

    return {
      name: p.name,
      score,
      remoteEligible: remoteLabel,
      reason: `Matched: ${matchedStr}. Location: ${remoteLabel}.`
    };
  });

  const scoresByName = Object.fromEntries(candidateScores.map(c => [c.name, c.score]));
  const kunalScore = candidateScores.find(c => c.name.toLowerCase().includes("kunal"))?.score || 0;
  const akshatScore = candidateScores.find(c => c.name.toLowerCase().includes("akshat"))?.score || 0;

  let bestMatch = "Neither";
  let favoredReason = "Job did not closely match candidate skill profiles.";

  const maxScore = Math.max(...candidateScores.map(c => c.score), 0);

  if (maxScore >= 6) {
    if (Math.abs(kunalScore - akshatScore) <= 1) {
      bestMatch = "Both";
      favoredReason = "Role aligns equally well with both Full-Stack and AI/ML stacks.";
    } else if (kunalScore > akshatScore) {
      bestMatch = candidateScores.find(c => c.name.toLowerCase().includes("kunal"))?.name || "Kunal Rai";
      favoredReason = "Job favors web / full-stack engineering & React/Node stack.";
    } else {
      bestMatch = candidateScores.find(c => c.name.toLowerCase().includes("akshat"))?.name || "Akshat Jain";
      favoredReason = "Job favors AI/ML model development & Python/GenAI stack.";
    }
  }

  return {
    bestMatch,
    favoredReason: `${favoredReason} (Heuristic | ${remoteLabel})`,
    maxScore,
    candidates: candidateScores
  };
}

export async function scoreJobForCandidates(job) {
  const profiles = loadProfiles();

  if (profiles.length === 0) {
    return evaluateHeuristicScoring(job, [{ name: "Candidate", role: "Software Engineer", skills: ["javascript", "python"] }]);
  }

  // If no Groq API key set, use smart local heuristic evaluation
  if (!groq) {
    return evaluateHeuristicScoring(job, profiles);
  }

  const prompt = `
You are an expert technical recruiter evaluating a job posting for TWO candidates located in INDIA (New Delhi).
Both candidates are FRESHERS / FINAL-YEAR STUDENTS with ZERO work experience. They can only apply to:
- Internships
- Entry-level / fresher roles (0-1 year experience)
- Roles explicitly open to candidates in India (remote or on-site in India)

CRITICAL RULES:
1. If the job requires 2+ years of experience → score BOTH candidates 1-3 max.
2. If the job is US-only, EU-only, UK-only, or requires work authorization outside India → remoteEligible = "No" and score 1-2 max.
3. If the job location is a foreign city without "Remote" → score 1-2 max.
4. If the job says "Remote" but mentions only US/EU timezones or locations → score 3-4 max.
5. If the job explicitly mentions India, Worldwide, Anywhere, or Global → that's excellent, score fairly.
6. INTERNSHIP or FRESHER roles in INDIA should get the highest possible scores if skills match.

Job Details:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Source: ${job.source}
- Job Description Excerpt: ${job.description.slice(0, 800)}

Candidates to evaluate:
${JSON.stringify(profiles, null, 2)}

Instructions:
1. Evaluate this job for EACH candidate individually based on their skills, projects, and role focus.
2. Determine India eligibility (look for location restrictions, timezone requirements, visa requirements).
3. Assign a Score (1 to 10) for each candidate factoring in BOTH skill match AND India eligibility.
4. Determine which candidate this job favors.

Respond ONLY with valid JSON:
{
  "bestMatch": "Name of favored candidate or 'Both' or 'Neither'",
  "favoredReason": "One short sentence.",
  "candidates": [
    {
      "name": "Candidate Name",
      "score": 8,
      "remoteEligible": "Yes (India)" OR "Yes (Worldwide)" OR "No (US Only)" OR "Unsure",
      "reason": "One concise sentence."
    }
  ]
}
`;

  // Try active Groq models in order
  for (const modelId of GROQ_MODELS) {
    try {
      const res = await groq.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.2,
      });

      const raw = res.choices[0]?.message?.content?.trim() || "";
      // Strip reasoning <think>...</think> tags if model produces them
      const noThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const match = noThink.match(/\{[\s\S]*\}/);
      if (!match) continue;

      const parsed = JSON.parse(match[0]);

      const candidatesList = Array.isArray(parsed.candidates) ? parsed.candidates : [];
      const maxScore = Math.max(...candidatesList.map(c => c.score || 0), 0);

      return {
        bestMatch: parsed.bestMatch || "Both",
        favoredReason: parsed.favoredReason || "Matched candidate skills.",
        maxScore,
        candidates: candidatesList
      };
    } catch (err) {
      console.warn(`[Score] Groq model ${modelId} attempt failed for "${job.title}": ${err.message}`);
    }
  }

  // Fallback to local heuristic scoring if all Groq models fail
  return evaluateHeuristicScoring(job, profiles);
}
