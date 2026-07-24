import React, { useState, useEffect } from 'react';

interface HeaderProps {
  onLaunchConsole?: () => void;
}

export default function Header({ onLaunchConsole }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }, [isMenuOpen]);

  const handleConsoleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const contactElement = document.getElementById('contact');
    if (contactElement) {
      contactElement.scrollIntoView({ behavior: 'smooth' });
    } else if (onLaunchConsole) {
      onLaunchConsole();
    }
  };

  return (
    <>
      <a
        href="#main"
        className="fixed top-3 left-3 z-[100] px-[14px] py-[10px] bg-ink text-white -translate-y-[150%] focus:translate-y-0 transition-transform duration-200"
      >
        Skip to content
      </a>

      <header className="relative z-20 border-b border-line">
        <nav className="nav shell min-h-[86px] max-md:min-h-[72px] grid grid-cols-[1fr_auto_1fr] max-md:grid-cols-[1fr_auto] items-center gap-6" aria-label="Primary navigation">
          <a href="#top" className="brand w-max no-underline font-display font-extrabold text-[1.3rem] leading-none tracking-[-0.06em]">
            SUPER<svg className="w-[1.2em] h-[1.2em] inline-block -translate-y-[0.1em] text-neon fill-current stroke-[#303a09]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M4 14 14 3v7h6L10 21v-7H4z" /></svg>BASER
          </a>

          {/* Desktop Nav Links */}
          <div
            id="nav-links"
            className={`nav-links flex gap-9 max-md:fixed max-md:inset-0 max-md:z-20 max-md:flex-col max-md:justify-center max-md:items-center max-md:gap-[38px] max-md:bg-acid max-md:transition-transform max-md:duration-450 max-md:ease-[cubic-bezier(0.22,1,0.36,1)] ${isMenuOpen ? 'max-md:translate-y-0' : 'max-md:-translate-y-[101%]'
              }`}
          >
            <a
              href="#work"
              onClick={closeMenu}
              className="relative no-underline font-mono font-medium text-[0.76rem] max-md:text-[2.4rem] uppercase tracking-[0.05em] max-md:tracking-[-0.05em] max-md:font-display max-md:font-bold after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-[7px] after:h-[2px] after:bg-orange after:scale-x-0 after:origin-right after:transition-transform after:duration-250 hover:after:scale-x-100 hover:after:origin-left"
            >
              Modules
            </a>
            <a
              href="#services"
              onClick={closeMenu}
              className="relative no-underline font-mono font-medium text-[0.76rem] max-md:text-[2.4rem] uppercase tracking-[0.05em] max-md:tracking-[-0.05em] max-md:font-display max-md:font-bold after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-[7px] after:h-[2px] after:bg-orange after:scale-x-0 after:origin-right after:transition-transform after:duration-250 hover:after:scale-x-100 hover:after:origin-left"
            >
              Capabilities
            </a>
            <a
              href="#process"
              onClick={closeMenu}
              className="relative no-underline font-mono font-medium text-[0.76rem] max-md:text-[2.4rem] uppercase tracking-[0.05em] max-md:tracking-[-0.05em] max-md:font-display max-md:font-bold after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-[7px] after:h-[2px] after:bg-orange after:scale-x-0 after:origin-right after:transition-transform after:duration-250 hover:after:scale-x-100 hover:after:origin-left"
            >
              Pipeline
            </a>
            <a
              href="/docs.html"
              onClick={closeMenu}
              className="relative no-underline font-mono font-medium text-[0.76rem] max-md:text-[2.4rem] uppercase tracking-[0.05em] max-md:tracking-[-0.05em] max-md:font-display max-md:font-bold after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-[7px] after:h-[2px] after:bg-orange after:scale-x-0 after:origin-right after:transition-transform after:duration-250 hover:after:scale-x-100 hover:after:origin-left"
            >
              Docs
            </a>
            <a
              href="#contact"
              onClick={closeMenu}
              className="relative no-underline font-mono font-medium text-[0.76rem] max-md:text-[2.4rem] uppercase tracking-[0.05em] max-md:tracking-[-0.05em] max-md:font-display max-md:font-bold after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-[7px] after:h-[2px] after:bg-orange after:scale-x-0 after:origin-right after:transition-transform after:duration-250 hover:after:scale-x-100 hover:after:origin-left"
            >
              Console
            </a>
          </div>

          <a
            href="#contact"
            onClick={handleConsoleClick}
            className="nav-cta justify-self-end hidden md:inline-flex items-center gap-3 px-[18px] py-[12px] border border-ink bg-transparent text-ink font-mono font-medium text-[0.75rem] uppercase cursor-pointer transition-colors duration-200 hover:bg-ink hover:text-paper hover:-translate-y-0.5"
          >
            Launch Console <span aria-hidden="true">↗</span>
          </a>

          {/* Mobile Menu Toggle Button */}
          <button
            className="hidden max-md:block border-0 bg-transparent p-2 cursor-pointer relative z-30"
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="nav-links"
            aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
            onClick={toggleMenu}
          >
            <span className={`block w-[26px] h-[1px] my-[6px] bg-current transition-transform duration-200 ${isMenuOpen ? 'translate-y-[3.5px] rotate-45' : ''}`}></span>
            <span className={`block w-[26px] h-[1px] my-[6px] bg-current transition-transform duration-200 ${isMenuOpen ? '-translate-y-[3.5px] -rotate-45' : ''}`}></span>
          </button>
        </nav>
      </header>
    </>
  );
}
