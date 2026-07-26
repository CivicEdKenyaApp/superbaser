import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface PromoAdminPanelProps {
  onGenerated?: () => void;
}

export function PromoAdminPanel({ onGenerated }: PromoAdminPanelProps) {
  const [count, setCount] = useState(20);
  const [tier, setTier] = useState('pro_lifetime');
  const [prefix, setPrefix] = useState('SUPERBASER');
  const [generating, setGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<{ code: string; id: string }[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setGeneratedCodes([]);

    try {
      const { data, error } = await supabase.rpc('generate_promo_codes', {
        p_count: count,
        p_tier: tier,
        p_prefix: prefix,
      });

      if (error) throw error;
      setGeneratedCodes(data || []);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate codes');
    } finally {
      setGenerating(false);
    }
  };

  const handleList = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('list_promo_codes');
      if (error) throw error;
      setCodes(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load codes');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Generate */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Generate Promo Codes
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Count</label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="pro_lifetime">pro_lifetime</option>
              <option value="pro">pro</option>
              <option value="premium">premium</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Prefix</label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm uppercase dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? 'Generating...' : `Generate ${count} Codes`}
        </button>

        {generatedCodes.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                {generatedCodes.length} codes generated — copy them now:
              </span>
              <button
                onClick={() => copyToClipboard(generatedCodes.map((c) => c.code).join('\n'))}
                className="text-xs text-blue-600 hover:underline"
              >
                Copy all
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              {generatedCodes.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 last:border-0 dark:border-gray-700"
                >
                  <code className="text-sm font-mono text-gray-800 dark:text-gray-200">{c.code}</code>
                  <button
                    onClick={() => copyToClipboard(c.code)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Promo Codes</h3>
          <button
            onClick={handleList}
            disabled={loading}
            className="text-xs text-blue-600 hover:underline"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {codes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700">
                  <th className="pb-2 pr-4">Code</th>
                  <th className="pb-2 pr-4">Tier</th>
                  <th className="pb-2 pr-4">Uses</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="py-2 pr-4 font-mono text-xs">{c.code}</td>
                    <td className="py-2 pr-4">{c.tier}</td>
                    <td className="py-2 pr-4">
                      {c.uses_count}/{c.max_uses}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : c.status === 'redeemed'
                            ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {codes.length === 0 && !loading && !error && (
          <p className="text-sm text-gray-400">Click "Refresh" to load existing codes.</p>
        )}
      </div>
    </div>
  );
}
