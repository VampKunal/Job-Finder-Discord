/**
 * HR & Recruiter Email Finder Module (/hrfind)
 * Uses Hunter.io API + Corporate Email Patterns + LinkedIn Recruiter X-Ray Links
 */

export async function findHREmails(companyDomainOrName) {
  const domain = companyDomainOrName.toLowerCase().replace(/https?:\/\//, "").replace(/www\./, "").split("/")[0];
  const hunterApiKey = process.env.HUNTER_API_KEY;

  let emailsFound = [];
  let patternInfo = "";

  if (hunterApiKey) {
    try {
      const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&department=hr&api_key=${hunterApiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const emails = data.data?.emails || [];
        emailsFound = emails.map(e => `• **${e.first_name} ${e.last_name}** (${e.position || "HR/Recruiter"}): \`${e.value}\``);
        if (data.data?.pattern) {
          patternInfo = `\n💡 Company Email Pattern: \`${data.data.pattern}@${domain}\``;
        }
      }
    } catch (err) {
      console.warn(`[HR Finder] Hunter.io API failed: ${err.message}`);
    }
  }

  // Fallback / Standard Email Alias Patterns
  const standardAliases = [
    `careers@${domain}`,
    `recruiting@${domain}`,
    `hr@${domain}`,
    `talent@${domain}`
  ];

  // LinkedIn Google X-Ray Search URL to find recruiters for this company instantly
  const linkedinXrayUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in/ "recruiter" OR "talent acquisition" OR "HR" "${domain.split('.')[0]}"`)}`;

  let response = `🔍 **HR & Recruiter Finder for ${domain}**\n\n`;

  if (emailsFound.length > 0) {
    response += `✅ **Verified HR Emails (via Hunter.io):**\n${emailsFound.join("\n")}\n${patternInfo}\n\n`;
  } else {
    response += `📧 **Standard Recruiter Inbox Aliases:**\n` + standardAliases.map(a => `• \`${a}\``).join("\n") + `\n\n`;
  }

  response += `🔎 **Find Recruiter Profiles on LinkedIn:**\n[Click here to search ${domain} recruiters on LinkedIn](${linkedinXrayUrl})`;

  return response;
}
