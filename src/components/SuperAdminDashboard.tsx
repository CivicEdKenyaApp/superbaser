import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Building2, Layers, Activity, Briefcase,
  CreditCard, ScrollText, Mail, Settings, LogOut, X, ChevronDown,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, Zap, Database,
  Users, Server, ArrowUpRight, Send, Archive, Eye, RotateCcw,
  Shield, Bell, Search, MoreVertical, Edit3, Trash2, Plus,
  TrendingUp, HardDrive, MailOpen, MailCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/auth-store';
import {
  getSuperAdminOverview, listAllOrganizations, listPlanLimits,
  listWorkerHeartbeats, listAllJobs, listAllBillingEvents,
  listSuperAdminAuditLogs, listSupportEmails, getSupportEmailById,
  getEmailRepliesForEmail,
} from '../lib/superadmin-queries';
import {
  updatePlanLimit, forceFailJob, requeueJob, updateOrgPlanSuperAdmin,
  updateEmailStatus, logEmailReply, sendEmailReplyViaWorker,
} from '../lib/superadmin-mutations';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtBytes(b: number) {
  if (b === 0) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function fmtCents(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return fmtDate(iso);
}
function workerStatus(lastSeen: string) {
  const age = Date.now() - new Date(lastSeen).getTime();
  if (age < 90_000) return 'online';
  if (age < 300_000) return 'stale';
  return 'offline';
}
function statusColor(s: string) {
  const map: Record<string, string> = {
    completed: '#d8ff37', verified: '#d8ff37', online: '#d8ff37', sent: '#d8ff37',
    running: '#f5d033', claimed: '#f5d033', queued: '#67675f', stale: '#f5d033',
    failed: '#ff4500', offline: '#ff4500', bounced: '#ff4500', error: '#ff4500',
    unread: '#d8ff37', read: '#67675f', replied: '#3FCF8E', archived: '#303a09',
  };
  return map[s] ?? '#67675f';
}
function planColor(p: string) {
  return p === 'premium' ? '#f5d033' : p === 'pro' ? '#d8ff37' : '#67675f';
}

type SAView = 'overview' | 'orgs' | 'plans' | 'workers' | 'jobs' | 'billing' | 'audit' | 'support';

interface SuperAdminDashboardProps {
  onExit: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main SuperAdminDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard({ onExit }: SuperAdminDashboardProps) {
  const { session, signOut } = useAuthStore();
  const [view, setView] = useState<SAView>('overview');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Data state
  const [overview, setOverview]   = useState<any>(null);
  const [orgs, setOrgs]           = useState<any[]>([]);
  const [planLimits, setPlanLimits] = useState<any[]>([]);
  const [workers, setWorkers]     = useState<any[]>([]);
  const [jobs, setJobs]           = useState<any[]>([]);
  const [jobFilter, setJobFilter] = useState('all');
  const [billingEvents, setBillingEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emails, setEmails]       = useState<any[]>([]);
  const [emailFilter, setEmailFilter] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [emailReplies, setEmailReplies]   = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (v: SAView) => {
    setLoading(true);
    try {
      if (v === 'overview') {
        const d = await getSuperAdminOverview();
        setOverview(d);
      } else if (v === 'orgs') {
        const d = await listAllOrganizations();
        setOrgs(d);
      } else if (v === 'plans') {
        const d = await listPlanLimits();
        setPlanLimits(d);
      } else if (v === 'workers') {
        const d = await listWorkerHeartbeats();
        setWorkers(d);
      } else if (v === 'jobs') {
        const d = await listAllJobs(jobFilter === 'all' ? undefined : jobFilter);
        setJobs(d);
      } else if (v === 'billing') {
        const d = await listAllBillingEvents();
        setBillingEvents(d);
      } else if (v === 'audit') {
        const d = await listSuperAdminAuditLogs();
        setAuditLogs(d);
      } else if (v === 'support') {
        const d = await listSupportEmails(emailFilter === 'all' ? undefined : emailFilter);
        setEmails(d);
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [jobFilter, emailFilter]);

  useEffect(() => { load(view); }, [view, load]);

  // Realtime for support inbox
  useEffect(() => {
    if (view !== 'support') return;
    const ch = supabase
      .channel('sa-support-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_emails' }, () => load('support'))
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [view, load]);

  // Worker polling
  useEffect(() => {
    if (view !== 'workers') return;
    const iv = setInterval(() => load('workers'), 15_000);
    return () => clearInterval(iv);
  }, [view, load]);

  const nav: { key: SAView; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'overview',  label: 'Overview',      icon: LayoutDashboard },
    { key: 'orgs',      label: 'Organizations', icon: Building2 },
    { key: 'plans',     label: 'Plan Limits',   icon: Layers },
    { key: 'workers',   label: 'Workers',       icon: Server },
    { key: 'jobs',      label: 'Job Queue',     icon: Briefcase },
    { key: 'billing',   label: 'Billing',       icon: CreditCard },
    { key: 'audit',     label: 'Audit Log',     icon: ScrollText },
    { key: 'support',   label: 'Support',       icon: Mail },
  ];

  const handleSignOut = async () => {
    await signOut();
    onExit();
  };

  // ── Email thread load ──────────────────────────────────────────────────────
  const openEmail = async (email: any) => {
    setSelectedEmail(email);
    setReplyText('');
    if (email.status === 'unread') {
      await updateEmailStatus(email.id, 'read');
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, status: 'read' } : e));
    }
    const replies = await getEmailRepliesForEmail(email.id);
    setEmailReplies(replies);
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;
    setReplySending(true);
    try {
      const result = await sendEmailReplyViaWorker({
        emailId: selectedEmail.id,
        toEmail: selectedEmail.from_email,
        subject: `Re: ${selectedEmail.subject ?? '(no subject)'}`,
        bodyText: replyText,
        messageId: selectedEmail.message_id,
      });
      if (result.success) {
        await logEmailReply(selectedEmail.id, replyText, result.sentVia as any, 'sent');
        const fresh = await getEmailRepliesForEmail(selectedEmail.id);
        setEmailReplies(fresh);
        setSelectedEmail((e: any) => ({ ...e, status: 'replied' }));
        setEmails(prev => prev.map(e => e.id === selectedEmail.id ? { ...e, status: 'replied' } : e));
        setReplyText('');
        showToast(`Sent via ${result.sentVia}`);
      } else {
        await logEmailReply(selectedEmail.id, replyText, 'cloudflare', 'failed', result.error);
        showToast(`Send failed: ${result.error}`, 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setReplySending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#f1efea',
      fontFamily: '"Manrope", sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Noise overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        opacity: 0.03,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E\")",
      }} />

      {/* Top Bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        borderBottom: '1px solid rgba(216,255,55,0.15)',
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 24px', height: 56,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
          <div style={{
            width: 32, height: 32, background: '#d8ff37',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }}>
            <Shield size={16} color="#0a0a0a" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: '"Syne", sans-serif', letterSpacing: '-0.02em', color: '#f1efea' }}>SuperBaser</div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: '#d8ff37', textTransform: 'uppercase' }}>SuperAdmin</div>
          </div>
        </div>

        {/* Nav pills */}
        <nav style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto' }}>
          {nav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              id={`sa-nav-${key}`}
              onClick={() => setView(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 8, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
                background: view === key ? '#d8ff37' : 'transparent',
                color: view === key ? '#0a0a0a' : '#67675f',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={13} />
              {label}
              {key === 'support' && emails.filter(e => e.status === 'unread').length > 0 && (
                <span style={{
                  background: '#ff4500', color: '#fff', fontSize: 9, fontWeight: 700,
                  borderRadius: 99, padding: '0 5px', minWidth: 16, textAlign: 'center',
                }}>
                  {emails.filter(e => e.status === 'unread').length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User + Exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: '#67675f', fontFamily: '"DM Mono", monospace' }}>
            {session?.user?.email}
          </span>
          <button
            id="sa-exit"
            onClick={onExit}
            title="Back to main app"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(216,255,55,0.2)',
              background: 'transparent', color: '#d8ff37', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowUpRight size={12} /> Exit SA
          </button>
          <button
            id="sa-signout"
            onClick={handleSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,69,0,0.25)',
              background: 'transparent', color: '#ff4500', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%', position: 'relative', zIndex: 2 }}>
        {loading && (
          <div style={{ position: 'absolute', top: 8, right: 24, color: '#d8ff37', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        )}

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        {view === 'overview' && overview && (
          <OverviewView overview={overview} />
        )}

        {/* ── ORGANIZATIONS ────────────────────────────────────────────── */}
        {view === 'orgs' && (
          <OrgsView
            orgs={orgs}
            onRefresh={() => load('orgs')}
            onUpdatePlan={async (orgId, plan) => {
              try {
                await updateOrgPlanSuperAdmin(orgId, plan);
                showToast(`Plan updated to ${plan}`);
                load('orgs');
              } catch (e: any) { showToast(e.message, 'error'); }
            }}
          />
        )}

        {/* ── PLAN LIMITS ───────────────────────────────────────────────── */}
        {view === 'plans' && (
          <PlansView
            plans={planLimits}
            onRefresh={() => load('plans')}
            onUpdate={async (plan, field, value) => {
              try {
                await updatePlanLimit(plan, { [field]: value });
                showToast(`${plan} → ${field} updated`);
                load('plans');
              } catch (e: any) { showToast(e.message, 'error'); }
            }}
          />
        )}

        {/* ── WORKERS ──────────────────────────────────────────────────── */}
        {view === 'workers' && (
          <WorkersView workers={workers} onRefresh={() => load('workers')} />
        )}

        {/* ── JOBS ─────────────────────────────────────────────────────── */}
        {view === 'jobs' && (
          <JobsView
            jobs={jobs}
            filter={jobFilter}
            onFilterChange={(f) => { setJobFilter(f); load('jobs'); }}
            onRefresh={() => load('jobs')}
            onForceFailJob={async (id) => {
              try {
                await forceFailJob(id, 'Manually force-failed by SuperAdmin');
                showToast('Job force-failed');
                load('jobs');
              } catch (e: any) { showToast(e.message, 'error'); }
            }}
            onRequeueJob={async (id) => {
              try {
                await requeueJob(id);
                showToast('Job requeued');
                load('jobs');
              } catch (e: any) { showToast(e.message, 'error'); }
            }}
          />
        )}

        {/* ── BILLING ──────────────────────────────────────────────────── */}
        {view === 'billing' && (
          <BillingView events={billingEvents} onRefresh={() => load('billing')} />
        )}

        {/* ── AUDIT ────────────────────────────────────────────────────── */}
        {view === 'audit' && (
          <AuditView logs={auditLogs} onRefresh={() => load('audit')} />
        )}

        {/* ── SUPPORT ──────────────────────────────────────────────────── */}
        {view === 'support' && (
          <SupportView
            emails={emails}
            filter={emailFilter}
            onFilterChange={(f) => { setEmailFilter(f); load('support'); }}
            onRefresh={() => load('support')}
            selectedEmail={selectedEmail}
            emailReplies={emailReplies}
            replyText={replyText}
            replySending={replySending}
            onSelectEmail={openEmail}
            onReplyTextChange={setReplyText}
            onSendReply={handleSendReply}
            onArchive={async (id) => {
              await updateEmailStatus(id, 'archived');
              setEmails(prev => prev.filter(e => e.id !== id));
              if (selectedEmail?.id === id) setSelectedEmail(null);
              showToast('Archived');
            }}
          />
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? '#ff4500' : '#d8ff37',
          color: toast.type === 'error' ? '#fff' : '#0a0a0a',
          borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #303a09; border-radius: 4px; }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  OVERVIEW VIEW
// ─────────────────────────────────────────────────────────────────────────────
function OverviewView({ overview }: { overview: any }) {
  const stats = [
    { label: 'Total Orgs',    value: overview.totalOrgs,             icon: Building2,     color: '#d8ff37' },
    { label: 'Free Tier',     value: overview.freeTier,              icon: Users,         color: '#67675f' },
    { label: 'Pro Tier',      value: overview.proTier,               icon: Zap,           color: '#d8ff37' },
    { label: 'Premium Tier',  value: overview.premiumTier,           icon: Shield,        color: '#f5d033' },
    { label: 'Total Projects',value: overview.totalProjects,         icon: Database,      color: '#d8ff37' },
    { label: 'Active Jobs',   value: overview.activeJobs,            icon: Activity,      color: overview.activeJobs > 0 ? '#f5d033' : '#67675f' },
    { label: 'Storage Used',  value: fmtBytes(overview.storageBytes),icon: HardDrive,     color: '#d8ff37' },
    { label: 'MRR (est.)',    value: fmtCents(overview.mrrCents),    icon: TrendingUp,    color: '#d8ff37' },
  ];

  return (
    <div>
      <SectionHeader title="Platform Overview" subtitle="Live aggregated metrics across all tenants" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: '#67675f', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
              <Icon size={16} color={color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: '"Syne", sans-serif', color: '#f1efea', letterSpacing: '-0.03em' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Worker Fleet */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={sectionTitle}>Worker Fleet</div>
          {(overview.workers ?? []).length === 0 ? (
            <div style={{ color: '#67675f', fontSize: 12 }}>No workers registered.</div>
          ) : (
            overview.workers.map((w: any) => {
              const ws = workerStatus(w.last_seen_at);
              return (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontFamily: '"DM Mono", monospace', color: '#f1efea' }}>{w.id}</div>
                    <div style={{ fontSize: 10, color: '#67675f' }}>{w.queue ?? 'default'} · v{w.version ?? '?'}</div>
                  </div>
                  <StatusPill status={ws} />
                </div>
              );
            })
          )}
        </div>

        <div style={card}>
          <div style={sectionTitle}>Recent Active Jobs</div>
          {(overview.recentJobs ?? []).length === 0 ? (
            <div style={{ color: '#67675f', fontSize: 12 }}>No active jobs.</div>
          ) : (
            overview.recentJobs.slice(0, 6).map((j: any) => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: '#f1efea' }}>{j.kind}</div>
                  <div style={{ fontSize: 10, color: '#67675f' }}>{fmtTime(j.created_at)}</div>
                </div>
                <StatusPill status={j.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ORGS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function OrgsView({ orgs, onRefresh, onUpdatePlan }: { orgs: any[]; onRefresh: () => void; onUpdatePlan: (id: string, plan: 'free' | 'pro' | 'premium') => void }) {
  const [search, setSearch] = useState('');
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <SectionHeader title="Organizations" subtitle={`${orgs.length} total orgs`} onRefresh={onRefresh} />
      <SearchBar value={search} onChange={setSearch} placeholder="Search by name or slug…" />
      <Table
        headers={['Name', 'Slug', 'Plan', 'Created', 'Actions']}
        rows={filtered.map(o => [
          <span style={{ fontWeight: 600, color: '#f1efea' }}>{o.name}</span>,
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#67675f' }}>{o.slug}</span>,
          <span style={{ ...pill, background: planColor(o.plan) + '22', color: planColor(o.plan), borderColor: planColor(o.plan) + '44' }}>{o.plan}</span>,
          <span style={{ fontSize: 11, color: '#67675f' }}>{fmtDate(o.created_at)}</span>,
          <PlanSelector currentPlan={o.plan} onSelect={(p) => onUpdatePlan(o.id, p)} />,
        ])}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLANS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function PlansView({ plans, onRefresh, onUpdate }: { plans: any[]; onRefresh: () => void; onUpdate: (plan: string, field: string, value: any) => void }) {
  const fields: { key: string; label: string; type: 'number' | 'boolean' }[] = [
    { key: 'max_projects',         label: 'Max Projects (-1 = unlimited)', type: 'number'  },
    { key: 'backup_interval_sec',  label: 'Backup Interval (sec)',         type: 'number'  },
    { key: 'retention_days',       label: 'Retention (days)',              type: 'number'  },
    { key: 'max_api_keys',         label: 'Max API Keys',                  type: 'number'  },
    { key: 'pitr_days',            label: 'PITR Days',                     type: 'number'  },
    { key: 'storage_sync',         label: 'Storage Sync',                  type: 'boolean' },
    { key: 'team_rbac',            label: 'Team RBAC',                     type: 'boolean' },
    { key: 'audit_logging',        label: 'Audit Logging',                 type: 'boolean' },
    { key: 'multi_region',         label: 'Multi-Region',                  type: 'boolean' },
    { key: 'dedicated_agent',      label: 'Dedicated Agent',               type: 'boolean' },
  ];

  const planOrder = ['free', 'pro', 'premium'];
  const sorted = [...plans].sort((a, b) => planOrder.indexOf(a.plan) - planOrder.indexOf(b.plan));

  return (
    <div>
      <SectionHeader title="Plan Limits" subtitle="Live CRUD on plan_limits — changes take effect immediately" onRefresh={onRefresh} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', width: 200 }}>Field</th>
              {sorted.map(p => (
                <th key={p.plan} style={{ ...th, color: planColor(p.plan) }}>{p.plan.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(({ key, label, type }) => (
              <tr key={key}>
                <td style={{ ...td, color: '#67675f', fontFamily: '"DM Mono", monospace', fontSize: 11 }}>{label}</td>
                {sorted.map(p => (
                  <td key={p.plan} style={td}>
                    {type === 'boolean' ? (
                      <button
                        id={`plan-${p.plan}-${key}`}
                        onClick={() => onUpdate(p.plan, key, !p[key])}
                        style={{
                          ...pill,
                          background: p[key] ? '#d8ff3722' : '#67675f22',
                          color: p[key] ? '#d8ff37' : '#67675f',
                          borderColor: p[key] ? '#d8ff3744' : '#67675f44',
                          cursor: 'pointer',
                        }}
                      >
                        {p[key] ? '✓ On' : '✗ Off'}
                      </button>
                    ) : (
                      <EditableNumber
                        id={`plan-${p.plan}-${key}`}
                        value={p[key]}
                        onSave={(v) => onUpdate(p.plan, key, v)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WORKERS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function WorkersView({ workers, onRefresh }: { workers: any[]; onRefresh: () => void }) {
  return (
    <div>
      <SectionHeader title="Worker Fleet" subtitle="Live heartbeats — refreshes every 15s" onRefresh={onRefresh} />
      {workers.length === 0 ? (
        <EmptyState message="No workers have sent a heartbeat recently." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {workers.map(w => {
            const ws = workerStatus(w.last_seen_at);
            return (
              <div key={w.id} style={{ ...card, borderLeft: `3px solid ${statusColor(ws)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#f1efea' }}>{w.id}</span>
                  <StatusPill status={ws} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <Metric label="Version"   value={w.version ?? '—'} />
                  <Metric label="Queue"     value={w.queue ?? 'default'} />
                  <Metric label="CPU"       value={w.cpu_percent != null ? `${w.cpu_percent}%` : '—'} />
                  <Metric label="RAM"       value={w.ram_mb != null ? `${w.ram_mb} MB` : '—'} />
                  <Metric label="Last Seen" value={fmtTime(w.last_seen_at)} />
                  <Metric label="Running Job" value={w.running_job_id ? w.running_job_id.slice(0,8)+'…' : '—'} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  JOBS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function JobsView({ jobs, filter, onFilterChange, onRefresh, onForceFailJob, onRequeueJob }: {
  jobs: any[]; filter: string; onFilterChange: (f: string) => void; onRefresh: () => void;
  onForceFailJob: (id: string) => void; onRequeueJob: (id: string) => void;
}) {
  const statuses = ['all', 'queued', 'claimed', 'running', 'completed', 'failed'];
  return (
    <div>
      <SectionHeader title="Global Job Queue" subtitle="All jobs across all orgs" onRefresh={onRefresh} />
      <FilterPills options={statuses} active={filter} onChange={onFilterChange} />
      <Table
        headers={['Kind', 'Status', 'Priority', 'Attempts', 'Created', 'Org', 'Actions']}
        rows={jobs.map(j => [
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11 }}>{j.kind}</span>,
          <StatusPill status={j.status} />,
          <span style={{ fontSize: 11, color: j.priority === 'high' ? '#f5d033' : '#67675f' }}>{j.priority}</span>,
          <span style={{ fontSize: 11, color: '#67675f' }}>{j.attempt}/{j.max_attempts}</span>,
          <span style={{ fontSize: 11, color: '#67675f' }}>{fmtTime(j.created_at)}</span>,
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#67675f' }}>{j.organization_id?.slice(0,8)}…</span>,
          <div style={{ display: 'flex', gap: 4 }}>
            {['running', 'claimed', 'queued'].includes(j.status) && (
              <ActionBtn label="Force Fail" color="#ff4500" onClick={() => onForceFailJob(j.id)} />
            )}
            {j.status === 'failed' && (
              <ActionBtn label="Requeue" color="#d8ff37" onClick={() => onRequeueJob(j.id)} />
            )}
          </div>,
        ])}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  BILLING VIEW
// ─────────────────────────────────────────────────────────────────────────────
function BillingView({ events, onRefresh }: { events: any[]; onRefresh: () => void }) {
  const totalRevCents = events
    .filter(e => e.event_type === 'payment_succeeded')
    .reduce((s, e) => s + (e.amount_cents ?? 0), 0);

  const failedCount = events.filter(e => e.event_type === 'payment_failed').length;

  return (
    <div>
      <SectionHeader title="Billing Events" subtitle="Paystack events across all organizations" onRefresh={onRefresh} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={card}>
          <div style={metricLabel}>Total Revenue (Recent)</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d8ff37', fontFamily: '"Syne", sans-serif' }}>{fmtCents(totalRevCents)}</div>
        </div>
        <div style={card}>
          <div style={metricLabel}>Total Events</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f1efea', fontFamily: '"Syne", sans-serif' }}>{events.length}</div>
        </div>
        <div style={card}>
          <div style={metricLabel}>Failed Payments</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: failedCount > 0 ? '#ff4500' : '#67675f', fontFamily: '"Syne", sans-serif' }}>{failedCount}</div>
        </div>
      </div>
      <Table
        headers={['Event', 'Org', 'From Plan', 'To Plan', 'Amount', 'Date']}
        rows={events.map(e => [
          <span style={{ ...pill, background: e.event_type.includes('fail') ? '#ff450022' : '#d8ff3711', color: e.event_type.includes('fail') ? '#ff4500' : '#d8ff37', borderColor: e.event_type.includes('fail') ? '#ff450033' : '#d8ff3733' }}>
            {e.event_type.replace(/_/g, ' ')}
          </span>,
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#67675f' }}>{e.organization_id?.slice(0,8)}…</span>,
          <span style={{ fontSize: 11, color: '#67675f' }}>{e.from_plan ?? '—'}</span>,
          <span style={{ fontSize: 11, color: '#d8ff37' }}>{e.to_plan ?? '—'}</span>,
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11 }}>{e.amount_cents ? fmtCents(e.amount_cents) : '—'}</span>,
          <span style={{ fontSize: 11, color: '#67675f' }}>{fmtDate(e.created_at)}</span>,
        ])}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  AUDIT VIEW
// ─────────────────────────────────────────────────────────────────────────────
function AuditView({ logs, onRefresh }: { logs: any[]; onRefresh: () => void }) {
  return (
    <div>
      <SectionHeader title="Audit Log" subtitle="All platform actions — admin and superadmin" onRefresh={onRefresh} />
      {logs.length === 0 ? (
        <EmptyState message="No audit events recorded yet." />
      ) : (
        <Table
          headers={['Action', 'Actor', 'Resource', 'Org', 'Timestamp']}
          rows={logs.map(l => [
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#d8ff37' }}>{l.action}</span>,
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#67675f' }}>{l.actor_user_id?.slice(0,8)}…</span>,
            <span style={{ fontSize: 11, color: '#f1efea' }}>{l.resource_type ?? '—'} {l.resource_id ? `· ${l.resource_id.slice(0,8)}…` : ''}</span>,
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#67675f' }}>{l.organization_id?.slice(0,8)}…</span>,
            <span style={{ fontSize: 11, color: '#67675f' }}>{fmtTime(l.created_at)}</span>,
          ])}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUPPORT EMAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────
function SupportView({
  emails, filter, onFilterChange, onRefresh,
  selectedEmail, emailReplies, replyText, replySending,
  onSelectEmail, onReplyTextChange, onSendReply, onArchive,
}: {
  emails: any[]; filter: string; onFilterChange: (f: string) => void; onRefresh: () => void;
  selectedEmail: any; emailReplies: any[]; replyText: string; replySending: boolean;
  onSelectEmail: (e: any) => void; onReplyTextChange: (t: string) => void;
  onSendReply: () => void; onArchive: (id: string) => void;
}) {
  const filters = ['all', 'unread', 'read', 'replied', 'archived'];

  return (
    <div>
      <SectionHeader title="Support Inbox" subtitle="support@superbaser.co · dual-provider cascade" onRefresh={onRefresh} />
      <FilterPills options={filters} active={filter} onChange={onFilterChange} />
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, marginTop: 12 }}>
        {/* Panel A — Inbox */}
        <div style={{ ...card, padding: 0, overflow: 'hidden', maxHeight: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 700, color: '#67675f', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {emails.length} {filter === 'all' ? 'Total' : filter} · {emails.filter(e => e.status === 'unread').length} Unread
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {emails.length === 0 ? (
              <div style={{ padding: 24, color: '#67675f', fontSize: 12, textAlign: 'center' }}>No emails.</div>
            ) : emails.map(e => (
              <button
                key={e.id}
                id={`email-row-${e.id}`}
                onClick={() => onSelectEmail(e)}
                style={{
                  width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  padding: '12px 14px', display: 'block',
                  background: selectedEmail?.id === e.id ? 'rgba(216,255,55,0.07)' : 'transparent',
                  borderLeft: selectedEmail?.id === e.id ? '3px solid #d8ff37' : '3px solid transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: e.status === 'unread' ? 700 : 400, color: e.status === 'unread' ? '#f1efea' : '#67675f', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.from_email}
                  </span>
                  <span style={{ fontSize: 9, color: '#67675f', flexShrink: 0 }}>{fmtTime(e.created_at)}</span>
                </div>
                <div style={{ fontSize: 11, color: '#f1efea', fontWeight: e.status === 'unread' ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                  {e.subject ?? '(no subject)'}
                </div>
                <div style={{ fontSize: 10, color: '#67675f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(e.body_text ?? '').slice(0, 80)}
                </div>
                <div style={{ marginTop: 5 }}>
                  <StatusPill status={e.status} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Panel B + C — Thread + Composer */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 220px)', padding: 0, overflow: 'hidden' }}>
          {!selectedEmail ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#67675f', fontSize: 13 }}>
              Select an email to view the thread
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f1efea', marginBottom: 2 }}>{selectedEmail.subject ?? '(no subject)'}</div>
                  <div style={{ fontSize: 11, color: '#67675f' }}>From: {selectedEmail.from_email} · {fmtTime(selectedEmail.created_at)}</div>
                </div>
                <button id="sa-email-archive" onClick={() => onArchive(selectedEmail.id)} title="Archive" style={{ ...iconBtn }}>
                  <Archive size={14} />
                </button>
              </div>

              {/* Thread body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Original email */}
                <EmailBubble
                  sender={selectedEmail.from_email}
                  body={selectedEmail.body_text ?? ''}
                  time={selectedEmail.created_at}
                  isOutbound={false}
                />
                {/* Replies */}
                {emailReplies.map(r => (
                  <EmailBubble
                    key={r.id}
                    sender={`You (via ${r.sent_via})`}
                    body={r.body_text}
                    time={r.sent_at}
                    isOutbound
                    status={r.status}
                    provider={r.sent_via}
                  />
                ))}
              </div>

              {/* Reply composer */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 18px' }}>
                <div style={{ marginBottom: 4, fontSize: 10, color: '#67675f', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Reply to {selectedEmail.from_email}
                </div>
                <textarea
                  id="sa-reply-composer"
                  value={replyText}
                  onChange={e => onReplyTextChange(e.target.value)}
                  placeholder="Type your reply…"
                  rows={4}
                  style={{
                    width: '100%', resize: 'vertical',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, color: '#f1efea', fontFamily: '"Manrope", sans-serif',
                    fontSize: 12, padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    id="sa-send-reply"
                    onClick={onSendReply}
                    disabled={replySending || !replyText.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', borderRadius: 8, border: 'none',
                      background: replySending || !replyText.trim() ? '#303a09' : '#d8ff37',
                      color: replySending || !replyText.trim() ? '#67675f' : '#0a0a0a',
                      fontWeight: 700, fontSize: 12, cursor: replySending ? 'wait' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Send size={12} />
                    {replySending ? 'Sending…' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, onRefresh }: { title: string; subtitle?: string; onRefresh?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: '"Syne", sans-serif', letterSpacing: '-0.02em', color: '#f1efea' }}>{title}</h2>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#67675f' }}>{subtitle}</p>}
      </div>
      {onRefresh && (
        <button id={`sa-refresh-${title.toLowerCase().replace(/\s+/g,'-')}`} onClick={onRefresh} style={{ ...iconBtn, gap: 5, fontSize: 11, color: '#67675f', padding: '6px 10px' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      )}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#67675f', pointerEvents: 'none' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)', color: '#f1efea', fontSize: 12, outline: 'none', boxSizing: 'border-box',
          fontFamily: '"Manrope", sans-serif',
        }}
      />
    </div>
  );
}

function FilterPills({ options, active, onChange }: { options: string[]; active: string; onChange: (o: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={o}
          id={`sa-filter-${o}`}
          onClick={() => onChange(o)}
          style={{
            padding: '4px 12px', borderRadius: 99, border: `1px solid ${active === o ? '#d8ff37' : 'rgba(255,255,255,0.08)'}`,
            background: active === o ? '#d8ff37' : 'transparent',
            color: active === o ? '#0a0a0a' : '#67675f',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
            {headers.map(h => <th key={h} style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: 32, color: '#67675f' }}>No data.</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}>
              {row.map((cell, j) => <td key={j} style={td}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: color + '18', color, border: `1px solid ${color}33`, textTransform: 'capitalize',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 99, background: color, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#67675f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: '#f1efea' }}>{value}</div>
    </div>
  );
}

function PlanSelector({ currentPlan, onSelect }: { currentPlan: string; onSelect: (p: 'free' | 'pro' | 'premium') => void }) {
  const plans: ('free' | 'pro' | 'premium')[] = ['free', 'pro', 'premium'];
  return (
    <select
      value={currentPlan}
      onChange={e => onSelect(e.target.value as any)}
      style={{
        background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#f1efea',
        borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', outline: 'none',
      }}
    >
      {plans.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px', borderRadius: 6, border: `1px solid ${color}44`,
        background: color + '14', color, fontSize: 10, fontWeight: 600, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function EditableNumber({ id, value, onSave }: { id: string; value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <input
        id={id}
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onSave(Number(draft)); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(Number(draft)); setEditing(false); } if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); } }}
        style={{
          width: 80, background: 'rgba(216,255,55,0.08)', border: '1px solid #d8ff37',
          color: '#d8ff37', borderRadius: 6, padding: '2px 6px', fontSize: 11,
          fontFamily: '"DM Mono", monospace', outline: 'none',
        }}
      />
    );
  }
  return (
    <button
      id={id}
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
        color: '#f1efea', borderRadius: 6, padding: '2px 8px', fontSize: 11,
        fontFamily: '"DM Mono", monospace', cursor: 'text', display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      {value}
      <Edit3 size={9} color="#67675f" />
    </button>
  );
}

function EmailBubble({ sender, body, time, isOutbound, status, provider }: {
  sender: string; body: string; time: string; isOutbound: boolean; status?: string; provider?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOutbound ? 'flex-end' : 'flex-start' }}>
      <div style={{ fontSize: 10, color: '#67675f', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>{sender}</span>
        <span>{fmtTime(time)}</span>
        {provider && <span style={{ ...pill, fontSize: 9, background: '#d8ff3711', color: '#d8ff37', borderColor: '#d8ff3733' }}>via {provider}</span>}
      </div>
      <div style={{
        maxWidth: '85%', padding: '10px 14px', borderRadius: isOutbound ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        background: isOutbound ? 'rgba(216,255,55,0.1)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${isOutbound ? 'rgba(216,255,55,0.2)' : 'rgba(255,255,255,0.08)'}`,
        fontSize: 12, lineHeight: 1.6, color: '#f1efea', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {body}
      </div>
      {status && status !== 'sent' && (
        <div style={{ fontSize: 9, color: '#ff4500', marginTop: 3 }}>{status}</div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#67675f', fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>—</div>
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Style tokens
// ─────────────────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
  padding: 16,
  backdropFilter: 'blur(12px)',
};
const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 10,
  fontWeight: 700, color: '#67675f', letterSpacing: '0.06em',
  textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.02)', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '10px 14px', verticalAlign: 'middle',
};
const pill: React.CSSProperties = {
  display: 'inline-block', padding: '2px 7px', borderRadius: 99,
  fontSize: 10, fontWeight: 700, border: '1px solid transparent',
};
const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#67675f', cursor: 'pointer', padding: '5px 8px',
  transition: 'all 0.15s',
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#67675f',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
};
const metricLabel: React.CSSProperties = {
  fontSize: 11, color: '#67675f', fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8,
};
