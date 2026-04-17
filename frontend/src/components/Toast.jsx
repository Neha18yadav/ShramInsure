// src/components/Toast.jsx — Global toast notification system
import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const toast = {
    success: (m, d) => add(m, 'success', d),
    error:   (m, d) => add(m, 'error',   d),
    warning: (m, d) => add(m, 'warning', d),
    info:    (m, d) => add(m, 'info',    d),
  };

  const icons = { 
    success: <CheckCircle size={18} />, 
    error:   <AlertCircle size={18} />, 
    warning: <AlertTriangle size={18} />, 
    info:    <Info size={18} /> 
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`} style={{ opacity: 1 }}>
            <span style={{ display: 'flex' }}>{icons[t.type]}</span>
            <span style={{ flex: 1, paddingRight: '0.5rem' }}>{t.message}</span>
            <button onClick={() => setToasts(x => x.filter(i => i.id !== t.id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', opacity: 0.6 }}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

export const useToast = () => useContext(ToastCtx);
