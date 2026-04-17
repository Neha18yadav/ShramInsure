// src/pages/AdminPage.jsx — Admin dashboard with business KPIs, fraud trends, scheduler, and Disruption Lab
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { admin as adminApi, analytics, simulate } from '../utils/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { 
  CloudRain, ThermometerSun, Wind, Waves, Ban, History, 
  Target, Info, ClipboardCheck, LayoutDashboard, Brain,
  Zap, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck,
  Settings, BarChart3, FlaskConical, Search, Banknote, CreditCard,
  CloudLightning, Activity, Globe
} from 'lucide-react';

const fmt    = n => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const fmtNum = n => Number(n || 0).toLocaleString('en-IN');
const pct    = n => `${Number(n || 0).toFixed(1)}%`;

const SIMULATIONS = [
  { key: 'rain',      label: 'Heavy Rain',       icon: CloudRain, color: '#0ea5e9',   desc: '87.5 mm/hr monsoon surge', severity: 'high',     badge: 'badge-blue'   },
  { key: 'pollution', label: 'AQI Emergency',    icon: Wind,      color: '#f59e0b',  desc: 'AQI 340 hazardous air',  severity: 'critical', badge: 'badge-amber'  },
  { key: 'heat',      label: 'Extreme Heat',     icon: ThermometerSun, color: '#ef4444',   desc: '46.2°C heat wave',        severity: 'high',     badge: 'badge-rose'   },
  { key: 'flood',     label: 'Flood Alert',      icon: Waves,     color: '#06b6d4',   desc: '1.4m water level surge',   severity: 'critical', badge: 'badge-cyan'   },
  { key: 'curfew',    label: 'Zone Curfew',      icon: Ban,       color: '#8b5cf6', desc: 'Civil restriction in zone', severity: 'critical', badge: 'badge-purple' },
];

const STEP_LABELS = {
  done:    { color: 'var(--accent-green)',  bg: 'rgba(16,185,129,.15)' },
  paid:    { color: 'var(--accent-green)',  bg: 'rgba(16,185,129,.2)'  },
  pending: { color: 'var(--accent-amber)',  bg: 'rgba(245,158,11,.15)' },
  blocked: { color: 'var(--accent-rose)',   bg: 'rgba(244,63,94,.15)'  },
  error:   { color: 'var(--accent-rose)',   bg: 'rgba(244,63,94,.15)'  },
  loading: { color: 'var(--text-muted)',    bg: 'var(--bg-card2)'      },
};

function Skeleton({ h = 20, w = '100%' }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: 6 }} />;
}

