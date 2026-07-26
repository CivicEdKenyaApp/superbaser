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
      setMessage('Enter a promo code');
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
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        Have a promo code?
      </label>
      <div className="flex gap-2">
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
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm uppercase placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          disabled={status === 'validating'}
        />
        <button
          onClick={handleRedeem}
          disabled={status === 'validating' || !code.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'validating' ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            'Apply'
          )}
        </button>
      </div>

      {status === 'success' && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-green-50 p-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {message}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {message}
        </div>
      )}
    </div>
  );
}
