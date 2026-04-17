// routes/analytics.js
const router = require('express').Router();
const { getDashboard, getWorkerDashboard } = require('../controllers/analyticsController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/dashboard', protect, adminOnly, getDashboard);
router.get('/worker', protect, getWorkerDashboard);

module.exports = router;
