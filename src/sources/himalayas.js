/**
 * Himalayas public JSON API fetcher — multiple queries for broader coverage
 */

export async function fetchHimalayasJobs() {
  const queries = ["intern", "junior developer", "fresher", "entry level", "software engineer"];
  const allJobs = [];
  const seen = new Set();

  for (const q of queries) {
    try {
      const res = await fetch(`https://himalayas.app/jobs/api?q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0" }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const jobs = data.jobs || [];

      for (const item of jobs) {
        const id = `himalayas-${item.id || item.slug}`;
        if (seen.has(id)) continue;
        seen.add(id);
        allJobs.push({
          id,
          title: item.title || "Software Role",
          company: item.companyName || item.company_name || "Unknown Company",
          link: item.applicationLink || item.url || `https://himalayas.app/jobs/${item.slug}`,
          location: item.locationRestrictions?.join(", ") || item.location || "Remote",
          description: (item.excerpt || item.description || "").replace(/<[^>]*>?/gm, ""),
          date: item.pubDate ? new Date(item.pubDate * 1000).toISOString() : new Date().toISOString(),
          source: "Himalayas"
        });
      }
    } catch (err) {
      console.warn(`[Himalayas] Query "${q}" failed: ${err.message}`);
    }
  }

  return allJobs;
}

