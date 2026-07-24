export interface PreviewSession {
  id: string;
  projectId: string;
  taskId: string;
  status: PreviewStatus;
  url: string;
  framework: string;
  buildLogs: BuildLogEntry[];
  files: PreviewFile[];
  createdAt: string;
  stoppedAt?: string;
}

export type PreviewStatus =
  | 'queued'
  | 'building'
  | 'running'
  | 'error'
  | 'stopped';

export interface BuildLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source?: string;
}

export interface PreviewFile {
  path: string;
  content: string;
  type: 'source' | 'config' | 'asset';
  size: number;
  updatedAt: string;
}

export interface PreviewMetrics {
  sessionId: string;
  uptimeSeconds: number;
  requestCount: number;
  errorCount: number;
  memoryUsageMb: number;
  lastActivity: string;
}
