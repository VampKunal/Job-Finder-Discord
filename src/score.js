/**
 * Groq LLM Relevance Scoring Module
 */

import Groq from "groq-sdk";
import fs from "fs";
import path from "path";

let groq = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

function loadProfile() {
  try {
    const filePath = path.resolve(process.cwd(), "profile.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.warn(`[Score] Could not read profile.json: ${err.message}`);
  }
  return {
    role: "Software Developer",
    level: "Intern / Entry-Level",
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python"]
  };
}

export async function scoreJob(job) {
  if (!groq) {
    return {
      score: 7,
      reason: "Groq API key not set; auto-scored for inspection."
    };
  }

  const profile = loadProfile();

  const prompt = `
You are a job relevance scoring engine.
Rate this job opportunity on a scale of 1 to 10 for a candidate with the following profile:
- Target Role: ${profile.role}
- Experience Level: ${profile.level}
- Key Skills: ${profile.skills?.join(", ")}

Job Details:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Source: ${job.source}
- Description snippet: ${job.description.slice(0, 700)}

Scoring Guidelines:
- 8-10: Perfect fit for intern/fresher/junior matching candidate skills.
- 6-7: Good match, minor skill overlap or slightly broader role.
- 1-5: High experience required, irrelevant stack, or non-technical.

Respond ONLY with valid JSON in this exact structure, with no extra text or markdown codeblocks:
{"score": 8, "reason": "One concise sentence explaining the score."}
`;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.2,
    });

    const raw = res.choices[0]?.message?.content?.trim() || "";
    // Clean codeblock markdown if present
    const cleanJson = raw.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanJson);

    return {
      score: typeof parsed.score === "number" ? parsed.score : 7,
      reason: parsed.reason || "Matched role and skills."
    };
  } catch (err) {
    console.error(`[Score] Groq scoring error for "${job.title}": ${err.message}`);
    return {
      score: 6,
      reason: "Matched keyword criteria (LLM scoring fallback)."
    };
  }
}
