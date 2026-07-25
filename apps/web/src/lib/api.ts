export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || res.statusText, body.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  auth: {
    register: (body: { email: string; password: string; name: string }) =>
      request<{ token: string; user: { id: string; email: string; name: string } }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(body) },
      ),

    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: { id: string; email: string; name: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(body) },
      ),

    session: () => request<{ valid: boolean; userId: string; email: string; organizationId: string }>('/auth/session'),
  },

  projects: {
    list: (organizationId: string) =>
      request<{ projects: unknown[] }>(
        `/projects?organization_id=${organizationId}`,
      ),

    create: (body: { name: string; description?: string; organizationId: string }) =>
      request<{ id: string; name: string; description: string | null }>(
        '/projects',
        { method: 'POST', body: JSON.stringify(body) },
      ),

    get: (id: string) => request<{ id: string; name: string }>(`/projects/${id}`),

    update: (id: string, body: { name?: string; description?: string }) =>
      request<{ id: string; name: string }>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),

    delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  },

  ai: {
    chat: (body: unknown) =>
      request<{ requestId: string; content: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify(Object.assign({ stream: false }, body)),
      }),

    models: () => request<{ models: unknown[] }>('/ai/models'),
  },

  agents: {
    list: () => request<{ agents: unknown[] }>('/agents'),

    tools: () => request<{ tools: unknown[] }>('/agents/tools'),
  },

  tasks: {
    list: (projectId?: string) =>
      request<{ tasks: unknown[] }>(
        `/agents/tasks${projectId ? `?project_id=${projectId}` : ''}`,
      ),

    create: (body: {
      projectId: string;
      goal: string;
      assignee: string;
      priority?: string;
      approvalGates?: string[];
    }) =>
      request<{ id: string; status: string; goal: string; assignee: string }>(
        '/agents/tasks',
        { method: 'POST', body: JSON.stringify(body) },
      ),

    get: (id: string) =>
      request<{ id: string; status: string; goal: string; assignee: string; plan: unknown; result: unknown; approvalGates: unknown[]; createdAt: string }>(
        `/agents/tasks/${id}`,
      ),

    cancel: (id: string) =>
      request<{ id: string; status: string }>(`/agents/tasks/${id}/cancel`, {
        method: 'POST',
      }),

    createPlan: (id: string) =>
      request<{ steps: unknown[]; estimatedTokens: number; estimatedCostUsd: number; tools: string[] }>(
        `/agents/tasks/${id}/plan`,
        { method: 'POST' },
      ),

    approveGate: (taskId: string, gateId: string, approved: boolean, notes?: string) =>
      request<unknown>(`/agents/tasks/${taskId}/approve/${gateId}`, {
        method: 'POST',
        body: JSON.stringify({ approved, notes }),
      }),
  },

  blueprints: {
    list: (projectId: string) =>
      request<{ snapshots: unknown[] }>(`/blueprints?project_id=${projectId}`),

    create: (body: {
      projectId: string;
      commitSha: string;
      branch: string;
      nodes: unknown[];
      edges: unknown[];
      metadata: unknown;
    }) =>
      request<{ id: string; projectId: string; commitSha: string; branch: string; nodes: unknown[]; edges: unknown[]; metadata: unknown; createdAt: string }>(
        '/blueprints',
        { method: 'POST', body: JSON.stringify(body) },
      ),

    get: (id: string) =>
      request<{ id: string; projectId: string; commitSha: string; branch: string; nodes: unknown[]; edges: unknown[]; metadata: unknown; createdAt: string }>(
        `/blueprints/${id}`,
      ),

    delete: (id: string) => request<void>(`/blueprints/${id}`, { method: 'DELETE' }),

    analyze: (id: string) =>
      request<{ pattern: string; description: string; recommendations: string[] }>(
        `/blueprints/${id}/analyze`,
        { method: 'POST' },
      ),

    drift: (currentId: string, baselineId: string) =>
      request<{ findings: unknown[] }>(
        `/blueprints/${currentId}/drift?baseline_id=${baselineId}`,
      ),

    impact: (snapshotId: string, targetNodeId: string, change: string) =>
      request<{ target: string; change: string; directImpact: string[]; indirectImpact: string[]; risk: string }>(
        `/blueprints/${snapshotId}/impact?targetNodeId=${targetNodeId}`,
        { method: 'POST', body: JSON.stringify({ change }) },
      ),
  },

  deploy: {
    providers: () =>
      request<{ providers: unknown[] }>('/deploy/providers'),

    environments: {
      list: (projectId: string) =>
        request<{ environments: unknown[] }>(`/deploy/environments?project_id=${projectId}`),

      create: (body: {
        projectId: string;
        name: string;
        type: string;
        provider: string;
        region?: string;
      }) =>
        request<{ id: string; name: string; type: string; provider: string; status: string }>(
          '/deploy/environments',
          { method: 'POST', body: JSON.stringify(body) },
        ),

      get: (id: string) =>
        request<{ id: string; name: string; type: string; provider: string; status: string; envVars: string[] }>(
          `/deploy/environments/${id}`,
        ),

      delete: (id: string) => request<void>(`/deploy/environments/${id}`, { method: 'DELETE' }),

      setEnvVars: (id: string, envVars: string[]) =>
        request<{ id: string; envVars: string[] }>(`/deploy/environments/${id}/env-vars`, {
          method: 'POST',
          body: JSON.stringify({ envVars }),
        }),

      removeEnvVars: (id: string, keys: string[]) =>
        request<{ id: string; envVars: string[] }>(`/deploy/environments/${id}/env-vars`, {
          method: 'DELETE',
          body: JSON.stringify({ keys }),
        }),
    },

    deployments: {
      list: (projectId?: string, environmentId?: string) => {
        const params = new URLSearchParams();
        if (projectId) params.set('project_id', projectId);
        if (environmentId) params.set('environment_id', environmentId);
        return request<{ deployments: unknown[] }>(`/deploy?${params}`);
      },

      create: (body: {
        projectId: string;
        environmentId: string;
        commitSha: string;
        provider: string;
      }) =>
        request<{ id: string; status: string; commitSha: string; provider: string }>(
          '/deploy',
          { method: 'POST', body: JSON.stringify(body) },
        ),

      get: (id: string) =>
        request<{ id: string; status: string; commitSha: string; provider: string; environmentId: string; logs: unknown[] }>(
          `/deploy/${id}`,
        ),

      rollback: (id: string) =>
        request<{ id: string; status: string }>(`/deploy/${id}/rollback`, { method: 'POST' }),

      logs: (id: string) =>
        request<{ logs: unknown[] }>(`/deploy/${id}/logs`),

      artifact: (id: string) =>
        request<{ id: string; type: string; url: string; size: number }>(`/deploy/${id}/artifact`),
    },

    stats: () => request<{ totalDeployments: number; activeEnvironments: number; successRate: number; averageDurationMs: number }>('/deploy/stats/overview'),
  },

  preview: {
    list: (projectId?: string) => {
      const params = projectId ? `?project_id=${projectId}` : '';
      return request<{ previews: unknown[] }>(`/previews${params}`);
    },

    create: (body: {
      projectId: string;
      taskId: string;
      framework?: string;
      files?: Array<{ path: string; content: string; type: string; size: number; updatedAt: string }>;
    }) =>
      request<{ id: string; status: string; url: string; framework: string }>(
        '/previews',
        { method: 'POST', body: JSON.stringify(body) },
      ),

    get: (id: string) =>
      request<{
        id: string;
        projectId: string;
        status: string;
        url: string;
        framework: string;
        buildLogs: unknown[];
        files: unknown[];
        createdAt: string;
      }>(`/previews/${id}`),

    stop: (id: string) =>
      request<{ id: string; status: string }>(`/previews/${id}/stop`, { method: 'POST' }),

    logs: (id: string, since?: string) => {
      const params = since ? `?since=${since}` : '';
      return request<{ logs: unknown[] }>(`/previews/${id}/logs${params}`);
    },

    updateFiles: (id: string, files: Array<{ path: string; content: string; type: string; size: number; updatedAt: string }>) =>
      request<{ id: string; files: unknown[] }>(`/previews/${id}/files`, {
        method: 'PATCH',
        body: JSON.stringify({ files }),
      }),

    metrics: (id: string) =>
      request<{
        id: string;
        cpuUsage: number;
        memoryUsageMb: number;
        requestCount: number;
        averageResponseTimeMs: number;
        uptimeSeconds: number;
      }>(`/previews/${id}/metrics`),
  },
};
