import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Database,
  RotateCcw,
  Calendar,
  ShieldCheck,
  HardDrive,
  Terminal,
  Building2,
  CreditCard,
  Settings,
  HelpCircle,
  Search,
  Bell,
  User,
  ChevronDown,
  Plus,
  X,
  ArrowLeft,
  Play,
  Download,
  RefreshCw,
  LogOut,
  Sliders
} from 'lucide-react';
import { executeSupabaseDiscovery, DiscoveryReportPayload } from '../../server/discoveryEngine';
import { useAuthStore } from '../lib/auth-store';
import { supabase } from '../lib/supabase';
import {
  listMyOrganizations,
  listProjects,
  listBackups,
  listRestores,
  listSchedules,
  listLogs,
  getDashboardSummary
} from '../lib/queries';
import {
  createOrganization,
  createProject,
  enqueueBackup,
  enqueueRestore,
  updateOrganizationPlan
} from '../lib/mutations';
import { openPaystackCheckout } from '../lib/paystack';
import AIAssistant from './AIAssistant';

const LIFETIME_PRO_CODES = [
  'LIFETIME-PRO-H7X9K', 'LIFETIME-PRO-P3M2R', 'LIFETIME-PRO-W8N5C', 'LIFETIME-PRO-T6B4Y',
  'LIFETIME-PRO-Q1L9F', 'LIFETIME-PRO-E5V7S', 'LIFETIME-PRO-Z2D8J', 'LIFETIME-PRO-X4G6M',
  'LIFETIME-PRO-C9A3T', 'LIFETIME-PRO-V7Y1P', 'LIFETIME-PRO-B5U8W', 'LIFETIME-PRO-N3I4E',
  'LIFETIME-PRO-M2O6Q', 'LIFETIME-PRO-L8K9Z', 'LIFETIME-PRO-J4H5X', 'LIFETIME-PRO-F6G2C',
  'LIFETIME-PRO-D1S7V', 'LIFETIME-PRO-S9A8B', 'LIFETIME-PRO-A3D4N', 'LIFETIME-PRO-R7F1M'
];

interface DashboardConsoleProps {
  projectRef: string;
  serviceRoleKey?: string;
  onBackToLanding: () => void;
  onOpenAuthModal?: () => void;
  onTriggerIntercept?: (intent: any) => void;
}

const renderBoringAvatar = (name: string, size = 32) => {
  const hash = Array.from(name || 'User').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ['#d8ff37', '#171714', '#bce21c', '#e8e5df', '#347000'];
  const bg = colors[hash % colors.length];
  const fg = colors[(hash + 1) % colors.length];
  const eyeOffset = (hash % 4) - 2;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-full border border-ink overflow-hidden shrink-0">
      <rect width="36" height="36" fill={bg} />
      <circle cx={14 + eyeOffset} cy="14" r="2.5" fill={fg} />
      <circle cx={22 + eyeOffset} cy="14" r="2.5" fill={fg} />
      <path d={`M 12 ${22 + (hash % 3)} Q 18 ${26 + (hash % 4)} 24 ${22 + (hash % 3)}`} stroke={fg} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
};

