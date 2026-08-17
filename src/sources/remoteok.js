/**
 * RemoteOK public JSON API fetcher
 * Endpoint: https://remoteok.com/api
 */

export async function fetchRemoteOKJobs() {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0"
      }
    });

    if (!res.ok) {
      console.warn(`[RemoteOK] API returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Filter out metadata item (first item in RemoteOK response)
    const jobs = data.filter(item => item && item.id && item.position);

    return jobs.map(item => ({
      id: `remoteok-${item.id}`,
      title: item.position || "Software Role",
      company: item.company || "Unknown Company",
      link: item.url || item.apply_url || `https://remoteok.com/remote-jobs/${item.id}`,
      location: item.location || "Remote",
      description: (item.description || item.tags?.join(", ") || "").replace(/<[^>]*>?/gm, ""),
      date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
      source: "RemoteOK"
    }));
  } catch (err) {
    console.error(`[RemoteOK] Fetch failed: ${err.message}`);
    return [];
  }
}
