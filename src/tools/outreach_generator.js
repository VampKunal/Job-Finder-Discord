/**
 * Cold Outreach & Referral Message Generator (/outreach)
 */

import Groq from "groq-sdk";
import { loadProfiles } from "../score.js";

let groq = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export async function generateOutreachMessage(companyName, jobTitle, candidateName = "Kunal") {
  const profiles = loadProfiles();
  const candidate = profiles.find(p => p.name.toLowerCase().includes(candidateName.toLowerCase())) || profiles[0];

  if (!groq) {
    return "Groq API Key missing.";
  }

  const prompt = `
Write two concise, high-converting cold outreach messages for a candidate applying to a role.

Candidate Name: "${candidate.name}" (Role: ${candidate.role})
Key Skills: ${candidate.skills?.slice(0, 6).join(", ")}
Target Company: ${companyName}
Target Role: ${jobTitle}

CRITICAL REQUIREMENT:
The candidate's name is strictly "${candidate.name}".
DO NOT invent or alter surnames (e.g., NEVER write Kunal Gupta, Kunal Patel, Kunal Sharma, etc.).
Sign off strictly as "${candidate.name}".

Provide output in 2 formats:
1. 📩 **LinkedIn Connection Request Note** (Under 300 characters, polite, asking for a quick 5-min advice or referral).
2. 📧 **Direct Cold Email to Recruiter/Engineer** (100 words max, punchy hook, mentioning key relevant projects, clear CTA).
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
        max_tokens: 400,
        temperature: 0.3,
      });

      if (res.choices[0]?.message?.content) {
        let content = res.choices[0].message.content;
        // Post-process to prevent name hallucinations
        content = content.replace(/Kunal\s+(Gupta|Patel|Sharma|Singh|Rai\s+Patel|Gupta\s+Patel)/gi, candidate.name);
        return content;
      }
    } catch (err) {}
  }

  return "Could not generate outreach message using available LLM models.";
}

