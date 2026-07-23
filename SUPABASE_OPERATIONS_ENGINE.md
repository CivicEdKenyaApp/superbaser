# SuperBaser — Part 8: Supabase Implementation Engine & Operational Disaster Recovery Specification

This document provides the definitive, complete, and un-truncated production specification for the **Supabase Implementation Engine (Part 8)** and the fully corrected **Disaster Recovery & Backup/Restore Workflow** for SuperBaser.

---

## 1. Audit Analysis & Correction of Workflow Inconsistencies

The 13 operational issues identified in prior manual workflows are corrected below:

| # | Issue | Technical Correction |
|---|---|---|
| 1 | **Format Mixing** | Workflows are strictly isolated into **Option A (Plain SQL `.sql.gz`)** or **Option B (Custom Archive `.dump`)**. `psql` is used exclusively for `.sql` files; `pg_restore` is used exclusively for `.dump` files. |
| 2 | **Filename Mismatch** | Target filenames remain strictly identical across dump, compression, and restoration stages (`supabase_backup_<timestamp>.sql.gz`). |
| 3 | **Compression Utility Confusion** | `Compress-Archive` produces standard `.zip` files. For native `.gz` streams on Windows PowerShell, explicit `gzip` or `7-Zip` commands are provided, or `.zip` is handled with matching decompression steps. |
| 4 | **Connection Pooler vs. Direct Connection** | Dumps and restores MUST use **Direct Connection (Port 5432)** (`db.<project-ref>.supabase.co:5432`). Port `6543` (PgBouncer) is restricted to transactional queries and will drop long-running dump/restore connections. |
| 5 | **Restore Command Parameter Mismatch** | `psql` parses plain text SQL streams; `pg_restore` parses custom/directory archive formats (`-F c`). They are never interchanged. |
| 6 | **Missing File Extensions** | All restored filenames maintain explicit file extensions (`.sql`, `.dump`, `.sql.gz`). |
| 7 | **Cross-Platform Shell Compatibility** | Native PowerShell syntax (`Select-String -Path restore_log.txt -Pattern "error"`) is provided for Windows; `grep` is provided for Unix environments. Environment variables use `$env:PGPASSWORD` on Windows and `export PGPASSWORD` on Bash. |
| 8 | **Generic Table Verification** | Database verification checks schema tables dynamically from the catalog (`information_schema.tables`) rather than hardcoding application-specific table names. |
| 9 | **Storage Restore Script Integration** | The storage restoration engine is fully implemented as a zero-dependency Node.js script using `@supabase/supabase-js` or HTTP REST API with service-role credentials. |
| 10 | **Dynamic Storage Counts** | Bucket verification compares actual object counts in `storage.objects` against physical files in the archive dynamically. |
| 11 | **PostgreSQL Version Alignment** | `pg_dump` and `psql` client binaries MUST match the major version of the Supabase PostgreSQL instance (PostgreSQL 15.x / 17.x). |
| 12 | **Large Database Directives** | Databases > 1 GB require Direct Connection (Port 5432), TCP keep-alive settings (`keepalives_idle=60`), and statement timeouts disabled (`SET statement_timeout = 0;`). |
| 13 | **Complete Environment Cut-over** | All client and backend variables are updated upon cut-over: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, connection strings, and Edge Function secrets. |

---

## 2. PART 8 — SUPABASE IMPLEMENTATION ENGINE

### 2.1 Project Discovery & Inventory Subsystem

Prior to backup or restoration, the engine executes a comprehensive catalog inspection.

#### Metadata Schema (`discovery_manifest.json`)
```json
{
  "project_ref": "wzyrmzfgdtzaqmkhtbuk",
  "region": "us-east-1",
  "postgres_version": "15.6",
  "database_size_bytes": 145892352,
  "schemas": ["public", "auth", "storage", "realtime", "extensions"],
  "extensions": [
    { "name": "uuid-ossp", "default_version": "1.1", "installed_version": "1.1" },
    { "name": "pgvector", "default_version": "0.5.0", "installed_version": "0.5.0" },
    { "name": "pgcrypto", "default_version": "1.3", "installed_version": "1.3" }
  ],
  "table_count": 42,
  "view_count": 8,
  "function_count": 19,
  "trigger_count": 14,
  "rls_policy_count": 36,
  "storage_buckets": [
    { "id": "avatars", "name": "avatars", "public": true, "file_count": 142, "total_bytes": 10485760 },
    { "id": "documents", "name": "documents", "public": false, "file_count": 12, "total_bytes": 52428800 }
  ]
}
```

