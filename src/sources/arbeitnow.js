/**
 * Arbeitnow public API fetcher
 * Endpoint: https://www.arbeitnow.com/api/job-board-api
 */

export async function fetchArbeitnowJobs() {
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0"
      }
    });

    if (!res.ok) {
      console.warn(`[Arbeitnow] API returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const jobs = data.data || [];

    return jobs.map(item => ({
      id: `arbeitnow-${item.slug || Math.random().toString(36).substring(7)}`,
      title: item.title || "Software Role",
      company: item.company_name || "Unknown Company",
      link: item.url || `https://www.arbeitnow.com/view/${item.slug}`,
      location: item.location || (item.remote ? "Remote" : "Unknown"),
      description: (item.description || item.tags?.join(", ") || "").replace(/<[^>]*>?/gm, ""),
      date: item.created_at ? new Date(item.created_at * 1000).toISOString() : new Date().toISOString(),
      source: "Arbeitnow"
    }));
  } catch (err) {
    console.error(`[Arbeitnow] Fetch failed: ${err.message}`);
    return [];
  }
}
