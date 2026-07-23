import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

export const SEO: React.FC<SEOProps> = ({
  title = 'SuperBaser - Automated Supabase Disaster Recovery & Backups',
  description = 'SuperBaser|Enterprise Supabase Disaster Recovery, Physical pg_dump Backups & Region-to-Region Restores. Powered by Cloudflare Containers.',
  keywords = 'Supabase, Disaster Recovery, pg_dump, Backups, Restores, Database Backup, Cloudflare Containers, Postgres Backup, SuperBaser',
  image = '/og-image.png',
  url = 'https://www.superbaser.co/',
}) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
    </Helmet>
  );
};
