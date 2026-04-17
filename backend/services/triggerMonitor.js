// services/triggerMonitor.js — Production parametric trigger engine
// Real API: OpenWeatherMap + WAQI. Fallback to mock. Never crashes.
'use strict';

const { getDb }                      = require('../config/database');
const { v4: uuidv4 }                 = require('uuid');
const { detectFraud }                = require('./fraudDetection');
const { initiatePayout, generateUpiId } = require('./paymentService');
const { createNotification }          = require('./notificationService');

// ── Platforms allowed (Q-Commerce only) ──────────────────────────────────────
const QCOMMERCE_PLATFORMS = ['Zepto', 'Blinkit', 'Instamart', 'Dunzo'];

// ── Extended India city mock data ─────────────────────────────────────────────
const MOCK_WEATHER = {
  Mumbai:    { temp: 38, rainfall: 85,  windSpeed: 62, humidity: 88, condition: 'Heavy Rain' },
  Delhi:     { temp: 44, rainfall: 0,   windSpeed: 15, humidity: 22, condition: 'Extreme Heat' },
  Bangalore: { temp: 32, rainfall: 45,  windSpeed: 30, humidity: 70, condition: 'Moderate Rain' },
  Chennai:   { temp: 40, rainfall: 70,  windSpeed: 55, humidity: 82, condition: 'Cyclone Warning' },
  Hyderabad: { temp: 42, rainfall: 20,  windSpeed: 25, humidity: 48, condition: 'Hot & Dusty' },
  Pune:      { temp: 36, rainfall: 30,  windSpeed: 22, humidity: 60, condition: 'Partly Cloudy' },
  Kolkata:   { temp: 37, rainfall: 55,  windSpeed: 38, humidity: 78, condition: 'Pre-Monsoon' },
  Ahmedabad: { temp: 43, rainfall: 5,   windSpeed: 18, humidity: 25, condition: 'Hot & Dry' },
  Jaipur:    { temp: 46, rainfall: 0,   windSpeed: 12, humidity: 15, condition: 'Extreme Heat' },
  Surat:     { temp: 39, rainfall: 40,  windSpeed: 35, humidity: 72, condition: 'Coastal Humidity' },
  Lucknow:   { temp: 44, rainfall: 8,   windSpeed: 14, humidity: 30, condition: 'Heat Wave' },
  Nagpur:    { temp: 45, rainfall: 0,   windSpeed: 10, humidity: 18, condition: 'Extreme Heat' },
  Indore:    { temp: 41, rainfall: 15,  windSpeed: 20, humidity: 35, condition: 'Hot' },
  Bhopal:    { temp: 42, rainfall: 10,  windSpeed: 16, humidity: 32, condition: 'Hot' },
  Patna:     { temp: 43, rainfall: 20,  windSpeed: 18, humidity: 40, condition: 'Humid' },
  Vadodara:  { temp: 40, rainfall: 35,  windSpeed: 30, humidity: 65, condition: 'Cloudy' },
  Gurgaon:   { temp: 43, rainfall: 2,   windSpeed: 12, humidity: 28, condition: 'Hazy' },
  Noida:     { temp: 43, rainfall: 2,   windSpeed: 14, humidity: 30, condition: 'Hazy' },
  Chandigarh:{ temp: 40, rainfall: 5,   windSpeed: 20, humidity: 35, condition: 'Hot' },
  Kochi:     { temp: 33, rainfall: 90,  windSpeed: 45, humidity: 92, condition: 'Monsoon Heavy' },
  Visakhapatnam: { temp: 38, rainfall: 50, windSpeed: 40, humidity: 80, condition: 'Coastal Rain' },
};

const MOCK_AQI = {
  Mumbai: 165, Delhi: 312, Bangalore: 98, Chennai: 145,
  Hyderabad: 190, Pune: 128, Kolkata: 210, Ahmedabad: 220,
  Jaipur: 175, Surat: 145, Lucknow: 280, Nagpur: 160,
  Indore: 140, Bhopal: 155, Patna: 295, Vadodara: 150,
  Gurgaon: 285, Noida: 290, Chandigarh: 130, Kochi: 88,
  Visakhapatnam: 120,
};

// ── Parametric thresholds ─────────────────────────────────────────────────────
const THRESHOLDS = {
  RAINFALL:    { value: 65,  unit: 'mm/hr',  label: 'Heavy Rain'       },
  TEMPERATURE: { value: 42,  unit: '°C',     label: 'Extreme Heat'     },
  AQI:         { value: 200, unit: 'AQI',    label: 'Severe Pollution' },
  WIND_SPEED:  { value: 50,  unit: 'km/h',   label: 'Storm Warning'    },
  FLOOD_LEVEL: { value: 0.5, unit: 'meters', label: 'Flood Alert'      },
};

