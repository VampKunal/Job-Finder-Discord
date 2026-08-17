/**
 * Community-Maintained GitHub Open Internships Feed Fetcher
 * Dataset: SimplifyJobs / PittAPI Software Engineering Internships
 */

export async function fetchGitHubInternships() {
  try {
    const url = "https://raw.githubusercontent.com/SimplifyJobs/Summer2025-Internships/dev/.github/scripts/listings.json";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobBot/1.0"
      }
    });

    if (!res.ok) {
      console.warn(`[GitHub Internships] Returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Filter active listings
    const active = data.filter(item => item && item.active !== false && item.url);

    return active.map(item => {
      const company = item.company_name || "Tech Startup";
      const title = item.title || "Software Engineering Intern";
      const locations = Array.isArray(item.locations) ? item.locations.join(", ") : (item.locations || "Remote / Unspecified");
      const datePosted = item.date_posted ? new Date(item.date_posted * 1000).toISOString() : new Date().toISOString();

      return {
        id: `gh-intern-${item.id || Math.random().toString(36).substring(7)}`,
        title: title,
        company: company,
        link: item.url,
        location: locations,
        description: `Internship position at ${company}. Role: ${title}. Locations: ${locations}. Terms: ${item.terms?.join(", ") || "Summer Internship"}.`,
        date: datePosted,
        source: "GitHub Open Internships"
      };
    });
  } catch (err) {
    console.error(`[GitHub Internships] Fetch failed: ${err.message}`);
    return [];
  }
}
