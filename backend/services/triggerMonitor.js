// services/triggerMonitor.js — Production-grade parametric trigger engine
// Fetches weather + AQI (real API with fallback), evaluates all thresholds, auto-creates claims

'use strict';

const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { detectFraud } = require('./fraudDetection');
const { initiatePayout, generateUpiId } = require('./paymentService');

// ── Mock data pools (fallback when real APIs are unavailable) ─────────────────

const MOCK_WEATHER = {
  Mumbai:    { temp: 38, rainfall: 85,  windSpeed: 62, humidity: 88, condition: 'Heavy Rain' },
  Delhi:     { temp: 44, rainfall: 0,   windSpeed: 15, humidity: 22, condition: 'Extreme Heat' },
  Bangalore: { temp: 32, rainfall: 45,  windSpeed: 30, humidity: 70, condition: 'Moderate Rain' },
  Chennai:   { temp: 40, rainfall: 70,  windSpeed: 55, humidity: 82, condition: 'Cyclone Warning' },
  Hyderabad: { temp: 42, rainfall: 20,  windSpeed: 25, humidity: 48, condition: 'Hot & Dusty' },
  Pune:      { temp: 36, rainfall: 30,  windSpeed: 22, humidity: 60, condition: 'Partly Cloudy' },
  Kolkata:   { temp: 37, rainfall: 55,  windSpeed: 38, humidity: 78, condition: 'Pre-Monsoon' },
};

const MOCK_AQI = {
  Mumbai: 165, Delhi: 312, Bangalore: 98, Chennai: 145, Hyderabad: 190, Pune: 128, Kolkata: 210,
};

const MOCK_CURFEW = {
  Mumbai:    { active: false, zones: [] },
  Delhi:     { active: true,  zones: ['East', 'North'], reason: 'Political unrest' },
  Bangalore: { active: false, zones: [] },
  Chennai:   { active: false, zones: [] },
  Hyderabad: { active: false, zones: [] },
  Pune:      { active: false, zones: [] },
  Kolkata:   { active: false, zones: [] },
};

const MOCK_FLOOD = {
  Mumbai:    { floodZones: ['Kurla', 'Andheri East', 'Sion'], severity: 'high',   waterLevel: 1.2 },
  Chennai:   { floodZones: ['Tambaram', 'Velachery'],         severity: 'medium', waterLevel: 0.7 },
  Hyderabad: { floodZones: [],                                severity: 'none',   waterLevel: 0 },
  Delhi:     { floodZones: [],                                severity: 'none',   waterLevel: 0.1 },
  Bangalore: { floodZones: [],                                severity: 'none',   waterLevel: 0.2 },
  Pune:      { floodZones: [],                                severity: 'none',   waterLevel: 0 },
  Kolkata:   { floodZones: ['Howrah'],                        severity: 'low',    waterLevel: 0.4 },
};

// ── Parametric thresholds ─────────────────────────────────────────────────────
const THRESHOLDS = {
  RAINFALL:    { value: 65,   unit: 'mm/hr',   label: 'Heavy Rain' },
  TEMPERATURE: { value: 42,   unit: '°C',      label: 'Extreme Heat' },
  AQI:         { value: 200,  unit: 'AQI',     label: 'Severe Pollution' },
  WIND_SPEED:  { value: 50,   unit: 'km/h',    label: 'Storm Warning' },
  CURFEW:      { value: 1,    unit: 'boolean', label: 'Civil Curfew' },
  FLOOD_LEVEL: { value: 0.5,  unit: 'meters',  label: 'Flood Alert' },
};

// ── Real API fetchers with fallback ──────────────────────────────────────────

/**
 * fetchWeather — Tries real OpenWeatherMap API, falls back to mock + variance
 */