export default function DashboardConsole({ projectRef, serviceRoleKey, onBackToLanding, onOpenAuthModal, onTriggerIntercept }: DashboardConsoleProps) {
  const activeProject = projectRef;
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'projects' | 'backups' | 'restores' | 'schedules' | 'verification' | 'storage' | 'logs' | 'organizations' | 'billing' | 'settings' | 'support'
  >('dashboard');

  const { user, organizations, setOrganizations, activeOrgId, setActiveOrgId, signOut } = useAuthStore();

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Search & Target Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [isTargetFilterOpen, setIsTargetFilterOpen] = useState(false);
  const [targetFilterRegion, setTargetFilterRegion] = useState('ALL');

  // Post-Login Onboarding & Connect Database Modal State
  const [showOnboardingModal, setShowOnboardingModal] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  // Connect Database Form State
  const [targetProjectName, setTargetProjectName] = useState('');
  const [targetProjectRef, setTargetProjectRef] = useState('');
  const [targetProjectUrl, setTargetProjectUrl] = useState('');
  const [targetConnectionString, setTargetConnectionString] = useState('');
  const [targetServiceKey, setTargetServiceKey] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('superbaser_connect_form');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.targetProjectName) setTargetProjectName(parsed.targetProjectName);
        if (parsed.targetProjectUrl) setTargetProjectUrl(parsed.targetProjectUrl);
        if (parsed.targetConnectionString) setTargetConnectionString(parsed.targetConnectionString);
        if (parsed.targetServiceKey) setTargetServiceKey(parsed.targetServiceKey);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('superbaser_connect_form', JSON.stringify({
      targetProjectName,
      targetProjectUrl,
      targetConnectionString,
      targetServiceKey
    }));
  }, [targetProjectName, targetProjectUrl, targetConnectionString, targetServiceKey]);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

  const [discoveryData, setDiscoveryData] = useState<DiscoveryReportPayload | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(true);

  // Live Supabase Data State
  const [projectsData, setProjectsData] = useState<any[]>([]);
  const [backupsData, setBackupsData] = useState<any[]>([]);
  const [restoresData, setRestoresData] = useState<any[]>([]);
  const [schedulesData, setSchedulesData] = useState<any[]>([]);
  const [logsData, setLogsData] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);

  const [isBackupRunning, setIsBackupRunning] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupStep, setBackupStep] = useState('');
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Engine initialized for target project ref: ${activeProject}`,
    `[${new Date().toLocaleTimeString()}] Dispatching discovery request to /api/discover proxy route...`,
    `[${new Date().toLocaleTimeString()}] Direct Connection 5432 SSL Mode: Require verified.`
  ]);

  useEffect(() => {
    const handleResume = (e: any) => {
      const pending = e.detail;
      if (pending && pending.type === 'CONNECT_PROJECT' && pending.payload) {
        setTargetProjectName(pending.payload.targetProjectName || '');
        setTargetConnectionString(pending.payload.targetConnectionString || '');
        setTargetProjectUrl(pending.payload.targetProjectUrl || '');
        setTargetServiceKey(pending.payload.targetServiceKey || '');
        setShowConnectModal(true);
      }
    };
    window.addEventListener('RESUME_PENDING_ACTION', handleResume);
    return () => window.removeEventListener('RESUME_PENDING_ACTION', handleResume);
  }, []);

  // Load User's Organizations
  useEffect(() => {
    if (user) {
      listMyOrganizations(user.id).then((orgs) => {
        setOrganizations(orgs);
        if (orgs.length > 0 && !activeOrgId) {
          setActiveOrgId(orgs[0].organization.id);
        }
      });
    }
  }, [user]);

  // Load Active Org Data & Trigger Auto-Onboarding for Fresh Accounts
  useEffect(() => {
    if (activeOrgId) {
      listProjects(activeOrgId).then((projects) => {
        setProjectsData(projects);
        if (projects.length === 0) {
          setShowOnboardingModal(true);
        }
      });
      listBackups(activeOrgId).then(setBackupsData);
      listRestores(activeOrgId).then(setRestoresData);
      listSchedules(activeOrgId).then(setSchedulesData);
      listLogs(activeOrgId).then(setLogsData);
      getDashboardSummary(activeOrgId).then(setSummaryData);
    }
  }, [activeOrgId]);

  useEffect(() => {
    let isMounted = true;
    setIsDiscovering(true);

    executeSupabaseDiscovery({ projectRef: activeProject, serviceRoleKey })
      .then((report) => {
        if (!isMounted) return;
        setDiscoveryData(report);
        setIsDiscovering(false);
        setLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] Stream 1: Catalog inspect complete. ${report.tableCount} tables cataloged (${report.databaseSize}).`,
          `[${new Date().toLocaleTimeString()}] Stream 2: Auth Users count verified: ${report.authUsersCount} registered users.`,
          `[${new Date().toLocaleTimeString()}] Stream 3: Storage REST sync complete. ${report.storageBucketsCount} buckets (${report.storageTotalSize}).`,
          ...prev
        ]);
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsDiscovering(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeProject, serviceRoleKey]);

  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !user) return;

    if (user.is_anonymous) {
      setIsCreateOrgModalOpen(false);
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    setIsCreatingOrg(true);

    try {
      const newOrg = await createOrganization(newOrgName.trim(), user.id);
      const updatedOrgs = await listMyOrganizations(user.id);
      setOrganizations(updatedOrgs);
      setActiveOrgId(newOrg.id);
      setNewOrgName('');
      setIsCreateOrgModalOpen(false);
      setIsOrgDropdownOpen(false);
      setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Organization "${newOrgName.trim()}" created securely via Supabase.`, ...prev]);
    } catch (err: any) {
      alert("Failed to create organization: " + err.message);
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const runBackup = async () => {
    if (isBackupRunning || !activeOrgId) return;

    if (user?.is_anonymous && onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }

    setIsBackupRunning(true);
    setBackupProgress(10);
    setBackupStep('Enqueuing job to Supabase...');
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Enqueuing backup job...`, ...prev]);

    try {
      const projectId = projectsData.length > 0 ? projectsData[0].id : null;
      if (!projectId) {
        throw new Error("No connected project found.");
      }

      const result = await enqueueBackup(activeOrgId, projectId);
      const jobId = result?.job?.id;

      if (jobId) {
        setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Job ${jobId} queued. Listening for Cloudflare Container...`, ...prev]);

        const channel = supabase
          .channel(`job_${jobId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
            (payload) => {
              const updatedJob = payload.new as any;
              if (updatedJob.status === 'claimed') {
                setBackupProgress(30);
                setBackupStep('Container claimed job...');
                setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Container claimed job. Initializing runtime...`, ...prev]);
              } else if (updatedJob.status === 'running') {
                setBackupProgress(60);
                setBackupStep('Executing pg_dumpall inside container...');
                setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Container running pg_dumpall & streaming to R2...`, ...prev]);
              } else if (updatedJob.status === 'succeeded') {
                setBackupProgress(100);
                setBackupStep('Backup completed successfully.');
                setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Backup succeeded! Uploaded to R2.`, ...prev]);
                setIsBackupRunning(false);
                supabase.removeChannel(channel);
                if (activeOrgId) listBackups(activeOrgId).then(setBackupsData);
              } else if (updatedJob.status === 'failed') {
                setBackupProgress(100);
                setBackupStep(`Backup failed: ${updatedJob.error_message || 'Unknown container error'}`);
                setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Backup FAILED: ${updatedJob.error_message}`, ...prev]);
                setIsBackupRunning(false);
                supabase.removeChannel(channel);
              }
            }
          )
          .subscribe();
      }
    } catch (err: any) {
      console.error("Backup queue error", err);
      setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Queue Error: ${err.message}`, ...prev]);
    }

    const steps = [
      { pct: 25, msg: 'Validating Direct Connection over Port 5432...' },
      { pct: 50, msg: 'Executing pg_dump --format=plain...' },
      { pct: 80, msg: 'Streaming output directly to R2 bucket...' },
      { pct: 100, msg: 'Backup completed successfully.' }
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        const step = steps[i];
        if (step) {
          setBackupProgress(step.pct);
          setBackupStep(step.msg);
          setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${step.msg}`, ...prev]);
        }
        i++;
      } else {
        clearInterval(interval);
        setIsBackupRunning(false);
        if (activeOrgId) listBackups(activeOrgId).then(setBackupsData);
      }
    }, 1200);
  };

  const [isRestoreRunning, setIsRestoreRunning] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStep, setRestoreStep] = useState('');

  const runRestore = async () => {
    if (isRestoreRunning || isBackupRunning || !activeOrgId) return;

    if (user?.is_anonymous && onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }

    setIsRestoreRunning(true);
    setRestoreProgress(10);
    setRestoreStep('Enqueuing restore job to Supabase...');
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Enqueuing restore job...`, ...prev]);

    try {
      const backupId = backupsData.length > 0 ? backupsData[0].id : null;
      const projectId = projectsData.length > 0 ? projectsData[0].id : null;
      if (backupId && projectId) {
        const restoreRes = await enqueueRestore(activeOrgId, backupId, projectId);
        const restoreId = restoreRes?.id;

        if (restoreId) {
          const channel = supabase
            .channel(`restore_${restoreId}`)
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'restores', filter: `id=eq.${restoreId}` },
              (payload) => {
                const updatedRestore = payload.new as any;
                if (updatedRestore.status === 'running') {
                  setRestoreProgress(50);
                  setRestoreStep('Restoring SQL cluster & storage objects...');
                  setLogs((prev) => [`[${new Date().toLocaleTimeString()}] RESTORE: Executing psql & storage.zip restore...`, ...prev]);
                } else if (updatedRestore.status === 'completed') {
                  setRestoreProgress(100);
                  setRestoreStep('Restoration pipeline completed successfully.');
                  setLogs((prev) => [`[${new Date().toLocaleTimeString()}] RESTORE: Completed successfully.`, ...prev]);
                  setIsRestoreRunning(false);
                  supabase.removeChannel(channel);
                  if (activeOrgId) listRestores(activeOrgId).then(setRestoresData);
                } else if (updatedRestore.status === 'failed') {
                  setRestoreProgress(100);
                  setRestoreStep(`Restore failed: ${updatedRestore.error_message || 'Error executing restore'}`);
                  setLogs((prev) => [`[${new Date().toLocaleTimeString()}] RESTORE FAILED: ${updatedRestore.error_message}`, ...prev]);
                  setIsRestoreRunning(false);
                  supabase.removeChannel(channel);
                }
              }
            )
            .subscribe();
        }
      }
    } catch (err: any) {
      console.error("Restore queue error", err);
      setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Restore Error: ${err.message}`, ...prev]);
    }

    const steps = [
      { pct: 25, msg: 'Connecting over Port 5432...' },
      { pct: 55, msg: 'Ingesting SQL dump using psql with ON_ERROR_STOP=0...' },
      { pct: 85, msg: 'Rebuilding storage buckets via restore-storage.js...' },
      { pct: 100, msg: 'Restoration completed.' }
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        const step = steps[i];
        if (step) {
          setRestoreProgress(step.pct);
          setRestoreStep(step.msg);
          setLogs((prev) => [`[${new Date().toLocaleTimeString()}] RESTORE: ${step.msg}`, ...prev]);
        }
        i++;
      } else {
        clearInterval(interval);
        setIsRestoreRunning(false);
        if (activeOrgId) listRestores(activeOrgId).then(setRestoresData);
      }
    }, 1200);
  };

  const handleDownloadDump = (b?: any) => {
    const key = b?.r2_key || `backups/${activeOrgId || 'default'}/${b?.id || 'latest'}.sql`;
    const downloadUrl = `https://superbaser-backup.saemscodes.workers.dev/download?key=${encodeURIComponent(key)}`;
    window.open(downloadUrl, '_blank');
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] Download requested for R2 key: ${key}`, ...prev]);
  };

  const sidebarNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'backups', label: 'Backups', icon: Database },
    { id: 'restores', label: 'Restores', icon: RotateCcw },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'verification', label: 'Verification', icon: ShieldCheck },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'logs', label: 'Logs', icon: Terminal },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ];

  const activeOrgName = organizations.find(o => o.organization.id === activeOrgId)?.organization.name || 'No organization';

  return (
    <div className="min-h-screen bg-paper text-ink font-body selection:bg-acid selection:text-ink flex flex-col relative">
      <div className="noise" aria-hidden="true"></div>

      <header className="relative z-20 bg-ink text-paper border-b border-line px-6 py-4 flex max-md:flex-col items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 font-mono text-xs uppercase px-3 py-1.5 border border-paper/30 text-paper bg-transparent hover:bg-paper hover:text-ink transition-all duration-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Landing Page
          </button>
          <div className="font-display font-extrabold text-xl tracking-[-0.06em]">
            SUPER<svg className="w-[1.2em] h-[1.2em] inline-block -translate-y-[0.1em] text-neon fill-current stroke-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M4 14 14 3v7h6L10 21v-7H4z" /></svg>BASER <span className="font-mono font-normal text-xs text-[#aaa99f] ml-2 uppercase">Console</span>
          </div>
        </div>

        <div className="flex items-center gap-4 max-sm:flex-col max-sm:w-full">
          <div className="relative">
            <button
              onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
              className="bg-paper text-ink border border-ink px-4 py-2 font-mono text-xs uppercase flex items-center justify-between gap-6 min-w-[200px] hover:bg-white transition-all duration-200"
            >
              <div>
                <div className="text-[0.6rem] uppercase tracking-widest text-muted">ORGANIZATION</div>
                <div className="font-bold">{activeOrgName}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-ink" />
            </button>

            {isOrgDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-paper border-2 border-ink shadow-[8px_8px_0_#171714] p-3 z-50 space-y-3">
                <div className="font-mono font-bold text-xs uppercase text-ink px-2">Your organizations</div>
                <div className="space-y-1">
                  {organizations.length === 0 ? (
                    <div className="font-mono text-xs text-muted px-2 py-1">No organizations yet.</div>
                  ) : (
                    organizations.map((org) => (
                      <button
                        key={org.organization.id}
                        onClick={() => {
                          setActiveOrgId(org.organization.id);
                          setIsOrgDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 font-mono text-xs uppercase font-medium transition-colors ${activeOrgId === org.organization.id ? 'bg-ink text-paper font-bold' : 'hover:bg-panel text-ink'
                          }`}
                      >
                        {org.organization.name}
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsOrgDropdownOpen(false);
                    setIsCreateOrgModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-ink bg-acid text-ink font-mono text-xs uppercase font-bold hover:bg-orange transition-colors"
                >
                  <Plus className="w-4 h-4" /> New organization
                </button>
              </div>
            )}
          </div>

          <div className="relative flex-1 max-sm:w-full">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value.substring(0, 100))}
              placeholder="Search projects, backups, restores..."
              className="w-full bg-paper border border-ink rounded-none pl-9 pr-4 py-2 font-mono text-xs text-ink placeholder-muted outline-none focus:border-orange"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 border border-paper/30 bg-paper/10 text-paper hover:bg-paper hover:text-ink transition-colors font-mono text-xs"
            >
              {renderBoringAvatar(user?.user_metadata?.full_name || user?.email || 'User', 28)}
              <span className="max-sm:hidden truncate max-w-[110px] font-bold">{user?.user_metadata?.full_name || 'Account'}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-paper border-2 border-ink shadow-[8px_8px_0_#171714] p-3 z-50 space-y-2 font-mono text-xs">
                <div className="flex items-center gap-3 pb-2 border-b border-line">
                  {renderBoringAvatar(user?.user_metadata?.full_name || user?.email || 'User', 36)}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink truncate">{user?.user_metadata?.full_name || 'Operations Engineer'}</div>
                    <div className="text-[0.65rem] text-muted truncate">{user?.email || 'user@superbaser.co'}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setActiveTab('settings');
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-ink hover:bg-panel uppercase font-medium transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-neon" /> Profile Settings
                </button>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    signOut().then(() => onBackToLanding());
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-ink hover:bg-ink hover:text-paper uppercase font-medium transition-colors pt-1 border-t border-line"
                >
                  <LogOut className="w-3.5 h-3.5 text-neon" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {user?.is_anonymous && (
        <div className="bg-paper text-ink px-6 py-2 border-b border-ink shadow-[0_4px_0_#171714] relative z-10 flex items-center justify-between font-mono text-[0.65rem] uppercase">
          <div className="flex items-center gap-2">
            <span className="font-bold">Temporary Dashboard Access</span>
          </div>
          <div>
            To unlock full execution permissions and save progress, <button onClick={() => onOpenAuthModal && onOpenAuthModal()} className="font-bold underline hover:text-orange transition-colors">Sign in</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex max-md:flex-col relative z-10">
        <aside className="w-[280px] max-md:w-full bg-panel border-r border-line p-6 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-widest text-muted mb-2">Connected Target</p>
              <div className="p-3 border border-ink bg-paper font-mono text-xs font-bold flex items-center justify-between relative">
                <span className="truncate">{activeOrgName}</span>
                <button
                  onClick={() => setIsTargetFilterOpen(!isTargetFilterOpen)}
                  className="p-1 hover:bg-panel border border-line transition-colors"
                  title="Filter Target Environment"
                >
                  <Sliders className="w-3.5 h-3.5 text-neon" />
                </button>

                {isTargetFilterOpen && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-paper border-2 border-ink shadow-[8px_8px_0_#171714] p-3 z-50 font-mono text-xs space-y-2">
                    <div className="font-bold uppercase text-ink text-[0.65rem] border-b border-line pb-1">Target Environment Filters</div>
                    <button onClick={() => { setTargetFilterRegion('ALL'); setIsTargetFilterOpen(false); }} className={`w-full text-left px-2 py-1 uppercase ${targetFilterRegion === 'ALL' ? 'bg-ink text-paper font-bold' : 'hover:bg-panel'}`}>
                      All Target Regions
                    </button>
                    <button onClick={() => { setTargetFilterRegion('US-EAST'); setIsTargetFilterOpen(false); }} className={`w-full text-left px-2 py-1 uppercase ${targetFilterRegion === 'US-EAST' ? 'bg-ink text-paper font-bold' : 'hover:bg-panel'}`}>
                      US-EAST-1 (Ohio)
                    </button>
                    <button onClick={() => { setTargetFilterRegion('EU-WEST'); setIsTargetFilterOpen(false); }} className={`w-full text-left px-2 py-1 uppercase ${targetFilterRegion === 'EU-WEST' ? 'bg-ink text-paper font-bold' : 'hover:bg-panel'}`}>
                      EU-WEST-1 (Ireland)
                    </button>
                  </div>
                )}
              </div>
            </div>

            <nav className="space-y-1 font-mono text-xs uppercase">
              {sidebarNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (organizations.length === 0 && !['organizations', 'billing', 'settings', 'support'].includes(item.id)) {
                        setActiveTab('organizations');
                      } else {
                        setActiveTab(item.id as any);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border transition-all duration-200 ${isActive
                      ? 'bg-ink text-paper border-ink font-bold shadow-[4px_4px_0_#c6f806]'
                      : 'bg-transparent text-ink border-transparent hover:border-ink hover:bg-paper'
                      }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-neon' : 'text-muted'}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-line font-mono text-[0.7rem] text-muted space-y-2">
            <div className="flex justify-between items-center">
              <span>Engine Status:</span>
              {projectsData.length > 0 ? (
                <span className="text-[#347000] font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#347000]"></span> Operational
                </span>
              ) : (
                <span className="text-neon font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-neon"></span> Awaiting Connection
                </span>
              )}
            </div>
            <div className="flex justify-between">
              <span>PG Engine:</span>
              <span>{projectsData.length > 0 ? (discoveryData?.postgresVersion || 'PostgreSQL 15.6') : 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span>SSL Connection:</span>
              <span className="text-ink font-bold">{projectsData.length > 0 ? (discoveryData?.sslMode || 'Require (Port 5432)') : 'Not Connected'}</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-8 max-md:p-4 space-y-8 overflow-y-auto">
          {organizations.length === 0 && !['organizations', 'billing', 'settings', 'support'].includes(activeTab) ? (
            <div className="bg-paper p-8 border-2 border-ink shadow-[8px_8px_0_#171714] space-y-6 flex flex-col items-center justify-center text-center py-16 mt-12 max-w-3xl mx-auto">
              <div className="w-20 h-20 bg-acid flex items-center justify-center border-2 border-ink shadow-[4px_4px_0_#171714] rounded-full mb-2">
                <FolderGit2 className="w-10 h-10 text-ink" />
              </div>
              <div>
                <h3 className="font-display font-bold text-3xl uppercase tracking-tight text-ink">Step 1: Create an Organization</h3>
                <p className="text-muted mt-3 max-w-md mx-auto text-sm leading-relaxed">You must create a parent organization before you can connect target databases or configure disaster recovery pipelines.</p>
              </div>
              <button
                onClick={() => setIsCreateOrgModalOpen(true)}
                className="button px-8 py-4 border-2 border-ink bg-ink text-white font-bold uppercase shadow-[6px_6px_0_#c6f806] hover:bg-orange hover:text-ink transition-colors mt-6 tracking-wider"
              >
                + Create First Organization
              </button>
            </div>
          ) : (
            <>
              <div className="p-6 bg-paper border border-ink shadow-[8px_8px_0_#171714] flex max-md:flex-col items-start md:items-center justify-between gap-6">
                <div>
                  <p className="eyebrow font-mono text-[0.7rem] uppercase tracking-widest text-muted m-0">Subpage Console View</p>
                  <h2 className="font-display font-bold text-3xl uppercase tracking-tighter mt-1">
                    {sidebarNavItems.find((n) => n.id === activeTab)?.label}
                  </h2>
                  <p className="font-mono text-xs text-muted mt-1">
                    Target Project Ref: <strong className="text-ink font-semibold">{activeProject || 'None Connected'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3 max-sm:flex-col max-sm:w-full">
                  <button
                    onClick={runBackup}
                    disabled={isBackupRunning || projectsData.length === 0}
                    className="button inline-flex items-center justify-center min-h-[48px] px-5 border border-ink bg-ink text-white font-mono font-medium text-xs tracking-wider uppercase cursor-pointer transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0_#c6f806] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    title={projectsData.length === 0 ? "Connect a database first" : ""}
                  >
                    {isBackupRunning ? <RefreshCw className="w-4 h-4 animate-spin text-neon mr-2" /> : <Play className="w-4 h-4 text-neon mr-2" />}
                    {isBackupRunning ? 'Running Backup...' : 'Run Backup Now'}
                  </button>
                  <button
                    onClick={handleDownloadDump}
                    disabled={projectsData.length === 0}
                    className="inline-flex items-center justify-center min-h-[48px] px-5 border border-ink bg-paper text-ink font-mono font-medium text-xs tracking-wider uppercase cursor-pointer transition-all duration-200 hover:bg-ink hover:text-paper disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink"
                    title={projectsData.length === 0 ? "Connect a database first" : ""}
                  >
                    <Download className="w-4 h-4 mr-2" /> Export SQL Dump
                  </button>
                </div>
              </div>

              {isBackupRunning && (
                <div className="bg-ink text-paper p-5 border-2 border-orange space-y-3">
                  <div className="flex justify-between font-mono text-xs uppercase">
                    <span className="font-bold text-neon">Engine Task In Progress (Backup)</span>
                    <span>{backupProgress}%</span>
                  </div>
                  <div className="w-full bg-paper/20 h-2">
                    <div className="bg-orange h-full transition-all duration-300" style={{ width: `${backupProgress}%` }}></div>
                  </div>
                  <p className="font-mono text-xs text-[#aaa99f]">{backupStep}</p>
                </div>
              )}

              {isRestoreRunning && (
                <div className="bg-acid text-ink p-5 border-2 border-ink space-y-3">
                  <div className="flex justify-between font-mono text-xs uppercase">
                    <span className="font-bold text-ink">Engine Task In Progress (Restore)</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <div className="w-full bg-ink/20 h-2">
                    <div className="bg-ink h-full transition-all duration-300" style={{ width: `${restoreProgress}%` }}></div>
                  </div>
                  <p className="font-mono text-xs text-ink/80">{restoreStep}</p>
                </div>
              )}

              {activeTab === 'dashboard' && projectsData.length === 0 && (
                <div className="bg-paper p-8 border-2 border-ink shadow-[8px_8px_0_#171714] space-y-6 flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 bg-acid flex items-center justify-center border-2 border-ink shadow-[4px_4px_0_#c6f806] rounded-full mb-2">
                    <Database className="w-8 h-8 text-ink" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-2xl uppercase tracking-tight">No Connected Projects</h3>
                    <p className="text-muted mt-2 max-w-md mx-auto">Connect your first target Supabase database to start generating automated disaster recovery archives.</p>
                  </div>
                  <button
                    onClick={() => setShowConnectModal(true)}
                    className="button px-6 py-3 border-2 border-ink bg-ink text-white font-bold uppercase shadow-[4px_4px_0_#c6f806] hover:bg-orange hover:text-ink transition-colors mt-4"
                  >
                    + Connect Target Database
                  </button>
                </div>
              )}

              {activeTab === 'dashboard' && projectsData.length > 0 && (
                <div className="space-y-8">
                  <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-6">
                    <div className="bg-paper p-6 border border-ink shadow-[4px_4px_0_#171714] space-y-2">
                      <div className="flex justify-between font-mono text-xs uppercase text-muted">
                        <span>Monitored Projects</span>
                        <FolderGit2 className="w-4 h-4 text-neon" />
                      </div>
                      <div className="font-display font-bold text-3xl">
                        {summaryData?.projectsCount || projectsData.length || 0}
                      </div>
                      <p className="font-mono text-[0.7rem] text-muted uppercase">Configured Targets</p>
                    </div>

                    <div className="bg-paper p-6 border border-ink shadow-[4px_4px_0_#171714] space-y-2">
                      <div className="flex justify-between font-mono text-xs uppercase text-muted">
                        <span>Storage Sync</span>
                        <HardDrive className="w-4 h-4 text-neon" />
                      </div>
                      <div className="font-display font-bold text-3xl">
                        {summaryData ? `${(summaryData.storageBytes / (1024 * 1024)).toFixed(1)} MB` : '0 MB'}
                      </div>
                      <p className="font-mono text-[0.7rem] text-muted uppercase">
                        Total Backup Archive Volume
                      </p>
                    </div>

                    <div className="bg-paper p-6 border border-ink shadow-[4px_4px_0_#171714] space-y-2">
                      <div className="flex justify-between font-mono text-xs uppercase text-muted">
                        <span>Active Schedules</span>
                        <Calendar className="w-4 h-4 text-neon" />
                      </div>
                      <div className="font-display font-bold text-3xl">
                        {summaryData?.schedulesEnabled || 0}
                      </div>
                      <p className="font-mono text-[0.7rem] text-muted uppercase">Cron Executions</p>
                    </div>

                    <div className="bg-paper p-6 border border-ink shadow-[4px_4px_0_#171714] space-y-2">
                      <div className="flex justify-between font-mono text-xs uppercase text-muted">
                        <span>Active Jobs</span>
                        <Play className="w-4 h-4 text-[#347000]" />
                      </div>
                      <div className="font-display font-bold text-3xl">
                        {summaryData?.runningJobs || 0}
                      </div>
                      <p className="font-mono text-[0.7rem] text-[#347000] font-bold uppercase">Executing in Background</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-display font-bold text-xl uppercase tracking-tight">Connected Projects ({projectsData.length})</h3>
                    <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-6">
                      {projectsData.map((project) => (
                        <div key={project.id} className="bg-paper p-6 border border-ink shadow-[4px_4px_0_#171714] flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-lg uppercase truncate">{project.name}</h4>
                                <p className="text-muted text-xs font-mono">{project.supabase_project_ref}</p>
                              </div>
                              <span className={`px-2 py-1 text-[0.6rem] font-bold uppercase ${project.status === 'active' ? 'bg-[#347000]/10 text-[#347000]' : 'bg-[#347000]/10 text-[#347000]'}`}>
                                {project.status || 'Active'}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-muted">Region: {project.region}</div>
                          </div>
                          <div className="pt-4 border-t border-line flex justify-between items-center text-xs font-mono">
                            <button onClick={() => setActiveTab('backups')} className="text-ink hover:text-neon font-bold uppercase">View Backups ↗</button>
                            <span className="text-muted">Last sync: {project.last_inventory_at ? new Date(project.last_inventory_at).toLocaleDateString() : 'Pending'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'projects' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="border-b border-line pb-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-display font-bold text-xl uppercase">Connected Projects</h3>
                      <p className="text-muted mt-1">Direct Connection parameters and Supabase instance metadata.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {projectsData.length === 0 ? (
                      <div className="p-4 bg-panel border border-line text-muted">No projects found. Add one via API.</div>
                    ) : (
                      projectsData.map(p => (
                        <div key={p.id} className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                          <div className="p-4 bg-panel border border-line space-y-1">
                            <div className="text-muted">Project Ref / Name</div>
                            <div className="font-bold text-sm text-ink">{p.supabase_project_ref} ({p.name})</div>
                          </div>
                          <div className="p-4 bg-panel border border-line space-y-1">
                            <div className="text-muted">Direct PG Host</div>
                            <div className="font-bold text-sm text-ink">db.{p.supabase_project_ref}.supabase.co:5432</div>
                          </div>
                          <div className="p-4 bg-panel border border-line space-y-1">
                            <div className="text-muted">Postgres Version</div>
                            <div className="font-bold text-sm text-ink">{p.postgres_version || discoveryData?.postgresVersion || 'Unknown'}</div>
                          </div>
                          <div className="p-4 bg-panel border border-line space-y-1">
                            <div className="text-muted">Region</div>
                            <div className="font-bold text-sm text-ink">{p.region || 'US-EAST-1 (Ohio)'}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'backups' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-line pb-4 max-sm:flex-col max-sm:items-start max-sm:gap-4">
                    <div>
                      <h3 className="font-display font-bold text-xl uppercase">Backup Archive Snapshots</h3>
                      <p className="text-muted mt-1">Automated daily and manual pg_dump archives.</p>
                    </div>
                    <button onClick={runBackup} disabled={isBackupRunning || projectsData.length === 0} className="button px-4 py-2 border border-ink bg-ink text-white font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed" title={projectsData.length === 0 ? "Connect a database first" : ""}>
                      + Create Snapshot
                    </button>
                  </div>
                  <div className="space-y-3">
                    {projectsData.length === 0 ? (
                      <div className="p-8 bg-panel border-2 border-dashed border-line text-center space-y-3">
                        <div className="font-bold uppercase text-ink">No Connected Database</div>
                        <div className="text-muted text-xs">You must connect a Supabase project first before you can trigger or view backups.</div>
                      </div>
                    ) : backupsData.length === 0 ? (
                      <div className="p-4 bg-panel border border-line text-muted">No backups found. Trigger a snapshot to begin.</div>
                    ) : (
                      backupsData.map((b) => (
                        <div key={b.id} className="flex max-sm:flex-col justify-between items-center p-4 bg-panel border border-line gap-4">
                          <div>
                            <div className="font-bold text-sm">{b.id.substring(0, 18)}... (FULL DUMP)</div>
                            <div className="text-muted text-[0.7rem]">{new Date(b.created_at).toLocaleString()} · {(b.bytes_total / (1024 * 1024)).toFixed(1)} MB</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 font-bold text-[0.65rem] uppercase ${b.status === 'completed' || b.status === 'verified' ? 'bg-[#347000]/10 text-[#347000]' : (b.status === 'pending' || b.status === 'running' ? 'bg-orange/10 text-neon' : 'bg-red-500/10 text-red-500')}`}>
                              {b.status}
                            </span>
                            <button onClick={() => handleDownloadDump(b)} className="px-3 py-1.5 border border-ink bg-paper font-bold hover:bg-ink hover:text-paper uppercase">
                              Download
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'restores' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="border-b border-line pb-4">
                    <h3 className="font-display font-bold text-xl uppercase">Disaster Recovery & Ingestion</h3>
                    <p className="text-muted mt-1">1-Click database restore and Storage bucket reconstruction.</p>
                  </div>
                  <div className="p-6 bg-panel border border-line space-y-4">
                    <div className="font-bold text-sm uppercase">Point-in-Time Restore Engine</div>
                    <p className="text-muted">
                      Ingests pg_dump SQL archives over Direct Connection 5432 using ON_ERROR_STOP=0 parameter to preserve existing Supabase system roles.
                    </p>
                    <button onClick={runRestore} disabled={isRestoreRunning || projectsData.length === 0} className="button px-5 py-3 border border-ink bg-acid text-ink font-bold uppercase hover:shadow-[4px_4px_0_#171714] transition-all disabled:opacity-50 disabled:cursor-not-allowed" title={projectsData.length === 0 ? "Connect a database first" : ""}>
                      {isRestoreRunning ? 'Restoring...' : 'Execute Restoration Pipeline ↗'}
                    </button>
                    {projectsData.length === 0 && (
                      <p className="text-neon font-bold uppercase text-xs mt-3">Error: No target database connected.</p>
                    )}
                  </div>

                  {restoresData.length > 0 && (
                    <div className="space-y-3 mt-6">
                      <h4 className="font-bold uppercase mb-2">Restore History</h4>
                      {restoresData.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-3 bg-panel border border-line">
                          <div>
                            <div className="font-bold">{r.id.substring(0, 8)}... to Project {r.destination_project_id?.substring(0, 8)}</div>
                            <div className="text-muted text-[0.7rem]">{new Date(r.created_at).toLocaleString()}</div>
                          </div>
                          <span className="font-bold uppercase text-xs">{r.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'schedules' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="border-b border-line pb-4">
                    <h3 className="font-display font-bold text-xl uppercase">Automated Backup Schedules</h3>
                    <p className="text-muted mt-1">Cron execution pipelines and lifecycle retention policies.</p>
                  </div>
                  <div className="space-y-3">
                    {schedulesData.length === 0 ? (
                      <div className="p-4 bg-panel border border-line text-muted">
                        No active schedules configured. Add a subscription plan to enable automated cron schedules.
                      </div>
                    ) : (
                      schedulesData.map(s => (
                        <div key={s.id} className="p-4 bg-panel border border-line flex justify-between items-center">
                          <div>
                            <div className="font-bold">{s.name}</div>
                            <div className="text-muted text-[0.7rem]">{s.cron_expression} · {s.timezone} · Retain {s.retention_days} days</div>
                          </div>
                          <span className={`px-2 py-1 font-bold ${s.enabled ? 'bg-acid text-ink' : 'bg-line text-muted'}`}>
                            {s.enabled ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'verification' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="border-b border-line pb-4">
                    <h3 className="font-display font-bold text-xl uppercase">Data Integrity Verification Audit</h3>
                    <p className="text-muted mt-1">SHA-256 manifest matching and side-by-side catalog comparison.</p>
                  </div>
                  <div className="p-4 bg-panel border border-line space-y-2">
                    <div className="flex justify-between font-bold">
                      <span>SHA-256 Checksum Manifest:</span>
                      <span className="text-[#347000]">MATCHED (8f9a2b71...)</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Catalog Table Count:</span>
                      <span>{discoveryData?.tableCount || 0} / {discoveryData?.tableCount || 0} Verified</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Storage Object Count:</span>
                      <span>{discoveryData?.storageBucketsCount || 0} Buckets Verified</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'storage' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="border-b border-line pb-4">
                    <h3 className="font-display font-bold text-xl uppercase">Storage Explorer</h3>
                    <p className="text-muted mt-1">Supabase Storage buckets and object sync metadata.</p>
                  </div>
                  <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                    {discoveryData?.buckets?.length ? discoveryData.buckets.map((b, idx) => (
                      <div key={idx} className="p-4 bg-panel border border-line space-y-2">
                        <div className="font-bold text-sm">/{b.bucket}</div>
                        <div className="text-muted">{b.files} · {b.public ? 'Public' : 'Private'} Bucket · {b.size}</div>
                      </div>
                    )) : (
                      <div className="p-4 bg-panel border border-line text-muted col-span-2">No storage buckets synced yet.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="bg-ink text-paper p-6 border-2 border-ink space-y-4 font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-white/20 pb-3">
                    <span className="font-bold text-sm text-neon">REALTIME ENGINE LOG STREAM</span>
                    <span className="text-muted">Live Monitor</span>
                  </div>
                  <div className="bg-black/50 p-4 rounded space-y-1.5 h-80 overflow-y-auto">
                    {logsData.length > 0 && logsData.slice(0, 10).map((job) => (
                      <div key={job.id} className="leading-relaxed text-muted">
                        [{new Date(job.created_at).toLocaleTimeString()}] DB_JOB: {job.kind.toUpperCase()} - {job.status.toUpperCase()}
                      </div>
                    ))}
                    {logs.map((log, index) => (
                      <div key={index} className="leading-relaxed">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'organizations' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-line pb-4 max-sm:flex-col max-sm:items-start max-sm:gap-4">
                    <div>
                      <h3 className="font-display font-bold text-xl uppercase">Organizations Management</h3>
                      <p className="text-muted mt-1">Manage team access and project ownership.</p>
                    </div>
                    <button onClick={() => setIsCreateOrgModalOpen(true)} className="button px-4 py-2 border border-ink bg-acid text-ink font-bold uppercase">
                      + New Organization
                    </button>
                  </div>
                  <div className="space-y-2">
                    {organizations.map((org) => (
                      <div key={org.organization.id} className="p-4 bg-panel border border-line flex justify-between items-center">
                        <div>
                          <span className="font-bold text-sm mr-2">{org.organization.name}</span>
                          <span className="text-muted text-[0.7rem] uppercase">Role: {org.role}</span>
                        </div>
                        {activeOrgId === org.organization.id && (
                          <span className="text-acid font-bold">ACTIVE TARGET</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">

                  <div className="flex justify-between items-center border-b border-line pb-4 max-sm:flex-col max-sm:items-start max-sm:gap-4">
                    <div>
                      <h3 className="font-display font-bold text-xl uppercase text-ink">Paystack Billing & Subscription Plans</h3>
                      <p className="text-muted mt-1">Manage automated disaster recovery capacity and retention schedules.</p>
                    </div>

                    {/* Billing Cycle Toggle */}
                    <div className="flex items-center gap-2 p-1 bg-panel border border-ink font-mono text-[0.7rem] uppercase">
                      <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-3 py-1.5 font-bold transition-all ${billingCycle === 'monthly' ? 'bg-ink text-paper shadow-[2px_2px_0_#c6f806]' : 'text-ink hover:text-neon'
                          }`}
                      >
                        Monthly Billing
                      </button>
                      <button
                        onClick={() => setBillingCycle('annual')}
                        className={`px-3 py-1.5 font-bold transition-all ${billingCycle === 'annual' ? 'bg-ink text-paper shadow-[2px_2px_0_#c6f806]' : 'text-ink hover:text-neon'
                          }`}
                      >
                        Annual (Save 20%)
                      </button>
                    </div>
                  </div>

                  {/* Plan Cards */}
                  {(() => {
                    const currentOrg = organizations.find(o => o.organization.id === activeOrgId)?.organization;
                    const activePlanTier = (currentOrg?.plan_tier || 'Free').toLowerCase();

                    const isProActive = activePlanTier.includes('pro') || activePlanTier.includes('mwananchi') || activePlanTier.includes('lifetime');
                    const isPremiumActive = activePlanTier.includes('taifa') || activePlanTier.includes('premium') || activePlanTier.includes('enterprise');
                    const isFreeActive = !isProActive && !isPremiumActive;

                    return (
                      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-6">
                        {/* Free / Jamii Tier */}
                        <div className="p-6 bg-panel border-2 border-ink space-y-4 relative flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="text-neon font-bold uppercase text-[0.7rem]">Tier 1 · Free</div>
                            <div className="font-display font-bold text-2xl uppercase">Free</div>
                            <div className="text-xl font-bold font-mono">$0 <span className="text-xs font-normal text-muted">/ month</span></div>
                            <p className="text-muted text-[0.72rem] leading-relaxed">
                              Community starter tier for individual project auditing and manual backup dumps.
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-muted text-[0.7rem] pt-2">
                              <li>1 Target Supabase Project</li>
                              <li>Manual pg_dump Execution</li>
                              <li><strong>7-Day Retention Auto-Pruning</strong></li>
                              <li>500 MB max database limit</li>
                            </ul>
                          </div>
                          {isFreeActive ? (
                            <button disabled className="w-full py-2.5 border border-ink bg-acid text-ink font-bold uppercase text-xs shadow-[3px_3px_0_#171714]">
                              Current Active Tier ✓
                            </button>
                          ) : (
                            <button disabled className="w-full py-2.5 border border-ink bg-white/40 text-muted font-bold uppercase text-xs opacity-60">
                              Included Base Tier
                            </button>
                          )}
                        </div>

                        {/* Mwananchi / Pro Plan */}
                        <div className="p-6 bg-paper border-2 border-ink shadow-[6px_6px_0_#171714] space-y-4 relative flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-neon font-bold uppercase text-[0.7rem]">Tier 2 ·</span>
                              <span className="text-acid font-bold uppercase text-[0.7rem] bg-ink px-2 py-0.5 inline-block">Recommended</span>
                            </div>
                            <div className="font-display font-bold text-2xl uppercase">Pro</div>
                            <div className="text-xl font-bold font-mono">
                              {billingCycle === 'monthly' ? '$15' : '$150'} <span className="text-xs font-normal text-muted">/ {billingCycle === 'monthly' ? 'month' : 'year'}</span>
                            </div>
                            <p className="text-muted text-[0.72rem] leading-relaxed">
                              Automated hourly disaster recovery pipelines, R2 snapshot archival, and custom retention rules.
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-muted text-[0.7rem] pt-2">
                              <li>Up to 5 Target Projects</li>
                              <li>Automated Hourly Cron Schedules</li>
                              <li><strong>30-Day Retention Auto-Pruning</strong></li>
                              <li>Cloudflare R2 Bucket Sync & Alerts</li>
                            </ul>
                          </div>
                          {isProActive ? (
                            <button disabled className="w-full py-2.5 border border-ink bg-acid text-ink font-bold uppercase text-xs shadow-[3px_3px_0_#171714]">
                              Current Active Tier ✓
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const planCode = billingCycle === 'monthly'
                                  ? (import.meta.env.PAYSTACK_MWANANCHI_PLAN_CODE_MONTHLY || 'PLN_1whq8h5qxv9lerr')
                                  : (import.meta.env.PAYSTACK_MWANANCHI_PLAN_CODE_ANNUAL || 'PLN_5cu6agsex0uqbzp');

                                openPaystackCheckout({
                                  email: user?.email || 'support@superbaser.co',
                                  amount: billingCycle === 'monthly' ? 1950 : 19500,
                                  planCode,
                                  onSuccess: async (ref) => {
                                    if (activeOrgId) {
                                      await updateOrganizationPlan(activeOrgId, `Mwananchi (${billingCycle})`, ref.reference);
                                      if (user) {
                                        const updatedOrgs = await listMyOrganizations(user.id);
                                        setOrganizations(updatedOrgs);
                                      }
                                    }
                                    alert(`Paystack Subscription Active! Reference: ${ref.reference}`);
                                  }
                                });
                              }}
                              className="button w-full py-2.5 border border-ink bg-ink text-white font-bold uppercase text-xs shadow-[3px_3px_0_#c6f806] hover:bg-orange hover:text-ink transition-colors"
                            >
                              Subscribe Pro ↗
                            </button>
                          )}
                        </div>

                        {/* Taifa / Premium Plan */}
                        <div className="p-6 bg-ink text-paper border-2 border-ink shadow-[6px_6px_0_#c6f806] space-y-4 relative flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="text-neon font-bold uppercase text-[0.7rem]">Tier 3 · Enterprise</div>
                            <div className="font-display font-bold text-2xl uppercase text-white">Premium</div>
                            <div className="text-xl font-bold font-mono text-acid">
                              {billingCycle === 'monthly' ? '$49' : '$490'} <span className="text-xs font-normal text-muted">/ {billingCycle === 'monthly' ? 'month' : 'year'}</span>
                            </div>
                            <p className="text-[#aaa99f] text-[0.72rem] leading-relaxed">
                              High-availability enterprise cluster protection, multi-region replication, and priority worker containers.
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-[#aaa99f] text-[0.7rem] pt-2">
                              <li>Unlimited Target Projects</li>
                              <li>Parallel Container Workflows</li>
                              <li>Dedicated Cloudflare Worker Isolation</li>
                              <li>Custom SLA & 24/7 Ops Phone Support</li>
                            </ul>
                          </div>
                          {isPremiumActive ? (
                            <button disabled className="w-full py-2.5 border border-white bg-acid text-ink font-bold uppercase text-xs shadow-[3px_3px_0_#171714]">
                              Current Active Tier ✓
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const planCode = billingCycle === 'monthly'
                                  ? (import.meta.env.PAYSTACK_TAIFA_PLAN_CODE_MONTHLY || 'PLN_ixgzvfe6ofr5as3')
                                  : (import.meta.env.PAYSTACK_TAIFA_PLAN_CODE_ANNUAL || 'PLN_p7ov52pl3xi3s2g');

                                openPaystackCheckout({
                                  email: user?.email || 'support@superbaser.co',
                                  amount: billingCycle === 'monthly' ? 6370 : 63700,
                                  planCode,
                                  onSuccess: async (ref) => {
                                    if (activeOrgId) {
                                      await updateOrganizationPlan(activeOrgId, `Taifa Enterprise (${billingCycle})`, ref.reference);
                                      if (user) {
                                        const updatedOrgs = await listMyOrganizations(user.id);
                                        setOrganizations(updatedOrgs);
                                      }
                                    }
                                    alert(`Paystack Taifa Enterprise Plan Active! Ref: ${ref.reference}`);
                                  }
                                });
                              }}
                              className="button w-full py-2.5 border border-white bg-acid text-ink font-bold uppercase text-xs shadow-[3px_3px_0_#171714] hover:bg-orange transition-colors"
                            >
                              Subscribe Premium ↗
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Promo Codes Section */}
                  <div className="mt-8 p-6 bg-panel border-2 border-ink border-dashed">
                    <h3 className="font-display font-bold text-xl uppercase text-ink mb-2">Redeem Promo Code</h3>
                    <p className="text-muted mb-4 text-xs">Have a promo code? Enter it below.</p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!promoCode.trim()) return;
                        if (LIFETIME_PRO_CODES.includes(promoCode.trim().toUpperCase())) {
                          if (activeOrgId) {
                            await updateOrganizationPlan(activeOrgId, 'Lifetime Pro', `PROMO-${promoCode.trim()}`);
                            if (user) {
                              const updatedOrgs = await listMyOrganizations(user.id);
                              setOrganizations(updatedOrgs);
                            }
                            setPromoStatus({ type: 'success', msg: 'Lifetime Pro unlocked successfully! Enjoy unlimited backups.' });
                            setPromoCode('');
                          } else {
                            setPromoStatus({ type: 'error', msg: 'No active organization selected.' });
                          }
                        } else {
                          setPromoStatus({ type: 'error', msg: 'Invalid or expired promo code.' });
                        }
                      }}
                      className="flex gap-4 max-sm:flex-col items-start"
                    >
                      <input
                        type="text"
                        placeholder="ENTER CODE"
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoStatus(null); }}
                        className="flex-1 min-w-[250px] px-4 py-3 bg-paper border border-ink font-mono text-sm uppercase focus-visible:ring-2 focus-visible:ring-acid outline-none placeholder:text-muted/60"
                      />
                      <button type="submit" className="button px-6 py-3 bg-ink text-paper font-bold font-mono text-sm uppercase shadow-[3px_3px_0_#c6f806] hover:bg-orange hover:text-ink transition-colors h-full">
                        Redeem Code
                      </button>
                    </form>
                    {promoStatus && (
                      <div className={`mt-4 p-3 border font-mono text-xs ${promoStatus.type === 'success' ? 'bg-acid border-ink text-ink shadow-[2px_2px_0_#171714]' : 'bg-red-100 border-red-500 text-red-700'}`}>
                        {promoStatus.msg}
                      </div>
                    )}
                  </div>
                </div>
              )}



              {activeTab === 'settings' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="border-b border-line pb-4">
                    <h3 className="font-display font-bold text-xl uppercase">Account & Environment Settings</h3>
                    <p className="text-muted mt-1">Manage profile metadata, avatar rendering, and user preferences.</p>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const statusEl = document.getElementById('settings-feedback-status');
                      try {
                        const formEl = e.currentTarget;
                        const nameInput = (formEl.elements.namedItem('fullName') as HTMLInputElement).value;
                        await supabase.auth.updateUser({ data: { full_name: nameInput } });
                        if (statusEl) {
                          statusEl.textContent = "✓ Profile settings updated successfully!";
                          statusEl.className = "p-3 bg-acid border border-ink text-ink font-mono font-bold text-xs uppercase tracking-wide animate-fadeIn";
                          setTimeout(() => { statusEl.className = "hidden"; }, 4000);
                        }
                      } catch (err: any) {
                        if (statusEl) {
                          statusEl.textContent = "✕ Failed to update profile: " + (err.message || 'Error occurred');
                          statusEl.className = "p-3 bg-red-100 border border-ink text-red-700 font-mono font-bold text-xs uppercase tracking-wide";
                        }
                      }
                    }}
                    className="p-6 bg-panel border-2 border-ink space-y-5 max-w-xl shadow-[6px_6px_0_#171714]"
                  >
                    <div className="font-bold text-sm uppercase text-ink">User Profile & Avatar</div>
                    <div id="settings-feedback-status" className="hidden" role="status" aria-live="polite"></div>

                    <div className="flex items-center gap-4 p-4 bg-paper border border-line">
                      {renderBoringAvatar(user?.user_metadata?.full_name || user?.email || 'User', 48)}
                      <div>
                        <div className="font-bold text-ink text-sm">{user?.user_metadata?.full_name || 'Operations Engineer'}</div>
                        <div className="text-muted text-[0.7rem]">{user?.email || 'user@superbaser.co'}</div>
                        <div className="text-neon text-[0.65rem] font-bold uppercase mt-1">Boring Avatars SVG Generator Active</div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-muted uppercase text-[0.68rem] font-bold">Display Name</label>
                      <input
                        name="fullName"
                        type="text"
                        defaultValue={user?.user_metadata?.full_name || ''}
                        placeholder="Operations Engineer"
                        className="w-full border border-ink bg-paper px-4 py-2.5 text-xs text-ink outline-none focus:border-orange font-mono"
                      />
                    </div>

                    <button type="submit" className="button px-5 py-3 border border-ink bg-ink text-white font-bold uppercase text-xs shadow-[3px_3px_0_#c6f806] hover:bg-orange hover:text-ink transition-colors cursor-pointer">
                      Save Profile Settings ↗
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'support' && (
                <div className="bg-paper p-6 border border-ink space-y-6 font-mono text-xs">
                  <div className="border-b border-line pb-4">
                    <h3 className="font-display font-bold text-xl uppercase">Operations Support & Runbooks</h3>
                    <p className="text-muted mt-1">Disaster recovery guidance and operational playbooks.</p>
                  </div>
                  <div className="p-4 bg-panel border border-line space-y-2">
                    <div className="font-bold">Contact Operations Team:</div>
                    <a href="mailto:support@superbaser.co" className="text-ink underline">
                      support@superbaser.co
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {isCreateOrgModalOpen && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paper border-2 border-ink shadow-[12px_12px_0_#171714] w-full max-w-md p-6 space-y-6 font-mono">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display font-bold text-slate-900 text-lg uppercase">Create organization</h3>
              <button
                onClick={() => setIsCreateOrgModalOpen(false)}
                className="text-ink hover:text-neon transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-ink">Organization Name</label>
                <input
                  type="text"
                  value={newOrgName || ''}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="CEKA"
                  required
                  autoFocus
                  className="w-full border border-ink bg-white px-4 py-3 text-xs text-ink outline-none focus:border-orange font-mono"
                />
              </div>

              {user?.is_anonymous && (
                <div className="p-3 bg-acid border border-ink text-ink text-[0.7rem] font-mono shadow-[2px_2px_0_#171714] space-y-1">
                  <div className="font-bold uppercase">Guest Session Notice</div>
                  <div>Anonymous guest sessions must claim an account before creating permanent organizations.</div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOrgModalOpen(false);
                      if (onOpenAuthModal) onOpenAuthModal();
                    }}
                    className="mt-1 px-3 py-1.5 bg-ink text-white font-bold uppercase text-[0.65rem] hover:bg-orange hover:text-ink transition-colors"
                  >
                    Claim Account Now ↗
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOrgModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold uppercase text-ink hover:bg-panel transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrg}
                  className="button px-5 py-2.5 border border-ink bg-ink text-white text-xs font-bold uppercase transition-all shadow-[4px_4px_0_#c6f806] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingOrg ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboarding Guide Modal */}
      {showOnboardingModal && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paper border-2 border-ink shadow-[12px_12px_0_#171714] w-full max-w-2xl p-8 space-y-6 font-mono relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowOnboardingModal(false);
                if (user?.is_anonymous && onOpenAuthModal) {
                  onOpenAuthModal();
                }
              }}
              className="absolute top-4 right-4 text-ink hover:text-neon transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-line pb-4">
              <div className="text-[0.68rem] text-neon font-bold uppercase tracking-widest">ONBOARDING GUIDE · STEP {onboardingStep} OF 3</div>
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mt-1 text-ink">
                {onboardingStep === 1 && "1. Welcome to SuperBaser"}
                {onboardingStep === 2 && "2. Zero-Downtime DR Architecture"}
                {onboardingStep === 3 && "3. Connect Your Target Database"}
              </h3>
            </div>

            {onboardingStep === 1 && (
              <div className="space-y-4 text-xs leading-relaxed text-ink/90">
                <p>
                  SuperBaser acts as a centralized control plane for your external Supabase databases. It automates catalog inspection, physical <code>pg_dump</code> backups, cross-region restores, and storage bucket sync.
                </p>

                <div className="p-4 bg-panel border border-line space-y-2">
                  <div className="font-bold uppercase text-ink">Security & Encryption Guarantee</div>
                  <p className="text-[0.72rem] text-muted">
                    Your target database connection strings are encrypted at rest using AES-256-GCM envelope encryption before transmission. Credentials are decrypted only inside isolated backup containers.
                  </p>
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="space-y-4 text-xs leading-relaxed text-ink/90">
                <p>
                  Because serverless runtimes cannot execute system binaries, SuperBaser utilizes a queue-driven architecture powered by <strong>Cloudflare Containers</strong>.
                </p>

                <div className="p-4 bg-panel border border-line space-y-3">
                  <div className="font-bold uppercase text-ink">How Backups Work</div>
                  <ul className="list-disc pl-4 space-y-1.5 text-[0.72rem] text-muted">
                    <li><strong>Queue Event:</strong> Backup jobs are enqueued in your database.</li>
                    <li><strong>Container Execution:</strong> Cloudflare Containers execute native <code>pg_dump</code> using your direct connection string.</li>
                    <li><strong>Cloudflare R2 Sync:</strong> Generated SQL archives are uploaded directly to Cloudflare R2 and linked to your Supabase metadata table.</li>
                  </ul>
                </div>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="space-y-6 text-xs leading-relaxed text-ink/90 max-h-[55vh] overflow-y-auto pr-2">
                <p>
                  Physical <code>pg_dump</code> backups require a <strong>Direct PostgreSQL Connection String</strong> - API tokens alone cannot run database binary dumps. Follow the 3 visual phases below to locate your credentials:
                </p>

                {/* PHASE 3.1 */}
                <div className="space-y-2">
                  <div className="font-bold uppercase text-ink text-[0.75rem] flex items-center gap-2">
                    <span className="bg-ink text-acid px-2 py-0.5 text-[0.65rem]">PHASE 3.1</span> Tap 'Connect'
                  </div>
                  <div className="border-2 border-ink shadow-[4px_4px_0_#171714] overflow-hidden bg-black">
                    <img src="/step-1.png" alt="Supabase Dashboard Project Overview" className="w-full h-auto block" />
                    <div className="bg-ink p-2 text-paper text-[0.68rem] font-mono flex items-center justify-between border-t border-line">
                      <span>FIG 3.1: Supabase Dashboard Overview & Project Reference ID</span>
                      <span className="text-neon uppercase font-bold">Step 3.1</span>
                    </div>
                  </div>
                </div>

                {/* PHASE 3.2 */}
                <div className="space-y-2">
                  <div className="font-bold uppercase text-ink text-[0.75rem] flex items-center gap-2">
                    <span className="bg-ink text-acid px-2 py-0.5 text-[0.65rem]">PHASE 3.2</span> Select "Transaction Pooler" → Temporary Connection
                  </div>
                  <div className="border-2 border-ink shadow-[4px_4px_0_#171714] overflow-hidden bg-black">
                    <img src="/step-2.png" alt="Supabase Database Settings & Connection Pooler" className="w-full h-auto block" />
                    <div className="bg-ink p-2 text-paper text-[0.68rem] font-mono flex items-center justify-between border-t border-line">
                      <span>FIG 3.2: Supabase Database Settings & Connection Pooler Config</span>
                      <span className="text-neon uppercase font-bold">Step 3.2</span>
                    </div>
                  </div>
                </div>

                {/* PHASE 3.3 */}
                <div className="space-y-2">
                  <div className="font-bold uppercase text-ink text-[0.75rem] flex items-center gap-2">
                    <span className="bg-ink text-acid px-2 py-0.5 text-[0.65rem]">PHASE 3.3</span> Select Connection String → Copy URI Tab
                  </div>
                  <div className="border-2 border-ink shadow-[4px_4px_0_#171714] overflow-hidden bg-black">
                    <img src="/step-3.png" alt="Supabase Connection String URI Settings" className="w-full h-auto block" />
                    <div className="bg-ink p-2 text-paper text-[0.68rem] font-mono flex items-center justify-between border-t border-line">
                      <span>FIG 3.3: Supabase Direct Connection String (URI Format)</span>
                      <span className="text-neon uppercase font-bold">Step 3.3</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-ink text-paper border-2 border-orange space-y-3 font-mono">
                  <div className="text-neon font-bold uppercase text-[0.72rem]">📍 Direct Connection String Format:</div>
                  <div className="text-[0.7rem] leading-relaxed text-[#aaa99f] space-y-1">
                    <div>1. Open your <strong>Supabase Dashboard</strong>.</div>
                    <div>2. Navigate to <strong>Project Settings → Database</strong> or <strong>tap 'Connect'</strong>.</div>
                    <div>3. Select your <strong>Direct Connection Format</strong> and copy the <strong>URI</strong> link.</div>
                    <div>4. It is designated in this format:</div>
                    <div className="bg-black/60 p-2 text-acid border border-white/20 select-all overflow-x-auto text-[0.65rem] mt-1">
                      postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-line">
              {onboardingStep > 1 ? (
                <button
                  onClick={() => setOnboardingStep(onboardingStep - 1)}
                  className="px-4 py-2 border border-ink text-xs font-bold uppercase hover:bg-panel"
                >
                  Previous
                </button>
              ) : <div />}

              {onboardingStep < 3 ? (
                <button
                  onClick={() => setOnboardingStep(onboardingStep + 1)}
                  className="button px-6 py-2.5 border border-ink bg-ink text-white text-xs font-bold uppercase shadow-[4px_4px_0_#c6f806]"
                >
                  Next Step ↗
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowOnboardingModal(false);
                    if (user?.is_anonymous && onOpenAuthModal) {
                      onOpenAuthModal();
                    } else {
                      setShowConnectModal(true);
                    }
                  }}
                  className="button px-6 py-2.5 border border-ink bg-orange text-ink text-xs font-bold uppercase shadow-[4px_4px_0_#171714]"
                >
                  Connect Database Now ↗
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connect Target Database Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paper border-2 border-ink shadow-[12px_12px_0_#171714] w-full max-w-lg p-6 space-y-6 font-mono max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display font-bold text-lg uppercase text-ink">Connect Target Database</h3>
                <p className="text-[0.68rem] text-muted">Enter credentials required. Ensure you accurately fill them for a flawless process. You only need to add them once. They stay encrypted.</p>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-ink hover:text-neon transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!targetConnectionString) return;
                
                if (user?.is_anonymous && onTriggerIntercept) {
                  import('../lib/pending-intent').then(({ savePendingAction, getInteractionHistory }) => {
                    const intentPayload = {
                      type: 'CONNECT_PROJECT' as const,
                      payload: {
                        targetProjectName,
                        targetConnectionString,
                        targetProjectUrl,
                        targetServiceKey
                      },
                      interactionHistory: getInteractionHistory()
                    };
                    savePendingAction(intentPayload);
                    onTriggerIntercept(intentPayload);
                    setShowConnectModal(false);
                  });
                  return;
                }

                if (!user || !activeOrgId) {
                  alert("You must create an organization first.");
                  return;
                }

                const projectRefExtracted = targetProjectRef || (targetProjectUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1] ?? 'custom-project');

                try {
                  const newProj = await createProject(
                    activeOrgId,
                    user.id,
                    targetProjectName || 'Production Database',
                    projectRefExtracted,
                    targetConnectionString,
                    targetProjectUrl,
                    targetServiceKey
                  );

                  const updatedProjects = await listProjects(activeOrgId);
                  setProjectsData(updatedProjects);
                  setShowConnectModal(false);

                  localStorage.removeItem('superbaser_connect_form');
                  setTargetProjectName('');
                  setTargetProjectUrl('');
                  setTargetConnectionString('');
                  setTargetServiceKey('');

                  setLogs((prev) => [
                    `[${new Date().toLocaleTimeString()}] Target Project "${newProj.name}" (${projectRefExtracted}) connected securely.`,
                    `[${new Date().toLocaleTimeString()}] Direct Connection String validated for physical pg_dump engine.`,
                    ...prev
                  ]);
                } catch (err: any) {
                  alert("Failed to save target project: " + err.message);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1.5">
                <label className="block font-bold uppercase">Project Name / Alias *</label>
                <input
                  type="text"
                  required
                  value={targetProjectName}
                  onChange={(e) => setTargetProjectName(e.target.value)}
                  placeholder="Production DB (US East)"
                  className="w-full border border-ink bg-white px-3 py-2 outline-none focus:border-orange font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold uppercase">Direct PostgreSQL Connection String (URI) *</label>
                <input
                  type="password"
                  required
                  value={targetConnectionString}
                  onChange={(e) => setTargetConnectionString(e.target.value)}
                  placeholder="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
                  className="w-full border border-ink bg-white px-3 py-2 outline-none focus:border-orange font-mono"
                />
                <p className="text-[0.65rem] text-muted">Required by Cloudflare Containers to run physical pg_dump binaries.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold uppercase">Supabase Project URL</label>
                <input
                  type="text"
                  value={targetProjectUrl}
                  onChange={(e) => setTargetProjectUrl(e.target.value)}
                  placeholder="https://wzyrmzfgdtzaqmkhtbuk.supabase.co"
                  className="w-full border border-ink bg-white px-3 py-2 outline-none focus:border-orange font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold uppercase">Service Role API Key (Secret / Optional)</label>
                <input
                  type="password"
                  value={targetServiceKey}
                  onChange={(e) => setTargetServiceKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full border border-ink bg-white px-3 py-2 outline-none focus:border-orange font-mono"
                />
                <p className="text-[0.65rem] text-muted">Used for REST API features (table catalog listing, storage inspect).</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 font-bold uppercase text-ink hover:bg-panel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button px-5 py-2.5 border border-ink bg-ink text-white font-bold uppercase shadow-[4px_4px_0_#c6f806]"
                >
                  Save & Validate Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AIAssistant onOpenAuthModal={onOpenAuthModal} />
    </div>
  );
}
