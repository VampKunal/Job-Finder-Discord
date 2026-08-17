/**
 * Jobicy public JSON API fetcher
 * Endpoint: https://jobicy.com/api/v2/remote-jobs
 */

export async function fetchJobicyJobs() {
  try {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&industry=engineering", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0"
      }
    });

    if (!res.ok) {
      console.warn(`[Jobicy] API returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs.map(item => ({
      id: `jobicy-${item.id || Math.random().toString(36).substring(7)}`,
      title: item.jobTitle || "Software Engineer",
      company: item.companyName || "Unknown Company",
      link: item.url,
      location: item.jobGeo || "Remote",
      description: (item.jobDescription || item.jobExcerpt || "").replace(/<[^>]*>?/gm, ""),
      date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      source: "Jobicy"
    }));
  } catch (err) {
    console.error(`[Jobicy] Fetch failed: ${err.message}`);
    return [];
  }
}
