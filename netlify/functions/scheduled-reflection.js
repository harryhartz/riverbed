import { db, migrate } from '../lib/db.js';
import { generateReflection } from '../lib/reflection-engine.js';

// Netlify Scheduled Function — runs on the cron schedule below,
// regardless of traffic. Replaces the node-cron daily check from the
// original always-on Express server. Checks whether the configured
// cadence (weekly/monthly) means a reflection is due, and if so,
// generates one — same engine, same tone rules, as the manual button.

export default async () => {
  await migrate();

  const settingsResult = await db.execute(`SELECT * FROM settings WHERE key = 'reflection_cadence'`);
  const cadence = settingsResult.rows[0]?.value || 'off';
  if (cadence === 'off') {
    return new Response('Cadence is off, nothing to do.');
  }

  const lastResult = await db.execute(
    `SELECT created_at FROM reflections WHERE trigger = 'scheduled' ORDER BY created_at DESC LIMIT 1`
  );
  const last = lastResult.rows[0]?.created_at;
  const daysSince = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;
  const dueDays = cadence === 'weekly' ? 7 : 30;

  if (daysSince < dueDays) {
    return new Response(`Not due yet (${daysSince.toFixed(1)} of ${dueDays} days).`);
  }

  const result = await generateReflection({ trigger: 'scheduled' });
  return new Response(JSON.stringify(result));
};

export const config = {
  // Runs once a day at 08:00 UTC. Netlify Scheduled Functions use
  // cron syntax; this is free on all Netlify plans.
  schedule: '0 8 * * *',
};
