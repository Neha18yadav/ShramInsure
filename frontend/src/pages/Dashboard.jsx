// src/pages/Dashboard.jsx — Worker Dashboard with Live Risk, Event Banner, AI Explainability
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { analytics, risk, claims, predict, admin as adminApi } from '../utils/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Banknote, ShieldCheck, Wallet, ClipboardList, Shield, 
  History, CloudRain, ThermometerSun, Wind, Waves, 
  RefreshCw, Zap, TrendingUp, TrendingDown, 
  Settings, AlertTriangle, CheckCircle2, BadgeInfo, Info,
  ShieldAlert, Brain, Target
} from 'lucide-react';

// ── Risk color helper ─────────────────────────────────────────────────────────
const riskColor = (score) =>
  score > 0.65 ? 'var(--accent-rose)' : score > 0.35 ? 'var(--accent-amber)' : 'var(--accent-green)';
const riskLabel = (score) =>
  score > 0.65 ? 'HIGH RISK TODAY' : score > 0.35 ? 'MODERATE RISK' : '✅ SAFE ZONE';
const riskGradient = (score) =>
  score > 0.65 ? 'linear-gradient(135deg,#f43f5e,#ef4444)'
  : score > 0.35 ? 'linear-gradient(135deg,#f59e0b,#f97316)'
  : 'linear-gradient(135deg,#10b981,#059669)';

const fmt    = n => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const pct    = n => n != null ? `${Number(n).toFixed(1)}%` : '—';

// ── AQI label ─────────────────────────────────────────────────────────────────
const aqiLabel = (aqi) =>
  aqi < 50  ? { t: 'Good',     c: '#10b981' } :
  aqi < 100 ? { t: 'Moderate', c: '#f59e0b' } :
  aqi < 150 ? { t: 'Unhealthy (Sensitive)', c: '#f97316' } :
  aqi < 200 ? { t: 'Unhealthy', c: '#ef4444' } :
  aqi < 300 ? { t: 'Very Unhealthy', c: '#a855f7' } :
              { t: 'Hazardous 🚨', c: '#f43f5e' };

const getBrandClass = (platform) => {
  if (!platform || typeof platform !== 'string') return 'brand-generic';
  const p = platform.toLowerCase();
  if (p.includes('zepto'))     return 'brand-zepto';
  if (p.includes('blinkit'))    return 'brand-blinkit';
  if (p.includes('instamart')) return 'brand-instamart';
  if (p.includes('dunzo'))     return 'brand-dunzo';
  return 'brand-generic';
};

