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

CREATE INDEX IF NOT EXISTS idx_blueprints_project ON blueprint_snapshots(project_id);
