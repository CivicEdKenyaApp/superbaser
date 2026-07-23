import React from 'react';

const workItems = [
  {
    num: '01',
    name: 'Automated DB & Schema Dump',
    meta: ['Runs automatically', 'No setup after day one'],
  },
  {
    num: '02',
    name: 'Storage Asset Sync',
    meta: ['Every bucket, every file', 'Nothing gets left behind'],
  },
  {
    num: '03',
    name: 'Disaster Recovery & Restores',
    meta: ['One click to restore', 'Works even on a fresh project'],
  },
  {
    num: '04',
    name: 'Data Integrity Audit',
    meta: ['Every backup is checked', 'No surprises on restore day'],
  },
];

export default function Work() {
  return (
    <section className="section py-[120px] max-md:py-[88px] border-b border-line" id="work">
      <div className="shell">
        <div className="section-head grid grid-cols-[0.42fr_1fr] max-md:grid-cols-1 gap-[40px] max-md:gap-[26px] mb-[70px] max-md:mb-[50px]">
          <p className="eyebrow font-mono font-medium text-[0.72rem] tracking-[0.11em] uppercase m-0 before:content-['✦'] before:mr-[0.65rem]">Platform Modules</p>
          <h2 className="section-title max-w-[780px] m-0 font-display font-bold text-[clamp(2.8rem,6vw,5.8rem)] leading-[0.95] tracking-[-0.065em]">
            Complete Supabase <em className="text-neon not-italic">state protection.</em>
          </h2>
        </div>

        <div className="work-list border-t border-ink">
          {workItems.map((item) => (
            <a
              key={item.num}
              href="#contact"
              className="work-item group relative grid grid-cols-[80px_1fr_0.65fr_40px] max-sm:grid-cols-[42px_1fr_26px] items-center gap-[24px] max-sm:gap-[12px] min-h-[142px] max-sm:min-h-[112px] border-b border-line no-underline overflow-hidden transition-colors duration-350"
            >
              {/* Background dark backdrop swipe-up animation */}
              <span
                className="absolute inset-0 z-0 bg-ink translate-y-[101%] transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0"
                aria-hidden="true"
              ></span>

              <span className="work-number relative z-10 font-mono text-[0.72rem] transition-colors duration-300 group-hover:text-paper">
                {item.num}
              </span>
              <span className="work-name relative z-10 font-display font-bold text-[clamp(1.8rem,3.5vw,3.4rem)] max-sm:text-[1.7rem] leading-none tracking-[-0.05em] transition-colors duration-300 group-hover:text-paper">
                {item.name}
              </span>
              <span className="work-meta relative z-10 max-sm:hidden text-muted font-mono text-[0.75rem] leading-[1.6] uppercase transition-colors duration-300 group-hover:text-[#aaa99f]">
                {item.meta[0]}
                <br />
                {item.meta[1]}
              </span>
              <span
                className="work-arrow relative z-10 text-[1.7rem] transition-all duration-300 group-hover:text-paper group-hover:-rotate-45"
                aria-hidden="true"
              >
                →
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
