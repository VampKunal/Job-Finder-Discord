/**
 * Phase 2: Gmail Alert Parser for Naukri, Indeed, and LinkedIn Email Alerts
 * Requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 */

import { google } from "googleapis";
import * as cheerio from "cheerio";

const ALERT_SENDERS = ["naukri.com", "indeed.com", "linkedin.com"];

function getGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Optional Jina Reader fetcher to get clean markdown text for job links extracted from emails
 */
async function fetchJobDetailsWithJina(url) {
  try {
    const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0" };
    if (process.env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const res = await fetch(`https://r.jina.ai/${url}`, { headers });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null;
  }
}

export async function fetchGmailAlertJobs() {
  const gmail = getGmailClient();
  if (!gmail) {
    console.log("[Gmail Alerts] Phase 2 Gmail credentials (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN) not set. Skipping.");
    return [];
  }

  try {
    // Search unread alert emails from Naukri, Indeed, LinkedIn
    const query = "from:(naukri.com OR indeed.com OR linkedin.com) is:unread";
    const res = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 10 });
    const messages = res.data.messages || [];

    if (messages.length === 0) {
      console.log("[Gmail Alerts] No new unread job alert emails found.");
      return [];
    }

    console.log(`[Gmail Alerts] Found ${messages.length} unread job alert email(s).`);
    const jobs = [];

    for (const msg of messages) {
      try {
        const email = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
        const payload = email.data.payload;

        let bodyHtml = "";
        if (payload.body?.data) {
          bodyHtml = Buffer.from(payload.body.data, "base64").toString("utf-8");
        } else if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === "text/html" && part.body?.data) {
              bodyHtml = Buffer.from(part.body.data, "base64").toString("utf-8");
              break;
            }
          }
        }

        if (!bodyHtml) continue;

        const $ = cheerio.load(bodyHtml);
        const extractedLinks = [];

        // Parse Naukri links
        $("a[href*='naukri.com/job-listings'], a[href*='naukri.com/job']").each((_, el) => {
          const href = $(el).attr("href");
          const title = $(el).text().trim();
          if (href && title) extractedLinks.push({ url: href, title, source: "Naukri Alert" });
        });

        // Parse Indeed links
        $("a[href*='indeed.com/rc/clk'], a[href*='indeed.com/viewjob']").each((_, el) => {
          const href = $(el).attr("href");
          const title = $(el).text().trim();
          if (href && title) extractedLinks.push({ url: href, title, source: "Indeed Alert" });
        });

        // Parse LinkedIn alert links
        $("a[href*='linkedin.com/comm/jobs/view']").each((_, el) => {
          const href = $(el).attr("href");
          const title = $(el).text().trim();
          if (href && title) extractedLinks.push({ url: href, title, source: "LinkedIn Alert" });
        });

        for (const item of extractedLinks.slice(0, 5)) {
          // Fetch JD content via Jina Reader or fallback to title
          const jdContent = await fetchJobDetailsWithJina(item.url);

          jobs.push({
            id: `email-${Buffer.from(item.url).toString("base64").substring(0, 20)}`,
            title: item.title || "Software Developer",
            company: item.source.includes("Naukri") ? "Naukri Employer" : item.source.includes("Indeed") ? "Indeed Employer" : "LinkedIn Employer",
            link: item.url,
            location: "India / Flexible",
            description: jdContent ? jdContent.slice(0, 1000) : `Job listing received via ${item.source}: ${item.title}`,
            date: new Date().toISOString(),
            source: item.source
          });
        }

        // Mark email as read by removing UNREAD label
        await gmail.users.messages.modify({
          userId: "me",
          id: msg.id,
          requestBody: { removeLabelIds: ["UNREAD"] }
        });

      } catch (err) {
        console.warn(`[Gmail Alerts] Failed processing message ${msg.id}: ${err.message}`);
      }
    }

    return jobs;
  } catch (err) {
    console.error(`[Gmail Alerts] Error querying Gmail API: ${err.message}`);
    return [];
  }
}
