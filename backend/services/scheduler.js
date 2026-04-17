// services/scheduler.js — Background automation: every 5 minutes
// Flow: fetch weather+AQI → evaluate triggers → auto-create claims → fraud check → approve/reject → payout

'use strict';

const cron = require('node-cron');
const { processTriggerEvents, fetchWeather, fetchAQI } = require('./triggerMonitor');
const { getDb } = require('../config/database');

// ── Monitored cities ──────────────────────────────────────────────────────────
const MONITORED_CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];
const ALL_ZONES        = ['Central', 'North', 'South', 'East', 'West', 'Suburbs'];

let isRunning        = false;
let lastRunAt        = null;
let totalRunCount    = 0;
let totalClaimsAuto  = 0;
let totalPayoutsAuto = 0;
let lastRunResults   = [];

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level, msg, data = {}) => {
  const ts  = new Date().toISOString().slice(11, 19);
  const tag = `[Scheduler ${ts}]`;
  if (level === 'error') console.error(`${tag} ❌ ${msg}`, Object.keys(data).length ? data : '');
  else if (level === 'warn') console.warn(`${tag}  ⚠️  ${msg}`, Object.keys(data).length ? data : '');
  else console.log(`${tag} ${level === 'step' ? '→' : '✅'} ${msg}`, Object.keys(data).length ? data : '');
};

// ── Expire stale policies ─────────────────────────────────────────────────────
const expireOldPolicies = () => {
  try {
    const db = getDb();
    const result = db.prepare(`
      UPDATE policies SET status = 'expired'
      WHERE status = 'active' AND end_date < datetime('now')
    `).run();
    if (result.changes > 0) {
      log('info', `Expired ${result.changes} policy(ies) past end date`);
    }
  } catch (err) {
    log('error', 'Failed to expire policies', { error: err.message });
  }
};

// ── Recalculate risk scores for active users ──────────────────────────────────
const refreshRiskScores = async () => {
  try {
    const db = getDb();
    const { computeRiskScore } = require('./aiEngine');
    const workers = db.prepare(`
      SELECT id, city, zone, platform, avg_weekly_income FROM users WHERE is_admin = 0
    `).all();

    let updated = 0;
    for (const w of workers) {
      const claimCount = db.prepare(`SELECT COUNT(*) as n FROM claims WHERE user_id = ?`).get(w.id)?.n || 0;
      const result = computeRiskScore({
        city: w.city, zone: w.zone, platform: w.platform,
        avgWeeklyIncome: w.avg_weekly_income, historicalClaims: claimCount,
      });
      db.prepare('UPDATE users SET risk_score = ? WHERE id = ?').run(result.riskScore, w.id);
      updated++;
    }
    if (updated > 0) log('info', `Refreshed risk scores for ${updated} worker(s)`);
  } catch (err) {
    log('error', 'Risk score refresh failed', { error: err.message });
  }
};

// ── Core scheduler run function ───────────────────────────────────────────────
const runSchedulerCycle = async () => {
  if (isRunning) {
    log('warn', 'Previous cycle still running — skipping this tick');
    return;
  }

  isRunning      = true;
  totalRunCount += 1;
  const cycleStart = Date.now();
  const cycleResults = [];

  log('step', `=== Scheduler Cycle #${totalRunCount} START ===`);

  // ── Step 1: Expire old policies ───────────────────────────────────────────
  log('step', 'Step 1: Expiring stale policies');
  expireOldPolicies();

  // ── Step 2: Fetch weather + AQI for all cities (with real API + fallback) ─
  log('step', 'Step 2: Fetching live weather + AQI data');
  const cityConditions = {};
  for (const city of MONITORED_CITIES) {
    try {
      const [weather, aqiData] = await Promise.all([fetchWeather(city), fetchAQI(city)]);
      cityConditions[city] = { weather, aqi: aqiData.aqi, source: weather.source };
      const syncMsg = `[SYNC] ${city}: ${weather.rainfall}mm rain | ${weather.temp}°C | AQI ${aqiData.aqi} [via ${weather.source}]`;
      log('step', syncMsg);
    } catch (err) {
      log('error', `  Failed to fetch conditions for ${city}`, { error: err.message });
    }
  }

  // ── Step 3: Evaluate triggers + auto-create claims for each city ──────────
  log('step', 'Step 3: Evaluating parametric triggers + processing auto-claims');
  let cycleNewClaims  = 0;
  let cyclePayouts    = 0;

  for (const city of MONITORED_CITIES) {
    try {
      const result = await processTriggerEvents(city, null); // null zone = all zones

      if (result.triggered.length > 0) {
        log('step', `  ${city}: ${result.triggered.length} trigger(s) fired → ${result.newClaims.length} claim(s) processed`);
      }

      const paidClaims = result.newClaims.filter(c => c.status === 'paid');
      cycleNewClaims  += result.newClaims.length;
      cyclePayouts    += paidClaims.length;
      totalClaimsAuto += result.newClaims.length;
      totalPayoutsAuto += paidClaims.length;

      if (result.newClaims.length > 0) {
        cycleResults.push({
          city,
          triggersCount:  result.triggered.length,
          claimsCount:    result.newClaims.length,
          paidCount:      paidClaims.length,
          totalPayout:    paidClaims.reduce((s, c) => s + (c.payoutAmount || 0), 0),
          triggerTypes:   result.triggered.map(t => t.type),
        });
      }
    } catch (err) {
      log('error', `  Trigger processing failed for ${city}`, { error: err.message });
    }
  }

  // ── Step 4: Log summary ───────────────────────────────────────────────────
  const elapsed = Date.now() - cycleStart;
  log('info', `Step 4: Cycle #${totalRunCount} complete — ${cycleNewClaims} claim(s), ${cyclePayouts} payout(s) in ${elapsed}ms`);

  // ── Step 5: Refresh risk scores every 10th cycle ─────────────────────────
  if (totalRunCount % 10 === 0) {
    log('step', 'Step 5: Risk score refresh (every 10 cycles)');
    await refreshRiskScores();
  }

  lastRunAt      = new Date().toISOString();
  lastRunResults = cycleResults;
  isRunning      = false;

  log('step', `=== Scheduler Cycle #${totalRunCount} END (${elapsed}ms) ===\n`);
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * startScheduler — Initialize cron job (every 5 minutes)
 */
const startScheduler = () => {
  log('info', '🕐 Background scheduler starting — cron: every 5 minutes');

  // Run once immediately on startup
  setTimeout(() => runSchedulerCycle().catch(err => log('error', 'Startup cycle failed', { error: err.message })), 3000);

  // Then every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    runSchedulerCycle().catch(err => log('error', 'Scheduled cycle failed', { error: err.message }));
  });

  log('info', '✅ Scheduler initialized. Next auto-run in 5 minutes.');
};

/**
 * getSchedulerStatus — Returns current state for /api/admin/insights
 */
const getSchedulerStatus = () => ({
  isRunning,
  lastRunAt,
  totalRunCount,
  totalClaimsAuto,
  totalPayoutsAuto,
  lastRunResults,
  nextRunIn: lastRunAt
    ? Math.max(0, 300 - Math.floor((Date.now() - new Date(lastRunAt).getTime()) / 1000)) + 's'
    : 'pending_startup',
  monitoredCities: MONITORED_CITIES,
});

/**
 * triggerManualRun — Allow admin to manually trigger a scheduler cycle
 */
const triggerManualRun = async () => {
  if (isRunning) throw new Error('Scheduler is already running. Please wait.');
  await runSchedulerCycle();
  return getSchedulerStatus();
};

module.exports = { startScheduler, getSchedulerStatus, triggerManualRun };
