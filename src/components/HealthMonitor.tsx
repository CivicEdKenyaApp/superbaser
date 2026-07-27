import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function HealthMonitor() {
  const [heartbeats, setHeartbeats] = useState<any[]>([]);
  const [slaChecks, setSlaChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const { data: hbData } = await supabase
        .from('worker_heartbeats')
        .select('worker_id, last_seen, status, jobs_processed, jobs_failed')
        .order('last_seen', { ascending: false })
        .limit(10);
      setHeartbeats(hbData || []);

      const { data: slaData } = await supabase
        .from('sla_checks')
        .select('project_id, status, last_verified_backup_age_hours, last_checked_at')
        .order('last_checked_at', { ascending: false })
        .limit(20);
      setSlaChecks(slaData || []);
    } catch (err) {
      console.error('Failed to fetch health data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const hbChannel = supabase
      .channel('worker-heartbeats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_heartbeats' }, () => { fetchHealth(); })
      .subscribe();
    const slaChannel = supabase
      .channel('sla-checks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sla_checks' }, () => { fetchHealth(); })
      .subscribe();
    return () => { supabase.removeChannel(hbChannel); supabase.removeChannel(slaChannel); };
  }, []);

  const formatTimeAgo = (timestamp: string): string => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Worker Heartbeats</h3>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        ) : heartbeats.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No workers have reported yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Worker ID', 'Status', 'Last Seen', 'Processed', 'Failed'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {heartbeats.map((hb) => (
                  <tr key={hb.worker_id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{hb.worker_id}</td>
                    <td className="px-4 py-2">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (hb.status === 'healthy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>
                        {hb.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(hb.last_seen)}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{hb.jobs_processed}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{hb.jobs_failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Backup SLA Status</h3>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        ) : slaChecks.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No SLA checks have been run yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Project', 'Status', 'Last Backup Age', 'Checked'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {slaChecks.map((sla, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{sla.project_id?.slice(0, 8)}...</td>
                    <td className="px-4 py-2">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (
                        sla.status === 'healthy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        sla.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        {sla.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {sla.last_verified_backup_age_hours !== null ? sla.last_verified_backup_age_hours.toFixed(1) + 'h' : 'No verified backup'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(sla.last_checked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
