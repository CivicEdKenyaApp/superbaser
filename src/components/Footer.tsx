import React from 'react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-8 bg-ink text-paper">
      <div className="shell footer-grid grid grid-cols-[1fr_auto_1fr] max-sm:grid-cols-[1fr_auto] items-center gap-6">
        <a className="brand text-white w-max no-underline font-display font-extrabold text-[1.3rem] leading-none tracking-[-0.06em]" href="#top">
          SUPER<svg className="w-[1.2em] h-[1.2em] inline-block -translate-y-[0.1em] text-neon fill-current stroke-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M4 14 14 3v7h6L10 21v-7H4z" /></svg>BASER
        </a>
        <span className="footer-copy font-mono text-[0.68rem] leading-[1.5] text-[#aaa99f] uppercase max-sm:hidden">
          Supabase Backup · Restore · Verification · Disaster Recovery
        </span>
        <span className="footer-copy justify-self-end font-mono text-[0.68rem] leading-[1.5] text-[#aaa99f] uppercase">
          © {currentYear} ·{' '}
          <a href="#top" className="text-white underline underline-offset-4">
            Back to top ↑
          </a>
        </span>
      </div>
    </footer>
  );
}
