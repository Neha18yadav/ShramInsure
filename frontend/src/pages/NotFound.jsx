import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ maxWidth: '500px' }}
      >
        <div style={{ 
          display: 'inline-flex', 
          padding: '2rem', 
          background: 'rgba(244, 63, 94, 0.08)', 
          borderRadius: '30px', 
          color: 'var(--accent-rose)',
          marginBottom: '2rem',
          border: '1px solid rgba(244, 63, 94, 0.2)'
        }}>
          <ShieldAlert size={80} strokeWidth={1} />
        </div>
        
        <h1 style={{ 
          fontSize: '3rem', 
          fontWeight: 900, 
          marginBottom: '1rem', 
          fontFamily: 'var(--font-serif)',
          color: 'var(--text-primary)'
        }}>
          404. Lost in Delivery.
        </h1>
        
        <p style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '1.1rem', 
          lineHeight: 1.6, 
          marginBottom: '2.5rem' 
        }}>
          The page you're looking for was either delivered to the wrong address or never existed in our manifest.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button 
            className="btn btn-outline"
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={18} /> Go Back
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Home size={18} /> Home Console
          </button>
        </div>
      </motion.div>
    </div>
  );
}
