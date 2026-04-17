const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { register, requestOtp, login, getMe, updateProfile, payPremium } = require('../controllers/authController');

router.post('/register', register);
router.post('/request-otp', requestOtp);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.post('/pay-premium', authenticate, payPremium);

module.exports = router;
