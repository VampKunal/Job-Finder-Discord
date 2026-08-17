/**
 * Remotive public JSON API fetcher
 * Endpoint: https://remotive.com/api/remote-jobs
 */

export async function fetchRemotiveJobs() {
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?category=software-dev", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0"
      }
    });

    if (!res.ok) {
      console.warn(`[Remotive] API returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs.map(item => ({
      id: `remotive-${item.id}`,
      title: item.title || "Software Role",
      company: item.company_name || "Unknown Startup",
      link: item.url,
      location: item.candidate_required_location || "Remote",
      description: (item.description || "").replace(/<[^>]*>?/gm, ""),
      date: item.publication_date ? new Date(item.publication_date).toISOString() : new Date().toISOString(),
      source: "Remotive"
    }));
  } catch (err) {
    console.error(`[Remotive] Fetch failed: ${err.message}`);
    return [];
  }
}
