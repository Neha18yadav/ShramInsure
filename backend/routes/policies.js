// routes/policies.js
const router = require('express').Router();
const { getQuote, createPolicy, getPolicies, getPolicy, cancelPolicy } = require('../controllers/policyController');
const { protect } = require('../middleware/auth');

router.post('/quote', protect, getQuote);
router.post('/', protect, createPolicy);
router.get('/', protect, getPolicies);
router.get('/:id', protect, getPolicy);
router.put('/:id/cancel', protect, cancelPolicy);

module.exports = router;
