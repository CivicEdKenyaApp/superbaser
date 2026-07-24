import React from 'react';

export default function Ticker() {
  const items = [
    'Backed up frequently, no exceptions',
    'Your files, covered too',
    'Your users, still logged in after',
    'One click to restore',
    'One click to migrate',
    'Every backup, checked before you need it',
    'Nothing skipped, nothing guessed',
    'Set once, forget forever',
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