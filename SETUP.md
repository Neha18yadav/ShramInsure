# ShramInsure — Setup Guide

## Renamed from GigShield → ShramInsure
AI-powered parametric income protection for India's gig delivery workers.

## Prerequisites
- Node.js 18+
- npm or yarn

## Quick Start

### 1. Backend
```bash
cd backend
npm install
node index.js
```
Server starts at http://localhost:5001

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend at http://localhost:5173

## Demo Accounts
| Role   | Phone      | OTP (shown in terminal) |
|--------|------------|------------------------|
| Worker | 9876543210 | Check backend logs      |
| Admin  | 9999999999 | Check backend logs      |

## What's Fixed in This Version
1. ✅ **Registration Bug Fixed** — New users can now register without errors
2. ✅ **Payout ₹0 Bug Fixed** — Claims now show correct payout amounts
3. ✅ **Accidental Cover** — Activates automatically after 12 months of premium payments
4. ✅ **Rebranded to ShramInsure** — All UI & backend updated
5. ✅ **Animations** — Smooth entrance/exit animations on every page

## Accidental Premium Feature
- Users pay monthly premium (₹299/month via `/api/auth/pay-premium`)
- After 12 months cumulative payment → Accidental Cover activates automatically
- Progress shown in sidebar and Policies page
- Admin seed users (9999999999, 9876543210) have 13+ months already paid → Cover active

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new gig worker |
| POST | /api/auth/request-otp | Request OTP |
| POST | /api/auth/login | Login with OTP |
| POST | /api/auth/pay-premium | Pay monthly premium |
| GET  | /api/policies | Get all policies |
| POST | /api/policies | Create new policy |
| GET  | /api/claims | Get all claims |
| POST | /api/claims/trigger-check | Run disruption scan |
| POST | /api/claims/simulate-payout/:id | Simulate UPI payout |
