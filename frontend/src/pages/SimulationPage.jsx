// src/pages/SimulationPage.jsx — One-click demo simulation system
import { useState } from 'react';
import { simulate } from '../utils/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { Target, Zap, Waves, CloudRain, ShieldCheck, ThermometerSun, Wind, Ban, FileText, ClipboardCheck, History, Info } from 'lucide-react';

const SIMULATIONS = [
  { key: 'rain',      label: 'Simulate Heavy Rain',       icon: CloudRain, color: '#0ea5e9',   desc: '87.5 mm/hr monsoon surge — threshold: 65 mm/hr',    severity: 'high',     badge: 'badge-blue'   },
  { key: 'pollution', label: 'Simulate AQI Emergency',    icon: Wind,      color: '#f59e0b',  desc: 'AQI 340 hazardous air — threshold: 200 AQI',          severity: 'critical', badge: 'badge-amber'  },
  { key: 'heat',      label: 'Simulate Extreme Heat',     icon: ThermometerSun, color: '#ef4444',   desc: '46.2°C heat wave — threshold: 42°C',                  severity: 'high',     badge: 'badge-rose'   },
  { key: 'flood',     label: 'Simulate Flood Alert',      icon: Waves,     color: '#06b6d4',   desc: '1.4m water level — threshold: 0.5m',                  severity: 'critical', badge: 'badge-cyan'   },
  { key: 'curfew',    label: 'Simulate Zone Curfew',      icon: Ban,       color: '#8b5cf6', desc: 'Civil restriction in zone — income blocked',           severity: 'critical', badge: 'badge-purple' },
];

const STEP_LABELS = {
  done:    { color: 'var(--accent-green)',  bg: 'rgba(16,185,129,.15)' },
  paid:    { color: 'var(--accent-green)',  bg: 'rgba(16,185,129,.2)'  },
  pending: { color: 'var(--accent-amber)',  bg: 'rgba(245,158,11,.15)' },
  blocked: { color: 'var(--accent-rose)',   bg: 'rgba(244,63,94,.15)'  },
  error:   { color: 'var(--accent-rose)',   bg: 'rgba(244,63,94,.15)'  },
  loading: { color: 'var(--text-muted)',    bg: 'var(--bg-card2)'      },
};

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

