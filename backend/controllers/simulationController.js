// controllers/simulationController.js — One-click Demo Simulation Engine
// Trigger fake rain/AQI/flood/heat/curfew events → claim → fraud → payout
// Full automation flow visible step by step

'use strict';

const { getDb } = require('../config/database');
const { detectFraud } = require('../services/fraudDetection');
const { initiatePayout, generateUpiId } = require('../services/paymentService');
const { v4: uuidv4 } = require('uuid');

/**
 * runSimulation — Core simulation function
 * Injects a disruption event and processes the full zero-touch claim pipeline
 */
const runSimulation = async (req, res, event) => {
  const db   = getDb();
  const user = req.user;
  const city = req.body.city || user.city || 'Mumbai';
  const zone = req.body.zone || user.zone || 'Central';
  const steps = [];

  const addStep = (step, label, detail, icon, status, extra = {}) => {
    steps.push({ step, label, detail, icon, status, timestamp: new Date().toISOString(), ...extra });
  };

  try {
    // ── Step 1: Disruption Detected ─────────────────────────────────────────
    addStep(1, 'Disruption Detected', `${event.label} detected in ${city} - ${zone}. Value: ${event.value} ${event.unit} (threshold: ${event.threshold} ${event.unit})`, event.icon, 'done');

    // ── Step 2: Log Trigger Event ────────────────────────────────────────────
    let triggerLogId;
    try {
      const tr = db.prepare(`
        INSERT INTO trigger_events (event_type, city, zone, severity, value, unit, threshold, breached, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(event.type, city, zone, event.severity, event.value, event.unit, event.threshold, JSON.stringify({ ...event.data, source: 'ShramInsure Demo Engine' }));
      triggerLogId = tr.lastID;
      addStep(2, 'Trigger Logged to Ledger', `Event #${triggerLogId} stored — type: ${event.type}, severity: ${event.severity.toUpperCase()}`, '📝', 'done', { triggerEventId: triggerLogId });
    } catch (err) {
      addStep(2, 'Trigger Log Failed', err.message, '❌', 'error');
      return res.status(500).json({ success: false, error: 'Trigger logging failed', steps });
    }

    // ── Step 3: Find Active Policy ────────────────────────────────────────────
    const policy = db.prepare(`
      SELECT p.*, u.avg_weekly_income, u.phone, u.name
      FROM policies p JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ? AND p.status = 'active' AND p.end_date >= datetime('now')
      ORDER BY p.created_at DESC LIMIT 1
    `).get(user.id);

    if (!policy) {
      addStep(3, 'No Active Policy Found', 'You need an active policy to receive parametric payouts. Create a policy first.', '🚫', 'blocked');
      return res.status(400).json({ success: false, error: 'No active policy. Create a policy first.', steps });
    }

    addStep(3, 'Active Policy Verified', `Policy ${policy.policy_number} — Coverage: ₹${policy.coverage_amount}/week | Status: ACTIVE`, '✅', 'done', {
      policy: { number: policy.policy_number, coverage: policy.coverage_amount, premium: policy.weekly_premium },
    });

    // ── Step 4: Calculate Income Loss (income-loss ONLY) ─────────────────────
    const weeklyIncome    = parseFloat(policy.avg_weekly_income) || 3500;
    const dailyIncome     = weeklyIncome / 7;
    const severityMult    = event.severity === 'critical' ? 0.90 : event.severity === 'high' ? 0.70 : 0.50;
    const rawPayout       = dailyIncome * severityMult;
    const payoutAmount    = +Math.max(rawPayout, 100).toFixed(2);
    const incomeImpactPct = (severityMult * 100).toFixed(0);

    addStep(4, 'Income Loss Calculated', `Daily income: ₹${dailyIncome.toFixed(0)} × ${incomeImpactPct}% disruption severity = ₹${payoutAmount.toFixed(0)} loss. Coverage type: INCOME LOSS ONLY.`, '💰', 'done', {
      calculation: { dailyIncome: +dailyIncome.toFixed(2), severityMultiplier: severityMult, payoutAmount },
    });

    // ── Step 5: AI Fraud Detection ────────────────────────────────────────────
    const claimData = { trigger_type: event.type, location: city, payout_amount: payoutAmount };
    const fraud     = detectFraud(claimData, user, policy, { ...event, breached: true });

    const fraudLabel =
      fraud.decision === 'APPROVE' ? `✅ PASSED — Score: ${(fraud.fraudScore * 100).toFixed(0)}/100 (${fraud.flags.length} signal(s) checked)` :
      fraud.decision === 'REVIEW'  ? `⚠️ REVIEW — Score: ${(fraud.fraudScore * 100).toFixed(0)}/100 (${fraud.flags.length} flag(s) detected)` :
                                     `🚨 FLAGGED — Score: ${(fraud.fraudScore * 100).toFixed(0)}/100 HIGH FRAUD RISK`;

    addStep(5, 'AI Fraud Analysis Complete', fraudLabel, '🔍', fraud.decision === 'REJECT' ? 'blocked' : 'done', { fraud });

    // ── Step 6: Create Claim Record ───────────────────────────────────────────
    const claimStatus  = fraud.decision === 'REJECT' ? 'rejected' : fraud.decision === 'APPROVE' ? 'approved' : 'pending';
    const claimNumber  = `SIM-${Date.now()}-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;

    const claimResult = db.prepare(`
      INSERT INTO claims (claim_number, policy_id, user_id, trigger_type, trigger_value, status,
        payout_amount, fraud_score, fraud_flags, auto_triggered, location, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
    `).run(
      claimNumber, policy.id, user.id, event.type,
      JSON.stringify(event.data), claimStatus, payoutAmount,
      fraud.fraudScore, JSON.stringify(fraud.flags), city
    );

    addStep(6, 'Claim Auto-Filed', `Claim ${claimNumber} created — Status: ${claimStatus.toUpperCase()} | Payout: ₹${payoutAmount.toFixed(0)}`, '📋', 'done', {
      claim: { number: claimNumber, status: claimStatus, amount: payoutAmount, id: claimResult.lastID },
    });

    // ── Step 7: Process Payout (if approved) ─────────────────────────────────
    let payoutResult = null;

    if (claimStatus === 'approved') {
      try {
        const upiId    = generateUpiId(user.phone);
        const payResult = await initiatePayout({
          amount:      payoutAmount,
          upiId,
          name:        user.name,
          purpose:     'insurance_claim',
          referenceId: claimNumber,
        });

        if (payResult.success) {
          db.prepare(`
            INSERT INTO payouts (claim_id, user_id, amount, method, txn_id, status, upi_id, settled_at)
            VALUES (?, ?, ?, 'UPI', ?, 'success', ?, datetime('now'))
          `).run(claimResult.lastID, user.id, payoutAmount, payResult.txnId, upiId);

          db.prepare(`UPDATE claims SET status = 'paid', paid_at = datetime('now') WHERE id = ?`).run(claimResult.lastID);
          db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`).run(payoutAmount, user.id);

          payoutResult = { txnId: payResult.txnId, amount: payoutAmount, upiId, method: 'UPI', status: 'success', rzpPayoutId: payResult.rzpPayoutId };

          addStep(7, '💸 Payout Credited Instantly!', `₹${payoutAmount.toFixed(0)} sent via UPI to ${upiId} | TXN: ${payResult.txnId} | Zero manual intervention.`, '🎉', 'paid', { payout: payoutResult });
        } else {
          db.prepare(`UPDATE claims SET status = 'pending' WHERE id = ?`).run(claimResult.lastID);
          addStep(7, 'Payout Gateway Failed — Queued', `Payment failed: ${payResult.error}. Claim queued for retry.`, '⏳', 'pending', { paymentError: payResult.error });
        }
      } catch (err) {
        db.prepare(`UPDATE claims SET status = 'pending' WHERE id = ?`).run(claimResult.lastID);
        addStep(7, 'Payout Exception — Queued', `Error: ${err.message}. Claim queued for retry.`, '⏳', 'pending');
      }
    } else if (claimStatus === 'rejected') {
      addStep(7, 'Payout Blocked — High Fraud Risk', `Fraud score: ${(fraud.fraudScore * 100).toFixed(0)}/100. Claim flagged for manual investigation. No payout issued.`, '🚫', 'blocked');
    } else {
      addStep(7, 'Claim Queued for Manual Review', `Moderate fraud signals. A human reviewer will assess within 24 hours.`, '⏳', 'pending');
    }

    const finalStatus = steps[steps.length - 1].status;
    const newWallet   = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(user.id)?.wallet_balance || 0;

    return res.json({
      success:        true,
      simulationType: event.type,
      triggerLabel:   event.label,
      city, zone,
      steps,
      claim:   { claimNumber, status: payoutResult ? 'paid' : claimStatus, payoutAmount, policyNumber: policy.policy_number, id: claimResult.lastID },
      payout:  payoutResult,
      fraud,
      walletBalance: newWallet,
      automationFlow: {
        totalSteps:     steps.length,
        completedSteps: steps.filter(s => s.status === 'done' || s.status === 'paid').length,
        durationMs:     Date.now() - new Date(steps[0].timestamp).getTime(),
      },
      summary:
        payoutResult        ? `✅ Full automation complete! ₹${payoutAmount.toFixed(0)} auto-credited in ${steps.length} steps — zero human intervention.`
        : claimStatus === 'rejected' ? `🚨 Automation complete. Fraud detected — payout blocked. Claim flagged.`
        : `⏳ Automation complete. Claim queued for manual review.`,
    });
  } catch (err) {
    console.error('[SimulationController] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message, steps });
  }
};

