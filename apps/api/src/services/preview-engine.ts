import type {
  PreviewSession,
  BuildLogEntry,
  PreviewFile,
  PreviewMetrics,
} from '@platform/shared-types';
import { sandboxManager } from './sandbox-manager.js';
import type { SandboxConfig } from './sandbox/types.js';

const sessions = new Map<string, PreviewSession>();

function generateId(): string {
  return crypto.randomUUID();
}

const FRAMEWORK_BUILD_COMMANDS: Record<string, { command: string; args: string[]; install: string[] }> = {
  nextjs: {
    command: 'npx',
    args: ['next', 'build'],
    install: ['npm', 'install'],
  },
  vite: {
    command: 'npx',
    args: ['vite', 'build'],
    install: ['npm', 'install'],
  },
  astro: {
    command: 'npx',
    args: ['astro', 'build'],
    install: ['npm', 'install'],
  },
  express: {
    command: 'npm',
    args: ['run', 'build'],
    install: ['npm', 'install'],
  },
  static: {
    command: 'cp',
    args: ['-r', '.', '/output'],
    install: [],
  },
};

const FRAMEWORK_PORTS: Record<string, number> = {
  nextjs: 3000,
  vite: 5173,
  astro: 4321,
  express: 4000,
  static: 8080,
};

class PreviewEngine {
  private buildTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private useSandbox = false;

  setUseSandbox(value: boolean): void {
    this.useSandbox = value;
  }

