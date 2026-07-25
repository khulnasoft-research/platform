'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { LoadingPage } from '@/lib/ui';

interface PreviewSession {
  id: string;
  projectId: string;
  taskId: string;
  framework: string;
  status: string;
  url: string;
  buildLogs: unknown[];
  files: unknown[];
  createdAt: string;
}

const statusColors: Record<string, string> = {
  building: '#f59e0b', running: '#3b82f6', ready: '#10b981',
  error: '#ef4444', stopped: '#64748b',
};

export default function PreviewsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<PreviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [framework, setFramework] = useState('nextjs');
  const [creating, setCreating] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.preview.list();
      setSessions(res.previews as PreviewSession[]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('session_token');
        router.replace('/login');
        return;
      }
      setError('Failed to load previews');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.replace('/login'); return; }
    loadSessions();
  }, [router, loadSessions]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !taskId) return;
    setCreating(true);
    try {
      await api.preview.create({ projectId, taskId, framework });
      setProjectId('');
      setTaskId('');
      setFramework('nextjs');
      await loadSessions();
    } catch {
      setError('Failed to create preview');
    } finally { setCreating(false); }
  }

  async function handleStop(id: string) {
    try {
      await api.preview.stop(id);
      await loadSessions();
    } catch { setError('Failed to stop preview'); }
  }

  if (loading) return <LoadingPage />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <a href="/dashboard" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Projects</a>
          <a href="/agents" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Agents</a>
          <a href="/blueprints" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Blueprints</a>
          <span style={{ color: '#3b82f6', fontSize: '0.875rem' }}>Previews</span>
          <a href="/deploy" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Deploy</a>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem' }}>Preview Sessions</h2>
        <p style={{ color: '#64748b', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
          Build and preview your application in real-time
        </p>

        {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleCreate} style={{ background: '#1e293b', borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Create Preview Session</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Project ID" required
              style={{ flex: 1, minWidth: 160, padding: '0.45rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }} />
            <input value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="Task ID" required
              style={{ flex: 1, minWidth: 160, padding: '0.45rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }} />
            <select value={framework} onChange={(e) => setFramework(e.target.value)}
              style={{ width: 130, padding: '0.45rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
              <option value="nextjs">Next.js</option>
              <option value="vite">Vite</option>
              <option value="astro">Astro</option>
              <option value="express">Express</option>
              <option value="static">Static</option>
            </select>
            <button type="submit" disabled={creating || !projectId || !taskId}
              style={{ padding: '0.45rem 1.25rem', background: creating ? '#64748b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer' }}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>

        {sessions.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '3rem 0' }}>No preview sessions yet. Create one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sessions.map((s) => (
              <button type="button" key={s.id} onClick={() => router.push(`/previews/${s.id}`)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1rem', background: '#1e293b', borderRadius: 8, cursor: 'pointer', width: '100%', border: 'none', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.framework}</span>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{s.projectId.slice(0, 8)}&hellip;</span>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: `${statusColors[s.status] ?? '#64748b'}22`, color: statusColors[s.status] ?? '#64748b' }}>
                      {s.status}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                    {s.url} &middot; {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {(s.status === 'building' || s.status === 'running') && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleStop(s.id); }}
                    style={{ padding: '0.35rem 0.75rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    Stop
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