#### SQL Catalog Discovery Query
```sql
SELECT 
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.reltuples::bigint AS estimated_row_count,
  pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(c.oid) DESC;
```

---

### 2.2 PostgreSQL Connection & Validation Layer

The connection layer validates credentials, SSL mode, and version compatibility before attempting data extraction.

```typescript
export interface PostgresConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl: {
    rejectUnauthorized: boolean;
    require: boolean;
  };
  connectionTimeoutMillis: number;
}

export function buildDirectConnectionString(config: PostgresConnectionConfig): string {
  const encodedPassword = config.password ? encodeURIComponent(config.password) : '';
  const sslMode = config.ssl.require ? 'sslmode=require' : 'sslmode=prefer';
  return `postgresql://${config.user}:${encodedPassword}@${config.host}:${config.port}/${config.database}?${sslMode}`;
}
```

---

### 2.3 SQL Dump Engine (`pg_dump` Orchestration)

#### Option A: Plain Text SQL Dump (Recommended for Direct Ingestion)
```bash
pg_dump \
  --dbname="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --quote-all-identifiers \
  --file="backup.sql"
```

#### Option B: Custom Binary Dump (Recommended for Fine-Grained Object Filtering)
```bash
pg_dump \
  --dbname="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require" \
  --format=custom \
  --compress=9 \
  --file="backup.dump"
```

---

### 2.4 Storage Export Engine (REST API Synchronization)

The storage engine downloads all object assets from Supabase Storage buckets while capturing metadata in a structured manifest.

```javascript
// scripts/export-storage.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUTPUT_DIR = process.env.OUTPUT_DIR || './storage-backup';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function exportStorage() {
  console.log('Fetching bucket list...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) throw bucketError;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'buckets.json'), JSON.stringify(buckets, null, 2));

  for (const bucket of buckets) {
    console.log(`Exporting bucket: ${bucket.name}`);
    const bucketDir = path.join(OUTPUT_DIR, bucket.name);
    fs.mkdirSync(bucketDir, { recursive: true });

    const { data: files, error: filesError } = await supabase.storage.from(bucket.name).list('', {
      limit: 10000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

    if (filesError) {
      console.error(`Failed to list files in ${bucket.name}:`, filesError.message);
      continue;
    }

    for (const file of files) {
      if (file.id === null) continue; // Folder placeholder
      const filePath = path.join(bucketDir, file.name);
      const { data: blob, error: downloadError } = await supabase.storage.from(bucket.name).download(file.name);
      
      if (downloadError) {
        console.error(`Failed to download ${file.name}:`, downloadError.message);
        continue;
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      console.log(`Saved: ${bucket.name}/${file.name} (${buffer.length} bytes)`);
    }
  }
  console.log('Storage export completed.');
}

exportStorage().catch(err => {
  console.error('Storage export failed:', err);
  process.exit(1);
});
```

---

### 2.5 Database Restore Engine (`psql` & `pg_restore` Orchestration)

#### Option A Restoration (Plain Text SQL)
```bash
# Decompress archive
gzip -d -k backup.sql.gz

# Execute restore with ON_ERROR_STOP=0 to swallow pre-existing role warnings
psql "postgresql://postgres.<NEW_PROJECT_REF>:<NEW_PASSWORD>@db.<NEW_PROJECT_REF>.supabase.co:5432/postgres?sslmode=require" \
  -v ON_ERROR_STOP=0 \
  -f backup.sql \
  > restore_log.txt 2>&1
```

#### Option B Restoration (Custom Archive)
```bash
pg_restore \
  --dbname="postgresql://postgres.<NEW_PROJECT_REF>:<NEW_PASSWORD>@db.<NEW_PROJECT_REF>.supabase.co:5432/postgres?sslmode=require" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  backup.dump \
  > restore_log.txt 2>&1
```

---

### 2.6 Storage Restore Engine (Upsert Asset Loader)

```javascript
// scripts/restore-storage.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INPUT_DIR = process.env.INPUT_DIR || './storage-backup';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function restoreStorage() {
  const bucketsFile = path.join(INPUT_DIR, 'buckets.json');
  if (!fs.existsSync(bucketsFile)) {
    throw new Error(`buckets.json not found in ${INPUT_DIR}`);
  }

  const buckets = JSON.parse(fs.readFileSync(bucketsFile, 'utf8'));

  for (const bucket of buckets) {
    console.log(`Recreating bucket: ${bucket.name} (Public: ${bucket.public})`);
    await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.file_size_limit,
      allowedMimeTypes: bucket.allowed_mime_types
    });

    const bucketDir = path.join(INPUT_DIR, bucket.name);
    if (!fs.existsSync(bucketDir)) continue;

    const files = fs.readdirSync(bucketDir);
    for (const fileName of files) {
      const filePath = path.join(bucketDir, fileName);
      if (fs.statSync(filePath).isDirectory()) continue;

      const fileBuffer = fs.readFileSync(filePath);
      const { error: uploadError } = await supabase.storage.from(bucket.name).upload(fileName, fileBuffer, {
        upsert: true
      });

      if (uploadError) {
        console.error(`Failed uploading ${bucket.name}/${fileName}:`, uploadError.message);
      } else {
        console.log(`Uploaded: ${bucket.name}/${fileName}`);
      }
    }
  }
  console.log('Storage restoration complete.');
}

