import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  SandboxBackend,
  SandboxExecutionRequest,
  SandboxResult,
  SandboxLogEvent,
  SandboxBackendType,
} from './types.js';

export class ProcessBackend implements SandboxBackend {
  readonly type: SandboxBackendType = 'process';
  private activeExecutions = new Map<string, AbortController>();
  private tempDirs = new Set<string>();

  async execute(req: SandboxExecutionRequest): Promise<SandboxResult> {
    const workDir = this.prepareWorkspace(req);
    const startTime = performance.now();
    const controller = new AbortController();
    const executionId = crypto.randomUUID();

    this.activeExecutions.set(executionId, controller);
    const timeout = setTimeout(() => controller.abort(), req.config.timeoutMs ?? 60000);

    try {
      const child = spawn(req.command, req.args, {
        cwd: workDir,
        signal: controller.signal,
        env: { ...process.env, ...req.config.environmentVariables },
        stdio: ['pipe', 'pipe', 'pipe'],
      }) as any;

      let stdout = '';
      let stderr = '';
      let peakMemoryMb = 0;

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', (code: number | null) => resolve(code ?? 1));
        child.on('error', (_err: Error) => resolve(1));
      });

      if (process.platform === 'linux') {
        try {
          const status = execSync(`cat /proc/${child.pid}/status 2>/dev/null || echo ""`, { timeout: 2000 }).toString();
          const match = status.match(/VmPeak:\s+(\d+)/);
          if (match) peakMemoryMb = Math.round(parseInt(match[1]!) / 1024);
        } catch {}
      }

      return {
        exitCode,
        stdout,
        stderr,
        durationMs: Math.round(performance.now() - startTime),
        peakMemoryMb,
        timedOut: child.killed,
        oomKilled: stderr.includes('Killed') || stderr.includes('Out of memory'),
      };
    } finally {
      clearTimeout(timeout);
      this.activeExecutions.delete(executionId);
      this.cleanupWorkspace(workDir);
    }
  }

  async *streamLogs(req: SandboxExecutionRequest): AsyncGenerator<SandboxLogEvent> {
    const workDir = this.prepareWorkspace(req);
    const controller = new AbortController();
    const executionId = crypto.randomUUID();
    this.activeExecutions.set(executionId, controller);

    const events: SandboxLogEvent[] = [];

    try {
      const child = spawn(req.command, req.args, {
        cwd: workDir,
        signal: controller.signal,
        env: { ...process.env, ...req.config.environmentVariables },
        stdio: ['pipe', 'pipe', 'pipe'],
      }) as any;

      events.push({ timestamp: new Date().toISOString(), stream: 'system', message: `[pid ${child.pid}] ${req.command} ${req.args.join(' ')}` });

      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdoutBuf += data.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop() ?? '';
        for (const line of lines) {
          if (line) events.push({ timestamp: new Date().toISOString(), stream: 'stdout', message: line });
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderrBuf += data.toString();
        const lines = stderrBuf.split('\n');
        stderrBuf = lines.pop() ?? '';
        for (const line of lines) {
          if (line) events.push({ timestamp: new Date().toISOString(), stream: 'stderr', message: line });
        }
      });

      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', (code: number | null) => resolve(code ?? 1));
        child.on('error', (_err: Error) => resolve(1));
      });

      if (stdoutBuf) events.push({ timestamp: new Date().toISOString(), stream: 'stdout', message: stdoutBuf });
      if (stderrBuf) events.push({ timestamp: new Date().toISOString(), stream: 'stderr', message: stderrBuf });
      events.push({ timestamp: new Date().toISOString(), stream: 'system', message: `Process exited with code ${exitCode}` });
    } finally {
      for (const event of events) yield event;
      this.activeExecutions.delete(executionId);
      this.cleanupWorkspace(workDir);
    }
  }

  async health(): Promise<{ healthy: boolean; message: string }> {
    try {
      execSync('echo ok', { timeout: 5000, stdio: 'pipe' });
      return { healthy: true, message: 'Process backend ready' };
    } catch (err) {
      return { healthy: false, message: (err as Error).message };
    }
  }

  async cleanup(): Promise<void> {
    for (const controller of this.activeExecutions.values()) controller.abort();
    this.activeExecutions.clear();
    for (const dir of this.tempDirs) {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    this.tempDirs.clear();
  }

  private prepareWorkspace(req: SandboxExecutionRequest): string {
    const workDir = mkdtempSync(join(tmpdir(), 'sandbox-'));
    this.tempDirs.add(workDir);

    for (const file of req.files) {
      const fullPath = join(workDir, file.path);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, file.content);
      if (file.executable) chmodSync(fullPath, '755');
    }

    return workDir;
  }

  private cleanupWorkspace(workDir: string): void {
    try { rmSync(workDir, { recursive: true, force: true }); this.tempDirs.delete(workDir); } catch {}
  }
}
