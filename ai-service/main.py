"""
GigShield AI Microservice — Phase 3
FastAPI ML Risk Engine + Income Predictor
Run: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import random
import math
from datetime import datetime, timedelta

app = FastAPI(
    title="GigShield AI Engine",
    description="ML-powered risk scoring, income prediction, and fraud detection for parametric insurance",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── City risk profiles (simulated ML training outputs) ──────────────────────
CITY_RISK_PROFILES = {
    "Mumbai":    {"base": 0.65, "weather": 0.85, "pollution": 0.30, "flood": 0.70, "disruption_freq": 0.72},
    "Delhi":     {"base": 0.70, "weather": 0.60, "pollution": 0.95, "flood": 0.40, "disruption_freq": 0.68},
    "Bangalore": {"base": 0.45, "weather": 0.50, "pollution": 0.55, "flood": 0.20, "disruption_freq": 0.45},
    "Chennai":   {"base": 0.60, "weather": 0.75, "pollution": 0.40, "flood": 0.65, "disruption_freq": 0.62},
    "Hyderabad": {"base": 0.50, "weather": 0.55, "pollution": 0.50, "flood": 0.35, "disruption_freq": 0.50},
    "Pune":      {"base": 0.40, "weather": 0.60, "pollution": 0.40, "flood": 0.30, "disruption_freq": 0.42},
    "Kolkata":   {"base": 0.58, "weather": 0.70, "pollution": 0.60, "flood": 0.60, "disruption_freq": 0.60},
}

ZONE_MODIFIERS = {
    "Central": 0.00, "North": 0.05, "South": -0.05,
    "East": 0.08, "West": -0.03, "Suburbs": 0.12,
}

PLATFORM_RISK = {
    "Zomato": 1.05, "Swiggy": 1.05, "Zepto": 1.12,
    "Blinkit": 1.10, "Amazon": 0.95, "Flipkart": 0.95, "Dunzo": 1.08,
}

# ── Request/Response Models ─────────────────────────────────────────────────

class RiskRequest(BaseModel):
    city: str = "Mumbai"
    zone: str = "Central"
    platform: str = "Zepto"
    avg_weekly_income: float = 3500
    historical_claims: int = 0
    work_hours_per_day: Optional[float] = 8.0
    months_on_platform: Optional[int] = 6

class PredictionRequest(BaseModel):
    city: str
    zone: str
    avg_weekly_income: float
    platform: Optional[str] = "Zepto"

class FraudRequest(BaseModel):
    user_id: int
    claim_amount: float
    trigger_type: str
    city: str
    monthly_claim_count: int = 0
    days_since_policy: int = 30
    location_matches_policy: bool = True
    trigger_threshold_breached: bool = True

# ── ML Risk Scoring Engine ───────────────────────────────────────────────────

def compute_risk_score(city, zone, platform, income, claims, work_hours, months) -> dict:
    profile = CITY_RISK_PROFILES.get(city, CITY_RISK_PROFILES["Mumbai"])
    zone_mod = ZONE_MODIFIERS.get(zone, 0.0)
    plat_factor = PLATFORM_RISK.get(platform, 1.0)

    # Feature engineering (simulates what a gradient boosted tree would learn)
    weather_feature   = profile["weather"] * 0.30
    pollution_feature = profile["pollution"] * 0.15
    flood_feature     = profile["flood"] * 0.12
    zone_feature      = profile["base"] + zone_mod
    claims_feature    = min(claims * 0.04, 0.28)
    income_feature    = max(0, (5000 - income) / 10000) * 0.08  # lower income → higher relative risk
    experience_feature = max(0, (12 - months) / 24) * 0.06   # newer workers → slightly riskier
    hours_feature     = min((work_hours / 12), 1.0) * 0.05   # longer hours = more exposure

    raw_score = (
        weather_feature + pollution_feature + flood_feature +
        zone_feature + claims_feature + income_feature +
        experience_feature + hours_feature
    )

    # Platform multiplier effect
    raw_score = raw_score * ((plat_factor - 0.9) * 2 + 0.8)

    # Normalize to [0, 1]
    score = min(max(raw_score, 0.0), 1.0)

    # Premium calc (actuarially fair for parametric insurance)
    base_premium = 90 + (income * 0.04)
    risk_premium = base_premium * (1 + score * 0.8) * plat_factor
    weekly_premium = round(risk_premium / 5) * 5
    coverage_amount = round(income * 0.70)

    return {
        "risk_score": round(score, 4),
        "risk_level": "HIGH" if score > 0.65 else "MEDIUM" if score > 0.35 else "LOW",
        "weekly_premium": int(weekly_premium),
        "coverage_amount": int(coverage_amount),
        "feature_importances": {
            "weather_risk":       round(weather_feature, 4),
            "pollution_risk":     round(pollution_feature, 4),
            "flood_risk":         round(flood_feature, 4),
            "zone_risk":          round(zone_feature, 4),
            "claims_history":     round(claims_feature, 4),
            "income_sensitivity": round(income_feature, 4),
            "platform_exposure":  round((plat_factor - 1) * 0.2, 4),
        },
        "explanation": generate_explanation(score, city, zone, platform, claims),
    }

def generate_explanation(score, city, zone, platform, claims):
    reasons = []
    profile = CITY_RISK_PROFILES.get(city, CITY_RISK_PROFILES["Mumbai"])
    if profile["weather"] > 0.7:
        reasons.append(f"{city} is a high weather-risk city (monsoon/cyclone exposure)")
    if profile["pollution"] > 0.7:
        reasons.append(f"{city} has severe pollution risk — AQI frequently exceeds safe limits")
    if ZONE_MODIFIERS.get(zone, 0) > 0.05:
        reasons.append(f"{zone} zone has historical waterlogging and disruption data")
    if PLATFORM_RISK.get(platform, 1) > 1.08:
        reasons.append(f"{platform} operates in extreme-condition delivery (Q-commerce model)")
    if claims >= 3:
        reasons.append(f"{claims} prior claims increase actuarial risk (+{claims*3}% loading)")
    if not reasons:
        reasons.append("Low base risk — good coverage value in your zone")
    return reasons

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "GigShield AI Engine v3.0",
        "model": "GigShield-GBT-Parametric-v3",
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.post("/risk/score")
def risk_score(req: RiskRequest):
    result = compute_risk_score(
        req.city, req.zone, req.platform,
        req.avg_weekly_income, req.historical_claims,
        req.work_hours_per_day or 8.0,
        req.months_on_platform or 6,
    )
    return {
        **result,
        "inputs": req.dict(),
        "model_version": "GigShield-GBT-v3",
        "computed_at": datetime.utcnow().isoformat(),
    }

@app.post("/predict/income-loss")
def predict_income_loss(req: PredictionRequest):
    profile = CITY_RISK_PROFILES.get(req.city, CITY_RISK_PROFILES["Mumbai"])
    daily_income = req.avg_weekly_income / 7

    # Simulated real-time conditions
    disruptions = []

    # Weather signal
    rain_prob = profile["weather"] * 100 + random.uniform(-10, 10)
    if rain_prob > 65:
        impact = min((rain_prob / 65) * 0.7, 0.92)
        disruptions.append({
            "type": "WEATHER_RAIN", "label": "Heavy Rain",
            "probability": round(rain_prob, 1),
            "income_impact_pct": round(impact * 100, 1),
            "estimated_daily_loss": round(daily_income * impact, 0),
        })

    # Pollution signal
    aqi_level = profile["pollution"] * 350 + random.uniform(-30, 30)
    if aqi_level > 200:
        impact = min((aqi_level / 200) * 0.55, 0.88)
        disruptions.append({
            "type": "POLLUTION_AQI", "label": "Air Quality Emergency",
            "probability": round(aqi_level, 0),
            "income_impact_pct": round(impact * 100, 1),
            "estimated_daily_loss": round(daily_income * impact, 0),
        })

    # Flood signal
    flood_prob = profile["flood"] * 90 + random.uniform(-15, 15)
    if flood_prob > 40:
        impact = min((flood_prob / 50) * 0.75, 0.95)
        disruptions.append({
            "type": "FLOOD_ALERT", "label": "Flood Risk",
            "probability": round(flood_prob, 1),
            "income_impact_pct": round(impact * 100, 1),
            "estimated_daily_loss": round(daily_income * impact, 0),
        })

    max_loss = max([d["estimated_daily_loss"] for d in disruptions], default=0)
    risk_24h = min(profile["disruption_freq"] * 100 + random.uniform(-8, 8), 97)

    weekly_forecast = []
    for i in range(7):
        decay = max(0.35, 1 - i * 0.09)
        day_date = (datetime.now() + timedelta(days=i)).strftime("%a")
        weekly_forecast.append({
            "day": day_date,
            "risk_percent": round(risk_24h * decay, 0),
            "estimated_loss": round(max_loss * decay, 0),
        })

    return {
        "city": req.city,
        "risk_24h": round(risk_24h, 1),
        "estimated_loss_24h": round(max_loss, 0),
        "disruptions": disruptions,
        "weekly_forecast": weekly_forecast,
        "total_weekly_loss": round(sum(d["estimated_loss"] for d in weekly_forecast), 0),
        "model": "GigShield-IncomePredictor-v3",
        "computed_at": datetime.utcnow().isoformat(),
    }

@app.post("/fraud/analyze")
def fraud_analyze(req: FraudRequest):
    flags = []
    score = 0.0

    if req.monthly_claim_count >= 4:
        flags.append({"type": "HIGH_FREQUENCY", "severity": "HIGH", "detail": f"{req.monthly_claim_count} claims in 30 days"})
        score += 0.30

    if req.days_since_policy < 1:
        flags.append({"type": "POLICY_TOO_NEW", "severity": "MEDIUM", "detail": "Claim within 24h of policy creation"})
        score += 0.25

    if not req.location_matches_policy:
        flags.append({"type": "LOCATION_MISMATCH", "severity": "HIGH", "detail": "Claim city differs from policy city"})
        score += 0.40

    if not req.trigger_threshold_breached:
        flags.append({"type": "THRESHOLD_NOT_MET", "severity": "CRITICAL", "detail": "Trigger did not breach parametric threshold"})
        score += 0.55

    if req.monthly_claim_count >= 2:
        pattern_score = min((req.monthly_claim_count - 1) * 0.07, 0.20)
        if pattern_score > 0.1:
            flags.append({"type": "SUSPICIOUS_PATTERN", "severity": "MEDIUM", "detail": f"Unusual claim frequency pattern"})
            score += pattern_score

    score = min(score, 1.0)
    decision = "REJECT" if score >= 0.7 else "REVIEW" if score >= 0.4 else "APPROVE"

    return {
        "fraud_score": round(score, 3),
        "fraud_level": "HIGH" if score >= 0.7 else "MEDIUM" if score >= 0.4 else "LOW",
        "decision": decision,
        "flags": flags,
        "auto_payout": decision == "APPROVE",
        "reason": (
            "All checks passed — auto-payout approved" if decision == "APPROVE"
            else "Moderate signals — manual review required" if decision == "REVIEW"
            else "High fraud probability — claim rejected"
        ),
        "model": "GigShield-FraudNet-v3",
        "analyzed_at": datetime.utcnow().isoformat(),
    }

@app.get("/cities/risk-map")
def city_risk_map():
    result = []
    for city, profile in CITY_RISK_PROFILES.items():
        composite = (profile["weather"]*0.35 + profile["pollution"]*0.25 + profile["flood"]*0.25 + profile["disruption_freq"]*0.15)
        result.append({
            "city": city,
            "composite_risk": round(composite, 3),
            "risk_level": "HIGH" if composite > 0.6 else "MEDIUM" if composite > 0.45 else "LOW",
            "weather_risk": profile["weather"],
            "pollution_risk": profile["pollution"],
            "flood_risk": profile["flood"],
            "disruption_frequency": profile["disruption_freq"],
        })
    return {"cities": sorted(result, key=lambda x: -x["composite_risk"])}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
