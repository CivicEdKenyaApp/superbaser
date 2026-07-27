'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const WORKER_URL = process.env.WORKER_URL || 'https://superbaser-backup.saemscodes.workers.dev';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const WORKER_ID = 'container-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

const { execSync, spawn } = require('child_process');
const fs = require('fs');

async function callWorker(path, body) {
  const response = await fetch(WORKER_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function supabaseSelect(table, query) {
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
    headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY, 'apikey': SUPABASE_SERVICE_KEY },
  });
  return response.json();
}

async function getProjectCredentials(projectId) {
  const result = await supabaseSelect('project_credentials', 'project_id=eq.' + projectId + '&select=*');
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
}

function buildConnectionString(credentials) {
  const host = credentials.host;
  const port = credentials.port || 6543;
  const database = credentials.database || 'postgres';
  const username = credentials.username;
  const password = encodeURIComponent(credentials.encrypted_password || credentials.password || '');
  return 'postgresql://' + username + ':' + password + '@' + host + ':' + port + '/' + database + '?sslmode=require';
}

async function checkBackwynAvailable() {
  try {
    execSync('backwyn --version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function execCommand(cmd, envOverrides, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', cmd], {
      env: { ...process.env, ...envOverrides },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (onProgress) onProgress('stdout', data.toString());
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (onProgress) onProgress('stderr', data.toString());
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr, code });
      else reject({ stdout, stderr, code });
    });
    child.on('error', (err) => reject({ stdout, stderr, error: err.message, code: -1 }));
  });
}

async function streamToFile(r2ObjectBody, filePath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    const reader = r2ObjectBody.getReader();
    const pump = () => reader.read().then(({ done, value }) => {
      if (done) { writeStream.end(); return; }
      writeStream.write(Buffer.from(value), pump);
    }).catch(reject);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    pump();
  });
}

function calculateSha256(filePath) {
  try {
    return execSync('sha256sum ' + filePath).toString().split(' ')[0].trim();
  } catch {
    try { return execSync('shasum -a 256 ' + filePath).toString().split(' ')[0].trim(); } catch { return null; }
  }
}

function countTablesAndRows(filePath) {
  try {
    const list = execSync('pg_restore --list ' + filePath).toString();
    const tableMatches = list.match(/\d+; \d+ \d+ TABLE PUBLIC\./gi) || [];
    return { tables_count: tableMatches.length, rows_count: null };
  } catch {
    return { tables_count: null, rows_count: null };
  }
}

