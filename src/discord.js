/**
 * Discord Webhook Push Notification Module v2 — India-Fresher-First
 * Now shows India eligibility prominently in the embed
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pushToDiscord(job, scoreObj) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[Discord] DISCORD_WEBHOOK_URL is not configured. Skipping webhook push.");
    return false;
  }

  const minScore = parseInt(process.env.MIN_SCORE_THRESHOLD || "6", 10);
  const maxScore = scoreObj.maxScore || 0;

  if (maxScore < minScore) {
    console.log(`[Discord] Skipping "${job.title}" @ ${job.company} (Score ${maxScore} < ${minScore})`);
    return false;
  }

  // Determine color based on highest score
  let color = 0xff6644; // Red
  let emoji = "🔴";
  if (maxScore >= 8) {
    color = 0x00cc66; // Green — excellent match
    emoji = "🟢";
  } else if (maxScore >= 6) {
    color = 0xffcc00; // Yellow — good match
    emoji = "🟡";
  }

  // Build candidate evaluation fields
  const fields = [];

  if (Array.isArray(scoreObj.candidates) && scoreObj.candidates.length > 0) {
    scoreObj.candidates.forEach(c => {
      const eligIcon = (c.remoteEligible || "").includes("✅") ? "✅" :
                       (c.remoteEligible || "").includes("❌") ? "❌" : "⚠️";
      fields.push({
        name: `👤 ${c.name} — ${c.score}/10`,
        value: `${eligIcon} **Eligibility:** ${c.remoteEligible || "Unsure"}\n🎯 **Match:** ${c.reason || "N/A"}`,
        inline: false
      });
    });
  }

  // Determine India eligibility tag for the title
  const locLower = (job.location || "").toLowerCase();
  const sourceLower = (job.source || "").toLowerCase();
  let locationTag = "🌍";
  if (/india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai|kolkata|noida|gurgaon/i.test(locLower)
    || ["internshala", "unstop", "freshersworld", "naukri", "indeed india"].some(s => sourceLower.includes(s))) {
    locationTag = "🇮🇳";
  } else if (/worldwide|global|anywhere|remote/i.test(locLower)) {
    locationTag = "🌐";
  }

  // Meta fields
  fields.push(
    { name: `${locationTag} Location`, value: job.location || "Remote", inline: true },
    { name: "🏷️ Source", value: job.source || "Web", inline: true },
    { name: "📅 Posted", value: job.date ? new Date(job.date).toLocaleDateString() : "Recent", inline: true }
  );

  const embed = {
    title: `${emoji} ${locationTag} ${job.title} @ ${job.company}`,
    url: job.link,
    description: `🎯 **Favored For:** ${scoreObj.bestMatch}\n💡 ${scoreObj.favoredReason}`,
    color: color,
    fields: fields,
    footer: { text: `Job Bot v2 | India-Fresher-First | ID: ${job.id}` },
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!res.ok) {
      console.error(`[Discord] Webhook push failed (HTTP ${res.status}): ${await res.text()}`);
      return false;
    }

    console.log(`[Discord] ✅ Pushed: ${locationTag} ${job.title} @ ${job.company} [${scoreObj.bestMatch} | Score: ${maxScore}/10]`);

    // Respect Discord rate limits
    await sleep(600);
    return true;
  } catch (err) {
    console.error(`[Discord] Webhook push error: ${err.message}`);
    return false;
  }
}
