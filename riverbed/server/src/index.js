import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { migrate, db } from './db.js';
import { entriesRouter } from './routes/entries.js';
import { reflectionsRouter } from './routes/reflections.js';
import { settingsRouter } from './routes/settings.js';
import { generateReflection } from './reflection-engine.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/entries', entriesRouter);
app.use('/api/reflections', reflectionsRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

async function start() {
  await migrate();

  app.listen(PORT, () => {
    console.log(`Riverbed server listening on :${PORT}`);
  });

  // Scheduled reflection pass — checks daily whether the configured
  // cadence (weekly/monthly) says it's time to generate one. The
  // on-demand "Reflect now" button bypasses this entirely via
  // POST /api/reflections/generate.
  cron.schedule('0 8 * * *', async () => {
    try {
      const settingsResult = await db.execute(`SELECT * FROM settings WHERE key = 'reflection_cadence'`);
      const cadence = settingsResult.rows[0]?.value || 'off';
      if (cadence === 'off') return;

      const lastResult = await db.execute(
        `SELECT created_at FROM reflections WHERE trigger = 'scheduled' ORDER BY created_at DESC LIMIT 1`
      );
      const last = lastResult.rows[0]?.created_at;
      const daysSince = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;

      const dueDays = cadence === 'weekly' ? 7 : 30;
      if (daysSince >= dueDays) {
        console.log('Running scheduled reflection...');
        await generateReflection({ trigger: 'scheduled' });
      }
    } catch (err) {
      console.error('Scheduled reflection failed:', err);
    }
  });
}

start();