async function runBackup(job, credentials) {
  const jobId = job.id || process.env.JOB_ID;
  const projectId = job.project_id || process.env.PROJECT_ID;
  const connectionString = buildConnectionString(credentials);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const r2Key = 'backups/' + projectId + '/' + timestamp + '.dump';
  const tempFile = '/tmp/backup_' + jobId + '.dump';
  let engineUsed = 'backwyn';
  let engineFallbackUsed = false;
  const backwynAvailable = await checkBackwynAvailable();

  if (backwynAvailable) {
    try {
      await callWorker('/update-progress', { job_id: jobId, progress: 10, message: 'Starting Backwyn backup engine...' });
      const backwynCmd = 'backwyn backup "' + connectionString + '" -to "' + tempFile + '" --format custom';
      await execCommand(backwynCmd, { PGSSLMODE: 'require', PGPASSWORD: credentials.encrypted_password || credentials.password }, async (stream, data) => {
        if (data.includes('backup:')) await callWorker('/update-progress', { job_id: jobId, progress: 30, message: 'Backwyn: creating dump...' });
        if (data.includes('verify:')) await callWorker('/update-progress', { job_id: jobId, progress: 60, message: 'Backwyn: verifying integrity...' });
        if (data.includes('upload:')) await callWorker('/update-progress', { job_id: jobId, progress: 80, message: 'Backwyn: uploading to R2...' });
      });
      const sha256 = calculateSha256(tempFile) || 'unknown';
      const { tables_count, rows_count } = countTablesAndRows(tempFile);
      const sizeBytes = fs.statSync(tempFile).size;
      const fileBuffer = fs.readFileSync(tempFile);
      await fetch(SUPABASE_URL + '/storage/v1/object/backups/' + r2Key, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY, 'Content-Type': 'application/octet-stream' },
        body: fileBuffer,
      });
      await callWorker('/update-progress', { job_id: jobId, progress: 90, message: 'Recording backup metadata...' });
      const backupResp = await callWorker('/record-backup', { project_id: projectId, job_id: jobId, r2_key: r2Key, size_bytes: sizeBytes, sha256, engine_used: 'backwyn', format: 'custom', encrypted: !!ENCRYPTION_KEY, encryption_method: ENCRYPTION_KEY ? 'aes-256-gcm' : null, tables_count, rows_count, verified: false });
      try {
        const verifyCmd = 'backwyn verify "' + tempFile + '"' + (ENCRYPTION_KEY ? ' --encryption-key ' + ENCRYPTION_KEY : '');
        const verifyResult = await execCommand(verifyCmd, { PGSSLMODE: 'require' });
        const verified = verifyResult.stdout.includes('VERIFIED=YES');
        const verifyTables = parseInt(verifyResult.stdout.match(/tables:\s*(\d+)/)?.[1] || '0');
        const verifyRows = parseInt(verifyResult.stdout.match(/rows:\s*(\d+)/)?.[1] || '0');
        await callWorker('/record-verification', { backup_id: backupResp.backup_id, verified, tables_count: verifyTables || tables_count, rows_count: verifyRows || rows_count, checksum_match: true, restore_duration_ms: null, error_details: verified ? null : verifyResult.stderr });
      } catch (verifyErr) {
        await callWorker('/record-verification', { backup_id: backupResp.backup_id, verified: false, tables_count, rows_count, checksum_match: false, restore_duration_ms: null, error_details: verifyErr.stderr || verifyErr.error || 'Verification failed' });
      }
      try { fs.unlinkSync(tempFile); } catch {}
      await callWorker('/complete-job', { job_id: jobId, success: true, result: { r2_key: r2Key, engine: 'backwyn', backup_id: backupResp.backup_id }, engine_used: 'backwyn', engine_fallback_used: false });
      return { success: true, engine: 'backwyn' };
    } catch (backwynErr) {
      engineUsed = 'native';
      engineFallbackUsed = true;
      await callWorker('/update-progress', { job_id: jobId, progress: 15, message: 'Backwyn failed, falling back to native pg_dump...' });
    }
  }

  try {
    const pgDumpCmd = 'pg_dump --format=custom --no-owner --no-privileges --file=' + tempFile + ' "' + connectionString + '"';
    await callWorker('/update-progress', { job_id: jobId, progress: 20, message: 'Native: executing pg_dump --format=custom...' });
    await execCommand(pgDumpCmd, { PGSSLMODE: 'require', PGPASSWORD: credentials.encrypted_password || credentials.password }, async (stream, data) => {
      if (stream === 'stderr' && data.includes('pg_dump:')) await callWorker('/update-progress', { job_id: jobId, progress: 40, message: 'pg_dump: ' + data.trim() });
    });
    if (!fs.existsSync(tempFile)) throw new Error('pg_dump completed but no output file was created');
    const sizeBytes = fs.statSync(tempFile).size;
    if (sizeBytes === 0) throw new Error('pg_dump completed but output file is empty (0 bytes)');
    await callWorker('/update-progress', { job_id: jobId, progress: 60, message: 'Native: dump created (' + sizeBytes + ' bytes), uploading to R2...' });
    const fileBuffer = fs.readFileSync(tempFile);
    await fetch(SUPABASE_URL + '/storage/v1/object/backups/' + r2Key, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY, 'Content-Type': 'application/octet-stream' },
      body: fileBuffer,
    });
    await callWorker('/update-progress', { job_id: jobId, progress: 80, message: 'Native: calculating checksum and metadata...' });
    const sha256 = calculateSha256(tempFile) || 'unknown';
    const { tables_count, rows_count } = countTablesAndRows(tempFile);
    await callWorker('/update-progress', { job_id: jobId, progress: 90, message: 'Native: recording backup metadata...' });
    const backupResp = await callWorker('/record-backup', { project_id: projectId, job_id: jobId, r2_key: r2Key, size_bytes: sizeBytes, sha256, engine_used: 'native', format: 'custom', encrypted: false, encryption_method: null, tables_count, rows_count, verified: false });
    try { fs.unlinkSync(tempFile); } catch {}
    await callWorker('/complete-job', { job_id: jobId, success: true, result: { r2_key: r2Key, engine: 'native', backup_id: backupResp.backup_id }, engine_used: 'native', engine_fallback_used: engineFallbackUsed });
    return { success: true, engine: 'native', fallback: engineFallbackUsed };
  } catch (nativeErr) {
    const errorMsg = nativeErr.stderr || nativeErr.error || nativeErr.message || 'Unknown error';
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: errorMsg, engine: engineUsed, fallback_attempted: engineFallbackUsed, connection_host: credentials.host, connection_port: credentials.port }, engine_used: engineUsed, engine_fallback_used: engineFallbackUsed });
    try { fs.unlinkSync(tempFile); } catch {}
    return { success: false, error: errorMsg, engine: engineUsed };
  }
}