// ── Individual simulation handlers ────────────────────────────────────────────

const simulateRain = (req, res) => runSimulation(req, res, {
  type: 'WEATHER_RAIN', label: 'Simulated Heavy Rain', icon: '🌧️',
  severity: 'high', value: 87.5, unit: 'mm/hr', threshold: 65,
  data: { rainfall: 87.5, condition: 'Simulated Monsoon Surge', windSpeed: 45, humidity: 92 },
});

const simulatePollution = (req, res) => runSimulation(req, res, {
  type: 'POLLUTION_AQI', label: 'Simulated Air Quality Emergency', icon: '💨',
  severity: 'critical', value: 340, unit: 'AQI', threshold: 200,
  data: { aqi: 340, category: 'Hazardous', pm25: 210, pm10: 280 },
});

const simulateCurfew = (req, res) => runSimulation(req, res, {
  type: 'CIVIL_CURFEW', label: 'Simulated Zone Curfew', icon: '🚫',
  severity: 'critical', value: 1, unit: 'boolean', threshold: 0,
  data: { active: true, reason: 'Simulated civil restriction', affectedZones: ['East', 'North'] },
});

const simulateFlood = (req, res) => runSimulation(req, res, {
  type: 'FLOOD_ALERT', label: 'Simulated Flood Alert', icon: '🌊',
  severity: 'critical', value: 1.4, unit: 'meters', threshold: 0.5,
  data: { waterLevel: 1.4, severity: 'high', affectedAreas: ['Low-lying zones', 'Underpasses'] },
});

