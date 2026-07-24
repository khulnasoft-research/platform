export type Framework = 'nextjs' | 'vite' | 'astro' | 'express' | 'fastify' | 'custom';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  repository: {
    provider: 'github' | 'gitlab' | 'self-hosted';
    url: string;
    defaultBranch: string;
  } | null;
  framework: Framework | null;
  aiConfig: AIConfig;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface AIConfig {
  defaultModel: string;
  agents: AgentConfig[];
  knowledgeBases: KnowledgeBaseConfig[];
}

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  authority: 'observe' | 'propose' | 'execute' | 'approve';
  tools: string[];
}

export interface KnowledgeBaseConfig {
  id: string;
  name: string;
  type: 'repository' | 'documentation' | 'blueprint';
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  type: 'ephemeral' | 'persistent';
  url: string;
  provider: string;
  region: string;
  createdAt: string;
}

export interface ProjectSecrets {
  projectId: string;
  keys: string[];
}
