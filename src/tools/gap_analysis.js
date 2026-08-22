/**
 * Skill & Resume Gap Analysis Engine (/gap)
 * Compares job description against candidate resumes using Groq AI
 */

import Groq from "groq-sdk";
import { loadProfiles } from "../score.js";

let groq = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export async function analyzeSkillGap(jobDescription, candidateName = "Kunal") {
  const profiles = loadProfiles();
  const candidate = profiles.find(p => p.name.toLowerCase().includes(candidateName.toLowerCase())) || profiles[0];

  if (!groq) {
    return "Groq API Key not configured for skill gap analysis.";
  }

  const prompt = `
You are an expert tech career coach and resume strategist.

Analyze the following Job Description against the Candidate Resume Profile:

Candidate Profile ("${candidate.name}"):
- Role: ${candidate.role}
- Skills: ${candidate.skills?.join(", ")}
- Key Projects: ${JSON.stringify(candidate.projects)}

CRITICAL: The candidate's name is strictly "${candidate.name}". Do NOT alter or hallucinate surnames.

Job Description:
${jobDescription.slice(0, 1200)}

Provide a structured Markdown breakdown:
1. 🎯 **Matching Strengths**: Top 3 matching skills/projects.
2. ⚠️ **Skill Gaps / Missing Keywords**: 3-5 crucial skills or keywords mentioned in the JD that are missing or weak in candidate's profile.
3. 💡 **Quick Resume Tweak Advice**: 2 actionable bullets on how to tailor candidate's resume for this specific role.
`;

  const models = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "deepseek-r1-distill-llama-70b"
  ];

  for (const modelId of models) {
    try {
      const res = await groq.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
      });

      if (res.choices[0]?.message?.content) {
        let content = res.choices[0].message.content;
        content = content.replace(/Kunal\s+(Gupta|Patel|Sharma|Singh|Rai\s+Patel|Gupta\s+Patel)/gi, candidate.name);
        return content;
      }
    } catch (err) {}
  }

  return "Could not generate skill gap analysis using available LLM models.";
}

