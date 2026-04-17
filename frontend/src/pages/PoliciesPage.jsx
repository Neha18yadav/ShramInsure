// src/pages/PoliciesPage.jsx — Policy management with AI quote and persona
import { useState, useEffect } from 'react';
import { policies as policiesApi, detectCity } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import CitySelect from '../components/CitySelect';
import { 
  ShieldCheck, LayoutDashboard, Brain, Rocket, Ban, Info, 
  Sparkles, ShieldAlert, FileX, ShieldPlus, 
  MapPin, Calendar, ClipboardList, Target
} from 'lucide-react';

const ZONES  = ['Central', 'North', 'South', 'East', 'West', 'Suburbs'];

function Skeleton({ h = 20 }) { return <div className="skeleton" style={{ height: h, borderRadius: 6 }} />; }

const fmt   = n => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const riskColor = s => s > 0.65 ? 'var(--accent-rose)' : s > 0.35 ? 'var(--accent-amber)' : 'var(--accent-green)';

const STATUS_COLORS = {
  active:    { bg: 'rgba(16,185,129,.1)', color: 'var(--accent-green)', border: 'rgba(16,185,129,.3)' },
  expired:   { bg: 'rgba(100,116,139,.1)', color: 'var(--text-secondary)', border: 'var(--border2)' },
  cancelled: { bg: 'rgba(244,63,94,.1)', color: 'var(--accent-rose)', border: 'rgba(244,63,94,.3)' },
};

export default function PoliciesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quote, setQuote]     = useState(null);
  
  const [form, setForm]       = useState({ city: user?.city || 'Mumbai', zone: user?.zone || 'Central', weeks: 4 });
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoCity, setGeoCity] = useState(null);
  
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => { loadPolicies(); }, []);

  // Auto-detect city for workers if no active policy
  useEffect(() => {
    if (!user?.is_admin) {
      setGeoLoading(true);
      detectCity().then(c => {
        if (c) {
          setGeoCity(c);
          setForm(f => ({ ...f, city: c }));
        }
      }).catch(() => {}).finally(() => setGeoLoading(false));
    }
  }, [user]);

  const loadPolicies = async () => {
    setLoading(true);
    try { const r = await policiesApi.list(); setList(r.policies || []); }
    catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const getQuote = async () => {
    setQuoting(true); setQuote(null);
    try {
      const r = await policiesApi.quote({ city: form.city, zone: form.zone });
      setQuote(r.quote);
      toast.info(`AI Quote: ${fmt(r.quote.weeklyPremium)}/week — ${r.quote.persona}`);
    } catch (e) { toast.error(e.message); }
    setQuoting(false);
  };

  const createPolicy = async () => {
    setCreating(true);
    try {
      const r = await policiesApi.create({ city: form.city, zone: form.zone, weeks: form.weeks });
      toast.success(`Policy ${r.policy.policy_number} created!`);
      setQuote(null);
      loadPolicies();
    } catch (e) { toast.error(e.message); }
    setCreating(false);
  };

  const cancelPolicy = async (id) => {
    setCancelling(id);
    try {
      await policiesApi.cancel(id);
      toast.success('Policy cancelled.');
      loadPolicies();
    } catch (e) { toast.error(e.message); }
    setCancelling(null);
  };

  const activePolicy = list.find(p => p.status === 'active' && new Date(p.end_date) > new Date());

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-green)', color: 'var(--accent-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '.15rem' }}>My Policies</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Income Loss Only · Weekly parametric protection · Auto-claim on disruptions</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Quote / Create form */}
        <div className="card">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activePolicy ? <><ShieldCheck size={18} className="text-green" /> Active Policy</> : <><Sparkles size={18} className="text-amber" /> Get AI Quote</>}
          </h3>

          {activePolicy ? (
            <>
              <div style={{ background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '.3rem' }}>POLICY NUMBER</div>
                <div style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '1.05rem' }}>{activePolicy.policy_number}</div>
              </div>
              {[
                ['Coverage / Week', fmt(activePolicy.coverage_amount), 'var(--accent-green)'],
                ['Weekly Premium',  fmt(activePolicy.weekly_premium),  'var(--accent-blue)'],
                ['Coverage Type',   'Income Loss Only',                 'var(--accent-amber)'],
                ['Risk Score',      `${(activePolicy.risk_score * 100).toFixed(0)}%`,       riskColor(activePolicy.risk_score)],
                ['City / Zone',     `${activePolicy.city} / ${activePolicy.zone}`,          'var(--text-secondary)'],
                ['Expires',         new Date(activePolicy.end_date).toLocaleDateString('en-IN'), 'var(--text-secondary)'],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontSize: '.85rem', fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
              <button className="btn btn-danger btn-block btn-sm" style={{ marginTop: '1rem' }}
                onClick={() => cancelPolicy(activePolicy.id)} disabled={cancelling === activePolicy.id}>
                {cancelling === activePolicy.id ? <><span className="spinner" /> Cancelling...</> : <><Ban size={16} /> Cancel Policy</>}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginBottom: '1rem' }}>
                <CitySelect value={form.city} onChange={c => setForm(f => ({ ...f, city: c }))} label="City" geoCity={geoCity} geoLoading={geoLoading} />
                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> Zone</label>
                    <select className="input" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                      {ZONES.map(z => <option key={z}>{z}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Duration</label>
                    <select className="input" value={form.weeks} onChange={e => setForm(f => ({ ...f, weeks: e.target.value }))}>
                      {[1, 2, 4, 8, 12].map(w => <option key={w} value={w}>{w} week{w > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <button className="btn btn-blue btn-block" onClick={getQuote} disabled={quoting} style={{ marginBottom: '.75rem' }}>
                {quoting ? <><span className="spinner" /> Getting quote...</> : <><Brain size={18} /> Get AI Quote</>}
              </button>
              {quote && (
                <div style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '.75rem' }}>
                  <div style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '1.25rem', marginBottom: '.25rem' }}>{fmt(quote.weeklyPremium)}/week</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.5rem', lineHeight: 1.4 }}>{quote.persona}</div>
                  <button className="btn btn-primary btn-block" onClick={createPolicy} disabled={creating}>
                    {creating ? <><span className="spinner" /> Creating...</> : <><Rocket size={18} /> Create Policy</>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Policy list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-secondary)' }}>All Policies ({list.length})</h3>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {Array(3).fill(0).map((_, i) => <div key={i} className="card"><Skeleton h={100} /></div>)}
            </div>
          ) : !list.length ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '2px dashed var(--border)' }}>
              <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', opacity: 0.3 }}><ShieldPlus size={48} /></div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No policies found</div>
              <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Get your first policy with an AI quote</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {list.map(p => {
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.expired;
                return (
                  <div key={p.id} className="card" style={{ border: `1px solid ${sc.border}`, padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem' }}>{p.policy_number}</div>
                      <span className="badge" style={{ background: sc.bg, color: sc.color, fontWeight: 700, fontSize: '0.65rem' }}>{p.status.toUpperCase()}</span>
                    </div>
                    <div className="grid grid-3" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ background: 'var(--bg-card2)', padding: '0.5rem', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>COVERAGE</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{fmt(p.coverage_amount)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card2)', padding: '0.5rem', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>PREMIUM</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{fmt(p.weekly_premium)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card2)', padding: '0.5rem', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>RISK</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{(p.risk_score * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>Started: {new Date(p.start_date).toLocaleDateString()}</span>
                      <span>Ends: {new Date(p.end_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
