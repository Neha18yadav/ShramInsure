// Reusable SVG delivery bike graphic
export function RidingBike({ size = 120, color = '#00ff87', style = {} }) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Rear wheel */}
      <g style={{ transformOrigin: '42px 88px', animation: 'wheelSpin 0.6s linear infinite' }}>
        <circle cx="42" cy="88" r="26" stroke={color} strokeWidth="3" opacity="0.5"/>
        <circle cx="42" cy="88" r="18" stroke={color} strokeWidth="2" opacity="0.4"/>
        <circle cx="42" cy="88" r="4" fill={color} opacity="0.8"/>
        <line x1="42" y1="62" x2="42" y2="114" stroke={color} strokeWidth="1.5" opacity="0.5"/>
        <line x1="16" y1="88" x2="68" y2="88" stroke={color} strokeWidth="1.5" opacity="0.5"/>
        <line x1="24" y1="69" x2="60" y2="107" stroke={color} strokeWidth="1" opacity="0.3"/>
        <line x1="60" y1="69" x2="24" y2="107" stroke={color} strokeWidth="1" opacity="0.3"/>
      </g>

      {/* Front wheel */}
      <g style={{ transformOrigin: '158px 88px', animation: 'wheelSpin 0.6s linear infinite' }}>
        <circle cx="158" cy="88" r="26" stroke={color} strokeWidth="3" opacity="0.5"/>
        <circle cx="158" cy="88" r="18" stroke={color} strokeWidth="2" opacity="0.4"/>
        <circle cx="158" cy="88" r="4" fill={color} opacity="0.8"/>
        <line x1="158" y1="62" x2="158" y2="114" stroke={color} strokeWidth="1.5" opacity="0.5"/>
        <line x1="132" y1="88" x2="184" y2="88" stroke={color} strokeWidth="1.5" opacity="0.5"/>
        <line x1="140" y1="69" x2="176" y2="107" stroke={color} strokeWidth="1" opacity="0.3"/>
        <line x1="176" y1="69" x2="140" y2="107" stroke={color} strokeWidth="1" opacity="0.3"/>
      </g>

      {/* Frame */}
      <path d="M42 88 L85 40 L120 40 L158 62 L158 88" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
      <path d="M85 40 L95 88" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
      <path d="M95 88 L42 88" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
      {/* Seat tube */}
      <path d="M95 88 L98 55" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
      {/* Handlebar */}
      <path d="M145 55 L158 62" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
      <path d="M140 50 L150 52" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      {/* Seat */}
      <path d="M90 55 L112 55" stroke={color} strokeWidth="4" strokeLinecap="round"/>

      {/* Delivery box */}
      <rect x="106" y="28" width="36" height="28" rx="4" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5"/>
      <path d="M106 36 L142 36" stroke={color} strokeWidth="1" opacity="0.4"/>
      <path d="M124 28 L124 56" stroke={color} strokeWidth="1" opacity="0.3"/>
      {/* Box strap */}
      <path d="M112 24 L130 24" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>

      {/* Rider */}
      {/* Body */}
      <path d="M98 55 C105 30 125 25 135 40" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8"/>
      {/* Head */}
      <circle cx="135" cy="35" r="9" fill={color} opacity="0.15" stroke={color} strokeWidth="2"/>
      {/* Helmet visor */}
      <path d="M128 35 L142 35" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      {/* Arm */}
      <path d="M120 40 L138 48" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>

      {/* Speed lines */}
      <line x1="0" y1="70" x2="18" y2="70" stroke={color} strokeWidth="1.5" opacity="0.3" strokeLinecap="round"/>
      <line x1="0" y1="80" x2="12" y2="80" stroke={color} strokeWidth="1" opacity="0.2" strokeLinecap="round"/>
      <line x1="0" y1="60" x2="8" y2="60" stroke={color} strokeWidth="1" opacity="0.15" strokeLinecap="round"/>
    </svg>
  );
}

export function StaticBike({ size = 80, color = '#00ff87', opacity = 0.15, style = {} }) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity, ...style }}
    >
      <circle cx="42" cy="88" r="26" stroke={color} strokeWidth="3"/>
      <circle cx="42" cy="88" r="4" fill={color}/>
      <line x1="42" y1="62" x2="42" y2="114" stroke={color} strokeWidth="1.5"/>
      <line x1="16" y1="88" x2="68" y2="88" stroke={color} strokeWidth="1.5"/>
      <circle cx="158" cy="88" r="26" stroke={color} strokeWidth="3"/>
      <circle cx="158" cy="88" r="4" fill={color}/>
      <line x1="158" y1="62" x2="158" y2="114" stroke={color} strokeWidth="1.5"/>
      <line x1="132" y1="88" x2="184" y2="88" stroke={color} strokeWidth="1.5"/>
      <path d="M42 88 L85 40 L120 40 L158 62 L158 88" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M85 40 L95 88" stroke={color} strokeWidth="3" strokeLinecap="round"/>
      <path d="M95 88 L42 88" stroke={color} strokeWidth="3" strokeLinecap="round"/>
      <path d="M95 88 L98 55" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M140 50 L150 52" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M90 55 L112 55" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <rect x="106" y="28" width="36" height="28" rx="4" fill={color} opacity="0.1" stroke={color} strokeWidth="1.5"/>
      <path d="M98 55 C105 30 125 25 135 40" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none"/>
      <circle cx="135" cy="35" r="9" fill={color} opacity="0.1" stroke={color} strokeWidth="2"/>
    </svg>
  );
}

export function MovingBikeStrip() {
  return (
    <div style={{ position:'relative', overflow:'hidden', height:60, pointerEvents:'none' }}>
      {/* Road line */}
      <div style={{ position:'absolute', bottom:8, left:0, right:0, height:1, background:'rgba(0,255,135,0.06)' }} />
      {/* Dashes */}
      {[0,15,30,45,60,75].map(pct => (
        <div key={pct} style={{ position:'absolute', bottom:8, left:`${pct}%`, width:32, height:1, background:'rgba(0,255,135,0.12)', borderRadius:1 }} />
      ))}
      {/* Bike 1 */}
      <div style={{ position:'absolute', bottom:10, animation:'rideAcross 7s linear infinite', animationDelay:'0s' }}>
        <RidingBike size={70} />
      </div>
      {/* Bike 2 */}
      <div style={{ position:'absolute', bottom:10, animation:'rideAcross 7s linear infinite', animationDelay:'3.5s' }}>
        <RidingBike size={55} color="#00c968" />
      </div>
    </div>
  );
}
