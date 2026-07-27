/**
 * SuperBaser — Connection Intelligence Module
 * 
 * Provides:
 * 1. URI Parsing & Decomposition
 * 2. Password Special Character Percent-Encoding
 * 3. Connection Type & Host Auto-Conversion (Direct IPv6 -> Transaction Pooler IPv4)
 * 4. Username Format Validation (postgres.[project_ref])
 * 5. SSL Parameter Enforcement (PGSSLMODE=require / ?sslmode=require)
 */

export interface ParsedConnection {
  rawUri: string;
  scheme: string;
  username: string;
  projectRef?: string;
  rawPassword?: string;
  encodedPassword?: string;
  host: string;
  port: number;
  database: string;
  connectionType: 'transaction_pooler' | 'session_pooler' | 'direct' | 'external' | 'local';
  isIpv6Direct: boolean;
  convertedHost?: string;
  convertedPort?: number;
  sslMode: 'require';
  sanitizedUri: string;
  isValid: boolean;
  validationWarnings: string[];
  validationErrors: string[];
}

/**
 * Encodes special characters in raw database passwords to URI safe percent-encoded values.
 * Prevents double-encoding if already encoded.
 */
export function encodeDatabasePassword(password: string): string {
  if (!password) return '';

  // Check if password already appears percent-encoded
  const isAlreadyEncoded = /%[0-9A-Fa-f]{2}/.test(password);
  if (isAlreadyEncoded) {
    return password;
  }

  // Explicit URI encoding replacement map
  return password
    .replace(/%/g, '%25')
    .replace(/'/g, '%27')
    .replace(/!/g, '%21')
    .replace(/@/g, '%40')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/:/g, '%3A')
    .replace(/\//g, '%2F')
    .replace(/\?/g, '%3F')
    .replace(/ /g, '%20');
}

/**
 * Parses, validates, and normalizes a PostgreSQL connection URI.
 */
export function parseConnectionUri(connectionString: string): ParsedConnection {
  const warnings: string[] = [];
  const errors: string[] = [];

  const trimmed = (connectionString || '').trim();
  if (!trimmed) {
    return {
      rawUri: '',
      scheme: 'postgresql',
      username: '',
      host: '',
      port: 5432,
      database: 'postgres',
      connectionType: 'external',
      isIpv6Direct: false,
      sslMode: 'require',
      sanitizedUri: '',
      isValid: false,
      validationWarnings: [],
      validationErrors: ['Connection string cannot be empty.']
    };
  }

  // Standard regex matcher for postgresql:// connection URIs
  // postgresql://[user]:[pass]@[host]:[port]/[db]
  const uriMatch = trimmed.match(/^postgresql:\/\/([^:]+)(?::([^@]*))?@([^:\/]+)(?::(\d+))?\/(.+)$/);

  if (!uriMatch) {
    errors.push("Invalid PostgreSQL URI format. Format must be: postgresql://[user]:[password]@[host]:[port]/[database]");
    return {
      rawUri: trimmed,
      scheme: 'postgresql',
      username: '',
      host: '',
      port: 5432,
      database: 'postgres',
      connectionType: 'external',
      isIpv6Direct: false,
      sslMode: 'require',
      sanitizedUri: trimmed,
      isValid: false,
      validationWarnings: warnings,
      validationErrors: errors
    };
  }

  const rawUser = decodeURIComponent(uriMatch[1] || '');
  const rawPass = uriMatch[2] ? decodeURIComponent(uriMatch[2]) : '';
  let host = uriMatch[3] || '';
  let port = uriMatch[4] ? parseInt(uriMatch[4], 10) : 5432;
  const rawDbPath = uriMatch[5] || 'postgres';

  // Extract clean database name (strip query params if present)
  const dbName = rawDbPath.split('?')[0] || 'postgres';

  // Extract project ref if present in username (e.g., postgres.vkepcsrjgeyquzmvwvmf)
  let projectRef: string | undefined = undefined;
  const projectRefMatch = rawUser.match(/^postgres\.([a-z0-9]{20})$/i);
  if (projectRefMatch) {
    projectRef = projectRefMatch[1];
  }

  // Determine Connection Type
  let connectionType: ParsedConnection['connectionType'] = 'external';
  let isIpv6Direct = false;

  if (host.includes('.pooler.supabase.com')) {
    if (port === 6543) {
      connectionType = 'transaction_pooler';
    } else if (port === 5432) {
      connectionType = 'session_pooler';
      warnings.push("Session Pooler (Port 5432) detected. Transaction Pooler (Port 6543) is recommended for long-running backups.");
    }
  } else if (host.match(/^db\.[a-z0-9]+\.supabase\.co$/i) || host.includes('.supabase.co')) {
    connectionType = 'direct';
    isIpv6Direct = true;
    warnings.push("Direct Supabase Host (IPv6) detected. Cloudflare Workers require IPv4 Transaction Poolers.");

    // Auto-extract project ref from host if not in username
    const hostRefMatch = host.match(/^db\.([a-z0-9]{20})\.supabase\.co$/i);
    if (hostRefMatch && !projectRef) {
      projectRef = hostRefMatch[1];
    }
  } else if (host === 'localhost' || host === '127.0.0.1') {
    connectionType = 'local';
    errors.push("Local databases (localhost/127.0.0.1) cannot be reached from Cloudflare Worker runners.");
  }

  // Convert Direct IPv6 Host to IPv4 Transaction Pooler if project ref is known
  let convertedHost: string | undefined = undefined;
  let convertedPort: number | undefined = undefined;

  if (connectionType === 'direct' && projectRef) {
    // Standard Supabase pooler host format
    convertedHost = `aws-0-eu-west-1.pooler.supabase.com`;
    convertedPort = 6543;
    warnings.push(`Auto-converted direct host to Transaction Pooler: ${convertedHost}:6543`);
  }

  const effectiveHost = convertedHost || host;
  const effectivePort = convertedPort || port;

  // Ensure username format includes project_ref if using pooler
  let effectiveUser = rawUser;
  if ((connectionType === 'transaction_pooler' || connectionType === 'session_pooler' || convertedHost) && projectRef && !rawUser.startsWith('postgres.')) {
    effectiveUser = `postgres.${projectRef}`;
    warnings.push(`Updated username format to pooler specification: ${effectiveUser}`);
  }

  // Encode password
  const encodedPass = encodeDatabasePassword(rawPass);

  // Construct sanitized URI with SSL enforcement
  const sanitizedUri = `postgresql://${effectiveUser}:${encodedPass}@${effectiveHost}:${effectivePort}/${dbName}?sslmode=require`;

  return {
    rawUri: trimmed,
    scheme: 'postgresql',
    username: effectiveUser,
    projectRef,
    rawPassword: rawPass,
    encodedPassword: encodedPass,
    host: effectiveHost,
    port: effectivePort,
    database: dbName,
    connectionType: convertedHost ? 'transaction_pooler' : connectionType,
    isIpv6Direct,
    convertedHost,
    convertedPort,
    sslMode: 'require',
    sanitizedUri,
    isValid: errors.length === 0,
    validationWarnings: warnings,
    validationErrors: errors
  };
}
