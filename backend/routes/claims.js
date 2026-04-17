// routes/claims.js
const router = require('express').Router();
const {
  runTriggerCheck, getEnvironment, getClaims, getClaim,
  simulatePayout, adminGetAllClaims, adminApproveClaim, adminRejectClaim,
} = require('../controllers/claimsController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/trigger-check', protect, runTriggerCheck);
router.get('/environment', protect, getEnvironment);
router.get('/', protect, getClaims);
router.get('/:id', protect, getClaim);
router.post('/simulate-payout/:id', protect, simulatePayout);

// Admin routes
router.get('/admin/all', protect, adminOnly, adminGetAllClaims);
router.put('/admin/:id/approve', protect, adminOnly, adminApproveClaim);
router.put('/admin/:id/reject', protect, adminOnly, adminRejectClaim);

module.exports = router;
