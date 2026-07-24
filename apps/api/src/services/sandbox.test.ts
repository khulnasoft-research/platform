import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sandboxManager } from './sandbox-manager.js';
import { ProcessBackend } from './sandbox/process-backend.js';
import type { SandboxConfig } from './sandbox/types.js';

const testFile = {
  path: 'hello.js',
  content: 'console.log("hello from sandbox"); process.exit(0);',
};

const baseConfig: Partial<SandboxConfig> = {
  backend: 'process',
  memoryLimitMb: 128,
  timeoutMs: 10000,
};

describe('SandboxManager', () => {
  afterAll(async () => {
    await sandboxManager.shutdown();
  });

  it('executes a simple command and returns stdout', async () => {
    const result = await sandboxManager.execute({
      command: 'echo',
      args: ['hello sandbox'],
      workingDirectory: '/tmp',
      files: [],
      config: baseConfig,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello sandbox');
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('captures stderr', async () => {
    const result = await sandboxManager.execute({
      command: 'node',
      args: ['-e', 'console.error("error output")'],
      workingDirectory: '/tmp',
      files: [],
      config: baseConfig,
    });

    expect(result.stderr.trim()).toBe('error output');
  });

  it('executes files in the sandbox workspace', async () => {
    const result = await sandboxManager.execute({
      command: 'node',
      args: ['hello.js'],
      workingDirectory: '/workspace',
      files: [testFile],
      config: baseConfig,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello from sandbox');
  });

  it('returns non-zero exit code on failure', async () => {
    const result = await sandboxManager.execute({
      command: 'node',
      args: ['-e', 'process.exit(42)'],
      workingDirectory: '/tmp',
      files: [],
      config: baseConfig,
    });

    expect(result.exitCode).toBe(42);
  });

  it('respects timeout limits', async () => {
    const result = await sandboxManager.execute({
      command: 'node',
      args: ['-e', 'setTimeout(() => {}, 60000)'],
      workingDirectory: '/tmp',
      files: [],
      config: { ...baseConfig, timeoutMs: 500 },
    });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  it('tracks execution metrics', async () => {
    const before = sandboxManager.getMetrics();

    await sandboxManager.execute({
      command: 'echo',
      args: ['metric test'],
      workingDirectory: '/tmp',
      files: [],
      config: baseConfig,
    });

    const after = sandboxManager.getMetrics();
    expect(after.totalExecutions).toBe(before.totalExecutions + 1);
    expect(after.averageDurationMs).toBeGreaterThan(0);
  });

  it('reports backend health status', async () => {
    const health = await sandboxManager.checkHealth();
    expect(health.process).toBeDefined();
    expect(health.docker).toBeDefined();
    expect(health.nsjail).toBeDefined();
  });

  it('streams logs during execution', async () => {
    const logs: string[] = [];
    for await (const event of sandboxManager.stream({
      command: 'echo',
      args: ['streaming test'],
      workingDirectory: '/tmp',
      files: [],
      config: baseConfig,
    })) {
      logs.push(`${event.stream}: ${event.message}`);
    }

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes('streaming test'))).toBe(true);
  });
});

describe('ProcessBackend', () => {
  let backend: ProcessBackend;

  beforeAll(() => {
    backend = new ProcessBackend();
  });

  afterAll(async () => {
    await backend.cleanup();
  });

  it('handles commands with no output', async () => {
    const result = await backend.execute({
      command: 'true',
      args: [],
      workingDirectory: '/tmp',
      files: [],
      config: { backend: 'process', memoryLimitMb: 128, cpuLimit: 1, diskLimitMb: 256, timeoutMs: 5000, networkAccess: false, writableDirectories: ['/tmp'], environmentVariables: {}, tmpfsSizeMb: 64 },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('handles missing commands gracefully', async () => {
    const result = await backend.execute({
      command: 'nonexistent-command-12345',
      args: [],
      workingDirectory: '/tmp',
      files: [],
      config: { backend: 'process', memoryLimitMb: 128, cpuLimit: 1, diskLimitMb: 256, timeoutMs: 5000, networkAccess: false, writableDirectories: ['/tmp'], environmentVariables: {}, tmpfsSizeMb: 64 },
    });
    expect(result.exitCode).toBe(1);
  });
});
