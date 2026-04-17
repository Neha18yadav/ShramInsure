// src/pages/Dashboard.jsx — Worker dashboard with AI risk, policy, claims, alerts
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { analytics, predict, risk as riskApi, claims as claimsApi } from '../utils/api';

const riskColor = s => s > 0.65 ? 'var(--accent-rose)' : s > 0.35 ? 'var(--accent-amber)' : 'var(--accent-green)';
const riskLabel = s => s > 0.65 ? 'HIGH' : s > 0.35 ? 'MEDIUM' : 'LOW';
const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const fmtPct = n => `${(n * 100).toFixed(0)}%`;

function Skeleton({ w = '100%', h = 20 }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: 6 }} />;
}

const TRIGGER_ICONS = { WEATHER_RAIN: '🌧️', POLLUTION_AQI: '💨', WEATHER_HEAT: '🌡️', FLOOD_ALERT: '🌊', WEATHER_STORM: '⛈️', CIVIL_CURFEW: '🚫' };
const STATUS_BADGE = {
  paid:     { cls: 'badge-green',  label: 'Paid' },
  approved: { cls: 'badge-blue',   label: 'Approved' },
  pending:  { cls: 'badge-amber',  label: 'Pending' },
  rejected: { cls: 'badge-rose',   label: 'Rejected' },
};

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [workerData, setWorkerData] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [riskData, setRiskData]     = useState(null);
  const [env, setEnv]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [checkingTrigger, setCheckingTrigger] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wd, pred, rd, envData] = await Promise.allSettled([
        analytics.worker(),
        predict.loss(),
        riskApi.calculate({}),
        claimsApi.environment(),
      ]);
      if (wd.status === 'fulfilled')    setWorkerData(wd.value);
      if (pred.status === 'fulfilled')  setPrediction(pred.value);
      if (rd.status === 'fulfilled')    setRiskData(rd.value);
      if (envData.status === 'fulfilled') setEnv(envData.value);
    } catch {}
    setLoading(false);
  };

  const runTriggerCheck = async () => {
    setCheckingTrigger(true);
    try {
      const r = await claimsApi.triggerCheck({});
      if (r.claimsCreated > 0) {
        toast.success(`✅ ${r.claimsCreated} claim(s) auto-created! Check your Claims page.`);
        await refreshUser();
        loadAll();
      } else {
        toast.info(`Scan complete — ${r.triggersDetected} trigger(s) detected, no new claims.`);
      }
    } catch (e) { toast.error(e.message); }
    setCheckingTrigger(false);
  };

  const W = workerData;
  const P = prediction;
  const R = riskData;

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '.25rem' }}>
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>
            {user?.platform} · {user?.city}, {user?.zone} · Income Loss Protection Active
          </p>
        </div>
        <button className="btn btn-primary" onClick={runTriggerCheck} disabled={checkingTrigger}>
          {checkingTrigger ? <><span className="spinner" /> Scanning...</> : '🔍 Run Trigger Scan'}
        </button>
      </div>

      {/* Alert banner */}
      {env?.triggered?.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️</span>
          <div>
            <strong>{env.triggered.length} active trigger(s)</strong> in {user?.city}:{' '}
            {env.triggered.map(t => t.label).join(', ')} — Your policy may auto-trigger a claim.
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="stat-card"><Skeleton h={80} /></div>
        )) : [
          {
            icon: '🛡️', bg: 'rgba(16,185,129,.12)', color: 'var(--accent-green)',
            value: W?.activePolicy ? `₹${W.activePolicy.coverage_amount?.toLocaleString('en-IN')}` : 'No Policy',
            label: 'Weekly Coverage', delta: W?.activePolicy ? `Expires ${new Date(W.activePolicy.end_date).toLocaleDateString('en-IN')}` : 'Create a policy',
            deltaClass: W?.activePolicy ? 'up' : 'down',
          },
          {
            icon: '💰', bg: 'rgba(59,130,246,.12)', color: 'var(--accent-blue)',
            value: fmt(W?.stats?.totalPayout || 0), label: 'Total Payouts Received',
            delta: `${W?.stats?.paid || 0} paid claims`, deltaClass: 'up',
          },
          {
            icon: '🧠', bg: 'rgba(139,92,246,.12)', color: 'var(--accent-purple)',
            value: R ? fmtPct(R.riskScore) : '—', label: 'AI Risk Score',
            delta: R ? riskLabel(R.riskScore) + ' risk level' : 'Loading...',
            deltaClass: R?.riskScore > 0.65 ? 'down' : 'up',
          },
          {
            icon: '🔒', bg: 'rgba(245,158,11,.12)', color: 'var(--accent-amber)',
            value: fmt(W?.stats?.earningsProtected || 0), label: 'Income Protected',
            delta: 'Income loss only', deltaClass: 'up',
          },
        ].map(({ icon, bg, color, value, label, delta, deltaClass }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: bg, color }}>{icon}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
            <div className="stat-label">{label}</div>
            {delta && <div className={`stat-delta ${deltaClass}`}>{delta}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Active policy card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>🛡️ Active Policy</h3>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/policies')}>
              {W?.activePolicy ? 'Manage' : '+ Create Policy'}
            </button>
          </div>
          {loading ? <Skeleton h={120} /> : W?.activePolicy ? (
            <>
              <div style={{ background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '.75rem' }}>
                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: '.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Policy Number</div>
                <div style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '1.05rem' }}>{W.activePolicy.policy_number}</div>
              </div>
              {[
                ['Coverage/Week', fmt(W.activePolicy.coverage_amount), 'var(--accent-green)'],
                ['Weekly Premium', fmt(W.activePolicy.weekly_premium), 'var(--accent-blue)'],
                ['Coverage Type', 'Income Loss Only', 'var(--accent-amber)'],
                ['Expires', new Date(W.activePolicy.end_date).toLocaleDateString('en-IN'), 'var(--text-secondary)'],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontSize: '.85rem', fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📄</div>
              <div style={{ fontWeight: 600, marginBottom: '.5rem' }}>No Active Policy</div>
              <div style={{ fontSize: '.82rem' }}>Create a policy to enable parametric income protection</div>
            </div>
          )}
        </div>

        {/* AI Risk Engine */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>🧠 AI Risk Engine</h3>
            {R && <span className="badge" style={{ background: `${riskColor(R.riskScore)}20`, color: riskColor(R.riskScore), border: `1px solid ${riskColor(R.riskScore)}40` }}>{riskLabel(R.riskScore)}</span>}
          </div>
          {loading || !R ? <Skeleton h={200} /> : (
            <>
              {/* Big risk score */}
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: riskColor(R.riskScore), lineHeight: 1 }}>
                  {(R.riskScore * 100).toFixed(0)}
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>out of 100</div>
              </div>
              <div className="risk-bar-track" style={{ marginBottom: '1rem' }}>
                <div className="risk-bar-fill" style={{ width: `${R.riskScore * 100}%`, background: riskColor(R.riskScore) }} />
              </div>
              {/* Feature breakdown */}
              {R.featureBreakdown && Object.entries(R.featureBreakdown).slice(0, 4).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.4rem' }}>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>
                    {k.replace(/Score$/, '').replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div style={{ flex: 1, height: 5, background: 'var(--bg-card2)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(v / 0.30) * 100}%`, background: 'var(--accent-purple)', borderRadius: 9999, transition: 'width .5s' }} />
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', width: 35, textAlign: 'right' }}>
                    {(v * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
              {R.nextWeekPrediction && (
                <div style={{ marginTop: '.75rem', padding: '.6rem .8rem', background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)', borderRadius: 'var(--radius-sm)', fontSize: '.78rem', color: 'var(--text-secondary)' }}>
                  📈 Next week: <strong style={{ color: 'var(--accent-purple)' }}>{R.nextWeekPrediction.trend}</strong> — Premium {fmt(R.nextWeekPrediction.weeklyPremium)}/wk
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Income prediction */}
        <div className="card">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>📊 7-Day Income Risk Forecast</h3>
          {loading || !P ? <Skeleton h={180} /> : (
            <>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1, background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', padding: '.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-rose)' }}>{P.risk24h}%</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>24h Risk</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', padding: '.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)' }}>{fmt(P.estimatedLoss24h)}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Est. 24h Loss</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', padding: '.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-rose)' }}>{fmt(P.totalWeeklyLoss)}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Week Loss</div>
                </div>
              </div>
              {/* 7-day bars */}
              <div style={{ display: 'flex', gap: '.35rem', alignItems: 'flex-end', height: 70 }}>
                {(P.forecast7d || []).map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem' }}>
                    <div style={{
                      flex: 1, width: '100%',
                      background: d.riskPercent > 70 ? 'var(--accent-rose)' : d.riskPercent > 40 ? 'var(--accent-amber)' : 'var(--accent-green)',
                      height: `${Math.max(d.riskPercent, 4)}%`, minHeight: 4,
                      borderRadius: '3px 3px 0 0', opacity: 0.8,
                      transition: 'height .4s',
                    }} />
                    <div style={{ fontSize: '.62rem', color: 'var(--text-muted)' }}>{d.day}</div>
                  </div>
                ))}
              </div>
              {P.disruptions?.length > 0 && (
                <div style={{ marginTop: '.75rem', display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                  {P.disruptions.map(d => (
                    <span key={d.type} className={`badge ${d.active ? 'badge-rose' : 'badge-amber'}`}>
                      {d.icon} {d.label} {d.active ? '⚡' : ''}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Recent claims */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>📋 Recent Claims</h3>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/claims')}>View All</button>
          </div>
          {loading ? <Skeleton h={200} /> : W?.recentClaims?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {W.recentClaims.map(c => {
                const s = STATUS_BADGE[c.status] || { cls: 'badge-gray', label: c.status };
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem .8rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1.25rem' }}>{TRIGGER_ICONS[c.trigger_type] || '📋'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-primary)', truncate: true }}>{c.claim_number}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--accent-green)' }}>{fmt(c.payout_amount)}</div>
                      <span className={`badge ${s.cls}`} style={{ fontSize: '.65rem' }}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📭</div>
              <div style={{ fontSize: '.85rem' }}>No claims yet. Claims auto-file when disruptions are detected.</div>
            </div>
          )}
        </div>
      </div>

      {/* Live environment */}
      {env && (
        <div className="card">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>🌍 Live Environmental Conditions — {user?.city}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { icon: '🌧️', label: 'Rainfall', value: `${env.weather?.rainfall || 0} mm/hr`, threshold: 65, current: env.weather?.rainfall },
              { icon: '🌡️', label: 'Temperature', value: `${env.weather?.temp || 0}°C`, threshold: 42, current: env.weather?.temp },
              { icon: '💨', label: 'AQI', value: `${env.aqi?.aqi || 0}`, threshold: 200, current: env.aqi?.aqi },
              { icon: '⛈️', label: 'Wind Speed', value: `${env.weather?.windSpeed || 0} km/h`, threshold: 50, current: env.weather?.windSpeed },
            ].map(({ icon, label, value, threshold, current }) => {
              const breached = current > threshold;
              return (
                <div key={label} style={{
                  padding: '.75rem', background: breached ? 'rgba(244,63,94,.06)' : 'var(--bg-card2)',
                  border: `1px solid ${breached ? 'rgba(244,63,94,.25)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '.25rem' }}>{icon}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: breached ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{value}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: '.3rem' }}>{label}</div>
                  {breached && <span className="badge badge-rose" style={{ fontSize: '.62rem' }}>⚡ TRIGGERED</span>}
                  {!breached && <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>Threshold: {threshold}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
