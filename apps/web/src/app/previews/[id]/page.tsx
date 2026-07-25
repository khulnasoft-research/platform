'use client';

import { useCallback, useEffect, useState, useRef, type FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface PreviewFile {
  path: string;
  content: string;
  type: string;
  size: number;
  updatedAt: string;
}

interface BuildLog {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

interface PreviewMetrics {
  cpuUsage: number;
  memoryUsageMb: number;
  requestCount: number;
  averageResponseTimeMs: number;
  uptimeSeconds: number;
}

interface PreviewSession {
  id: string;
  status: string;
  framework: string;
  url: string;
  createdAt: string;
  buildLogs: BuildLog[];
  files: PreviewFile[];
}

const statusColors: Record<string, string> = {
  building: '#f59e0b', running: '#3b82f6', ready: '#10b981',
  error: '#ef4444', stopped: '#64748b',
};

const logLevelColors: Record<string, string> = {
  info: '#94a3b8', warn: '#f59e0b', error: '#ef4444',
};

export default function PreviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [metrics, setMetrics] = useState<PreviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [newFileType, setNewFileType] = useState('source');
  const [activeTab, setActiveTab] = useState<'logs' | 'files' | 'metrics'>('logs');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const startMetricsPoll = useCallback((pollId: string) => {
    metricsIntervalRef.current = setInterval(async () => {
      try {
        const m = await api.preview.metrics(pollId);
        setMetrics(m);
      } catch {}
    }, 3000);
  }, []);

  const startSSE = useCallback((sseId: string) => {
    const token = localStorage.getItem('session_token');
    const evtSource = new EventSource(`/api/previews/${sseId}/logs/stream?token=${token}`);
    evtSource.addEventListener('log', (e) => {
      try { setLogs((prev) => [...prev, JSON.parse(e.data)]); } catch {}
    });
    evtSource.addEventListener('status', (e) => {
      try {
        const { status } = JSON.parse(e.data);
        setSession((prev) => prev ? { ...prev, status } : prev);
        if (status === 'ready' || status === 'error' || status === 'stopped') {
          evtSource.close();
          clearInterval(metricsIntervalRef.current);
        }
      } catch {}
    });
    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, []);

  const loadSession = useCallback(async () => {
    const id = String(params.id);
    try {
      const res = await api.preview.get(id);
      setSession(res);
      setLogs(res.buildLogs as BuildLog[]);
      setFiles(res.files as PreviewFile[]);
      try {
        const m = await api.preview.metrics(id);
        setMetrics(m);
      } catch {}
      if (res.status === 'building' || res.status === 'running') {
        startSSE(id);
        startMetricsPoll(id);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) setError('Preview session not found');
      else setError('Failed to load preview');
    } finally { setLoading(false); }
  }, [params.id, startSSE, startMetricsPoll]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.replace('/login'); return; }
    if (params.id) loadSession();
  }, [router, loadSession, params.id]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  async function handleStop() {
    if (!session) return;
    try {
      const res = await api.preview.stop(session.id);
      setSession((prev) => prev ? { ...prev, status: res.status } : prev);
      clearInterval(metricsIntervalRef.current);
    } catch { setError('Failed to stop preview'); }
  }

  async function handleAddFile(e: FormEvent) {
    e.preventDefault();
    if (!newFilePath || !session) return;
    try {
      const now = new Date().toISOString();
      const res = await api.preview.updateFiles(session.id, [
        ...files.map((f) => ({ ...f, updatedAt: f.updatedAt })),
        { path: newFilePath, content: newFileContent, type: newFileType, size: newFileContent.length, updatedAt: now },
      ]);
      setFiles(res.files as PreviewFile[]);
      setNewFilePath('');
      setNewFileContent('');
      setNewFileType('source');
    } catch { setError('Failed to add file'); }
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '2rem' }}>Loading...</div>;
  if (error && !session) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#ef4444', padding: '2rem' }}>{error}</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <a href="/previews" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>&larr; Back to Previews</a>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>{session.framework} Preview</h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                {session.url} &middot; {new Date(session.createdAt).toLocaleString()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ padding: '0.25rem 0.75rem', borderRadius: 6, fontSize: '0.875rem', background: `${statusColors[session.status] ?? '#64748b'}22`, color: statusColors[session.status] ?? '#64748b', fontWeight: 600 }}>
                {session.status}
              </span>
              {(session.status === 'building' || session.status === 'running') && (
                <button type="button" onClick={handleStop}
                  style={{ padding: '0.35rem 0.75rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                  Stop
                </button>
              )}
            </div>
          </div>
          {session.status === 'ready' && (
            <a href={session.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', padding: '0.4rem 1rem', background: '#10b981', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Open Preview
            </a>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['logs', 'files', 'metrics'] as const).map((tab) => (
            <button type="button" key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: '0.45rem 1.25rem', background: activeTab === tab ? '#3b82f6' : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'logs' && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem' }}>
            {session.status === 'building' && (
              <p style={{ color: '#f59e0b', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Building... logs will appear in real-time.</p>
            )}
            {logs.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No logs yet.</p>
            ) : (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {logs.map((l) => (
                  <div key={`${l.timestamp}-${l.level}`} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', fontFamily: 'monospace', padding: '0.1rem 0' }}>
                    <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(l.timestamp).toLocaleTimeString()}</span>
                    <span style={{ color: logLevelColors[l.level] ?? '#94a3b8', minWidth: '3rem' }}>[{l.level}]</span>
                    <span style={{ color: l.source === 'build' ? '#93c5fd' : '#e2e8f0' }}>{l.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem' }}>
            <form onSubmit={handleAddFile} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input value={newFilePath} onChange={(e) => setNewFilePath(e.target.value)} placeholder="src/pages/index.tsx" required
                style={{ flex: 1, minWidth: 140, padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem' }} />
              <select value={newFileType} onChange={(e) => setNewFileType(e.target.value)}
                style={{ width: 100, padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem' }}>
                <option value="source">Source</option>
                <option value="config">Config</option>
                <option value="asset">Asset</option>
              </select>
              <button type="submit" disabled={!newFilePath}
                style={{ padding: '0.4rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                Add File
              </button>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {files.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No files</p>
              ) : files.map((f) => (
                <div key={f.path} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#0f172a', borderRadius: 4 }}>
                  <div>
                    <code style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{f.path}</code>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{f.type} &middot; {(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem' }}>
            {!metrics ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No metrics available. Start a preview to see metrics.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  { label: 'CPU Usage', value: `${(metrics.cpuUsage * 100).toFixed(1)}%` },
                  { label: 'Memory', value: `${metrics.memoryUsageMb.toFixed(0)} MB` },
                  { label: 'Request Count', value: metrics.requestCount.toLocaleString() },
                  { label: 'Avg Response Time', value: `${metrics.averageResponseTimeMs.toFixed(0)} ms` },
                  { label: 'Uptime', value: `${Math.floor(metrics.uptimeSeconds / 60)}m ${metrics.uptimeSeconds % 60}s` },
                ].map((m) => (
                  <div key={m.label} style={{ background: '#0f172a', borderRadius: 6, padding: '1rem', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 0.25rem', color: '#64748b', fontSize: '0.8rem' }}>{m.label}</p>
                    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{m.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
