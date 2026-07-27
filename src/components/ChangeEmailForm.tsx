import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function ChangeEmailForm() {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');

  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setCurrentEmail(data.user.email);
    });
  });

  const handleChangeEmail = async () => {
    setLoading(true); setError(''); setInfo('');
    if (!newEmail || newEmail === currentEmail) { setError('Enter a new email address different from your current one.'); setLoading(false); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) { setError('Please enter a valid email address.'); setLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) { setError(error.message); }
    else {
      setInfo('Verification links sent to BOTH your current email (' + currentEmail + ') and your new email (' + newEmail + '). You must click the link in BOTH inboxes to confirm the change. The change will not take effect until both are confirmed.');
      setNewEmail('');
    }
    setLoading(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Change Email Address</h3>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Current: <span className="font-mono">{currentEmail || 'Loading...'}</span></p>
      {error && <p className="mb-3 rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
      {info && <div className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"><p className="mb-1 font-medium">Double verification required</p>{info}</div>}
      <div className="flex gap-2">
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" disabled={loading} onKeyDown={(e) => e.key === 'Enter' && handleChangeEmail()} />
        <button onClick={handleChangeEmail} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{loading ? 'Sending...' : 'Change Email'}</button>
      </div>
    </div>
  );
}