const fetchWeather = async (city) => {
  // Real API attempt
  if (process.env.OPENWEATHER_API_KEY) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},IN&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;
      const http = require('https');
      const data = await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('JSON parse failed')); }
          });
        }).on('error', reject).setTimeout(4000, function() { this.destroy(); reject(new Error('timeout')); });
      });
      if (data.cod === 200) {
        return {
          temp:      +data.main.temp.toFixed(1),
          rainfall:  +(data.rain?.['1h'] || 0).toFixed(1),
          windSpeed: +(data.wind.speed * 3.6).toFixed(1), // m/s → km/h
          humidity:  data.main.humidity,
          condition: data.weather?.[0]?.description || 'Unknown',
          source:    'openweathermap',
        };
      }
    } catch (err) {
      console.warn(`[TriggerMonitor] OpenWeatherMap failed for ${city}: ${err.message} — using mock`);
    }
  }

  // Fallback mock with realistic variance
  const base = MOCK_WEATHER[city] || { temp: 30, rainfall: 10, windSpeed: 20, humidity: 60, condition: 'Clear' };
  return {
    ...base,
    rainfall:  +(base.rainfall  + (Math.random() * 24 - 12)).toFixed(1),
    temp:      +(base.temp      + (Math.random() * 4  - 2)).toFixed(1),
    windSpeed: +(base.windSpeed + (Math.random() * 12 - 6)).toFixed(1),
    humidity:  +(base.humidity  + (Math.random() * 10 - 5)).toFixed(0),
    source:    'mock_fallback',
  };
};

/**
 * fetchAQI — Tries CPCB/IQAir API, falls back to mock + variance
 */
const fetchAQI = async (city) => {
  if (process.env.IQAIR_API_KEY) {
    try {
      const url = `https://api.airvisual.com/v2/city?city=${encodeURIComponent(city)}&state=Maharashtra&country=India&key=${process.env.IQAIR_API_KEY}`;
      const http = require('https');
      const data = await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('JSON parse failed')); }
          });
        }).on('error', reject).setTimeout(4000, function() { this.destroy(); reject(new Error('timeout')); });
      });
      if (data.status === 'success') {
        return { aqi: data.data.current.pollution.aqius, source: 'iqair' };
      }
    } catch (err) {
      console.warn(`[TriggerMonitor] IQAir failed for ${city}: ${err.message} — using mock`);
    }
  }

  const base = MOCK_AQI[city] || 120;
  return { aqi: +(base + (Math.random() * 50 - 25)).toFixed(0), source: 'mock_fallback' };
};

const fetchCurfew = (city, zone) => {
  const data = MOCK_CURFEW[city] || { active: false, zones: [] };
  return {
    active: data.active && (data.zones.length === 0 || data.zones.includes(zone)),
    reason: data.reason || null,
    zones:  data.zones,
    source: 'mock_fallback',
  };
};

const fetchFlood = (city) => {
  return { ...(MOCK_FLOOD[city] || { floodZones: [], severity: 'none', waterLevel: 0 }), source: 'mock_fallback' };
};

// ── Trigger evaluator ─────────────────────────────────────────────────────────

/**
 * evaluateTriggers — Evaluate all 6 parametric triggers for a given city/zone
 * @returns {Promise<{triggered: object[], weather: object, aqi: object, curfew: object, flood: object}>}
 */
