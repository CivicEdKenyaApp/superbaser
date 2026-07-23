import React, { useState } from 'react';

interface ContactProps {
  onLaunchConsole?: (projectRef?: string, serviceRoleKey?: string, initialData?: { name: string; email: string; orgName: string }) => void;
}

export default function Contact({ onLaunchConsole }: ContactProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    orgName: '',
    databaseType: 'PostgreSQL 15.x / 17.x',
    botField: '',
  });

  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

      setStatus({ text: 'Information saved. Proceeding to Account Authentication...', type: 'success' });

      setTimeout(() => {
        if (onLaunchConsole) {
          onLaunchConsole(undefined, undefined, {
            name: formData.name,
            email: formData.email,
            orgName: formData.orgName,
          });
        }
      }, 500);
    } catch (err) {
      setStatus({ text: 'Dispatch error. Please contact ops@superbaser.com directly.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="section py-[120px] max-md:py-[88px] bg-orange border-0 text-ink" id="contact">
      <div className="shell contact-grid grid grid-cols-[0.85fr_1.15fr] max-md:grid-cols-1 gap-[clamp(50px,9vw,130px)] max-md:gap-[55px]">
        <div>
          <p className="eyebrow font-mono font-medium text-[0.72rem] tracking-[0.11em] uppercase m-0 before:content-['✦'] before:mr-[0.65rem]">SuperBaser Console</p>
          <h2 className="section-title my-[28px] font-display font-bold text-[clamp(2.8rem,6vw,5.8rem)] leading-[0.95] tracking-[-0.065em]">
            Get Started with SuperBaser.
          </h2>
          <p className="contact-note max-w-[470px] text-[1.08rem]">
            Sign up your organization to configure automated backup pipelines and disaster recovery snapshotting.
          </p>
          <div className="contact-details mt-[64px] font-mono text-[0.72rem] leading-[1.8] uppercase">
            Operations Support
            <br />
            <a href="mailto:ops@superbaser.com" className="underline underline-offset-4">
              ops@superbaser.com
            </a>
          </div>
        </div>

        <form
          className="form p-[42px] max-sm:p-[28px_22px] bg-paper shadow-[12px_12px_0_#171714] max-sm:shadow-[7px_7px_0_#171714]"
          id="project-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <p className="hidden absolute -left-[9999px]">
            <label>
              Do not fill this out: <input name="bot-field" value={formData.botField} onChange={handleChange} />
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
                placeholder="Ada Lovelace"
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
                placeholder="ada@company.com"
                required
                className="w-full border-0 border-b border-ink rounded-none py-3 px-[2px] text-ink bg-transparent outline-none focus:border-b-3 focus:border-ink focus:pb-[10px]"
              />
            </div>
          </div>

          <div className="form-row grid grid-cols-2 max-sm:grid-cols-1 gap-[22px] max-sm:gap-0">
            <div className="field mb-[24px]">
              <label htmlFor="orgName" className="block mb-[9px] font-mono font-medium text-[0.7rem] uppercase tracking-[0.06em]">
                Organization Name
              </label>
              <input
                id="orgName"
                name="orgName"
                value={formData.orgName}
                onChange={handleChange}
                placeholder="Acme Corp"
                required
                className="w-full border-0 border-b border-ink rounded-none py-3 px-[2px] text-ink bg-transparent outline-none focus:border-b-3 focus:border-ink focus:pb-[10px]"
              />
            </div>
            <div className="field mb-[24px]">
              <label htmlFor="databaseType" className="block mb-[9px] font-mono font-medium text-[0.7rem] uppercase tracking-[0.06em]">
                Target Engine
              </label>
              <select
                id="databaseType"
                name="databaseType"
                value={formData.databaseType}
                onChange={handleChange}
                required
                className="w-full border-0 border-b border-ink rounded-none py-3 px-[2px] text-ink bg-transparent outline-none focus:border-b-3 focus:border-ink focus:pb-[10px]"
              >
                <option value="PostgreSQL 15.x / 17.x">PostgreSQL 15.x / 17.x</option>
                <option value="PostgreSQL 14.x">PostgreSQL 14.x</option>
                <option value="Custom Self-Hosted Supabase">Custom Self-Hosted Supabase</option>
              </select>
            </div>
          </div>

          <div className="form-footer flex max-sm:flex-col-reverse justify-between items-center max-sm:items-stretch gap-5 mt-3">
            <small className="max-w-[230px] text-muted text-[0.7rem]">You will connect target database credentials inside your dashboard after sign in.</small>
            <button
              className="button inline-flex items-center justify-center min-h-[58px] px-[26px] max-sm:w-full border border-ink bg-ink text-white font-mono font-medium text-[0.76rem] tracking-[0.05em] uppercase cursor-pointer transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_#171714] disabled:opacity-50"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Initializing…' : 'Continue to Sign Up ↗'}
            </button>
          </div>

          {status.text && (
            <p className={`form-status min-h-[24px] mt-[18px] font-mono font-medium text-[0.73rem] leading-[1.5] ${status.type === 'success' ? 'text-[#347000]' : 'text-[#b12200]'}`} role="status" aria-live="polite">
              {status.text}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
