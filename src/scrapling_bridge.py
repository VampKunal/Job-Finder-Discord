"""
High-Performance Scrapling Bridge for Job-Listing-Bot
Integrates Scrapling with TLS Chrome Fingerprint impersonation,
Anti-Bot / Cloudflare bypass, and adaptive DOM extraction.
"""

import sys
import json
import re
import logging
from scrapling.fetchers import FetcherSession, StealthyFetcher

# Suppress verbose scrapling logs for clean JSON output
logging.getLogger("scrapling").setLevel(logging.ERROR)

SELECTORS = [
    "#job-details",
    ".job-description",
    ".description",
    ".show-more-less-html__markup",
    ".jobdetails",
    ".job-detail-content",
    "[data-test='job-description']",
    "article",
    "main",
    ".content",
    "#content"
]

def clean_text(raw_text: str) -> str:
    if not raw_text:
        return ""
    # Strip script/style artifacts
    cleaned = re.sub(r"<[^>]+>", " ", raw_text)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned)
    return cleaned.strip()[:3500]

def scrape_url(url: str, force_stealth: bool = False) -> dict:
    if not url or not url.startswith("http"):
        return {"success": False, "error": "Invalid URL"}

    extracted_text = ""
    status_code = 0

    # 1. Fast TLS-Impersonated Chrome session (no browser overhead, ~200ms)
    if not force_stealth:
        try:
            with FetcherSession(impersonate="chrome") as session:
                page = session.get(url, stealthy_headers=True, timeout=10)
                status_code = page.status
                if status_code in (200, 201, 204):
                    for sel in SELECTORS:
                        found = page.css(sel)
                        if found:
                            extracted_text = "\n".join([f.get_all_text() for f in found if f.get_all_text()])
                            if len(extracted_text.strip()) > 100:
                                break
                    
                    if not extracted_text or len(extracted_text.strip()) < 100:
                        all_text = page.get_all_text()
                        if len(all_text.strip()) > 100:
                            extracted_text = all_text
        except Exception:
            pass

    # 2. Stealthy Headless Browser Fetcher (Bypasses Cloudflare Turnstile / SPAs)
    if not extracted_text or len(extracted_text.strip()) < 100 or force_stealth:
        try:
            page = StealthyFetcher.fetch(url, headless=True, timeout=15000)
            status_code = getattr(page, "status", 200)
            for sel in SELECTORS:
                found = page.css(sel)
                if found:
                    extracted_text = "\n".join([f.get_all_text() for f in found if f.get_all_text()])
                    if len(extracted_text.strip()) > 100:
                        break
            if not extracted_text or len(extracted_text.strip()) < 100:
                extracted_text = page.get_all_text()
        except Exception as e:
            return {"success": False, "error": f"Stealth fetch error: {str(e)}", "status": status_code}

    final_text = clean_text(extracted_text)
    return {
        "success": bool(final_text and len(final_text) >= 50),
        "text": final_text,
        "length": len(final_text),
        "status": status_code
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing URL argument"}))
        return

    url = sys.argv[1]
    force_stealth = "--stealth" in sys.argv
    result = scrape_url(url, force_stealth)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
