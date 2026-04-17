// controllers/adminController.js — Admin Insights API
// GET /api/admin/insights — predictions, high-risk zones, fraud trends, loss ratio
'use strict';

const { getDb } = require('../config/database');
const { getSchedulerStatus, triggerManualRun } = require('../services/scheduler');
const { computeRiskScore } = require('../services/aiEngine');
const { WORKER_PERSONAS } = require('../services/aiPricing');

/**
 * GET /api/admin/insights
 * Predictive analytics: next-week risk, high-risk zones, fraud trends, business metrics
 */
const getInsights = (req, res) => {
  try {
    const db = getDb();

    // ── Business KPIs ─────────────────────────────────────────────────────────
    const totalRevenue = db.prepare(`
      SELECT COALESCE(SUM(weekly_premium * MAX(1, ROUND((julianday(MIN(end_date, datetime('now'))) - julianday(start_date)) / 7))), 0) as rev
      FROM policies
    `).get().rev || 0;

    const totalPayouts = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM payouts WHERE status IN ('processed','success')`).get().s;
    const savedByBlock = db.prepare(`SELECT COALESCE(SUM(payout_amount), 0) as s FROM claims WHERE status = 'rejected'`).get().s;
    const lossRatio    = totalRevenue > 0 ? +(totalPayouts / totalRevenue).toFixed(4) : 0;
    const profitMargin = totalRevenue > 0 ? +((totalRevenue - totalPayouts) / totalRevenue * 100).toFixed(1) : 0;

    const claimStats = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status IN ('paid','approved') THEN 1 ELSE 0 END) as approved,
             SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
             SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN auto_triggered = 1  THEN 1 ELSE 0 END) as auto_triggered
      FROM claims
    `).get();

    // ── Predictive Claims — next week forecast ────────────────────────────────
    // Based on historical claim rate per city × seasonal demand index
    const DEMAND_INDEX = [0.82, 0.78, 0.90, 1.00, 1.05, 0.88, 1.30, 1.40, 1.10, 1.00, 1.20, 1.35];
    const nextMonth    = (new Date().getMonth() + 1) % 12;
    const nextDemand   = DEMAND_INDEX[nextMonth];
    const currDemand   = DEMAND_INDEX[new Date().getMonth()];

    const cityClaimRates = db.prepare(`
      SELECT p.city,
             COUNT(c.id) as claim_count,
             COUNT(DISTINCT p.user_id) as workers,
             ROUND(AVG(p.risk_score), 3) as avg_risk
      FROM policies p
      LEFT JOIN claims c ON c.policy_id = p.id AND c.created_at >= date('now', '-30 days')
      GROUP BY p.city
    `).all();

    const predictedClaims = cityClaimRates.map(row => {
      const weeklyRate  = (row.claim_count / 4.3); // ~4.3 weeks in a month
      const predicted   = Math.round(weeklyRate * (nextDemand / currDemand) * (1 + row.avg_risk * 0.3));
      const trend       = predicted > weeklyRate ? 'RISING' : predicted < weeklyRate * 0.95 ? 'FALLING' : 'STABLE';
      return {
        city:            row.city,
        currentWeekRate: +weeklyRate.toFixed(1),
        nextWeekForecast:predicted,
        trend,
        demandFactor:    +nextDemand.toFixed(2),
        avgRisk:         row.avg_risk,
        activeWorkers:   row.workers,
      };
    }).sort((a, b) => b.nextWeekForecast - a.nextWeekForecast);

    // ── High-risk zones ───────────────────────────────────────────────────────
    const highRiskZones = db.prepare(`
      SELECT p.city, p.zone,
             ROUND(AVG(p.risk_score), 3) as avg_risk,
             COUNT(DISTINCT p.user_id) as workers,
             COUNT(c.id) as claims_30d,
             COALESCE(SUM(c.payout_amount), 0) as payout_30d
      FROM policies p
      LEFT JOIN claims c ON c.policy_id = p.id AND c.created_at >= date('now', '-30 days')
      GROUP BY p.city, p.zone
      HAVING workers > 0
      ORDER BY avg_risk DESC, claims_30d DESC
      LIMIT 8
    `).all().map(r => ({
      ...r,
      riskLevel: r.avg_risk > 0.65 ? 'HIGH' : r.avg_risk > 0.35 ? 'MEDIUM' : 'LOW',
    }));

    // ── Fraud trends ──────────────────────────────────────────────────────────
    const fraudTrend = db.prepare(`
      SELECT date(created_at) as date,
             COUNT(*) as total,
             SUM(CASE WHEN fraud_score >= 0.7 THEN 1 ELSE 0 END) as high_risk,
             SUM(CASE WHEN fraud_score >= 0.4 AND fraud_score < 0.7 THEN 1 ELSE 0 END) as medium_risk,
             ROUND(AVG(fraud_score), 3) as avg_score
      FROM claims WHERE created_at >= date('now', '-14 days')
      GROUP BY date(created_at) ORDER BY date
    `).all();

    // Top fraud signal types
    const allFlagRows = db.prepare(`SELECT fraud_flags FROM claims WHERE fraud_flags != '[]' AND fraud_flags IS NOT NULL`).all();
    const flagCounts  = {};
    for (const row of allFlagRows) {
      try {
        const flags = JSON.parse(row.fraud_flags);
        for (const f of flags) { flagCounts[f.type] = (flagCounts[f.type] || 0) + 1; }
      } catch {}
    }
    const topFraudSignals = Object.entries(flagCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([type, count]) => ({ type, count, label: type.replace(/_/g, ' ') }));

    // ── Platform performance ──────────────────────────────────────────────────
    const platformPerf = db.prepare(`
      SELECT u.platform,
             COUNT(DISTINCT u.id) as workers,
             ROUND(AVG(u.risk_score), 3) as avg_risk,
             COUNT(c.id) as total_claims,
             COALESCE(SUM(c.payout_amount), 0) as total_payout,
             SUM(CASE WHEN c.fraud_score >= 0.4 THEN 1 ELSE 0 END) as fraud_flags
      FROM users u
      LEFT JOIN claims c ON c.user_id = u.id
      WHERE u.is_admin = 0
      GROUP BY u.platform ORDER BY workers DESC
    `).all().map(r => ({
      ...r,
      persona: WORKER_PERSONAS[r.platform]?.persona || 'Gig Delivery Partner',
      riskMult: WORKER_PERSONAS[r.platform]?.riskMultiplier || 1.0,
      fraudRate: r.total_claims > 0 ? +((r.fraud_flags / r.total_claims) * 100).toFixed(1) : 0,
    }));

    // ── Automation metrics ────────────────────────────────────────────────────
    const scheduler = getSchedulerStatus();

    // ── Top workers at risk (next week) ──────────────────────────────────────
    const atRiskWorkers = db.prepare(`
      SELECT u.id, u.name, u.phone, u.platform, u.city, u.zone,
             u.risk_score, u.avg_weekly_income,
             COUNT(c.id) as recent_claims
      FROM users u
      LEFT JOIN claims c ON c.user_id = u.id AND c.created_at >= date('now', '-7 days')
      WHERE u.is_admin = 0 AND u.risk_score > 0.55
      GROUP BY u.id
      ORDER BY u.risk_score DESC LIMIT 10
    `).all().map(w => ({
      ...w,
      nextWeekRiskScore: +(w.risk_score * (nextDemand / currDemand)).toFixed(3),
      persona: WORKER_PERSONAS[w.platform]?.persona || 'Gig Delivery Partner',
    }));

    res.json({
      businessKPIs: {
        totalRevenue:  +totalRevenue.toFixed(2),
        totalPayouts:  +totalPayouts.toFixed(2),
        netProfit:     +(totalRevenue - totalPayouts).toFixed(2),
        lossRatio,
        profitMargin,
        savedByFraudBlock: +savedByBlock.toFixed(2),
        automationRate: claimStats.total > 0
          ? +((claimStats.auto_triggered / claimStats.total) * 100).toFixed(1) : 0,
      },
      claimStats,
      predictedClaims,
      highRiskZones,
      fraudTrend,
      topFraudSignals,
      platformPerf,
      atRiskWorkers,
      scheduler,
      demandForecast: {
        currentMonth:   new Date().toLocaleString('en-IN', { month: 'long' }),
        nextMonth:      new Date(0, nextMonth).toLocaleString('en-IN', { month: 'long' }),
        currentDemand:  +currDemand.toFixed(2),
        nextDemand:     +nextDemand.toFixed(2),
        trend:          nextDemand > currDemand ? 'RISING' : nextDemand < currDemand ? 'FALLING' : 'STABLE',
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[AdminInsights] error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/scheduler/run — Manually trigger scheduler cycle
 */
const runSchedulerNow = async (req, res) => {
  try {
    const result = await triggerManualRun();
    res.json({ message: 'Scheduler cycle triggered manually.', status: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * GET /api/admin/scheduler/status
 */
const schedulerStatus = (req, res) => {
  res.json(getSchedulerStatus());
};

/**
 * GET /api/admin/logs — Combined trigger + claim + payout logs
 */
const getSystemLogs = (req, res) => {
  try {
    const db    = getDb();
    const limit = parseInt(req.query.limit) || 50;

    const triggerLogs = db.prepare(`
      SELECT 'trigger' as log_type, event_type as action, city, zone, severity,
             value, unit, created_at, breached
      FROM trigger_events ORDER BY created_at DESC LIMIT ?
    `).all(limit);

    const claimLogs = db.prepare(`
      SELECT 'claim' as log_type, c.claim_number as action,
             p.city, p.zone, c.status as severity,
             c.payout_amount as value, 'INR' as unit, c.created_at,
             c.auto_triggered as breached,
             c.fraud_score, c.trigger_type, u.phone, u.platform
      FROM claims c
      JOIN policies p ON p.id = c.policy_id
      JOIN users u ON u.id = c.user_id
      ORDER BY c.created_at DESC LIMIT ?
    `).all(limit);

    const payoutLogs = db.prepare(`
      SELECT 'payout' as log_type, txn_id as action,
             'N/A' as city, 'N/A' as zone, status as severity,
             amount as value, 'INR' as unit, created_at, 1 as breached
      FROM payouts ORDER BY created_at DESC LIMIT ?
    `).all(limit);

    const combined = [...triggerLogs, ...claimLogs, ...payoutLogs]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    res.json({ logs: combined, count: combined.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getInsights, runSchedulerNow, schedulerStatus, getSystemLogs };
