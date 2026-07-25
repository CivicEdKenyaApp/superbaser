// ─── RAG Ingestion Pipeline Worker ───────────────────────────────────────────
// Item 20: Separate scheduled Worker. Reads source manifest from KV,
// fetches docs from GitHub/llms.txt, diffs shas, chunks, embeds, upserts.
// Item 9 (GitHub PAT), Item 21 (manifest), Item 19 (Vectorize index binding).
// ─────────────────────────────────────────────────────────────────────────────

interface IngestionEnv {
  AI: Ai;
  VECTOR_INDEX: VectorizeIndex;
  AGENT_KV: KVNamespace;
  GITHUB_TOKEN: string;
  CF_AI_GATEWAY_ID: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

interface SourceManifest {
  sources: SourceConfig[];
  ingestionConfig: IngestionConfig;
}

interface SourceConfig {
  id: string;
  type: 'github' | 'llms-txt' | 'github-releases' | 'html-scrape' | 'browser-scrape';
  repo?: string;
  branch?: string;
  paths?: string[];
  indexUrl?: string;
  baseUrl?: string;
  urls?: string[];
  enabled: boolean;
  priority: number;
  filterKeywords?: string[];
  lastSyncSha?: string | null;
  metadata: Record<string, string>;
}

interface IngestionConfig {
  chunkingStrategy: string;
  maxChunkTokens: number;
  minChunkTokens: number;
  overlapSentences: number;
  embeddingModel: string;
  vectorizeBatchSize: number;
  cooldownBetweenSourcesMs: number;
}

interface TextChunk {
  id: string;
  text: string;
  metadata: Record<string, string>;
}

// ─── Chunking Engine ──────────────────────────────────────────────────────────
function chunkByHeadings(
  markdown: string,
  sourceMetadata: Record<string, string>,
  maxTokens: number = 1000
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Strip YAML frontmatter
  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\n/, '');

  // Extract title from frontmatter or first H1
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const docTitle = titleMatch?.[1] ?? sourceMetadata.title ?? 'Untitled';

