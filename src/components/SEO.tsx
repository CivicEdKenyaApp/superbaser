import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  path?: string;
}

const SUBPAGE_SEO_MAP: Record<string, { title: string; description: string }> = {
  '/dashboard': {
    title: 'SuperBaser Console | Dashboard Overview',
    description: 'High-level system inventory, active schedules, and live Postgres backup trigger for connected Supabase projects.',
  },
  '/dashboard/projects': {
    title: 'SuperBaser Console | Projects & Database Targets',
    description: 'Manage Supabase host connection parameters, Port 5432 SSL settings, and target region configurations.',
  },
  '/dashboard/backups': {
    title: 'SuperBaser Console | Postgres Backup Snapshots',
    description: 'Inspect AES-256 encrypted pg_dumpall SQL snapshots stored in Cloudflare R2 vaults with instant download links.',
  },
  '/dashboard/restores': {
    title: 'SuperBaser Console | 1-Click Zero-Downtime Restores',
    description: 'Trigger verified psql database restores and storage bucket reconstructions with automated conflict checking.',
  },
  '/dashboard/schedules': {
    title: 'SuperBaser Console | Automated Backup Schedules',
    description: 'Configure automated backup cron pipelines, snapshot frequency, and retention policy auto-pruning.',
  },
  '/dashboard/verification': {
    title: 'SuperBaser Console | Archive Integrity Verification',
    description: 'Automated SQL archive integrity checksum tests and verified restore validation reporting.',
  },
  '/dashboard/storage': {
    title: 'SuperBaser Console | Cloudflare R2 Storage Vault',
    description: 'Cloudflare R2 archive volume metrics, AES-256 encrypted storage buckets, and object key browser.',
  },
  '/dashboard/logs': {
    title: 'SuperBaser Console | Real-Time Execution Logs',
    description: 'Real-time Cloudflare container execution telemetry, backup pipeline logs, and trace ID diagnostics.',
  },
  '/dashboard/organizations': {
    title: 'SuperBaser Console | Organization & Team Management',
    description: 'Multi-tenant organization management, team RBAC permissions, and active target switching.',
  },
  '/dashboard/billing': {
    title: 'SuperBaser Console | SuperBaser Pay & Subscription Tiers',
    description: 'Subscription management for Free ($0/mo), Pro ($15/mo), and Premium ($49/mo) disaster recovery capacity.',
  },
  '/dashboard/settings': {
    title: 'SuperBaser Console | Account & User Settings',
    description: 'User profile settings, display name, avatar configuration, and email address update verification.',
  },
  '/dashboard/support': {
    title: 'SuperBaser Console | Operations Support & Runbooks',
    description: 'Disaster recovery operational playbooks, emergency contact runbooks, and direct support routing.',
  },
  '/superadmin': {
    title: 'SuperBaser | SuperAdmin Operations Control Panel',
    description: 'SuperAdmin management panel for system health monitoring, worker heartbeats, audit logs, and promo codes.',
  },
};

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords = 'Supabase disaster recovery, pg_dump backup, Supabase backup tool, Postgres backup, Cloudflare R2 backup, point-in-time recovery, PITR Supabase, database snapshot automation, Supabase restore, zero-downtime restore, SuperBaser',
  image = '/logo-2.svg',
  url,
  path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '/',
}) => {
  const currentPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  const mappedSeo = SUBPAGE_SEO_MAP[currentPath];

  const finalTitle = title || mappedSeo?.title || 'SuperBaser | Supabase Disaster Recovery & Snapshot Engine';
  const finalDescription = description || mappedSeo?.description || 'Enterprise Supabase disaster recovery platform. Automated pg_dumpall snapshots, Cloudflare R2 AES-256 encrypted vault sync, and 1-click zero-downtime restores.';
  const finalUrl = url || `https://superbaser.co${currentPath === '/' ? '' : currentPath}`;

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={finalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={finalUrl} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={finalUrl} />
      <meta property="twitter:title" content={finalTitle} />
      <meta property="twitter:description" content={finalDescription} />
      <meta property="twitter:image" content={image} />
    </Helmet>
  );
};
