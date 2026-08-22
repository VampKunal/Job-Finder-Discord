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
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "deepseek-r1-distill-llama-70b"
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
 * Helper to normalize and sanitize candidate names to prevent LLM name hallucinations
 */
function sanitizeCandidateName(rawName, profiles) {
  if (!rawName) return profiles[0]?.name || "Candidate";
  const lower = rawName.toLowerCase();
  for (const p of profiles) {
    const firstName = p.name.split(" ")[0].toLowerCase();
    if (lower.includes(firstName)) {
      return p.name; // Always return the exact profile name (e.g. "Kunal Rai")
    }
  }
  return profiles[0]?.name || "Candidate";
}

function sanitizeBestMatch(bestMatchRaw, profiles) {
  if (!bestMatchRaw) return "Both";
  const lower = bestMatchRaw.toLowerCase();
  if (lower.includes("both")) return "Both";
  if (lower.includes("neither") || lower.includes("none")) return "Neither";

  for (const p of profiles) {
    const firstName = p.name.split(" ")[0].toLowerCase();
    if (lower.includes(firstName)) {
      return p.name;
    }
  }
  return "Both";
}

/**
 * Smart local heuristic scoring with India-first bias
 */
export function evaluateHeuristicScoring(job, profiles) {
  const text = `${job.title} ${job.company} ${job.location} ${job.description}`.toLowerCase();
  const eligibility = getIndiaEligibility(job);

  // Experience requirement check: If job requires 2+ years of exp, hard cap score at 2
  const hasExpReq = /(?:[2-9]|\d{2})\+?\s*(?:years|yrs|yoe)|(?:minimum|at least)\s*[2-9]\s*years/i.test(text);

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
      locationCeiling = 2; // Safety net
      remoteLabel = "❌ Foreign Restricted";
      break;
  }

  if (hasExpReq) {
    locationCeiling = Math.min(locationCeiling, 2);
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

    if (hasExpReq) {
      score = 2;
    }

    // ── Apply location ceiling ──────────────────────────────────────────
    score = Math.min(Math.max(Math.round(score), 1), locationCeiling);

    const matchedStr = matchedSkills.length > 0 ? matchedSkills.slice(0, 4).join(", ") : "general tech requirements";

    return {
      name: p.name, // Strictly use profile.name
      score,
      remoteEligible: remoteLabel,
      reason: `Matched: ${matchedStr}. Location: ${remoteLabel}.`
    };
  });

  const scoresByName = Object.fromEntries(candidateScores.map(c => [c.name, c.score]));
  const kunalProfile = profiles.find(c => c.name.toLowerCase().includes("kunal"));
  const akshatProfile = profiles.find(c => c.name.toLowerCase().includes("akshat"));

  const kunalScore = kunalProfile ? (scoresByName[kunalProfile.name] || 0) : 0;
  const akshatScore = akshatProfile ? (scoresByName[akshatProfile.name] || 0) : 0;

  let bestMatch = "Neither";
  let favoredReason = "Job did not closely match candidate skill profiles.";

  const maxScore = Math.max(...candidateScores.map(c => c.score), 0);

  if (maxScore >= 6) {
    if (Math.abs(kunalScore - akshatScore) <= 1) {
      bestMatch = "Both";
      favoredReason = "Role aligns equally well with both Full-Stack and AI/ML stacks.";
    } else if (kunalScore > akshatScore && kunalProfile) {
      bestMatch = kunalProfile.name;
      favoredReason = "Job favors web / full-stack engineering & React/Node stack.";
    } else if (akshatProfile) {
      bestMatch = akshatProfile.name;
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
    return evaluateHeuristicScoring(job, [{ name: "Kunal Rai", role: "Software Engineer", skills: ["javascript", "python"] }]);
  }

  // If no Groq API key set, use smart local heuristic evaluation
  if (!groq) {
    return evaluateHeuristicScoring(job, profiles);
  }

  const prompt = `
You are an expert technical recruiter evaluating a job posting for candidates located in INDIA.
Candidates:
${profiles.map((p, idx) => `[Candidate ${idx + 1}] Name: "${p.name}", Role: "${p.role}", Skills: ${p.skills.join(", ")}`).join("\n")}

CRITICAL RULES:
1. Candidate names must strictly match the exact profile names provided above ("${profiles.map(p => p.name).join('", "')}"). DO NOT alter, hallucinate, or append fake surnames like "Gupta" or "Patel".
2. If the job requires 2+ years of experience → score ALL candidates 1-3 max.
3. If the job is US-only, EU-only, UK-only, or requires work authorization outside India → remoteEligible = "No" and score 1-2 max.
4. If the job location is a foreign city without "Remote" → score 1-2 max.
5. If the job explicitly mentions India, Worldwide, Anywhere, or Global → score fairly based on skills.
6. INTERNSHIP or FRESHER roles in INDIA should get high scores if skills match.

Job Details:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Source: ${job.source}
- Description Excerpt: ${job.description.slice(0, 800)}

Respond ONLY with valid JSON:
{
  "bestMatch": "Exact candidate name (e.g. 'Kunal Rai' or 'Akshat Jain') or 'Both' or 'Neither'",
  "favoredReason": "One short sentence.",
  "candidates": [
    {
      "name": "Exact candidate name from prompt",
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
        temperature: 0.1,
      });

      const raw = res.choices[0]?.message?.content?.trim() || "";
      const noThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const match = noThink.match(/\{[\s\S]*\}/);
      if (!match) continue;

      const parsed = JSON.parse(match[0]);

      // SANITIZE CANDIDATE NAMES TO PREVENT HALLUCINATIONS
      const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
      const sanitizedCandidates = profiles.map((p, idx) => {
        const rawC = rawCandidates[idx] || rawCandidates.find(c => (c.name || "").toLowerCase().includes(p.name.split(" ")[0].toLowerCase())) || {};
        return {
          name: p.name, // STRICT: ALWAYS use exact candidate profile name!
          score: typeof rawC.score === "number" ? rawC.score : 4,
          remoteEligible: rawC.remoteEligible || "Unsure",
          reason: rawC.reason || "Evaluated by AI model."
        };
      });

      const bestMatchSanitized = sanitizeBestMatch(parsed.bestMatch, profiles);
      const maxScore = Math.max(...sanitizedCandidates.map(c => c.score || 0), 0);

      return {
        bestMatch: bestMatchSanitized,
        favoredReason: parsed.favoredReason || "Matched candidate skills.",
        maxScore,
        candidates: sanitizedCandidates
      };
    } catch (err) {
      console.warn(`[Score] Groq model ${modelId} attempt failed for "${job.title}": ${err.message}`);
    }
  }

  // Fallback to local heuristic scoring if all Groq models fail
  return evaluateHeuristicScoring(job, profiles);
}

