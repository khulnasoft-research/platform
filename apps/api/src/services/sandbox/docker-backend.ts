import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  SandboxBackend,
  SandboxExecutionRequest,
  SandboxResult,
  SandboxLogEvent,
  SandboxBackendType,
} from './types.js';

const DEFAULT_IMAGE = 'node:22-alpine';

export class DockerBackend implements SandboxBackend {
  readonly type: SandboxBackendType = 'docker';
  private activeContainers = new Set<string>();

  async execute(req: SandboxExecutionRequest): Promise<SandboxResult> {
    const containerName = `sandbox-${crypto.randomUUID().slice(0, 8)}`;
    this.activeContainers.add(containerName);

    const workDir = this.prepareContext(req);
    const startTime = performance.now();

    try {
      const memoryLimit = `${req.config.memoryLimitMb ?? 512}m`;
      const timeout = req.config.timeoutMs ?? 60000;

      const args = [
        'run', '--rm',
        '--name', containerName,
        `--memory=${memoryLimit}`,
        `--cpus=${req.config.cpuLimit ?? 1}`,
        '--network', req.config.networkAccess ? 'bridge' : 'none',
        '--read-only',
        '--tmpfs', `/tmp:size=${req.config.tmpfsSizeMb ?? 256}m`,
        '--tmpfs', `/home/user:size=${req.config.tmpfsSizeMb ?? 256}m`,
        '-v', `${workDir}:/workspace:ro`,
        '-w', '/workspace',
        DEFAULT_IMAGE,
        req.command, ...req.args,
      ];

      let stdout = '';
      let stderr = '';

      try {
        const output = execSync(`timeout ${Math.ceil(timeout / 1000)} docker ${args.join(' ')}`, {
          cwd: workDir,
          timeout: timeout + 10000,
          stdio: 'pipe',
        });
        stdout = output.toString();
      } catch (err) {
        const error = err as { stdout?: Buffer; stderr?: Buffer };
        stdout = error.stdout?.toString() ?? '';
        stderr = error.stderr?.toString() ?? '';
      }

      const durationMs = Math.round(performance.now() - startTime);
      const timedOut = durationMs >= timeout;

      return {
        exitCode: stderr ? 1 : 0,
        stdout,
        stderr,
        durationMs,
        peakMemoryMb: req.config.memoryLimitMb ?? 512,
        timedOut,
        oomKilled: stderr.includes('Killed') || stderr.toLowerCase().includes('oom'),
      };
    } finally {
      this.activeContainers.delete(containerName);
      this.cleanupContext(workDir);
    }
  }

  async *streamLogs(req: SandboxExecutionRequest): AsyncGenerator<SandboxLogEvent> {
    const containerName = `sandbox-${crypto.randomUUID().slice(0, 8)}`;
    this.activeContainers.add(containerName);
    const workDir = this.prepareContext(req);
    const events: SandboxLogEvent[] = [];

    try {
      // biome-ignore lint/suspicious/noExplicitAny: spawn result needs dynamic access
      const child: any = spawn('docker', [
        'run', '--rm',
        '--name', containerName,
        `--memory=${req.config.memoryLimitMb ?? 512}m`,
        `--cpus=${req.config.cpuLimit ?? 1}`,
        '--network', 'none',
        '--read-only',
        '--tmpfs', `/tmp:size=${req.config.tmpfsSizeMb ?? 256}m`,
        '-v', `${workDir}:/workspace:ro`,
        '-w', '/workspace',
        DEFAULT_IMAGE,
        req.command, ...req.args,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      events.push({ timestamp: new Date().toISOString(), stream: 'system', message: `Container ${containerName} started` });

      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdoutBuf += data.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop() ?? '';
        for (const line of lines) if (line) events.push({ timestamp: new Date().toISOString(), stream: 'stdout', message: line });
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderrBuf += data.toString();
        const lines = stderrBuf.split('\n');
        stderrBuf = lines.pop() ?? '';
        for (const line of lines) if (line) events.push({ timestamp: new Date().toISOString(), stream: 'stderr', message: line });
      });

      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', (code: number | null) => resolve(code ?? 1));
        child.on('error', (_err: Error) => resolve(1));
      });

      if (stdoutBuf) events.push({ timestamp: new Date().toISOString(), stream: 'stdout', message: stdoutBuf });
      if (stderrBuf) events.push({ timestamp: new Date().toISOString(), stream: 'stderr', message: stderrBuf });
      events.push({ timestamp: new Date().toISOString(), stream: 'system', message: `Container exited with code ${exitCode}` });
    } finally {
      for (const event of events) yield event;
      this.activeContainers.delete(containerName);
      this.cleanupContext(workDir);
    }
  }

  async health(): Promise<{ healthy: boolean; message: string }> {
    try {
      const version = execSync('docker --version', { timeout: 5000, stdio: 'pipe' }).toString().trim();
      execSync(`docker image inspect ${DEFAULT_IMAGE} > /dev/null 2>&1 || docker pull ${DEFAULT_IMAGE}`, { timeout: 30000, stdio: 'pipe' });
      return { healthy: true, message: `Docker backend ready (${version})` };
    } catch (err) {
      return { healthy: false, message: (err as Error).message };
    }
  }

  async cleanup(): Promise<void> {
    for (const name of this.activeContainers) {
      try { execSync(`docker rm -f ${name} 2>/dev/null`, { timeout: 5000 }); } catch {}
    }
    this.activeContainers.clear();
  }

  private prepareContext(req: SandboxExecutionRequest): string {
    const workDir = mkdtempSync(join(tmpdir(), 'docker-sandbox-'));
    for (const file of req.files) {
      const fullPath = join(workDir, file.path);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, file.content);
    }
    return workDir;
  }

  private cleanupContext(workDir: string): void {
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}
