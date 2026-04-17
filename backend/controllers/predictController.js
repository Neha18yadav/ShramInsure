// controllers/predictController.js — Income Loss Prediction Engine
const { getDb } = require('../config/database');

// Mock real-time weather + AQI data per city (would call OpenWeatherMap/CPCB in production)
const LIVE_CONDITIONS = {
  Mumbai:    { rainfall: 78, temp: 37, aqi: 165, windSpeed: 58, floodRisk: 0.72, curfewRisk: 0.05 },
  Delhi:     { rainfall: 5,  temp: 44, aqi: 310, windSpeed: 18, floodRisk: 0.3,  curfewRisk: 0.15 },
  Bangalore: { rainfall: 45, temp: 32, aqi: 98,  windSpeed: 28, floodRisk: 0.2,  curfewRisk: 0.02 },
  Chennai:   { rainfall: 68, temp: 40, aqi: 145, windSpeed: 52, floodRisk: 0.65, curfewRisk: 0.04 },
  Hyderabad: { rainfall: 20, temp: 42, aqi: 190, windSpeed: 22, floodRisk: 0.35, curfewRisk: 0.03 },
  Pune:      { rainfall: 35, temp: 38, aqi: 120, windSpeed: 24, floodRisk: 0.25, curfewRisk: 0.02 },
  Kolkata:   { rainfall: 55, temp: 36, aqi: 210, windSpeed: 35, floodRisk: 0.55, curfewRisk: 0.06 },
};

// Parametric thresholds
const THRESHOLDS = {
  rainfall: 65, temp: 42, aqi: 200, windSpeed: 50, floodRisk: 0.5, curfewRisk: 0.1,
};

// How much each trigger type reduces income (income loss multiplier)
const INCOME_IMPACT = {
  rainfall: 0.70,   // Rain → 70% income drop
  temp:     0.55,   // Heat → 55% drop (fewer orders)
  aqi:      0.60,   // Pollution → 60% drop
  windSpeed: 0.75,  // Storm → 75% drop
  floodRisk: 0.85,  // Flood → 85% drop
  curfewRisk: 0.90, // Curfew → 90% drop
};

/**
 * GET /api/predict/loss
 * Predict income loss for next 24h + 7 days
 */
