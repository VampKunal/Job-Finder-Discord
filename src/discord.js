/**
 * Discord Webhook Push Notification Module — Multi-Candidate Support
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
    console.log(`[Discord] Skipping push for "${job.title}" at ${job.company} (Max Score ${maxScore} < Threshold ${minScore})`);
    return false;
  }

  // Determine color based on highest score among candidates
  let color = 0xff6644; // Red
  let emoji = "🔴";
  if (maxScore >= 8) {
    color = 0x00cc66; // Green
    emoji = "🟢";
  } else if (maxScore >= 6) {
    color = 0xffcc00; // Yellow
    emoji = "🟡";
  }

  // Build candidate evaluation fields
  const fields = [];

  if (Array.isArray(scoreObj.candidates) && scoreObj.candidates.length > 0) {
    scoreObj.candidates.forEach(c => {
      fields.push({
        name: `👤 ${c.name} — ${c.score}/10`,
        value: `**Remote Eligibility:** ${c.remoteEligible || "Unsure"}\n**Match:** ${c.reason || "N/A"}`,
        inline: false
      });
    });
  }

  // Meta fields
  fields.push(
    { name: "📍 Location", value: job.location || "Remote", inline: true },
    { name: "🏷️ Source", value: job.source || "Web", inline: true },
    { name: "📅 Posted", value: job.date ? new Date(job.date).toLocaleDateString() : "Recent", inline: true }
  );

  const embed = {
    title: `${emoji} ${job.title} @ ${job.company}`,
    url: job.link,
    description: `🎯 **Favored For:** ${scoreObj.bestMatch}\n💡 ${scoreObj.favoredReason}`,
    color: color,
    fields: fields,
    footer: { text: `ID: ${job.id}` },
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

    console.log(`[Discord] Pushed: ${job.title} @ ${job.company} [Favors: ${scoreObj.bestMatch} | Max Score: ${maxScore}/10]`);

    // Respect Discord rate limits with small delay
    await sleep(600);
    return true;
  } catch (err) {
    console.error(`[Discord] Webhook push error: ${err.message}`);
    return false;
  }
}
