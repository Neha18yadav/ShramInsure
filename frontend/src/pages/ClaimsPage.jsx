// src/pages/ClaimsPage.jsx — Claims history with trigger check + payout simulation
import { useState, useEffect } from 'react';
import { claims as claimsApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { 
  FileText, Search, History, CheckCircle2, XCircle, 
  AlertTriangle, Clock, Zap, ChevronDown, ChevronUp, 
  Banknote, CloudRain, Wind, ThermometerSun, Waves, 
  CloudLightning, Ban, ShieldCheck, Activity, Fingerprint,
  Library, ThumbsUp
} from 'lucide-react';

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const TRIGGER_ICONS = { 
  WEATHER_RAIN: CloudRain, 
  POLLUTION_AQI: Wind, 
  WEATHER_HEAT: ThermometerSun, 
  FLOOD_ALERT: Waves, 
  WEATHER_STORM: CloudLightning, 
  CIVIL_CURFEW: Ban 
};

const STATUS = {
  paid:     { cls: 'badge-green',  icon: CheckCircle2, label: 'Paid',      color: 'var(--accent-green)'  },
  approved: { cls: 'badge-blue',   icon: ThumbsUp,     label: 'Approved',  color: 'var(--accent-blue)'   },
  pending:  { cls: 'badge-amber',  icon: Clock,        label: 'Pending',   color: 'var(--accent-amber)'  },
  rejected: { cls: 'badge-rose',   icon: XCircle,      label: 'Rejected',  color: 'var(--accent-rose)'   },
};

function FraudMeter({ score }) {
  const color = score >= 0.7 ? 'var(--accent-rose)' : score >= 0.4 ? 'var(--accent-amber)' : 'var(--accent-green)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: '.3rem', fontWeight: 600 }}>
        <span>Fraud Score</span>
        <span style={{ color, fontWeight: 800 }}>{(score * 100).toFixed(0)}/100</span>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-amber)', color: 'var(--accent-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <History size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '.15rem' }}>My Claims</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Auto-triggered income-loss claims · Fraud-screened · Zero paperwork</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={runScan} disabled={scanning}>
          {scanning ? <><span className="spinner" /> Scanning...</> : <><Search size={18} /> Trigger Scan</>}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Claims',     value: stats.total,    icon: FileText,       color: 'var(--text-primary)' },
          { label: 'Paid',             value: stats.paid,     icon: CheckCircle2,   color: 'var(--accent-green)'  },
          { label: 'Pending',          value: stats.pending,  icon: Clock,          color: 'var(--accent-amber)'  },
          { label: 'Total Received',    value: fmt(stats.totalAmt), icon: Banknote, color: 'var(--accent-green)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <Icon size={14} className="opacity-50" />
              <div className="stat-label">{label}</div>
            </div>
            <div className="stat-value" style={{ color, fontSize: '1.25rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['all', 'paid', 'approved', 'pending', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: 8, fontSize: '0.75rem' }}>
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
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--border)' }}>
          <div style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', opacity: 0.3 }}><Library size={64} strokeWidth={1} /></div>
          <div style={{ fontWeight: 600, marginBottom: '.5rem' }}>No claims found</div>
          <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', maxWidth: 400 }}>Claims are auto-filed when disruptions breach thresholds. Use the Simulation page to test.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {filtered.map(c => {
            const st = STATUS[c.status] || { cls: 'badge-gray', icon: Clock, label: c.status, color: 'var(--text-muted)' };
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="card" style={{ padding: '1rem', cursor: 'pointer', borderLeft: `4px solid ${st.color}` }} onClick={() => setExpanded(isOpen ? null : c.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card2)', borderRadius: 10, flexShrink: 0, color: st.color }}>
                    {(() => { const Icon = TRIGGER_ICONS[c.trigger_type] || FileText; return <Icon size={22} />; })()}
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.15rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '.9rem' }}>{c.claim_number}</span>
                      <span className={`badge ${st.cls}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.65rem' }}>
                        <st.icon size={10} strokeWidth={3} /> {st.label.toUpperCase()}
                      </span>
                      {c.auto_triggered === 1 && <span className="badge badge-purple" style={{ fontSize: '.62rem' }}><Zap size={10} fill="currentColor" /> AUTO</span>}
                    </div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
                      {c.trigger_type?.replace(/_/g, ' ')} · {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 'auto', marginRight: '0.5rem' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(c.payout_amount)}</div>
                    {isOpen ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                    <div className="grid grid-2">
                      <div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '.75rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Fingerprint size={14} className="text-amber" /> Analysis
                        </div>
                        <FraudMeter score={c.fraud_score || 0} />
                      </div>
                      <div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '.75rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity size={14} className="text-green" /> Details
                        </div>
                        {c.trigger_value && Object.entries(c.trigger_value).slice(0, 3).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', padding: '.4rem 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                            <span style={{ fontWeight: 700 }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {c.status === 'approved' && (
                      <button className="btn btn-primary btn-block btn-lg mt-4" onClick={() => simulatePayout(c.id)} disabled={payingOut === c.id}>
                        {payingOut === c.id ? '...' : <><Banknote size={16} /> Process Payout</>}
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
