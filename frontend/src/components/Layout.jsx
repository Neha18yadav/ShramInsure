// src/components/Layout.jsx — Sidebar + top bar shell
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LiveBanner from './LiveBanner';
import { useState } from 'react';

const NAV = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/policies',  icon: '🛡️', label: 'Policies' },
  { to: '/claims',    icon: '📋', label: 'Claims' },
  { to: '/simulate',  icon: '🎯', label: 'Simulate' },
];

const riskColor = s => s > 0.65 ? 'var(--accent-rose)' : s > 0.35 ? 'var(--accent-amber)' : 'var(--accent-green)';
const riskLabel = s => s > 0.65 ? 'HIGH' : s > 0.35 ? 'MEDIUM' : 'LOW';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [open, setOpen]  = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const risk    = user?.risk_score || 0.5;
  const months  = user?.premium_paid_months || 0;
  const accMonths = Math.max(0, 12 - months);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: 260, background: 'var(--bg-card)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--grad-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
            }}>🛡️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>ShramInsure</div>
              <div style={{ fontSize: '.7rem', color: 'var(--accent-green)', fontWeight: 600, letterSpacing: '.04em' }}>INCOME PROTECTION</div>
            </div>
          </div>
        </div>

        {/* Worker card */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'rgba(16,185,129,.04)' }}>
          <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '.4rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Logged In As</div>
          <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--text-primary)', marginBottom: '.2rem' }}>{user?.name || 'Worker'}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: '.75rem' }}>📱 {user?.phone} · {user?.platform}</div>

          {/* Risk meter */}
          <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: '.3rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Risk Score</span>
            <span style={{ color: riskColor(risk), fontWeight: 700 }}>{riskLabel(risk)}</span>
          </div>
          <div className="risk-bar-track">
            <div className="risk-bar-fill" style={{ width: `${risk * 100}%`, background: riskColor(risk) }} />
          </div>

          {/* Accidental cover progress */}
          {!user?.accidental_cover_active && (
            <div style={{ marginTop: '.75rem' }}>
              <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: '.3rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Accidental Cover</span>
                <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{accMonths.toFixed(0)} mo left</span>
              </div>
              <div className="risk-bar-track">
                <div className="risk-bar-fill" style={{ width: `${Math.min((months / 12) * 100, 100)}%`, background: 'var(--accent-amber)' }} />
              </div>
            </div>
          )}
          {user?.accidental_cover_active === 1 && (
            <div style={{ marginTop: '.75rem', fontSize: '.72rem', color: 'var(--accent-green)', fontWeight: 700 }}>✅ Accidental Cover Active</div>
          )}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '.75rem' }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '.75rem',
              padding: '.65rem .9rem', borderRadius: 'var(--radius-md)',
              marginBottom: '.2rem', textDecoration: 'none', fontSize: '.9rem', fontWeight: 600,
              transition: 'all .15s',
              background: isActive ? 'rgba(16,185,129,.12)' : 'transparent',
              color:      isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
              borderLeft: isActive ? '3px solid var(--accent-green)' : '3px solid transparent',
            })}>
              <span style={{ fontSize: '1.1rem' }}>{icon}</span>
              {label}
            </NavLink>
          ))}

          {user?.is_admin && (
            <NavLink to="/admin" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '.75rem',
              padding: '.65rem .9rem', borderRadius: 'var(--radius-md)',
              marginBottom: '.2rem', textDecoration: 'none', fontSize: '.9rem', fontWeight: 600,
              transition: 'all .15s',
              background: isActive ? 'rgba(139,92,246,.12)' : 'transparent',
              color:      isActive ? 'var(--accent-purple)' : 'var(--text-secondary)',
              borderLeft: isActive ? '3px solid var(--accent-purple)' : '3px solid transparent',
            })}>
              <span style={{ fontSize: '1.1rem' }}>⚙️</span>Admin
            </NavLink>
          )}
        </nav>

        {/* Wallet + logout */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 'var(--radius-md)', padding: '.75rem 1rem', marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: '.2rem', fontWeight: 600 }}>WALLET BALANCE</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-green)' }}>₹{(user?.wallet_balance || 0).toFixed(0)}</div>
          </div>
          <button className="btn btn-outline btn-sm btn-block" onClick={handleLogout}>🚪 Sign Out</button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <LiveBanner />
        {/* Story UX: savings message for workers */}
        {user && !user.is_admin && (user.wallet_balance || 0) > 0 && (
          <div style={{
            padding: '.55rem 1.5rem',
            background: 'rgba(16,185,129,.06)',
            borderBottom: '1px solid rgba(16,185,129,.12)',
            fontSize: '.8rem', color: 'var(--accent-green)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '.5rem',
          }}>
            <span>💚</span>
            <span>ShramInsure has protected <strong>₹{Number(user.wallet_balance).toLocaleString('en-IN')}</strong> of your income so far — parametric payouts, zero paperwork.</span>
          </div>
        )}
        <div style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
