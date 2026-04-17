// controllers/authController.js — Registration, OTP login, profile
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'shraminsure_super_secret_jwt_key_2026';

const makeToken = (user) => jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

/**
 * POST /api/auth/register
 * Full onboarding for new gig worker
 */
const register = (req, res) => {
  const db = getDb();
  const { name, phone, platform, platform_id, aadhaar_last4, city, zone, avg_weekly_income } = req.body;

  if (!phone || !platform_id || !platform) {
    return res.status(400).json({ error: 'Phone, platform and platform ID are required.' });
  }

  // Validate phone
  const cleanPhone = String(phone).trim();
  if (!/^\d{10}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'Phone must be a 10-digit number.' });
  }

  // Validate platform_id
  const cleanPlatformId = String(platform_id).trim();
  if (!cleanPlatformId || cleanPlatformId.length < 3) {
    return res.status(400).json({ error: 'Platform ID must be at least 3 characters.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO users (name, phone, platform, platform_id, aadhaar_last4, city, zone, avg_weekly_income, premium_paid_months, accidental_cover_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `);
    const result = stmt.run(
      (name || 'Gig Partner').trim(),
      cleanPhone,
      platform.trim(),
      cleanPlatformId,
      aadhaar_last4 || null,
      city || 'Mumbai',
      zone || 'Central',
      parseFloat(avg_weekly_income) || 3500
    );

    if (!result.lastID) {
      return res.status(500).json({ error: 'Failed to create user account. Please try again.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastID);
    if (!user) {
      return res.status(500).json({ error: 'User created but could not be retrieved.' });
    }

    const token = makeToken(user);
    res.status(201).json({ message: 'Registration successful', token, user: sanitize(user) });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.message && err.message.includes('UNIQUE constraint')) {
      if (err.message.includes('phone')) {
        return res.status(409).json({ error: 'This phone number is already registered. Please login instead.' });
      }
      if (err.message.includes('platform_id')) {
        return res.status(409).json({ error: 'This Platform ID is already registered.' });
      }
      return res.status(409).json({ error: 'Phone or Platform ID already registered.' });
    }
    res.status(500).json({ error: 'Server error during registration. Please try again.' });
  }
};

/**
 * POST /api/auth/request-otp
 * Send (mock) OTP for phone-based login
 */
const requestOtp = (req, res) => {
  const db = getDb();
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone is required.' });

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(String(phone).trim());
  if (!user) return res.status(404).json({ error: 'User not found. Please register first.' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  db.prepare('UPDATE users SET otp = ?, otp_expiry = ? WHERE phone = ?').run(otp, expiry, String(phone).trim());
  console.log(`🔐 Mock OTP for ${phone}: ${otp}`);

  res.json({ message: 'OTP sent successfully!', otp }); // Expose OTP in dev mode
};

/**
 * POST /api/auth/login
 * Verify OTP and issue JWT
 */
const login = (req, res) => {
  const db = getDb();
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required.' });

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(String(phone).trim());
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.otp !== String(otp).trim()) return res.status(401).json({ error: 'Invalid OTP.' });
  if (new Date(user.otp_expiry) < new Date()) return res.status(401).json({ error: 'OTP expired. Request a new one.' });

  db.prepare('UPDATE users SET otp = NULL, otp_expiry = NULL WHERE phone = ?').run(String(phone).trim());
  const token = makeToken(user);
  res.json({ message: 'Login successful!', token, user: sanitize(user) });
};

/**
 * GET /api/auth/me
 */
const getMe = (req, res) => {
  res.json({ user: sanitize(req.user) });
};

/**
 * PUT /api/auth/profile
 */
const updateProfile = (req, res) => {
  const db = getDb();
  const { name, city, zone, avg_weekly_income } = req.body;
  db.prepare(`
    UPDATE users SET name = COALESCE(?, name), city = COALESCE(?, city),
    zone = COALESCE(?, zone), avg_weekly_income = COALESCE(?, avg_weekly_income)
    WHERE id = ?
  `).run(name, city, zone, avg_weekly_income, req.user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: sanitize(updated) });
};

/**
 * POST /api/auth/pay-premium
 * Record a premium payment; activate accidental cover after 12 months
 */
const payPremium = (req, res) => {
  const db = getDb();
  const { months = 1, amount } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  const newMonths = (user.premium_paid_months || 0) + parseFloat(months);
  const accidentalActive = newMonths >= 12 ? 1 : 0;

  db.prepare(`
    UPDATE users SET premium_paid_months = ?, accidental_cover_active = ? WHERE id = ?
  `).run(newMonths, accidentalActive, user.id);

  // Log payment
  db.prepare(`
    INSERT INTO accidental_payments (user_id, amount, months_total) VALUES (?, ?, ?)
  `).run(user.id, parseFloat(amount) || 0, newMonths);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({
    user: sanitize(updated),
    accidentalCoverActive: accidentalActive === 1,
    premiumPaidMonths: newMonths,
    message: accidentalActive === 1 && !user.accidental_cover_active
      ? '🎉 Accidental Premium Coverage activated! You have paid 12+ months.'
      : `Premium recorded. ${Math.max(0, 12 - newMonths).toFixed(1)} more month(s) until Accidental Coverage.`,
  });
};

const sanitize = (user) => {
  const { otp, otp_expiry, ...safe } = user;
  return safe;
};

module.exports = { register, requestOtp, login, getMe, updateProfile, payPremium };
