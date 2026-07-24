export type DeploymentProvider =
  | 'vercel' | 'aws' | 'gcp' | 'azure'
  | 'cloudflare' | 'railway' | 'fly-io' | 'docker';

export type DeploymentType = 'serverless' | 'container' | 'static' | 'edge';

export interface Deployment {
  id: string;
  projectId: string;
  environmentId: string;
  commitSha: string;
  buildNumber: number;
  status: DeploymentStatus;
  provider: DeploymentProvider;
  url: string;
  createdAt: string;
}

export type DeploymentStatus =
  | 'queued' | 'building' | 'deploying' | 'verifying'
  | 'live' | 'failed' | 'rolled-back';

export interface DeploymentEnvironment {
  id: string;
  projectId: string;
  name: string;
  type: 'ephemeral' | 'persistent';
  provider: DeploymentProvider;
  region: string;
  compute: ComputeConfig;
  scaling: ScalingConfig;
  envVars: string[];
  domain: string;
  ssl: boolean;
  createdAt: string;
  autoDestroyAt?: string;
}

export interface ComputeConfig {
  cpu: string;
  memory: string;
  replicas: number;
}

export interface ScalingConfig {
  minReplicas: number;
  maxReplicas: number;
  targetCpuUtilization: number;
}

export interface DeploymentArtifact {
  id: string;
  projectId: string;
  commitSha: string;
  buildNumber: number;
  type: 'docker' | 'static' | 'function';
  size: number;
  manifest: Record<string, unknown>;
  sbom: string;
  createdAt: string;
}
