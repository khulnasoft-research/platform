'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface BlueprintNode {
  id: string;
  type: string;
  name: string;
  path: string | null;
}

interface BlueprintEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
}

interface BlueprintSnapshot {
  id: string;
  projectId: string;
  commitSha: string;
  branch: string;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  createdAt: string;
}

const nodeColors: Record<string, string> = {
  'api-route': '#3b82f6',
  component: '#10b981',
  page: '#8b5cf6',
  database: '#f59e0b',
  service: '#06b6d4',
  module: '#f97316',
  table: '#ef4444',
  function: '#ec4899',
  queue: '#14b8a6',
  bucket: '#f97316',
  domain: '#6366f1',
  'server-action': '#84cc16',
};

export default function BlueprintsPage() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<BlueprintSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [branch, setBranch] = useState('main');
  const [creating, setCreating] = useState(false);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await api.blueprints.list('00000000-0000-0000-0000-000000000001');
      setSnapshots(res.snapshots as BlueprintSnapshot[]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('session_token');
        router.replace('/login');
        return;
      }
      setError('Failed to load blueprints');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.replace('/login'); return; }
    loadSnapshots();
  }, [router, loadSnapshots]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!commitSha) return;
    setCreating(true);
    setError('');
    try {
      await api.blueprints.create({
        projectId: '00000000-0000-0000-0000-000000000001',
        commitSha,
        branch,
        nodes: [
          { id: 'node-1', type: 'api-route', name: 'api.ts', path: 'src/api.ts', metadata: {} },
          { id: 'node-2', type: 'component', name: 'App.tsx', path: 'src/App.tsx', metadata: {} },
        ],
        edges: [
          { id: 'edge-1', sourceId: 'node-2', targetId: 'node-1', type: 'calls' },
        ],
        metadata: {
          totalFiles: 10,
          totalSymbols: 42,
          languageBreakdown: { typescript: 10 },
          frameworkDetected: ['nextjs'],
          architecturePattern: 'frontend',
        },
      });
      setCommitSha('');
      loadSnapshots();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to create snapshot');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <a href="/dashboard" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Projects</a>
          <a href="/agents" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Agents</a>
          <a href="/previews" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Previews</a>
          <a href="/deploy" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Deploy</a>
          <span style={{ color: '#3b82f6', fontSize: '0.875rem' }}>Blueprints</span>
        </div>
        <button type="button" onClick={() => { localStorage.removeItem('session_token'); router.replace('/'); }}
          style={{ padding: '0.5rem 1rem', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer' }}>
          Sign Out
        </button>
      </header>

      <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem' }}>Blueprints</h2>

        {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleCreate} style={{ background: '#1e293b', padding: '1.25rem', borderRadius: 8, marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>New Snapshot</h3>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 2 }}>
              <label htmlFor="commit-sha" style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Commit SHA</label>
              <input id="commit-sha" value={commitSha} onChange={(e) => setCommitSha(e.target.value)} required placeholder="abc123def"
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="branch" style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Branch</label>
              <input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button type="submit" disabled={creating}
            style={{ padding: '0.5rem 1.25rem', background: creating ? '#64748b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer' }}>
            {creating ? 'Creating...' : 'Capture Snapshot'}
          </button>
        </form>

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : snapshots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #1e293b', borderRadius: 12 }}>
            <p style={{ color: '#64748b', marginBottom: '0.5rem' }}>No blueprints yet</p>
            <p style={{ color: '#475569', fontSize: '0.875rem' }}>Capture a snapshot to begin architecture analysis.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {snapshots.map((s) => {
              const nodeTypes = [...new Set(s.nodes.map((n) => n.type))];
              return (
                <button type="button" key={s.id} onClick={() => router.push(`/blueprints/${s.id}`)}
                  style={{ padding: '1rem 1.25rem', background: '#1e293b', borderRadius: 8, cursor: 'pointer', width: '100%', border: 'none', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.branch} @ {s.commitSha.slice(0, 7)}</span>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{new Date(s.createdAt).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{s.nodes.length} nodes</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>&middot;</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{s.edges.length} edges</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {nodeTypes.map((t) => (
                      <span key={t} style={{ padding: '0.125rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', background: `${nodeColors[t] ?? '#64748b'}22`, color: nodeColors[t] ?? '#64748b' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
