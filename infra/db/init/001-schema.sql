CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id),
  repository_url TEXT,
  framework TEXT,
  default_model TEXT DEFAULT 'claude-sonnet-4',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4',
  authority TEXT NOT NULL DEFAULT 'propose',
  tools TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blueprint_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  environment_id UUID,
  commit_sha TEXT NOT NULL,
  build_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  project_id UUID,
  user_id UUID,
  agent_id TEXT,
  feature TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tier TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  fallback_chain TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_blueprints_project ON blueprint_snapshots(project_id);
CREATE INDEX idx_deployments_project ON deployments(project_id);
CREATE INDEX idx_ai_logs_org ON ai_usage_logs(organization_id, created_at);
