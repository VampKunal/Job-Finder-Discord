/**
 * Himalayas public JSON API fetcher
 * Endpoint: https://himalayas.app/jobs/api?q=intern
 */

export async function fetchHimalayasJobs() {
  try {
    const res = await fetch("https://himalayas.app/jobs/api?q=intern", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0"
      }
    });

    if (!res.ok) {
      console.warn(`[Himalayas] API returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs.map(item => ({
      id: `himalayas-${item.id || item.slug || Math.random().toString(36).substring(7)}`,
      title: item.title || "Software Role",
      company: item.companyName || item.company_name || "Unknown Company",
      link: item.applicationLink || item.url || `https://himalayas.app/jobs/${item.slug}`,
      location: item.locationRestrictions?.join(", ") || item.location || "Remote",
      description: (item.excerpt || item.description || "").replace(/<[^>]*>?/gm, ""),
      date: item.pubDate ? new Date(item.pubDate * 1000).toISOString() : new Date().toISOString(),
      source: "Himalayas"
    }));
  } catch (err) {
    console.error(`[Himalayas] Fetch failed: ${err.message}`);
    return [];
  }
}
