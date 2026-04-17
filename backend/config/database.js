// config/database.js — sql.js SQLite with file persistence
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(process.env.DB_PATH || './shraminsure.db');
let _db = null;

function saveDb() {
  if (!_db) return;
  try {
    const data = _db._db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch(e) { console.error('SaveDb error:', e.message); }
}

setInterval(saveDb, 30000);
process.on('exit', saveDb);
process.on('SIGINT', () => { saveDb(); process.exit(0); });

class SyncDb {
  constructor(sqlJsDb) { this._db = sqlJsDb; }

  exec(sql) {
    this._db.run(sql);
    saveDb();
    return this;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        try {
          // Use prepare+bind+step for proper lastID retrieval
          const stmt = self._db.prepare(sql);
          stmt.bind(params);
          stmt.step();
          stmt.free();

          // Get lastID via a fresh statement
          const ridStmt = self._db.prepare('SELECT last_insert_rowid() as lid');
          ridStmt.step();
          const row = ridStmt.getAsObject();
          ridStmt.free();
          const lastID = row.lid ?? null;

          // Get changes count
          const changesStmt = self._db.prepare('SELECT changes() as cnt');
          changesStmt.step();
          const changesRow = changesStmt.getAsObject();
          changesStmt.free();
          const changes = changesRow.cnt ?? 0;

          saveDb();
          return { changes, lastID };
        } catch(err) {
          console.error('DB run error:', err.message, '\nSQL:', sql);
          throw err;
        }
      },
      get(...params) {
        try {
          const stmt = self._db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const r = stmt.getAsObject();
            stmt.free();
            return r;
          }
          stmt.free();
          return undefined;
        } catch(err) {
          console.error('DB get error:', err.message, '\nSQL:', sql);
          throw err;
        }
      },
      all(...params) {
        try {
          const stmt = self._db.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        } catch(err) {
          console.error('DB all error:', err.message, '\nSQL:', sql);
          throw err;
        }
      },
    };
  }

  pragma() {}
}

async function initDb() {
  const SQL = await initSqlJs();
  let sqlJsDb;
  if (fs.existsSync(DB_PATH)) {
    sqlJsDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqlJsDb = new SQL.Database();
  }
  _db = new SyncDb(sqlJsDb);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Gig Worker',
      phone TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL DEFAULT 'Zepto',
      platform_id TEXT NOT NULL UNIQUE,
      aadhaar_last4 TEXT,
      city TEXT NOT NULL DEFAULT 'Mumbai',
      zone TEXT NOT NULL DEFAULT 'Central',
      avg_weekly_income REAL NOT NULL DEFAULT 3500,
      risk_score REAL NOT NULL DEFAULT 0.5,
      otp TEXT,
      otp_expiry TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      wallet_balance REAL NOT NULL DEFAULT 0,
      premium_paid_months REAL NOT NULL DEFAULT 0,
      accidental_cover_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      policy_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      coverage_amount REAL NOT NULL,
      weekly_premium REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      risk_score REAL NOT NULL DEFAULT 0.5,
      zone TEXT NOT NULL DEFAULT 'Central',
      city TEXT NOT NULL DEFAULT 'Mumbai',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_number TEXT NOT NULL UNIQUE,
      policy_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_value TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      payout_amount REAL NOT NULL DEFAULT 0,
      fraud_score REAL NOT NULL DEFAULT 0,
      fraud_flags TEXT NOT NULL DEFAULT '[]',
      auto_triggered INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT,
      paid_at TEXT
    )
  `);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS trigger_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      city TEXT NOT NULL,
      zone TEXT,
      severity TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      threshold REAL NOT NULL,
      breached INTEGER NOT NULL DEFAULT 0,
      raw_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL DEFAULT 'UPI',
      txn_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'processing',
      upi_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      settled_at TEXT
    )
  `);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS premium_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      base_premium REAL NOT NULL,
      final_premium REAL NOT NULL,
      city TEXT NOT NULL,
      zone TEXT NOT NULL,
      weather_factor REAL NOT NULL DEFAULT 1.0,
      pollution_factor REAL NOT NULL DEFAULT 1.0,
      zone_factor REAL NOT NULL DEFAULT 1.0,
      history_factor REAL NOT NULL DEFAULT 1.0,
      platform_factor REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS accidental_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      months_total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Seed admin
  if (!_db.prepare("SELECT id FROM users WHERE phone='9999999999'").get()) {
    _db.prepare(
      `INSERT INTO users (name,phone,platform,platform_id,city,zone,avg_weekly_income,risk_score,is_admin,wallet_balance,premium_paid_months,accidental_cover_active)
       VALUES ('Admin User','9999999999','ShramInsure','ADMIN001','Mumbai','Central',0,0,1,100000,15,1)`
    ).run();
  }

  // Seed demo worker
  if (!_db.prepare("SELECT id FROM users WHERE phone='9876543210'").get()) {
    const res = _db.prepare(
      `INSERT INTO users (name,phone,platform,platform_id,city,zone,avg_weekly_income,risk_score,wallet_balance,premium_paid_months,accidental_cover_active)
       VALUES ('Ravi Kumar','9876543210','Zepto','ZPT-RK-001','Mumbai','East',4200,0.65,2800,13,1)`
    ).run();

    // Add seed notification for Ravi
    _db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, read, created_at)
      VALUES (?, 'info', 'Protection Active', 'Your ShramInsure parametric protection is live. You are covered for weather disruptions in Mumbai.', 0, datetime('now'))
    `).run(res.lastID);
  }

  saveDb();
  console.log('✅ Database initialized at', DB_PATH);
  return _db;
}

function getDb() {
  if (!_db) throw new Error('DB not initialized. Ensure initDb() was called first.');
  return _db;
}

module.exports = { initDb, getDb };
