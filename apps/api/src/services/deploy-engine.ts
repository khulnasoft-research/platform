import type {
  Deployment,
  DeploymentProvider,
  DeploymentEnvironment,
  DeploymentArtifact,
  ComputeConfig,
  ScalingConfig,
} from '@platform/shared-types';

interface DeployLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

interface DeployConfig {
  buildCommand: string;
  outputDir: string;
  installCommand: string;
  nodeVersion: string;
}

interface ProviderAdapter {
  name: DeploymentProvider;
  type: 'serverless' | 'container' | 'static' | 'edge';
  regions: string[];
  defaultRegion: string;
  maxReplicas: number;
  supportsEnvVars: boolean;
  supportsCustomDomains: boolean;
  supportsAutoSsl: boolean;
  validateConfig(config: DeployConfig): string[];
  estimatedBuildDuration(config: DeployConfig): number;
}

const providerAdapters: ProviderAdapter[] = [
  {
    name: 'vercel',
    type: 'serverless',
    regions: ['iad1', 'hnd1', 'sin1'],
    defaultRegion: 'iad1',
    maxReplicas: 100,
    supportsEnvVars: true,
    supportsCustomDomains: true,
    supportsAutoSsl: true,
    validateConfig: (config) => {
      const issues: string[] = [];
      if (!config.buildCommand) issues.push('buildCommand is required');
      if (!config.outputDir) issues.push('outputDir is required');
      return issues;
    },
    estimatedBuildDuration: () => 45000 + Math.floor(Math.random() * 30000),
  },
  {
    name: 'railway',
    type: 'container',
    regions: ['us-west', 'us-east', 'eu-west'],
    defaultRegion: 'us-west',
    maxReplicas: 10,
    supportsEnvVars: true,
    supportsCustomDomains: true,
    supportsAutoSsl: true,
    validateConfig: (config) => {
      const issues: string[] = [];
      if (!config.installCommand) issues.push('installCommand is required');
      return issues;
    },
    estimatedBuildDuration: () => 60000 + Math.floor(Math.random() * 60000),
  },
  {
    name: 'docker',
    type: 'container',
    regions: ['local'],
    defaultRegion: 'local',
    maxReplicas: 1,
    supportsEnvVars: true,
    supportsCustomDomains: false,
    supportsAutoSsl: false,
    validateConfig: () => [],
    estimatedBuildDuration: () => 30000 + Math.floor(Math.random() * 20000),
  },
  {
    name: 'cloudflare',
    type: 'edge',
    regions: ['global'],
    defaultRegion: 'global',
    maxReplicas: 1000,
    supportsEnvVars: true,
    supportsCustomDomains: true,
    supportsAutoSsl: true,
    validateConfig: (config) => {
      const issues: string[] = [];
      if (config.outputDir !== 'dist' && config.outputDir !== '_site')
        issues.push('outputDir should be "dist" or "_site" for Cloudflare');
      return issues;
    },
    estimatedBuildDuration: () => 30000 + Math.floor(Math.random() * 15000),
  },
  {
    name: 'fly-io',
    type: 'container',
    regions: ['ams', 'gru', 'hkg', 'lhr', 'sjc', 'syd'],
    defaultRegion: 'sjc',
    maxReplicas: 50,
    supportsEnvVars: true,
    supportsCustomDomains: true,
    supportsAutoSsl: true,
    validateConfig: () => [],
    estimatedBuildDuration: () => 50000 + Math.floor(Math.random() * 30000),
  },
];

let globalBuildNumber = 1;

class DeployEngine {
  private deployments = new Map<string, Deployment>();
  private environments = new Map<string, DeploymentEnvironment>();
  private artifacts = new Map<string, DeploymentArtifact>();
  private deployLogs = new Map<string, DeployLog[]>();
  private buildTimers = new Map<string, ReturnType<typeof setTimeout>>();

  getProviders(): ProviderAdapter[] {
    return providerAdapters;
  }

  getProvider(name: DeploymentProvider): ProviderAdapter | undefined {
    return providerAdapters.find((p) => p.name === name);
  }

  validateConfig(provider: DeploymentProvider, config: DeployConfig): string[] {
    const adapter = this.getProvider(provider);
    return adapter ? adapter.validateConfig(config) : ['Unknown provider'];
  }

