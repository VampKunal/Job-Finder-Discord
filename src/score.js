/**
 * Multi-Candidate Groq LLM Relevance & Remote Eligibility Scoring Module
 * Features working Groq model rotation + smart local heuristic fallback.
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
 * Smart local heuristic scoring when LLM is unavailable or fails
 */
export function evaluateHeuristicScoring(job, profiles) {
  const text = `${job.title} ${job.company} ${job.location} ${job.description}`.toLowerCase();
  
  // Location check for candidates in India
  const isUsOnly = /us only|united states only|usa only|us & canada|us\/canada|must reside in (the )?us|us citizen|us timezone/i.test(text);
  const isEuOnly = /eu only|europe only|uk only|germany only|latam only/i.test(text);
  const isForeignLocation = /san francisco|new york|austin|seattle|london|munich|münchen|berlin|paris|toronto|sydney/i.test(job.location.toLowerCase()) && !/remote|worldwide|anywhere|india/i.test(job.location.toLowerCase());

  const locationEligible = !(isUsOnly || isEuOnly || isForeignLocation);

  const candidateScores = profiles.map(p => {
    let score = 5; // Base score for reaching candidate evaluation stage
    let matchedSkills = [];

    const pSkills = (p.skills || []).map(s => s.toLowerCase());
    const pRole = (p.role || "").toLowerCase();

    // Check skill matches
    pSkills.forEach(skill => {
      if (text.includes(skill)) {
        score += 0.5;
        if (matchedSkills.length < 4) matchedSkills.push(skill);
      }
    });

    // Check title / role alignment
    if (pRole.includes("full-stack") || pRole.includes("full stack")) {
      if (/fullstack|full-stack|frontend|backend|web|react|next\.js|node/i.test(job.title)) {
        score += 2;
      }
    }
    if (pRole.includes("ai/ml") || pRole.includes("generative ai")) {
      if (/ai|ml|machine learning|deep learning|computer vision|nlp|python|rag|llm|model/i.test(job.title)) {
        score += 2;
      }
    }

    // Internship / Entry-level boost if candidate level is intern
    if (/intern|internship|fresher|graduate|junior|entry-level/i.test(job.title)) {
      score += 1;
    }

    // Cap score between 1 and 9 for heuristic fallback
    score = Math.min(Math.max(Math.round(score), 3), 9);

    let remoteEligible = locationEligible ? "Yes (India/Worldwide)" : "No (Location Restricted)";
    if (!locationEligible) {
      score = Math.min(score, 4); // Disqualify foreign-restricted jobs from high scores
    }

    const matchedStr = matchedSkills.length > 0 ? matchedSkills.slice(0, 3).join(", ") : "general tech requirements";

    return {
      name: p.name,
      score,
      remoteEligible,
      reason: `Matched profile keywords (${matchedStr}).`
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
      favoredReason = "Role aligns equally well with both Full-Stack and AI/ML project stacks.";
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
    favoredReason: `${favoredReason} (Rule-Based Heuristic Evaluation)`,
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
You are an expert technical recruiter evaluating a job posting for multiple candidates located in India.

Job Details:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Source: ${job.source}
- Job Description Excerpt: ${job.description.slice(0, 800)}

Candidates to evaluate:
${JSON.stringify(profiles, null, 2)}

Instructions:
1. Evaluate this job for EACH candidate individually based on their specific skills, projects, and role focus.
2. Check Remote / Location Eligibility for candidates in India: Look for restrictions in JD (e.g. "US Only", "EU Only", "On-site SF").
3. Assign a Score (1 to 10) for each candidate.
4. Determine which candidate this job is MORE FAVORED TOWARD ("Kunal Rai", "Akshat Jain", "Both", or "Neither").

Respond ONLY with valid JSON in this exact structure with no extra markdown formatting:
{
  "bestMatch": "Name of favored candidate or 'Both' or 'Neither'",
  "favoredReason": "One short sentence explaining why it favors this candidate or both.",
  "candidates": [
    {
      "name": "Candidate Name",
      "score": 8,
      "remoteEligible": "Yes (Worldwide)" OR "No (US Only)" OR "Yes (India)",
      "reason": "One concise sentence summary of candidate match based on skills/projects."
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


