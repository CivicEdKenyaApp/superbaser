import React, { useState } from 'react';

interface ContactProps {
  onLaunchConsole?: (projectRef?: string, serviceRoleKey?: string, initialData?: { name: string; email: string; orgName: string; supabasePlan?: string }) => void;
  onOpenPaymentModal?: (plan: string, initialData?: { name: string; email: string; orgName: string; supabasePlan: string }) => void;
  session?: any;
}

export default function Contact({ onLaunchConsole, onOpenPaymentModal, session }: ContactProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    orgName: '',
    botField: '',
  });

  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus({ text: '', type: '' });

    if (!formData.name || !formData.email || !formData.orgName) {
      setStatus({ text: 'Please complete your name, email, and organization.', type: 'error' });
      return;
    }

    if (formData.botField) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (import.meta.env.DEV) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      setStatus({ text: 'Preparing workspace...', type: 'success' });
      setTimeout(() => {
        if (onLaunchConsole) {
          onLaunchConsole(undefined, undefined, {
            name: formData.name,
            email: formData.email,
            orgName: formData.orgName,
          });
        }
      }, 400);
    } catch (err) {
      setStatus({ text: 'Dispatch error. Please contact support@superbaser.co directly.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="section py-[120px] max-md:py-[88px] bg-orange border-0 text-ink relative overflow-hidden" id="contact">
      {/* Offscreen background logo representation */}
      <div className="absolute top-0 left-0 -translate-y-[20%] -translate-x-[35%] w-[800px] h-[800px] max-md:w-[450px] max-md:h-[450px] max-md:-translate-x-[30%] max-md:-translate-y-[15%] pointer-events-none opacity-[0.15] z-0">
        <svg width="100%" height="100%" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
          <path fill="#bce21c" stroke="#303a09" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 14 14 3v7h6L10 21v-7H4z" />
        </svg>
      </div>

      <div className="shell contact-grid grid grid-cols-[0.85fr_1.15fr] max-md:grid-cols-1 gap-[clamp(50px,9vw,130px)] max-md:gap-[55px] relative z-10">
        <div>
          <p className="eyebrow font-mono font-medium text-[0.72rem] tracking-[0.11em] uppercase m-0 before:content-['✦'] before:mr-[0.65rem]">A New Dawn for your data</p>
          <h2 className="section-title my-[28px] font-display font-bold text-[clamp(2.8rem,6vw,5.8rem)] leading-[0.95] tracking-[-0.065em]">
            Get Started.
          </h2>
          <p className="contact-note max-w-[470px] text-[1.08rem]">
            Connect your Supabase project once. SuperBaser handles the rest.
          </p>
          <div className="contact-details mt-[64px] font-mono text-[0.72rem] leading-[1.8] uppercase">
            Operations Support
            <br />
            <a href="mailto:support@superbaser.co" className="underline underline-offset-4">
              support@superbaser.co
            </a>
          </div>
        </div>

        {session && session.user && !session.user.is_anonymous ? (
          <div className="form p-[42px] max-sm:p-[28px_22px] bg-paper shadow-[12px_12px_0_#171714] max-sm:shadow-[7px_7px_0_#171714] flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-acid flex items-center justify-center border-2 border-ink shadow-[4px_4px_0_#171714] rounded-full mb-6">
              <span className="font-display font-bold text-2xl uppercase">{session.user.user_metadata?.full_name?.charAt(0) || session.user.email?.charAt(0) || 'U'}</span>
            </div>
            <h3 className="font-display font-bold text-3xl mb-2 uppercase">Welcome back!</h3>
            <p className="text-muted font-mono text-sm mb-8">Signed in as {session.user.user_metadata?.email || session.user.email}</p>
            <button
              onClick={() => onLaunchConsole?.()}
              className="button w-full px-[36px] max-sm:px-[24px] py-[18px] bg-ink text-white font-mono font-bold text-[0.85rem] leading-[1.3] uppercase tracking-[0.05em] cursor-pointer shadow-[6px_6px_0_#c6f806] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0_#c6f806] transition-all duration-200"
            >
              Launch Console ↗
            </button>
          </div>
        ) : (
          <form
            className="form p-[42px] max-sm:p-[28px_22px] bg-paper shadow-[12px_12px_0_#171714] max-sm:shadow-[7px_7px_0_#171714]"
            id="project-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <p className="hidden absolute -left-[9999px]">
              <label>
                Do not fill this out: <input name="botField" value={formData.botField} onChange={handleChange} />
              </label>
            </p>

            <div className="form-row grid grid-cols-2 max-sm:grid-cols-1 gap-[22px] max-sm:gap-0">
              <div className="field mb-[24px]">
                <label htmlFor="name" className="block mb-[9px] font-mono font-medium text-[0.7rem] uppercase tracking-[0.06em]">
                  Your Name
                </label>
                <input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  placeholder="Your Name"
                  required
                  className="w-full border-0 border-b border-ink rounded-none py-3 px-[2px] text-ink bg-transparent outline-none focus:border-b-3 focus:border-ink focus:pb-[10px]"
                />
              </div>
              <div className="field mb-[24px]">
                <label htmlFor="email" className="block mb-[9px] font-mono font-medium text-[0.7rem] uppercase tracking-[0.06em]">
                  Work Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="name@company.com"
                  required
                  className="w-full border-0 border-b border-ink rounded-none py-3 px-[2px] text-ink bg-transparent outline-none focus:border-b-3 focus:border-ink focus:pb-[10px]"
                />
              </div>
            </div>

            <div className="field mb-[24px]">
              <label htmlFor="orgName" className="block mb-[9px] font-mono font-medium text-[0.7rem] uppercase tracking-[0.06em]">
                Organization Name
              </label>
              <input
                id="orgName"
                name="orgName"
                value={formData.orgName}
                onChange={handleChange}
                placeholder="Company or Team"
                required
                className="w-full border-0 border-b border-ink rounded-none py-3 px-[2px] text-ink bg-transparent outline-none focus:border-b-3 focus:border-ink focus:pb-[10px]"
              />
            </div>

            <div className="form-footer flex max-sm:flex-col-reverse justify-between items-center max-sm:items-stretch gap-5 mt-3">
              <small className="max-w-[240px] text-muted text-[0.7rem] leading-relaxed">
                Connect your Supabase project after signing in. SuperBaser will automatically discover its configuration.
              </small>
              <button
                className="button inline-flex items-center justify-center min-h-[58px] px-[26px] max-sm:w-full border border-ink bg-ink text-white font-mono font-medium text-[0.76rem] tracking-[0.05em] uppercase cursor-pointer transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_#171714] disabled:opacity-50"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Preparing workspace…' : 'Continue →'}
              </button>
            </div>

            {status.text && (
              <p className={`form-status min-h-[24px] mt-[18px] font-mono font-medium text-[0.73rem] leading-[1.5] ${status.type === 'success' ? 'text-[#347000]' : 'text-[#b12200]'}`} role="status" aria-live="polite">
                {status.text}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
