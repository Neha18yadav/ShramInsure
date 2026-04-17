// index.js — ShramInsure Production Backend Server v4.0
'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.path}`);
    next();
  });
}

const startServer = async () => {
  // 1. Init database
  const { initDb } = require('./config/database');
  await initDb();

  // 2. Mount all routes AFTER db is ready
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/policies',  require('./routes/policies'));
  app.use('/api/claims',    require('./routes/claims'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/risk',      require('./routes/risk'));
  app.use('/api/predict',   require('./routes/predict'));
  app.use('/api/simulate',  require('./routes/simulate'));
  app.use('/api/fraud',     require('./routes/fraud'));
  app.use('/api/admin',     require('./routes/admin'));
  app.use('/api/geo',       require('./routes/geo'));
  app.use('/api/notifications', require('./routes/notifications'));

  // 3. Health + root
  app.get('/', (_req, res) => res.json({
    service:  'ShramInsure API v4.0',
    status:   'running',
    coverage: 'INCOME_LOSS_ONLY',
    features: ['HybridAI', 'ZeroTouchClaims', 'FraudDetection', 'IncomePredictor', 'SimulationEngine', 'AccidentalCover', 'PersonaSystem', 'BackgroundScheduler'],
  }));

  app.get('/api/health', (_req, res) => res.json({
    status:    'ok',
    service:   'ShramInsure API v4.0',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  }));

  // 4. Error handlers
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err, _req, res, _next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  // 5. Start listening
  app.listen(PORT, () => {
    console.log('\n🛡️  ShramInsure API v4.0 → http://localhost:' + PORT);
    console.log('📋  Coverage        : INCOME LOSS ONLY | Q-Commerce Workers');
    console.log('🧠  Hybrid AI       : POST /api/risk/calculate');
    console.log('🌦️  Trigger Check   : POST /api/claims/trigger-check');
    console.log('🎯  Simulations     : POST /api/simulate/rain');
    console.log('📍  Geo / Cities    : GET  /api/geo/cities');
    console.log('📊  Admin Insights  : GET  /api/admin/insights');
    console.log('⛯️  Scheduler       : GET  /api/admin/scheduler/status');
    console.log('👤  Demo worker     : phone=9876543210');
    console.log('🔑  Admin           : phone=9999999999\n');
  });

  // 6. Start background scheduler AFTER server is up
  const { startScheduler } = require('./services/scheduler');
  startScheduler();
};

startServer().catch(err => {
  console.error('💥 Startup error:', err);
  process.exit(1);
});
