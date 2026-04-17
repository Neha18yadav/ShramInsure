// src/utils/api.js — Centralized API client (production-grade, crash-safe)
// VITE_API_URL must be an absolute URL e.g. http://localhost:5001
// Falls back to current origin (works with vite proxy and same-origin deploys)

const _raw = import.meta.env.VITE_API_URL || '';
// Strip trailing slash, then append /api if not already present
const BASE = (() => {
  if (!_raw) {
    // No env var → use relative path for fetch (works with vite proxy)
    // We cannot use `new URL()` with relative paths, so we use a helper
    return null; // signals: use relative fetch
  }
  const clean = _raw.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
})();

const getToken = () => localStorage.getItem('si_token');

const req = async (method, path, body, params) => {
  // Build URL — absolute if BASE is set, relative otherwise
  let url;
  if (BASE) {
    url = new URL(`${BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    url = url.toString();
  } else {
    // Relative — safe for browser (uses vite proxy / same-origin)
    const query = params
      ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      : '';
    url = `/api${path}${query}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    // Never swallow network errors silently — rethrow with context
    throw new Error(err.message || 'Network error — check if backend is running');
  }
};

const get  = (path, params) => req('GET',  path, null, params);
const post = (path, body)   => req('POST', path, body);
const put  = (path, body)   => req('PUT',  path, body);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  register:      (d)     => post('/auth/register',    d),
  requestOtp:    (phone) => post('/auth/request-otp', { phone }),
  login:         (d)     => post('/auth/login',        d),
  me:            ()      => get('/auth/me'),
  updateProfile: (d)     => put('/auth/profile',       d),
  payPremium:    (d)     => post('/auth/pay-premium',  d),
};

// ── Policies ──────────────────────────────────────────────────────────────────
export const policies = {
  quote:  (d)  => post('/policies/quote', d),
  create: (d)  => post('/policies',       d),
  list:   ()   => get('/policies'),
  get:    (id) => get(`/policies/${id}`),
  cancel: (id) => put(`/policies/${id}/cancel`),
};

// ── Claims (NO manual claim filing — trigger scan only) ───────────────────────
export const claims = {
  triggerCheck: (d)     => post('/claims/trigger-check',       d),
  environment:  (p)     => get('/claims/environment',          p),
  list:         ()      => get('/claims'),
  get:          (id)    => get(`/claims/${id}`),
  payout:       (id, d) => post(`/claims/simulate-payout/${id}`, d),
  adminAll:     (p)     => get('/claims/admin/all',            p),
  approve:      (id)    => put(`/claims/admin/${id}/approve`),
  reject:       (id)    => put(`/claims/admin/${id}/reject`),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analytics = {
  dashboard: () => get('/analytics/dashboard'), // admin only
  worker:    () => get('/analytics/worker'),    // any authenticated user
};

// ── Risk ──────────────────────────────────────────────────────────────────────
export const risk = {
  calculate: (d) => post('/risk/calculate', d),
  history:   ()  => get('/risk/history'),
};

// ── Predict ───────────────────────────────────────────────────────────────────
export const predict = {
  loss:   (p) => get('/predict/loss',   p),
  weekly: ()  => get('/predict/weekly'),
};

// ── Simulate ──────────────────────────────────────────────────────────────────
export const simulate = {
  rain:           (d) => post('/simulate/rain',            d),
  pollution:      (d) => post('/simulate/pollution',       d),
  curfew:         (d) => post('/simulate/curfew',          d),
  flood:          (d) => post('/simulate/flood',           d),
  heat:           (d) => post('/simulate/heat',            d),
  weatherTrigger: (d) => post('/simulate/weather-trigger', d),
};

// ── Fraud ─────────────────────────────────────────────────────────────────────
export const fraud = {
  check: (d) => post('/fraud/check',  d),
  logs:  (p) => get('/fraud/logs',    p),
  stats: ()  => get('/fraud/stats'),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const admin = {
  insights:        () => get('/admin/insights'),
  runScheduler:    () => post('/admin/scheduler/run'),
  schedulerStatus: () => get('/admin/scheduler/status'),
  logs:            (p) => get('/admin/logs', p),
  health: {
    sync: () => get('/admin/health/sync'),
  },
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = {
  list:     ()   => get('/notifications'),
  markRead: (id) => req('PATCH', `/notifications/${id}/read`),
  readAll:  ()   => req('PATCH', '/notifications/read-all'),
  delete:   (id) => req('DELETE', `/notifications/${id}`),
};

// ── Geo ───────────────────────────────────────────────────────────────────────
export const geo = {
  cities:  ()         => get('/geo/cities'),
  reverse: (lat, lng) => get('/geo/reverse', { lat, lng }),
};

// ── Geolocation helper (browser → backend reverse geocode → haversine) ────────
const CITY_COORDS = [
  { city: 'Mumbai',    lat: 19.08, lng: 72.88 },
  { city: 'Delhi',     lat: 28.70, lng: 77.10 },
  { city: 'Bangalore', lat: 12.97, lng: 77.59 },
  { city: 'Chennai',   lat: 13.08, lng: 80.27 },
  { city: 'Hyderabad', lat: 17.39, lng: 78.49 },
  { city: 'Pune',      lat: 18.52, lng: 73.86 },
  { city: 'Kolkata',   lat: 22.57, lng: 88.36 },
  { city: 'Ahmedabad', lat: 23.02, lng: 72.57 },
  { city: 'Jaipur',    lat: 26.91, lng: 75.79 },
  { city: 'Surat',     lat: 21.17, lng: 72.83 },
  { city: 'Lucknow',   lat: 26.84, lng: 80.94 },
  { city: 'Nagpur',    lat: 21.14, lng: 79.08 },
  { city: 'Indore',    lat: 22.71, lng: 75.86 },
  { city: 'Bhopal',    lat: 23.25, lng: 77.41 },
  { city: 'Patna',     lat: 25.59, lng: 85.13 },
  { city: 'Vadodara',  lat: 22.30, lng: 73.19 },
  { city: 'Gurgaon',   lat: 28.45, lng: 77.03 },
  { city: 'Noida',     lat: 28.53, lng: 77.39 },
  { city: 'Chandigarh',lat: 30.73, lng: 76.78 },
  { city: 'Kochi',     lat: 9.93,  lng: 76.27 },
  { city: 'Visakhapatnam', lat: 17.69, lng: 83.22 },
];

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371, dL = (lat2-lat1)*Math.PI/180, dG = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dG/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const detectCity = () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    async ({ coords: { latitude: lat, longitude: lng } }) => {
      // Try backend reverse geocode first
      try {
        const r = await geo.reverse(lat, lng);
        if (r.city) return resolve(r.city);
      } catch {}
      // Fallback: haversine nearest city
      let nearest = CITY_COORDS[0], minD = Infinity;
      for (const c of CITY_COORDS) {
        const d = haversine(lat, lng, c.lat, c.lng);
        if (d < minD) { minD = d; nearest = c; }
      }
      resolve(nearest.city);
    },
    () => resolve(null),
    { timeout: 6000, maximumAge: 300000 }
  );
});

