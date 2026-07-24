import { execSync, spawn } from 'node:child_process';
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

export class NsjailBackend implements SandboxBackend {
  readonly type: SandboxBackendType = 'nsjail';
  private activePids = new Set<number>();

  async execute(req: SandboxExecutionRequest): Promise<SandboxResult> {
    const workDir = this.prepareWorkspace(req);
    const startTime = performance.now();

    try {
      const cfgPath = this.writeConfig(req, workDir);
      const child: any = spawn('nsjail', [
        '--config', cfgPath,
        '--chroot', '/',
        '--bindmount', `${workDir}:/workspace:ro`,
        '--cwd', '/workspace',
        '--', req.command, ...req.args,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      if (child.pid) this.activePids.add(child.pid as number);
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, req.config.timeoutMs ?? 60000);

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', (code: number | null) => resolve(code ?? 1));
        child.on('error', (_err: Error) => resolve(1));
      });

      clearTimeout(timer);
      return {
        exitCode,
        stdout,
        stderr,
        durationMs: Math.round(performance.now() - startTime),
        peakMemoryMb: req.config.memoryLimitMb ?? 512,
        timedOut,
        oomKilled: stderr.includes('Killed') || stderr.includes('out of memory'),
      };
    } finally {
      this.activePids.clear();
      this.cleanupWorkspace(workDir);
    }
  }

  async *streamLogs(req: SandboxExecutionRequest): AsyncGenerator<SandboxLogEvent> {
    const workDir = this.prepareWorkspace(req);
    const events: SandboxLogEvent[] = [];

    try {
      const child: any = spawn('nsjail', [
        '--chroot', '/',
        '--bindmount', `${workDir}:/workspace:ro`,
        '--cwd', '/workspace',
        '--', req.command, ...req.args,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      if (child.pid) this.activePids.add(child.pid as number);
      events.push({ timestamp: new Date().toISOString(), stream: 'system', message: `nsjail started: ${req.command}` });

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
      events.push({ timestamp: new Date().toISOString(), stream: 'system', message: `nsjail exited with code ${exitCode}` });
    } finally {
      for (const event of events) yield event;
      this.activePids.clear();
      this.cleanupWorkspace(workDir);
    }
  }

  async health(): Promise<{ healthy: boolean; message: string }> {
    try {
      const version = execSync('nsjail --version 2>/dev/null || echo "not found"', { timeout: 5000, stdio: 'pipe' }).toString().trim();
      if (version === 'not found') return { healthy: false, message: 'nsjail not installed' };
      return { healthy: true, message: `nsjail ready: ${version}` };
    } catch (err) {
      return { healthy: false, message: (err as Error).message };
    }
  }

  async cleanup(): Promise<void> {
    for (const pid of this.activePids) {
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
    this.activePids.clear();
  }

  private prepareWorkspace(req: SandboxExecutionRequest): string {
    const workDir = mkdtempSync(join(tmpdir(), 'nsjail-'));
    for (const file of req.files) {
      const fullPath = join(workDir, file.path);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, file.content);
      if (file.executable) chmodSync(fullPath, '755');
    }
    return workDir;
  }

  private writeConfig(req: SandboxExecutionRequest, workDir: string): string {
    const cfg = [
      `name: "sandbox-${crypto.randomUUID().slice(0, 8)}"`,
      `time: ${req.config.timeoutMs ?? 60000}`,
      `cpus: ${req.config.cpuLimit ?? 1}`,
      `max_cpus: ${req.config.cpuLimit ?? 1}`,
      `rl:\n  rlimit_as: ${(req.config.memoryLimitMb ?? 512) * 1024 * 1024}`,
      '  rlimit_nproc: 100',
      '  rlimit_nofile: 50',
      `  rlimit_fsize: ${(req.config.diskLimitMb ?? 1024) * 1024}`,
      'is_root: false',
      'hostname: "sandbox"',
      'seccomp_string: "POLICY_NAME: default"',
      ...(req.config.networkAccess ? [] : ['iface: "none"']),
    ].join('\n');

    const cfgPath = join(workDir, 'nsjail.cfg');
    writeFileSync(cfgPath, cfg);
    return cfgPath;
  }

  private cleanupWorkspace(workDir: string): void {
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}