  createSession(params: {
    projectId: string;
    taskId: string;
    framework: string;
    files: PreviewFile[];
  }): PreviewSession {
    const id = generateId();
    const framework = params.framework || 'nextjs';

    const session: PreviewSession = {
      id,
      projectId: params.projectId,
      taskId: params.taskId,
      status: 'queued',
      url: `https://${id}.preview.ai-platform.dev`,
      framework,
      buildLogs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Preview session created for ${framework} project`,
          source: 'system',
        },
      ],
      files: params.files,
      createdAt: new Date().toISOString(),
    };

    sessions.set(id, session);

    if (this.useSandbox && sandboxManager) {
      this.startSandboxBuild(session);
    } else {
      this.simulateBuild(session.id);
    }

    return session;
  }

  private simulateBuild(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (!session) return;

    session.status = 'building';
    this.addLog(sessionId, 'info', `Installing dependencies...`, 'build');
    this.addLog(sessionId, 'info', `Using ${session.framework} framework`, 'build');

    const steps = [
      { delay: 500, msg: 'Resolved dependencies from package.json', level: 'info' as const },
      { delay: 1000, msg: `Detected ${session.framework} configuration`, level: 'info' as const },
      { delay: 1500, msg: `Running ${session.framework} build...`, level: 'info' as const },
      { delay: 2500, msg: `Build complete (${Math.floor(Math.random() * 50) + 10} modules)`, level: 'info' as const },
      { delay: 3000, msg: `Preview server starting on port ${FRAMEWORK_PORTS[session.framework] ?? 3000}`, level: 'info' as const },
    ];

    for (const step of steps) {
      const timer = setTimeout(() => {
        this.addLog(sessionId, step.level, step.msg, 'build');
      }, step.delay);
      this.buildTimers.set(`${sessionId}:${step.delay}`, timer);
    }

    const finalTimer = setTimeout(() => {
      const s = sessions.get(sessionId);
      if (s && s.status === 'building') {
        s.status = 'running';
        this.addLog(sessionId, 'info', `Preview ready at ${s.url}`, 'system');

        const randomIssue = Math.random();
        if (randomIssue < 0.3) {
          this.addLog(
            sessionId,
            randomIssue < 0.15 ? 'warn' : 'error',
            randomIssue < 0.15
              ? 'Deprecated API usage detected in src/components/Layout.tsx'
              : 'Module not found: ./styles/global.css',
            'build',
          );
        }
      }
      this.buildTimers.delete(`${sessionId}:final`);
    }, 3500);
    this.buildTimers.set(`${sessionId}:final`, finalTimer);
  }

  private async startSandboxBuild(session: PreviewSession): Promise<void> {
    const buildCfg = FRAMEWORK_BUILD_COMMANDS[session.framework] ?? FRAMEWORK_BUILD_COMMANDS.nextjs!;

    session.status = 'building';
    this.addLog(session.id, 'info', `Starting sandboxed build for ${session.framework}`, 'system');

    const sandboxConfig: Partial<SandboxConfig> = {
      backend: 'process',
      memoryLimitMb: 512,
      timeoutMs: 120000,
      networkAccess: false,
    };

    const sandboxFiles = session.files.map((f) => ({
      path: f.path,
      content: f.content,
    }));

    try {
      if (buildCfg.install.length > 0) {
        const installResult = await sandboxManager.execute({
          command: buildCfg.install[0]!,
          args: buildCfg.install.slice(1),
          workingDirectory: '/workspace',
          files: sandboxFiles,
          config: sandboxConfig,
        });

        for (const line of installResult.stdout.split('\n').filter(Boolean)) {
          this.addLog(session.id, 'info', line, 'build');
        }

        if (installResult.exitCode !== 0) {
          session.status = 'error';
          this.addLog(session.id, 'error', `Install failed (exit ${installResult.exitCode})`, 'build');
          return;
        }

        this.addLog(session.id, 'info', `Dependencies installed (${installResult.durationMs}ms)`, 'build');
      }

      const buildResult = await sandboxManager.execute({
        command: buildCfg.command,
        args: buildCfg.args,
        workingDirectory: '/workspace',
        files: sandboxFiles,
        config: { ...sandboxConfig, timeoutMs: 180000 },
      });

      for (const line of buildResult.stdout.split('\n').filter(Boolean)) {
        this.addLog(session.id, 'info', line, 'build');
      }
      for (const line of buildResult.stderr.split('\n').filter(Boolean)) {
        this.addLog(session.id, buildResult.exitCode === 0 ? 'warn' : 'error', line, 'build');
      }

      if (buildResult.exitCode === 0) {
        session.status = 'running';
        this.addLog(session.id, 'info', `Build succeeded (${buildResult.durationMs}ms, peak ${buildResult.peakMemoryMb}MB)`, 'system');
        this.addLog(session.id, 'info', `Preview ready at ${session.url}`, 'system');
      } else {
        session.status = 'error';
        this.addLog(session.id, 'error', `Build failed (exit ${buildResult.exitCode})`, 'build');
      }
    } catch (err) {
      session.status = 'error';
      this.addLog(session.id, 'error', `Sandbox error: ${(err as Error).message}`, 'system');
    }
  }

  private addLog(
    sessionId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    source?: string,
  ): void {
    const session = sessions.get(sessionId);
    if (!session) return;

    session.buildLogs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
    });
  }

  getSession(id: string): PreviewSession | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;
    return JSON.parse(JSON.stringify(session));
  }

  listSessions(projectId?: string): PreviewSession[] {
    const all = Array.from(sessions.values());
    const filtered = projectId
      ? all.filter((s) => s.projectId === projectId)
      : all;
    return filtered.map((s) => JSON.parse(JSON.stringify(s)));
  }

  stopSession(id: string): PreviewSession | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;

    const timersToClear = Array.from(this.buildTimers.entries())
      .filter(([key]) => key.startsWith(`${id}:`));
    for (const [, timer] of timersToClear) clearTimeout(timer);

    session.status = 'stopped';
    session.stoppedAt = new Date().toISOString();
    this.addLog(id, 'info', 'Preview session stopped', 'system');

    return JSON.parse(JSON.stringify(session));
  }

  getLogs(id: string, since?: string): BuildLogEntry[] {
    const session = sessions.get(id);
    if (!session) return [];

    let logs = session.buildLogs;
    if (since) {
      const sinceTime = new Date(since).getTime();
      logs = logs.filter((l) => new Date(l.timestamp).getTime() > sinceTime);
    }

    return logs;
  }

  updateFiles(id: string, files: PreviewFile[]): PreviewSession | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;

    for (const file of files) {
      const existingIndex = session.files.findIndex((f) => f.path === file.path);
      if (existingIndex >= 0) {
        session.files[existingIndex] = file;
      } else {
        session.files.push(file);
      }

      this.addLog(
        id,
        'info',
        `File updated: ${file.path} (${file.size} bytes)`,
        'watcher',
      );
    }

    if (session.status === 'running') {
      this.addLog(id, 'info', 'Hot-reloading...', 'build');
      setTimeout(() => {
        this.addLog(id, 'info', 'Reload complete', 'build');
      }, 500);
    }

    return JSON.parse(JSON.stringify(session));
  }

  getMetrics(id: string): PreviewMetrics | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;

    return {
      sessionId: id,
      uptimeSeconds:
        session.status === 'running' && session.createdAt
          ? Math.floor(
              (Date.now() - new Date(session.createdAt).getTime()) / 1000,
            )
          : 0,
      requestCount: Math.floor(Math.random() * 100),
      errorCount: session.buildLogs.filter((l) => l.level === 'error').length,
      memoryUsageMb: Math.floor(Math.random() * 120) + 40,
      lastActivity:
        session.buildLogs[session.buildLogs.length - 1]?.timestamp ??
        session.createdAt,
    };
  }
}

export const previewEngine = new PreviewEngine();
