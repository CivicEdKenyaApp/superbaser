export class BackupContainer {
  state: DurableObjectState;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/run') {
      const body = await request.json() as any;
      const result = await this.runContainer(body);
      return Response.json(result);
    }
    if (url.pathname === '/status') return Response.json({ status: 'idle' });
    return new Response('Not found', { status: 404 });
  }

  async runContainer(job: any): Promise<any> {
    const { id, organization_id, project_id, kind, payload } = job;

    const credResponse = await fetch(this.env.SUPABASE_URL + '/rest/v1/project_credentials?project_id=eq.' + project_id + '&select=*', {
      headers: { 'Authorization': 'Bearer ' + this.env.SUPABASE_SERVICE_KEY, 'apikey': this.env.SUPABASE_SERVICE_KEY },
    });
    const credentials = await credResponse.json() as any[];
    if (!credentials || credentials.length === 0) return { success: false, error: 'No credentials found for project' };
    const cred = credentials[0];

    const containerEnv: Record<string, string> = {
      SUPABASE_URL: this.env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: this.env.SUPABASE_SERVICE_KEY,
      WORKER_URL: this.env.WORKER_URL || 'https://superbaser-backup.saemscodes.workers.dev',
      ENCRYPTION_KEY: this.env.ENCRYPTION_KEY || '',
      JOB_ID: id,
      PROJECT_ID: project_id,
      JOB_KIND: kind,
      PAYLOAD: JSON.stringify(payload || {}),
      DB_HOST: cred.host,
      DB_PORT: String(cred.port || 6543),
      DB_NAME: cred.database || 'postgres',
      DB_USER: cred.username,
      DB_PASSWORD: cred.encrypted_password || cred.password,
      PGSSLMODE: 'require',
    };

    try {
      if (this.env.CONTAINER) {
        const container = await this.env.CONTAINER.run({
          image: 'superbaser/backup-runner:latest',
          env: containerEnv,
          entrypoint: ['node', '/app/runner.js'],
        });
        const exitCode = await container.wait();
        const logs = await container.logs();
        return { success: exitCode === 0, exitCode, logs: logs.text() };
      }
      return {
        success: true,
        message: 'Job dispatched - container will be spawned by external runner',
        job_id: id,
        env_keys: Object.keys(containerEnv),
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Container execution failed' };
    }
  }
}
