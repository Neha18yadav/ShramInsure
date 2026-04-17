// src/pages/AuthPage.jsx — Registration + OTP Login with geolocation auto-detect
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { auth, detectCity } from '../utils/api';

const CITIES  = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];
const ZONES   = ['Central', 'North', 'South', 'East', 'West', 'Suburbs'];
const PLATFORMS = ['Zepto', 'Blinkit', 'Zomato', 'Swiggy', 'Amazon', 'Flipkart', 'Dunzo'];

export default function AuthPage() {
  const [tab, setTab]     = useState('login');
  const [step, setStep]   = useState('phone');
  const [loading, setLoading]   = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp]     = useState('');
  const [demoOtp, setDemoOtp]   = useState('');
  const [geoCity, setGeoCity]   = useState(null); // null = not detected yet
  const [form, setForm]   = useState({
    name: '', phone: '', platform: 'Zepto', platform_id: '',
    city: 'Mumbai', zone: 'Central', avg_weekly_income: 3500,
  });

  const { login } = useAuth();
  const navigate  = useNavigate();
  const toast     = useToast();

  // Auto-detect city on mount
  useEffect(() => {
    setGeoLoading(true);
    detectCity().then(city => {
      setGeoLoading(false);
      if (city) {
        setGeoCity(city);
        setForm(f => ({ ...f, city }));
        toast.info(`📍 Location detected: ${city}`);
      }
    }).catch(() => setGeoLoading(false));
  }, []);

  const handleRequestOtp = async () => {
    if (!/^\d{10}$/.test(phone)) return toast.error('Enter a valid 10-digit phone number');
    setLoading(true);
    try {
      const r = await auth.requestOtp(phone);
      setDemoOtp(r.otp || '');
      setStep('otp');
      toast.success('OTP sent!');
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!otp) return toast.error('Enter the OTP');
    setLoading(true);
    try {
      const r = await auth.login({ phone, otp });
      login(r.token, r.user);
      toast.success(`Welcome back, ${r.user.name}! 🛡️`);
      navigate('/dashboard');
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!form.name || !form.phone || !form.platform_id)
      return toast.error('Name, phone and Worker ID are required');
    if (!/^\d{10}$/.test(form.phone)) return toast.error('Phone must be 10 digits');
    setLoading(true);
    try {
      const r = await auth.register(form);
      login(r.token, r.user);
      toast.success('Account created! Welcome to ShramInsure 🛡️');
      navigate('/dashboard');
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-base)' }}>
      {/* ── Left hero panel ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'none', flexDirection: 'column', justifyContent: 'center',
        padding: '3rem', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg,#020817 0%,#0a1a0a 100%)',
        borderRight: '1px solid var(--border)',
      }} className="auth-hero">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%,rgba(16,185,129,.08) 0%,transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🛡️</div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1.15, marginBottom: '1rem' }}>
            Income Protection<br />
            <span style={{ background: 'var(--grad-green)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              for Gig Workers
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.7, maxWidth: 420, marginBottom: '2rem' }}>
            AI-powered parametric insurance. When rain, extreme heat, or pollution
            stops you earning — we pay automatically. Zero forms. Zero waiting.
          </p>
          {[
            { icon: '🌧️', t: 'Rain > 65 mm/hr → Auto payout' },
            { icon: '💨', t: 'AQI > 200 → Instant income cover' },
            { icon: '🌡️', t: 'Heat > 42°C → Zero-touch claim' },
            { icon: '🌊', t: 'Flood > 0.5m → Auto-approved' },
          ].map(({ icon, t }) => (
            <div key={t} style={{ display: 'flex', gap: '.75rem', marginBottom: '.65rem', alignItems: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '.875rem' }}>{t}</span>
            </div>
          ))}
          <div style={{ marginTop: '2rem', padding: '.9rem 1.1rem', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--accent-green)', fontWeight: 700, marginBottom: '.4rem' }}>COVERAGE</div>
            <div style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
              📋 Income Loss Only · Weekly premium: ₹75–₹550 · Payout: 70% weekly income
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div style={{ width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '.4rem' }}>🛡️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '.2rem' }}>ShramInsure</h2>
            <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>Gig Worker Income Protection — Fully Automated</p>
          </div>

          {/* Demo credentials */}
          <div style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.18)', borderRadius: 'var(--radius-md)', padding: '.7rem 1rem', marginBottom: '1.25rem', fontSize: '.78rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '.35rem' }}>🧪 Demo Credentials</div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Worker: <code style={{ background: 'var(--bg-card2)', padding: '1px 5px', borderRadius: 3 }}>9876543210</code>&emsp;
              Admin: <code style={{ background: 'var(--bg-card2)', padding: '1px 5px', borderRadius: 3 }}>9999999999</code>
              <span style={{ color: 'var(--text-muted)' }}> → click Get OTP</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 4, marginBottom: '1.25rem' }}>
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setStep('phone'); }}
                style={{
                  flex: 1, padding: '.55rem', border: 'none', cursor: 'pointer',
                  borderRadius: 8, fontWeight: 600, fontSize: '.875rem',
                  fontFamily: 'inherit', transition: 'all .15s',
                  background: tab === t ? 'var(--grad-green)' : 'transparent',
                  color:      tab === t ? '#fff' : 'var(--text-secondary)',
                }}>
                {t === 'login' ? '🔑 Login' : '📝 Register'}
              </button>
            ))}
          </div>

          {/* ── LOGIN ──────────────────────────────────────────────────── */}
          {tab === 'login' && (
            <div className="card">
              {step === 'phone' ? (
                <>
                  <div className="form-group">
                    <label className="label">📱 Mobile Number</label>
                    <input className="input" placeholder="10-digit number" value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} maxLength={10}
                      onKeyDown={e => e.key === 'Enter' && handleRequestOtp()} />
                  </div>
                  <button className="btn btn-primary btn-block btn-lg" onClick={handleRequestOtp} disabled={loading}>
                    {loading ? <><span className="spinner" />Sending...</> : '📲 Get OTP'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '.9rem', padding: '.7rem .9rem', background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 'var(--radius-sm)', fontSize: '.82rem', color: 'var(--text-secondary)' }}>
                    OTP sent to <strong style={{ color: 'var(--text-primary)' }}>{phone}</strong>
                    {demoOtp && <div style={{ color: 'var(--accent-green)', fontWeight: 700, marginTop: '.3rem' }}>Demo OTP: {demoOtp}</div>}
                  </div>
                  <div className="form-group">
                    <label className="label">🔐 OTP</label>
                    <input className="input" placeholder="6-digit OTP" value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                  </div>
                  <div style={{ display: 'flex', gap: '.75rem' }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep('phone')}>← Back</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleLogin} disabled={loading}>
                      {loading ? <><span className="spinner" />Verifying...</> : '✅ Login'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── REGISTER ───────────────────────────────────────────────── */}
          {tab === 'register' && (
            <div className="card">
              {/* Persona label — single, fixed */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.65rem .9rem', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.18)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🛵</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text-primary)' }}>Gig Delivery Worker</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Income Loss Only · Weekly Parametric Cover</div>
                </div>
                <span className="badge badge-green" style={{ marginLeft: 'auto', fontSize: '.65rem' }}>AUTO-CLAIM</span>
              </div>

              <div className="form-group">
                <label className="label">👤 Full Name *</label>
                <input className="input" placeholder="Your name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="label">📱 Phone Number *</label>
                <input className="input" placeholder="10-digit" value={form.phone} maxLength={10}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} />
              </div>

              <div className="form-group">
                <label className="label">🛵 Platform *</label>
                <select className="input" value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                  {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">🆔 Platform Worker ID *</label>
                <input className="input" placeholder="e.g. ZPT-001" value={form.platform_id}
                  onChange={e => setForm(f => ({ ...f, platform_id: e.target.value }))} />
              </div>

              {/* City — auto-detect + manual fallback */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div className="form-group">
                  <label className="label">
                    🏙️ City
                    {geoLoading && <span style={{ marginLeft: '.4rem', fontSize: '.65rem', color: 'var(--accent-amber)' }}>⏳ detecting…</span>}
                    {geoCity && !geoLoading && <span style={{ marginLeft: '.4rem', fontSize: '.65rem', color: 'var(--accent-green)' }}>📍 auto</span>}
                  </label>
                  <select className="input" value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">📍 Zone</label>
                  <select className="input" value={form.zone}
                    onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                    {ZONES.map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="label">💰 Avg. Weekly Income (₹)</label>
                <input className="input" type="number" min={500} max={20000} value={form.avg_weekly_income}
                  onChange={e => setForm(f => ({ ...f, avg_weekly_income: e.target.value }))} />
              </div>

              <div style={{ padding: '.6rem .8rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.9rem' }}>
                📋 <strong>Coverage:</strong> Income Loss Only · Zero-touch claims · Auto UPI payout when triggers breach
              </div>

              <button className="btn btn-primary btn-block btn-lg" onClick={handleRegister} disabled={loading}>
                {loading ? <><span className="spinner" />Creating account...</> : '🚀 Create Account'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) { .auth-hero { display: flex !important; } }
      `}</style>
    </div>
  );
}
