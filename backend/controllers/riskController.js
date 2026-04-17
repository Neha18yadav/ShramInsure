// controllers/riskController.js — AI Risk Engine (single Gig Delivery Worker persona)
'use strict';

const { getDb } = require('../config/database');
const { computeRiskScore, generateRiskExplanation } = require('../services/aiEngine');
const { getPersonaProfile } = require('../services/aiPricing');

/**
 * POST /api/risk/calculate
 */
const calculateRisk = (req, res) => {
  try {
    const db   = getDb();
    const user = req.user;
    const {
      city, zone, platform, avg_weekly_income, work_hours_per_day, months_on_platform,
    } = req.body;

    const targetCity = city || user.city || 'Mumbai';
    const targetZone = zone || user.zone || 'Central';
    const income     = parseFloat(avg_weekly_income || user.avg_weekly_income || 3500);
    const workHours  = parseFloat(work_hours_per_day || 8);
    const months     = parseInt(months_on_platform || 6);

    const historicalClaims = db.prepare(
      "SELECT COUNT(*) as n FROM claims WHERE user_id = ? AND status IN ('paid','approved')"
    ).get(user.id)?.n || 0;

    const result = computeRiskScore({
      city:            targetCity,
      zone:            targetZone,
      platform:        platform || user.platform || 'Zepto',
      avgWeeklyIncome: income,
      historicalClaims,
      workHoursPerDay: workHours,
      monthsOnPlatform: months,
    });

    const explanation = generateRiskExplanation(result);

    // Persist updated risk score
    db.prepare('UPDATE users SET risk_score = ? WHERE id = ?').run(result.riskScore, user.id);

    res.json({
      riskScore:         result.riskScore,
      riskLevel:         result.riskLevel,
      fraudProbability:  result.fraudProbability,
      claimConfidence:   result.claimConfidence,
      weeklyPremium:     result.weeklyPremium,
      coverageAmount:    result.coverageAmount,
      coverageType:      'INCOME_LOSS_ONLY',
      persona:           getPersonaProfile().persona,
      nextWeekPrediction: result.nextWeekPrediction,
      featureBreakdown:  result.featureBreakdown,
      weights:           result.weights,
      explanation,
      inputs: { city: targetCity, zone: targetZone, income, historicalClaims, workHours, months },
      modelVersion: result.modelVersion,
      computedAt:   result.computedAt,
    });
  } catch (err) {
    console.error('[Risk] calculateRisk error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/risk/history
 */
const getRiskHistory = (req, res) => {
  try {
    const db  = getDb();
    const logs = db.prepare(`
      SELECT date(created_at) as date,
             AVG(final_premium) as avg_premium,
             city, zone
      FROM premium_logs WHERE user_id = ?
      GROUP BY date(created_at) ORDER BY date DESC LIMIT 30
    `).all(req.user.id);
    res.json({ history: logs.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { calculateRisk, getRiskHistory };
