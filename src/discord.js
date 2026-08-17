/**
 * Discord Webhook Push Notification Module
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pushToDiscord(job, scoreObj) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[Discord] DISCORD_WEBHOOK_URL is not configured. Skipping webhook push.");
    return false;
  }

  const minScore = parseInt(process.env.MIN_SCORE_THRESHOLD || "6", 10);
  if (scoreObj.score < minScore) {
    console.log(`[Discord] Skipping push for "${job.title}" at ${job.company} (Score ${scoreObj.score} < Threshold ${minScore})`);
    return false;
  }

  // Determine color based on score
  let color = 0xff6644; // Red for lower score
  let emoji = "🔴";
  if (scoreObj.score >= 8) {
    color = 0x00cc66; // Green
    emoji = "🟢";
  } else if (scoreObj.score >= 6) {
    color = 0xffcc00; // Yellow
    emoji = "🟡";
  }

  const embed = {
    title: `${emoji} ${job.title} @ ${job.company}`,
    url: job.link,
    description: scoreObj.reason || "Matched target profile criteria.",
    color: color,
    fields: [
      { name: "📍 Location", value: job.location || "Remote", inline: true },
      { name: "📊 Score", value: `${scoreObj.score}/10`, inline: true },
      { name: "🏷️ Source", value: job.source || "Web", inline: true },
      { name: "📅 Posted", value: job.date ? new Date(job.date).toLocaleDateString() : "Recent", inline: true }
    ],
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

    console.log(`[Discord] Pushed: ${job.title} @ ${job.company} [Score ${scoreObj.score}/10]`);

    // Respect Discord rate limits with small delay
    await sleep(500);
    return true;
  } catch (err) {
    console.error(`[Discord] Webhook push error: ${err.message}`);
    return false;
  }
}
