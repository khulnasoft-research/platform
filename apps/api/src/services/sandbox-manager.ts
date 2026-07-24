import type {
  SandboxBackend,
  SandboxBackendType,
  SandboxConfig,
  SandboxExecutionRequest,
  SandboxResult,
  SandboxLogEvent,
  SandboxMetrics,
} from './sandbox/types.js';
import { DEFAULT_SANDBOX_CONFIG } from './sandbox/types.js';
import { ProcessBackend } from './sandbox/process-backend.js';
import { DockerBackend } from './sandbox/docker-backend.js';
import { NsjailBackend } from './sandbox/nsjail-backend.js';

class SandboxManager {
  private backends = new Map<SandboxBackendType, SandboxBackend>();
  private executions = 0;
  private failures = 0;
  private totalDurationMs = 0;
  private peakMemoryMb = 0;
  private activeCount = 0;

  constructor() {
    this.backends.set('process', new ProcessBackend());
    this.backends.set('docker', new DockerBackend());
    this.backends.set('nsjail', new NsjailBackend());
  }

  setBackend(type: SandboxBackendType, backend: SandboxBackend): void {
    this.backends.set(type, backend);
  }

  getBackend(type?: SandboxBackendType): SandboxBackend {
    const key = type ?? this.detectBestBackend();
    const backend = this.backends.get(key);
    if (!backend) throw new Error(`Sandbox backend not available: ${key}`);
    return backend;
  }

  async execute(
    req: Omit<SandboxExecutionRequest, 'config'> & { config?: Partial<SandboxConfig> },
  ): Promise<SandboxResult> {
    const fullReq: SandboxExecutionRequest = {
      ...req,
      config: { ...DEFAULT_SANDBOX_CONFIG, ...req.config },
    };

    const backend = this.getBackend(fullReq.config.backend);
    this.activeCount++;
    this.executions++;

    try {
      const result = await backend.execute(fullReq);
      this.totalDurationMs += result.durationMs;
      if (result.exitCode !== 0) this.failures++;
      if (result.peakMemoryMb > this.peakMemoryMb) this.peakMemoryMb = result.peakMemoryMb;
      return result;
    } catch (err) {
      this.failures++;
      throw err;
    } finally {
      this.activeCount--;
    }
  }

  async *stream(
    req: Omit<SandboxExecutionRequest, 'config'> & { config?: Partial<SandboxConfig> },
  ): AsyncGenerator<SandboxLogEvent> {
    const fullReq: SandboxExecutionRequest = {
      ...req,
      config: { ...DEFAULT_SANDBOX_CONFIG, ...req.config },
    };

    const backend = this.getBackend(fullReq.config.backend);
    yield* backend.streamLogs(fullReq);
  }

  async checkHealth(): Promise<Record<SandboxBackendType, { healthy: boolean; message: string }>> {
    const results: Record<string, { healthy: boolean; message: string }> = {};
    for (const [type, backend] of this.backends) {
      results[type] = await backend.health();
    }
    return results as Record<SandboxBackendType, { healthy: boolean; message: string }>;
  }

  async shutdown(): Promise<void> {
    for (const backend of this.backends.values()) {
      await backend.cleanup();
    }
  }

  getMetrics(): SandboxMetrics {
    return {
      activeExecutions: this.activeCount,
      totalExecutions: this.executions,
      failedExecutions: this.failures,
      averageDurationMs: this.executions > 0 ? Math.round(this.totalDurationMs / this.executions) : 0,
      peakMemoryUsedMb: this.peakMemoryMb,
    };
  }

  private detectBestBackend(): SandboxBackendType {
    return 'process';
  }
}

export const sandboxManager = new SandboxManager();
