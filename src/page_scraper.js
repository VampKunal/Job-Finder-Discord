/**
 * High-Speed In-House Full-Page HTML Scraper
 * Uses native fetch + Cheerio to extract core job text from posting URLs.
 * 100% Free, zero external API key required.
 */

import * as cheerio from "cheerio";

// Pre-configured headers to mimic realistic browser request
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

/**
 * Scrapes and cleans full job text from a posting URL.
 * @param {string} url - Target job posting URL
 * @returns {Promise<string>} Cleaned job description text (capped at 3500 chars)
 */
export async function scrapeJobPageText(url) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return "";
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s hard timeout per page

    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow"
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    if (!html || html.length < 100) {
      return "";
    }

    const $ = cheerio.load(html);

    // Remove noise elements
    $("script, style, nav, header, footer, svg, iframe, noscript, button, input, form, select, option, meta, link, [role='navigation']").remove();

    // Priority job detail container selectors across different job boards & ATS
    const SELECTORS = [
      "#job-details",
      ".job-description",
      ".description",
      ".show-more-less-html__markup", // LinkedIn
      ".jobdetails",
      ".job-detail-content",
      "[data-test='job-description']",
      "article",
      "main"
    ];

    let extractedText = "";

    for (const selector of SELECTORS) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().replace(/\s+/g, " ").trim();
        if (text.length >= 100) {
          extractedText = text;
          break;
        }
      }
    }

    // Fallback to body text if specific selector wasn't found or was too brief
    if (!extractedText || extractedText.length < 100) {
      extractedText = $("body").text().replace(/\s+/g, " ").trim();
    }

    // Clean up & cap at 3500 characters
    return extractedText.slice(0, 3500);
  } catch (err) {
    // Fail silently & fall back to feed snippet
    return "";
  }
}
