/**
 * seed-demo.js — Populate database with rich demo data
 * Run: node seed-demo.js
 */
require('dotenv').config();
const { initDb, getDb } = require('./config/database');
const { calculatePremium } = require('./services/aiPricing');
const { v4: uuidv4 } = require('uuid');

const WORKERS = [
  { name:'Ravi Kumar',    phone:'9876543210', platform:'Zepto',    platform_id:'ZPT-RK-001', city:'Mumbai',    zone:'East',    income:4200, wallet:2800 },
  { name:'Priya Sharma',  phone:'9123456789', platform:'Zomato',   platform_id:'ZMT-PS-002', city:'Delhi',     zone:'North',   income:3800, wallet:1200 },
  { name:'Arjun Nair',    phone:'9234567890', platform:'Swiggy',   platform_id:'SWG-AN-003', city:'Bangalore', zone:'Central', income:3500, wallet:900 },
  { name:'Deepa Reddy',   phone:'9345678901', platform:'Blinkit',  platform_id:'BLK-DR-004', city:'Hyderabad', zone:'West',    income:4000, wallet:1500 },
  { name:'Sanjay Patel',  phone:'9456789012', platform:'Amazon',   platform_id:'AMZ-SP-005', city:'Pune',      zone:'South',   income:3200, wallet:600 },
];

const TRIGGER_TYPES = ['WEATHER_RAIN','POLLUTION_AQI','WEATHER_STORM','WEATHER_HEAT','FLOOD_ALERT'];

async function seed() {
  await initDb();
  const db = getDb();

  console.log('🌱 Seeding demo data...\n');

  for (const w of WORKERS) {
    // Upsert worker
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(w.phone);
    let userId;

    if (!existing) {
      const r = db.prepare(`
        INSERT INTO users (name,phone,platform,platform_id,city,zone,avg_weekly_income,wallet_balance,risk_score)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(w.name, w.phone, w.platform, w.platform_id, w.city, w.zone, w.income, w.wallet, Math.random()*0.6+0.2);
      userId = r.lastID;
      console.log(`  ✅ Created worker: ${w.name} (${w.phone})`);
    } else {
      userId = existing.id;
      console.log(`  ⏭  Worker exists: ${w.name}`);
    }

    // Create active policy if none
    const hasPolicy = db.prepare("SELECT id FROM policies WHERE user_id = ? AND status='active'").get(userId);
    if (!hasPolicy) {
      const premium = calculatePremium({ city:w.city, zone:w.zone, platform:w.platform, avgWeeklyIncome:w.income });
      const start = new Date();
      const end = new Date(); end.setDate(end.getDate() + 28);
      const policyNum = `GS-${w.platform.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

      db.prepare(`
        INSERT INTO policies (user_id,policy_number,status,coverage_amount,weekly_premium,start_date,end_date,risk_score,city,zone)
        VALUES (?,?,'active',?,?,?,?,?,?,?)
      `).run(userId, policyNum, premium.coverageAmount, premium.weeklyPremium,
        start.toISOString(), end.toISOString(), premium.riskScore, w.city, w.zone);
      console.log(`     🛡️  Policy: ${policyNum} — ₹${premium.weeklyPremium}/wk, coverage ₹${premium.coverageAmount}`);
    }
  }

  // Add historical claims for Ravi (the demo user)
  const ravi = db.prepare("SELECT * FROM users WHERE phone='9876543210'").get();
  const raviPolicy = db.prepare("SELECT * FROM policies WHERE user_id=? AND status='active' LIMIT 1").get(ravi.id);

  if (raviPolicy) {
    const existingClaims = db.prepare('SELECT COUNT(*) as n FROM claims WHERE user_id=?').get(ravi.id).n;

    if (existingClaims < 3) {
      const pastClaims = [
        { type:'WEATHER_RAIN',   amount:486, status:'paid',     daysAgo:14 },
        { type:'POLLUTION_AQI',  amount:378, status:'paid',     daysAgo:8  },
        { type:'WEATHER_STORM',  amount:540, status:'pending',  daysAgo:2  },
      ];

      for (const c of pastClaims) {
        const claimDate = new Date(); claimDate.setDate(claimDate.getDate() - c.daysAgo);
        const claimNum = `CLM-SEED-${Math.floor(Math.random()*9999)}`;
        const txnId = `TXN-${uuidv4().substring(0,8).toUpperCase()}`;

        const cr = db.prepare(`
          INSERT INTO claims (claim_number,policy_id,user_id,trigger_type,trigger_value,status,
            payout_amount,fraud_score,fraud_flags,auto_triggered,location,created_at,processed_at)
          VALUES (?,?,?,?,?,?,?,0.08,'[]',1,?,?,?)
        `).run(claimNum, raviPolicy.id, ravi.id, c.type, JSON.stringify({simulated:true}),
          c.status, c.amount, ravi.city, claimDate.toISOString(), claimDate.toISOString());

        if (c.status === 'paid') {
          const paidDate = new Date(claimDate); paidDate.setMinutes(paidDate.getMinutes()+2);
          db.prepare(`
            INSERT INTO payouts (claim_id,user_id,amount,method,txn_id,status,upi_id,settled_at)
            VALUES (?,?,?,'UPI',?,'success',?,?)
          `).run(cr.lastID, ravi.id, c.amount, txnId, `${ravi.phone}@upi`, paidDate.toISOString());
          db.prepare("UPDATE claims SET paid_at=? WHERE id=?").run(paidDate.toISOString(), cr.lastID);
        }
      }
      console.log(`\n  📋 Added 3 historical claims for Ravi Kumar`);
    }
  }

  // Trigger events log
  const trigEvents = [
    { type:'WEATHER_RAIN',   city:'Mumbai',    zone:'East',    sev:'high',     val:87.5,  unit:'mm/hr',   thresh:65  },
    { type:'POLLUTION_AQI',  city:'Delhi',     zone:'North',   sev:'critical', val:335,   unit:'AQI',     thresh:200 },
    { type:'WEATHER_STORM',  city:'Chennai',   zone:'Central', sev:'critical', val:72,    unit:'km/h',    thresh:50  },
    { type:'FLOOD_ALERT',    city:'Mumbai',    zone:'East',    sev:'high',     val:0.8,   unit:'meters',  thresh:0.5 },
    { type:'WEATHER_HEAT',   city:'Delhi',     zone:'North',   sev:'high',     val:45.2,  unit:'°C',      thresh:42  },
  ];

  const existingEvents = db.prepare('SELECT COUNT(*) as n FROM trigger_events').get().n;
  if (existingEvents < 5) {
    for (const e of trigEvents) {
      db.prepare(`
        INSERT INTO trigger_events (event_type,city,zone,severity,value,unit,threshold,breached,raw_data)
        VALUES (?,?,?,?,?,?,?,1,?)
      `).run(e.type, e.city, e.zone, e.sev, e.val, e.unit, e.thresh, JSON.stringify({seeded:true}));
    }
    console.log(`\n  ⚡ Added ${trigEvents.length} trigger events`);
  }

  console.log('\n✅ Seed complete!\n');
  console.log('Demo Login:');
  console.log('  Worker: 9876543210 (Ravi Kumar, Mumbai East, Zepto)');
  console.log('  Admin:  9999999999\n');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
