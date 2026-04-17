// services/aiEngine.js — Hybrid AI Engine for ShramInsure
// Weighted multi-factor model: weather(30%) + AQI(20%) + user history(20%) + location(15%) + demand(15%)

'use strict';

// ── City environmental profiles ────────────────────────────────────────────────
const CITY_PROFILES = {
  Mumbai:    { weather: 0.85, aqi: 0.30, locationRisk: 0.72, demand: 0.78, base: 120 },
  Delhi:     { weather: 0.60, aqi: 0.95, locationRisk: 0.68, demand: 0.82, base: 110 },
  Bangalore: { weather: 0.50, aqi: 0.55, locationRisk: 0.45, demand: 0.70, base: 100 },
  Chennai:   { weather: 0.75, aqi: 0.40, locationRisk: 0.62, demand: 0.65, base: 115 },
  Hyderabad: { weather: 0.55, aqi: 0.50, locationRisk: 0.50, demand: 0.60, base: 105 },
  Pune:      { weather: 0.60, aqi: 0.40, locationRisk: 0.42, demand: 0.55, base:  95 },
  Kolkata:   { weather: 0.70, aqi: 0.60, locationRisk: 0.60, demand: 0.58, base: 108 },
};

const ZONE_MODIFIERS = {
  Central: 0.00, North: 0.05, South: -0.05,
  East: 0.08, West: -0.03, Suburbs: 0.12,
};

const PLATFORM_RISK = {
  Zomato: 1.05, Swiggy: 1.05, Zepto: 1.12,
  Blinkit: 1.10, Amazon: 0.95, Flipkart: 0.95, Dunzo: 1.08,
};

// ── Weights (must sum to 1.0) ──────────────────────────────────────────────────
const WEIGHTS = {
  weather:     0.30,
  aqi:         0.20,
  userHistory: 0.20,
  location:    0.15,
  demand:      0.15,
};

// ── Demand seasonality (rough monthly index, 0 = Jan) ─────────────────────────
const DEMAND_INDEX = [0.8, 0.75, 0.9, 1.0, 1.05, 0.85, 1.3, 1.4, 1.1, 1.0, 1.2, 1.35];

/**
 * computeRiskScore — Core AI scoring function
 * Returns risk_score (0-1), fraud_probability, claim_confidence, next_week_prediction
 */
