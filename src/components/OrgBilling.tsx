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
      const { data, error } = await supabase.rpc('get_org_promo_status', { p_organization_id: organizationId });
      if (error) throw error;
      setPlan(data?.plan || 'free');
      setIsLifetime(data?.is_lifetime || false);
      setRedemptions(data?.redemptions || []);
    } catch {
      const { data: org } = await supabase.from('organizations').select('plan').eq('id', organizationId).single();
      setPlan(org?.plan || 'free');
      setIsLifetime((org?.plan || '').toLowerCase() === 'pro_lifetime');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [organizationId]);

  if (loading) return <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400"><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading billing...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current Plan</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{plan}</span>
            {isLifetime && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                LIFETIME
              </span>
            )}
          </div>
        </div>
      </div>

      {redemptions.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Redeemed codes:</p>
          <div className="space-y-1">
            {redemptions.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono text-gray-700 dark:text-gray-300">{r.code}</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">{r.tier}</span>
                <span className="text-gray-400">{new Date(r.redeemed_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLifetime ? (
        <PromoCodeInput organizationId={organizationId} onRedeemed={() => { fetchStatus(); onPlanChanged?.(); }} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
          This organization has lifetime Pro access. No promo code needed.
        </div>
      )}
    </div>
  );
}
