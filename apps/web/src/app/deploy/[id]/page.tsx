'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface EnvDetail {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  envVars: string[];
}

interface DeployLogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

interface Artifact {
  id: string;
  type: string;
  url: string;
  size: number;
}

interface Deployment {
  id: string;
  commitSha: string;
  status: string;
  provider: string;
  environmentId: string;
}

const statusColors: Record<string, string> = {
  building: '#f59e0b', deploying: '#3b82f6', live: '#10b981',
  failed: '#ef4444', rollback: '#f97316', cancelled: '#64748b',
};

const logLevelColors: Record<string, string> = {
  info: '#94a3b8', warn: '#f59e0b', error: '#ef4444',
};

export default function DeployDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [env, setEnv] = useState<EnvDetail | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [logs, setLogs] = useState<DeployLogEntry[]>([]);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newEnvVar, setNewEnvVar] = useState('');
  const [activeDeployId, setActiveDeployId] = useState<string | null>(null);

  const isEnvPage = typeof params.id === 'string' && params.id.length === 36;

  const loadEnv = useCallback(async () => {
    const id = String(params.id);
    try {
      const envRes = await api.deploy.environments.get(id);
      setEnv(envRes as EnvDetail);
      const depRes = await api.deploy.deployments.list(undefined, id);
      setDeployments(depRes.deployments as Deployment[]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) setError('Environment not found');
      else setError('Failed to load environment');
    } finally { setLoading(false); }
  }, [params.id]);

  const loadDeployment = useCallback(async () => {
    try {
      await api.deploy.deployments.get(params.id as string);
      const id = String(params.id);
      setActiveDeployId(id);
      const logRes = await api.deploy.deployments.logs(id);
      setLogs(logRes.logs as DeployLogEntry[]);
      try {
        const art = await api.deploy.deployments.artifact(params.id as string);
        setArtifact(art as Artifact);
      } catch {}
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) setError('Deployment not found');
      else setError('Failed to load deployment');
    } finally { setLoading(false); }
  }, [params.id]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.replace('/login'); return; }
    if (isEnvPage) loadEnv(); else loadDeployment();
  }, [router, isEnvPage, loadEnv, loadDeployment]);

  async function handleRollback(id: string) {
    try {
      await api.deploy.deployments.rollback(id);
      loadDeployment();
    } catch { setError('Rollback failed'); }
  }

  async function handleAddEnvVar() {
    if (!newEnvVar || !env) return;
    try {
      const res = await api.deploy.environments.setEnvVars(env.id, [...env.envVars, newEnvVar]);
      setEnv(res as EnvDetail);
      setNewEnvVar('');
    } catch { setError('Failed to add env var'); }
  }

  async function handleRemoveEnvVar(key: string) {
    if (!env) return;
    try {
      const res = await api.deploy.environments.removeEnvVars(env.id, [key]);
      setEnv(res as EnvDetail);
    } catch { setError('Failed to remove env var'); }
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '2rem' }}>Loading...</div>;
  if (error && !env && !activeDeployId) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#ef4444', padding: '2rem' }}>{error}</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <a href="/deploy" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>&larr; Back to Deploy</a>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
        {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        {env && (
          <>
            <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>{env.name}</h2>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                    {env.provider} &middot; {env.type}
                  </p>
                </div>
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: 6, fontSize: '0.875rem', background: `${statusColors[env.status] ?? '#64748b'}22`, color: statusColors[env.status] ?? '#64748b', fontWeight: 600, height: 'fit-content' }}>
                  {env.status}
                </span>
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Environment Variables</h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input value={newEnvVar} onChange={(e) => setNewEnvVar(e.target.value)} placeholder="KEY=value"
                  style={{ flex: 1, padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }} />
                <button type="button" onClick={handleAddEnvVar} disabled={!newEnvVar}
                  style={{ padding: '0.4rem 1rem', background: newEnvVar ? '#3b82f6' : '#64748b', color: '#fff', border: 'none', borderRadius: 6, cursor: newEnvVar ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {env.envVars.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No environment variables</p>
                ) : env.envVars.map((v) => (
                  <div key={v} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.75rem', background: '#0f172a', borderRadius: 4 }}>
                    <code style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{v.replace(/=.+/, '=****')}</code>
                    <button type="button" onClick={() => handleRemoveEnvVar(v.split('=')[0] ?? '')}
                      style={{ padding: '0.25rem 0.5rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Deployments</h3>
              {deployments.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No deployments</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {deployments.map((d) => (
                    <button type="button" key={d.id} onClick={() => router.push(`/deploy/${d.id}`)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#0f172a', borderRadius: 6, cursor: 'pointer', width: '100%', border: 'none', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.commitSha?.slice(0, 7)}</span>
                        <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{d.provider}</span>
                      </div>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', background: `${statusColors[d.status] ?? '#64748b'}22`, color: statusColors[d.status] ?? '#64748b' }}>
                        {d.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeDeployId && (
          <>
            <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Actions</h3>
              <button type="button" onClick={() => handleRollback(activeDeployId)}
                style={{ padding: '0.5rem 1.25rem', background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                Rollback Deployment
              </button>
            </div>

            <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Logs</h3>
              {logs.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No logs</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 300, overflow: 'auto' }}>
                  {logs.map((l) => (
                    <div key={`${l.timestamp}-${l.level}`} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(l.timestamp).toLocaleTimeString()}</span>
                      <span style={{ color: logLevelColors[l.level] ?? '#94a3b8', minWidth: '3rem' }}>[{l.level}]</span>
                      <span style={{ color: '#e2e8f0' }}>{l.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {artifact && (
              <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Artifact</h3>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: '#94a3b8' }}>Type: {artifact.type}</span>
                  <span style={{ color: '#94a3b8' }}>Size: {(artifact.size / 1024).toFixed(1)} KB</span>
                </div>
                <a href={artifact.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.4rem 1rem', background: '#3b82f6', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: '0.85rem' }}>
                  Download Artifact
                </a>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
