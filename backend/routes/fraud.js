// routes/fraud.js
const router = require('express').Router();
const { checkFraud, getFraudLogs, getFraudStats } = require('../controllers/fraudController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/check',         protect, checkFraud);
router.get('/logs',           protect, adminOnly, getFraudLogs);
router.get('/stats',          protect, adminOnly, getFraudStats);

module.exports = router;
