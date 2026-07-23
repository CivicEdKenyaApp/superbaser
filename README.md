# SuperBaser

> The backup and recovery layer Supabase doesn't give you.

## Why This Exists

Supabase is fantastic — until your project pauses, a migration goes sideways,
or someone drops the wrong table at 11 p.m. In that moment, "I have backups"
is the only sentence that matters, and most teams find out too late that they
don't.

SuperBaser closes that gap. Connect your project once. From then on, your
database and your Storage files are backed up automatically, verified for
integrity, and ready to restore into a fresh Supabase project whenever you
need them — no digging through docs, no guessing whether the backup actually
worked, no losing a weekend to recovery.

## What You Get

- **Automated backups** on a schedule you set — hourly, daily, or as tight as
  your plan allows. Set it once and forget it.
- **Full-fidelity restores** — not just your tables, but your users, your
  roles, your Storage files, and your project's configuration, rebuilt into a
  new project end to end.
- **Verified, not just stored** — every backup is integrity-checked before
  it's marked trustworthy, so you're never surprised by a corrupt archive on
  the one day it counts.
- **One-click restore** — point SuperBaser at a new Supabase project and let
  it do the rebuilding. No manual command-line archaeology.
- **Seamless migration** — moving to a new Supabase project, region, or
  organization is the same flow as a disaster recovery. If you can restore,
  you can migrate.
- **Team-ready** — organizations, shared access, and an audit trail of every
  backup and restore your team has run.
- **Built for speed and scale** — modern edge infrastructure means backups
  kick off in seconds and cost a fraction of what a traditional backup
  service charges, savings we pass straight to you.

## How It Works (the short version)

1. **Connect your project** — securely, from inside your dashboard, after
   you've signed in. Nothing sensitive ever touches a public form.
2. **Set your schedule** — or trigger a backup manually whenever you want a
   checkpoint.
3. **We take it from there** — your database and Storage files are captured,
   verified, and stored safely, encrypted end to end.
4. **When you need it, restore** — spin up a new Supabase project, point
   SuperBaser at it, and get your entire application back — data, users,
   files, all of it — without touching a terminal.

We keep the plumbing under the hood. You get a dashboard, a schedule, and a
restore button that actually works.

## Who It's For

- **Founders** running production on Supabase who can't afford to lose a
  weekend to a bad migration.
- **Agencies** managing client projects who need backups they can point to
  when a client asks "what's our disaster recovery plan?"
- **Teams** who've outgrown "someone should really set up backups" and want
  it actually done.

## Security, In Plain Terms

Your credentials are collected only after you've signed in, inside a secure,
authenticated flow — never on a public page. Everything is encrypted before
it's stored, and only decrypted at the moment a backup or restore actually
runs. We designed this the way we'd want our own production database handled:
assume every layer could be compromised, and make sure none of them expose
your data anyway.

## Pricing

| Tier | Price | Best for |
|---|---|---|
| **Free** | $0 | Trying it out — one project, daily backups, 7-day history |
| **Pro** | $9–15/mo | Small teams — hourly backups, 30-day history, one-click everything |
| **Business** | $29–49/mo | Growing teams — unlimited projects, 15-minute backups, 90-day history |
| **Enterprise** | Custom | Organizations that need dedicated infrastructure, SLAs, and API access |

Because of how we run our infrastructure, we keep our costs near zero — which
means we can keep yours near zero too. Real backups shouldn't cost more than
the thing they're protecting.

## Get Started

Sign up, connect a project, and you'll have your first backup running in
under five minutes. No credit card required for the Free tier.

## License

Proprietary — All rights reserved.
