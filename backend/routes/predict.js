// routes/predict.js
const router = require('express').Router();
const { predictLoss, predictWeekly } = require('../controllers/predictController');
const { protect } = require('../middleware/auth');

router.get('/loss', protect, predictLoss);
router.get('/weekly', protect, predictWeekly);

module.exports = router;
