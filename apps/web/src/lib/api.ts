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

    session: () => request<{ valid: boolean }>('/auth/session'),
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
};