// ── HTTP helper (native https, no extra deps) ────────────────────────────────
const httpsGet = (url, timeoutMs = 5000) => new Promise((resolve, reject) => {
  const https = require('https');
  const req = https.get(url, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('JSON parse error')); }
    });
  });
  req.on('error', reject);
  req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
});

// ── Weather fetcher (OpenWeatherMap → mock fallback) ─────────────────────────
// ── Weather fetcher (OpenWeatherMap → Open-Meteo → mock fallback) ───────────
const fetchWeather = async (city) => {
  // 1. Try OpenWeatherMap (requires valid key)
  if (process.env.OPENWEATHER_API_KEY) {
    try {
      const url  = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},IN&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;
      const data = await httpsGet(url);
      if (data.cod === 200 || data.cod === '200') {
        return {
          temp:      +data.main.temp.toFixed(1),
          rainfall:  +(data.rain?.['1h'] || 0).toFixed(1),
          windSpeed: +(data.wind.speed * 3.6).toFixed(1),
          humidity:  data.main.humidity,
          condition: data.weather?.[0]?.description || 'unknown',
          source:    'openweathermap',
        };
      }
    } catch (e) {
      console.warn(`[Weather] OpenWeatherMap failed for ${city}: ${e.message}`);
    }
  }

  // 2. Try Open-Meteo (Keyless fallback)
  const coords = CITY_COORDS.find(c => c.city === city);
  if (coords) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto`;
      const data = await httpsGet(url);
      if (data.current) {
        return {
          temp:      +data.current.temperature_2m.toFixed(1),
          rainfall:  +data.current.precipitation.toFixed(1),
          windSpeed: +data.current.wind_speed_10m.toFixed(1),
          humidity:  +data.current.relative_humidity_2m,
          condition: 'live (open-meteo)',
          source:    'openmeteo',
        };
      }
    } catch (e) {
      console.warn(`[Weather] Open-Meteo failed for ${city}: ${e.message}`);
    }
  }

  // 3. Final Fallback (Simulated)
  const base = MOCK_WEATHER[city] || { temp: 33, rainfall: 20, windSpeed: 18, humidity: 60, condition: 'Partly Cloudy' };
  return {
    ...base,
    rainfall:  +(base.rainfall  + (Math.random() * 20 - 10)).toFixed(1),
    temp:      +(base.temp      + (Math.random() * 3  - 1.5)).toFixed(1),
    windSpeed: +(base.windSpeed + (Math.random() * 10 - 5)).toFixed(1),
    humidity:  +(base.humidity  + (Math.random() * 8  - 4)).toFixed(0),
    source:    'mock_fallback',
  };
};

// ── AQI fetcher (WAQI → mock fallback) ───────────────────────────────────────
const fetchAQI = async (city) => {
  if (process.env.WAQI_API_KEY) {
    try {
      const url  = `https://api.waqi.info/feed/${encodeURIComponent(city)}/?token=${process.env.WAQI_API_KEY}`;
      const data = await httpsGet(url);
      if (data.status === 'ok' && data.data?.aqi) {
        return { aqi: parseInt(data.data.aqi), source: 'waqi', city: data.data.city?.name };
      }
    } catch (e) {
      console.warn(`[AQI] WAQI failed for ${city}: ${e.message}`);
    }
  }
  const base = MOCK_AQI[city] || 130;
  return { aqi: Math.max(20, Math.round(base + (Math.random() * 40 - 20))), source: 'mock_fallback' };
};

