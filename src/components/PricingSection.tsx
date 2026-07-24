import React, { useState } from 'react';
import { Check, ShieldAlert, Sparkles, Zap, ArrowRight, Database, Clock, Lock, Server } from 'lucide-react';
import { PLANS } from './PaymentModal';

interface PricingSectionProps {
  onSelectPlan: (planId: string) => void;
}

export default function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <section className="section py-[120px] max-md:py-[88px] bg-paper border-b border-line text-ink relative overflow-hidden" id="pricing">
      {/* Background Graphic Grid Accent */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#171714_1px,transparent_1px)] [background-size:24px_24px]"></div>

      <div className="shell relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="eyebrow font-mono font-medium text-[0.72rem] tracking-[0.11em] uppercase m-0 justify-center before:content-['✦'] before:mr-[0.65rem]">
            Transparent Pricing & DR Tiers
          </p>
          <h2 className="section-title my-6 font-display font-bold text-[clamp(2.8rem,5.5vw,5rem)] leading-[0.95] tracking-[-0.065em] uppercase">
            Protect Your Supabase Project Today.
          </h2>
          <p className="text-muted text-[1.1rem] max-w-xl mx-auto">
            Choose the backup frequency and recovery strategy tailored to your workload. Upgrade or downgrade anytime.
          </p>

          {/* Billing Switcher */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 border-2 border-ink bg-white shadow-[6px_6px_0_#171714]">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 font-mono font-bold text-xs uppercase tracking-wider transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-ink text-white shadow-[2px_2px_0_#bce21c]'
                  : 'text-ink hover:bg-neutral-100'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-ink text-white shadow-[2px_2px_0_#bce21c]'
                  : 'text-ink hover:bg-neutral-100'
              }`}
            >
              Yearly Billing
              <span className="px-2 py-0.5 bg-acid text-ink font-mono text-[0.65rem] font-extrabold uppercase border border-ink">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-16">
          {Object.values(PLANS).map((plan) => {
            const isPro = plan.id === 'Pro';
            const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between p-7 border-2 border-ink bg-white transition-all duration-200 hover:-translate-y-1 ${
                  isPro
                    ? 'shadow-[12px_12px_0_#bce21c] bg-amber-50/20'
                    : 'shadow-[8px_8px_0_#171714]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-acid text-ink border-2 border-ink font-mono font-bold text-[0.68rem] uppercase tracking-wider shadow-[2px_2px_0_#171714] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 fill-current" /> Recommended Choice
                  </div>
                )}

                <div>
                  <div className="font-mono font-bold text-xs uppercase tracking-wider text-muted mb-2">
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-1 my-3">
                    <span className="font-display font-extrabold text-4xl tracking-tight text-ink">
                      {price === 0 ? '$0' : `$${price}`}
                    </span>
                    <span className="font-mono text-xs text-muted uppercase">
                      {price === 0 ? '/forever' : '/month'}
                    </span>
                  </div>
                  <p className="font-body text-xs text-muted leading-relaxed min-h-[42px] mb-6">
                    {plan.description}
                  </p>

                  <div className="border-t border-line pt-6 mb-6">
                    <span className="font-mono text-[0.65rem] font-bold uppercase tracking-wider text-ink block mb-3">
                      Core DR Capabilities
                    </span>
                    <ul className="space-y-2.5">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5 font-mono text-[0.73rem] text-ink">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPlan(plan.id)}
                  className={`button w-full py-4 px-4 font-mono font-bold text-[0.78rem] uppercase tracking-wider border border-ink transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    isPro
                      ? 'bg-ink text-white shadow-[4px_4px_0_#bce21c] hover:shadow-[6px_6px_0_#bce21c] hover:-translate-x-0.5 hover:-translate-y-0.5'
                      : 'bg-white text-ink hover:bg-ink hover:text-white shadow-[4px_4px_0_#171714]'
                  }`}
                >
                  {plan.id === 'Free' ? 'Activate Free' : `Choose ${plan.id}`}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Matrix Banner */}
        <div className="border-2 border-ink bg-white p-8 max-md:p-5 shadow-[10px_10px_0_#171714]">
          <div className="flex max-md:flex-col items-center justify-between gap-6 pb-6 border-b border-ink/20">
            <div>
              <span className="font-mono font-bold text-xs uppercase text-acid bg-ink px-2.5 py-1 inline-block mb-2">
                Automated Protection & Disaster Recovery
              </span>
              <h3 className="font-display font-bold text-2xl uppercase">
                Autonomous Backup & Instant Restores
              </h3>
              <p className="text-muted text-sm mt-1 max-w-xl">
                SuperBaser continuously protects your Supabase database, storage buckets, and RLS security policies with zero manual configuration.
              </p>
            </div>
            <button
              onClick={() => onSelectPlan('Pro')}
              className="button px-6 py-3.5 bg-acid text-ink border border-ink font-mono font-bold text-xs uppercase shadow-[4px_4px_0_#171714] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#171714] transition-all shrink-0 cursor-pointer"
            >
              Start Free 14-Day Pro Trial ↗
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-2 text-center">
            <div className="p-3 border border-ink/20 bg-paper">
              <Clock className="w-5 h-5 mx-auto mb-1.5 text-ink" />
              <div className="font-mono font-bold text-xs uppercase">Hourly Snapshots</div>
              <div className="font-mono text-[0.65rem] text-muted">Pro & Team Tiers</div>
            </div>
            <div className="p-3 border border-ink/20 bg-paper">
              <Database className="w-5 h-5 mx-auto mb-1.5 text-ink" />
              <div className="font-mono font-bold text-xs uppercase">Storage & DB Sync</div>
              <div className="font-mono text-[0.65rem] text-muted">Buckets + Secrets</div>
            </div>
            <div className="p-3 border border-ink/20 bg-paper">
              <Lock className="w-5 h-5 mx-auto mb-1.5 text-ink" />
              <div className="font-mono font-bold text-xs uppercase">AES-256 Vault</div>
              <div className="font-mono text-[0.65rem] text-muted">Zero-Knowledge DR</div>
            </div>
            <div className="p-3 border border-ink/20 bg-paper">
              <Server className="w-5 h-5 mx-auto mb-1.5 text-ink" />
              <div className="font-mono font-bold text-xs uppercase">1-Click Verification</div>
              <div className="font-mono text-[0.65rem] text-muted">Deterministic Restores</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