const predictLoss = (req, res) => {
  const db = getDb();
  const user = req.user;
  const city = req.query.city || user.city;
  const conditions = LIVE_CONDITIONS[city] || LIVE_CONDITIONS['Mumbai'];

  // Identify which disruptions are active or near-threshold
  const disruptions = [];
  let maxImpact = 0;

  if (conditions.rainfall > THRESHOLDS.rainfall * 0.75) {
    const severity = conditions.rainfall / THRESHOLDS.rainfall;
    const impact = Math.min(severity * INCOME_IMPACT.rainfall, 0.95);
    disruptions.push({ type: 'WEATHER_RAIN', label: 'Heavy Rain', icon: '🌧', value: conditions.rainfall, unit: 'mm/hr', impact, active: conditions.rainfall > THRESHOLDS.rainfall });
    maxImpact = Math.max(maxImpact, impact);
  }

  if (conditions.temp > THRESHOLDS.temp * 0.9) {
    const impact = Math.min((conditions.temp / THRESHOLDS.temp) * INCOME_IMPACT.temp, 0.90);
    disruptions.push({ type: 'WEATHER_HEAT', label: 'Extreme Heat', icon: '🌡', value: conditions.temp, unit: '°C', impact, active: conditions.temp > THRESHOLDS.temp });
    maxImpact = Math.max(maxImpact, impact);
  }

  if (conditions.aqi > THRESHOLDS.aqi * 0.8) {
    const impact = Math.min((conditions.aqi / THRESHOLDS.aqi) * INCOME_IMPACT.aqi, 0.90);
    disruptions.push({ type: 'POLLUTION_AQI', label: 'Air Quality', icon: '💨', value: conditions.aqi, unit: 'AQI', impact, active: conditions.aqi > THRESHOLDS.aqi });
    maxImpact = Math.max(maxImpact, impact);
  }

  if (conditions.windSpeed > THRESHOLDS.windSpeed * 0.8) {
    const impact = Math.min((conditions.windSpeed / THRESHOLDS.windSpeed) * INCOME_IMPACT.windSpeed, 0.95);
    disruptions.push({ type: 'WEATHER_STORM', label: 'Storm Warning', icon: '⛈', value: conditions.windSpeed, unit: 'km/h', impact, active: conditions.windSpeed > THRESHOLDS.windSpeed });
    maxImpact = Math.max(maxImpact, impact);
  }

  const weeklyIncome = user.avg_weekly_income || 3500;
  const dailyIncome  = weeklyIncome / 7;

  // Composite 24h risk
  const risk24h = Math.min(maxImpact * 100, 98);
  const estimatedLoss24h = +(dailyIncome * maxImpact).toFixed(0);

  // 7-day forecast (decaying probability)
  const forecast7d = Array.from({ length: 7 }, (_, i) => {
    const decay = Math.max(0.4, 1 - i * 0.1);
    const dayRisk = Math.min(risk24h * decay, 95);
    const dayLoss = +(dailyIncome * (maxImpact * decay)).toFixed(0);
    const d = new Date(); d.setDate(d.getDate() + i);
    return {
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      date: d.toISOString().slice(0, 10),
      riskPercent: Math.round(dayRisk),
      estimatedLoss: dayLoss,
      primaryTrigger: disruptions[0]?.type || null,
    };
  });

  const totalWeeklyLoss = forecast7d.reduce((s, d) => s + d.estimatedLoss, 0);
  const coverageAmount  = db.prepare(
    "SELECT coverage_amount FROM policies WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(user.id)?.coverage_amount || 0;

  res.json({
    city,
    conditions,
    risk24h: Math.round(risk24h),
    estimatedLoss24h,
    disruptions,
    forecast7d,
    totalWeeklyLoss: Math.round(totalWeeklyLoss),
    coverageAmount,
    protectionGap: Math.max(0, totalWeeklyLoss - coverageAmount),
    recommendation: risk24h > 70 ? 'HIGH RISK — Disruption imminent. Your policy will auto-trigger.' :
                    risk24h > 40 ? 'MODERATE — Monitor conditions. Trigger scan recommended.' :
                    'LOW RISK — Good conditions for delivery today.',
    computedAt: new Date().toISOString(),
  });
};

/**
 * GET /api/predict/weekly
 * 4-week premium forecast based on seasonal patterns
 */
const predictWeekly = (req, res) => {
  const db = getDb();
  const user = req.user;
  const city = user.city;

  const SEASONAL = {
    Mumbai:    [0.9, 1.4, 1.6, 1.3],
    Delhi:     [1.8, 1.6, 1.2, 0.8],
    Bangalore: [1.1, 1.2, 1.3, 1.1],
    Chennai:   [1.0, 1.1, 1.5, 1.7],
    default:   [1.0, 1.1, 1.2, 1.1],
  };

  const multipliers = SEASONAL[city] || SEASONAL.default;
  const basePolicy  = db.prepare(
    "SELECT weekly_premium, coverage_amount FROM policies WHERE user_id = ? AND status = 'active' LIMIT 1"
  ).get(user.id);

  const basePremium = basePolicy?.weekly_premium || 185;

  const weeks = multipliers.map((m, i) => {
    const d = new Date(); d.setDate(d.getDate() + i * 7);
    return {
      week: `Wk ${i + 1}`,
      startDate: d.toISOString().slice(0, 10),
      projectedPremium: Math.round(basePremium * m / 5) * 5,
      riskMultiplier: m,
      trend: m > 1.3 ? 'rising' : m > 1.0 ? 'stable' : 'falling',
    };
  });

  res.json({ city, weeks, basePremium });
};

module.exports = { predictLoss, predictWeekly };
