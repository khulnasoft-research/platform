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

CREATE INDEX IF NOT EXISTS idx_previews_project ON preview_sessions(project_id);
