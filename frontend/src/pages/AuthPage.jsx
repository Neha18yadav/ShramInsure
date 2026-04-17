// src/pages/AuthPage.jsx — Q-Commerce Worker Registration + OTP Login
// Searchable all-India city dropdown + geolocation auto-detect
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { auth, detectCity } from '../utils/api';
import CitySelect from '../components/CitySelect';
import { Shield, Smartphone, Bike, User, IdCard, Building2, MapPin, Banknote, ClipboardList, Beaker, Key, UserPlus, X, Umbrella, Zap, CloudRain, HelpCircle, CreditCard, ChevronDown } from 'lucide-react';

// ── Q-Commerce platforms only ────────────────────────────────────────────────
const PLATFORMS = ['Zepto', 'Blinkit', 'Instamart', 'Dunzo'];
const ZONES     = ['Central', 'North', 'South', 'East', 'West', 'Suburbs'];



// ── Main Auth Page ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [tab, setTab]   = useState('login');
  const [showAuth, setShowAuth] = useState(false);
  const [step, setStep] = useState('phone');
  const [loading, setLoading]     = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [phone, setPhone]   = useState('');
  const [otp, setOtp]       = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [geoCity, setGeoCity] = useState(null);
  const [form, setForm] = useState({
    name: '', phone: '', platform: 'Zepto', platform_id: '',
    city: 'Mumbai', zone: 'Central', avg_weekly_income: 3500,
  });

  const { login }  = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const toast      = useToast();

  // Listen for route changes to toggle modal
  useEffect(() => {
    if (location.pathname === '/login') {
      setTab('login');
      setStep('phone');
      setShowAuth(true);
    } else if (location.pathname === '/signup') {
      setTab('register');
      setShowAuth(true);
    } else if (location.pathname === '/') {
      setShowAuth(false);
    }
  }, [location.pathname]);

  // Auto-detect city on mount
  useEffect(() => {
    setGeoLoading(true);
    detectCity().then(city => {
      setGeoLoading(false);
      if (city) { setGeoCity(city); setForm(f => ({ ...f, city })); toast.info(`📍 Location detected: ${city}`); }
    }).catch(() => setGeoLoading(false));
  }, []);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

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
    if (!otp) return toast.error('Enter your OTP');
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
    if (!form.name || !form.phone || !form.platform_id) return toast.error('Name, phone and Worker ID are required');
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav style={{ padding: '1.75rem clamp(1rem, 5vw, 3rem)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-base)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-green)' }}><Shield size={26} /></div>
          ShramInsure
        </div>
        <div className="hide-mobile" style={{ display: 'flex', gap: '2.5rem', alignItems: 'center', fontSize: '0.9rem', fontWeight: 600 }}>
          <a href="#product" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Product</a>
          <a href="#faq" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>FAQ</a>
        </div>
      </nav>

      {/* ── Main Hero Section ─────────────────────────────────────────────────── */}
      <main style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        padding: '6rem 1.5rem', 
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        minHeight: '80vh'
      }}>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap-reverse', 
          alignItems: 'center', 
          gap: '3rem',
          width: '100%'
        }}>
          {/* Left: Text Content */}
          <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h1" style={{ 
              fontFamily: 'var(--font-serif)', 
              marginBottom: '1.5rem', 
              color: 'var(--text-primary)',
              letterSpacing: '-0.035em',
              fontWeight: 900,
              maxWidth: '800px'
            }}>
              Protect your daily earnings. <span style={{ color: 'var(--accent-green)' }}>Automatically.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '1.1rem', 
              maxWidth: '500px', 
              lineHeight: 1.6, 
              marginBottom: '2.5rem',
              fontWeight: 400,
              opacity: 0.9
            }}>
              A premium protection platform for India's gig economy. We secure your income against harsh weather, platform outages, and external disruptions.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'flex', gap: '1rem', width: '100%', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
                Protect My Income
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => navigate('/login')}>
                Log in
              </button>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
            <img 
              src="/hero-delivery.png" 
              alt="Delivery worker" 
              style={{ 
                width: '100%', 
                maxWidth: '500px',
                height: 'auto',
                objectFit: 'contain'
              }} 
            />
          </motion.div>
        </div>
      </main>

      {/* ── Product Section ────────────────────────────────────────────────── */}
      <section id="product" style={{ padding: '8rem 1.5rem', background: 'linear-gradient(180deg, var(--bg-base) 0%, rgba(31, 73, 89, 0.2) 100%)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <h2 className="h2" style={{ fontFamily: 'var(--font-serif)', marginBottom: '1.5rem' }}>Engineered for Reliability</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>
              Traditional insurance is slow and manual. ShramInsure is built for the high-speed world of delivery platforms with real-time parametric triggers.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            {[
              { icon: CloudRain, title: 'Extreme Weather', desc: 'Automatic payouts during heavy rain, extreme heatwaves, or severe cold alerts.' },
              { icon: Zap, title: 'Platform Stability', desc: 'Protection against earnings loss during unexpected app outages or server downtime.' },
              { icon: CreditCard, title: 'Instant UPI Payouts', desc: 'No paperwork. Claims are triggered by data and paid instantly to your UPI wallet.' },
              { icon: Umbrella, title: 'Flexible Coverage', desc: 'Choose protection that matches your work hours. Pay-as-you-go starting from ₹10/week.' },
            ].map((feature, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="card professional-card" style={{ padding: '2.5rem 2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'var(--accent-green)', marginBottom: '1.5rem' }}><feature.icon size={32} strokeWidth={1.5} /></div>
                <h3 className="h3" style={{ marginBottom: '1rem' }}>{feature.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Section ───────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: '8rem 1.5rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 className="h2" style={{ fontFamily: 'var(--font-serif)', marginBottom: '1rem' }}>Frequently Asked Questions</h2>
            <p style={{ color: 'var(--text-muted)' }}>Everything you need to know about your protection plan.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {[
              { q: 'How does ShramInsure know when to pay me?', a: 'We monitor real-time weather data from certified stations and platform status APIs. If conditions meet the parametric threshold, your payout is triggered automatically.' },
              { q: 'How do I withdraw my earnings?', a: 'Once a payout is triggered, it reflects in your ShramInsure wallet. You can withdraw it instantly to any UPI-linked bank account.' },
              { q: 'Which platforms are supported?', a: 'We currently support major Q-Commerce platforms like Zepto, Blinkit, Instamart, and Dunzo.' },
              { q: 'Is there a minimum policy duration?', a: 'No. ShramInsure offers absolute flexibility—you can subscribe for as little as a single day or a whole week.' },
            ].map((faq, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', color: 'var(--text-primary)' }}>
                  <HelpCircle size={20} style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: '2px' }} />
                  {faq.q}
                </div>
                <div style={{ color: 'var(--text-muted)', paddingLeft: '2.25rem', lineHeight: 1.6 }}>{faq.a}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ padding: '4rem 1.5rem', textAlign: 'center', borderTop: '1px solid var(--border)', opacity: 0.6, fontSize: '0.85rem' }}>
        &copy; 2026 ShramInsure. Protecting India's Gig Workforce.
      </footer>

      {/* ── Form Modal (Auth Section) ───────────────────────────────────────────────────── */}
      {showAuth && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(1, 20, 37, 0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className={`auth-sliding-container ${tab === 'register' ? 'right-panel-active' : ''}`}>
            <button 
              onClick={() => navigate('/')}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', zIndex: 1000 }}
            ><X size={20} /></button>

            {/* REGISTER CONTAINER (SIGN UP) */}
            <div className="form-container sign-up-container">
              <div className="form-container-inner">
                {/* Mobile Tab Switcher */}
                <div className="mobile-tab-switcher">
                  <button onClick={() => { setTab('login'); setStep('phone'); setOtp(''); }} className="tab-btn"><Key size={16} /> Login</button>
                  <button className="tab-btn active"><UserPlus size={16} /> Register</button>
                </div>

                <div className="h3 mb-4 show-desktop">Create Account</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.75rem', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.18)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                  <div style={{ color: 'var(--accent-green)' }}><Bike size={20} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '.8rem' }}>Gig Delivery Worker</div>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>Income Loss Protection</div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label"><User size={13} /> Full Name</label>
                  <input className="input" placeholder="Enter name" value={form.name}
                    onChange={e => f('name', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="label"><Smartphone size={13} /> Phone</label>
                  <input className="input" placeholder="10-digit mobile" value={form.phone} maxLength={10}
                    onChange={e => f('phone', e.target.value.replace(/\D/g, ''))} />
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="label"><Building2 size={13} /> Platform</label>
                    <select className="input" value={form.platform} onChange={e => f('platform', e.target.value)}>
                      {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label"><IdCard size={13} /> Worker ID</label>
                    <input className="input" placeholder="Worker ID" value={form.platform_id}
                      onChange={e => f('platform_id', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-2">
                  <CitySelect value={form.city} onChange={c => f('city', c)} label="City" geoCity={geoCity} geoLoading={geoLoading} />
                  <div className="form-group">
                    <label className="label"><MapPin size={13} /> Zone</label>
                    <select className="input" value={form.zone} onChange={e => f('zone', e.target.value)}>
                      {ZONES.map(z => <option key={z}>{z}</option>)}
                    </select>
                  </div>
                </div>

                <button className="btn btn-primary btn-block btn-lg mt-4" onClick={handleRegister} disabled={loading}>
                  {loading ? <><span className="spinner" /> Creating...</> : '🚀 Create Account'}
                </button>
              </div>
            </div>

            {/* LOGIN CONTAINER (SIGN IN) */}
            <div className="form-container sign-in-container">
              <div className="form-container-inner">
                {/* Mobile Tab Switcher */}
                <div className="mobile-tab-switcher">
                  <button className="tab-btn active"><Key size={16} /> Login</button>
                  <button onClick={() => { setTab('register'); setStep('phone'); setOtp(''); }} className="tab-btn"><UserPlus size={16} /> Register</button>
                </div>

                <h2 className="h2 mb-6 show-desktop" style={{ textAlign: 'center' }}>Welcome Back</h2>
                
                <div style={{ background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.18)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '2rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '.3rem', fontSize: '.8rem' }}>Demo Access</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Worker: <code style={{ color: 'var(--accent-green)' }}>9876543210</code><br/>
                    Admin: <code style={{ color: 'var(--accent-purple)' }}>9999999999</code>
                  </div>
                </div>

                {step === 'phone' ? (
                  <>
                    <div className="form-group">
                      <label className="label"><Smartphone size={13} /> Mobile Number</label>
                      <input className="input" placeholder="Enter mobile number" value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} maxLength={10}
                        onKeyDown={e => e.key === 'Enter' && handleRequestOtp()} autoFocus />
                    </div>
                    <button className="btn btn-primary btn-block btn-lg" onClick={handleRequestOtp} disabled={loading || phone.length !== 10}>
                      {loading ? <><span className="spinner" /> Sending...</> : '📲 Get OTP'}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Enter OTP for <strong>{phone}</strong></div>
                      {demoOtp && <div style={{ color: 'var(--accent-green)', fontWeight: 800, marginTop: '0.25rem' }}>Demo OTP: {demoOtp}</div>}
                    </div>
                    <div className="form-group">
                      <label className="label"><Key size={13} /> OTP</label>
                      <input className="input" placeholder="••••••" value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus
                        style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setStep('phone'); setOtp(''); }}>Back</button>
                      <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleLogin} disabled={loading || otp.length < 4}>
                        {loading ? '...' : '✅ Login'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* OVERLAY CONTAINER */}
            <div className="overlay-container">
              <div className="overlay">
                <div className="overlay-panel overlay-left">
                  <h2 className="h1 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>Welcome Back!</h2>
                  <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>To keep connected with us please login with your personal info</p>
                  <button className="ghost-btn" onClick={() => { setTab('login'); setStep('phone'); setOtp(''); }}>SIGN IN</button>
                </div>
                <div className="overlay-panel overlay-right">
                  <h2 className="h1 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>Hello, Friend!</h2>
                  <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>Enter your details and start your journey with us</p>
                  <button className="ghost-btn" onClick={() => { setTab('register'); setStep('phone'); setOtp(''); }}>SIGN UP</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      <style>{`
        .auth-sliding-container {
          background-color: var(--bg-base);
          border-radius: 16px;
          border: 1px solid var(--border);
          position: relative;
          overflow: hidden;
          width: 900px;
          max-width: 100%;
          min-height: 600px;
          box-shadow: var(--shadow-lg);
        }

        .form-container {
          position: absolute;
          top: 0;
          height: 100%;
          transition: all 0.6s ease-in-out;
        }

        .form-container-inner {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 2rem 3.5rem;
          overflow-y: auto;
        }

        .sign-in-container { left: 0; width: 50%; z-index: 2; }
        .auth-sliding-container.right-panel-active .sign-in-container { transform: translateX(100%); opacity: 0; }
        .sign-up-container { left: 0; width: 50%; opacity: 0; z-index: 1; }
        .auth-sliding-container.right-panel-active .sign-up-container { transform: translateX(100%); opacity: 1; z-index: 5; animation: show 0.6s; }

        @keyframes show { 0%, 49.99% { opacity: 0; z-index: 1; } 50%, 100% { opacity: 1; z-index: 5; } }

        .overlay-container {
          position: absolute;
          top: 0;
          left: 50%;
          width: 50%;
          height: 100%;
          overflow: hidden;
          transition: transform 0.6s ease-in-out;
          z-index: 100;
        }

        .auth-sliding-container.right-panel-active .overlay-container { transform: translateX(-100%); }

        .overlay {
          background: var(--grad-blue);
          color: #FFFFFF;
          position: absolute;
          left: -100%;
          height: 100%;
          width: 200%;
          transform: translateX(0);
          transition: transform 0.6s ease-in-out;
        }

        .auth-sliding-container.right-panel-active .overlay { transform: translateX(50%); }

        .overlay-panel {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 0 40px;
          text-align: center;
          top: 0;
          height: 100%;
          width: 50%;
          transform: translateX(0);
          transition: transform 0.6s ease-in-out;
        }

        .overlay-left { transform: translateX(-20%); }
        .auth-sliding-container.right-panel-active .overlay-left { transform: translateX(0); }
        .overlay-right { right: 0; transform: translateX(0); }
        .auth-sliding-container.right-panel-active .overlay-right { transform: translateX(20%); }

        .ghost-btn {
          background: transparent;
          border: 1px solid #fff;
          color: #fff;
          padding: 0.75rem 2rem;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        .ghost-btn:hover { background: rgba(255,255,255,0.1); }

        .mobile-tab-switcher { display: none; gap: 4px; padding: 4px; background: var(--bg-card); border-radius: 12px; margin-bottom: 1.5rem; }
        .tab-btn { flex: 1; padding: 0.6rem; border: none; background: transparent; color: var(--text-muted); font-weight: 600; border-radius: 8px; cursor: pointer; display: flex; alignItems: center; justifyContent: center; gap: 8px; }
        .tab-btn.active { background: var(--grad-green); color: #fff; }

        @media (max-width: 800px) {
          .overlay-container { display: none; }
          .form-container { width: 100%; position: relative; }
          .auth-sliding-container { min-height: auto; max-width: 480px; width: 100%; }
          .form-container-inner { padding: 1.5rem; }
          .mobile-tab-switcher { display: flex; }
          .auth-sliding-container.right-panel-active .sign-in-container,
          .auth-sliding-container.right-panel-active .sign-up-container,
          .auth-sliding-container .sign-in-container,
          .auth-sliding-container .sign-up-container { 
            position: relative; 
            transform: none !important; 
            opacity: 1 !important; 
            visibility: visible !important;
            display: none;
          }
          .auth-sliding-container:not(.right-panel-active) .sign-in-container { display: block; }
          .auth-sliding-container.right-panel-active .sign-up-container { display: block; }
        }
      `}</style>
    </div>
  );
}