  createEnvironment(params: {
    projectId: string;
    name: string;
    type: 'ephemeral' | 'persistent';
    provider: DeploymentProvider;
    region?: string;
    compute?: Partial<ComputeConfig>;
    scaling?: Partial<ScalingConfig>;
    envVars?: string[];
    domain?: string;
    autoDestroyAt?: string;
  }): DeploymentEnvironment {
    const adapter = this.getProvider(params.provider);
    const env: DeploymentEnvironment = {
      id: crypto.randomUUID(),
      projectId: params.projectId,
      name: params.name,
      type: params.type,
      provider: params.provider,
      region: params.region || adapter?.defaultRegion || 'us-west',
      compute: {
        cpu: params.compute?.cpu || '0.5 vCPU',
        memory: params.compute?.memory || '512 MB',
        replicas: params.compute?.replicas || 1,
      },
      scaling: {
        minReplicas: params.scaling?.minReplicas || 1,
        maxReplicas: params.scaling?.maxReplicas || adapter?.maxReplicas || 10,
        targetCpuUtilization: params.scaling?.targetCpuUtilization || 70,
      },
      envVars: params.envVars || [],
      domain: params.domain || '',
      ssl: adapter?.supportsAutoSsl ?? false,
      createdAt: new Date().toISOString(),
      autoDestroyAt: params.autoDestroyAt,
    };

    this.environments.set(env.id, env);
    return JSON.parse(JSON.stringify(env));
  }

  getEnvironment(id: string): DeploymentEnvironment | undefined {
    const env = this.environments.get(id);
    return env ? JSON.parse(JSON.stringify(env)) : undefined;
  }

  listEnvironments(projectId: string): DeploymentEnvironment[] {
    return Array.from(this.environments.values())
      .filter((e) => e.projectId === projectId)
      .map((e) => JSON.parse(JSON.stringify(e)));
  }

  deleteEnvironment(id: string): boolean {
    return this.environments.delete(id);
  }

  createDeployment(params: {
    projectId: string;
    environmentId: string;
    commitSha: string;
    provider: DeploymentProvider;
    deployConfig?: DeployConfig;
  }): Deployment {
    const env = this.environments.get(params.environmentId);
    const adapter = this.getProvider(params.provider);
    const buildNumber = globalBuildNumber++;
    const id = crypto.randomUUID();

    const deployment: Deployment = {
      id,
      projectId: params.projectId,
      environmentId: params.environmentId,
      commitSha: params.commitSha,
      buildNumber,
      status: 'queued',
      provider: params.provider,
      url: env?.domain
        ? `https://${env.domain}`
        : `https://${params.projectId}-${buildNumber}.${params.provider}.preview.ai-platform.dev`,
      createdAt: new Date().toISOString(),
    };

    this.deployments.set(id, deployment);
    this.deployLogs.set(id, []);

    this.addLog(id, 'info', `Deploy #${buildNumber} queued for ${params.provider}`, 'system');
    this.simulateDeploy(id, deployment, params.deployConfig, adapter);

    return JSON.parse(JSON.stringify(deployment));
  }

  private simulateDeploy(
    id: string,
    deployment: Deployment,
    config?: DeployConfig,
    adapter?: ProviderAdapter,
  ): void {
    const steps: { delay: number; msg: string; level: 'info' | 'warn' | 'error'; source: string }[] = [
      { delay: 200, msg: 'Initializing deployment...', level: 'info', source: 'system' },
      { delay: 500, msg: 'Validating configuration...', level: 'info', source: 'system' },
      { delay: 800, msg: 'Checking provider credentials...', level: 'info', source: 'system' },
    ];

    if (config) {
      steps.push(
        { delay: 1200, msg: `Running install: ${config.installCommand || 'npm install'}`, level: 'info', source: 'build' },
        { delay: 2000, msg: 'Installed 142 packages', level: 'info', source: 'build' },
        { delay: 2500, msg: `Running build: ${config.buildCommand || 'npm run build'}`, level: 'info', source: 'build' },
        { delay: 3500, msg: `Build output written to ${config.outputDir || '.next'}`, level: 'info', source: 'build' },
      );
    }

    steps.push(
      { delay: 4000, msg: 'Creating artifact...', level: 'info', source: 'system' },
      { delay: 4500, msg: 'Uploading to provider...', level: 'info', source: 'system' },
    );

    if (adapter) {
      const duration = adapter.estimatedBuildDuration(config || { buildCommand: '', outputDir: '', installCommand: '', nodeVersion: '22' });
      steps.push(
        { delay: Math.min(duration, 6000), msg: `${adapter.name} deployment submitted (${deployment.url})`, level: 'info', source: 'provider' },
      );
    }

    steps.push(
      { delay: 5500, msg: 'Running health checks...', level: 'info', source: 'system' },
    );

    for (const step of steps) {
      const timer = setTimeout(() => {
        this.addLog(id, step.level, step.msg, step.source);
      }, step.delay);
      this.buildTimers.set(`${id}:${step.delay}`, timer);
    }

    const statusTimer = setTimeout(() => {
      const d = this.deployments.get(id);
      if (!d) return;

      this.addLog(id, 'info', `Deployment live at ${d.url}`, 'system');

      const artifact: DeploymentArtifact = {
        id: crypto.randomUUID(),
        projectId: d.projectId,
        commitSha: d.commitSha,
        buildNumber: d.buildNumber,
        type: adapter?.name === 'docker' ? 'docker' : 'static',
        size: Math.floor(Math.random() * 50000000) + 1000000,
        manifest: {
          framework: 'nextjs',
          nodeVersion: config?.nodeVersion || '22',
          regions: [adapter?.defaultRegion || 'us-west'],
        },
        sbom: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
        createdAt: new Date().toISOString(),
      };
      this.artifacts.set(artifact.id, artifact);

      const warningRoll = Math.random();
      if (warningRoll < 0.2) {
        this.addLog(id, 'warn', 'Health check warning: cold start > 500ms', 'monitor');
        this.addLog(id, 'info', 'Auto-scaling policy applied', 'monitor');
      }

      d.status = 'live';
      this.deployments.set(id, d);
      this.buildTimers.delete(`${id}:status`);
    }, 6000);
    this.buildTimers.set(`${id}:status`, statusTimer);
  }

