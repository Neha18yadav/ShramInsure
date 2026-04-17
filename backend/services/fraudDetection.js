// services/fraudDetection.js — Production fraud detection engine
// Returns fraud_probability using GPS mismatch, duplicates, time anomaly, weather mismatch

'use strict';

const { getDb } = require('../config/database');

/**
 * detectFraud — Comprehensive multi-signal fraud detection
 * Decision: > 0.7 → REJECT | 0.4–0.7 → REVIEW | < 0.4 → APPROVE
 *
 * @param {object} claim         — { trigger_type, location, payout_amount }
 * @param {object} user          — { id, ... }
 * @param {object} policy        — { id, city, zone, start_date, end_date }
 * @param {object} triggerEvent  — { breached, ... }
 * @returns {object} fraud result
 */
const detectFraud = (claim, user, policy, triggerEvent) => {
  const db = getDb();
  const flags = [];
  let fraudScore = 0;

  // ── Signal 1: Duplicate claim in same 24h window (GPS/trigger mismatch) ───
  const recentDuplicate = db.prepare(`
    SELECT COUNT(*) as cnt FROM claims
    WHERE user_id = ? AND trigger_type = ? AND created_at >= datetime('now', '-1 day')
  `).get(user.id, claim.trigger_type);

  if (recentDuplicate.cnt > 0) {
    flags.push({ type: 'DUPLICATE_CLAIM_24H', severity: 'HIGH', detail: `${recentDuplicate.cnt} identical trigger claim(s) within 24 hours`, weight: 0.45 });
    fraudScore += 0.45;
  }

  // ── Signal 2: Location/GPS mismatch — claim city ≠ policy city ────────────
  if (claim.location && policy.city) {
    const claimCity  = String(claim.location).toLowerCase().trim();
    const policyCity = String(policy.city).toLowerCase().trim();
    if (!claimCity.includes(policyCity) && !policyCity.includes(claimCity)) {
      flags.push({ type: 'GPS_LOCATION_MISMATCH', severity: 'HIGH', detail: `Claim location "${claim.location}" doesn't match policy city "${policy.city}"`, weight: 0.40 });
      fraudScore += 0.40;
    }
  }

  // ── Signal 3: Policy coverage period anomaly ──────────────────────────────
  const now         = new Date();
  const policyStart = new Date(policy.start_date);
  const policyEnd   = new Date(policy.end_date);

  if (now < policyStart || now > policyEnd) {
    flags.push({ type: 'OUT_OF_COVERAGE_PERIOD', severity: 'CRITICAL', detail: 'Claim submitted outside active policy coverage window', weight: 0.60 });
    fraudScore += 0.60;
  }

  // ── Signal 4: Time anomaly — claim within 24h of policy creation ──────────
  const daysSincePolicy = (now - policyStart) / (1000 * 60 * 60 * 24);
  if (daysSincePolicy < 1) {
    flags.push({ type: 'EARLY_CLAIM_ANOMALY', severity: 'MEDIUM', detail: `Claim filed only ${(daysSincePolicy * 24).toFixed(1)} hours after policy activation`, weight: 0.22 });
    fraudScore += 0.22;
  }

  // ── Signal 5: Weather mismatch — trigger not breached ────────────────────
  if (triggerEvent && triggerEvent.breached === false) {
    flags.push({ type: 'WEATHER_THRESHOLD_NOT_MET', severity: 'CRITICAL', detail: 'Parametric threshold was NOT breached — claim trigger invalid', weight: 0.55 });
    fraudScore += 0.55;
  }

  // ── Signal 6: High claim frequency anomaly ────────────────────────────────
  const monthlyCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM claims
    WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
  `).get(user.id);

  if (monthlyCount.cnt >= 4) {
    const freqPenalty = Math.min(0.08 * (monthlyCount.cnt - 3), 0.28);
    flags.push({ type: 'HIGH_CLAIM_FREQUENCY', severity: 'MEDIUM', detail: `${monthlyCount.cnt} claims in last 30 days (threshold: 4)`, weight: freqPenalty });
    fraudScore += freqPenalty;
  }

  // ── Signal 7: Payout anomaly — claim amount far above user average ────────
  const avgPayout = db.prepare(`
    SELECT AVG(payout_amount) as avg, COUNT(*) as cnt FROM claims
    WHERE user_id = ? AND status IN ('paid', 'approved')
  `).get(user.id);

  if (avgPayout.cnt >= 2 && claim.payout_amount > avgPayout.avg * 2.8) {
    flags.push({ type: 'PAYOUT_AMOUNT_ANOMALY', severity: 'MEDIUM', detail: `Claim ₹${claim.payout_amount} is ${(claim.payout_amount / avgPayout.avg).toFixed(1)}x above historical average`, weight: 0.18 });
    fraudScore += 0.18;
  }

  // ── Cap and calculate final decision ──────────────────────────────────────
  fraudScore = Math.min(fraudScore, 1.0);
  const decision = fraudScore >= 0.70 ? 'REJECT' : fraudScore >= 0.40 ? 'REVIEW' : 'APPROVE';

  return {
    fraudScore:    +fraudScore.toFixed(3),
    fraudLevel:    fraudScore >= 0.70 ? 'HIGH' : fraudScore >= 0.40 ? 'MEDIUM' : 'LOW',
    fraudProbability: +fraudScore.toFixed(3),
    flags,
    decision,
    autoApprove:   decision === 'APPROVE',
    reason:
      decision === 'APPROVE' ? 'All fraud signals clear — auto-approved for payout'
      : decision === 'REVIEW' ? `${flags.length} moderate signal(s) — manual review required`
      : `High fraud probability (${(fraudScore * 100).toFixed(0)}%) — auto-rejected`,
    signalCount: flags.length,
    checkedAt:   new Date().toISOString(),
  };
};

module.exports = { detectFraud };