const evaluateTriggers = async (city, zone) => {
  const [weather, aqiData, curfew, flood] = await Promise.all([
    fetchWeather(city),
    fetchAQI(city),
    Promise.resolve(fetchCurfew(city, zone)),
    Promise.resolve(fetchFlood(city)),
  ]);

  const aqi = aqiData.aqi;
  const triggered = [];

  // Trigger 1: Heavy Rain
  if (weather.rainfall > THRESHOLDS.RAINFALL.value) {
    triggered.push({
      type: 'WEATHER_RAIN', label: 'Heavy Rain Alert',
      value: weather.rainfall, threshold: THRESHOLDS.RAINFALL.value, unit: THRESHOLDS.RAINFALL.unit,
      severity: weather.rainfall > 110 ? 'critical' : 'high', breached: true, data: weather,
    });
  }

  // Trigger 2: Extreme Heat
  if (weather.temp > THRESHOLDS.TEMPERATURE.value) {
    triggered.push({
      type: 'WEATHER_HEAT', label: 'Extreme Heat Warning',
      value: weather.temp, threshold: THRESHOLDS.TEMPERATURE.value, unit: THRESHOLDS.TEMPERATURE.unit,
      severity: weather.temp > 46 ? 'critical' : 'high', breached: true, data: weather,
    });
  }

  // Trigger 3: Air Quality Emergency
  if (aqi > THRESHOLDS.AQI.value) {
    triggered.push({
      type: 'POLLUTION_AQI', label: 'Air Quality Emergency',
      value: aqi, threshold: THRESHOLDS.AQI.value, unit: THRESHOLDS.AQI.unit,
      severity: aqi > 300 ? 'critical' : 'high', breached: true, data: { aqi, source: aqiData.source },
    });
  }

  // Trigger 4: Storm / High Wind
  if (weather.windSpeed > THRESHOLDS.WIND_SPEED.value) {
    triggered.push({
      type: 'WEATHER_STORM', label: 'Storm Warning',
      value: weather.windSpeed, threshold: THRESHOLDS.WIND_SPEED.value, unit: THRESHOLDS.WIND_SPEED.unit,
      severity: weather.windSpeed > 80 ? 'critical' : 'high', breached: true, data: weather,
    });
  }

  // Trigger 5: Civil Curfew
  if (curfew.active) {
    triggered.push({
      type: 'CIVIL_CURFEW', label: 'Zone Closure / Curfew',
      value: 1, threshold: 0, unit: 'boolean',
      severity: 'critical', breached: true, data: curfew,
    });
  }

  // Trigger 6: Flood Alert
  if (flood.waterLevel > THRESHOLDS.FLOOD_LEVEL.value) {
    triggered.push({
      type: 'FLOOD_ALERT', label: 'Flood Zone Alert',
      value: flood.waterLevel, threshold: THRESHOLDS.FLOOD_LEVEL.value, unit: 'meters',
      severity: flood.waterLevel > 1 ? 'critical' : 'high', breached: true, data: flood,
    });
  }

  return { triggered, weather, aqi: aqiData, curfew, flood };
};

// ── Full auto-claim pipeline ──────────────────────────────────────────────────

/**
 * processTriggerEvents — For each triggered event:
 *   1. Log to trigger_events
 *   2. Find affected active policyholders
 *   3. Run fraud detection
 *   4. Auto-approve/reject/review
 *   5. Process payout if approved
 */
