// src/components/LiveBanner.jsx — Real-time system status banner
// Shows scheduler status, active triggers, last payout — creates "live" feel
import { useState, useEffect } from 'react';
import { admin } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Activity, FileCheck, CreditCard, Crosshair } from 'lucide-react';

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
      display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
      padding: '.45rem 1.25rem',
      background: 'rgba(16,185,129,.03)',
      borderBottom: '1px solid rgba(16,185,129,.1)',
      fontSize: '.72rem', color: 'var(--text-secondary)',
      backdropFilter: 'blur(8px)'
    }}>
      <style>{`@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.3)} }`}</style>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', paddingRight: '1rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={PULSE_STYLE} />
        <span style={{ color: 'var(--accent-green)', fontWeight: 800, letterSpacing: '.05em' }}>LIVE</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Automation Engine</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
        <Activity size={12} className="text-muted" />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Cycle #{status.totalRunCount}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
        <FileCheck size={12} className="text-muted" />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Claims: {status.totalClaimsAuto}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
        <CreditCard size={12} className="text-muted" />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Payouts: {status.totalPayoutsAuto}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
        <Crosshair size={12} className="text-muted" />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Monitoring: {status.monitoredCities?.length} Cities</span>
      </div>

      {status.lastRunAt && (
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '.68rem' }}>
          Last scan: {new Date(status.lastRunAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · Next in {status.nextRunIn}
        </span>
      )}
    </div>
  );
}
