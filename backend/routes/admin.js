// routes/admin.js — Admin insights, scheduler control, system logs
const router  = require('express').Router();
const { getInsights, runSchedulerNow, schedulerStatus, getSystemLogs } = require('../controllers/adminController');
const { getSyncHealth } = require('../controllers/healthController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/insights',           protect, adminOnly, getInsights);
router.post('/scheduler/run',     protect, adminOnly, runSchedulerNow);
router.get('/scheduler/status',   protect, adminOnly, schedulerStatus);
router.get('/logs',               protect, adminOnly, getSystemLogs);
router.get('/health/sync',        protect, adminOnly, getSyncHealth);

module.exports = router;
