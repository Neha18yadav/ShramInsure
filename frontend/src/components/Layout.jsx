import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LiveBanner from './LiveBanner';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShieldCheck, FileText, Target, 
  Settings, ShieldAlert, Shield, Bike, Brain,
  MapPin, Smartphone, CircleCheck,
  LogOut, Menu, Banknote, X, Bell
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import NotificationPanel from './NotificationPanel';
import { motion, AnimatePresence } from 'framer-motion';

const WORKER_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/policies',  icon: ShieldCheck,     label: 'Policies' },
  { to: '/claims',    icon: FileText,        label: 'Claims' },
  { to: '/simulate',  icon: Target,          label: 'Simulation', color: 'var(--accent-amber)' },
];

const getBrandClass = (platform) => {
  if (!platform || typeof platform !== 'string') return 'brand-generic';
  const p = platform.toLowerCase();
  if (p.includes('zepto'))     return 'brand-zepto';
  if (p.includes('blinkit'))    return 'brand-blinkit';
  if (p.includes('instamart')) return 'brand-instamart';
  if (p.includes('dunzo'))     return 'brand-dunzo';
  return 'brand-generic';
};

const BrandTag = ({ platform, iconOnly = false }) => {
  const cls = getBrandClass(platform);
  if (iconOnly) return <div className={`brand-tag ${cls}`} style={{ width: 8, height: 8, borderRadius: '50%', padding: 0 }} />;
  return <span className={`brand-tag ${cls}`}>{platform || 'Gig Worker'}</span>;
};