const simulateHeat = (req, res) => runSimulation(req, res, {
  type: 'WEATHER_HEAT', label: 'Simulated Extreme Heat', icon: '🌡️',
  severity: 'high', value: 46.2, unit: '°C', threshold: 42,
  data: { temp: 46.2, condition: 'Extreme Heat Wave', humidity: 18, heatIndex: 52 },
});

/**
 * POST /api/simulate/weather-trigger
 * Generic weather simulation — caller specifies type + value
 */
const simulateWeatherTrigger = async (req, res) => {
  const { triggerType, value, city, zone } = req.body;

  const TRIGGER_MAP = {
    rain:       { type: 'WEATHER_RAIN',    label: 'Rain Event',         icon: '🌧️',  unit: 'mm/hr',   threshold: 65,  severityAt: 100 },
    heat:       { type: 'WEATHER_HEAT',    label: 'Extreme Heat',       icon: '🌡️',  unit: '°C',      threshold: 42,  severityAt: 46  },
    aqi:        { type: 'POLLUTION_AQI',   label: 'AQI Emergency',      icon: '💨',  unit: 'AQI',     threshold: 200, severityAt: 300 },
    storm:      { type: 'WEATHER_STORM',   label: 'Storm Warning',      icon: '⛈️',  unit: 'km/h',    threshold: 50,  severityAt: 80  },
    flood:      { type: 'FLOOD_ALERT',     label: 'Flood Alert',        icon: '🌊',  unit: 'meters',  threshold: 0.5, severityAt: 1.0 },
    curfew:     { type: 'CIVIL_CURFEW',    label: 'Zone Curfew',        icon: '🚫',  unit: 'boolean', threshold: 0,   severityAt: 1   },
  };

  const trigger = TRIGGER_MAP[triggerType?.toLowerCase()];
  if (!trigger) {
    return res.status(400).json({ error: 'Invalid triggerType. Valid: rain, heat, aqi, storm, flood, curfew' });
  }

  const finalValue = value !== undefined ? parseFloat(value) : trigger.threshold * 1.4;
  const severity   = finalValue >= trigger.severityAt ? 'critical' : 'high';

  return runSimulation(req, res, {
    type:      trigger.type,
    label:     `Simulated ${trigger.label}`,
    icon:      trigger.icon,
    severity,
    value:     finalValue,
    unit:      trigger.unit,
    threshold: trigger.threshold,
    data:      { value: finalValue, unit: trigger.unit, triggerType, source: 'ShramInsure Demo Engine' },
  });
};