async function runRestore(job, credentials) {
  const jobId = job.id || process.env.JOB_ID;
  const projectId = job.project_id || process.env.PROJECT_ID;
  const payload = job.payload || {};
  const backupId = payload.backup_id;
  const force = payload.force || false;
  const connectionString = buildConnectionString(credentials);
  const targetHost = payload.target_host || credentials.host;
  const targetDatabase = payload.target_database || credentials.database || 'postgres';

  const backupResult = await supabaseSelect('backups', 'id=eq.' + backupId + '&select=*');
  const backup = Array.isArray(backupResult) && backupResult.length > 0 ? backupResult[0] : null;
  if (!backup) {
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: 'Backup ' + backupId + ' not found' }, engine_used: 'restore', engine_fallback_used: false });
    return { success: false, error: 'Backup not found' };
  }
  if (!backup.verified && !force && !payload.allow_unverified) {
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: 'Backup is not verified. Set allow_unverified=true or force=true to restore anyway.' }, engine_used: 'restore', engine_fallback_used: false });
    return { success: false, error: 'Backup not verified' };
  }

  // Target non-empty guard
  try {
    const checkCmd = 'psql "' + connectionString + '" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN (\'information_schema\', \'pg_catalog\', \'pg_toast\');" -t';
    const checkResult = await execCommand(checkCmd, { PGSSLMODE: 'require', PGPASSWORD: credentials.encrypted_password || credentials.password });
    const tableCount = parseInt(checkResult.stdout.trim()) || 0;
    if (tableCount > 0 && !force) {
      await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: 'Target database is not empty (' + tableCount + ' tables). Set force=true to overwrite.' }, engine_used: 'restore', engine_fallback_used: false });
      return { success: false, error: 'Target not empty' };
    }
  } catch (checkErr) {
    console.error('[runner] Could not check target database:', checkErr.stderr);
  }

  await callWorker('/update-progress', { job_id: jobId, progress: 20, message: 'Downloading backup from R2...' });
  const r2Response = await fetch(SUPABASE_URL + '/storage/v1/object/backups/' + backup.r2_key, {
    headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY },
  });
  if (!r2Response.ok) {
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: 'Backup file not found in R2: ' + backup.r2_key }, engine_used: 'restore', engine_fallback_used: false });
    return { success: false, error: 'Backup file not found' };
  }
  const tempFile = '/tmp/restore_' + jobId + '.dump';
  const fileBuffer = Buffer.from(await r2Response.arrayBuffer());
  fs.writeFileSync(tempFile, fileBuffer);

  await callWorker('/update-progress', { job_id: jobId, progress: 40, message: 'Executing pg_restore...' });

  let engineUsed = 'backwyn';
  const backwynAvailable = await checkBackwynAvailable();
  if (backwynAvailable && backup.encrypted) {
    try {
      const backwynCmd = 'backwyn restore ' + backupId + ' -to "' + connectionString + '"' + (ENCRYPTION_KEY ? ' --encryption-key ' + ENCRYPTION_KEY : '') + (force ? ' -force' : '');
      const result = await execCommand(backwynCmd, { PGSSLMODE: 'require', PGPASSWORD: credentials.encrypted_password || credentials.password });
      const tablesRestored = parseInt(result.stdout.match(/tables:\s*(\d+)/)?.[1] || '0');
      const rowsRestored = parseInt(result.stdout.match(/rows:\s*(\d+)/)?.[1] || '0');
      await callWorker('/record-restore', { backup_id: backupId, project_id: projectId, target_host: targetHost, target_database: targetDatabase, status: 'completed', tables_restored: tablesRestored, rows_restored: rowsRestored, engine_used: 'backwyn', force_used: force, errors: null });
      await callWorker('/complete-job', { job_id: jobId, success: true, result: { tables_restored: tablesRestored, rows_restored: rowsRestored, engine: 'backwyn' }, engine_used: 'backwyn', engine_fallback_used: false });
      try { fs.unlinkSync(tempFile); } catch {}
      return { success: true, engine: 'backwyn' };
    } catch (backwynErr) {
      engineUsed = 'native';
      await callWorker('/update-progress', { job_id: jobId, progress: 50, message: 'Backwyn restore failed, falling back to native pg_restore...' });
    }
  }

  try {
    const pgRestoreCmd = 'pg_restore --no-owner --no-privileges --format=custom --dbname="' + connectionString + '" ' + tempFile + (force ? ' --clean' : '');
    await execCommand(pgRestoreCmd, { PGSSLMODE: 'require', PGPASSWORD: credentials.encrypted_password || credentials.password }, async (stream, data) => {
      if (stream === 'stderr' && data.includes('pg_restore:')) await callWorker('/update-progress', { job_id: jobId, progress: 70, message: 'pg_restore: ' + data.trim() });
    });
    await callWorker('/update-progress', { job_id: jobId, progress: 90, message: 'Counting restored tables...' });
    const countCmd = 'psql "' + connectionString + '" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN (\'information_schema\', \'pg_catalog\', \'pg_toast\');" -t';
    const countResult = await execCommand(countCmd, { PGSSLMODE: 'require', PGPASSWORD: credentials.encrypted_password || credentials.password });
    const tablesRestored = parseInt(countResult.stdout.trim()) || 0;
    await callWorker('/record-restore', { backup_id: backupId, project_id: projectId, target_host: targetHost, target_database: targetDatabase, status: 'completed', tables_restored: tablesRestored, rows_restored: null, engine_used: 'native', force_used: force, errors: null });
    await callWorker('/complete-job', { job_id: jobId, success: true, result: { tables_restored: tablesRestored, engine: 'native' }, engine_used: 'native', engine_fallback_used: engineUsed === 'backwyn' });
    try { fs.unlinkSync(tempFile); } catch {}
    return { success: true, engine: 'native' };
  } catch (restoreErr) {
    const errorMsg = restoreErr.stderr || restoreErr.error || restoreErr.message || 'Unknown error';
    await callWorker('/record-restore', { backup_id: backupId, project_id: projectId, target_host: targetHost, target_database: targetDatabase, status: 'failed', tables_restored: 0, rows_restored: 0, engine_used: engineUsed, force_used: force, errors: errorMsg });
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: errorMsg, engine: engineUsed }, engine_used: engineUsed, engine_fallback_used: false });
    try { fs.unlinkSync(tempFile); } catch {}
    return { success: false, error: errorMsg };
  }
}

