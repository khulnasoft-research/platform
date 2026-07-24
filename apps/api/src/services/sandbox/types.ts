export type SandboxBackendType = 'nsjail' | 'docker' | 'process';

export interface SandboxConfig {
  backend: SandboxBackendType;
  memoryLimitMb: number;
  cpuLimit: number;
  diskLimitMb: number;
  timeoutMs: number;
  networkAccess: boolean;
  writableDirectories: string[];
  environmentVariables: Record<string, string>;
  tmpfsSizeMb: number;
}

export interface SandboxExecutionRequest {
  command: string;
  args: string[];
  workingDirectory: string;
  files: SandboxFile[];
  config: Partial<SandboxConfig>;
}

export interface SandboxFile {
  path: string;
  content: string;
  executable?: boolean;
}

export interface SandboxResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  peakMemoryMb: number;
  timedOut: boolean;
  oomKilled: boolean;
}

export interface SandboxBackend {
  readonly type: SandboxBackendType;
  execute(req: SandboxExecutionRequest): Promise<SandboxResult>;
  streamLogs(req: SandboxExecutionRequest): AsyncGenerator<SandboxLogEvent>;
  health(): Promise<{ healthy: boolean; message: string }>;
  cleanup(): Promise<void>;
}

export interface SandboxLogEvent {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

export interface SandboxMetrics {
  activeExecutions: number;
  totalExecutions: number;
  failedExecutions: number;
  averageDurationMs: number;
  peakMemoryUsedMb: number;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  backend: 'process',
  memoryLimitMb: 512,
  cpuLimit: 1,
  diskLimitMb: 1024,
  timeoutMs: 60000,
  networkAccess: false,
  writableDirectories: ['/tmp', '/home/user'],
  environmentVariables: { NODE_ENV: 'sandbox' },
  tmpfsSizeMb: 256,
};
