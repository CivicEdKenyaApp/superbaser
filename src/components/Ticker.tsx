import React from 'react';

export default function Ticker() {
  const items = [
    'PostgreSQL 17.x Dump',
    'Storage Asset Sync',
    'RLS Policy Backup',
    'Auth Metadata Verification',
    '1-Click Project Restore',
    'Cross-Region Disaster Recovery',
    'SHA-256 Manifest Verification',
  ];

  return (
    <div className="ticker overflow-hidden border-b border-line bg-acid" aria-hidden="true">
      <div className="ticker-track flex w-max animate-marquee">
        {[...items, ...items, ...items, ...items].map((text, idx) => (
          <span key={idx} className="px-6 py-[18px] font-mono font-semibold text-[0.75rem] uppercase tracking-[0.06em] after:content-['◆'] after:ml-[50px]">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
