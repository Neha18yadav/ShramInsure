# ShramInsure — AI-Powered Parametric Income Insurance for Gig Workers

> **Coverage Type:** Income Loss Only (no health/vehicle/accident)  
> **Model:** Fully automated zero-touch parametric claims with AI fraud detection

---

## 🚀 How to Run

### 1. Backend

```bash
cd backend
cp .env.example .env     # optional — works with defaults
npm install
npm run dev              # starts on http://localhost:5001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev              # starts on http://localhost:5173
```

### 3. Demo Credentials

| Role   | Phone        |
|--------|--------------|
| Worker | 9876543210   |
| Admin  | 9999999999   |

Click **"Get OTP"** → OTP is shown on-screen (dev mode).

---

## 🏗️ Architecture

```
ShramInsure/
├── backend/
│   ├── services/
│   │   ├── aiEngine.js          # Hybrid AI: weather(30%) + AQI(20%) + history(20%) + location(15%) + demand(15%)
│   │   ├── aiPricing.js         # Weekly premium engine + persona system (Zepto/Zomato/Amazon etc.)
│   │   ├── scheduler.js         # node-cron every 5 min — trigger→claim→fraud→payout pipeline
│   │   ├── triggerMonitor.js    # Real API + fallback weather/AQI fetching + 6 parametric triggers
│   │   ├── fraudDetection.js    # 7-signal fraud engine: GPS mismatch, duplicate, time anomaly, weather mismatch
│   │   └── paymentService.js    # Razorpay-structured mock UPI payout
│   ├── controllers/
│   │   ├── simulationController.js  # One-click demo: trigger→claim→fraud→payout with step-by-step logs
│   │   ├── analyticsController.js   # Business KPIs, loss ratio, revenue vs payouts, fraud trends
│   │   ├── adminController.js       # Predictive claims, high-risk zones, platform performance
│   │   ├── claimsController.js      # Auto-trigger check + admin approve/reject
│   │   ├── policyController.js      # Weekly pricing + persona-aware quotes
│   │   └── riskController.js        # Hybrid AI risk + next-week prediction
│   └── index.js                 # Server entry — starts scheduler after DB init
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx    # Worker: policy, AI risk, 7-day forecast, live env, claims
    │   │   ├── PoliciesPage.jsx # AI quote with persona + policy management
    │   │   ├── ClaimsPage.jsx   # Claims with fraud meter + inline payout
    │   │   ├── SimulationPage.jsx # One-click demo: Rain/AQI/Flood/Heat/Curfew
    │   │   ├── AdminPage.jsx    # KPIs, fraud trends, predictions, platform perf
    │   │   └── AuthPage.jsx     # Register + OTP login with persona display
    │   ├── components/
    │   │   ├── Layout.jsx       # Sidebar with risk meter + accidental cover progress
    │   │   └── Toast.jsx        # Global toast notification system
    │   ├── context/AuthContext.jsx
    │   └── utils/api.js         # Centralized fetch client for all endpoints
```

---

## ⚙️ Parametric Triggers

| Trigger        | Threshold  | Auto-Action                          |
|----------------|-----------|---------------------------------------|
| 🌧️ Heavy Rain  | > 65 mm/hr | Auto-file income loss claim           |
| 🌡️ Extreme Heat | > 42°C     | Auto-file income loss claim           |
| 💨 Air Quality | AQI > 200  | Auto-file income loss claim           |
| ⛈️ Storm       | > 50 km/h  | Auto-file income loss claim           |
| 🌊 Flood       | > 0.5m     | Auto-file income loss claim           |
| 🚫 Curfew      | Active     | Auto-file income loss claim           |

---

## 🤖 Fraud Detection Signals

| Signal                  | Weight | Description                                |
|-------------------------|--------|--------------------------------------------|
| Duplicate claim 24h     | 0.45   | Same trigger filed twice in 24 hours       |
| GPS location mismatch   | 0.40   | Claim city ≠ policy city                   |
| Out-of-coverage period  | 0.60   | Claim outside policy dates                 |
| Early claim anomaly     | 0.22   | Claim < 24h after policy creation          |
| Weather threshold unmet | 0.55   | Trigger not actually breached              |
| High claim frequency    | 0.28   | > 4 claims in 30 days                     |
| Payout amount anomaly   | 0.18   | Claim > 2.8× historical average            |

**Decision:** `< 0.4` → Auto-Approve | `0.4–0.7` → Manual Review | `> 0.7` → Auto-Reject

---

## 🎭 Worker Personas

| Platform  | Persona              | Risk Mult | Notes                                    |
|-----------|----------------------|-----------|------------------------------------------|
| Zepto     | Q-Commerce Rider     | 1.18×     | Extreme conditions, highest volatility   |
| Blinkit   | Q-Commerce Rider     | 1.15×     | Quick commerce, high disruption exposure |
| Dunzo     | Q-Commerce Rider     | 1.12×     | On-demand delivery                       |
| Zomato    | Food Delivery Partner| 1.08×     | Rain = high demand but dangerous         |
| Swiggy    | Food Delivery Partner| 1.08×     | Peak hours in adverse weather            |
| Amazon    | E-Commerce Courier   | 0.92×     | Indoor pickup, less weather exposure     |
| Flipkart  | E-Commerce Courier   | 0.92×     | Controlled delivery environment          |

---

## 📡 Key API Endpoints

```
POST /api/auth/register          → Register new gig worker
POST /api/auth/request-otp       → Get OTP (returned in response in dev mode)
POST /api/auth/login             → Verify OTP, get JWT

GET  /api/risk/personas          → All worker persona profiles
POST /api/risk/calculate         → Hybrid AI risk score + next-week prediction

POST /api/policies/quote         → AI-powered weekly premium quote
POST /api/policies               → Create policy

POST /api/claims/trigger-check   → Run live trigger scan + auto-create claims
GET  /api/claims/environment     → Live weather/AQI conditions for city

POST /api/simulate/rain          → Demo: simulate heavy rain event
POST /api/simulate/pollution     → Demo: simulate AQI emergency
POST /api/simulate/flood         → Demo: simulate flood alert
POST /api/simulate/heat          → Demo: simulate extreme heat
POST /api/simulate/curfew        → Demo: simulate zone curfew
POST /api/simulate/weather-trigger → Generic trigger (body: triggerType, value)

GET  /api/admin/insights         → Full admin analytics + predictions
POST /api/admin/scheduler/run    → Manually trigger scheduler cycle
GET  /api/admin/logs             → Combined trigger + claim + payout logs
GET  /api/analytics/dashboard    → Admin business metrics
GET  /api/analytics/worker       → Worker dashboard data
```

---

## 🌍 Environment Variables

See `backend/.env.example` — all vars are optional; system falls back to mock data.

```env
PORT=5001
JWT_SECRET=shraminsure_super_secret_jwt_key_2026
OPENWEATHER_API_KEY=    # optional — uses mock if absent
IQAIR_API_KEY=          # optional — uses mock if absent
RAZORPAY_KEY_ID=        # optional — uses simulation if absent
RAZORPAY_SECRET=        # optional — uses simulation if absent
```