  private addLog(id: string, level: 'info' | 'warn' | 'error', message: string, source: string): void {
    const logs = this.deployLogs.get(id);
    if (!logs) return;
    logs.push({ timestamp: new Date().toISOString(), level, message, source });
  }

  getDeployment(id: string): (Deployment & { logs: DeployLog[] }) | undefined {
    const d = this.deployments.get(id);
    if (!d) return undefined;
    return { ...JSON.parse(JSON.stringify(d)), logs: this.deployLogs.get(id) || [] };
  }

  listDeployments(projectId?: string, environmentId?: string): Deployment[] {
    let result = Array.from(this.deployments.values());
    if (projectId) result = result.filter((d) => d.projectId === projectId);
    if (environmentId) result = result.filter((d) => d.environmentId === environmentId);
    return result.map((d) => JSON.parse(JSON.stringify(d)));
  }

  getDeploymentLogs(id: string): DeployLog[] {
    return this.deployLogs.get(id) || [];
  }

  getArtifact(deploymentId: string): DeploymentArtifact | undefined {
    const d = this.deployments.get(deploymentId);
    if (!d) return undefined;
    return Array.from(this.artifacts.values()).find(
      (a) => a.projectId === d.projectId && a.buildNumber === d.buildNumber,
    );
  }

  rollback(deploymentId: string): Deployment | undefined {
    const d = this.deployments.get(deploymentId);
    if (!d) return undefined;
    if (d.status !== 'live') return undefined;

    const timersToClear = Array.from(this.buildTimers.entries())
      .filter(([key]) => key.startsWith(`${deploymentId}:`));
    for (const [, timer] of timersToClear) clearTimeout(timer);

    d.status = 'rolled-back';
    this.addLog(deploymentId, 'warn', 'Rollback initiated', 'system');
    this.deployments.set(deploymentId, d);

    return JSON.parse(JSON.stringify(d));
  }

  setEnvVars(environmentId: string, envVars: string[]): DeploymentEnvironment | undefined {
    const env = this.environments.get(environmentId);
    if (!env) return undefined;

    env.envVars = [...new Set([...env.envVars, ...envVars])];
    this.environments.set(environmentId, env);
    return JSON.parse(JSON.stringify(env));
  }

  removeEnvVars(environmentId: string, keys: string[]): DeploymentEnvironment | undefined {
    const env = this.environments.get(environmentId);
    if (!env) return undefined;

    env.envVars = env.envVars.filter((v) => !keys.some((k) => v.startsWith(k)));
    this.environments.set(environmentId, env);
    return JSON.parse(JSON.stringify(env));
  }

  getStats() {
    const all = Array.from(this.deployments.values());
    return {
      totalDeployments: all.length,
      liveDeployments: all.filter((d) => d.status === 'live').length,
      failedDeployments: all.filter((d) => d.status === 'failed').length,
      rolledBack: all.filter((d) => d.status === 'rolled-back').length,
      byProvider: providerAdapters.map((p) => ({
        provider: p.name,
        count: all.filter((d) => d.provider === p.name).length,
      })),
    };
  }
}

export const deployEngine = new DeployEngine();
