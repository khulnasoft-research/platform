import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
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
  const environments = deployEngine.listEnvironments(projectId);
  return c.json({ environments });
});

deployRouter.post('/environments', zValidator('json', createEnvironmentSchema), async (c) => {
  const data = c.req.valid('json');
  const env = deployEngine.createEnvironment(data);
  return c.json(env, 201);
});

deployRouter.get('/environments/:id', async (c) => {
  const env = deployEngine.getEnvironment(c.req.param('id'));
  if (!env) return c.json({ error: 'Environment not found' }, 404);
  return c.json(env);
});

deployRouter.delete('/environments/:id', async (c) => {
  const deleted = deployEngine.deleteEnvironment(c.req.param('id'));
  if (!deleted) return c.json({ error: 'Environment not found' }, 404);
  return c.body(null, 204);
});

deployRouter.post('/environments/:id/env-vars', zValidator('json', envVarsSchema), async (c) => {
  const data = c.req.valid('json');
  const env = deployEngine.setEnvVars(c.req.param('id'), data.envVars);
  if (!env) return c.json({ error: 'Environment not found' }, 404);
  return c.json(env);
});

deployRouter.delete('/environments/:id/env-vars', zValidator('json', envVarsRemoveSchema), async (c) => {
  const data = c.req.valid('json');
  const env = deployEngine.removeEnvVars(c.req.param('id'), data.keys);
  if (!env) return c.json({ error: 'Environment not found' }, 404);
  return c.json(env);
});

deployRouter.get('/', async (c) => {
  const projectId = c.req.query('project_id') || undefined;
  const environmentId = c.req.query('environment_id') || undefined;
  const deployments = deployEngine.listDeployments(projectId, environmentId);
  return c.json({ deployments });
});

deployRouter.post('/', zValidator('json', createDeploymentSchema), async (c) => {
  const data = c.req.valid('json');
  const deployment = deployEngine.createDeployment(data);
  return c.json(deployment, 201);
});

deployRouter.get('/:id', async (c) => {
  const deployment = deployEngine.getDeployment(c.req.param('id'));
  if (!deployment) return c.json({ error: 'Deployment not found' }, 404);
  return c.json(deployment);
});

deployRouter.post('/:id/rollback', async (c) => {
  const deployment = deployEngine.rollback(c.req.param('id'));
  if (!deployment) return c.json({ error: 'Deployment not found or not live' }, 404);
  return c.json(deployment);
});

deployRouter.get('/:id/logs', async (c) => {
  const logs = deployEngine.getDeploymentLogs(c.req.param('id'));
  return c.json({ logs });
});

deployRouter.get('/:id/artifact', async (c) => {
  const artifact = deployEngine.getArtifact(c.req.param('id'));
  if (!artifact) return c.json({ error: 'Artifact not found' }, 404);
  return c.json(artifact);
});

deployRouter.get('/stats/overview', (c) => {
  return c.json(deployEngine.getStats());
});
