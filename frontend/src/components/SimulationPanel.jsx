// SimulationPanel.jsx — Full demo flow: click trigger → watch it happen step by step
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';

const SIMULATIONS = [
  { id: 'rain',       label: 'Heavy Rain',    icon: '🌧', color: '#60a5fa', desc: '87.5 mm/hr', endpoint: '/simulate/rain' },
  { id: 'pollution',  label: 'AQI Emergency', icon: '💨', color: '#a78bfa', desc: 'AQI 340',    endpoint: '/simulate/pollution' },
  { id: 'curfew',     label: 'Zone Curfew',   icon: '🚫', color: '#f87171', desc: 'Civil block', endpoint: '/simulate/curfew' },
  { id: 'flood',      label: 'Flood Alert',   icon: '🌊', color: '#38bdf8', desc: '1.4m water', endpoint: '/simulate/flood' },
  { id: 'heat',       label: 'Extreme Heat',  icon: '🌡', color: '#fb923c', desc: '46.2°C',     endpoint: '/simulate/heat' },
];

const STEP_COLORS = { done: '#00ff87', blocked: '#ef4444', pending: '#eab308', paid: '#00ff87' };

export default function SimulationPanel({ onComplete }) {
  const [running, setRunning]   = useState(null);
  const [result,  setResult]    = useState(null);
  const [steps,   setSteps]     = useState([]);
  const [showResult, setShowResult] = useState(false);

  const runSim = async (sim) => {
    setRunning(sim.id);
    setResult(null);
    setSteps([]);
    setShowResult(false);

    // Animate steps in progressively
    const fakeStepLabels = [
      { label: 'Disruption Detected',       icon: sim.icon },
      { label: 'Trigger Logged to Ledger',   icon: '📝' },
      { label: 'Worker Activity Verified',   icon: '✅' },
      { label: 'Income Loss Calculated',     icon: '💰' },
      { label: 'Fraud Analysis Running…',    icon: '🔍' },
      { label: 'Claim Auto-Filed',           icon: '📋' },
      { label: 'Processing Payout…',         icon: '💸' },
    ];

    // Show fake loading steps while API processes
    for (let i = 0; i < fakeStepLabels.length; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? 100 : 380));
      setSteps(prev => [...prev, { ...fakeStepLabels[i], status: 'loading', step: i + 1 }]);
    }

    try {
      const { data } = await api.post(sim.endpoint, {});
      // Replace loading steps with real data
      setSteps(data.steps);
      setResult(data);
      setShowResult(true);

      if (data.payout) {
        toast.success(`₹${data.payout.amount.toFixed(0)} credited! TXN: ${data.payout.txnId}`, {
          duration: 6000,
          icon: '💸',
          style: { background: '#0a1a0a', border: '1px solid #00ff87', color: '#00ff87', fontFamily: 'Space Mono', fontSize: 12 },
        });
      } else if (data.claim?.status === 'rejected') {
        toast.error('Fraud detected — payout blocked', { duration: 4000 });
      } else {
        toast('Claim queued for review', { icon: '⏳', duration: 4000 });
      }

      if (onComplete) onComplete(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Simulation failed');
      setSteps([]);
    } finally {
      setRunning(null);
    }
  };

  const reset = () => { setResult(null); setSteps([]); setShowResult(false); };

  return (
    <div style={{ padding: '20px 24px', borderRadius: 12, background: 'var(--surface-1)', border: '1px solid rgba(0,255,135,0.12)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 9, color: 'var(--green)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
            🎯 Disaster Simulation Engine
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Zero-Touch Claim Demo
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
            Click any disruption to watch the full automated pipeline
          </div>
        </div>
        {result && (
          <button onClick={reset} style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↺ Reset
          </button>
        )}
      </div>

      {/* Simulation buttons */}
      <div className="grid grid-responsive" style={{ gap: 10, marginBottom: steps.length > 0 ? 20 : 0 }}>
        {SIMULATIONS.map(sim => (
          <motion.button key={sim.id} whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => !running && runSim(sim)}
            disabled={!!running}
            style={{
              padding: '14px 10px', borderRadius: 10, textAlign: 'center', cursor: running ? 'not-allowed' : 'pointer',
              background: running === sim.id ? `${sim.color}15` : 'var(--surface-2)',
              border: `1px solid ${running === sim.id ? sim.color + '40' : 'var(--border)'}`,
              opacity: running && running !== sim.id ? 0.45 : 1,
              transition: 'all 0.15s', fontFamily: 'inherit',
            }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>
              {running === sim.id ? (
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  style={{ display: 'inline-block' }}>⚡</motion.span>
              ) : sim.icon}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: running === sim.id ? sim.color : 'var(--text-primary)', lineHeight: 1.3 }}>{sim.label}</div>
            <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>{sim.desc}</div>
          </motion.button>
        ))}
      </div>

      {/* Pipeline steps */}
      <AnimatePresence>
        {steps.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
                Pipeline Execution
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((step, i) => {
                  const color = STEP_COLORS[step.status] || '#60a5fa';
                  const isLoading = step.status === 'loading';
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
                        background: isLoading ? 'var(--surface-2)' : step.status === 'paid' ? 'rgba(0,255,135,0.05)' : step.status === 'blocked' ? 'rgba(239,68,68,0.05)' : 'var(--surface-2)',
                        border: `1px solid ${isLoading ? 'var(--border)' : color + '30'}`,
                      }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: isLoading ? 'var(--surface-3)' : `${color}18`,
                        border: `1px solid ${isLoading ? 'var(--border)' : color + '40'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        {isLoading ? (
                          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            style={{ display: 'inline-block', fontSize: 12 }}>⟳</motion.span>
                        ) : step.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isLoading ? 'var(--text-muted)' : color, marginBottom: 2 }}>
                          {step.label}
                        </div>
                        {step.detail && !isLoading && (
                          <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{step.detail}</div>
                        )}
                      </div>
                      <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {String(step.step).padStart(2, '0')}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Result card */}
            <AnimatePresence>
              {showResult && result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 18, padding: '18px 20px', borderRadius: 12,
                    background: result.payout ? 'rgba(0,255,135,0.05)' : result.claim?.status === 'rejected' ? 'rgba(239,68,68,0.05)' : 'rgba(234,179,8,0.05)',
                    border: `1px solid ${result.payout ? 'rgba(0,255,135,0.2)' : result.claim?.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'}`,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: result.payout ? '#00ff87' : result.claim?.status === 'rejected' ? '#f87171' : '#fbbf24' }}>
                        {result.summary}
                      </div>
                      <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                        Claim: {result.claim?.claimNumber} · Status: {result.claim?.status?.toUpperCase()}
                        {result.payout && ` · TXN: ${result.payout.txnId}`}
                      </div>
                    </div>
                    {result.payout && (
                      <div style={{ textAlign: 'right' }}>
                        <div className="font-syne" style={{ fontSize: 28, fontWeight: 900, color: '#00ff87', lineHeight: 1 }}>
                          ₹{result.payout.amount.toFixed(0)}
                        </div>
                        <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>CREDITED TO WALLET</div>
                      </div>
                    )}
                  </div>
                  {result.fraud && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4,
                        background: result.fraud.fraudScore < 0.4 ? 'rgba(0,255,135,0.08)' : 'rgba(249,115,22,0.08)',
                        border: `1px solid ${result.fraud.fraudScore < 0.4 ? 'rgba(0,255,135,0.2)' : 'rgba(249,115,22,0.2)'}`,
                        color: result.fraud.fraudScore < 0.4 ? '#00ff87' : '#fb923c', letterSpacing: '0.06em' }}>
                        🔍 Fraud Score: {(result.fraud.fraudScore * 100).toFixed(0)}/100
                      </span>
                      <span className="font-mono" style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4,
                        background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', letterSpacing: '0.06em' }}>
                        🛡️ {result.fraud.decision}
                      </span>
                      {result.walletBalance !== undefined && (
                        <span className="font-mono" style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4,
                          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', letterSpacing: '0.06em' }}>
                          💰 New Balance: ₹{Number(result.walletBalance).toFixed(0)}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
