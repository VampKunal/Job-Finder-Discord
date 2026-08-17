/**
 * Multi-Candidate Groq LLM Relevance & Remote Eligibility Scoring Module
 */

import Groq from "groq-sdk";
import fs from "fs";
import path from "path";

let groq = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

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
        profiles.push({ name: "Kunal", ...legacyProfile });
      } catch (e) {}
    }
  }

  return profiles;
}

export async function scoreJobForCandidates(job) {
  const profiles = loadProfiles();

  // If no Groq API key set, return fallback evaluation
  if (!groq || profiles.length === 0) {
    return {
      bestMatch: profiles[0]?.name || "Candidate",
      favoredReason: "Matched basic keyword criteria.",
      maxScore: 7,
      candidates: profiles.map(p => ({
        name: p.name,
        score: 7,
        remoteEligible: "Yes (Unchecked)",
        reason: "Matched role keyword filters."
      }))
    };
  }

  const prompt = `
You are an expert technical recruiter evaluating a job posting for multiple candidates.

Job Details:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Source: ${job.source}
- Job Description Excerpt: ${job.description.slice(0, 800)}

Candidates to evaluate:
${JSON.stringify(profiles, null, 2)}

Instructions:
1. Evaluate this job for EACH candidate based on their role, skills, projects, and experience level.
2. Check Remote / Location Eligibility: Can a candidate located in their specified country (e.g. India) work in this internship/job remotely? Look for location restrictions in the JD (e.g., "US Only", "Worldwide Remote", "EU Only", "Must be local").
3. Assign a Score (1 to 10) for each candidate.
4. Determine which candidate this job is MORE FAVORED TOWARD (or "Both", or "Neither").

Respond ONLY with valid JSON in this exact structure with no extra text or markdown formatting:
{
  "bestMatch": "Name of favored candidate or 'Both' or 'Neither'",
  "favoredReason": "One short sentence explaining why it favors this candidate or both.",
  "candidates": [
    {
      "name": "Candidate Name",
      "score": 9,
      "remoteEligible": "Yes (Worldwide)" OR "No (US Only)" OR "Unsure",
      "reason": "One concise sentence summary of candidate match based on skills/projects."
    }
  ]
}
`;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.2,
    });

    const raw = res.choices[0]?.message?.content?.trim() || "";
    const cleanJson = raw.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanJson);

    const candidatesList = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const maxScore = Math.max(...candidatesList.map(c => c.score || 0), 0);

    return {
      bestMatch: parsed.bestMatch || "General",
      favoredReason: parsed.favoredReason || "Job matched target profiles.",
      maxScore,
      candidates: candidatesList
    };
  } catch (err) {
    console.error(`[Score] Groq scoring error for "${job.title}": ${err.message}`);
    return {
      bestMatch: profiles[0]?.name || "Candidate",
      favoredReason: "Matched keyword criteria (LLM fallback).",
      maxScore: 6,
      candidates: profiles.map(p => ({
        name: p.name,
        score: 6,
        remoteEligible: "Unsure",
        reason: "Matched target keywords."
      }))
    };
  }
}