const computeRiskScore = ({
  city = 'Mumbai',
  zone = 'Central',
  platform = 'Zepto',
  avgWeeklyIncome = 3500,
  historicalClaims = 0,
  workHoursPerDay = 8,
  monthsOnPlatform = 6,
  currentRainfall = null,   // mm/hr (live or simulated)
  currentAQI = null,        // AQI index (live or simulated)
}) => {
  const profile = CITY_PROFILES[city] || CITY_PROFILES.Mumbai;
  const zoneMod = ZONE_MODIFIERS[zone] || 0;
  const platFactor = PLATFORM_RISK[platform] || 1.0;
  const month = new Date().getMonth();
  const demandMult = DEMAND_INDEX[month];

  // ── Feature 1: Weather (30%) ───────────────────────────────────────────────
  let weatherScore = profile.weather;
  if (currentRainfall !== null) {
    // Boost if live reading exceeds base expectation
    const rainfallNorm = Math.min(currentRainfall / 120, 1.0);
    weatherScore = 0.5 * profile.weather + 0.5 * rainfallNorm;
  }
  const weatherFeature = weatherScore * WEIGHTS.weather;

  // ── Feature 2: AQI (20%) ──────────────────────────────────────────────────
  let aqiScore = profile.aqi;
  if (currentAQI !== null) {
    const aqiNorm = Math.min(currentAQI / 500, 1.0);
    aqiScore = 0.5 * profile.aqi + 0.5 * aqiNorm;
  }
  const aqiFeature = aqiScore * WEIGHTS.aqi;

  // ── Feature 3: User History (20%) ─────────────────────────────────────────
  const claimPenalty = Math.min(historicalClaims * 0.06, 0.35);
  const experienceBonus = Math.max(0, (12 - monthsOnPlatform) / 24) * 0.12;
  const hoursExposure = Math.min(workHoursPerDay / 14, 1.0) * 0.08;
  const historyScore = Math.min(claimPenalty + experienceBonus + hoursExposure, 1.0);
  const historyFeature = historyScore * WEIGHTS.userHistory;

  // ── Feature 4: Location Risk (15%) ────────────────────────────────────────
  const locationScore = Math.min(profile.locationRisk + zoneMod, 1.0);
  const locationFeature = locationScore * WEIGHTS.location;

  // ── Feature 5: Demand Factor (15%) ────────────────────────────────────────
  const incomeSensitivity = Math.max(0, (6000 - avgWeeklyIncome) / 12000);
  const demandScore = Math.min(profile.demand * demandMult * 0.6 + incomeSensitivity * 0.4, 1.0);
  const demandFeature = demandScore * WEIGHTS.demand;

  // ── Composite raw score ────────────────────────────────────────────────────
  let rawScore = weatherFeature + aqiFeature + historyFeature + locationFeature + demandFeature;

  // Platform multiplier (scales around neutral 1.0)
  rawScore = rawScore * ((platFactor - 0.85) / 0.3 * 0.15 + 0.85);

  const riskScore = Math.min(Math.max(rawScore, 0), 1.0);

  // ── Premium calculation (actuarially fair) ─────────────────────────────────
  const basePremium = profile.base + (avgWeeklyIncome * 0.025);
  const riskPremium = basePremium * (1 + riskScore * 0.85) * platFactor * (demandMult * 0.3 + 0.7);
  const weeklyPremium = Math.round(riskPremium / 5) * 5;
  const coverageAmount = Math.round(avgWeeklyIncome * 0.70);

  // ── Fraud probability (0-1) ───────────────────────────────────────────────
  const fraudBase = historicalClaims >= 5 ? 0.35 : historicalClaims >= 3 ? 0.20 : 0.05;
  const fraudExperience = monthsOnPlatform < 2 ? 0.15 : 0;
  const fraudDemand = demandMult > 1.3 ? 0.10 : 0; // high demand period → more fraud attempts
  const fraudProbability = Math.min(fraudBase + fraudExperience + fraudDemand, 1.0);

  // ── Claim confidence (how likely this user has a legitimate claim) ────────
  const claimConfidence = Math.min(
    (weatherScore * 0.4) + (aqiScore * 0.25) + (locationScore * 0.2) + ((1 - fraudProbability) * 0.15),
    1.0
  );

  // ── Next week prediction (deterministic — no randomness) ─────────────────
  const nextMonth      = (month + 1) % 12;
  const nextDemand     = DEMAND_INDEX[nextMonth];
  // Seasonal drift: demand index ratio drives risk shift; history penalty persists
  const nextWeekRisk   = Math.min(riskScore * (nextDemand / Math.max(demandMult, 0.1)), 1.0);
  const nextWeekPremium = Math.round((basePremium * (1 + nextWeekRisk * 0.85) * platFactor) / 5) * 5;

  return {
    riskScore:           +riskScore.toFixed(4),
    riskLevel:           riskScore > 0.65 ? 'HIGH' : riskScore > 0.35 ? 'MEDIUM' : 'LOW',
    fraudProbability:    +fraudProbability.toFixed(4),
    claimConfidence:     +claimConfidence.toFixed(4),
    weeklyPremium,
    coverageAmount,
    nextWeekPrediction: {
      riskScore:     +nextWeekRisk.toFixed(4),
      weeklyPremium: nextWeekPremium,
      trend:         nextWeekRisk > riskScore * 1.05 ? 'RISING' : nextWeekRisk < riskScore * 0.95 ? 'FALLING' : 'STABLE',
      demandIndex:   +nextDemand.toFixed(2),
    },
    featureBreakdown: {
      weatherScore:    +weatherFeature.toFixed(4),
      aqiScore:        +aqiFeature.toFixed(4),
      historyScore:    +historyFeature.toFixed(4),
      locationScore:   +locationFeature.toFixed(4),
      demandScore:     +demandFeature.toFixed(4),
    },
    weights: WEIGHTS,
    inputs: { city, zone, platform, avgWeeklyIncome, historicalClaims, workHoursPerDay, monthsOnPlatform, currentRainfall, currentAQI },
    modelVersion: 'ShramInsure-HybridAI-v4.0',
    computedAt: new Date().toISOString(),
  };
};

/**
 * generateRiskExplanation — human-readable breakdown
 */
const generateRiskExplanation = (result) => {
  const { inputs, featureBreakdown, riskScore } = result;
  const reasons = [];

  if (featureBreakdown.weatherScore > 0.20)
    reasons.push(`High weather risk in ${inputs.city} (monsoon/cyclone exposure)`);
  if (featureBreakdown.aqiScore > 0.15)
    reasons.push(`Elevated AQI levels in ${inputs.city} — frequently exceeds safe limits`);
  if (featureBreakdown.locationScore > 0.12)
    reasons.push(`${inputs.zone} zone carries historical waterlogging and disruption data`);
  if (featureBreakdown.historyScore > 0.10)
    reasons.push(`${inputs.historicalClaims} prior claims increase actuarial risk loading`);
  if (featureBreakdown.demandScore > 0.12)
    reasons.push(`Peak delivery season — demand index elevated (${(result.nextWeekPrediction.demandIndex * 100).toFixed(0)}%)`);
  if (reasons.length === 0)
    reasons.push('Low composite risk — excellent coverage value in your zone');

  return reasons;
};

module.exports = { computeRiskScore, generateRiskExplanation, CITY_PROFILES, PLATFORM_RISK, WEIGHTS };
