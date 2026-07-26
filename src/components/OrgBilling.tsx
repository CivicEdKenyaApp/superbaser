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
        <svg className="h-6 w-6 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Plan */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Current Plan</h3>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold capitalize text-gray-800 dark:text-gray-100">
            {plan}
          </span>
          {isLifetime && (
            <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-semibold text-white">
              LIFETIME
            </span>
          )}
        </div>

        {redemptions.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-gray-500">Redeemed codes:</p>
            {redemptions.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <code className="font-mono">{r.code}</code>
                <span>→</span>
                <span className="capitalize">{r.tier}</span>
                <span className="text-gray-400">
                  {new Date(r.redeemed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promo Code Input (only show if not already lifetime) */}
      {!isLifetime ? (
        <PromoCodeInput
          organizationId={organizationId}
          onRedeemed={() => {
            fetchStatus();
            onPlanChanged?.();
          }}
        />
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm text-green-700 dark:text-green-400">
            ✅ This organization has lifetime Pro access. No promo code needed.
          </p>
        </div>
      )}
    </div>
  );
}