const processTriggerEvents = async (city, zone) => {
  const db = getDb();
  const { triggered, weather, aqi, curfew, flood } = await evaluateTriggers(city, zone);
  const newClaims = [];
  const logs = [];

  if (triggered.length === 0) {
    logs.push({ step: 'evaluate', status: 'ok', message: `No triggers breached for ${city} - ${zone}` });
    return { triggered, newClaims, logs, weather, aqi, curfew, flood };
  }

  logs.push({ step: 'evaluate', status: 'ok', message: `${triggered.length} trigger(s) breached for ${city} - ${zone}` });

  for (const event of triggered) {
    // Step 1: Log trigger event
    let triggerLogId;
    try {
      const triggerResult = db.prepare(`
        INSERT INTO trigger_events (event_type, city, zone, severity, value, unit, threshold, breached, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(event.type, city, zone || 'All', event.severity, event.value, event.unit, event.threshold, JSON.stringify(event.data));
      triggerLogId = triggerResult.lastID;
      logs.push({ step: 'log_trigger', triggerType: event.type, id: triggerLogId, status: 'ok' });
    } catch (err) {
      logs.push({ step: 'log_trigger', triggerType: event.type, status: 'error', error: err.message });
      continue;
    }

    // Step 2: Find affected active policyholders
    const affectedPolicies = db.prepare(`
      SELECT p.*, u.id as uid, u.avg_weekly_income, u.phone, u.name, u.wallet_balance
      FROM policies p
      JOIN users u ON u.id = p.user_id
      WHERE p.status = 'active' AND p.city = ?
        AND (p.zone = ? OR ? IS NULL OR ? = 'All')
        AND p.end_date >= datetime('now')
    `).all(city, zone || 'All', zone || 'All', zone || 'All');

    logs.push({ step: 'find_policies', triggerType: event.type, count: affectedPolicies.length, status: 'ok' });

    for (const policy of affectedPolicies) {
      // Deduplicate: skip if claim already exists for this trigger today
      const existing = db.prepare(`
        SELECT id FROM claims WHERE policy_id = ? AND trigger_type = ? AND created_at >= date('now')
      `).get(policy.id, event.type);

      if (existing) {
        logs.push({ step: 'dedup', policyId: policy.id, triggerType: event.type, status: 'skipped', reason: 'already_claimed_today' });
        continue;
      }

      // Step 3: Calculate payout
      const weeklyIncome = parseFloat(policy.avg_weekly_income) || 3500;
      const dailyIncome = weeklyIncome / 7;
      const severityMult = event.severity === 'critical' ? 0.90 : event.severity === 'high' ? 0.70 : 0.50;
      const payoutAmount = +Math.max(dailyIncome * severityMult, 150).toFixed(2);

      // Step 4: Fraud detection
      const claimData = { trigger_type: event.type, location: city, payout_amount: payoutAmount };
      const fraud = detectFraud(claimData, { id: policy.user_id }, policy, event);

      logs.push({
        step: 'fraud_check', policyId: policy.id, triggerType: event.type,
        fraudScore: fraud.fraudScore, decision: fraud.decision, status: 'ok',
      });

      // Step 5: Auto-approve / reject / review
      const claimNumber = `CLM-${Date.now()}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
      const claimStatus = fraud.decision === 'REJECT' ? 'rejected'
                        : fraud.decision === 'APPROVE' ? 'approved'
                        : 'pending';

      let insertedId;
      try {
        const inserted = db.prepare(`
          INSERT INTO claims (claim_number, policy_id, user_id, trigger_type, trigger_value, status,
            payout_amount, fraud_score, fraud_flags, auto_triggered, location, processed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
        `).run(
          claimNumber, policy.id, policy.user_id, event.type,
          JSON.stringify(event.data), claimStatus, payoutAmount,
          fraud.fraudScore, JSON.stringify(fraud.flags), city
        );
        insertedId = inserted.lastID;
        logs.push({ step: 'create_claim', claimNumber, status: claimStatus, payout: payoutAmount });
      } catch (err) {
        logs.push({ step: 'create_claim', policyId: policy.id, status: 'error', error: err.message });
        continue;
      }

      // Step 6: Process payout if approved
      if (claimStatus === 'approved') {
        try {
          const upiId = generateUpiId(policy.phone);
          const payResult = await initiatePayout({
            amount:      payoutAmount,
            upiId,
            name:        policy.name,
            purpose:     'insurance_claim',
            referenceId: claimNumber,
          });

          if (payResult.success) {
            db.prepare(`
              INSERT INTO payouts (claim_id, user_id, amount, method, txn_id, status, upi_id, settled_at)
              VALUES (?, ?, ?, 'UPI', ?, 'success', ?, datetime('now'))
            `).run(insertedId, policy.user_id, payoutAmount, payResult.txnId, upiId);

            db.prepare(`UPDATE claims SET status = 'paid', paid_at = datetime('now') WHERE id = ?`).run(insertedId);
            db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`).run(payoutAmount, policy.user_id);

            logs.push({ step: 'payout', claimNumber, txnId: payResult.txnId, amount: payoutAmount, status: 'success' });
            newClaims.push({ claimNumber, policyId: policy.id, status: 'paid', payoutAmount, txnId: payResult.txnId });
          } else {
            // Payout failed — revert to pending
            db.prepare(`UPDATE claims SET status = 'pending' WHERE id = ?`).run(insertedId);
            logs.push({ step: 'payout', claimNumber, status: 'failed', error: payResult.error });
            newClaims.push({ claimNumber, policyId: policy.id, status: 'pending', payoutAmount, paymentError: payResult.error });
          }
        } catch (err) {
          db.prepare(`UPDATE claims SET status = 'pending' WHERE id = ?`).run(insertedId);
          logs.push({ step: 'payout', claimNumber, status: 'error', error: err.message });
          newClaims.push({ claimNumber, policyId: policy.id, status: 'pending', payoutAmount, paymentError: err.message });
        }
      } else {
        newClaims.push({ claimNumber, policyId: policy.id, status: claimStatus, payoutAmount });
      }
    }
  }

  return { triggered, newClaims, logs, weather, aqi, curfew, flood };
};

module.exports = { evaluateTriggers, processTriggerEvents, fetchWeather, fetchAQI, THRESHOLDS, MOCK_WEATHER, MOCK_AQI };
