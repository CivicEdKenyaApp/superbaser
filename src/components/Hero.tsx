import React from 'react';

interface HeroProps {
  onLaunchConsole?: () => void;
}

export default function Hero({ onLaunchConsole }: HeroProps) {
  const handleConnectClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const contactElement = document.getElementById('contact');
    if (contactElement) {
      contactElement.scrollIntoView({ behavior: 'smooth' });
    } else if (onLaunchConsole) {
      onLaunchConsole();
    }
  };

  return (
    <section className="relative min-h-[780px] max-md:min-h-0 pt-20 max-md:pt-[65px] pb-[46px] border-b border-line overflow-hidden" id="top">
      <div className="shell grid grid-cols-[1.55fr_0.45fr] max-md:grid-cols-1 gap-[40px] relative z-10">
        <div>
          <p className="eyebrow font-mono font-medium text-[0.72rem] tracking-[0.11em] uppercase m-0 before:content-['✦'] before:mr-[0.65rem]">
            Supabase Disaster Recovery & Operations Platform
          </p>
          <h1 className="hero-title max-w-[1000px] my-9 max-md:my-6 font-display font-bold text-[clamp(4.8rem,10.2vw,9rem)] max-md:text-[clamp(4rem,15vw,7.5rem)] leading-[0.82] tracking-[-0.085em] uppercase">
            <span className="block">Automated</span>
            <span className="text-outline block pl-[clamp(20px,8vw,130px)] max-md:pl-5">Supabase</span>
            <span className="highlight relative inline-block">
              restores & sync.
              <span className="absolute -left-[3%] -right-[5%] bottom-[3%] h-[18%] -z-10 bg-acid animate-draw origin-left"></span>
            </span>
          </h1>
          <div className="hero-copy max-w-[520px] ml-[clamp(0px,18vw,250px)] max-md:ml-0 text-[clamp(1.05rem,1.5vw,1.35rem)] leading-[1.55]">
            SuperBaser provides <strong>automated database, storage asset, RLS policy, and auth state backups</strong> with 1-click disaster recovery and project cloning across regions.
            <div className="hero-actions flex max-sm:flex-col items-center max-sm:items-start gap-[24px] mt-[34px]">
              <a
                href="#contact"
                onClick={handleConnectClick}
                className="button inline-flex items-center justify-center min-h-[58px] px-[26px] border border-ink bg-ink text-white font-mono font-medium text-[0.76rem] tracking-[0.05em] uppercase cursor-pointer transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_#c6f806]"
              >
                Connect Project
              </a>
              <a className="text-link font-mono font-medium text-[0.76rem] tracking-[0.04em] uppercase underline underline-offset-8" href="#work">
                View Architecture ↓
              </a>
            </div>
          </div>
        </div>

        <aside className="hero-note align-self-end pb-[112px] max-md:pb-[20px] max-md:pt-[70px] max-md:max-w-[240px]" aria-label="Engine status">
          <p className="eyebrow font-mono font-medium text-[0.72rem] tracking-[0.11em] uppercase m-0 before:content-['✦'] before:mr-[0.65rem]">System Status</p>
          <p className="mt-4 text-muted text-[0.88rem]">Engine Online · Direct PG 5432 & Storage REST API Ready.</p>
        </aside>
      </div>

      {/* Orbit Graphic */}
      <div
        className="orbit absolute -right-[80px] -bottom-[120px] max-sm:-right-[130px] w-[430px] max-sm:w-[300px] aspect-square border border-line rounded-full animate-rotate before:content-[''] before:absolute before:inset-[70px] before:border before:border-dashed before:border-ink/30 before:rounded-full after:content-[''] after:absolute after:top-[12px] after:left-1/2 after:w-[22px] after:h-[22px] after:bg-orange after:rounded-full"
        aria-hidden="true"
      ></div>

      {/* Vertical Scroll Cue */}
      <span
        className="scroll-cue absolute left-6 bottom-[48px] max-md:hidden flex gap-3 items-center -rotate-90 origin-left-center font-mono text-[0.68rem] uppercase tracking-[0.09em] before:content-[''] before:w-[38px] before:h-[1px] before:bg-current"
        aria-hidden="true"
      >
        Explore Platform
      </span>
    </section>
  );
}
