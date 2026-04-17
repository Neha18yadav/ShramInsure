// middleware/auth.js — JWT verification middleware
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'shraminsure_super_secret_jwt_key_2026';

/**
 * Protect routes — verifies JWT and attaches user to req
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token, access denied.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid or expired.' });
  }
};

// Alias so both naming conventions work
const authenticate = protect;

/**
 * Admin-only gate
 */
const adminOnly = (req, res, next) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

module.exports = { protect, authenticate, adminOnly };
