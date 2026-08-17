/**
 * Serverless Discord Slash Commands Endpoint (Vercel / Node HTTP API)
 */

import { analyzeSkillGap } from "../src/tools/gap_analysis.js";
import { generateOutreachMessage } from "../src/tools/outreach_generator.js";
import { findHREmails } from "../src/tools/hr_finder.js";
import { getBotStats } from "../src/tools/stats.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, data } = req.body || {};

  // PING check from Discord Interactions URL verification
  if (type === 1) {
    return res.status(200).json({ type: 1 });
  }

  // Slash Command Execution (type === 2)
  if (type === 2) {
    const commandName = data.name;
    const options = (data.options || []).reduce((acc, opt) => {
      acc[opt.name] = opt.value;
      return acc;
    }, {});

    let content = "Processing request...";

    if (commandName === "stats") {
      content = await getBotStats();
    } else if (commandName === "hrfind") {
      const domain = options.domain || "stripe.com";
      content = await findHREmails(domain);
    } else if (commandName === "outreach") {
      const company = options.company || "Company";
      const title = options.title || "Software Engineer Intern";
      const candidate = options.candidate || "Kunal";
      content = await generateOutreachMessage(company, title, candidate);
    } else if (commandName === "gap") {
      const description = options.description || "Software Engineer Intern role requiring React, Node, Python, and SQL.";
      const candidate = options.candidate || "Kunal";
      content = await analyzeSkillGap(description, candidate);
    }

    return res.status(200).json({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: content
      }
    });
  }

  return res.status(400).json({ error: "Unknown interaction type" });
}
