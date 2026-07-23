import React from 'react';

const steps = [
  {
    title: 'Connect & Validate',
    desc: 'Sign in and link your Supabase project in a couple of minutes. We check everything is compatible before anything else happens.',
  },
  {
    title: 'Discover Catalog',
    desc: 'A quick scan of what you have - your tables, your users, your storage buckets - so we know exactly what needs protecting.',
  },
  {
    title: 'Extract & Sync',
    desc: 'Your database and your files get backed up automatically, and every backup is checked so you know it’s actually good.',
  },
  {
    title: 'Restore & Cutover',
    desc: 'One click rebuilds your project - database, files, and all - into a new Supabase project. No manual cleanup after.',
  },
];

export default function Process() {
  return (
    <section className="section py-[120px] max-md:py-[88px] border-b border-line" id="process">
      <div className="shell process-grid grid grid-cols-[0.7fr_1.3fr] max-md:grid-cols-1 gap-[80px] max-md:gap-[50px]">
        <div className="process-intro sticky top-[36px] max-md:static align-self-start">
          <p className="eyebrow font-mono font-medium text-[0.72rem] tracking-[0.11em] uppercase m-0 before:content-['✦'] before:mr-[0.65rem]">The Pipeline</p>
          <h2 className="section-title my-[26px] font-display font-bold text-[clamp(2.8rem,6vw,5.8rem)] leading-[0.95] tracking-[-0.065em]">
            Predictable execution. <em className="text-orange not-italic">Zero data loss.</em>
          </h2>
          <p className="max-w-[400px] text-muted m-0">
            Automated, versioned, and idempotent backup and restoration pipeline designed specifically for Supabase architecture.
          </p>
        </div>

        <div className="steps">
          {steps.map((step, idx) => (
            <article key={idx} className="step grid grid-cols-[54px_1fr] gap-[22px] py-[36px] border-t border-line last:border-b">
              <span className="font-mono font-medium text-[0.72rem] leading-none text-orange pt-2">
                0{idx + 1}
              </span>
              <div>
                <h3 className="m-0 mb-3 font-display font-bold text-[2rem] leading-none tracking-[-0.04em]">{step.title}</h3>
                <p className="max-w-[570px] m-0 text-muted">{step.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
