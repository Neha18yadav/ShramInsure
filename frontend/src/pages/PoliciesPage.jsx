// src/pages/PoliciesPage.jsx — Policy management with AI quote and persona
import { useState, useEffect } from 'react';
import { policies as policiesApi, risk as riskApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];
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
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => { loadPolicies(); }, []);

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
      toast.success(`Policy ${r.policy.policy_number} created! 🛡️`);
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
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '.25rem' }}>🛡️ My Policies</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Income Loss Only · Weekly parametric protection · Auto-claim on disruptions</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Quote / Create form */}
        <div className="card">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>
            {activePolicy ? '📋 Active Policy' : '+ Get AI Quote'}
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
                {cancelling === activePolicy.id ? <><span className="spinner" /> Cancelling...</> : '⛔ Cancel Policy'}
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="label">🏙️ City</label>
                <select className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">📍 Zone</label>
                <select className="input" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                  {ZONES.map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">📅 Duration (weeks)</label>
                <select className="input" value={form.weeks} onChange={e => setForm(f => ({ ...f, weeks: e.target.value }))}>
                  {[1, 2, 4, 8, 12].map(w => <option key={w} value={w}>{w} week{w > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <button className="btn btn-blue btn-block" onClick={getQuote} disabled={quoting} style={{ marginBottom: '.75rem' }}>
                {quoting ? <><span className="spinner" /> Getting AI Quote...</> : '🧠 Get AI Quote'}
              </button>
              {quote && (
                <div style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '.75rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: '1.05rem', marginBottom: '.5rem' }}>
                    {fmt(quote.weeklyPremium)}/week
                  </div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginBottom: '.5rem' }}>
                    Coverage: <strong style={{ color: 'var(--text-primary)' }}>{fmt(quote.coverageAmount)}/week</strong> income loss · {quote.persona}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>📋 Coverage Type: {quote.coverageType?.replace(/_/g, ' ')}</div>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    {Object.entries(quote.breakdown || {}).slice(0, 3).map(([k, v]) => (
                      <span key={k} className="badge badge-gray" style={{ fontSize: '.65rem' }}>
                        {k.replace(/([A-Z])/g, ' $1').trim()}: {typeof v === 'number' ? `₹${v}` : v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {quote && (
                <button className="btn btn-primary btn-block" onClick={createPolicy} disabled={creating}>
                  {creating ? <><span className="spinner" /> Creating...</> : '🚀 Create Policy'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Policy list */}
        <div>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            All Policies ({list.length})
          </h3>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {Array(3).fill(0).map((_, i) => <div key={i} className="card"><Skeleton h={100} /></div>)}
            </div>
          ) : list.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📄</div>
              <div style={{ fontWeight: 600, marginBottom: '.5rem' }}>No policies yet</div>
              <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Get an AI quote and create your first policy</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {list.map(p => {
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.expired;
                return (
                  <div key={p.id} className="card" style={{ border: `1px solid ${sc.border}`, padding: '1.1rem 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '.2rem' }}>{p.policy_number}</div>
                        <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{p.city} · {p.zone}</div>
                      </div>
                      <span style={{ padding: '.2rem .7rem', borderRadius: 9999, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: '.72rem', fontWeight: 700 }}>
                        {p.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem' }}>
                      {[
                        ['Coverage', fmt(p.coverage_amount)],
                        ['Premium', fmt(p.weekly_premium) + '/wk'],
                        ['Risk', `${(p.risk_score * 100).toFixed(0)}%`],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-card2)', borderRadius: 6, padding: '.4rem .6rem' }}>
                          <div style={{ fontSize: '.65rem', color: 'var(--text-muted)', marginBottom: '.15rem' }}>{k}</div>
                          <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.6rem' }}>
                      <span>From: {new Date(p.start_date).toLocaleDateString('en-IN')}</span>
                      <span>To: {new Date(p.end_date).toLocaleDateString('en-IN')}</span>
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