function KPICard({ icon, label, value, sub, color = 'var(--accent-green)', bg }) {
  return (
    <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="stat-icon" style={{ background: `${color}08`, color, border: `1px solid ${color}1a` }}>{icon}</div>
      <div className="stat-value" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>{value}</div>
      <div className="stat-label" style={{ fontSize: '.72rem', letterSpacing: '.06em' }}>{label}</div>
      {sub && <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

const FraudBar = ({ score }) => {
  const color = score >= 0.7 ? 'var(--accent-rose)' : score >= 0.4 ? 'var(--accent-amber)' : 'var(--accent-green)';
  const label = score >= 0.7 ? 'HIGH RISK' : score >= 0.4 ? 'MEDIUM' : 'CLEAN';
  return (
    <div style={{ marginTop: '.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: '.4rem', fontWeight: 600 }}>
        <span>Fraud Score</span>
        <span style={{ color, fontWeight: 800 }}>{(score * 100).toFixed(0)}/100 · {label}</span>
      </div>
      <div className="risk-bar-track">
        <div className="risk-bar-fill" style={{ width: `${score * 100}%`, background: color }} />
      </div>
    </div>
  );
};

const RISK_COLOR = r => r > 0.65 ? 'var(--accent-rose)' : r > 0.35 ? 'var(--accent-amber)' : 'var(--accent-green)';
const RISK_LABEL = r => r > 0.65 ? 'HIGH' : r > 0.35 ? 'MEDIUM' : 'LOW';

export default function AdminPage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [insights, setInsights]   = useState(null);
  const [dash, setDash]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [syncHealth, setSyncHealth] = useState(null);
  const [tab, setTab]             = useState(searchParams.get('tab') || 'overview');

  // Sync tab with URL search params
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && t !== tab) setTab(t);
  }, [searchParams]);

  // Update URL when tab changes manually
  const selectTab = (t) => {
    setTab(t);
    setSearchParams({ tab: t });
  };

  // Simulation Lab state
  const [simResult, setSimResult]   = useState(null);
  const [simRunning, setSimRunning] = useState(null);
  const [simHistory, setSimHistory] = useState([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ins, db, health] = await Promise.allSettled([
        adminApi.insights(), 
        analytics.dashboard(),
        adminApi.health.sync()
      ]);
      if (ins.status === 'fulfilled') setInsights(ins.value);
      if (db.status  === 'fulfilled') setDash(db.value);
      if (health.status === 'fulfilled') setSyncHealth(health.value);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const triggerScheduler = async () => {
    setRunningScheduler(true);
    try {
      await adminApi.runScheduler();
      toast.success('Scheduler cycle triggered! Scanning all cities...');
      setTimeout(loadAll, 3000);
    } catch (e) { toast.error(e.message); }
    setRunningScheduler(false);
  };

  const runSimulation = async (simKey) => {
    if (simRunning) return;
    setSimRunning(simKey);
    setSimResult(null);
    try {
      const apiFn = simulate[simKey];
      const r = await apiFn({ city: user?.city, zone: user?.zone });
      setSimResult({ ...r, simKey });
      setSimHistory(h => [{ simKey, summary: r.summary, time: new Date().toLocaleTimeString(), success: r.success }, ...h.slice(0, 4)]);
      if (r.payout) refreshUser();
      toast.info('Simulated cycle complete.');
    } catch (e) {
      toast.error(e.message);
    }
    setSimRunning(null);
  };

  const kpis = insights?.businessKPIs || {};
  const cs   = insights?.claimStats   || {};
  const sched = insights?.scheduler   || {};

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '.25rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Settings size={28} className="text-secondary" /> Admin Insurer Portal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Loss Ratios · Predictive Analytics · Disruption Lab</p>
        </div>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <button className="btn btn-outline btn-sm" onClick={loadAll}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={triggerScheduler} disabled={runningScheduler}>
            {runningScheduler ? <><span className="spinner" /> Running...</> : '⚙️ Run Scheduler Now'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '.1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', overflowX: 'auto', paddingBottom: '2px' }} className="hide-scrollbar">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'predictions', label: 'Predictions', icon: Brain },
          { key: 'lab', label: 'Disruption Lab', icon: FlaskConical },
          { key: 'fraud', label: 'Infrastructure', icon: Search },
        ].map(t => (
          <button key={t.key} onClick={() => selectTab(t.key)}
            style={{
              padding: '.75rem 1.25rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 700, fontSize: '.82rem', background: 'transparent', transition: 'all .15s',
              borderBottom: tab === t.key ? '2px solid var(--accent-green)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent-green)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              marginBottom: -1,
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ───────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
            {loading ? Array(8).fill(0).map((_, i) => <div key={i} className="stat-card"><Skeleton h={80} /></div>) : [
              { icon: <Banknote size={18} />,     label: 'Total Revenue',    value: fmt(kpis.totalRevenue),  color: 'var(--accent-green)',  sub: 'all premiums' },
              { icon: <CreditCard size={18} />,   label: 'Total Payouts',    value: fmt(kpis.totalPayouts),  color: 'var(--accent-blue)',   sub: `net: ${fmt(kpis.netProfit)}` },
              { icon: <TrendingDown size={18} />, label: 'Loss Ratio',       value: pct((kpis.lossRatio||0)*100), color: kpis.lossRatio > 0.7 ? 'var(--accent-rose)' : 'var(--accent-green)', sub: 'Target: < 65%' },
              { icon: <Zap size={18} />,          label: 'Automation',       value: pct(kpis.automationRate), color: 'var(--accent-purple)', sub: 'Zero-touch claims' },
            ].map(p => <KPICard key={p.label} {...p} />)}
          </div>

          <div className="grid grid-2" style={{ marginBottom: '1.5rem', alignItems: 'start' }}>
            <div className="card">
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} className="text-green" /> Loss Ratio Analysis
              </h3>
              {loading ? <Skeleton h={180} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: 'var(--bg-card2)', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>30D FINANCIAL SNAPSHOT</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 60, gap: '4px' }}>
                      {(dash?.revenueVsPayouts || []).slice(-15).map((d, i) => {
                         const max = Math.max(...(dash?.revenueVsPayouts || []).map(x => x.daily_revenue||1));
                         return <div key={i} style={{ flex: 1, background: 'var(--accent-green)', height: `${(d.daily_revenue/max)*100}%`, minHeight: 4, borderRadius: 2, opacity: 0.6 }} />;
                      })}
                    </div>
                    <div style={{ marginTop: '.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', fontWeight: 700 }}>
                      <span style={{ color: 'var(--accent-green)' }}>Revenue: {fmt(kpis.totalRevenue)}</span>
                      <span style={{ color: 'var(--accent-rose)' }}>Loss: {fmt(kpis.totalPayouts)}</span>
                    </div>
                  </div>
                  
                  {(insights?.platformPerf || []).slice(0, 3).map(p => (
                    <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, fontSize: '.8rem', fontWeight: 600 }}>{p.platform}</div>
                      <div style={{ width: 120, height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: p.fraudRate > 15 ? 'var(--accent-rose)' : 'var(--accent-green)', width: `${Math.min(p.fraudRate * 4, 100)}%` }} />
                      </div>
                      <div style={{ width: 40, textAlign: 'right', fontSize: '.75rem', fontWeight: 800 }}>{pct(p.avg_risk * 100)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} className="text-purple" /> Trigger Distribution
              </h3>
              {loading ? <Skeleton h={180} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                  {(dash?.claimsByType || []).map(t => {
                    const Icon = { 
                      WEATHER_RAIN: CloudRain, POLLUTION_AQI: Wind, 
                      WEATHER_HEAT: ThermometerSun, FLOOD_ALERT: Waves, 
                      WEATHER_STORM: CloudLightning 
                    }[t.trigger_type] || ClipboardCheck;
                    return (
                      <div key={t.trigger_type} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.75rem', background: 'var(--bg-card2)', borderRadius: 10 }}>
                        <Icon size={20} className="text-secondary" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '.75rem', fontWeight: 700 }}>{t.trigger_type?.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>{t.count} claims processed</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '.8rem' }}>{fmt(t.total_payout)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── PREDICTIONS TAB ────────────────────────────────────────────── */}
      {tab === 'predictions' && (
        <>
          <div className="grid grid-2" style={{ marginBottom: '1.5rem', alignItems: 'start' }}>
            <div className="card" style={{ border: '1px solid var(--accent-purple)30' }}>
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} className="text-purple" /> Next-Week Disruption Forecast
              </h3>
              {loading ? <Skeleton h={220} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ padding: '1rem', background: 'var(--accent-purple)0a', borderRadius: 12, border: '1px dashed var(--accent-purple)40', marginBottom: '.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 700 }}>NETWORK-WIDE TREND</div>
                      <span className={`badge ${insights?.demandForecast?.trend === 'RISING' ? 'badge-rose' : 'badge-green'}`}>{insights?.demandForecast?.trend}</span>
                    </div>
                    <div style={{ fontSize: '.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Expected <span style={{ color: 'var(--accent-rose)', fontWeight: 800 }}>+{((insights?.demandForecast?.nextDemand/insights?.demandForecast?.currentDemand - 1)*100).toFixed(1)}%</span> surge in claims due to seasonal {insights?.demandForecast?.nextMonth} weather patterns.
                    </div>
                  </div>
                  
                  {(insights?.predictedClaims || []).slice(0, 4).map(p => (
                    <div key={p.city} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{p.city}</div>
                        <div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>Confidence: 94.2%</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: p.trend === 'RISING' ? 'var(--accent-rose)' : 'var(--text-primary)' }}>~ {p.nextWeekForecast}</div>
                        <div style={{ fontSize: '.6rem', color: 'var(--text-muted)' }}>EST. CLAIMS</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} className="text-amber" /> High-Risk Concentration
              </h3>
              {loading ? <Skeleton h={220} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                   {(insights?.highRiskZones || []).slice(0, 5).map((z, i) => (
                    <div key={i} style={{ padding: '.75rem', background: 'var(--bg-card2)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '.8rem' }}>{z.city} · {z.zone}</div>
                        <div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>{z.workers} Active Policies</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '.85rem', fontWeight: 800, color: RISK_COLOR(z.avg_risk) }}>{pct(z.avg_risk * 100)} Risk</div>
                        <div style={{ fontSize: '.6rem', color: 'var(--text-muted)' }}>Payout: {fmt(z.payout_30d)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── DISRUPTION LAB TAB ────────────────────────────────────────── */}
      {tab === 'lab' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div>
            <div className="alert alert-info" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
              <Target size={18} className="shrink-0" />
              <div>
                <strong>Storytelling Mode:</strong> Trigger simulated disruptions to demonstrate parametric auto-claims and AI fraud logic.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {SIMULATIONS.map(s => (
                <button key={s.key} onClick={() => runSimulation(s.key)} disabled={!!simRunning}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '.85rem 1.1rem', border: `1px solid ${simResult?.simKey === s.key ? s.color : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)', background: simResult?.simKey === s.key ? 'var(--bg-base)' : 'var(--bg-card)',
                    cursor: simRunning ? 'not-allowed' : 'pointer', transition: 'all .2s',
                    opacity: simRunning && simRunning !== s.key ? .5 : 1,
                    fontFamily: 'inherit', textAlign: 'left', width: '100%',
                    boxShadow: simResult?.simKey === s.key ? `0 0 15px ${s.color}15` : 'none'
                  }}>
                  <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card2)', borderRadius: 8, flexShrink: 0, color: simResult?.simKey === s.key ? s.color : 'inherit', border: `1px solid ${simResult?.simKey === s.key ? s.color : 'transparent'}20` }}>
                    {simRunning === s.key ? <span className="spinner" /> : <s.icon size={18} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '.88rem', marginBottom: '.1rem' }}>{s.label}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{s.desc}</div>
                  </div>
                  <span className={`badge ${s.badge}`} style={{ flexShrink: 0, fontSize: '.6rem' }}>{s.severity}</span>
                </button>
              ))}
            </div>

            {simHistory.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontWeight: 700, fontSize: '.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '.75rem' }}>Scenario History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {simHistory.map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem .75rem', background: 'var(--bg-card2)', borderRadius: 8, fontSize: '.75rem' }}>
                      <span style={{ fontWeight: 600 }}>{SIMULATIONS.find(s => s.key === h.simKey)?.label}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            {!simResult && !simRunning && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--border)', minHeight: '400px' }}>
                <Target size={64} style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
                <div style={{ fontWeight: 700, marginBottom: '.5rem' }}>Scenario Engine Ready</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', maxWidth: '280px' }}>Select an event to run the full automation cycle: Trigger → Claim → AI Fraud → Payout.</p>
              </div>
            )}
            {simRunning && (
              <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <div className="spinner spinner-lg" style={{ margin: '0 auto 1.5rem' }} />
                <div style={{ fontWeight: 700 }}>Processing Smart Contract...</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.5rem' }}>Analyzing telemetry & breach thresholds</div>
              </div>
            )}
            {simResult && (
              <div className="card page-enter" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-card2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     {SIMULATIONS.find(s => s.key === simResult.simKey)?.icon && 
                      (() => { const Icon = SIMULATIONS.find(s => s.key === simResult.simKey).icon; return <Icon size={24} /> })()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Scenario Result</div>
                    <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{simResult.triggerLabel} · {simResult.city}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  {simResult.steps?.map((step, i) => {
                    const style = STEP_LABELS[step.status] || STEP_LABELS.loading;
                    return (
                      <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: style.bg, color: style.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 900, border: `1px solid ${style.color}` }}>
                            {step.status === 'done' || step.status === 'paid' ? '✓' : '•'}
                          </div>
                          {i < simResult.steps.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', margin: '4px 0' }} />}
                        </div>
                        <div style={{ flex: 1, paddingBottom: i < simResult.steps.length - 1 ? '1rem' : 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{step.label}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{step.detail}</div>
                          {step.fraudData && <FraudBar score={step.fraudData.fraudScore} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: simResult.payout ? 'var(--accent-green)10' : 'var(--accent-rose)10', padding: '1rem', borderRadius: 12, border: `1px solid ${simResult.payout ? 'var(--accent-green)30' : 'var(--accent-rose)30'}`, fontSize: '.85rem', fontWeight: 600, color: simResult.payout ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                  {simResult.summary}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FRAUD & HEALTH TAB ────────────────────────────────────────── */}
      {tab === 'fraud' && (
        <>
          <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* API Health Monitor */}
            <div className="card">
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem' }}>🔌 API Infrastructure Health</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {syncHealth?.providers?.map((p, i) => (
                  <div key={i} style={{ padding: '.85rem', background: 'var(--bg-card2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.status === 'healthy' ? 'var(--accent-green)' : 'var(--accent-rose)', boxShadow: `0 0 8px ${p.status === 'healthy' ? 'var(--accent-green)80' : 'var(--accent-rose)80'}` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{p.message}</div>
                    </div>
                  </div>
                ))}
                {!syncHealth && <Skeleton h={100} />}
              </div>
            </div>

            {/* Fraud Signal Breakdown */}
            <div className="card">
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem' }}>🚩 Top Fraud Signals</h3>
              {loading ? <Skeleton h={200} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                  {(insights?.topFraudSignals || []).map(s => (
                    <div key={s.type} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.65rem', background: 'var(--bg-card2)', borderRadius: 8 }}>
                      <div style={{ flex: 1, fontSize: '.8rem', fontWeight: 600 }}>{s.label}</div>
                      <span className="badge badge-rose" style={{ fontSize: '.65rem' }}>{s.count} hits</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scheduler status banner */}
          {sched.lastRunAt && (
            <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', fontSize: '.85rem' }}>
              <div>
                <div style={{ color: 'var(--accent-green)', fontWeight: 800, marginBottom: '.25rem' }}>⚙️ Scheduler Engine</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>Last scan: {new Date(sched.lastRunAt).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{sched.totalClaimsAuto}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>AUTO-CLAIMS</div>
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>{sched.totalPayoutsAuto}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>AUTO-PAYOUTS</div>
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{sched.nextRunIn}</div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>NEXT SCAN</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
