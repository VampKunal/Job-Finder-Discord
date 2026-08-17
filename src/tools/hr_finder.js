/**
 * Zero-Config HR & Recruiter Email Finder Engine (/hrfind)
 * No business email required, no signups needed!
 */

export async function findHREmails(companyDomainOrName, recruiterName = "") {
  const cleanDomain = companyDomainOrName
    .toLowerCase()
    .trim()
    .replace(/https?:\/\//, "")
    .replace(/www\./, "")
    .split("/")[0];

  const companyName = cleanDomain.split(".")[0];
  const capitalizedCompany = companyName.charAt(0).toUpperCase() + companyName.slice(1);

  // 1. Core Corporate HR & Talent Acquisition Inboxes
  const standardInboxes = [
    `careers@${cleanDomain}`,
    `recruiting@${cleanDomain}`,
    `hr@${cleanDomain}`,
    `talent@${cleanDomain}`,
    `jobs@${cleanDomain}`,
    `university@${cleanDomain}`
  ];

  // 2. Personal Recruiter Email Permutations (if recruiter name is provided)
  let emailPermutations = [];
  if (recruiterName) {
    const parts = recruiterName.toLowerCase().trim().split(/\s+/);
    const first = parts[0] || "";
    const last = parts[parts.length - 1] || "";

    if (first && last) {
      emailPermutations = [
        `${first}.${last}@${cleanDomain}`,
        `${first}${last}@${cleanDomain}`,
        `${first}@${cleanDomain}`,
        `${first[0]}${last}@${cleanDomain}`,
        `${first}.${last[0]}@${cleanDomain}`
      ];
    }
  }

  // 3. Search Engine X-Ray Query Links (Instant 1-Click Search)
  const linkedinRecruiterQuery = `site:linkedin.com/in/ ("recruiter" OR "talent acquisition" OR "technical recruiter" OR "HR") "${capitalizedCompany}"`;
  const linkedinSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(linkedinRecruiterQuery)}`;

  const twitterHiringQuery = `"hiring" ("intern" OR "software" OR "developer") "${capitalizedCompany}"`;
  const twitterSearchUrl = `https://x.com/search?q=${encodeURIComponent(twitterHiringQuery)}&f=live`;

  const publicEmailSearchQuery = `"@${cleanDomain}" ("recruiter" OR "HR" OR "careers" OR "hiring")`;
  const googleEmailSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(publicEmailSearchQuery)}`;

  // 4. Format Output Response
  let response = `🔎 **HR & Recruiter Finder for ${capitalizedCompany} (\`${cleanDomain}\`)**\n\n`;

  if (emailPermutations.length > 0) {
    response += `👤 **Generated Recruiter Email Patterns for ${recruiterName}:**\n`;
    emailPermutations.forEach(e => response += `• \`${e}\`\n`);
    response += `\n`;
  }

  response += `📧 **Standard Recruiter & Talent Inboxes:**\n`;
  standardInboxes.forEach(a => response += `• \`${a}\`\n`);
  response += `\n`;

  response += `🔗 **Instant 1-Click Recruiter Finder Links:**\n`;
  response += `• 👔 [Find ${capitalizedCompany} Recruiters on LinkedIn](${linkedinSearchUrl})\n`;
  response += `• 🐦 [Find Live Hiring Tweets on X/Twitter](${twitterSearchUrl})\n`;
  response += `• 🔍 [Search Public Recruiter Emails on Google](${googleEmailSearchUrl})\n`;

  return response;
}
