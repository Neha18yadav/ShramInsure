// src/pages/AdminPage.jsx — Admin dashboard with business KPIs, fraud trends, scheduler
import { useState, useEffect } from 'react';
import { admin as adminApi, analytics } from '../utils/api';
import { useToast } from '../components/Toast';

const fmt    = n => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const fmtNum = n => Number(n || 0).toLocaleString('en-IN');
const pct    = n => `${Number(n || 0).toFixed(1)}%`;

function Skeleton({ h = 20, w = '100%' }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: 6 }} />;
}

function KPICard({ icon, label, value, sub, color = 'var(--accent-green)', bg }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg || `${color}18`, color }}>{icon}</div>
      <div className="stat-value" style={{ color, fontSize: '1.5rem' }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-delta up" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{sub}</div>}
    </div>
  );
}

const RISK_COLOR = r => r > 0.65 ? 'var(--accent-rose)' : r > 0.35 ? 'var(--accent-amber)' : 'var(--accent-green)';
const RISK_LABEL = r => r > 0.65 ? 'HIGH' : r > 0.35 ? 'MEDIUM' : 'LOW';

export default function AdminPage() {
  const toast = useToast();
  const [insights, setInsights]   = useState(null);
  const [dash, setDash]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [tab, setTab]             = useState('overview');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ins, db] = await Promise.allSettled([adminApi.insights(), analytics.dashboard()]);
      if (ins.status === 'fulfilled') setInsights(ins.value);
      if (db.status  === 'fulfilled') setDash(db.value);
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

  const kpis = insights?.businessKPIs || {};
  const cs   = insights?.claimStats   || {};
  const sched = insights?.scheduler   || {};

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '.25rem' }}>⚙️ Admin Insights</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Business KPIs · Fraud Trends · Predictive Analytics · Scheduler</p>
        </div>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <button className="btn btn-outline btn-sm" onClick={loadAll}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={triggerScheduler} disabled={runningScheduler}>
            {runningScheduler ? <><span className="spinner" /> Running...</> : '⚙️ Run Scheduler Now'}
          </button>
        </div>
      </div>

      {/* Scheduler status banner */}
      {sched.lastRunAt && (
        <div style={{ padding: '.75rem 1.1rem', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '.82rem' }}>
          <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>⚙️ Background Scheduler Active</span>
          <span style={{ color: 'var(--text-muted)' }}>Last run: {new Date(sched.lastRunAt).toLocaleString('en-IN')}</span>
          <span style={{ color: 'var(--text-muted)' }}>Total cycles: {sched.totalRunCount}</span>
          <span style={{ color: 'var(--accent-blue)' }}>Auto-claims: {sched.totalClaimsAuto}</span>
          <span style={{ color: 'var(--accent-green)' }}>Auto-payouts: {sched.totalPayoutsAuto}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>Next in: {sched.nextRunIn}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'predictions', label: '🔮 Predictions' },
          { key: 'fraud', label: '🔍 Fraud Trends' },
          { key: 'platforms', label: '🛵 Platforms' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '.55rem 1.1rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 600, fontSize: '.875rem', background: 'transparent', transition: 'all .15s',
              borderBottom: tab === t.key ? '2px solid var(--accent-green)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent-green)' : 'var(--text-secondary)',
              marginBottom: -1,
            }}>{t.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ───────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            {loading ? Array(8).fill(0).map((_, i) => <div key={i} className="stat-card"><Skeleton h={80} /></div>) : [
              { icon: '💰', label: 'Total Revenue',    value: fmt(kpis.totalRevenue),  color: 'var(--accent-green)',  sub: 'from all premiums' },
              { icon: '💸', label: 'Total Payouts',    value: fmt(kpis.totalPayouts),  color: 'var(--accent-blue)',   sub: `net: ${fmt(kpis.netProfit)}` },
              { icon: '📉', label: 'Loss Ratio',       value: pct((kpis.lossRatio||0)*100), color: kpis.lossRatio > 0.7 ? 'var(--accent-rose)' : 'var(--accent-green)', sub: `${pct(kpis.profitMargin)} margin` },
              { icon: '🛡️', label: 'Fraud Saved',      value: fmt(kpis.savedByFraudBlock), color: 'var(--accent-amber)', sub: 'blocked payouts' },
              { icon: '📋', label: 'Total Claims',     value: fmtNum(cs.total),        color: 'var(--text-primary)',  sub: `${cs.auto_triggered} auto-triggered` },
              { icon: '✅', label: 'Approved / Paid',  value: fmtNum(cs.approved),     color: 'var(--accent-green)',  sub: `${cs.pending} pending` },
              { icon: '❌', label: 'Rejected',         value: fmtNum(cs.rejected),     color: 'var(--accent-rose)',   sub: 'fraud detected' },
              { icon: '⚡', label: 'Automation Rate',  value: pct(kpis.automationRate), color: 'var(--accent-purple)', sub: 'zero-touch claims' },
            ].map(p => <KPICard key={p.label} {...p} />)}
          </div>

          {/* Revenue vs Payouts chart (bar) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>📈 Revenue vs Payouts (30d)</h3>
              {loading ? <Skeleton h={140} /> : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '.3rem', height: 100, marginBottom: '.5rem' }}>
                    {(dash?.revenueVsPayouts || []).slice(-14).map((d, i) => {
                      const maxVal = Math.max(...(dash?.revenueVsPayouts || []).map(x => Math.max(x.daily_revenue || 0, x.daily_payout || 0)), 1);
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%' }}>
                          <div style={{ flex: 1, background: 'var(--accent-green)', opacity: .7, height: `${((d.daily_revenue || 0) / maxVal) * 100}%`, minHeight: 2, borderRadius: '2px 2px 0 0' }} title={`Revenue: ${fmt(d.daily_revenue)}`} />
                          <div style={{ flex: 1, background: 'var(--accent-rose)', opacity: .7, height: `${((d.daily_payout || 0) / maxVal) * 100}%`, minHeight: 2, borderRadius: '2px 2px 0 0' }} title={`Payout: ${fmt(d.daily_payout)}`} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '.72rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}><span style={{ width: 10, height: 10, background: 'var(--accent-green)', borderRadius: 2, display: 'inline-block' }} />Revenue</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}><span style={{ width: 10, height: 10, background: 'var(--accent-rose)', borderRadius: 2, display: 'inline-block' }} />Payouts</span>
                  </div>
                </div>
              )}
            </div>

            {/* Claims by type */}
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>🌦️ Claims by Trigger Type</h3>
              {loading ? <Skeleton h={140} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {(dash?.claimsByType || []).map(t => (
                    <div key={t.trigger_type} style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                      <span style={{ width: 26, textAlign: 'center' }}>
                        {{ WEATHER_RAIN: '🌧️', POLLUTION_AQI: '💨', WEATHER_HEAT: '🌡️', FLOOD_ALERT: '🌊', WEATHER_STORM: '⛈️', CIVIL_CURFEW: '🚫' }[t.trigger_type] || '📋'}
                      </span>
                      <div style={{ flex: 1, fontSize: '.8rem', color: 'var(--text-secondary)', minWidth: 0 }} className="truncate">{t.trigger_type?.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text-primary)', width: 30, textAlign: 'right' }}>{t.count}</div>
                      <div style={{ fontSize: '.75rem', color: 'var(--accent-green)', width: 70, textAlign: 'right' }}>{fmt(t.total_payout)}</div>
                    </div>
                  ))}
                  {!dash?.claimsByType?.length && <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>No claims yet</div>}
                </div>
              )}
            </div>
          </div>

          {/* High-risk zones */}
          <div className="card">
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>🗺️ High-Risk Zones</h3>
            {loading ? <Skeleton h={100} /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>City</th><th>Zone</th><th>Avg Risk</th><th>Workers</th><th>Claims (30d)</th><th>Payout (30d)</th></tr></thead>
                  <tbody>
                    {(insights?.highRiskZones || []).map((z, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{z.city}</td>
                        <td>{z.zone}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <div style={{ width: 50, height: 5, background: 'var(--bg-card2)', borderRadius: 9999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${z.avg_risk * 100}%`, background: RISK_COLOR(z.avg_risk), borderRadius: 9999 }} />
                            </div>
                            <span style={{ fontSize: '.78rem', color: RISK_COLOR(z.avg_risk), fontWeight: 700 }}>{RISK_LABEL(z.avg_risk)}</span>
                          </div>
                        </td>
                        <td>{z.workers}</td>
                        <td>{z.claims_30d}</td>
                        <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmt(z.payout_30d)}</td>
                      </tr>
                    ))}
                    {!insights?.highRiskZones?.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data yet</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── PREDICTIONS TAB ────────────────────────────────────────────── */}
      {tab === 'predictions' && (
        <>
          {insights?.demandForecast && (
            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
              <span>📅</span>
              <div>
                <strong>Demand Forecast:</strong> {insights.demandForecast.currentMonth} → {insights.demandForecast.nextMonth} · Trend: <strong style={{ color: insights.demandForecast.trend === 'RISING' ? 'var(--accent-rose)' : 'var(--accent-green)' }}>{insights.demandForecast.trend}</strong> (index: {insights.demandForecast.currentDemand} → {insights.demandForecast.nextDemand})
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>🔮 Next-Week Claims Forecast</h3>
              {loading ? <Skeleton h={200} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                  {(insights?.predictedClaims || []).map(p => (
                    <div key={p.city} style={{ padding: '.7rem .9rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '.15rem' }}>{p.city}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{p.activeWorkers} workers · Risk {(p.avgRisk * 100).toFixed(0)}%</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: p.trend === 'RISING' ? 'var(--accent-rose)' : p.trend === 'FALLING' ? 'var(--accent-green)' : 'var(--accent-amber)' }}>{p.nextWeekForecast}</div>
                        <div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>predicted</div>
                      </div>
                      <span className={`badge ${p.trend === 'RISING' ? 'badge-rose' : p.trend === 'FALLING' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '.65rem' }}>
                        {p.trend === 'RISING' ? '↑' : p.trend === 'FALLING' ? '↓' : '→'} {p.trend}
                      </span>
                    </div>
                  ))}
                  {!insights?.predictedClaims?.length && <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>No prediction data yet</div>}
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>⚠️ At-Risk Workers (Next Week)</h3>
              {loading ? <Skeleton h={200} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {(insights?.atRiskWorkers || []).map(w => (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem .75rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--text-primary)' }} className="truncate">{w.name}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{w.platform} · {w.city}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '.85rem', fontWeight: 800, color: RISK_COLOR(w.nextWeekRiskScore) }}>{(w.nextWeekRiskScore * 100).toFixed(0)}%</div>
                        <div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>next week</div>
                      </div>
                    </div>
                  ))}
                  {!insights?.atRiskWorkers?.length && <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>No high-risk workers</div>}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── FRAUD TRENDS TAB ───────────────────────────────────────────── */}
      {tab === 'fraud' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>🔍 14-Day Fraud Trend</h3>
            {loading ? <Skeleton h={200} /> : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '.3rem', height: 100, marginBottom: '.75rem' }}>
                  {(insights?.fraudTrend || []).map((d, i) => {
                    const maxT = Math.max(...(insights?.fraudTrend || []).map(x => x.total || 0), 1);
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ width: '100%', background: 'var(--accent-rose)', opacity: .7, height: `${((d.high_risk || 0) / maxT) * 100}%`, minHeight: d.high_risk ? 2 : 0, borderRadius: '2px 2px 0 0' }} />
                        <div style={{ width: '100%', background: 'var(--accent-amber)', opacity: .7, height: `${((d.medium_risk || 0) / maxT) * 100}%`, minHeight: d.medium_risk ? 2 : 0 }} />
                        <div style={{ fontSize: '.55rem', color: 'var(--text-muted)', marginTop: 2 }}>{d.date?.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '.72rem' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--accent-rose)', borderRadius: 2, marginRight: 4 }} />High Risk</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--accent-amber)', borderRadius: 2, marginRight: 4 }} />Medium Risk</span>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>🚩 Top Fraud Signals</h3>
            {loading ? <Skeleton h={200} /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                {(insights?.topFraudSignals || []).map(s => (
                  <div key={s.type} style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                    <div style={{ flex: 1, fontSize: '.82rem', color: 'var(--text-secondary)' }}>{s.label}</div>
                    <div style={{ width: 100, height: 5, background: 'var(--bg-card2)', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((s.count / (insights.topFraudSignals[0]?.count || 1)) * 100, 100)}%`, background: 'var(--accent-rose)', borderRadius: 9999 }} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--accent-rose)', width: 24, textAlign: 'right' }}>{s.count}</div>
                  </div>
                ))}
                {!insights?.topFraudSignals?.length && <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>No fraud signals recorded</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PLATFORMS TAB ─────────────────────────────────────────────── */}
      {tab === 'platforms' && (
        <div className="card">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>🛵 Platform Performance</h3>
          {loading ? <Skeleton h={200} /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Platform</th><th>Persona</th><th>Workers</th><th>Avg Risk</th><th>Total Claims</th><th>Total Payout</th><th>Fraud Rate</th></tr></thead>
                <tbody>
                  {(insights?.platformPerf || []).map(p => (
                    <tr key={p.platform}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.platform}</td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{p.persona}</td>
                      <td>{p.workers}</td>
                      <td>
                        <span style={{ color: RISK_COLOR(p.avg_risk), fontWeight: 700, fontSize: '.82rem' }}>
                          {(p.avg_risk * 100).toFixed(0)}% {RISK_LABEL(p.avg_risk)}
                        </span>
                      </td>
                      <td>{p.total_claims}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmt(p.total_payout)}</td>
                      <td>
                        <span className={`badge ${p.fraudRate > 30 ? 'badge-rose' : p.fraudRate > 15 ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '.65rem' }}>
                          {p.fraudRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!insights?.platformPerf?.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No platform data yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