async function runVerify(job, credentials) {
  const jobId = job.id || process.env.JOB_ID;
  const payload = job.payload || {};
  const backupId = payload.backup_id;
  const backupResult = await supabaseSelect('backups', 'id=eq.' + backupId + '&select=*');
  const backup = Array.isArray(backupResult) && backupResult.length > 0 ? backupResult[0] : null;
  if (!backup) {
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: 'Backup ' + backupId + ' not found' }, engine_used: 'verify', engine_fallback_used: false });
    return;
  }
  await callWorker('/update-progress', { job_id: jobId, progress: 20, message: 'Downloading backup from R2 for verification...' });
  const r2Response = await fetch(SUPABASE_URL + '/storage/v1/object/backups/' + backup.r2_key, {
    headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY },
  });
  if (!r2Response.ok) {
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: 'Backup file not found in R2: ' + backup.r2_key }, engine_used: 'verify', engine_fallback_used: false });
    return;
  }
  const tempFile = '/tmp/verify_' + jobId + '.dump';
  fs.writeFileSync(tempFile, Buffer.from(await r2Response.arrayBuffer()));

  await callWorker('/update-progress', { job_id: jobId, progress: 40, message: 'Verifying checksum...' });
  const currentSha256 = calculateSha256(tempFile);
  const checksumMatch = !!(currentSha256 && backup.sha256 && currentSha256 === backup.sha256);

  await callWorker('/update-progress', { job_id: jobId, progress: 60, message: 'Test-restoring into sandbox database...' });
  const sandboxDb = 'sandbox_verify_' + Date.now();
  try {
    await execCommand('createdb ' + sandboxDb, { PGSSLMODE: 'require' });
    const sandboxConn = 'postgresql://postgres:postgres@localhost:5432/' + sandboxDb;
    await execCommand('pg_restore --no-owner --no-privileges --format=custom --dbname="' + sandboxConn + '" ' + tempFile, { PGSSLMODE: 'require' });
    const countResult = await execCommand('psql "' + sandboxConn + '" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN (\'information_schema\', \'pg_catalog\', \'pg_toast\');" -t', { PGSSLMODE: 'require' });
    const tablesCount = parseInt(countResult.stdout.trim()) || 0;
    const rowsResult = await execCommand('psql "' + sandboxConn + '" -c "SELECT SUM(n_live_tup) FROM pg_stat_user_tables;" -t', { PGSSLMODE: 'require' });
    const rowsCount = parseInt(rowsResult.stdout.trim()) || 0;
    await callWorker('/record-verification', { backup_id: backupId, verified: true, tables_count: tablesCount, rows_count: rowsCount, checksum_match: checksumMatch, restore_duration_ms: null, error_details: null });
    await callWorker('/complete-job', { job_id: jobId, success: true, result: { verified: true, tables: tablesCount, rows: rowsCount, checksum_match: checksumMatch }, engine_used: 'verify', engine_fallback_used: false });
  } catch (verifyErr) {
    await callWorker('/record-verification', { backup_id: backupId, verified: false, tables_count: null, rows_count: null, checksum_match: checksumMatch, restore_duration_ms: null, error_details: verifyErr.stderr || verifyErr.error || 'Verification failed' });
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: verifyErr.stderr || verifyErr.error || 'Verification failed' }, engine_used: 'verify', engine_fallback_used: false });
  } finally {
    try { await execCommand('dropdb ' + sandboxDb, {}); } catch {}
    try { fs.unlinkSync(tempFile); } catch {}
  }
}

