// controllers/claimsController.js — Claims management + auto-trigger processing
'use strict';

const { getDb } = require('../config/database');
const { detectFraud } = require('../services/fraudDetection');
const { processTriggerEvents, evaluateTriggers } = require('../services/triggerMonitor');
const { initiatePayout, generateUpiId } = require('../services/paymentService');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/claims/trigger-check
 * Manually run trigger evaluation → auto-creates claims with full pipeline
 */
const runTriggerCheck = async (req, res) => {
  try {
    const user = req.user;
    const city = req.body.city || user.city;
    const zone = req.body.zone || user.zone;

    const result = await processTriggerEvents(city, zone);

    res.json({
      message:         `Trigger scan complete for ${city} - ${zone}`,
      triggersDetected: result.triggered.length,
      triggers:         result.triggered,
      claimsCreated:    result.newClaims.length,
      claims:           result.newClaims,
      logs:             result.logs,
      conditions: {
        weather: result.weather,
        aqi:     result.aqi,
        curfew:  result.curfew,
        flood:   result.flood,
      },
    });
  } catch (err) {
    console.error('[Claims] runTriggerCheck error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/claims/environment
 * Get current environmental conditions for city/zone
 */
const getEnvironment = async (req, res) => {
  try {
    const user = req.user;
    const city = req.query.city || user.city;
    const zone = req.query.zone || user.zone;
    const data = await evaluateTriggers(city, zone);
    res.json({ city, zone, ...data, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/claims — All claims for current user
 */
const getClaims = (req, res) => {
  try {
    const db     = getDb();
    const claims = db.prepare(`
      SELECT c.*, p.policy_number, p.city, p.zone
      FROM claims c JOIN policies p ON p.id = c.policy_id
      WHERE c.user_id = ? ORDER BY c.created_at DESC
    `).all(req.user.id).map(parseClaim);
    res.json({ claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/claims/:id — Single claim with payout info
 */
const getClaim = (req, res) => {
  try {
    const db     = getDb();
    const claim  = db.prepare(`
      SELECT c.*, p.policy_number, p.city, p.zone, p.coverage_amount
      FROM claims c JOIN policies p ON p.id = c.policy_id
      WHERE c.id = ? AND c.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!claim) return res.status(404).json({ error: 'Claim not found.' });

    const payout = db.prepare('SELECT * FROM payouts WHERE claim_id = ?').get(claim.id);
    res.json({ claim: parseClaim(claim), payout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/claims/simulate-payout/:id
 * Simulate instant UPI payout for approved claim
 */
const simulatePayout = async (req, res) => {
  try {
    const db    = getDb();
    const claim = db.prepare(
      "SELECT * FROM claims WHERE id = ? AND user_id = ? AND status = 'approved'"
    ).get(req.params.id, req.user.id);

    if (!claim) return res.status(404).json({ error: 'Approved claim not found.' });

    const upiId    = req.body.upi_id || generateUpiId(req.user.phone);
    const payResult = await initiatePayout({
      amount:      claim.payout_amount,
      upiId,
      name:        req.user.name,
      purpose:     'insurance_claim',
      referenceId: claim.claim_number,
    });

    if (!payResult.success) {
      return res.status(502).json({ error: `Payment gateway error: ${payResult.error}` });
    }

    db.prepare(`
      INSERT INTO payouts (claim_id, user_id, amount, method, txn_id, status, upi_id, settled_at)
      VALUES (?, ?, ?, 'UPI', ?, 'success', ?, datetime('now'))
    `).run(claim.id, req.user.id, claim.payout_amount, payResult.txnId, upiId);

    db.prepare("UPDATE claims SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(claim.id);
    db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(claim.payout_amount, req.user.id);

    res.json({
      message:  '✅ Payout credited instantly!',
      txnId:    payResult.txnId,
      amount:   claim.payout_amount,
      upiId,
      status:   'success',
      coverageType: 'INCOME_LOSS_ONLY',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/claims/admin/all — Admin: all claims with stats
 */
const adminGetAllClaims = (req, res) => {
  try {
    const db  = getDb();
    const { status, limit = 50, offset = 0 } = req.query;
    const where  = status ? 'WHERE c.status = ?' : '';
    const params = status ? [status, parseInt(limit), parseInt(offset)] : [parseInt(limit), parseInt(offset)];

    const claims = db.prepare(`
      SELECT c.*, u.name, u.phone, u.platform, p.policy_number, p.city, p.zone
      FROM claims c
      JOIN users u ON u.id = c.user_id
      JOIN policies p ON p.id = c.policy_id
      ${where}
      ORDER BY c.created_at DESC LIMIT ? OFFSET ?
    `).all(...params).map(parseClaim);

    const stats = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status IN ('paid','approved') THEN 1 ELSE 0 END) as approved,
             SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
             SUM(CASE WHEN auto_triggered = 1  THEN 1 ELSE 0 END) as auto_triggered,
             COALESCE(SUM(CASE WHEN status IN ('paid','approved') THEN payout_amount ELSE 0 END), 0) as total_payout
      FROM claims
    `).get();

    res.json({ claims, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/claims/admin/:id/approve
 */
const adminApproveClaim = async (req, res) => {
  try {
    const db    = getDb();
    const claim = db.prepare("SELECT * FROM claims WHERE id = ? AND status = 'pending'").get(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Pending claim not found.' });

    const user  = db.prepare('SELECT * FROM users WHERE id = ?').get(claim.user_id);
    const upiId = generateUpiId(user.phone);

    const payResult = await initiatePayout({
      amount:      claim.payout_amount,
      upiId,
      name:        user.name,
      purpose:     'insurance_claim',
      referenceId: claim.claim_number,
    });

    if (payResult.success) {
      db.prepare(`
        INSERT INTO payouts (claim_id, user_id, amount, method, txn_id, status, upi_id, settled_at)
        VALUES (?, ?, ?, 'UPI', ?, 'success', ?, datetime('now'))
      `).run(claim.id, claim.user_id, claim.payout_amount, payResult.txnId, upiId);
      db.prepare("UPDATE claims SET status = 'paid', paid_at = datetime('now'), processed_at = datetime('now') WHERE id = ?").run(claim.id);
      db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(claim.payout_amount, claim.user_id);
      res.json({ message: 'Claim approved and payout processed.', txnId: payResult.txnId, amount: claim.payout_amount });
    } else {
      db.prepare("UPDATE claims SET status = 'approved', processed_at = datetime('now') WHERE id = ?").run(claim.id);
      res.json({ message: 'Claim approved. Payment queued (gateway issue).', paymentError: payResult.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/claims/admin/:id/reject
 */
const adminRejectClaim = (req, res) => {
  try {
    const db    = getDb();
    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found.' });
    db.prepare("UPDATE claims SET status = 'rejected', processed_at = datetime('now') WHERE id = ?").run(claim.id);
    res.json({ message: 'Claim rejected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseClaim = c => ({
  ...c,
  trigger_value: (() => { try { return JSON.parse(c.trigger_value); } catch { return {}; } })(),
  fraud_flags:   (() => { try { return JSON.parse(c.fraud_flags);   } catch { return []; } })(),
});

module.exports = {
  runTriggerCheck, getEnvironment, getClaims, getClaim,
  simulatePayout, adminGetAllClaims, adminApproveClaim, adminRejectClaim,
};