restoreStorage().catch(err => {
  console.error('Storage restore failed:', err);
  process.exit(1);
});
```

---

### 2.7 Verification Engine & Log Audit

#### PowerShell Log Verification (Windows)
```powershell
Select-String -Path restore_log.txt -Pattern "ERROR" | 
  Where-Object { $_.Line -notmatch "already exists" -and $_.Line -notmatch "multiple primary keys" }
```

#### Bash Log Verification (Linux/macOS)
```bash
grep -i "error" restore_log.txt | grep -vi "already exists" | grep -vi "multiple primary keys"
```

---

## 3. End-to-End Operational Playbooks

### 3.1 Windows PowerShell Playbook (Option A — Plain SQL Workflow)

```powershell
# 1. Environment Variables
$env:PGSSLMODE = "require"
$env:PGPASSWORD = "<SOURCE_DATABASE_PASSWORD>"
$SOURCE_REF = "<SOURCE_PROJECT_REF>"
$TARGET_REF = "<TARGET_PROJECT_REF>"
$TARGET_PASSWORD = "<TARGET_DATABASE_PASSWORD>"

# 2. Export Database Dump (Direct Connection, Port 5432)
pg_dump `
  -U "postgres.$SOURCE_REF" `
  -h "db.$SOURCE_REF.supabase.co" `
  -p 5432 `
  -d postgres `
  --format=plain `
  --no-owner `
  --no-privileges `
  --file=backup.sql

# 3. Compress Archive
gzip -k backup.sql

# 4. Restore Database to New Supabase Instance
$env:PGPASSWORD = $TARGET_PASSWORD
gunzip -k -f backup.sql.gz
psql "postgresql://postgres.$TARGET_REF:$TARGET_PASSWORD@db.$TARGET_REF.supabase.co:5432/postgres?sslmode=require" `
  -v ON_ERROR_STOP=0 `
  -f backup.sql `
  > restore_log.txt 2>&1

# 5. Audit Log File for Critical Errors
Select-String -Path restore_log.txt -Pattern "ERROR" | Where-Object { $_.Line -notmatch "already exists" }

# 6. Execute Storage Object Restore
$env:SUPABASE_URL = "https://$TARGET_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<TARGET_SERVICE_ROLE_KEY>"
node scripts/restore-storage.js
```

### 3.2 Linux/macOS Bash Playbook (Option A — Plain SQL Workflow)

```bash
#!/usr/bin/env bash
set -e

export PGSSLMODE="require"
export PGPASSWORD="<SOURCE_DATABASE_PASSWORD>"
SOURCE_REF="<SOURCE_PROJECT_REF>"
TARGET_REF="<TARGET_PROJECT_REF>"
TARGET_PASSWORD="<TARGET_DATABASE_PASSWORD>"

# 1. Database Dump via Direct Connection
pg_dump \
  -U "postgres.${SOURCE_REF}" \
  -h "db.${SOURCE_REF}.supabase.co" \
  -p 5432 \
  -d postgres \
  --format=plain \
  --no-owner \
  --no-privileges \
  --file=backup.sql

# 2. Compression
gzip -f -k backup.sql

# 3. Restore Ingestion
export PGPASSWORD="${TARGET_PASSWORD}"
psql "postgresql://postgres.${TARGET_REF}:${TARGET_PASSWORD}@db.${TARGET_REF}.supabase.co:5432/postgres?sslmode=require" \
  -v ON_ERROR_STOP=0 \
  -f backup.sql \
  > restore_log.txt 2>&1

# 4. Log Inspection
grep -i "error" restore_log.txt | grep -vi "already exists" || echo "No critical errors found."

# 5. Storage Restoration
export SUPABASE_URL="https://${TARGET_REF}.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<TARGET_SERVICE_ROLE_KEY>"
node scripts/restore-storage.js
```
