import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PromoCodeInput } from './PromoCodeInput';

interface OrgBillingProps {
  organizationId: string;
  onPlanChanged?: () => void;
}

export function OrgBilling({ organizationId, onPlanChanged }: OrgBillingProps) {
  const [plan, setPlan] = useState<string | null>(null);
  const [isLifetime, setIsLifetime] = useState(false);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_org_promo_status', {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      setPlan(data?.plan || 'free');
      setIsLifetime(data?.is_lifetime || false);
      setRedemptions(data?.redemptions || []);
    } catch {
      const { data: org } = await supabase
        .from('organizations')
        .select('plan')
        .eq('id', organizationId)
        .single();
      setPlan(org?.plan || 'free');
      setIsLifetime((org?.plan || '').toLowerCase() === 'pro_lifetime');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="h-6 w-6 animate-spin text-ink" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono">
      {/* Current Plan Card */}
      <div className="p-5 bg-panel border-2 border-ink shadow-[6px_6px_0_#171714]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Current Subscription Plan</h3>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-display font-bold uppercase text-ink tracking-tight">
            {plan || 'Free'}
          </span>
          {isLifetime ? (
            <span className="px-3 py-1 bg-acid text-ink border border-ink text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#171714]">
              ★ PRO LIFETIME ACCESS
            </span>
          ) : (
            <span className="px-3 py-1 bg-paper border border-ink text-muted text-xs font-bold uppercase tracking-wider">
              STANDARD TIER
            </span>
          )}
        </div>

        {redemptions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-line space-y-1.5">
            <p className="text-[0.7rem] font-bold uppercase text-muted">Redeemed Access Tokens:</p>
            {redemptions.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-ink">
                <code className="px-2 py-0.5 bg-paper border border-ink font-mono font-bold text-neon">{r.code}</code>
                <span>→</span>
                <span className="uppercase font-bold text-ink">{r.tier}</span>
                <span className="text-muted text-[0.68rem] ml-auto">
                  {new Date(r.redeemed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promo Code Input */}
      {!isLifetime ? (
        <PromoCodeInput
          organizationId={organizationId}
          onRedeemed={() => {
            fetchStatus();
            onPlanChanged?.();
          }}
        />
      ) : (
        <div className="p-4 bg-acid/20 border-2 border-ink text-ink font-bold text-xs uppercase flex items-center gap-2 shadow-[4px_4px_0_#171714]">
          <span>⚡</span> This organization has Lifetime Pro Access active. All automated pg_dumpall snapshots & AES-256 storage vaults are fully unlocked.
        </div>
      )}
    </div>
  );
}
