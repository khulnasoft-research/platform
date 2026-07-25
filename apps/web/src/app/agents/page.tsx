'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface Task {
  id: string;
  goal: string;
  assignee: string;
  status: string;
  priority: string;
  createdAt: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [goal, setGoal] = useState('');
  const [assignee, setAssignee] = useState('planner');
  const [priority, setPriority] = useState('medium');
  const [creating, setCreating] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.tasks.list();
      setTasks(res.tasks as Task[]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('session_token');
        router.replace('/login');
        return;
      }
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.replace('/login'); return; }
    loadTasks();
  }, [router, loadTasks]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!goal) return;
    setCreating(true);
    setError('');
    try {
      await api.tasks.create({
        projectId: '00000000-0000-0000-0000-000000000001',
        goal,
        assignee,
        priority,
      });
      setGoal('');
      loadTasks();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  const statusColors: Record<string, string> = {
    queued: '#f59e0b',
    planning: '#3b82f6',
    executing: '#8b5cf6',
    waiting: '#f97316',
    reviewing: '#06b6d4',
    completed: '#10b981',
    failed: '#ef4444',
    cancelled: '#64748b',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <a href="/dashboard" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Projects</a>
          <span style={{ color: '#3b82f6', fontSize: '0.875rem' }}>Agents</span>
        </div>
        <button type="button" onClick={() => { localStorage.removeItem('session_token'); router.replace('/'); }}
          style={{ padding: '0.5rem 1rem', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer' }}>
          Sign Out
        </button>
      </header>

      <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem' }}>Agent Tasks</h2>

        {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleCreate} style={{ background: '#1e293b', padding: '1.25rem', borderRadius: 8, marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>New Task</h3>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="goal" style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Goal</label>
            <input id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} required
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="assignee" style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Agent</label>
              <select id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
                <option value="architect">Architect</option>
                <option value="planner">Planner</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="database">Database</option>
                <option value="tester">Tester</option>
                <option value="reviewer">Reviewer</option>
                <option value="security">Security</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="priority" style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Priority</label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={creating}
            style={{ padding: '0.5rem 1.25rem', background: creating ? '#64748b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer' }}>
            {creating ? 'Creating...' : 'Create Task'}
          </button>
        </form>

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #1e293b', borderRadius: 12 }}>
            <p style={{ color: '#64748b', marginBottom: '0.5rem' }}>No tasks yet</p>
            <p style={{ color: '#475569', fontSize: '0.875rem' }}>Create a task to get started with agents.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tasks.map((t) => (
              <button type="button" key={t.id} onClick={() => router.push(`/agents/${t.id}`)}
                style={{ padding: '1rem 1.25rem', background: '#1e293b', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', border: 'none', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.goal}</span>
                    <span style={{ padding: '0.125rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', background: statusColors[t.status] ?? '#64748b', color: '#fff' }}>
                      {t.status}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>
                    {t.assignee} &middot; {t.priority} priority &middot; {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>
                <span style={{ color: '#64748b', fontSize: '1.25rem' }}>&rarr;</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
