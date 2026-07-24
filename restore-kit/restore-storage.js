#!/usr/bin/env node
/**
 * SuperBaser — Storage restore script
 *
 * Re-uploads files from the Supabase Storage export zip
 * into the NEW project's buckets.
 *
 * MUST be run AFTER the SQL cluster dump has already been restored
 * because that restore is what creates the storage.buckets rows this script relies on.
 *
 * Usage:
 *   SUPABASE_URL=https://<new-project-ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<new-project-service-role-key> \
 *   STORAGE_ZIP_PATH=./storage.zip \
 *   node restore-storage.js
 */

const fs = require('fs');
const AdmZip = require('adm-zip');
const { createClient } = require('@supabase/supabase-js');
const mime = require('mime-types');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZIP_PATH = process.env.STORAGE_ZIP_PATH || './storage.zip';
const CONCURRENCY = 5;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. Aborting.');
  process.exit(1);
}

// Service role key is required (not anon/publishable) — it bypasses RLS/bucket
// privacy so private buckets (e.g. "files") upload correctly.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Zip entries look like: wzyrmzfgdtzaqmkhtbuk/product_catalog/product_catalog/Foo.jpg
// First path segment = old project storage root (discarded).
// Second path segment = bucket name.
// Remainder = object path inside that bucket.
function parseEntry(entryName) {
  const parts = entryName.split('/');
  parts.shift(); // drop project-ref root folder
  const bucket = parts.shift();
  const objectPath = parts.join('/');
  return { bucket, objectPath };
}

async function uploadEntry(entry) {
  const { bucket, objectPath } = parseEntry(entry.entryName);
  if (!bucket || !objectPath) {
    return { skipped: entry.entryName };
  }

  const buffer = entry.getData();
  const contentType = mime.lookup(objectPath) || 'application/octet-stream';

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType, upsert: true });

  if (error) {
    return { failed: `${bucket}/${objectPath}`, error: error.message };
  }
  return { ok: `${bucket}/${objectPath}` };
}

async function run() {
  if (!fs.existsSync(ZIP_PATH)) {
    console.error(`Zip not found at ${ZIP_PATH}`);
    process.exit(1);
  }

  const zip = new AdmZip(ZIP_PATH);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);

  console.log(`Found ${entries.length} files to upload to ${SUPABASE_URL}\n`);

  const results = { ok: [], failed: [], skipped: [] };
  let i = 0;

  async function worker() {
    while (i < entries.length) {
      const entry = entries[i++];
      const res = await uploadEntry(entry);
      if (res.ok) {
        results.ok.push(res.ok);
        console.log(`OK   ${res.ok}`);
      } else if (res.failed) {
        results.failed.push(res);
        console.error(`FAIL ${res.failed} — ${res.error}`);
      } else if (res.skipped) {
        results.skipped.push(res.skipped);
        console.log(`SKIP ${res.skipped}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log('\n--- Summary ---');
  console.log(`Uploaded: ${results.ok.length}`);
  console.log(`Failed:   ${results.failed.length}`);
  console.log(`Skipped:  ${results.skipped.length}`);

  if (results.failed.length) {
    console.log('\nFailed files:');
    results.failed.forEach((f) => console.log(` - ${f.failed}: ${f.error}`));
    process.exit(1);
  }
}

run();
