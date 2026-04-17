// routes/risk.js
const router = require('express').Router();
const { calculateRisk, getRiskHistory } = require('../controllers/riskController');
const { protect } = require('../middleware/auth');

router.post('/calculate', protect, calculateRisk);
router.get('/history',    protect, getRiskHistory);

module.exports = router;