const ADMIN_NAV = [
  { section: 'MAIN' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { section: 'MANAGEMENT' },
  { to: '/admin',     icon: Settings, label: 'Admin Portal' },
  { to: '/admin?tab=predictions', icon: Brain, label: 'Predictions' },
  { to: '/admin?tab=lab',         icon: Target, label: 'Disruption Lab' },
  { to: '/admin?tab=fraud',       icon: ShieldAlert, label: 'Infrastructure' },
];

const PLATFORM_STYLE = {
  'Zepto':     { color: '#ffffff', bg: '#5c2c90', border: '#7c3aed' },
  'Blinkit':   { color: '#000000', bg: '#ffdb00', border: '#eab308' },
  'Instamart': { color: '#ffffff', bg: '#fc8019', border: '#f97316' },
  'Dunzo':     { color: '#ffffff', bg: '#00b38a', border: '#10b981' },
};

const riskColor = s => s > 0.65 ? 'var(--accent-rose)' : s > 0.35 ? 'var(--accent-amber)' : 'var(--accent-green)';
const riskLabel = s => s > 0.65 ? 'HIGH RISK' : s > 0.35 ? 'MEDIUM' : 'LOW RISK';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [showNotifs, setShowNotifs] = useState(false);
  const { unreadCount } = useNotifications();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) setIsOpen(true);
      else setIsOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  const risk          = parseFloat(user?.risk_score || 0.5);
  const walletBalance = parseFloat(user?.wallet_balance || 0);
  const isAdmin       = Boolean(user?.is_admin);
  const isAccActive   = user?.accidental_cover_active === 1;
  const months        = parseFloat(user?.premium_paid_months || 0);
  const nav           = isAdmin ? ADMIN_NAV : WORKER_NAV;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative' }}>
      
      {/* ── Sidebar Overlay (Mobile Only) ─────────────────────────────── */}
      {isMobile && isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            zIndex: 1000, animation: 'fadeIn 0.2s ease'
          }} 
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: isOpen ? 255 : (isMobile ? 0 : 72), 
        background: 'var(--bg-card)', 
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: isMobile ? 'fixed' : 'sticky', 
        top: 0, height: '100vh', 
        flexShrink: 0,
        zIndex: 1001,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        left: 0,
        transform: isMobile && !isOpen ? 'translateX(-100%)' : 'translateX(0)'
      }}>
        {/* Brand */}
        <div style={{ 
          padding: '1.25rem 1.2rem', 
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: 'var(--accent-green)'
            }}>
              <Shield size={22} />
            </div>
            
            {isOpen && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', animation: 'fadeIn 0.2s ease' }}>
                <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>ShramInsure</div>
                <div style={{ fontSize: '.63rem', color: 'var(--accent-green)', fontWeight: 700, letterSpacing: '.05em' }}>
                  {isAdmin ? 'ADMIN PANEL' : 'Q-COMMERCE PROTECTION'}
                </div>
              </div>
            )}
          </div>
          {isMobile && (
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* User profile section */}
        <div style={{ padding: '1.5rem 0', margin: '0 1.25rem', display: 'flex', flexDirection: 'column', alignItems: isOpen ? 'flex-start' : 'center', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', width: '100%', justifyContent: isOpen ? 'flex-start' : 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: isAdmin ? 'rgba(139,92,246,.1)' : 'rgba(16,185,129,.1)',
              color: isAdmin ? 'var(--accent-purple)' : 'var(--accent-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '.9rem', border: `1px solid ${isAdmin ? 'rgba(139,92,246,.2)' : 'rgba(16,185,129,.2)'}`
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : (isAdmin ? <Settings size={18} /> : <Bike size={18} />)}
            </div>
            
            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
                <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {user?.name || '—'} 
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {isAdmin ? 'Admin' : <BrandTag platform={user?.platform} />}
                </div>
              </div>
            )}
          </div>

          {isOpen && !isAdmin && (
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ background: 'var(--bg-base)', padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '.35rem', fontWeight: 700 }}>
                  <span>Risk Score</span>
                  <span style={{ color: riskColor(risk) }}>{riskLabel(risk)}</span>
                </div>
                <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${risk * 100}%`, height: '100%', background: riskColor(risk), borderRadius: 2 }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '.65rem .5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
          {nav.map((item, idx) => {
            if (item.section) {
              return isOpen ? (
                <div key={idx} style={{ 
                  padding: '1.25rem 1rem 0.5rem', fontSize: '.65rem', fontWeight: 800, 
                  color: 'var(--text-muted)', letterSpacing: '.08em', animation: 'fadeIn 0.2s ease' 
                }}>
                  {item.section}
                </div>
              ) : <div key={idx} style={{ height: 1, background: 'var(--border)', margin: '1rem 0.5rem' }} />;
            }

            const { to, icon: Icon, label, color } = item;
            const ac = color || '#FFFFFF'; // Default to white
            return (
              <NavLink key={to} to={to} onClick={() => isMobile && setIsOpen(false)} style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', gap: isOpen ? '.7rem' : '0',
                padding: '.6rem .85rem', 
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none', fontSize: '.875rem', fontWeight: 600,
                transition: 'all .15s',
                background: isActive ? 'rgba(255,255,255,.08)' : 'transparent',
                color:      isActive ? '#FFFFFF' : 'var(--text-muted)',
                borderLeft: isActive && isOpen ? `3px solid #FFFFFF` : '3px solid transparent',
              })}>
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
                    {isOpen && <span style={{ whiteSpace: 'nowrap', animation: 'fadeIn 0.2s ease' }}>{label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Wallet + logout */}
        <div style={{ padding: '.9rem .75rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: isOpen ? 'stretch' : 'center', gap: '.5rem' }}>
          {isOpen && !isAdmin && (
            <div style={{ marginBottom: '.25rem' }}>
              <div style={{ 
                background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.18)', 
                borderRadius: 'var(--radius-md)', padding: '.65rem .9rem',
              }}>
                <div style={{ fontSize: '.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '.15rem' }}>WALLET</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-green)' }}>₹{walletBalance.toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}
          
          <button 
            className="btn btn-outline" 
            style={{ 
              padding: '0.6rem', 
              color: 'var(--text-secondary)', 
              borderColor: 'var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isOpen ? 'flex-start' : 'center',
              gap: isOpen ? '0.6rem' : '0'
            }} 
            onClick={handleLogout}
            title={isOpen ? "" : "Sign Out"}
          >
            <LogOut size={18} />
            {isOpen && <span style={{ animation: 'fadeIn 0.2s ease' }}>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Header */}
        <header style={{
          display: 'flex', alignItems: 'center', padding: '0.75rem 1.5rem',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-base)',
          position: 'sticky', top: 0, zIndex: 900
        }}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
              cursor: 'pointer', padding: '0.5rem', borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <Menu size={20} />
          </button>
          
          <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="show-mobile" style={{ fontWeight: 900, fontSize: '1rem' }}>ShramInsure</div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                  cursor: 'pointer', padding: '0.6rem', borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                  boxShadow: showNotifs ? '0 0 15px var(--accent-green)15' : 'none',
                  borderColor: showNotifs ? 'var(--accent-green)80' : 'var(--border)'
                }}
              >
                <Bell size={20} style={{ color: showNotifs ? 'var(--accent-green)' : 'inherit' }} />
                {unreadCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ 
                      scale: 1,
                      boxShadow: [
                        '0 0 0 0px rgba(239, 68, 68, 0.4)',
                        '0 0 0 6px rgba(239, 68, 68, 0)'
                      ]
                    }}
                    transition={{
                      scale: { type: 'spring', damping: 10 },
                      boxShadow: { repeat: Infinity, duration: 1.5 }
                    }}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'var(--accent-rose)', color: '#fff',
                      fontSize: '0.65rem', fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid var(--bg-base)',
                      zIndex: 10
                    }}
                  >
                    {unreadCount}
                  </motion.div>
                )}
              </button>
              
              <NotificationPanel isOpen={showNotifs} onClose={() => setShowNotifs(false)} />
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)' }}></div>
              <span className="hide-mobile">System Online</span>
            </div>
          </div>
        </header>

        <LiveBanner />

        {!isAdmin && walletBalance > 0 && (
          <div style={{
            padding: '.5rem 1.5rem', background: 'rgba(16,185,129,.05)',
            borderBottom: '1px solid rgba(16,185,129,.12)',
            fontSize: '.78rem', color: 'var(--accent-green)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '.5rem',
          }}>
            <Banknote size={16} />
            <span>Auto-credited <strong>₹{walletBalance.toLocaleString('en-IN')}</strong> to UPI</span>
          </div>
        )}

        <div className="container">
          <Outlet />
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
