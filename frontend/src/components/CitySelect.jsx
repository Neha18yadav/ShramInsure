import { useState, useEffect, useRef } from 'react';
import { geo } from '../utils/api';
import { Building2, MapPin, Loader2 } from 'lucide-react';

export default function CitySelect({ value, onChange, label = 'City', geoCity, geoLoading }) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const [cities, setCities] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    geo.cities().then(r => setCities(r.cities || [])).catch(() => {
      setCities([
        'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Pune','Kolkata',
        'Ahmedabad','Jaipur','Surat','Lucknow','Nagpur','Indore','Bhopal',
        'Patna','Vadodara','Gurgaon','Noida','Chandigarh','Kochi','Visakhapatnam',
      ].map(c => ({ city: c })));
    });
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? cities.filter(c => c.city.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : cities.slice(0, 8);

  if (!isEditing && value) {
    return (
      <div className="form-group" style={{ position: 'relative' }}>
        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Building2 size={14} className="label-icon" style={{ color: 'var(--accent-green)' }} /> {label}
        </label>
        <div 
          className="input" 
          onClick={() => setIsEditing(true)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '0.45rem 1rem', height: '41.5px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', overflow: 'hidden' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><MapPin size={16} /> {value}</span>
            {geoCity === value && <span className="badge badge-green" style={{ fontSize: '.6rem', padding: '.15rem .4rem', whiteSpace: 'nowrap', fontWeight: 700 }}>Auto</span>}
          </div>
          <span style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', opacity: 0.7, whiteSpace: 'nowrap' }}>Edit</span>
        </div>
      </div>
    );
  }

  return (
    <div className="form-group" ref={ref} style={{ position: 'relative' }}>
      <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Building2 size={14} className="label-icon" style={{ color: 'var(--accent-green)' }} /> {label}
        {geoLoading && <span style={{ marginLeft: '.4rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.65rem', color: 'var(--accent-amber)' }}><Loader2 size={12} className="spinner" /> detecting…</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          placeholder="Type any city…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          style={{ paddingRight: '2rem' }}
        />
        {query && (
          <button type="button" style={{ position: 'absolute', right: '.5rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 }}
            onClick={() => { onChange(query); setQuery(''); setOpen(false); setIsEditing(false); }}>
            Apply
          </button>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--bg-card)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          maxHeight: 220, overflowY: 'auto', marginTop: 4,
        }}>
          {filtered.length === 0
            ? <div style={{ padding: '.75rem 1rem', color: 'var(--text-muted)', fontSize: '.85rem' }}>No cities found</div>
            : filtered.map(c => (
                <div key={c.city}
                  onClick={() => { onChange(c.city); setQuery(''); setOpen(false); setIsEditing(false); }}
                  style={{
                    padding: '.6rem 1rem', cursor: 'pointer', fontSize: '.875rem',
                    color: c.city === value ? 'var(--accent-green)' : 'var(--text-primary)',
                    background: c.city === value ? 'rgba(34,197,94,.08)' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card2)'}
                  onMouseLeave={e => e.currentTarget.style.background = c.city === value ? 'rgba(34,197,94,.08)' : 'transparent'}
                >
                  {c.city}
                  {c.state && <span style={{ marginLeft: '.5rem', fontSize: '.72rem', color: 'var(--text-muted)' }}>{c.state}</span>}
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
