// controllers/policyController.js — Policy management (INCOME LOSS ONLY, weekly pricing)
'use strict';

const { getDb } = require('../config/database');
const { calculatePremium, getPersonaProfile } = require('../services/aiPricing');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/policies/quote
 */
const getQuote = (req, res) => {
  try {
    const db   = getDb();
    const user = req.user;
    const { city, zone, platform, avg_weekly_income, work_hours_per_day, months_on_platform } = req.body;

    const historicalClaims = db.prepare('SELECT COUNT(*) as cnt FROM claims WHERE user_id = ?').get(user.id).cnt;

    const quote = calculatePremium({
      city:            city     || user.city,
      zone:            zone     || user.zone,
      platform:        platform || user.platform,
      avgWeeklyIncome: parseFloat(avg_weekly_income  || user.avg_weekly_income),
      historicalClaims,
      workHoursPerDay: parseFloat(work_hours_per_day || 8),
      monthsOnPlatform: parseInt(months_on_platform  || 6),
    });

    const persona = getPersonaProfile(platform || user.platform);

    // Log premium calculation
    db.prepare(`
      INSERT INTO premium_logs (user_id, base_premium, final_premium, city, zone,
        weather_factor, pollution_factor, zone_factor, history_factor, platform_factor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      quote.breakdown.cityBase,
      quote.weeklyPremium,
      city || user.city,
      zone || user.zone,
      1 + (quote.breakdown.riskLoad || 0) / 100,
      1 + (quote.breakdown.demandLoad || 0) / 100,
      1 + (quote.breakdown.zoneSurcharge || 0) / 100,
      1 + (parseFloat(quote.breakdown.historyPenalty) || 0) / 100,
      quote.platformRiskMult || 1.0
    );

    res.json({ quote, persona, coverageType: 'INCOME_LOSS_ONLY' });
  } catch (err) {
    console.error('[Policy] getQuote error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/policies
 */
const createPolicy = (req, res) => {
  try {
    const db   = getDb();
    const user = req.user;
    const { city, zone, weeks = 4 } = req.body;

    const activePolicy = db.prepare(
      "SELECT id FROM policies WHERE user_id = ? AND status = 'active' AND end_date >= datetime('now')"
    ).get(user.id);

    if (activePolicy) {
      return res.status(409).json({ error: 'You already have an active policy. Cancel it first or wait for expiry.' });
    }

    const historicalClaims = db.prepare('SELECT COUNT(*) as cnt FROM claims WHERE user_id = ?').get(user.id).cnt;

    const priceData = calculatePremium({
      city:            city || user.city,
      zone:            zone || user.zone,
      platform:        user.platform,
      avgWeeklyIncome: user.avg_weekly_income,
      historicalClaims,
    });

    const startDate    = new Date().toISOString();
    const endDate      = new Date(Date.now() + parseInt(weeks) * 7 * 24 * 60 * 60 * 1000).toISOString();
    const policyNumber = `POL-${uuidv4().substring(0, 8).toUpperCase()}`;

    const result = db.prepare(`
      INSERT INTO policies (user_id, policy_number, status, coverage_amount, weekly_premium,
        start_date, end_date, risk_score, zone, city)
      VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id, policyNumber,
      priceData.coverageAmount, priceData.weeklyPremium,
      startDate, endDate, priceData.riskScore,
      zone || user.zone, city || user.city
    );

    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(result.lastID);

    res.status(201).json({
      message:       'Policy created successfully!',
      policy,
      coverageType:  'INCOME_LOSS_ONLY',
      persona:       priceData.persona,
      priceBreakdown: priceData.breakdown,
      nextWeekPrediction: priceData.nextWeekPrediction,
    });
  } catch (err) {
    console.error('[Policy] createPolicy error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/policies
 */
const getPolicies = (req, res) => {
  try {
    const db = getDb();
    let policies;
    if (req.user.is_admin === 1) {
      policies = db.prepare(`
        SELECT p.*, u.name as user_name, u.platform 
        FROM policies p 
        JOIN users u ON u.id = p.user_id 
        ORDER BY p.created_at DESC
      `).all();
    } else {
      policies = db.prepare('SELECT * FROM policies WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    }
    res.json({ policies, coverageType: 'INCOME_LOSS_ONLY' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/policies/:id
 */
const getPolicy = (req, res) => {
  try {
    const db     = getDb();
    const policy = db.prepare('SELECT * FROM policies WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found.' });
    const claims = db.prepare('SELECT * FROM claims WHERE policy_id = ? ORDER BY created_at DESC').all(policy.id)
      .map(c => ({ ...c, fraud_flags: (() => { try { return JSON.parse(c.fraud_flags); } catch { return []; } })() }));
    res.json({ policy, claims, coverageType: 'INCOME_LOSS_ONLY' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/policies/:id/cancel
 */
const cancelPolicy = (req, res) => {
  try {
    const db     = getDb();
    const policy = db.prepare("SELECT * FROM policies WHERE id = ? AND user_id = ? AND status = 'active'").get(req.params.id, req.user.id);
    if (!policy) return res.status(404).json({ error: 'Active policy not found.' });
    db.prepare("UPDATE policies SET status = 'cancelled' WHERE id = ?").run(policy.id);
    res.json({ message: 'Policy cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getQuote, createPolicy, getPolicies, getPolicy, cancelPolicy };
