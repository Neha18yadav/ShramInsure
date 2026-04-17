// controllers/analyticsController.js — Business metrics, admin insights, predictions
'use strict';

const { getDb } = require('../config/database');
const { getSchedulerStatus } = require('../services/scheduler');
const { computeRiskScore } = require('../services/aiEngine');

/**
 * GET /api/analytics/dashboard — Full admin analytics snapshot
 */
const getDashboard = (req, res) => {
  try {
    const db = getDb();

    // ── Core counts ──────────────────────────────────────────────────────────
    const totalUsers      = db.prepare("SELECT COUNT(*) as n FROM users WHERE is_admin = 0").get().n;
    const activePolicies  = db.prepare("SELECT COUNT(*) as n FROM policies WHERE status = 'active'").get().n;
    const pendingClaims   = db.prepare("SELECT COUNT(*) as n FROM claims WHERE status = 'pending'").get().n;
    const fraudAlerts     = db.prepare("SELECT COUNT(*) as n FROM claims WHERE fraud_score >= 0.4").get().n;

    // ── Financial metrics ─────────────────────────────────────────────────────
    const totalPayouts    = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM payouts WHERE status IN ('processed','success')").get().s;
    const totalRejected   = db.prepare("SELECT COALESCE(SUM(payout_amount),0) as s FROM claims WHERE status = 'rejected'").get().s;

    // Revenue = sum of all weekly premiums × weeks active
    const revenueRow = db.prepare(`
      SELECT COALESCE(SUM(weekly_premium * MAX(1, ROUND((julianday(MIN(end_date, datetime('now'))) - julianday(start_date)) / 7))), 0) as rev
      FROM policies
    `).get();
    const totalRevenue = revenueRow.rev || 0;

    // Loss ratio = total payouts / total revenue (0–1)
    const lossRatio = totalRevenue > 0 ? +(totalPayouts / totalRevenue).toFixed(4) : 0;
    const profitMargin = totalRevenue > 0 ? +((totalRevenue - totalPayouts) / totalRevenue * 100).toFixed(1) : 0;

    // ── Claims breakdown ──────────────────────────────────────────────────────
    const claimsStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid'     THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN auto_triggered = 1  THEN 1 ELSE 0 END) as auto_triggered,
        COALESCE(SUM(payout_amount), 0) as total_payout_amt
      FROM claims
    `).get();

    // ── Claims by trigger type ────────────────────────────────────────────────
    const claimsByType = db.prepare(`
      SELECT trigger_type, COUNT(*) as count,
             COALESCE(SUM(payout_amount), 0) as total_payout,
             ROUND(AVG(fraud_score), 3) as avg_fraud_score
      FROM claims GROUP BY trigger_type ORDER BY count DESC
    `).all();

    // ── 7-day claims trend ────────────────────────────────────────────────────
    const claimsTrend = db.prepare(`
      SELECT date(created_at) as date,
             COUNT(*) as claims,
             COALESCE(SUM(payout_amount), 0) as payout,
             COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) as rejected
      FROM claims WHERE created_at >= date('now', '-7 days')
      GROUP BY date(created_at) ORDER BY date
    `).all();

    // ── High-risk zones ───────────────────────────────────────────────────────
    const highRiskZones = db.prepare(`
      SELECT p.city, p.zone,
             ROUND(AVG(p.risk_score), 3) as avg_risk,
             COUNT(DISTINCT p.user_id) as workers,
             COUNT(c.id) as total_claims,
             COALESCE(SUM(c.payout_amount), 0) as total_payout
      FROM policies p
      LEFT JOIN claims c ON c.policy_id = p.id
      GROUP BY p.city, p.zone
      ORDER BY avg_risk DESC
      LIMIT 10
    `).all();

    // ── Revenue vs payouts (last 30 days) ─────────────────────────────────────
    // Revenue = sum of weekly_premium from policies (policies table has weekly_premium)
    // Payout status is 'processed' (from paymentService)
    const revenueVsPayouts = db.prepare(`
      SELECT date(p.created_at) as date,
             COALESCE(SUM(p.weekly_premium), 0) as daily_revenue,
             COALESCE((SELECT SUM(pay.amount) FROM payouts pay
                       WHERE date(pay.created_at) = date(p.created_at)
                       AND pay.status IN ('processed','success')), 0) as daily_payout
      FROM policies p
      WHERE p.created_at >= date('now', '-30 days')
      GROUP BY date(p.created_at)
      ORDER BY date
    `).all();


    // ── Fraud trends ──────────────────────────────────────────────────────────
    const fraudTrend = db.prepare(`
      SELECT date(created_at) as date,
             COUNT(*) as total_claims,
             SUM(CASE WHEN fraud_score >= 0.7 THEN 1 ELSE 0 END) as high_fraud,
             SUM(CASE WHEN fraud_score >= 0.4 AND fraud_score < 0.7 THEN 1 ELSE 0 END) as medium_fraud,
             ROUND(AVG(fraud_score), 3) as avg_fraud_score
      FROM claims WHERE created_at >= date('now', '-14 days')
      GROUP BY date(created_at) ORDER BY date
    `).all();

    // ── Recent fraud alerts ───────────────────────────────────────────────────
    const recentFraud = db.prepare(`
      SELECT c.claim_number, c.fraud_score, c.fraud_flags, c.trigger_type, c.status,
             c.payout_amount, c.created_at, u.name, u.phone, u.platform, p.city, p.zone
      FROM claims c
      JOIN users u ON u.id = c.user_id
      JOIN policies p ON p.id = c.policy_id
      WHERE c.fraud_score >= 0.4
      ORDER BY c.fraud_score DESC, c.created_at DESC LIMIT 10
    `).all().map(r => ({
      ...r,
      fraud_flags: (() => { try { return JSON.parse(r.fraud_flags); } catch { return []; } })(),
      riskLevel:   r.fraud_score >= 0.7 ? 'HIGH' : 'MEDIUM',
    }));

    // ── Platform distribution ─────────────────────────────────────────────────
    const platformDist = db.prepare(`
      SELECT u.platform, COUNT(DISTINCT u.id) as workers,
             COUNT(c.id) as claims,
             COALESCE(SUM(c.payout_amount), 0) as total_payout,
             ROUND(AVG(u.risk_score), 3) as avg_risk
      FROM users u
      LEFT JOIN claims c ON c.user_id = u.id
      WHERE u.is_admin = 0
      GROUP BY u.platform ORDER BY workers DESC
    `).all();

    res.json({
      summary: {
        totalUsers, activePolicies, totalPayouts, totalRevenue, pendingClaims, fraudAlerts,
        lossRatio, profitMargin,
        revenueVsPayouts: { revenue: +totalRevenue.toFixed(2), payouts: +totalPayouts.toFixed(2), net: +(totalRevenue - totalPayouts).toFixed(2) },
        savedByFraudBlock: +totalRejected.toFixed(2),
      },
      claimsStats,
      claimsByType,
      claimsTrend,
      highRiskZones,
      revenueVsPayouts,
      fraudTrend,
      recentFraud,
      platformDist,
      scheduler: getSchedulerStatus(),
    });
  } catch (err) {
    console.error('[Analytics] getDashboard error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/analytics/worker — Worker-level dashboard
 */
const getWorkerDashboard = (req, res) => {
  try {
    const db   = getDb();
    const user = req.user;

    const activePolicy = db.prepare(`
      SELECT * FROM policies
      WHERE user_id = ? AND status = 'active' AND end_date >= datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id);

    const claimsStats = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'paid'     THEN 1 ELSE 0 END) as paid,
             SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM claims WHERE user_id = ?
    `).get(user.id);

    const totalPayout = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as s FROM payouts WHERE user_id = ? AND status IN ('processed','success')
    `).get(user.id).s;

    const recentClaims = db.prepare(`
      SELECT c.*, p.policy_number FROM claims c
      JOIN policies p ON p.id = c.policy_id
      WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 5
    `).all(user.id).map(c => ({
      ...c,
      trigger_value: (() => { try { return JSON.parse(c.trigger_value); } catch { return {}; } })(),
      fraud_flags:   (() => { try { return JSON.parse(c.fraud_flags);   } catch { return []; } })(),
    }));

    const earningsProtected = activePolicy ? activePolicy.coverage_amount * 4 : 0;

    // Weekly premium trend
    const premiumHistory = db.prepare(`
      SELECT date(created_at) as date, final_premium as premium, city, zone
      FROM premium_logs WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 8
    `).all(user.id).reverse();

    res.json({
      user: {
        name: user.name, phone: user.phone, platform: user.platform,
        city: user.city, zone: user.zone, riskScore: user.risk_score,
        walletBalance: user.wallet_balance,
        premiumPaidMonths: user.premium_paid_months,
        accidentalCoverActive: user.accidental_cover_active === 1,
      },
      activePolicy,
      stats: { ...claimsStats, totalPayout, earningsProtected },
      recentClaims,
      premiumHistory,
      coverageType: 'INCOME_LOSS_ONLY',
    });
  } catch (err) {
    console.error('[Analytics] getWorkerDashboard error:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getDashboard, getWorkerDashboard };