const BrandTag = ({ platform }) => {
  const cls = getBrandClass(platform);
  return <span className={`brand-tag ${cls}`} style={{ marginLeft: '8px' }}>{platform}</span>;
};

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [data,    setData]    = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [env,     setEnv]     = useState(null);
  const [pred,    setPred]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [events,  setEvents]  = useState([]); // live event banners
  const [scanBusy, setScanBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());

  const load = useCallback(async () => {
    try {
      if (user?.is_admin) {
        const [ad, ins] = await Promise.all([
          analytics.dashboard(),
          adminApi.insights()
        ]);
        setData(ad); // using stats/summary from this
        setPred(ins); // using businessKPIs from this
      } else {
        const [wd, rd, ev] = await Promise.all([
          analytics.worker(),
          risk.calculate({}),
          claims.environment({ city: user?.city || 'Mumbai' }),
        ]);
        setData(wd);
        setRiskData(rd);
        setEnv(ev);
        if (ev?.alerts?.length) setEvents(ev.alerts);
        predict.weekly().then(p => setPred(p)).catch(() => {});
      }
      setLastSync(new Date());
    } catch (e) {
      toast.error('Dashboard load failed: ' + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 90 seconds
  useEffect(() => {
    const iv = setInterval(() => load(), 90000);
    return () => clearInterval(iv);
  }, [load]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await load();
    toast.success('Live conditions updated from API');
  };

  const runScan = async () => {
    setScanBusy(true);
    try {
      const r = await claims.triggerCheck({ city: user?.city || 'Mumbai', zone: user?.zone || 'Central' });
      if (r.newClaims?.length > 0) {
        toast.success(`🚨 ${r.newClaims.length} auto-claim(s) triggered! Payouts processing…`);
        await refreshUser();
        load();
      } else {
        toast.info('No active parametric triggers in your city right now.');
      }
    } catch (e) { toast.error(e.message); }
    setScanBusy(false);
  };

  if (loading) return <DashboardSkeleton />;

  if (user?.is_admin) {
    const summary = data?.summary || {};
    const kpis    = pred?.businessKPIs || {};
    const health  = data?.scheduler || {};

    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Command Center</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Network Performance & Business KPIs</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontWeight: 700 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', animation: 'livePulse 1s ease infinite' }} />
              System Online
            </div>
          </div>
        </div>

        <div className="grid grid-4">
          <StatCard icon={Banknote} label="Total Revenue" value={fmt(summary.totalRevenue)} color="var(--accent-green)" sub="Gross premiums" />
          <StatCard icon={TrendingDown} label="Loss Ratio" value={pct((kpis.lossRatio||0)*100)} color={kpis.lossRatio > 0.65 ? 'var(--accent-rose)' : 'var(--accent-green)'} sub="Target: < 65%" />
          <StatCard icon={ShieldCheck} label="Active Policies" value={summary.activePolicies || 0} color="var(--accent-blue)" sub="Insured workers" />
          <StatCard icon={Zap} label="Automation" value={pct(kpis.automationRate)} color="var(--accent-purple)" sub="Zero-touch claims" />
        </div>

        <div className="grid grid-2">
          <div className="card">
            <h3 style={{ fontWeight: 800, fontSize: '.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} className="text-purple" /> Infrastructure Health
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-card2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '.5rem', fontWeight: 700 }}>Scheduler Engine</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800 }}>Last Run: {health.lastRunAt ? new Date(health.lastRunAt).toLocaleTimeString() : 'Never'}</div>
                  <span className="badge badge-green">ACTIVE</span>
                </div>
                <div style={{ marginTop: '.75rem', display: 'flex', gap: '1.5rem' }}>
                  <div><div style={{ fontSize: '1rem', fontWeight: 800 }}>{health.totalClaimsAuto || 0}</div><div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>AUTO-CLAIMS</div></div>
                  <div><div style={{ fontSize: '1rem', fontWeight: 800 }}>{health.totalPayoutsAuto || 0}</div><div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>AUTO-PAYOUTS</div></div>
                </div>
              </div>
              <button onClick={() => navigate('/admin?tab=fraud')} className="btn btn-outline btn-block">View System Logs</button>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontWeight: 800, fontSize: '.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} className="text-rose" /> Quick Actions
            </h3>
            <div className="grid grid-2" style={{ gap: '1rem' }}>
              {[
                { l: 'Run Scheduler', i: RefreshCw, c: 'var(--accent-blue)', t: '/admin' },
                { l: 'Fraud Alerts',  i: ShieldAlert, c: 'var(--accent-rose)', t: '/admin?tab=fraud' },
                { l: 'View Predictions', i: Brain, c: 'var(--accent-purple)', t: '/admin?tab=predictions' },
                { l: 'Disruption Lab', i: Target, c: 'var(--accent-amber)', t: '/admin?tab=lab' }
              ].map(a => (
                <button key={a.l} onClick={() => navigate(a.t)} className="card" style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                  gap: '14px', padding: '1.5rem', background: 'var(--bg-base)', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'all .25s cubic-bezier(.4, 0, .2, 1)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ padding: '12px', background: `${a.c}0a`, borderRadius: '12px', color: a.c, border: `1px solid ${a.c}1a` }}>
                    <a.i size={22} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-primary)' }}>{a.l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const policy       = data?.activePolicy;
  const stats        = data?.stats || {};
  const riskScore    = riskData?.riskScore || user?.risk_score || 0.5;
  const walletBal    = parseFloat(user?.wallet_balance || 0);
  const earningsProt = policy ? parseFloat(policy.coverage_amount) * 4 : 0;
  const weather      = env?.weather;
  const aqi          = env?.aqi;
  const aqiInfo      = aqiLabel(aqi?.aqi || 0);

  // Check active triggers
  const activeTriggers = env?.triggers?.filter(t => t.breached) || [];

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Live Event Banner ──────────────────────────────────────────────── */}
      {activeTriggers.length > 0 && activeTriggers.map(t => (
        <div key={t.type} style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '.85rem 1.25rem',
          background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.3)',
          borderRadius: 'var(--radius-md)', animation: 'pulse 2s ease infinite',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f43f5e', flexShrink: 0, animation: 'livePulse 1s ease infinite' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#ef4444', marginBottom: '.1rem' }}>🚨 LIVE EVENT DETECTED: {t.label} in {user?.city}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '.82rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <span>→ {t.value}{t.unit} (threshold: {t.threshold}{t.unit})</span>
              <span>→ Claim processing</span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>→ ₹ credited</span>
            </div>
          </div>
          <span className="badge badge-rose" style={{ fontSize: '.65rem' }}>AUTO-TRIGGERING</span>
        </div>
      ))}

      {/* ── Header Row ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '.15rem' }}>
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', display: 'flex', alignItems: 'center' }}>
            <BrandTag platform={user?.platform} />
            <span style={{ marginLeft: '8px' }}>· {user?.city}, {user?.zone} · Q-Commerce Delivery Worker</span>
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={runScan} disabled={scanBusy}>
          {scanBusy ? <><span className="spinner" style={{ width: '1rem', height: '1rem' }} /> Scanning…</> : '🔍 Check Live Triggers'}
        </button>
      </div>

      {/* ── Risk Indicator (WOW feature) ───────────────────────────────────── */}
      <div style={{
        padding: '1.4rem 1.6rem',
        background: `${riskGradient(riskScore)}, var(--bg-card)`,
        backgroundBlendMode: 'soft-light',
        border: `1px solid ${riskColor(riskScore)}40`,
        borderRadius: 'var(--radius-lg)',
        display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: riskGradient(riskScore), opacity: .06, pointerEvents: 'none' }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginBottom: '.3rem', fontWeight: 600 }}>AI RISK INDICATOR</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: riskColor(riskScore), lineHeight: 1 }}>
            {riskLabel(riskScore)}
          </div>
          <div style={{ marginTop: '.6rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            {riskData?.explanation?.slice(0, 2).map((e, i) => (
              <span key={i} style={{ fontSize: '.7rem', padding: '.2rem .55rem', background: `${riskColor(riskScore)}18`, border: `1px solid ${riskColor(riskScore)}30`, borderRadius: 99, color: 'var(--text-secondary)' }}>{e}</span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 120 }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: riskColor(riskScore) }}>{Math.round(riskScore * 100)}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Risk Score / 100</div>
          <div className="risk-bar-track" style={{ marginTop: '.5rem', width: 120 }}>
            <div className="risk-bar-fill" style={{ width: `${riskScore * 100}%`, background: riskGradient(riskScore) }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', minWidth: 160 }}>
          <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>AI FACTORS</div>
          {riskData?.featureBreakdown && Object.entries(riskData.featureBreakdown).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)', width: 75, flexShrink: 0 }}>{k.replace('Score','')}</div>
              <div style={{ flex: 1, height: 4, background: 'var(--bg-card2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((v / 0.30) * 100, 100)}%`, height: '100%', background: riskGradient(riskScore), borderRadius: 99, transition: 'width .6s' }} />
              </div>
              <div style={{ fontSize: '.68rem', color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>{Math.round(v * 100)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-4">
        <StatCard icon={Banknote} label="Weekly Premium" value={`₹${policy?.weekly_premium || '—'}`} sub="Income loss cover" color="#10b981" />
        <StatCard icon={ShieldCheck} label="Earnings Protected" value={`₹${earningsProt.toLocaleString('en-IN')}`} sub="4-week coverage" color="#6366f1" />
        <StatCard icon={Wallet} label="Total Received" value={`₹${(stats.totalPayout || 0).toLocaleString('en-IN')}`} sub="Auto-payouts to UPI" color="#8b5cf6" />
        <StatCard icon={ClipboardList} label="Total Claims" value={stats.total || 0} sub={`${stats.paid || 0} paid · ${stats.pending || 0} pending`} color="#f59e0b" />
      </div>

      <div className="grid grid-2">

        {/* ── Active Policy ─────────────────────────────────────────────── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} className="text-green" /> Active Policy
            </h3>
            {policy && <span className={`badge badge-${policy.status === 'active' ? 'green' : 'amber'}`}>{policy.status.toUpperCase()}</span>}
          </div>
          {policy ? (
            <>
              <div className="grid grid-2" style={{ gap: '.85rem', marginBottom: '1.25rem' }}>
                {[
                  { l: 'Policy No.', v: policy.policy_number },
                  { l: 'Coverage Type', v: 'Income Loss' },
                  { l: 'Weekly Premium', v: `₹${policy.weekly_premium}` },
                  { l: 'Weekly Coverage', v: `₹${policy.coverage_amount}` },
                  { l: 'City', v: `${policy.city} · ${policy.zone}` },
                  { l: 'Expires', v: new Date(policy.end_date).toLocaleDateString('en-IN') },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: '.1rem' }}>{l}</div>
                    <div style={{ fontSize: '.85rem', fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Earnings protection meter */}
              <div style={{ marginTop: '.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: '.5rem', fontWeight: 600 }}>
                  <span>Earnings Protection Meter</span>
                  <span style={{ color: 'var(--accent-green)' }}>{Math.round((walletBal / Math.max(earningsProt, 1)) * 100)}% utilized</span>
                </div>
                <div className="risk-bar-track" style={{ height: '12px', background: 'rgba(255,255,255,0.05)' }}>
                  <div className="risk-bar-fill" style={{ 
                    width: `${Math.min((walletBal / Math.max(earningsProt, 1)) * 100, 100)}%`, 
                    background: 'linear-gradient(90deg, #10b981, #059669)',
                    boxShadow: '0 0 15px rgba(16,185,129,0.3)'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', marginTop: '.5rem' }}>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>₹{walletBal.toLocaleString('en-IN')} received</span>
                  <span style={{ color: 'var(--text-secondary)' }}>of ₹{earningsProt.toLocaleString('en-IN')} max</span>
                </div>
              </div>

              {/* Trust indicators */}
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.85rem', flexWrap: 'wrap' }}>
                {['Zero paperwork', 'Instant payout', 'AI verified', '100% automated'].map(t => (
                  <span key={t} style={{ fontSize: '.65rem', padding: '.2rem .55rem', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 99, color: 'var(--accent-green)' }}>✓ {t}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', opacity: 0.5 }}><Shield size={48} strokeWidth={1.5} /></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', marginBottom: '1rem' }}>No active policy</p>
              <a href="/policies" className="btn btn-primary btn-sm">Get Weekly Cover</a>
            </div>
          )}
        </div>

        {/* ── Live Environment ──────────────────────────────────────────── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '.1rem' }}>🌍 Live Conditions · {user?.city}</h3>
              <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>
                Synced: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
              <button 
                className="btn btn-sm btn-outline" 
                onClick={handleManualRefresh} 
                disabled={refreshing}
                style={{ padding: '.25rem .5rem', fontSize: '.75rem' }}
              >
                {refreshing ? '...' : '🔄 Sync'}
              </button>
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: '.85rem', marginBottom: '1.25rem' }}>
            <EnvCard icon={CloudRain} label="Rainfall" value={`${weather?.rainfall ?? '—'} mm/hr`} threshold="65 mm/hr" breached={(weather?.rainfall || 0) > 65} />
            <EnvCard icon={ThermometerSun} label="Temperature" value={`${weather?.temp ?? '—'}°C`} threshold="42°C" breached={(weather?.temp || 0) > 42} />
            <EnvCard icon={Wind} label="Wind Speed" value={`${weather?.windSpeed ?? '—'} km/h`} threshold="50 km/h" breached={(weather?.windSpeed || 0) > 50} />
            <EnvCard icon={Waves} label="AQI" value={`${aqi?.aqi ?? '—'}`} threshold="200 AQI" breached={(aqi?.aqi || 0) > 200}
              sub={<span style={{ color: aqiInfo.c, fontSize: '.68rem', fontWeight: 600 }}>{aqiInfo.t}</span>} />
          </div>

          {/* AI Explainability */}
          {activeTriggers.length > 0 && (
            <div style={{ padding: '.7rem .9rem', background: 'rgba(244,63,94,.06)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--accent-rose)', marginBottom: '.4rem' }}>🤖 AI Decision Explanation</div>
              {activeTriggers.map(t => (
                <div key={t.type} style={{ fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  ✅ Claim triggered because <strong style={{ color: 'var(--text-primary)' }}>{t.label}</strong> exceeded threshold ({t.threshold}{t.unit})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 7-Day Prediction Chart ─────────────────────────────────────────── */}
      {pred?.weekly?.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '.95rem' }}>📈 7-Day Prediction Chart</h3>
            <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Powered by ShramAI v2.0</span>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pred.weekly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: '.8rem' }} labelStyle={{ color: '#94a3b8' }} />
                <Area type="monotone" dataKey="riskScore" name="Risk" stroke="#f43f5e" fill="url(#riskGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Recent Claims ──────────────────────────────────────────────────── */}
      {data?.recentClaims?.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} className="text-amber" /> Recent Claims
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
            {data.recentClaims.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '.3rem', color: 'var(--text-primary)' }}>{c.trigger_type?.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{c.claim_number} · {new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: c.status === 'paid' ? 'var(--accent-green)' : 'var(--text-primary)' }}>₹{c.payout_amount}</div>
                  <span className={`badge badge-${c.status === 'paid' ? 'green' : c.status === 'rejected' ? 'rose' : 'amber'}`} style={{ fontSize: '.65rem', marginTop: '.2rem' }}>{c.status.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.6)} }
        @keyframes pulse { 0%,100%{border-color:rgba(244,63,94,.3)} 50%{border-color:rgba(244,63,94,.7)} }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `4px solid ${color}80` }}>
      <div className="stat-icon" style={{ background: `${color}15`, color }}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function EnvCard({ icon: Icon, label, value, threshold, breached, sub }) {
  return (
    <div style={{
      padding: '.8rem 1rem', borderRadius: 'var(--radius-md)',
      background: breached ? 'rgba(244,63,94,.08)' : 'var(--bg-card2)',
      border: `1px solid ${breached ? 'rgba(244,63,94,0.4)' : 'var(--border2)'}`,
      display: 'flex', flexDirection: 'column', gap: '2px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.72rem', color: 'var(--text-secondary)', marginBottom: '.2rem' }}>
        <Icon size={14} strokeWidth={2.5} />
        <span style={{ fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: breached ? 'var(--accent-rose)' : 'var(--text-primary)', marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '.68rem', color: breached ? 'var(--accent-rose)' : 'var(--text-secondary)', fontWeight: 500 }}>
        {breached ? '⚠️ THRESHOLD BREACHED' : `Safe under ${threshold}`}
      </div>
      {sub && <div style={{ marginTop: '.2rem' }}>{sub}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-md)' }} />
      <div className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 260, borderRadius: 'var(--radius-lg)' }} />)}
      </div>
    </div>
  );
}
