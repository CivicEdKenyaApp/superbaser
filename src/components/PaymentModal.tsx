import React, { useState } from 'react';
import { X, Check, Shield, Lock, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { openPaystackCheckout } from '../lib/paystack';

interface PaymentModalProps {
  initialPlan?: string;
  initialData?: { name?: string; email?: string; orgName?: string; supabasePlan?: string };
  onClose: () => void;
  onSuccess: (plan: string, billingCycle: 'monthly' | 'yearly', paystackRef?: string) => void;
}

interface PlanDetails {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyAmountKES: number;
  yearlyAmountKES: number;
  monthlyPlanCode: string;
  yearlyPlanCode: string;
  description: string;
  features: string[];
  popular?: boolean;
  ctaText: string;
}

export const PLANS: Record<string, PlanDetails> = {
  Free: {
    id: 'Free',
    name: 'Free Tier',
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyAmountKES: 0,
    yearlyAmountKES: 0,
    monthlyPlanCode: '',
    yearlyPlanCode: '',
    description: 'Essential automated daily backups for 1 Supabase project.',
    features: [
      '24-hour daily automated pg_dump',
      '7-day backup retention history',
      'Manual point-in-time restore trigger',
      '1 Supabase project connection',
      'Community operations support',
    ],
    ctaText: 'Activate Free Plan',
  },
  Pro: {
    id: 'Pro',
    name: 'Pro Tier',
    monthlyPrice: 15,
    yearlyPrice: 12,
    monthlyAmountKES: 1950,
    yearlyAmountKES: 19500,
    monthlyPlanCode: import.meta.env.VITE_PAYSTACK_PRO_PLAN_CODE_MONTHLY || 'PLN_1whq8h5qxv9lerr',
    yearlyPlanCode: import.meta.env.VITE_PAYSTACK_PRO_PLAN_CODE_ANNUAL || 'PLN_5cu6agsex0uqbzp',
    description: 'Hourly snapshots & 1-click zero-downtime restore for growing products.',
    popular: true,
    features: [
      '1-hour automated DB & Storage snapshots',
      '30-day backup retention history',
      '1-click zero-downtime verified restore',
      'Up to 5 Supabase projects',
      'AES-256 encrypted vault & Storage sync',
      'Priority operations email support',
    ],
    ctaText: 'Subscribe to Pro ($15/mo)',
  },
  Premium: {
    id: 'Premium',
    name: 'Premium Tier',
    monthlyPrice: 49,
    yearlyPrice: 39,
    monthlyAmountKES: 6370,
    yearlyAmountKES: 63700,
    monthlyPlanCode: import.meta.env.VITE_PAYSTACK_PREMIUM_PLAN_CODE_MONTHLY || 'PLN_ixgzvfe6ofr5as3',
    yearlyPlanCode: import.meta.env.VITE_PAYSTACK_PREMIUM_PLAN_CODE_ANNUAL || 'PLN_p7ov52pl3xi3s2g',
    description: '15-minute continuous log streaming & multi-region DR for scaling teams.',
    features: [
      '15-minute continuous backup & log streaming',
      '90-day point-in-time recovery (PITR)',
      'Unlimited Supabase projects & orgs',
      'Multi-region failover & 1-click migration',
      'Team RBAC, audit logs & dedicated agent',
      '1-hour response SLA',
    ],
    ctaText: 'Subscribe to Premium ($49/mo)',
  },
};

export default function PaymentModal({
  initialPlan = 'Pro',
  initialData,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    PLANS[initialPlan] ? initialPlan : 'Pro'
  );
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const selectedPlan = PLANS[selectedPlanId] || PLANS.Pro;
  const isFreePlan = selectedPlan.monthlyPrice === 0;
  const displayPrice = billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;

  const handleActivateFree = () => {
    setIsProcessing(true);
    setPaymentError(null);
    // Free plan — no payment required, activate immediately
    setTimeout(() => {
      setIsProcessing(false);
      setPaymentSuccess(true);
      setTimeout(() => {
        onSuccess(selectedPlanId, billingCycle);
      }, 900);
    }, 600);
  };

  const handlePaidCheckout = () => {
    if (isProcessing || paymentSuccess) return;
    setPaymentError(null);

    const email = initialData?.email;
    if (!email || !email.includes('@')) {
      setPaymentError('A valid email address is required to process payment. Please sign in first.');
      return;
    }

    const planCode = billingCycle === 'yearly'
      ? selectedPlan.yearlyPlanCode
      : selectedPlan.monthlyPlanCode;

    const amount = billingCycle === 'yearly'
      ? selectedPlan.yearlyAmountKES
      : selectedPlan.monthlyAmountKES;

    setIsProcessing(true);

    openPaystackCheckout({
      email,
      amount,
      planCode,
      metadata: {
        plan_id: selectedPlanId,
        billing_cycle: billingCycle,
        org_name: initialData?.orgName || '',
        user_name: initialData?.name || '',
        source: 'payment_modal',
      },
      onSuccess: (response) => {
        setIsProcessing(false);
        setPaymentSuccess(true);
        const paystackRef = response?.reference || response?.trans || response?.trxref || undefined;
        setTimeout(() => {
          onSuccess(selectedPlanId, billingCycle, paystackRef);
        }, 900);
      },
      onClose: () => {
        setIsProcessing(false);
        setPaymentError('Payment window was closed. No charge was made. Try again when ready.');
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 max-sm:p-2 bg-ink/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-paper border-2 border-ink shadow-[16px_16px_0_#171714] max-sm:shadow-[8px_8px_0_#171714] my-8 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-acid border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-ink fill-current" />
            <span className="font-mono font-bold text-sm uppercase tracking-wider text-ink">
              SuperBaser DR Checkout · {selectedPlan.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-ink hover:text-paper border border-ink bg-paper transition-colors cursor-pointer"
            aria-label="Close payment modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 max-md:p-5 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8">
          {/* Left Column: Plan Selector & Features */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                  Select Supabase DR Tier
                </span>
                {/* Billing Toggle */}
                <div className="inline-flex items-center border border-ink bg-white p-0.5 font-mono text-[0.7rem]">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1 font-bold uppercase transition-colors ${
                      billingCycle === 'monthly' ? 'bg-ink text-paper' : 'text-ink hover:bg-neutral-100'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-3 py-1 font-bold uppercase transition-colors flex items-center gap-1 ${
                      billingCycle === 'yearly' ? 'bg-ink text-paper' : 'text-ink hover:bg-neutral-100'
                    }`}
                  >
                    Yearly <span className="text-acid font-bold text-[0.65rem]">-20%</span>
                  </button>
                </div>
              </div>

              {/* Plan Choice Cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {Object.values(PLANS).map((plan) => {
                  const isSelected = plan.id === selectedPlanId;
                  const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => { setSelectedPlanId(plan.id); setPaymentError(null); }}
                      className={`p-3 text-left border-2 transition-all relative cursor-pointer ${
                        isSelected
                          ? 'border-ink bg-acid shadow-[4px_4px_0_#171714]'
                          : 'border-ink/30 bg-white hover:border-ink hover:bg-neutral-50'
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 bg-orange text-ink border border-ink font-mono font-bold text-[0.6rem] uppercase">
                          Best Value
                        </span>
                      )}
                      <div className="font-mono font-bold text-xs uppercase">{plan.name}</div>
                      <div className="font-display font-extrabold text-lg my-0.5">
                        {price === 0 ? '$0' : `$${price}`}
                        <span className="text-[0.65rem] font-mono text-muted uppercase">
                          {price === 0 ? '/forever' : '/mo'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Feature Highlights of Selected Plan */}
              <div className="border border-ink p-4 bg-white shadow-[4px_4px_0_#171714] mb-6">
                <div className="font-mono font-bold text-xs uppercase mb-2 text-ink flex items-center justify-between">
                  <span>Included in {selectedPlan.name}</span>
                  <span className="text-muted font-normal text-[0.68rem]">{selectedPlan.description}</span>
                </div>
                <ul className="space-y-2 mt-3">
                  {selectedPlan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 font-mono text-[0.72rem] text-ink">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[0.68rem] text-muted border-t border-line pt-3">
              <Shield className="w-4 h-4 text-ink shrink-0" />
              <span>30-day money-back guarantee · Cancel anytime with 1-click</span>
            </div>
          </div>

          {/* Right Column: Checkout Summary */}
          <div className="bg-white border-2 border-ink p-6 shadow-[6px_6px_0_#171714] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-ink pb-3 mb-4">
                <h3 className="font-mono font-bold text-sm uppercase tracking-wide">
                  Order Summary
                </h3>
                <span className="font-mono text-xs uppercase px-2 py-0.5 bg-orange border border-ink font-bold">
                  {billingCycle}
                </span>
              </div>

              {/* Price Display */}
              <div className="space-y-2 font-mono text-xs mb-6">
                <div className="flex justify-between">
                  <span className="text-muted">{selectedPlan.name} Subscription</span>
                  <span className="font-bold">
                    {displayPrice === 0 ? '$0' : `$${displayPrice}/mo`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-ink/40 pt-2 text-sm font-bold text-ink">
                  <span>Total Due Now</span>
                  <span className="text-lg">
                    {displayPrice === 0
                      ? '$0'
                      : `$${displayPrice * (billingCycle === 'yearly' ? 12 : 1)}`}
                  </span>
                </div>
              </div>

              {/* Free Plan Notice */}
              {isFreePlan && (
                <div className="p-4 bg-neutral-100 border border-ink font-mono text-xs text-muted mb-4">
                  No credit card required. Activate instantly and connect your Supabase project.
                </div>
              )}

              {/* Paid Plan — Paystack Notice */}
              {!isFreePlan && (
                <div className="p-4 bg-acid/20 border border-ink font-mono text-xs text-ink mb-4 space-y-2">
                  <div className="font-bold uppercase flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5" />
                    Secure Payment via Paystack
                  </div>
                  <p className="text-muted leading-relaxed">
                    Clicking the button below opens the Paystack secure checkout popup.
                    Your card details are processed directly by Paystack — SuperBaser never
                    stores payment credentials.
                  </p>
                  {initialData?.email && (
                    <div className="mt-2 text-[0.68rem] text-muted">
                      Billing email: <strong className="text-ink">{initialData.email}</strong>
                    </div>
                  )}
                  {!initialData?.email && (
                    <div className="mt-2 text-[0.68rem] text-orange font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Sign in first to attach a billing email to your subscription.
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {paymentError && (
                <div className="p-3 bg-red-50 border border-red-400 font-mono text-xs text-red-700 mb-4 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{paymentError}</span>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="mt-4 pt-4 border-t border-ink/20 space-y-2">
              {paymentSuccess ? (
                <div className="p-3 bg-acid border border-ink text-center font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 animate-bounce">
                  <Check className="w-4 h-4 text-ink" />
                  {isFreePlan ? 'Free Plan Activated! Launching Console...' : 'Payment Confirmed! Launching DR Console...'}
                </div>
              ) : isFreePlan ? (
                <button
                  type="button"
                  onClick={handleActivateFree}
                  disabled={isProcessing}
                  className="button w-full py-3.5 px-4 bg-ink text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[4px_4px_0_#bce21c] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#bce21c] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Activating...</>
                    : <><Lock className="w-3.5 h-3.5 text-acid" /> {selectedPlan.ctaText}</>
                  }
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePaidCheckout}
                  disabled={isProcessing || !initialData?.email}
                  className="button w-full py-3.5 px-4 bg-ink text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[4px_4px_0_#bce21c] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#bce21c] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening Paystack...</>
                    : <><Lock className="w-3.5 h-3.5 text-acid" /> {selectedPlan.ctaText} ↗</>
                  }
                </button>
              )}

              <p className="text-center font-mono text-[0.62rem] text-muted uppercase">
                {isFreePlan
                  ? 'No payment required · Upgrade anytime'
                  : 'Encrypted via Paystack · 256-bit TLS · Automated DR pipeline activation'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
