// src/pages/Dashboard.jsx — Worker Dashboard with Live Risk, Event Banner, AI Explainability
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { analytics, risk, claims, predict } from '../utils/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ── Risk color helper ─────────────────────────────────────────────────────────
const riskColor = (score) =>
  score > 0.65 ? 'var(--accent-rose)' : score > 0.35 ? 'var(--accent-amber)' : 'var(--accent-green)';
const riskLabel = (score) =>
  score > 0.65 ? 'HIGH RISK TODAY' : score > 0.35 ? 'MODERATE RISK' : '✅ SAFE ZONE';
const riskGradient = (score) =>
  score > 0.65 ? 'linear-gradient(135deg,#f43f5e,#ef4444)'
  : score > 0.35 ? 'linear-gradient(135deg,#f59e0b,#f97316)'
  : 'linear-gradient(135deg,#10b981,#059669)';

// ── AQI label ─────────────────────────────────────────────────────────────────
const aqiLabel = (aqi) =>
  aqi < 50  ? { t: 'Good',     c: '#10b981' } :
  aqi < 100 ? { t: 'Moderate', c: '#f59e0b' } :
  aqi < 150 ? { t: 'Unhealthy (Sensitive)', c: '#f97316' } :
  aqi < 200 ? { t: 'Unhealthy', c: '#ef4444' } :
  aqi < 300 ? { t: 'Very Unhealthy', c: '#a855f7' } :
              { t: 'Hazardous 🚨', c: '#f43f5e' };

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [data,    setData]    = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [env,     setEnv]     = useState(null);
  const [pred,    setPred]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [events,  setEvents]  = useState([]); // live event banners
  const [scanBusy, setScanBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [wd, rd, ev] = await Promise.all([
        analytics.worker(),
        risk.calculate({}),
        claims.environment({ city: user?.city || 'Mumbai' }),
      ]);
      setData(wd);
      setRiskData(rd);
      setEnv(ev);

      // Check for live alerts
      if (ev?.alerts?.length) setEvents(ev.alerts);

      // Predictions
      predict.weekly().then(p => setPred(p)).catch(() => {});
    } catch (e) {
      toast.error('Dashboard load failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 90 seconds
  useEffect(() => {
    const iv = setInterval(() => load(), 90000);
    return () => clearInterval(iv);
  }, [load]);

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
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚙️</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '.5rem' }}>Admin Control Panel</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2rem' }}>
            Monitor system performance and risk analytics
          </p>
          <a href="/admin" className="btn btn-primary btn-lg">Go to Admin Insights 📊</a>
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
            <span style={{ fontWeight: 700, color: '#f43f5e' }}>🚨 {t.label} Detected in {user?.city}</span>
            <span style={{ marginLeft: '.75rem', color: 'var(--text-secondary)', fontSize: '.82rem' }}>
              {t.value}{t.unit} (threshold: {t.threshold}{t.unit}) · Auto-claim processing
            </span>
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem' }}>
            {user?.platform} · {user?.city}, {user?.zone} · Q-Commerce Delivery Worker
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }} className="dash-stats">
        <StatCard icon="💰" label="Weekly Premium" value={`₹${policy?.weekly_premium || '—'}`} sub="Income loss cover" color="var(--accent-green)" />
        <StatCard icon="🛡️" label="Earnings Protected" value={`₹${earningsProt.toLocaleString('en-IN')}`} sub="4-week coverage" color="var(--accent-blue)" />
        <StatCard icon="💸" label="Total Received" value={`₹${(stats.totalPayout || 0).toLocaleString('en-IN')}`} sub="Auto-payouts to UPI" color="var(--accent-purple)" />
        <StatCard icon="📋" label="Total Claims" value={stats.total || 0} sub={`${stats.paid || 0} paid · ${stats.pending || 0} pending`} color="var(--accent-amber)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="dash-mid">

        {/* ── Active Policy ─────────────────────────────────────────────── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '.95rem' }}>🛡️ Active Policy</h3>
            {policy && <span className={`badge badge-${policy.status === 'active' ? 'green' : 'amber'}`}>{policy.status.toUpperCase()}</span>}
          </div>
          {policy ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem', marginBottom: '1rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.35rem' }}>
                  <span>Earnings Protection Meter</span>
                  <span>{Math.round((walletBal / Math.max(earningsProt, 1)) * 100)}% utilized</span>
                </div>
                <div className="risk-bar-track">
                  <div className="risk-bar-fill" style={{ width: `${Math.min((walletBal / Math.max(earningsProt, 1)) * 100, 100)}%`, background: 'var(--grad-blue)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', marginTop: '.3rem' }}>
                  <span style={{ color: 'var(--accent-blue)' }}>₹{walletBal.toLocaleString('en-IN')} received</span>
                  <span style={{ color: 'var(--text-muted)' }}>of ₹{earningsProt.toLocaleString('en-IN')} max</span>
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
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📋</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', marginBottom: '1rem' }}>No active policy</p>
              <a href="/policies" className="btn btn-primary btn-sm">Get Weekly Cover</a>
            </div>
          )}
        </div>

        {/* ── Live Environment ──────────────────────────────────────────── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '.95rem' }}>🌍 Live Conditions · {user?.city}</h3>
            <span className="badge badge-gray" style={{ fontSize: '.62rem' }}>{weather?.source === 'openweathermap' ? '🟢 Live API' : '🟡 Mock'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem', marginBottom: '1rem' }}>
            <EnvCard label="🌧️ Rainfall" value={`${weather?.rainfall ?? '—'} mm/hr`} threshold="65 mm/hr" breached={(weather?.rainfall || 0) > 65} />
            <EnvCard label="🌡️ Temperature" value={`${weather?.temp ?? '—'}°C`} threshold="42°C" breached={(weather?.temp || 0) > 42} />
            <EnvCard label="💨 Wind Speed" value={`${weather?.windSpeed ?? '—'} km/h`} threshold="50 km/h" breached={(weather?.windSpeed || 0) > 50} />
            <EnvCard label="🌫️ AQI" value={`${aqi?.aqi ?? '—'}`} threshold="200 AQI" breached={(aqi?.aqi || 0) > 200}
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
              <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
                Fraud score: {riskData?.fraudProbability ? `${Math.round(riskData.fraudProbability * 100)}% (LOW — approved)` : 'N/A'} · Source: {weather?.source}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 7-Day Prediction Chart ─────────────────────────────────────────── */}
      {pred?.weekly?.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '.95rem' }}>📈 7-Day Risk & Premium Forecast</h3>
            <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Powered by Hybrid AI v4.0</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
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
          {riskData?.nextWeekPrediction && (
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '.75rem', padding: '.6rem 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>Next Week Risk</div>
                <div style={{ fontWeight: 700, color: riskColor(riskData.nextWeekPrediction.riskScore) }}>{Math.round(riskData.nextWeekPrediction.riskScore * 100)}/100</div>
              </div>
              <div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>Projected Premium</div>
                <div style={{ fontWeight: 700 }}>₹{riskData.nextWeekPrediction.weeklyPremium}</div>
              </div>
              <div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>Trend</div>
                <div style={{ fontWeight: 700, color: riskData.nextWeekPrediction.trend === 'RISING' ? 'var(--accent-rose)' : 'var(--accent-green)' }}>
                  {riskData.nextWeekPrediction.trend === 'RISING' ? '📈 Rising' : riskData.nextWeekPrediction.trend === 'FALLING' ? '📉 Falling' : '➡️ Stable'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>Demand Index</div>
                <div style={{ fontWeight: 700 }}>{Math.round((riskData.nextWeekPrediction.demandIndex || 1) * 100)}%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recent Claims ──────────────────────────────────────────────────── */}
      {data?.recentClaims?.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '1rem' }}>📋 Recent Claims (Auto-Triggered)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
            {data.recentClaims.map(c => {
              const tv = (() => { try { return JSON.parse(typeof c.trigger_value === 'string' ? c.trigger_value : '{}'); } catch { return {}; } })();
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '.85rem', marginBottom: '.15rem' }}>{c.trigger_type?.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{c.claim_number} · {new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: c.status === 'paid' ? 'var(--accent-green)' : 'var(--text-secondary)' }}>₹{c.payout_amount}</div>
                    <span className={`badge badge-${c.status === 'paid' ? 'green' : c.status === 'rejected' ? 'rose' : 'amber'}`} style={{ fontSize: '.62rem' }}>{c.status.toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .dash-stats { grid-template-columns: 1fr 1fr !important; }
          .dash-mid   { grid-template-columns: 1fr !important; }
        }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.6)} }
        @keyframes pulse { 0%,100%{border-color:rgba(244,63,94,.3)} 50%{border-color:rgba(244,63,94,.7)} }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color}20` }}>
      <div className="stat-icon" style={{ background: `${color}18` }}>{icon}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function EnvCard({ label, value, threshold, breached, sub }) {
  return (
    <div style={{
      padding: '.65rem .8rem', borderRadius: 'var(--radius-sm)',
      background: breached ? 'rgba(244,63,94,.06)' : 'var(--bg-card2)',
      border: `1px solid ${breached ? 'rgba(244,63,94,.3)' : 'var(--border)'}`,
    }}>
      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: '.2rem' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '.95rem', color: breached ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '.68rem', color: breached ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
        {breached ? '⚠️ THRESHOLD BREACHED' : `Safe < ${threshold}`}
      </div>
      {sub && <div style={{ marginTop: '.1rem' }}>{sub}</div>}
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
