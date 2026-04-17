# 🚀 ShramInsure — Setup & Deployment Guide

Welcome to **ShramInsure**, the first fully automated, zero-touch parametric insurance platform for India's Q-Commerce gig workers.

## 📋 Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **Git**

---

## 🛠️ Tech Stack
- **Frontend**: React, Vite, Recharts, Context API, CSS Variables (Glassmorphism)
- **Backend**: Node.js, Express, SQLite, node-cron
- **APIs**: OpenWeatherMap (Weather), WAQI (Air Quality), OpenCage (Geocoding), Browser Geolocation

---

## 🏗️ Folder Structure
```text
ShramInsure/
├── backend/
│   ├── config/          # Database & environment config
│   ├── controllers/     # API request handlers
│   ├── routes/          # Express route definitions
│   ├── services/        # Core logic (AI, Pricing, Scheduler, Fraud, Payments)
│   ├── index.js         # Entry point & server setup
│   └── .env.example     # Environment variables template
│
└── frontend/
    ├── src/
    │   ├── components/  # Reusable UI elements (CitySelect, Layout, Toast)
    │   ├── context/     # Auth context provider
    │   ├── pages/       # Dashboard, Policies, Claims, Simulate, Admin, Auth
    │   ├── utils/       # API client, formatting utils
    │   ├── App.jsx      # React router & app shell
    │   └── index.css    # Global styles & design system
    └── package.json
```

---

## 🚀 Step-by-Step Local Setup

### 1. Clone the Repository
```bash
git clone <repository_url>
cd ShramInsure
```

### 2. Configure Environment Variables
We use real third-party APIs for verifying parametric triggers. The system includes safe fallbacks, but real keys are recommended for the full demo experience.

```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your keys (free tiers available for all):
```env
PORT=5001
JWT_SECRET=shraminsure_super_secret_hackathon_key

# Real APIs for Trigger Verification
WEATHER_API_KEY=your_openweather_key
AQI_API_KEY=your_waqi_key
GEO_API_KEY=your_opencage_key

# Payment Gateway
RAZORPAY_KEY_ID=rzp_test_12345
RAZORPAY_SECRET=rzp_secret_67890
```

### 3. Start the Backend
The backend runs the REST API, the AI Risk Engine, and the 5-minute background automation scheduler.
```bash
npm install
npm run dev
```
*Server will start on `http://localhost:5001` and initialize the SQLite database automatically.*

### 4. Start the Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*App will start on `http://localhost:5173`.*

---

## 🎮 How to Test the Full Demo

### Demo Credentials
No password required. Enter the phone number and click "Get OTP". In dev mode, the OTP is printed directly on the screen.

| Role | Phone | Notes |
| :--- | :--- | :--- |
| **Q-Commerce Worker** | `9876543210` | Full worker dashboard, policies, auto-claims. |
| **Administrator** | `9999999999` | Access to Admin Insights, Scheduler Status, and Fraud Trends. |

### The "Golden Path" Demo Flow
1. **Register**: Log in as the worker (`9876543210`). The system will auto-detect your location using browser GPS.
2. **Get a Policy**: Go to **My Policy**. Click "Get AI Quote". Notice how the premium is calculated based on your city, zone, and Q-Commerce platform. Click "Create Policy".
3. **Simulate Disruption**: Go to the **Demo Sim** page. Click **"Simulate Heavy Rain"**.
4. **Watch the Magic**: 
   - The system detects the trigger (e.g., Rain > 65mm/hr).
   - An auto-claim is generated.
   - The AI Fraud Engine runs (checks GPS, time anomalies, etc.).
   - The claim is auto-approved.
   - Payout is instantly credited to the wallet/UPI.
5. **View Results**: Return to the **Dashboard** to see the new Wallet Balance, the Auto-Claim in history, and the Explainable AI event banner!

---

## 💡 Troubleshooting
- **Frontend can't connect to backend?** Ensure the backend is running on port `5001`. The frontend proxy is configured to forward `/api` requests there.
- **Location Auto-Detect Failing?** Ensure you allow location permissions in your browser. If it fails, the app safely falls back to a Haversine distance calculation to the nearest major Indian hub.
- **Database Errors?** Delete the `backend/shraminsure.db` file and restart the backend. SQLite will automatically rebuild the schema and seed mock users.
