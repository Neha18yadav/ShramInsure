// controllers/healthController.js — API Connectivity & Sync Health Check
'use strict';

const { fetchWeather, fetchAQI, reverseGeocode } = require('../services/triggerMonitor');

/**
 * GET /api/admin/health/sync
 * Tests connectivity to all 3rd party providers
 */
const getSyncHealth = async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    providers: []
  };

  const testCity = 'Mumbai';

  // 1. Test Weather (OWM or Open-Meteo)
  try {
    const w = await fetchWeather(testCity);
    results.providers.push({
      name: 'Weather API',
      status: w.source === 'mock_fallback' ? 'degraded' : 'healthy',
      source: w.source,
      latency: 'checked',
      message: w.source === 'mock_fallback' ? 'Using simulated data' : `Live data from ${w.source}`
    });
  } catch (e) {
    results.providers.push({ name: 'Weather API', status: 'error', message: e.message });
    results.status = 'degraded';
  }

  // 2. Test AQI (WAQI)
  try {
    const a = await fetchAQI(testCity);
    results.providers.push({
      name: 'AQI API (WAQI)',
      status: a.source === 'mock_fallback' ? 'degraded' : 'healthy',
      source: a.source,
      message: a.source === 'mock_fallback' ? 'Mock fallback active' : 'Connected to WAQI'
    });
  } catch (e) {
    results.providers.push({ name: 'AQI API', status: 'error', message: e.message });
    results.status = 'degraded';
  }

  // 3. Test Geocoding (OpenCage)
  try {
    const g = await reverseGeocode(19.08, 72.88);
    results.providers.push({
      name: 'Geocoding (OpenCage)',
      status: g.source === 'haversine_fallback' ? 'degraded' : 'healthy',
      source: g.source,
      message: g.city === 'Mumbai' ? 'Precision match' : 'Fallback active'
    });
  } catch (e) {
    results.providers.push({ name: 'Geocoding', status: 'error', message: e.message });
    results.status = 'degraded';
  }

  res.json(results);
};

module.exports = { getSyncHealth };
