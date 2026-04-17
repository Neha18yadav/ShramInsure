// src/components/LiveBanner.jsx — Real-time system status banner
// Shows scheduler status, active triggers, last payout — creates "live" feel
import { useState, useEffect } from 'react';
import { admin } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PULSE_STYLE = {
  width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)',
  animation: 'livePulse 1.5s ease infinite', flexShrink: 0,
};

export default function LiveBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [tick, setTick]     = useState(0);

  useEffect(() => {
    // Only admins can call /admin/scheduler/status
    if (!user?.is_admin) return;
    const poll = async () => {
      try { const r = await admin.schedulerStatus(); setStatus(r); } catch {}
    };
    poll();
    const iv = setInterval(() => { poll(); setTick(t => t + 1); }, 30000);
    return () => clearInterval(iv);
  }, [user]);

  if (!user?.is_admin || !status) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
      padding: '.55rem 1.1rem',
      background: 'rgba(16,185,129,.04)',
      borderBottom: '1px solid rgba(16,185,129,.12)',
      fontSize: '.78rem', color: 'var(--text-secondary)',
    }}>
      <style>{`@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <div style={PULSE_STYLE} />
        <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>LIVE</span>
        <span>Automation Engine Running</span>
      </div>
      <span>⏱️ Cycle #{status.totalRunCount}</span>
      <span>📋 Auto-claims: {status.totalClaimsAuto}</span>
      <span>💸 Auto-payouts: {status.totalPayoutsAuto}</span>
      <span>🌆 Monitoring: {status.monitoredCities?.join(', ')}</span>
      {status.lastRunAt && (
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
          Last scan: {new Date(status.lastRunAt).toLocaleTimeString('en-IN')} · Next in {status.nextRunIn}
        </span>
      )}
    </div>
  );
}
