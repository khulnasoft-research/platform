import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { deployEngine } from '../services/deploy-engine.js';

export const deployRouter = new Hono();

const createEnvironmentSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum(['ephemeral', 'persistent']),
  provider: z.enum(['vercel', 'aws', 'gcp', 'azure', 'cloudflare', 'railway', 'fly-io', 'docker']),
  region: z.string().optional(),
  compute: z.object({ cpu: z.string().optional(), memory: z.string().optional(), replicas: z.number().optional() }).optional(),
  scaling: z.object({ minReplicas: z.number().optional(), maxReplicas: z.number().optional(), targetCpuUtilization: z.number().optional() }).optional(),
  envVars: z.array(z.string()).optional(),
  domain: z.string().optional(),
  autoDestroyAt: z.string().optional(),
});

const createDeploymentSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
  commitSha: z.string().min(1),
  provider: z.enum(['vercel', 'aws', 'gcp', 'azure', 'cloudflare', 'railway', 'fly-io', 'docker']),
  deployConfig: z.object({
    buildCommand: z.string().optional(),
    outputDir: z.string().optional(),
    installCommand: z.string().optional(),
    nodeVersion: z.string().optional(),
  }).optional(),
});

const envVarsSchema = z.object({
  envVars: z.array(z.string()),
});

const envVarsRemoveSchema = z.object({
  keys: z.array(z.string()),
});

function toEnvironment(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type,
    provider: row.provider,
    region: row.region ?? 'us-east-1',
    compute: row.compute ?? {},
    scaling: row.scaling ?? {},
    envVars: row.env_vars ?? [],
    domain: row.domain ?? '',
    ssl: row.ssl ?? false,
    createdAt: row.created_at,
    autoDestroyAt: row.auto_destroy_at,
  };
}

function toDeployment(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    environmentId: row.environment_id,
    commitSha: row.commit_sha,
    buildNumber: row.build_number,
    status: row.status,
    provider: row.provider,
    url: row.url ?? '',
    createdAt: row.created_at,
  };
}

deployRouter.get('/providers', (c) => {
  const providers = deployEngine.getProviders().map((p) => ({
    name: p.name,
    type: p.type,
    regions: p.regions,
    defaultRegion: p.defaultRegion,
    maxReplicas: p.maxReplicas,
    supportsCustomDomains: p.supportsCustomDomains,
    supportsAutoSsl: p.supportsAutoSsl,
  }));
  return c.json({ providers });
});

deployRouter.get('/providers/:name', (c) => {
  const provider = deployEngine.getProvider(c.req.param('name') as any);
  if (!provider) return c.json({ error: 'Provider not found' }, 404);
  return c.json(provider);
});

deployRouter.get('/environments', async (c) => {
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id required' }, 400);

  if (db.connected) {
    const rows = await db.query(
      'SELECT * FROM deployment_environments WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId],
    );
    return c.json({ environments: (rows ?? []).map(toEnvironment) });
  }

  const environments = deployEngine.listEnvironments(projectId);
  return c.json({ environments });
});

