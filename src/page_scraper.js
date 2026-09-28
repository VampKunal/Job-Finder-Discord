/**
 * High-Speed In-House Full-Page HTML & Scrapling Stealth Scraper
 * Uses native fetch + Cheerio for fast static pages, and automatically
 * falls back to Python Scrapling (TLS Chrome fingerprint impersonation &
 * Cloudflare bypass) for JS-heavy SPAs or protected job portals.
 */

import * as cheerio from "cheerio";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPLING_BRIDGE_PATH = path.join(__dirname, "scrapling_bridge.py");

// Pre-configured headers to mimic realistic browser request
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

/**
 * Scrapes job text using Python Scrapling bridge (TLS impersonation / Cloudflare bypass)
 * @param {string} url - Target job page URL
 * @param {boolean} forceStealth - Whether to force headless browser stealth mode
 * @returns {Promise<string>}
 */
export function scrapeWithScrapling(url, forceStealth = false) {
  return new Promise((resolve) => {
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return resolve("");
    }

    const args = [SCRAPLING_BRIDGE_PATH, url];
    if (forceStealth) args.push("--stealth");

    execFile("python", args, { timeout: 15000 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve("");
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.success && parsed.text && parsed.text.length >= 50) {
          resolve(parsed.text.slice(0, 3500));
        } else {
          resolve("");
        }
      } catch {
        resolve("");
      }
    });
  });
}

/**
 * Scrapes and cleans full job text from a posting URL.
 * 1. Tries ultra-fast native fetch (0ms overhead)
 * 2. If blocked (403/429/Empty/JS-SPA), falls back seamlessly to Scrapling Stealth
 * @param {string} url - Target job posting URL
 * @returns {Promise<string>} Cleaned job description text (capped at 3500 chars)
 */
export async function scrapeJobPageText(url) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return "";
  }

  let extractedText = "";

  // 1. Fast Native Fetch attempt
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow"
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await response.text();
      if (html && html.length >= 100) {
        const $ = cheerio.load(html);
        $("script, style, nav, header, footer, svg, iframe, noscript, button, input, form, select, option, meta, link, [role='navigation']").remove();

        const SELECTORS = [
          "#job-details",
          ".job-description",
          ".description",
          ".show-more-less-html__markup",
          ".jobdetails",
          ".job-detail-content",
          "[data-test='job-description']",
          "article",
          "main"
        ];

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

        if (!extractedText || extractedText.length < 100) {
          const bodyText = $("body").text().replace(/\s+/g, " ").trim();
          if (bodyText.length >= 100) {
            extractedText = bodyText;
          }
        }
      }
    }
  } catch {
    // Native fetch failed / timed out, will proceed to Scrapling fallback
  }

  // 2. If native fetch was empty or blocked, invoke Scrapling
  if (!extractedText || extractedText.length < 100) {
    try {
      const scraplingResult = await scrapeWithScrapling(url);
      if (scraplingResult && scraplingResult.length >= 50) {
        extractedText = scraplingResult;
      }
    } catch {
      // Ignore
    }
  }

  return (extractedText || "").slice(0, 3500);
}
