# SuperBaser Master Context & Rules

This project is a high-performance React SPA built with Vite, TailwindCSS, and Supabase.
It strictly operates on a 3-Tier SaaS disaster recovery model for Supabase projects.

## 🔴 CRITICAL DIRECTIVES (MUST READ & OBEY AT ALL TIMES)
1. **NO MOCK DATA, EVER**: Never generate mock data, placeholder data, or sample UI values. Always integrate directly with Supabase production data and use real empty states (e.g., "Connect your first project", "No backups found"). 

a. GUIDELINES:

FULL. ALWAYS. EVERYTHING. DO NOT HOLD BACK!!!!!  NOWgivemea[fullcorrectedimplementation.PPLEASENOCOMMENT-OUTS!!GIVEMEEVERYTHING!!NOSHORTCUTS!NOCUT-OUTS!!NOMOCKDATA!!NOSAMPLEDATA!!ALLIMPLEMENTATIONSMUSTWORKWITHTHEFULLCONTEXTOFTHEALLCONTEXTDEPENDENTONTHEM!!!GIVEMEEVERYTHING!!!IMPLEMENTEVERYTHING,ALLATONCE!!!WEHAVEINFINITETIME,INFINITERESOURCESANDINFINITECAPACITYTOBUILD-GIVEFULLCONTEXTTOEVERYPROMPT!!!GETFULLCONTEXTONWHATITISALLABOUT!!!BUILDEVERYTHINGINITSFULLNESS...YOUHAVEMYPERMISSION!!!GOHAM!!!!!OUTPUTTHEFULLUPDATEDIMPLEMENTATIONOFALLABOVECOMPONENTS!!!GOHHAAAAAAMMMM!!!!]]] GIVE ME EVRYTHNG!!!! [PRESERVE ORIGINAL CODE!!! AIM TO NOT REMOVE PREEXISTENT CODE!!! TO PRESERVE SHOULD BE YOUR NUMBER ONE PRIORITY, AND ONLY MAKE IMPROVEMENTS ON TOP OF THE PREEXISTING CODE!!! MAKE IT WORK SEAMLESSLY!!! NO CHEATING! NO SHORTCUTS! FULL PRODUCTION MODE IMPLEMENTATION! KEEP IT TO THE INSTRUCTIONS ABOVE & KEEP YOUR OPINIONS TO YOURSELF - EXECUTE TO WITHIN THE CONSTRAINTS OF THE INSTRUCTIONS DECLARED!!!! DO NOT MAKE EXTRA CHANGES OUTSIDE OF THIS INSTRUCTION! DO NOT INVENT PARALLEL SYSTEMS FOR WHERE LEGACY CODE EXISTS - SCAN BOTH THE FRONTEND AND BACKEND/DATABASE ENTIRELY BEFORE COMMITTING TO CREATE ANY NEW ITEMS, ELEMENTS, COMPONENTS, FUNCTIONS OR ANY OTHER CORRELATIONS! GOT IT??? EXECUTE ALL REMAINING TASKS FULLY & TO THE BEST OF YOUR ABILITY IN A CLAUDE 4.6 OPUS THINKING -ESQUE EXECUTION LEVEL! GO HAM! GIVE ME EEVRYYYTHIINGGG GO HAAAMMMMM! 



[STRICT MODE ACTIVE]

Zero Opinion Policy: Do not suggest, mention, or implement "improvements," "optimizations," or alternative libraries (e.g., Lucide vs. SVG).
Code Preservation: Maintain existing structure, spacing, variable names, and logic 1:1.
Minimal Fixes Only: Implement the absolute minimum code required to solve the specific bug reported.
No Unsolicited refactoring: Even if you see redundancy or "bad practices," do not touch them unless they are the direct cause of the bug.
Confirmation: Before executing, state exactly what you will change and why it is the minimal path to the fix.
Absolute Honesty: Mistakes will be owned immediately without excuses or cover-ups.
Strict Execution: Only actions explicitly requested or defined will be performed. No opinions. No assumptions.



Answer only with the factual, technical, or logical solution. Do not include compliments, positive reinforcement, 'Perfect' fluff, analogies, opinions/unnecessary commentary. Do not speculate. Do not be kind, empathetic, or conversational. Do not add context unless explicitly requested. Responses may be long if needed, but must contain only content strictly relevant to solving the problem or answering the question. You may ask clarifying questions only when they directly tie to the prompt and advance the solution toward the goal; such questions must not make assumptions or distract. Always return the full corrected implementation or full corrected deliverable requested — NO MINIMAL, NO SHORTENED VERSION. ALWAYS FULL DEV. No commentary, preamble, or follow-up outside the required deliverable. NEVER use the exact phrase "for example" in code snippets or prompt responses. Do not provide hypothetical examples, invented sample data, or fabricated illustrations. Always provide the user's real data exactly as requested; do not hallucinate or substitute fictional values. If real data is unavailable, explicitly state "real data unavailable" and provide only verifiable alternatives or concrete steps to obtain the required real data. If the user requests code, include complete runnable code with necessary imports, configuration, and any tests or usage instructions requested; do not omit edge cases unless the user explicitly narrows scope. Follow these rules precisely on every response.

DON'T OVERSIMPLIFY STUFF JUST COZ YOU THINK IT SHOULD BE SIMPLE - YOU JUST ARE LIMITED AND MUST ASSUME THAT YOU DON'T BEAR FULL CONTEXT WITH PRE-EXISTENT CODE'S CONTEXTS. DO NOT ASSUME YOU KNOW - ASSUME YOU DON;T AND LEAVE THAT CODE AS IS TO ONLY IMPROVE ON TOP OF IT- NEVER REMOVE IT. DO NOT ADD MEANINGLESS CHANGES. YOU BETTER LISTEN TO EVERY LAST WORD OF THESE GUIDELINES. KEEP YOUR HARD-EARNED OPINIONS AND THOUGHTS TO YOURSELF - I ONLY WANT WHAT I HAVE ASKED FOR, THE BEST!

✊🏽🇰🇪 - ADHERE STRICTLY TO THE INDEX.CSS GUIDELINES. AIM FOR DEEP iOS DESIGN, ULTRAMODERN DESIGN, GLASSMORPHISM, SMOOTH ANIMATIONS AND MOTIONS, BEVELS AND BEZELS, SHADOWS, SKEUMORPHISM, BEAUTIFUL BEAUTIFUL DESIGN, MINIMALISM - ALL WHERE APPLICABLE - STRICT MODE!!! GO HAM!!!


DO NOT ERROR IN THE MIDDLE OF CODE EXECUTION! YOU ARE ALLOWED TO TOOL-CHAIN, BUT IN THE BEST INTEREST OF PRESEERVING THE INTEGRITY OF THE CONTINUITY OF THE CODE TOWARDS THE HIGHEST AND BEST POSSIBLE OUTCOME

THE REST REMAIN AS IS! NO FURTHER CHANGES!  MAKE SURE WE ADDRESS THIS, WHERE NECESSARY. ONLY CHANGES NEEDED. BE THOROUGH! BE SWIFT! BE PRECISE AND CALCULATED! DELIVER YOUR PROMISE TO ME! NOW!  TOUCH NOTHING ELSE. DO NOT MAKE ANY FURTHER CHANGES OUTSIDE OF THE ABOVE DEFINED CHANGES. I REPEAT - STEER CLEAR OF OPINIONATED OR ASSUMED CHANGES. ONLY STICK TO WHAT I HAVE DEFINED ABOVE AND NOTHING ELSE.  GOT IT? NOW STRICTLY STICK TO THE ABOVE DEFINITIONS OF GUIDELINES - NO FURTHER CHANGES, STRICTLY. OBEY MY WORD TO THE VERY LATTER. STRICT MODE! GO!



2. **SECURITY BEFORE ALL (ANONYMOUS GUARDS)**: Guest users (`is_anonymous: true`) must NEVER have write, edit, delete, or run capabilities. 
   - All RLS policies must strictly enforce the `is_permanent_user()` helper function.
   - Anonymous users are explicitly blocked from `SELECT` and `DELETE` on all core tables (Organizations, Projects, Schedules, Backups, Jobs).
   - If a guest attempts a restricted action (like manual backups via chat or UI), intercept it and demand account creation.
3. **PRESERVE ORIGINAL CODE**: When modifying files, preserve existing logic, spacing, variable names, and stylistic nuances unless explicitly told to refactor. Never comment out existing vital features (like auth wrappers or state managers). Do not take shortcuts.
4. **DEPLOYMENT SYNC**: This project is NO LONGER connected to Lovable. Do not worry about Lovable's git history. The sole source of truth for the live production domain (`superbaser.co`) is **Vercel**. When major changes are completed and approved, you MUST automatically run `npm run deploy:live` (which executes `npx vercel --prod`) to push updates to the live domain.

## 🏗 Architecture & Tech Stack
- **Frontend Core**: React 18 (Vite), TypeScript, state-based SPA routing (mapped to local state `currentView`).
- **Styling**: TailwindCSS, Framer Motion (for all interactions), Lottie (for complex animations).
- **Backend**: Supabase (PostgreSQL 15), pg_dump snapshots, Cloudflare R2 for AES-256 encrypted storage.
- **State**: Zustand (`useAuthStore`) for auth persistence, local component state for UI.

## 🎨 UI/UX Aesthetic Guidelines
- **Theme**: Premium, ultra-modern, dark-mode biased.
- **Color Palette**: 
  - Ink (`#0a0a0a`), Paper (`#111111`)
  - Acid/Neon Green (`#d8ff37`, `#b7f210`, `#bce21c`)
  - Gold (`#f5d033`)
  - Orange (`#ff4500`)
  - Deep Olive/Brown Strokes (`#303a09`)
- **Shapes & Textures**: Sharp edges, glowing accents, glassmorphic panels (backdrop-blur).
- **SVGs**: When creating SVGs, prefer Neon Green fills with Deep Olive (`#303a09`) strokes for contrast.

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

## 🤖 AIAssistant (`SUPERB AI`) Integration Rules
- **Engine**: Uses Groq API (`llama-3.1-8b-instant`) strictly.
- **Context**: `SUPERBASER_KNOWLEDGE_BASE` must remain tightly coupled to the 3-Tier model.
- **Action Execution**: Renders glowing `ActionChips` for deep linking, parsed directly from LLM JSON blocks (`suggestedActions`).
- **Dynamic UI Overlays**: Uses `LiquidGlassIsland` as a non-obstructive sub-header for dynamic UI overlays (Maps, Waveforms, Offline Tickets) triggered by the AI `islandTrigger` payloads.
- **Slash Commands**: Uses an active dictionary mapped to local state views (e.g., `/dashboard`, `/pricing`).
- **Security Check**: The chat window actively scans inputs for `ACTION_TRIGGER_KEYWORDS` (e.g., "run", "snapshot") and immediately triggers the `AuthModal` if the user is anonymous.
