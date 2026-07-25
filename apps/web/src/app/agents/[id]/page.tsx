'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { LoadingPage } from '@/lib/ui';

interface TaskStep {
  id: string;
  description: string;
  tool: string;
  args: Record<string, unknown>;
}

interface TaskPlan {
  steps: TaskStep[];
  estimatedTokens: number;
  estimatedCostUsd: number;
  tools: string[];
}

interface ApprovalGate {
  id: string;
  type: string;
  status: string;
  approvedBy?: string;
  notes?: string;
}

interface Artifact {
  path: string;
  content: string;
  type: string;
}

interface TaskDetail {
  id: string;
  goal: string;
  assignee: string;
  status: string;
  priority: string;
  plan: TaskPlan | null;
  result: { summary?: string; artifacts?: Artifact[]; durationMs?: number } | null;
  approvalGates: ApprovalGate[];
  createdAt: string;
}

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planning, setPlanning] = useState(false);
  const [showArtifact, setShowArtifact] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    try {
      const res = await api.tasks.get(params.id as string);
      setTask(res as TaskDetail);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('session_token');
        router.replace('/login');
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setError('Task not found');
      } else {
        setError('Failed to load task');
      }
    } finally {
      setLoading(false);
    }
  }, [router, params]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.replace('/login'); return; }
    loadTask();
  }, [router, loadTask]);

  async function handleCreatePlan() {
    setPlanning(true);
    try {
      await api.tasks.createPlan(params.id as string);
      const current = await api.tasks.get(params.id as string);
      setTask(current as TaskDetail);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to create plan');
    } finally {
      setPlanning(false);
    }
  }

  async function handleCancel() {
    try {
      await api.tasks.cancel(params.id as string);
      loadTask();
    } catch {
      setError('Failed to cancel task');
    }
  }

  async function handleApproveGate(gateId: string, approved: boolean) {
    try {
      await api.tasks.approveGate(params.id as string, gateId, approved);
      loadTask();
    } catch {
      setError('Failed to approve gate');
    }
  }

  const statusColors: Record<string, string> = {
    queued: '#f59e0b', planning: '#3b82f6', executing: '#8b5cf6',
    waiting: '#f97316', reviewing: '#06b6d4', completed: '#10b981',
    failed: '#ef4444', cancelled: '#64748b',
  };

  const gateColors: Record<string, string> = {
    pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', skipped: '#64748b',
  };

  if (loading) return <LoadingPage />;
  if (!task) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#ef4444', padding: '2rem' }}>{error || 'Task not found'}</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <a href="/agents" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>&larr; Back to Agents</a>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
        {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>{task.goal}</h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                {task.assignee} &middot; {task.priority} priority &middot; Created {new Date(task.createdAt).toLocaleString()}
              </p>
            </div>
            <span style={{ padding: '0.25rem 0.75rem', borderRadius: 6, fontSize: '0.875rem', background: statusColors[task.status] ?? '#64748b', color: '#fff', fontWeight: 600 }}>
              {task.status}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            {!task.plan && task.status === 'queued' && (
              <button type="button" onClick={handleCreatePlan} disabled={planning}
                style={{ padding: '0.5rem 1rem', background: planning ? '#64748b' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: planning ? 'not-allowed' : 'pointer' }}>
                {planning ? 'Planning...' : 'Create Plan'}
              </button>
            )}
            {(task.status === 'queued' || task.status === 'planning' || task.status === 'executing') && (
              <button type="button" onClick={handleCancel}
                style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                Cancel Task
              </button>
            )}
          </div>
        </div>

        {task.plan && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Plan</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Est. {task.plan.estimatedTokens} tokens (${task.plan.estimatedCostUsd.toFixed(4)}) &middot; Tools: {task.plan.tools.join(', ')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {task.plan.steps.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', background: '#0f172a', borderRadius: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: '#64748b', fontSize: '0.8rem', minWidth: '1.5rem' }}>{i + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>{s.description}</p>
                    <code style={{ color: '#3b82f6', fontSize: '0.8rem' }}>{s.tool}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.approvalGates.length > 0 && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Approval Gates</h3>
            {task.approvalGates.map((g) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#0f172a', borderRadius: 6, marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>{g.type}</p>
                  {g.notes && <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>{g.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ padding: '0.125rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', background: gateColors[g.status] ?? '#64748b', color: '#fff' }}>
                    {g.status}
                  </span>
                  {g.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button type="button" onClick={() => handleApproveGate(g.id, true)}
                        style={{ padding: '0.25rem 0.75rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                        Approve
                      </button>
                      <button type="button" onClick={() => handleApproveGate(g.id, false)}
                        style={{ padding: '0.25rem 0.75rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {task.result?.artifacts && task.result.artifacts.length > 0 && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Artifacts</h3>
            {task.result.artifacts.map((a) => (
              <div key={a.path}>
                <button type="button" onClick={() => setShowArtifact(showArtifact === a.path ? null : a.path)}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#0f172a', borderRadius: 6, marginBottom: '0.25rem', cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
                  <span style={{ fontSize: '0.875rem' }}>{a.path}</span>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{a.type}</span>
                </button>
                {showArtifact === a.path && (
                  <pre style={{ background: '#0f172a', padding: '0.75rem', borderRadius: 6, margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#94a3b8', overflow: 'auto', maxHeight: 300 }}>
                    {a.content}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {task.result?.summary && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Result</h3>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#e2e8f0' }}>{task.result.summary}</p>
            {task.result.durationMs && (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>Duration: {task.result.durationMs}ms</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
