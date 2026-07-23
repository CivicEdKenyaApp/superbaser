import React from 'react';

export default function Ticker() {
  const items = [
    'Your database, backed up daily',
    'Your files, backed up too',
    'Your users and logins, preserved',
    'Restore in one click',
    'Move to a new project instantly',
    'Every backup checked before you need it',
    'Nothing left behind, nothing left to guess',
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
