'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface EnvSummary {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  envVars: string[];
}

interface DeploySummary {
  id: string;
  status: string;
  commitSha: string;
  provider: string;
  environmentId: string;
}

const statusColors: Record<string, string> = {
  building: '#f59e0b', deploying: '#3b82f6', live: '#10b981',
  failed: '#ef4444', rollback: '#f97316', cancelled: '#64748b',
};

export default function DeployPage() {
  const router = useRouter();
  const [environments, setEnvironments] = useState<EnvSummary[]>([]);
  const [deployments, setDeployments] = useState<DeploySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'environments' | 'deployments'>('environments');
  const [envName, setEnvName] = useState('');
  const [envProvider, setEnvProvider] = useState('vercel');
  const [envType, setEnvType] = useState('persistent');
  const [creating, setCreating] = useState(false);
  const [depSha, setDepSha] = useState('');
  const [depEnvId, setDepEnvId] = useState('');
  const [depProvider, setDepProvider] = useState('vercel');
  const [creatingDep, setCreatingDep] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [envRes, depRes] = await Promise.all([
        api.deploy.environments.list('00000000-0000-0000-0000-000000000001'),
        api.deploy.deployments.list('00000000-0000-0000-0000-000000000001'),
        api.deploy.stats(),
      ]);
      setEnvironments(envRes.environments as EnvSummary[]);
      setDeployments(depRes.deployments as DeploySummary[]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('session_token');
        router.replace('/login');
        return;
      }
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.replace('/login'); return; }
    loadAll();
  }, [router, loadAll]);

  async function handleCreateEnv(e: FormEvent) {
    e.preventDefault();
    if (!envName) return;
    setCreating(true);
    try {
      await api.deploy.environments.create({
        projectId: '00000000-0000-0000-0000-000000000001',
        name: envName, type: envType, provider: envProvider,
      });
      setEnvName(''); loadAll();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to create environment');
    } finally { setCreating(false); }
  }

  async function handleCreateDep(e: FormEvent) {
    e.preventDefault();
    if (!depSha || !depEnvId) return;
    setCreatingDep(true);
    try {
      await api.deploy.deployments.create({
        projectId: '00000000-0000-0000-0000-000000000001',
        environmentId: depEnvId, commitSha: depSha, provider: depProvider,
      });
      setDepSha(''); loadAll();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to create deployment');
    } finally { setCreatingDep(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <a href="/dashboard" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Projects</a>
          <a href="/agents" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Agents</a>
          <a href="/blueprints" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Blueprints</a>
          <a href="/previews" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Previews</a>
          <span style={{ color: '#3b82f6', fontSize: '0.875rem' }}>Deploy</span>
        </div>
        <button type="button" onClick={() => { localStorage.removeItem('session_token'); router.replace('/'); }}
          style={{ padding: '0.5rem 1rem', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer' }}>
          Sign Out
        </button>
      </header>

      <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem' }}>Deployments</h2>
        {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button type="button" onClick={() => setTab('environments')}
            style={{ padding: '0.5rem 1.25rem', background: tab === 'environments' ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
            Environments
          </button>
          <button type="button" onClick={() => setTab('deployments')}
            style={{ padding: '0.5rem 1.25rem', background: tab === 'deployments' ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
            Deployments
          </button>
        </div>

        {tab === 'environments' && (
          <>
            <form onSubmit={handleCreateEnv} style={{ background: '#1e293b', padding: '1.25rem', borderRadius: 8, marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>New Environment</h3>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ flex: 2 }}>
                  <label htmlFor="env-name" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Name</label>
                  <input id="env-name" value={envName} onChange={(e) => setEnvName(e.target.value)} required
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="env-type" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Type</label>
                  <select id="env-type" value={envType} onChange={(e) => setEnvType(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
                    <option value="persistent">Persistent</option>
                    <option value="ephemeral">Ephemeral</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="env-provider" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Provider</label>
                  <select id="env-provider" value={envProvider} onChange={(e) => setEnvProvider(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
                    <option value="vercel">Vercel</option>
                    <option value="railway">Railway</option>
                    <option value="fly-io">Fly.io</option>
                    <option value="cloudflare">Cloudflare</option>
                    <option value="docker">Docker</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={creating}
                style={{ padding: '0.4rem 1.25rem', background: creating ? '#64748b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating...' : 'Create Environment'}
              </button>
            </form>

            {loading ? <p style={{ color: '#64748b' }}>Loading...</p> : environments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #1e293b', borderRadius: 12 }}>
                <p style={{ color: '#64748b' }}>No environments yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {environments.map((e) => (
                  <button type="button" key={e.id} onClick={() => router.push(`/deploy/${e.id}`)}
                    style={{ padding: '1rem 1.25rem', background: '#1e293b', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', width: '100%', border: 'none', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
                    <div>
                      <p style={{ margin: '0 0 0.25rem', fontWeight: 600, fontSize: '0.95rem' }}>{e.name}</p>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>{e.provider} &middot; {e.type}</p>
                    </div>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', background: `${statusColors[e.status] ?? '#64748b'}22`, color: statusColors[e.status] ?? '#64748b', height: 'fit-content' }}>
                      {e.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'deployments' && (
          <>
            <form onSubmit={handleCreateDep} style={{ background: '#1e293b', padding: '1.25rem', borderRadius: 8, marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>New Deployment</h3>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ flex: 2 }}>
                  <label htmlFor="dep-sha" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Commit SHA</label>
                  <input id="dep-sha" value={depSha} onChange={(e) => setDepSha(e.target.value)} required
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="dep-env" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Environment</label>
                  <select id="dep-env" value={depEnvId} onChange={(e) => setDepEnvId(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
                    <option value="">Select...</option>
                    {environments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="dep-provider" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Provider</label>
                  <select id="dep-provider" value={depProvider} onChange={(e) => setDepProvider(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
                    <option value="vercel">Vercel</option>
                    <option value="railway">Railway</option>
                    <option value="fly-io">Fly.io</option>
                    <option value="cloudflare">Cloudflare</option>
                    <option value="docker">Docker</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={creatingDep}
                style={{ padding: '0.4rem 1.25rem', background: creatingDep ? '#64748b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: creatingDep ? 'not-allowed' : 'pointer' }}>
                {creatingDep ? 'Creating...' : 'Create Deployment'}
              </button>
            </form>

            {loading ? <p style={{ color: '#64748b' }}>Loading...</p> : deployments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #1e293b', borderRadius: 12 }}>
                <p style={{ color: '#64748b' }}>No deployments yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {deployments.map((d) => {
                  const env = environments.find((e) => e.id === d.environmentId);
                  return (
                    <button type="button" key={d.id} onClick={() => router.push(`/deploy/${d.id}`)}
                      style={{ padding: '1rem 1.25rem', background: '#1e293b', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', width: '100%', border: 'none', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
                      <div>
                        <p style={{ margin: '0 0 0.25rem', fontWeight: 600, fontSize: '0.95rem' }}>
                          {d.commitSha.slice(0, 7)} @ {env?.name ?? 'unknown'}
                        </p>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>{d.provider}</p>
                      </div>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', background: `${statusColors[d.status] ?? '#64748b'}22`, color: statusColors[d.status] ?? '#64748b', height: 'fit-content' }}>
                        {d.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
