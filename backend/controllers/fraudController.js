// controllers/fraudController.js — Fraud analysis API endpoints
'use strict';

const { getDb } = require('../config/database');
const { detectFraud } = require('../services/fraudDetection');

/**
 * POST /api/fraud/check
 * On-demand fraud check for a claim or hypothetical scenario
 */
const checkFraud = (req, res) => {
  try {
    const db   = getDb();
    const user = req.user;
    const { trigger_type, location, payout_amount, policy_id } = req.body;

    if (!trigger_type) return res.status(400).json({ error: 'trigger_type is required' });

    const policy = policy_id
      ? db.prepare('SELECT * FROM policies WHERE id = ? AND user_id = ?').get(policy_id, user.id)
      : db.prepare("SELECT * FROM policies WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(user.id);

    if (!policy) return res.status(404).json({ error: 'No active policy found' });

    const claim  = { trigger_type, location: location || user.city, payout_amount: parseFloat(payout_amount) || 500 };
    const result = detectFraud(claim, user, policy, { breached: true });

    res.json({
      ...result,
      policy: { id: policy.id, number: policy.policy_number, city: policy.city, zone: policy.zone },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/fraud/logs — Recent fraud-flagged claims
 */
const getFraudLogs = (req, res) => {
  try {
    const db    = getDb();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const minScore = parseFloat(req.query.min_score) || 0.4;

    const rows = db.prepare(`
      SELECT c.id, c.claim_number, c.fraud_score, c.fraud_flags, c.trigger_type,
             c.status, c.payout_amount, c.created_at, c.auto_triggered,
             u.name, u.phone, u.platform, u.city as user_city,
             p.city, p.zone, p.policy_number
      FROM claims c
      JOIN users u ON u.id = c.user_id
      JOIN policies p ON p.id = c.policy_id
      WHERE c.fraud_score >= ?
      ORDER BY c.fraud_score DESC, c.created_at DESC
      LIMIT ?
    `).all(minScore, limit).map(r => ({
      ...r,
      fraud_flags: (() => { try { return JSON.parse(r.fraud_flags); } catch { return []; } })(),
      riskLevel:   r.fraud_score >= 0.7 ? 'HIGH' : 'MEDIUM',
    }));

    res.json({ logs: rows, count: rows.length, minScoreFilter: minScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/fraud/stats — Aggregate fraud analytics
 */
const getFraudStats = (req, res) => {
  try {
    const db = getDb();

    const overall = db.prepare(`
      SELECT
        COUNT(*) as total_claims,
        SUM(CASE WHEN fraud_score >= 0.7 THEN 1 ELSE 0 END) as high_risk,
        SUM(CASE WHEN fraud_score >= 0.4 AND fraud_score < 0.7 THEN 1 ELSE 0 END) as medium_risk,
        SUM(CASE WHEN fraud_score < 0.4 THEN 1 ELSE 0 END) as low_risk,
        ROUND(AVG(fraud_score), 4) as avg_fraud_score,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN payout_amount ELSE 0 END), 0) as payout_blocked
      FROM claims
    `).get();

    // Signal frequency analysis
    const allFlagRows = db.prepare("SELECT fraud_flags FROM claims WHERE fraud_flags != '[]' AND fraud_flags IS NOT NULL").all();
    const signalCounts = {};
    for (const row of allFlagRows) {
      try {
        const flags = JSON.parse(row.fraud_flags);
        for (const f of flags) {
          signalCounts[f.type] = (signalCounts[f.type] || 0) + 1;
        }
      } catch {}
    }
    const topSignals = Object.entries(signalCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([type, count]) => ({ type, count, label: type.replace(/_/g, ' ') }));

    // Platform fraud rates
    const platformFraud = db.prepare(`
      SELECT u.platform,
             COUNT(c.id) as total,
             SUM(CASE WHEN c.fraud_score >= 0.4 THEN 1 ELSE 0 END) as flagged,
             ROUND(AVG(c.fraud_score), 3) as avg_score
      FROM claims c JOIN users u ON u.id = c.user_id
      GROUP BY u.platform ORDER BY avg_score DESC
    `).all().map(p => ({
      ...p,
      fraudRate: p.total > 0 ? +((p.flagged / p.total) * 100).toFixed(1) : 0,
    }));

    res.json({ overall, topSignals, platformFraud });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { checkFraud, getFraudLogs, getFraudStats };
