# SuperBaser Master Context & Rules

This project is a high-performance React SPA built with Vite, TailwindCSS, and Supabase.
It strictly operates on a 3-Tier SaaS model.

## 🔴 CRITICAL RULES (MUST READ & OBEY AT ALL TIMES)
1. **NO MOCK DATA ALLOWED**: Never generate mock data, placeholder data, or sample UI values. Always integrate directly with Supabase production data and use real empty states ("Connect your first project", "No backups found").
2. **SECURITY BEFORE ALL**: Anonymous users (`is_anonymous: true`) must NEVER have write, edit, delete, or run capabilities. All RLS policies must strictly enforce `is_permanent_user()`. If a guest attempts a restricted action (like manual backups), intercept it and demand account creation.
3. **PRESERVE ORIGINAL CODE**: When modifying files, preserve existing logic, spacing, variable names, and stylistic nuances unless explicitly told to refactor. Never comment out existing vital features (like auth wrappers or state managers).
4. **DEPLOYMENT SYNC**: This project is disconnected from Lovable. The source of truth for the live production domain (`superbaser.co`) is **Vercel**. When major changes are completed and approved, you MUST automatically run `npm run deploy:live` (which executes `npx vercel --prod`) to push updates to the live domain.

## 🏗 Architecture & Tech Stack
- **Frontend Core**: React 18 (Vite), TypeScript, state-based SPA routing (mapped to local state `currentView`).
- **Styling**: TailwindCSS, Framer Motion (for all interactions), Lottie (for complex animations).
- **Aesthetic**: Premium, dark-mode biased. Colors: Ink (`#0a0a0a`), Paper (`#111111`), Acid/Neon Green (`#d8ff37`), Gold (`#f5d033`), Orange (`#ff4500`). Sharp edges, glowing accents, glassmorphic panels.
- **Backend**: Supabase (PostgreSQL 15), pg_dump snapshots, Cloudflare R2 for AES-256 encrypted storage.
- **State**: Zustand (`useAuthStore`) for auth persistence, local component state for UI.

## 💰 SuperBaser Core Pricing & Tier Specs
SuperBaser strictly uses **3 Tiers** only:

1. **Free Tier ($0/mo)**:
   - 1 Connected Supabase Project
   - 24-Hour Daily Automated `pg_dump`
   - 7-Day Backup Retention History
   - Manual Point-in-Time Restore Trigger
   - Community Support

2. **Pro Tier ($15/mo)**:
   - Up to 5 Connected Supabase Projects
   - 1-Hour Automated DB & Storage Snapshots
   - 30-Day Backup Retention History
   - 1-Click Zero-Downtime Verified Restore
   - AES-256 Encrypted Storage Vault & Storage Sync
   - Priority Operations Support

3. **Premium Tier ($49/mo)**:
   - Unlimited Connected Supabase Projects & Orgs
   - 15-Minute Continuous Backup & Log Streaming
   - 90-Day Point-in-Time Recovery (PITR)
   - Multi-Region Replication & One-Click Migration
   - Team RBAC, Audit Logging, Dedicated Worker Agent
   - 1-Hour Response SLA

## 🤖 AIAssistant Integration Rules
- Uses Groq API (`llama-3.1-8b-instant`) strictly.
- Context (`SUPERBASER_KNOWLEDGE_BASE`) must remain tightly coupled to the 3-Tier model.
- Renders `ActionChips` for deep linking parsed directly from AI JSON blocks.
- Uses `LiquidGlassIsland` for dynamic UI overlays (Maps, Waveforms, Offline Tickets) triggered by the AI inside the chat window.