async function runPrune(job) {
  const jobId = job.id || process.env.JOB_ID;
  const payload = job.payload || {};
  const projectId = payload.project_id || job.project_id || process.env.PROJECT_ID;
  await callWorker('/update-progress', { job_id: jobId, progress: 20, message: 'Fetching backup list for pruning...' });
  const result = await callWorker('/prune', { project_id: projectId, keep_daily: payload.retention_daily || 7, keep_weekly: payload.retention_weekly || 4, keep_monthly: payload.retention_monthly || 12 });
  if (result.success) {
    if (result.deleted_r2_keys && Array.isArray(result.deleted_r2_keys)) {
      for (const key of result.deleted_r2_keys) {
        try {
          await fetch(SUPABASE_URL + '/storage/v1/object/backups/' + key, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY },
          });
        } catch {}
      }
    }
    await callWorker('/complete-job', { job_id: jobId, success: true, result: { deleted_count: result.deleted_count, kept_count: result.kept_count }, engine_used: 'prune', engine_fallback_used: false });
  } else {
    await callWorker('/complete-job', { job_id: jobId, success: false, error: { message: result.error || 'Prune failed' }, engine_used: 'prune', engine_fallback_used: false });
  }
}

async function main() {
  await callWorker('/heartbeat', { worker_id: WORKER_ID, status: 'healthy', jobs_processed: 0, jobs_failed: 0 });

  // If JOB_ID is set via env, run that specific job directly (container invocation mode)
  const envJobId = process.env.JOB_ID;
  const envJobKind = process.env.JOB_KIND;
  const envProjectId = process.env.PROJECT_ID;

  let job;
  let credentials;

  if (envJobId && envJobKind && envProjectId) {
    // Invoked directly by container orchestrator with specific job
    const jobResult = await supabaseSelect('jobs', 'id=eq.' + envJobId + '&select=*');
    job = Array.isArray(jobResult) && jobResult.length > 0 ? jobResult[0] : { id: envJobId, project_id: envProjectId, kind: envJobKind, payload: JSON.parse(process.env.PAYLOAD || '{}') };
  } else {
    // Poll mode: claim next available job
    const claimResult = await callWorker('/claim-job', { worker_id: WORKER_ID });
    if (!claimResult.success) {
      console.log('[runner] No jobs available. Exiting.');
      return { success: false, message: 'No jobs available' };
    }
    job = claimResult.job;
  }

  let jobsProcessed = 0, jobsFailed = 0;
  await callWorker('/update-progress', { job_id: job.id, progress: 5, message: 'Job claimed by ' + WORKER_ID });

  try {
    credentials = await getProjectCredentials(job.project_id);
    if (!credentials) throw new Error('No credentials found for project ' + job.project_id);

    switch (job.kind) {
      case 'backup':
        await runBackup(job, credentials);
        jobsProcessed++;
        break;
      case 'restore':
        await runRestore(job, credentials);
        jobsProcessed++;
        break;
      case 'verify':
        await runVerify(job, credentials);
        jobsProcessed++;
        break;
      case 'cleanup':
      case 'storage':
        await runPrune(job);
        jobsProcessed++;
        break;
      default:
        await callWorker('/complete-job', { job_id: job.id, success: false, error: { message: 'Unknown job kind: ' + job.kind }, engine_used: 'unknown', engine_fallback_used: false });
        jobsFailed++;
    }
  } catch (err) {
    jobsFailed++;
    console.error('[runner] Unexpected error:', err);
    await callWorker('/complete-job', { job_id: job.id, success: false, error: { message: err.message || 'Unexpected error' }, engine_used: 'unknown', engine_fallback_used: false });
  }

  await callWorker('/heartbeat', { worker_id: WORKER_ID, status: 'healthy', jobs_processed: jobsProcessed, jobs_failed: jobsFailed });
  return { success: true, jobs_processed: jobsProcessed };
}

module.exports = { main, runBackup, runRestore, runVerify, runPrune };

if (require.main === module) {
  main().then(console.log).catch(console.error);
}
