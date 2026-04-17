// src/pages/ClaimsPage.jsx — Claims history with trigger check + payout simulation
import { useState, useEffect } from 'react';
import { claims as claimsApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const TRIGGER_ICONS = { WEATHER_RAIN: '🌧️', POLLUTION_AQI: '💨', WEATHER_HEAT: '🌡️', FLOOD_ALERT: '🌊', WEATHER_STORM: '⛈️', CIVIL_CURFEW: '🚫' };

const STATUS = {
  paid:     { cls: 'badge-green',  label: '✅ Paid',      color: 'var(--accent-green)'  },
  approved: { cls: 'badge-blue',   label: '👍 Approved', color: 'var(--accent-blue)'  },
  pending:  { cls: 'badge-amber',  label: '⏳ Pending',   color: 'var(--accent-amber)'  },
  rejected: { cls: 'badge-rose',   label: '❌ Rejected', color: 'var(--accent-rose)'   },
};

function FraudMeter({ score }) {
  const color = score >= 0.7 ? 'var(--accent-rose)' : score >= 0.4 ? 'var(--accent-amber)' : 'var(--accent-green)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: '.2rem' }}>
        <span>Fraud Score</span>
        <span style={{ color, fontWeight: 700 }}>{(score * 100).toFixed(0)}/100</span>
      </div>
      <div className="risk-bar-track" style={{ height: 5 }}>
        <div className="risk-bar-fill" style={{ width: `${score * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export default function ClaimsPage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [payingOut, setPayingOut] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadClaims(); }, []);

  const loadClaims = async () => {
    setLoading(true);
    try { const r = await claimsApi.list(); setList(r.claims || []); }
    catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const r = await claimsApi.triggerCheck({});
      if (r.claimsCreated > 0) {
        toast.success(`✅ ${r.claimsCreated} new claim(s) auto-created!`);
        refreshUser(); loadClaims();
      } else {
        toast.info(`Scan complete — ${r.triggersDetected} trigger(s), no new claims at this time.`);
      }
    } catch (e) { toast.error(e.message); }
    setScanning(false);
  };

  const simulatePayout = async (id) => {
    setPayingOut(id);
    try {
      const r = await claimsApi.payout(id, {});
      toast.success(`💸 ${fmt(r.amount)} credited! TXN: ${r.txnId}`);
      refreshUser(); loadClaims();
    } catch (e) { toast.error(e.message); }
    setPayingOut(null);
  };

  const filtered = filter === 'all' ? list : list.filter(c => c.status === filter);

  const stats = {
    total:    list.length,
    paid:     list.filter(c => c.status === 'paid').length,
    pending:  list.filter(c => c.status === 'pending').length,
    rejected: list.filter(c => c.status === 'rejected').length,
    totalAmt: list.filter(c => c.status === 'paid').reduce((s, c) => s + c.payout_amount, 0),
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '.25rem' }}>📋 My Claims</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Auto-triggered income-loss claims · Fraud-screened · Zero paperwork</p>
        </div>
        <button className="btn btn-primary" onClick={runScan} disabled={scanning}>
          {scanning ? <><span className="spinner" /> Scanning...</> : '🔍 Trigger Scan'}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Claims',     value: stats.total,    color: 'var(--text-primary)' },
          { label: '✅ Paid',          value: stats.paid,     color: 'var(--accent-green)'  },
          { label: '⏳ Pending',       value: stats.pending,  color: 'var(--accent-amber)'  },
          { label: '💰 Total Received', value: fmt(stats.totalAmt), color: 'var(--accent-green)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'paid', 'approved', 'pending', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' && `(${list.filter(c => c.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Claims list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {Array(3).fill(0).map((_, i) => <div key={i} className="card" style={{ height: 100 }}><div className="skeleton" style={{ height: '100%' }} /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: '.5rem', color: 'var(--text-secondary)' }}>No claims found</div>
          <div style={{ fontSize: '.85rem' }}>Claims are auto-filed when disruptions breach parametric thresholds. Run a trigger scan or use the Simulate page.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {filtered.map(c => {
            const st = STATUS[c.status] || { cls: 'badge-gray', label: c.status, color: 'var(--text-muted)' };
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="card" style={{ padding: '1rem 1.25rem', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : c.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '1.75rem', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card2)', borderRadius: 10, flexShrink: 0 }}>
                    {TRIGGER_ICONS[c.trigger_type] || '📋'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.2rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '.9rem' }}>{c.claim_number}</span>
                      <span className={`badge ${st.cls}`} style={{ fontSize: '.65rem' }}>{st.label}</span>
                      {c.auto_triggered === 1 && <span className="badge badge-purple" style={{ fontSize: '.62rem' }}>⚡ Auto</span>}
                    </div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
                      {c.trigger_type?.replace(/_/g, ' ')} · {c.city} · {new Date(c.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: st.color }}>{fmt(c.payout_amount)}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>Income Loss</div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginLeft: '.25rem' }}>{isOpen ? '▲' : '▼'}</div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Fraud Analysis</div>
                        <FraudMeter score={c.fraud_score || 0} />
                        {c.fraud_flags?.length > 0 && (
                          <div style={{ marginTop: '.5rem' }}>
                            {c.fraud_flags.map((f, i) => (
                              <div key={i} style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: '.25rem' }}>
                                <span className={`badge ${f.severity === 'CRITICAL' ? 'badge-rose' : 'badge-amber'}`} style={{ fontSize: '.6rem', marginRight: '.3rem' }}>{f.severity}</span>
                                {f.detail}
                              </div>
                            ))}
                          </div>
                        )}
                        {!c.fraud_flags?.length && (
                          <div style={{ fontSize: '.78rem', color: 'var(--accent-green)', marginTop: '.4rem' }}>✅ Clean — no fraud signals</div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Trigger Data</div>
                        {c.trigger_value && Object.entries(c.trigger_value).slice(0, 4).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', padding: '.25rem 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {c.status === 'approved' && (
                      <button className="btn btn-primary btn-sm" onClick={() => simulatePayout(c.id)} disabled={payingOut === c.id}>
                        {payingOut === c.id ? <><span className="spinner" /> Processing...</> : '💸 Process Payout'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
