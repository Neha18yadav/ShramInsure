// services/aiPricing.js — Weekly income-loss pricing engine
// Single persona: Gig Delivery Worker (covers Zomato/Swiggy/Zepto/Amazon/Blinkit/Flipkart/Dunzo)
// Coverage: INCOME LOSS ONLY — no health, vehicle, or life coverage

'use strict';

const { computeRiskScore } = require('./aiEngine');

// ── City weather loading (disruption-indexed premium base) ────────────────────
const CITY_WEATHER_LOAD = {
  Mumbai:    30, Delhi: 20, Bangalore: 12, Chennai: 24,
  Hyderabad: 16, Pune: 10, Kolkata: 20,
};

// ── Zone surcharge (higher-risk zones pay slightly more) ──────────────────────
const ZONE_SURCHARGE = {
  Central: 0, North: 6, South: -5, East: 8, West: -3, Suburbs: 12,
};

// ── Seasonal demand index (month 0=Jan) ───────────────────────────────────────
const DEMAND_INDEX = [0.82, 0.78, 0.90, 1.00, 1.05, 0.88, 1.30, 1.40, 1.10, 1.00, 1.20, 1.35];

// Single persona — all gig delivery workers share the same risk profile
const GIG_WORKER_PERSONA = {
  persona:          'Gig Delivery Worker',
  riskMultiplier:   1.05,  // slight loading vs desk workers
  incomeVolatility: 0.60,  // 60% income at risk during disruptions
  coverageType:     'INCOME_LOSS_ONLY',
  description:      'On-demand delivery worker exposed to weather disruptions, ' +
                    'platform downtime, and civil restrictions. Income directly ' +
                    'linked to outdoor working conditions.',
};

/**
 * calculatePremium — Weekly income-loss premium
 * Formula: premium = base + (risk × multiplier) + weather_load + demand_load
 *
 * @param {object} opts
 * @returns {object} pricing result
 */
const calculatePremium = ({
  city, zone, platform, avgWeeklyIncome,
  historicalClaims = 0, workHoursPerDay = 8, monthsOnPlatform = 6,
}) => {
  const income  = parseFloat(avgWeeklyIncome) || 3500;
  const month   = new Date().getMonth();
  const demand  = DEMAND_INDEX[month];

  // AI engine risk score
  const aiResult  = computeRiskScore({ city, zone, platform, avgWeeklyIncome: income, historicalClaims, workHoursPerDay, monthsOnPlatform });
  const riskScore = aiResult.riskScore;

  // Base (city-calibrated)
  const cityBase  = 80 + (CITY_WEATHER_LOAD[city] || 15);
  const zoneSurch = ZONE_SURCHARGE[zone] || 0;

  // Risk loading = income × 2% × risk × persona multiplier
  const riskLoad  = income * 0.020 * riskScore * GIG_WORKER_PERSONA.riskMultiplier;

  // Weather loading = city disruption factor scaled by risk
  const weatherLoad = (CITY_WEATHER_LOAD[city] || 15) * (1 + riskScore * 0.5);

  // Demand loading = seasonal peak cost
  const demandLoad  = income * 0.008 * Math.max(demand - 0.7, 0);

  // History penalty (3% per prior claim, max 30%)
  const histPenalty = Math.min(historicalClaims * 0.03, 0.30);

  // Blend: 60% model output + 40% income anchor (4.5% of weekly income)
  const raw      = (cityBase + zoneSurch + riskLoad + weatherLoad + demandLoad) * (1 + histPenalty);
  const anchor   = income * 0.045;
  const blended  = raw * 0.60 + anchor * 0.40;

  // Round to ₹5, clamp ₹75–₹550
  const weeklyPremium = Math.min(Math.max(Math.round(blended / 5) * 5, 75), 550);

  // Coverage = 70% of weekly income
  const coverageAmount = Math.round(income * 0.70);

  return {
    weeklyPremium,
    monthlyEquivalent:  Math.round(weeklyPremium * 4.33),
    coverageAmount,
    riskScore,
    riskLevel:          riskScore > 0.65 ? 'HIGH' : riskScore > 0.35 ? 'MEDIUM' : 'LOW',
    persona:            GIG_WORKER_PERSONA.persona,
    coverageType:       GIG_WORKER_PERSONA.coverageType,
    breakdown: {
      cityBase:         Math.round(cityBase),
      zoneSurcharge:    zoneSurch,
      riskLoad:         Math.round(riskLoad),
      weatherLoad:      Math.round(weatherLoad),
      demandLoad:       Math.round(demandLoad),
      historyPenalty:   `${(histPenalty * 100).toFixed(0)}%`,
      rawPremium:       Math.round(raw),
      incomeAnchor:     Math.round(anchor),
      demandIndex:      +demand.toFixed(2),
    },
    aiFactors:          aiResult.featureBreakdown,
    nextWeekPrediction: aiResult.nextWeekPrediction,
    recommendation:
      weeklyPremium <= 130 ? '✅ Low Risk — excellent coverage value for your zone'
      : weeklyPremium <= 240 ? '⚠️ Moderate Risk — recommended income protection'
      : '🔴 High Risk Zone — essential coverage for your safety',
  };
};

/**
 * getPersonaProfile — Returns the single gig delivery worker profile
 */
const getPersonaProfile = () => ({ ...GIG_WORKER_PERSONA });

// Legacy: kept for any controller that imports WORKER_PERSONAS
const WORKER_PERSONAS = {};

module.exports = { calculatePremium, getPersonaProfile, WORKER_PERSONAS, DEMAND_INDEX };
