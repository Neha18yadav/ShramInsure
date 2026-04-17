// routes/simulate.js — Demo simulation endpoints
const router = require('express').Router();
const {
  simulateRain, simulatePollution, simulateCurfew, simulateFlood, simulateHeat,
  simulateWeatherTrigger, simulateClaim, getSimulations,
} = require('../controllers/simulationController');
const { protect } = require('../middleware/auth');

router.post('/rain',              protect, simulateRain);
router.post('/pollution',         protect, simulatePollution);
router.post('/curfew',            protect, simulateCurfew);
router.post('/flood',             protect, simulateFlood);
router.post('/heat',              protect, simulateHeat);
router.post('/weather-trigger',   protect, simulateWeatherTrigger);
router.post('/claim',             protect, simulateClaim);
router.get('/history',            protect, getSimulations);

module.exports = router;
