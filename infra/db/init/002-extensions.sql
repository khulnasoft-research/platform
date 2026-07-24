-- Agent Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  goal TEXT NOT NULL,
  assignee TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'queued',
  plan JSONB,
  result JSONB,
  budget JSONB NOT NULL DEFAULT '{}',
  approval_gates JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Deployment Environments
CREATE TABLE IF NOT EXISTS deployment_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'persistent',
  provider TEXT NOT NULL,
  region TEXT DEFAULT 'us-east-1',
  compute JSONB DEFAULT '{}',
  scaling JSONB DEFAULT '{}',
  env_vars TEXT[] DEFAULT '{}',
  domain TEXT,
  ssl BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_destroy_at TIMESTAMPTZ
);

-- Deployment Logs
CREATE TABLE IF NOT EXISTS deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES deployments(id),
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  source TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deployment Artifacts
CREATE TABLE IF NOT EXISTS deployment_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES deployments(id),
  type TEXT NOT NULL,
  url TEXT,
  size BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preview Sessions
CREATE TABLE IF NOT EXISTS preview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  task_id UUID,
  status TEXT NOT NULL DEFAULT 'queued',
  url TEXT,
  framework TEXT NOT NULL DEFAULT 'nextjs',
  build_logs JSONB DEFAULT '[]',
  files JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_environments_project ON deployment_environments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_deploy ON deployment_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_previews_project ON preview_sessions(project_id);
