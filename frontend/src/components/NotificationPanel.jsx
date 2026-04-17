// components/NotificationPanel.jsx — Modern, glassmorphism notifications panel
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext';
import { Bell, X, Check, AlertTriangle, Info, CheckCircle, Trash2 } from 'lucide-react';

const NOTIF_ICONS = {
  alert:   <AlertTriangle size={18} color="var(--accent-rose)" />,
  success: <CheckCircle size={18} color="var(--accent-green)" />,
  info:    <Info size={18} color="var(--accent-blue)" />,
};

const NOTIF_BGS = {
  alert:   'rgba(239, 68, 68, 0.08)',
  success: 'rgba(16, 185, 129, 0.08)',
  info:    'rgba(59, 130, 246, 0.08)',
};

export default function NotificationPanel({ isOpen, onClose }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)'
            }}
            className="show-mobile"
          />

          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              position: 'absolute', top: 'calc(100% + 12px)', right: 0,
              width: 'min(400px, 90vw)', maxHeight: '70vh',
              background: 'rgba(23, 23, 23, 0.85)',
              backdropFilter: 'blur(16px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)',
              zIndex: 1001,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ 
              padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Notifications</h3>
                <p style={{ fontSize: '.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                  {unreadCount > 0 ? `You have ${unreadCount} unread alerts` : 'No new messages'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={markAllAsRead}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-green)', fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', padding: '0.25rem' }}
                >
                  Mark all as read
                </button>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="hide-scrollbar">
              <AnimatePresence initial={false}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ marginBottom: '1rem' }}><Bell size={40} strokeWidth={1} style={{ opacity: 0.2 }} /></div>
                    <p style={{ fontSize: '.9rem' }}>All caught up!</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      layout
                      style={{
                        padding: '1rem', borderRadius: '14px', marginBottom: '0.5rem',
                        background: n.read ? 'transparent' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${n.read ? 'transparent' : 'rgba(255,255,255,0.05)'}`,
                        position: 'relative', transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ 
                          width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
                          background: NOTIF_BGS[n.type], display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {NOTIF_ICONS[n.type]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h4 style={{ fontSize: '.9rem', fontWeight: 700, color: n.read ? 'rgba(255,255,255,0.6)' : '#fff' }}>{n.title}</h4>
                            <span style={{ fontSize: '.65rem', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{n.time}</span>
                          </div>
                          <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,0.45)', marginTop: '4px', lineHeight: 1.4 }}>{n.message}</p>
                        </div>
                      </div>
                      
                      {/* Read Indicator */}
                      {!n.read && (
                        <div style={{ position: 'absolute', top: 12, left: 12, width: 8, height: 8, background: 'var(--accent-green)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent-green)' }} />
                      )}

                      {/* Delete Button */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                        className="notif-delete"
                        style={{
                          position: 'absolute', right: 8, bottom: 8, 
                          background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.2)',
                          padding: '4px', cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <button 
                className="btn btn-outline btn-sm btn-block"
                style={{ fontSize: '.75rem', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)' }}
                onClick={onClose}
              >
                Close Panel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
