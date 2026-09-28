import React, { useState } from 'react';

// Airline logo on a small white tile (most logos are dark-on-transparent and
// would vanish on the black LED panel). No code, or no logo in the set, shows
// an LED plane icon instead: amber, or red for military.

const missing = new Set<string>(); // codes that 404'd this session, so we don't retry every poll

export function PlaneIcon({ size, military, heli }: { size: number; military?: boolean; heli?: boolean }) {
  const color = military ? '#ff3b30' : '#ffb000';
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-md border border-white/10 bg-black"
      style={{ width: size, height: size, filter: `drop-shadow(0 0 ${Math.max(2, size / 16)}px ${color}88)` }}
      aria-hidden="true"
    >
      {heli ? (
        <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} fill={color}>
          <rect x="2" y="3" width="20" height="1.6" rx="0.8" />
          <rect x="11.2" y="4" width="1.6" height="3" />
          <path d="M7 8h7a5 5 0 0 1 5 5v1a2 2 0 0 1-2 2H9a4 4 0 0 1-4-4v-2a2 2 0 0 1 2-2z" />
          <rect x="17" y="11" width="6" height="1.6" rx="0.8" />
          <rect x="7" y="18.5" width="11" height="1.4" rx="0.7" />
          <rect x="9" y="16" width="1.4" height="3" /><rect x="15" y="16" width="1.4" height="3" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} fill={color}>
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
      )}
    </span>
  );
}

export default function AirlineLogo({ code, size, military, heli, title }: {
  code: string | null; size: number; military?: boolean; heli?: boolean; title?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!code || failed || missing.has(code)) return <PlaneIcon size={size} military={military} heli={heli} />;
  return (
    <span className="inline-flex items-center justify-center shrink-0 rounded-md bg-white overflow-hidden" style={{ width: size, height: size }}>
      <img
        src={`/api/airline-logo?code=${code}`}
        alt={title || code}
        title={title}
        width={size}
        height={size}
        loading="lazy"
        className="object-contain"
        style={{ width: size * 0.92, height: size * 0.92 }}
        onError={() => { missing.add(code); setFailed(true); }}
      />
    </span>
  );
}