// ── Reverse geocoding (OpenCage → haversine fallback) ────────────────────────
const CITY_COORDS = [
  { city: 'Mumbai',    lat: 19.08, lng: 72.88, state: 'Maharashtra' },
  { city: 'Delhi',     lat: 28.70, lng: 77.10, state: 'Delhi' },
  { city: 'Bangalore', lat: 12.97, lng: 77.59, state: 'Karnataka' },
  { city: 'Chennai',   lat: 13.08, lng: 80.27, state: 'Tamil Nadu' },
  { city: 'Hyderabad', lat: 17.39, lng: 78.49, state: 'Telangana' },
  { city: 'Pune',      lat: 18.52, lng: 73.86, state: 'Maharashtra' },
  { city: 'Kolkata',   lat: 22.57, lng: 88.36, state: 'West Bengal' },
  { city: 'Ahmedabad', lat: 23.02, lng: 72.57, state: 'Gujarat' },
  { city: 'Jaipur',    lat: 26.91, lng: 75.79, state: 'Rajasthan' },
  { city: 'Surat',     lat: 21.17, lng: 72.83, state: 'Gujarat' },
  { city: 'Lucknow',   lat: 26.84, lng: 80.94, state: 'Uttar Pradesh' },
  { city: 'Nagpur',    lat: 21.14, lng: 79.08, state: 'Maharashtra' },
  { city: 'Indore',    lat: 22.71, lng: 75.86, state: 'Madhya Pradesh' },
  { city: 'Bhopal',    lat: 23.25, lng: 77.41, state: 'Madhya Pradesh' },
  { city: 'Patna',     lat: 25.59, lng: 85.13, state: 'Bihar' },
  { city: 'Vadodara',  lat: 22.30, lng: 73.19, state: 'Gujarat' },
  { city: 'Gurgaon',   lat: 28.45, lng: 77.03, state: 'Haryana' },
  { city: 'Noida',     lat: 28.53, lng: 77.39, state: 'Uttar Pradesh' },
  { city: 'Chandigarh',lat: 30.73, lng: 76.78, state: 'Chandigarh' },
  { city: 'Kochi',     lat: 9.93,  lng: 76.27, state: 'Kerala' },
  { city: 'Visakhapatnam', lat: 17.69, lng: 83.22, state: 'Andhra Pradesh' },
];

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dG = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const reverseGeocode = async (lat, lng) => {
  if (process.env.GEO_API_KEY) {
    try {
      const url  = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${process.env.GEO_API_KEY}&language=en&limit=1&countrycode=in`;
      const data = await httpsGet(url);
      if (data.results?.length > 0) {
        const comp = data.results[0].components;
        const city = comp.city || comp.town || comp.village || comp.state_district;
        const state = comp.state;
        return { city, state, source: 'opencage' };
      }
    } catch (e) {
      console.warn(`[Geo] OpenCage failed: ${e.message}`);
    }
  }
  // Haversine fallback — find nearest city
  let nearest = CITY_COORDS[0], minDist = Infinity;
  for (const c of CITY_COORDS) {
    const d = haversine(lat, lng, c.lat, c.lng);
    if (d < minDist) { minDist = d; nearest = c; }
  }
  return { city: nearest.city, state: nearest.state, source: 'haversine_fallback', distanceKm: Math.round(minDist) };
};

// ── Trigger evaluator ─────────────────────────────────────────────────────────
const evaluateTriggers = async (city, zone) => {
  const [weather, aqiData] = await Promise.all([fetchWeather(city), fetchAQI(city)]);
  const aqi = aqiData.aqi;
  const triggered = [];

  if (weather.rainfall > THRESHOLDS.RAINFALL.value)
    triggered.push({ type: 'WEATHER_RAIN', label: 'Heavy Rain Alert', value: weather.rainfall, threshold: THRESHOLDS.RAINFALL.value, unit: 'mm/hr', severity: weather.rainfall > 110 ? 'critical' : 'high', data: weather });

  if (weather.temp > THRESHOLDS.TEMPERATURE.value)
    triggered.push({ type: 'WEATHER_HEAT', label: 'Extreme Heat Warning', value: weather.temp, threshold: THRESHOLDS.TEMPERATURE.value, unit: '°C', severity: weather.temp > 46 ? 'critical' : 'high', data: weather });

  if (aqi > THRESHOLDS.AQI.value)
    triggered.push({ type: 'POLLUTION_AQI', label: 'Air Quality Emergency', value: aqi, threshold: THRESHOLDS.AQI.value, unit: 'AQI', severity: aqi > 300 ? 'critical' : 'high', data: { aqi, source: aqiData.source } });

  if (weather.windSpeed > THRESHOLDS.WIND_SPEED.value)
    triggered.push({ type: 'WEATHER_STORM', label: 'Storm Warning', value: weather.windSpeed, threshold: THRESHOLDS.WIND_SPEED.value, unit: 'km/h', severity: weather.windSpeed > 80 ? 'critical' : 'high', data: weather });

  return { triggered, weather, aqi: aqiData };
};

// ── Auto-claim pipeline ───────────────────────────────────────────────────────
const processTriggerEvents = async (city, zone) => {
  const db = getDb();
  const { triggered, weather, aqi } = await evaluateTriggers(city, zone);
  const newClaims = [], logs = [];

  if (!triggered.length) {
    logs.push({ step: 'evaluate', status: 'ok', message: `No triggers for ${city}` });
    return { triggered, newClaims, logs, weather, aqi };
  }

  logs.push({ step: 'evaluate', status: 'ok', message: `${triggered.length} trigger(s) in ${city}` });

  for (const event of triggered) {
    // 1. Log trigger
    let trigId;
    try {
      const r = db.prepare(`
        INSERT INTO trigger_events (event_type,city,zone,severity,value,unit,threshold,breached,raw_data)
        VALUES (?,?,?,?,?,?,?,1,?)
      `).run(event.type, city, zone || 'All', event.severity, event.value, event.unit, event.threshold, JSON.stringify(event.data));
      trigId = r.lastID;
    } catch (e) { logs.push({ step: 'log_trigger', status: 'error', error: e.message }); continue; }

    // 2. Find active Q-Commerce policyholders in this city
    const policies = db.prepare(`
      SELECT p.*, u.id as uid, u.avg_weekly_income, u.phone, u.name, u.platform, u.wallet_balance
      FROM policies p JOIN users u ON u.id = p.user_id
      WHERE p.status = 'active' AND p.city = ? AND p.end_date >= datetime('now')
        AND u.is_admin = 0
    `).all(city);

    for (const pol of policies) {
      // Dedup: one claim per trigger type per day per policy
      const exists = db.prepare(
        `SELECT id FROM claims WHERE policy_id=? AND trigger_type=? AND created_at>=date('now')`
      ).get(pol.id, event.type);
      if (exists) continue;

      const weeklyIncome = parseFloat(pol.avg_weekly_income) || 3500;
      const sevMult      = event.severity === 'critical' ? 0.90 : 0.70;
      const payAmt       = +Math.max((weeklyIncome / 7) * sevMult, 150).toFixed(2);

      const fraud = detectFraud({ trigger_type: event.type, location: city, payout_amount: payAmt }, { id: pol.user_id }, pol, event);

      const claimNo  = `CLM-${Date.now()}-${Math.floor(Math.random() * 9999).toString().padStart(4,'0')}`;
      const claimSt  = fraud.decision === 'REJECT' ? 'rejected' : fraud.decision === 'APPROVE' ? 'approved' : 'pending';

      let cId;
      try {
        const cr = db.prepare(`
          INSERT INTO claims (claim_number,policy_id,user_id,trigger_type,trigger_value,status,
            payout_amount,fraud_score,fraud_flags,auto_triggered,location,processed_at)
          VALUES (?,?,?,?,?,?,?,?,?,1,?,datetime('now'))
        `).run(claimNo, pol.id, pol.user_id, event.type, JSON.stringify(event.data),
               claimSt, payAmt, fraud.fraudScore, JSON.stringify(fraud.flags), city);
        cId = cr.lastID;
      } catch (e) { continue; }

      if (claimSt === 'approved') {
        try {
          const upiId = generateUpiId(pol.phone);
          const pay   = await initiatePayout({ amount: payAmt, upiId, name: pol.name, purpose: 'insurance_claim', referenceId: claimNo });
          if (pay.success) {
            db.prepare(`INSERT INTO payouts (claim_id,user_id,amount,method,txn_id,status,upi_id,settled_at) VALUES (?,?,?,'UPI',?,'processed',?,datetime('now'))`).run(cId, pol.user_id, payAmt, pay.txnId, upiId);
            db.prepare(`UPDATE claims SET status='paid', paid_at=datetime('now') WHERE id=?`).run(cId);
            db.prepare(`UPDATE users SET wallet_balance=wallet_balance+? WHERE id=?`).run(payAmt, pol.user_id);
            
            // Real Notification
            createNotification(pol.user_id, {
              type: 'success',
              title: 'Live Trigger: Payout Sent',
              message: `Parametric breach detected: ${event.label} in ${city}. ₹${payAmt.toFixed(0)} auto-credited to your wallet.`
            });

            newClaims.push({ claimNo, status: 'paid', payAmt, txnId: pay.txnId });
          } else {
            db.prepare(`UPDATE claims SET status='pending' WHERE id=?`).run(cId);
            newClaims.push({ claimNo, status: 'pending', payAmt });
          }
        } catch { db.prepare(`UPDATE claims SET status='pending' WHERE id=?`).run(cId); }
      } else {
        if (claimSt === 'rejected') {
          createNotification(pol.user_id, {
            type: 'alert',
            title: 'Claim Blocked',
            message: `Auto-claim for ${event.label} in ${city} was blocked due to manual review requirement.`
          });
        }
        newClaims.push({ claimNo, status: claimSt, payAmt });
      }
    }
  }

  return { triggered, newClaims, logs, weather, aqi };
};

module.exports = { evaluateTriggers, processTriggerEvents, fetchWeather, fetchAQI, reverseGeocode, THRESHOLDS, MOCK_WEATHER, MOCK_AQI, CITY_COORDS, QCOMMERCE_PLATFORMS };
