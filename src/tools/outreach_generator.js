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

Candidate: ${candidate.name} (${candidate.role})
Key Skills: ${candidate.skills?.slice(0, 6).join(", ")}
Target Company: ${companyName}
Target Role: ${jobTitle}

Provide output in 2 formats:
1. 📩 **LinkedIn Connection Request Note** (Under 300 characters, polite, asking for a quick 5-min advice or referral).
2. 📧 **Direct Cold Email to Recruiter/Engineer** (100 words max, punchy hook, mentioning key relevant projects, clear CTA).
`;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.3,
    });

    return res.choices[0]?.message?.content || "Could not generate outreach message.";
  } catch (err) {
    return `Error generating outreach message: ${err.message}`;
  }
}
