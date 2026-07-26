import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface PromoCodeInputProps {
  organizationId: string;
  onRedeemed?: () => void;
}

export function PromoCodeInput({ organizationId, onRedeemed }: PromoCodeInputProps) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleRedeem = async () => {
    if (!code.trim()) {
      setStatus('error');
      setMessage('Enter a valid promo code');
      return;
    }

    setStatus('validating');
    setMessage('');

    try {
      const { data, error } = await supabase.rpc('redeem_promo_code', {
        p_code: code.trim(),
        p_organization_id: organizationId,
      });

      if (error) throw error;

      if (data?.success) {
        setStatus('success');
        setMessage(data.message || 'Lifetime Pro access unlocked!');
        setCode('');
        onRedeemed?.();
      } else {
        setStatus('error');
        setMessage(data?.error || 'Invalid promo code');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to redeem promo code');
    }
  };

  return (
    <div className="p-5 bg-panel border-2 border-ink shadow-[6px_6px_0_#171714] font-mono">
      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-ink">
        Have a SuperBaser Promo Code?
      </label>
      <div className="flex gap-3 max-sm:flex-col">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (status !== 'idle') {
              setStatus('idle');
              setMessage('');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRedeem();
          }}
          placeholder="SUPERBASER-PRO_LIFETIME-XXXXXX"
          className="flex-1 border-2 border-ink bg-white px-4 py-3 text-xs uppercase font-mono font-bold text-ink placeholder:text-muted/60 focus:border-orange focus:outline-none"
          disabled={status === 'validating'}
        />
        <button
          onClick={handleRedeem}
          disabled={status === 'validating' || !code.trim()}
          className="px-6 py-3 border-2 border-ink bg-acid text-ink font-mono font-bold text-xs uppercase tracking-wider shadow-[3px_3px_0_#171714] hover:bg-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {status === 'validating' ? (
            <svg className="h-4 w-4 animate-spin mx-auto text-ink" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            'Apply ↗'
          )}
        </button>
      </div>

      {status === 'success' && (
        <div className="mt-4 p-3 bg-acid border border-ink text-ink font-mono font-bold text-xs uppercase shadow-[2px_2px_0_#171714] flex items-center gap-2">
          <span>✓</span> {message}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-100 border border-red-500 text-red-700 font-mono font-bold text-xs uppercase flex items-center gap-2">
          <span>✕</span> {message}
        </div>
      )}
    </div>
  );
}