/**
 * POST /api/simulate/claim
 * Direct claim simulation without a specific weather event — for demo purposes
 */
const simulateClaim = async (req, res) => {
  const { claimType = 'WEATHER_RAIN', severity = 'high' } = req.body;
  const CLAIM_EVENTS = {
    WEATHER_RAIN:  { label: 'Demo Rain Claim',       icon: '🌧️',  value: 85,  unit: 'mm/hr',  threshold: 65  },
    POLLUTION_AQI: { label: 'Demo AQI Claim',        icon: '💨',  value: 320, unit: 'AQI',    threshold: 200 },
    WEATHER_HEAT:  { label: 'Demo Heat Claim',       icon: '🌡️',  value: 45,  unit: '°C',     threshold: 42  },
    FLOOD_ALERT:   { label: 'Demo Flood Claim',      icon: '🌊',  value: 1.2, unit: 'meters', threshold: 0.5 },
    CIVIL_CURFEW:  { label: 'Demo Curfew Claim',     icon: '🚫',  value: 1,   unit: 'boolean',threshold: 0   },
    WEATHER_STORM: { label: 'Demo Storm Claim',      icon: '⛈️',  value: 72,  unit: 'km/h',   threshold: 50  },
  };
  const ev = CLAIM_EVENTS[claimType] || CLAIM_EVENTS.WEATHER_RAIN;
  return runSimulation(req, res, { type: claimType, severity, ...ev, data: { value: ev.value, unit: ev.unit, source: 'ShramInsure Demo Engine' } });
};

/**
 * GET /api/simulate/history
 */
const getSimulations = (req, res) => {
  const db = getDb();
  const events = db.prepare(`
    SELECT te.*, c.claim_number, c.status as claim_status, c.payout_amount
    FROM trigger_events te
    LEFT JOIN claims c ON c.trigger_type = te.event_type AND c.auto_triggered = 1
    WHERE te.raw_data LIKE '%Demo Engine%'
    ORDER BY te.created_at DESC LIMIT 30
  `).all().map(e => ({ ...e, raw_data: (() => { try { return JSON.parse(e.raw_data); } catch { return {}; } })() }));

  res.json({ simulations: events, count: events.length });
};

module.exports = {
  simulateRain, simulatePollution, simulateCurfew, simulateFlood, simulateHeat,
  simulateWeatherTrigger, simulateClaim, getSimulations,
};