  // Split on H2/H3 headings
  const sectionRegex = /^#{2,3}\s+.+$/gm;
  const headingMatches = [...withoutFrontmatter.matchAll(/^(#{2,3}\s+.+)$/gm)];

  if (headingMatches.length === 0) {
    // No headings — chunk by paragraph
    const paragraphs = withoutFrontmatter.split(/\n\n+/).filter(p => p.trim().length > 50);
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i].trim();
      if (text.length < 50) continue;
      chunks.push({
        id: `${sourceMetadata.source}-${Date.now()}-${i}`,
        text: text.substring(0, maxTokens * 4), // ~4 chars per token
        metadata: { ...sourceMetadata, title: docTitle, section: 'body' }
      });
    }
    return chunks;
  }

  // Split text at each heading boundary
  const sections: { heading: string; content: string; index: number }[] = [];
  for (let i = 0; i < headingMatches.length; i++) {
    const start = headingMatches[i].index!;
    const end = i + 1 < headingMatches.length ? headingMatches[i + 1].index! : withoutFrontmatter.length;
    sections.push({
      heading: headingMatches[i][0],
      content: withoutFrontmatter.substring(start, end),
      index: i
    });
  }

  // Estimate tokens — rough: chars / 4
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const estimatedTokens = Math.ceil(section.content.length / 4);

    if (estimatedTokens <= maxTokens) {
      // Add overlap: prepend last sentence of previous chunk
      let overlap = '';
      if (i > 0) {
        const prevSentences = sections[i - 1].content.split(/[.!?]\s+/);
        overlap = prevSentences[prevSentences.length - 2] ?? '';
        if (overlap) overlap = overlap.trim() + '. ';
      }

      chunks.push({
        id: `${sourceMetadata.source}-${section.index}-${Date.now()}`,
        text: (overlap + section.content).substring(0, maxTokens * 4),
        metadata: {
          ...sourceMetadata,
          title: docTitle,
          section: section.heading.replace(/^#+\s+/, '')
        }
      });
    } else {
      // Section too large — split by paragraphs
      const paragraphs = section.content.split(/\n\n+/);
      let buffer = '';
      let bufferIdx = 0;

      for (const para of paragraphs) {
        if ((buffer + para).length / 4 > maxTokens) {
          if (buffer.trim().length > 50) {
            chunks.push({
              id: `${sourceMetadata.source}-${section.index}-p${bufferIdx}-${Date.now()}`,
              text: buffer.trim(),
              metadata: { ...sourceMetadata, title: docTitle, section: section.heading.replace(/^#+\s+/, '') }
            });
            bufferIdx++;
          }
          buffer = para;
        } else {
          buffer += '\n\n' + para;
        }
      }

      if (buffer.trim().length > 50) {
        chunks.push({
          id: `${sourceMetadata.source}-${section.index}-p${bufferIdx}-${Date.now()}`,
          text: buffer.trim(),
          metadata: { ...sourceMetadata, title: docTitle, section: section.heading.replace(/^#+\s+/, '') }
        });
      }
    }
  }

  return chunks;
}

// ─── Embedding + Vectorize Upsert ─────────────────────────────────────────────
async function embedAndUpsert(
  chunks: TextChunk[],
  env: IngestionEnv,
  batchSize: number = 100
): Promise<{ upserted: number; failed: number }> {
  let upserted = 0;
  let failed = 0;

  // Process in batches of batchSize
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    try {
      // Generate embeddings via Workers AI
      const embeddingResp = await (env.AI as any).run('@cf/baai/bge-base-en-v1.5', {
        text: batch.map(c => c.text)
      });

      const embeddings = embeddingResp?.data ?? [];
      if (embeddings.length !== batch.length) {
        console.error(`[Ingestion] Embedding count mismatch: got ${embeddings.length}, expected ${batch.length}`);
        failed += batch.length;
        continue;
      }

      // Prepare Vectorize upsert payload
      const vectors = batch.map((chunk, idx) => ({
        id: chunk.id,
        values: embeddings[idx],
        metadata: chunk.metadata
      }));

      await env.VECTOR_INDEX.upsert(vectors);
      upserted += batch.length;

      console.log(`[Ingestion] Upserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} vectors`);

    } catch (err) {
      console.error(`[Ingestion] Batch ${Math.floor(i / batchSize) + 1} failed:`, err);
      failed += batch.length;
    }

    // Cooldown between batches to avoid rate limiting
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return { upserted, failed };
}

// ─── Source Fetchers ─────────────────────────────────────────────────────────
async function fetchGitHubSource(source: SourceConfig, env: IngestionEnv): Promise<TextChunk[]> {
  const chunks: TextChunk[] = [];
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'superbaser-ingestion/1.0',
    Accept: 'application/vnd.github.v3+json'
  };

  try {
    // Get file tree
    const treeResp = await fetch(
      `https://api.github.com/repos/${source.repo}/git/trees/${source.branch ?? 'main'}?recursive=1`,
      { headers }
    );

    if (!treeResp.ok) {
      console.error(`[Ingestion] GitHub tree fetch failed for ${source.repo}: ${treeResp.status}`);
      return [];
    }

    const tree: any = await treeResp.json();
    const mdFiles = tree.tree?.filter((f: any) =>
      f.type === 'blob' &&
      f.path?.endsWith('.md') &&
      (source.paths?.some(p => f.path?.startsWith(p)) ?? true)
    ) ?? [];

    console.log(`[Ingestion] GitHub: ${source.repo} — ${mdFiles.length} markdown files found`);

    // Fetch content for each file (with sha-diff)
    for (const file of mdFiles.slice(0, 50)) { // cap at 50 files per run
      const cachedSha = await env.AGENT_KV.get(`sha:${source.id}:${file.path}`);
      if (cachedSha === file.sha) {
        console.log(`[Ingestion] Skipping unchanged: ${file.path}`);
        continue;
      }

      const contentResp = await fetch(
        `https://raw.githubusercontent.com/${source.repo}/${source.branch ?? 'main'}/${file.path}`,
        { headers }
      );
      if (!contentResp.ok) continue;

      const markdown = await contentResp.text();
      const fileChunks = chunkByHeadings(markdown, {
        ...source.metadata,
        path: file.path,
        sha: file.sha
      });

      chunks.push(...fileChunks);

      // Update sha cache
      await env.AGENT_KV.put(`sha:${source.id}:${file.path}`, file.sha, {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });
    }

  } catch (err) {
    console.error(`[Ingestion] GitHub source error (${source.id}):`, err);
  }

  return chunks;
}

async function fetchLlmsTxtSource(source: SourceConfig, env: IngestionEnv): Promise<TextChunk[]> {
  const chunks: TextChunk[] = [];

  try {
    const indexResp = await fetch(source.indexUrl!);
    if (!indexResp.ok) return [];

    const indexText = await indexResp.text();
    // Parse llms.txt format: lines with URL descriptions
    const lines = indexText.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http') || l.startsWith('/'));

    const pagePaths = lines.slice(0, 30); // cap per run

    for (const path of pagePaths) {
      const pageUrl = path.startsWith('http') ? path : `${source.baseUrl}${path}`;
      const mdUrl = pageUrl.endsWith('/') ? `${pageUrl}index.md` : `${pageUrl}/index.md`;

      try {
        const resp = await fetch(mdUrl, { headers: { Accept: 'text/markdown' } });
        if (!resp.ok) continue;

        const markdown = await resp.text();
        if (markdown.length < 100) continue;

        const pageChunks = chunkByHeadings(markdown, {
          ...source.metadata,
          url: pageUrl
        });

        // Apply keyword filter if configured
        if (source.filterKeywords && source.filterKeywords.length > 0) {
          const filtered = pageChunks.filter(c =>
            source.filterKeywords!.some(kw => c.text.toLowerCase().includes(kw))
          );
          chunks.push(...filtered);
        } else {
          chunks.push(...pageChunks);
        }

      } catch (err) {
        console.error(`[Ingestion] Page fetch failed: ${pageUrl}`, err);
      }
    }

  } catch (err) {
    console.error(`[Ingestion] llms-txt source error (${source.id}):`, err);
  }

  return chunks;
}

async function fetchGitHubReleasesSource(source: SourceConfig, env: IngestionEnv): Promise<TextChunk[]> {
  const chunks: TextChunk[] = [];

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${source.repo}/releases?per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          'User-Agent': 'superbaser-ingestion/1.0'
        }
      }
    );

    if (!resp.ok) return [];

    const releases: any[] = await resp.json();
    for (const release of releases) {
      if (!release.body || release.body.length < 50) continue;

      const markdown = `# ${release.name} (${release.tag_name})\nPublished: ${release.published_at}\n\n${release.body}`;
      const releaseChunks = chunkByHeadings(markdown, {
        ...source.metadata,
        version: release.tag_name,
        publishedAt: release.published_at
      });

      chunks.push(...releaseChunks);
    }

  } catch (err) {
    console.error(`[Ingestion] GitHub releases error (${source.id}):`, err);
  }