export default function SimulationPage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [result, setResult]   = useState(null);
  const [running, setRunning] = useState(null); // which sim is running
  const [history, setHistory] = useState([]);

  const run = async (simKey) => {
    if (running) return;
    setRunning(simKey);
    setResult(null);
    try {
      const apiFn = simulate[simKey];
      const r = await apiFn({ city: user?.city, zone: user?.zone });
      setResult({ ...r, simKey });
      setHistory(h => [{ simKey, summary: r.summary, time: new Date().toLocaleTimeString(), success: r.success }, ...h.slice(0, 9)]);
      if (r.payout) {
        toast.success(`💸 ₹${r.payout.amount?.toFixed(0)} auto-credited! TXN: ${r.payout.txnId}`);
        refreshUser();
      } else if (r.claim?.status === 'rejected') {
        toast.error('Fraud detected — payout blocked.');
      } else {
        toast.info('Claim created and queued for review.');
      }
    } catch (e) {
      toast.error(e.message);
    }
    setRunning(null);
  };

  const sim = SIMULATIONS.find(s => s.key === result?.simKey);

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-green)', color: 'var(--accent-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Target size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '.15rem' }}>Simulation Engine</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>
            One-click trigger → full automation: claim filing → AI fraud check → instant payout
          </p>
        </div>
      </div>

      {/* Coverage notice */}
      <div className="alert alert-info" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
        <Info size={18} className="shrink-0" />
        <div>
          <strong>Income Loss Only Coverage</strong> — Simulations demonstrate parametric payout for disruption-caused income loss. No health or vehicle claims.
          <span style={{ display: 'block', fontSize: '.8rem', marginTop: '.2rem', opacity: .8 }}>
            You need an active policy to receive payouts. Go to Policies to create one.
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Simulation buttons */}
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '.95rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Select Disruption Event</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {SIMULATIONS.map(s => (
              <button key={s.key} onClick={() => run(s.key)} disabled={!!running}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem 1.25rem', border: `1px solid ${result?.simKey === s.key ? s.color : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', background: result?.simKey === s.key ? `${s.color}0a` : 'var(--bg-card)',
                  cursor: running ? 'not-allowed' : 'pointer', transition: 'all .2s',
                  opacity: running && running !== s.key ? .5 : 1,
                  fontFamily: 'inherit', textAlign: 'left', width: '100%',
                }}>
                <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card2)', borderRadius: 10, flexShrink: 0, color: result?.simKey === s.key ? s.color : 'inherit' }}>
                  {running === s.key ? <span className="spinner" /> : <s.icon size={22} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '.95rem', marginBottom: '.2rem' }}>{s.label}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
                <span className={`badge ${s.badge}`} style={{ flexShrink: 0 }}>{s.severity}</span>
              </button>
            ))}
          </div>

          {/* Run history */}
          {history.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.5rem' }}>Recent Runs</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                {history.map((h, i) => {
                  const s = SIMULATIONS.find(sim => sim.key === h.simKey);
                  const Icon = s?.icon;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem .75rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', fontSize: '.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {Icon && <Icon size={14} style={{ opacity: 0.8 }} />} 
                        {s?.label}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{h.time}</span>
                      <span style={{ color: h.success ? 'var(--accent-green)' : 'var(--accent-rose)' }}>{h.success ? '✅' : '❌'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Result panel */}
        <div>
          {!result && !running && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--border)', minHeight: '400px' }}>
              <div style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', opacity: 0.3 }}><Target size={64} strokeWidth={1} /></div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '.5rem', color: 'var(--text-primary)' }}>Ready to Simulate</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '.875rem', maxWidth: '280px' }}>Click any disruption event to trigger the full automated pipeline</div>
            </div>
          )}

          {running && !result && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div className="spinner spinner-lg" style={{ margin: '0 auto 1rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Running automated pipeline...</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.5rem' }}>Trigger → Claim → Fraud Check → Payout</div>
            </div>
          )}

          {result && (
            <div className="card page-enter" style={{ padding: '1.25rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--bg-card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: sim?.color }}><sim.icon size={28} /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{result.triggerLabel}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{result.city} · {result.zone}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>Duration</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: '.85rem' }}>
                    {result.automationFlow?.durationMs}ms
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div style={{ marginBottom: '1.25rem' }}>
                {result.steps?.map((step, i) => {
                  const style = STEP_LABELS[step.status] || STEP_LABELS.loading;
                  return (
                    <div key={i}>
                      <div className="step-item">
                        <div>
                          <div className={`step-dot ${step.status}`} style={{ background: style.bg, color: style.color, borderColor: style.color }}>
                            {step.status === 'done' || step.status === 'paid' ? '✓' : step.status === 'blocked' || step.status === 'error' ? '✕' : step.status === 'pending' ? '⏳' : step.step}
                          </div>
                          {i < result.steps.length - 1 && <div className="step-line" />}
                        </div>
                        <div style={{ paddingTop: '.2rem', paddingBottom: i < result.steps.length - 1 ? '.75rem' : 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text-primary)', marginBottom: '.15rem' }}>{step.label}</div>
                          <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{step.detail}</div>
                          {step.fraudData && <FraudBar score={step.fraudData.fraudScore} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary row */}
              <div style={{
                padding: '.9rem 1rem', borderRadius: 'var(--radius-md)',
                background: result.payout ? 'rgba(16,185,129,.08)' : result.claim?.status === 'rejected' ? 'rgba(244,63,94,.08)' : 'rgba(245,158,11,.08)',
                border: `1px solid ${result.payout ? 'rgba(16,185,129,.25)' : result.claim?.status === 'rejected' ? 'rgba(244,63,94,.25)' : 'rgba(245,158,11,.25)'}`,
                fontSize: '.85rem', fontWeight: 600,
                color: result.payout ? 'var(--accent-green)' : result.claim?.status === 'rejected' ? 'var(--accent-rose)' : 'var(--accent-amber)',
              }}>
                {result.summary}
              </div>

              {/* Payout receipt */}
              {result.payout && (
                <div style={{ marginTop: '1rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', padding: '.9rem 1rem' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ClipboardCheck size={14} className="text-green" /> Payment Receipt
                  </div>
                  {[
                    ['TXN ID',   result.payout.txnId],
                    ['Amount',   `₹${result.payout.amount?.toFixed(0)}`],
                    ['UPI ID',   result.payout.upiId],
                    ['Status',   result.payout.status?.toUpperCase()],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{k}</span>
                      <span style={{ color: k === 'Status' ? 'var(--accent-green)' : 'var(--text-primary)', fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Fraud detail */}
              {result.fraud && (
                <div style={{ marginTop: '1rem', background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', padding: '.9rem 1rem' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={14} className="text-amber" /> Fraud Analysis · {result.fraud.fraudLevel}
                  </div>
                  <FraudBar score={result.fraud.fraudScore} />
                  {result.fraud.flags?.length > 0 ? (
                    result.fraud.flags.map((f, i) => (
                      <div key={i} style={{ marginTop: '.5rem', fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--text-secondary)' }}>
                        <span className={`badge ${f.severity === 'CRITICAL' ? 'badge-rose' : f.severity === 'HIGH' ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: '.6rem' }}>{f.severity}</span>
                        {f.detail}
                      </div>
                    ))
                  ) : (
                    <div style={{ marginTop: '.5rem', fontSize: '.78rem', color: 'var(--accent-green)' }}>✅ No fraud signals detected</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
