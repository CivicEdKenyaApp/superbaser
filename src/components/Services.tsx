import React from 'react';

const services = [
  {
    icon: '↗',
    title: 'Engine Architecture.',
    desc: 'Native pg_dump and psql integration with direct port 5432 connections for reliable, large-scale database extractions.',
    items: ['Direct PG 5432 Connection', 'Custom & Plain Dump Streams', 'Version Matrix Validation'],
  },
  {
    icon: '✦',
    title: 'Storage & Auth Sync.',
    desc: 'Extract bucket configurations, public/private access rules, and physical storage assets with automatic upsert restoration.',
    items: ['Bucket Metadata Manifest', 'Storage REST API Ingestion', 'Auth State Mapping'],
  },
  {
    icon: '⌁',
    title: 'Verification & Audit.',
    desc: 'Automated side-by-side row count comparison, storage file verification, and log filtering for seamless disaster recovery.',
    items: ['SHA-256 Checksums', 'Interactive Log Audit', 'Zero-downtime Cut-over'],
  },
];

export default function Services() {
  return (
    <section className="section py-[120px] max-md:py-[88px] border-b border-line bg-ink text-paper" id="services">
      <div className="shell">
        <div className="section-head grid grid-cols-[0.42fr_1fr] max-md:grid-cols-1 gap-[40px] max-md:gap-[26px] mb-[80px] max-md:mb-[50px]">
          <p className="eyebrow text-acid font-mono font-medium text-[0.72rem] tracking-[0.11em] uppercase m-0 before:content-['✦'] before:mr-[0.65rem]">Capabilities</p>
          <h2 className="section-title max-w-[780px] m-0 font-display font-bold text-[clamp(2.8rem,6vw,5.8rem)] leading-[0.95] tracking-[-0.065em]">
            Enterprise-grade Supabase protection.
          </h2>
        </div>

        <div className="service-grid grid grid-cols-3 max-md:grid-cols-1 border-t border-white/25">
          {services.map((srv, i) => (
            <article
              key={i}
              className="service-card group min-h-[420px] max-md:min-h-[320px] p-[38px_34px] border-r max-md:border-r-0 max-md:border-l border-b border-white/18 first:border-l border-white/18 flex flex-col"
            >
              <span
                className="service-icon w-[70px] h-[70px] grid place-items-center border border-white/35 rounded-full font-mono text-[1.4rem] leading-none transition-all duration-500 group-hover:rotate-[135deg] group-hover:bg-acid group-hover:text-ink"
                aria-hidden="true"
              >
                {srv.icon}
              </span>
              <h3 className="mt-auto mb-[18px] font-display font-bold text-[2.1rem] leading-none tracking-[-0.045em]">{srv.title}</h3>
              <p className="max-w-[290px] m-0 text-[#aaa99f]">{srv.desc}</p>
              <ul className="list-none m-0 mt-[26px] pt-[20px] border-t border-white/15 text-[#d3d1c9] font-mono text-[0.7rem] leading-[2] uppercase">
                {srv.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