  return chunks;
}

// ─── Main Ingestion Handler ───────────────────────────────────────────────────
async function runIngestion(env: IngestionEnv, ctx: ExecutionContext): Promise<void> {
  console.log('[Ingestion] Starting RAG ingestion pipeline...');

  // Load source manifest from KV (fallback to bundled manifest if not in KV)
  let manifest: SourceManifest;
  const kvManifest = await env.AGENT_KV.get('source-manifest', 'json');

  if (kvManifest) {
    manifest = kvManifest as SourceManifest;
  } else {
    // Fallback: fetch bundled manifest from the real GitHub repo
    const bundledManifestResp = await fetch(
      'https://raw.githubusercontent.com/CivicEdKenyaApp/superbaser/main/ingestion/manifest.json',
      { headers: env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {} }
    );
    if (bundledManifestResp.ok) {
      manifest = await bundledManifestResp.json() as SourceManifest;
      // Cache it in KV for subsequent runs
      await env.AGENT_KV.put('source-manifest', JSON.stringify(manifest), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });
      console.log('[Ingestion] Loaded and cached manifest from GitHub.');
    } else {
      console.error('[Ingestion] Could not load manifest from GitHub or KV. Aborting.');
      return;
    }
  }

  const enabledSources = manifest.sources.filter(s => s.enabled).sort((a, b) => a.priority - b.priority);
  const config = manifest.ingestionConfig;

  let totalUpserted = 0;
  let totalFailed = 0;

  for (const source of enabledSources) {
    console.log(`[Ingestion] Processing source: ${source.id} (${source.type})`);

    let chunks: TextChunk[] = [];

    switch (source.type) {
      case 'github':
        chunks = await fetchGitHubSource(source, env);
        break;
      case 'llms-txt':
        chunks = await fetchLlmsTxtSource(source, env);
        break;
      case 'github-releases':
        chunks = await fetchGitHubReleasesSource(source, env);
        break;
      case 'html-scrape':
        // HTML scrape — fetch each URL and strip tags
        for (const url of source.urls ?? []) {
          try {
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const html = await resp.text();
            // Basic HTML tag stripping
            const text = html
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            const urlChunks = chunkByHeadings(`# PostgreSQL Docs\n\n${text}`, {
              ...source.metadata,
              url
            }, config.maxChunkTokens);
            chunks.push(...urlChunks);
          } catch (err) {
            console.error(`[Ingestion] HTML scrape failed: ${url}`, err);
          }
        }
        break;
      case 'browser-scrape':
        // Browser scrape — fetch each URL using Cloudflare Browser Rendering (Markdown REST API)
        for (const url of source.urls ?? []) {
          try {
            const resp = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/markdown`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${env.CF_API_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
              }
            );
            if (!resp.ok) {
              console.error(`[Ingestion] Browser scrape failed for ${url}: ${resp.status} - ${await resp.text()}`);
              continue;
            }
            const markdown = await resp.text();
            if (markdown.trim().length < 50) continue;

            const urlChunks = chunkByHeadings(markdown, {
              ...source.metadata,
              url
            }, config.maxChunkTokens);
            chunks.push(...urlChunks);
          } catch (err) {
            console.error(`[Ingestion] Browser scrape failed: ${url}`, err);
          }
        }
        break;
    }

    if (chunks.length === 0) {
      console.log(`[Ingestion] No new chunks for source: ${source.id}`);
      continue;
    }

    console.log(`[Ingestion] ${source.id}: ${chunks.length} chunks ready for embedding`);

    const { upserted, failed } = await embedAndUpsert(chunks, env, config.vectorizeBatchSize);
    totalUpserted += upserted;
    totalFailed += failed;

    console.log(`[Ingestion] ${source.id}: ${upserted} upserted, ${failed} failed`);

    // Cooldown between sources
    await new Promise(resolve => setTimeout(resolve, config.cooldownBetweenSourcesMs));
  }

  // Update sync state in KV
  await env.AGENT_KV.put('ingestion-last-run', new Date().toISOString());
  await env.AGENT_KV.put('ingestion-stats', JSON.stringify({
    lastRun: new Date().toISOString(),
    totalUpserted,
    totalFailed,
    sourcesProcessed: enabledSources.length
  }));

  console.log(`[Ingestion] Pipeline complete. Upserted: ${totalUpserted} | Failed: ${totalFailed}`);
}

// ─── Worker Export ─────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: IngestionEnv): Promise<Response> {
    // Manual trigger via HTTP for testing
    if (request.method === 'POST' && new URL(request.url).pathname === '/trigger') {
      const ctx = { waitUntil: (p: Promise<any>) => p } as ExecutionContext;
      await runIngestion(env, ctx);
      return new Response(JSON.stringify({ status: 'ingestion_complete' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('RAG Ingestion Worker', { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: IngestionEnv, ctx: ExecutionContext): Promise<void> {
    // Daily at 03:00 UTC (defined in ingestion/wrangler.jsonc)
    ctx.waitUntil(runIngestion(env, ctx));
  }
};