deployRouter.post('/environments', zValidator('json', createEnvironmentSchema), async (c) => {
  const data = c.req.valid('json');
  const env = deployEngine.createEnvironment(data);

  if (db.connected) {
    await db.query(
      `INSERT INTO deployment_environments (id, project_id, name, type, provider, region, compute, scaling, env_vars, domain, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [env.id, env.projectId, env.name, env.type, env.provider, env.region,
       JSON.stringify(env.compute), JSON.stringify(env.scaling), env.envVars, env.domain, env.createdAt],
    );
  }

  return c.json(env, 201);
});

deployRouter.get('/environments/:id', async (c) => {
  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM deployment_environments WHERE id = $1', [c.req.param('id')]);
    if (row) return c.json(toEnvironment(row));
  }

  const env = deployEngine.getEnvironment(c.req.param('id'));
  if (!env) return c.json({ error: 'Environment not found' }, 404);
  return c.json(env);
});

deployRouter.delete('/environments/:id', async (c) => {
  const id = c.req.param('id');

  if (db.connected) {
    const row = await db.queryOne('DELETE FROM deployment_environments WHERE id = $1 RETURNING id', [id]);
    if (row) return c.body(null, 204);
    return c.json({ error: 'Environment not found' }, 404);
  }

  const deleted = deployEngine.deleteEnvironment(id);
  if (!deleted) return c.json({ error: 'Environment not found' }, 404);
  return c.body(null, 204);
});

deployRouter.post('/environments/:id/env-vars', zValidator('json', envVarsSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  if (db.connected) {
    const row = await db.queryOne(
      `UPDATE deployment_environments SET env_vars = $1 WHERE id = $2 RETURNING *`,
      [data.envVars, id],
    );
    if (row) return c.json({
      id: row.id,
      projectId: row.project_id,
      envVars: row.env_vars,
    });
    return c.json({ error: 'Environment not found' }, 404);
  }

  const env = deployEngine.setEnvVars(id, data.envVars);
  if (!env) return c.json({ error: 'Environment not found' }, 404);
  return c.json(env);
});

deployRouter.delete('/environments/:id/env-vars', zValidator('json', envVarsRemoveSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  if (db.connected) {
    const row = await db.queryOne(
      `UPDATE deployment_environments SET env_vars = (
        SELECT array_agg(v) FROM unnest(env_vars) AS v WHERE NOT (v = ANY($1))
      ) WHERE id = $2 RETURNING *`,
      [data.keys, id],
    );
    if (row) return c.json({
      id: row.id,
      projectId: row.project_id,
      envVars: row.env_vars,
    });
    return c.json({ error: 'Environment not found' }, 404);
  }

  const env = deployEngine.removeEnvVars(id, data.keys);
  if (!env) return c.json({ error: 'Environment not found' }, 404);
  return c.json(env);
});

deployRouter.get('/', async (c) => {
  const projectId = c.req.query('project_id') || undefined;
  const environmentId = c.req.query('environment_id') || undefined;

  if (db.connected) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (projectId) { conditions.push(`project_id = $${idx++}`); params.push(projectId); }
    if (environmentId) { conditions.push(`environment_id = $${idx++}`); params.push(environmentId); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.query(`SELECT * FROM deployments ${where} ORDER BY created_at DESC`, params);
    return c.json({ deployments: (rows ?? []).map(toDeployment) });
  }

  const deployments = deployEngine.listDeployments(projectId, environmentId);
  return c.json({ deployments });
});

deployRouter.post('/', zValidator('json', createDeploymentSchema), async (c) => {
  const data = c.req.valid('json');
  const deployment = deployEngine.createDeployment(data);

  if (db.connected) {
    await db.query(
      `INSERT INTO deployments (id, project_id, environment_id, commit_sha, build_number, status, provider, url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [deployment.id, deployment.projectId, deployment.environmentId, deployment.commitSha,
       deployment.buildNumber, deployment.status, deployment.provider, deployment.url, deployment.createdAt],
    );
  }

  return c.json(deployment, 201);
});

deployRouter.get('/:id', async (c) => {
  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM deployments WHERE id = $1', [c.req.param('id')]);
    if (row) return c.json(toDeployment(row));
  }

  const deployment = deployEngine.getDeployment(c.req.param('id'));
  if (!deployment) return c.json({ error: 'Deployment not found' }, 404);
  return c.json(deployment);
});

deployRouter.post('/:id/rollback', async (c) => {
  const id = c.req.param('id');
  const deployment = deployEngine.rollback(id);
  if (!deployment) return c.json({ error: 'Deployment not found or not live' }, 404);

  if (db.connected) {
    await db.query(`UPDATE deployments SET status = $1 WHERE id = $2`, [deployment.status, id]);
  }

  return c.json(deployment);
});

deployRouter.get('/:id/logs', async (c) => {
  if (db.connected) {
    const rows = await db.query(
      'SELECT * FROM deployment_logs WHERE deployment_id = $1 ORDER BY created_at ASC',
      [c.req.param('id')],
    );
    return c.json({ logs: (rows ?? []).map((r: any) => ({
      timestamp: r.created_at,
      level: r.level,
      message: r.message,
      source: r.source,
    })) });
  }

  const logs = deployEngine.getDeploymentLogs(c.req.param('id'));
  return c.json({ logs });
});

deployRouter.get('/:id/artifact', async (c) => {
  if (db.connected) {
    const row = await db.queryOne(
      'SELECT * FROM deployment_artifacts WHERE deployment_id = $1 ORDER BY created_at DESC LIMIT 1',
      [c.req.param('id')],
    );
    if (row) return c.json({
      id: row.id,
      type: row.type,
      url: row.url ?? '',
      size: row.size ?? 0,
    });
    return c.json({ error: 'Artifact not found' }, 404);
  }

  const artifact = deployEngine.getArtifact(c.req.param('id'));
  if (!artifact) return c.json({ error: 'Artifact not found' }, 404);
  return c.json(artifact);
});

deployRouter.get('/stats/overview', async (c) => {
  if (db.connected) {
    const [totalRow, activeRow, successRow] = await Promise.all([
      db.queryOne('SELECT COUNT(*)::int as count FROM deployments'),
      db.queryOne('SELECT COUNT(*)::int as count FROM deployment_environments'),
      db.queryOne(`SELECT
        CASE WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(100.0 * SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) / COUNT(*), 1)
        END as rate
        FROM deployments`),
    ]);
    return c.json({
      totalDeployments: totalRow?.count ?? 0,
      activeEnvironments: activeRow?.count ?? 0,
      successRate: successRow?.rate ?? 0,
      averageDurationMs: 0,
    });
  }

  return c.json(deployEngine.getStats());
});
