'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

interface AnalysisResult {
  pattern: string;
  description: string;
  recommendations: string[];
}

interface DriftFinding {
  id: string;
  severity: string;
  rule: string;
  message: string;
  suggestedFix?: string;
}

interface ImpactResult {
  target: string;
  change: string;
  directImpact: string[];
  indirectImpact: string[];
  risk: string;
}

const nodeColors: Record<string, string> = {
  'api-route': '#3b82f6', component: '#10b981', page: '#8b5cf6',
  database: '#f59e0b', service: '#06b6d4', module: '#f97316',
  table: '#ef4444', function: '#ec4899', queue: '#14b8a6',
  bucket: '#f97316', domain: '#6366f1', 'server-action': '#84cc16',
};

const edgeColors: Record<string, string> = {
  calls: '#3b82f6', reads: '#f59e0b', writes: '#ef4444',
  contains: '#10b981', depends: '#f97316', uses: '#8b5cf6',
};

export default function BlueprintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [snapshot, setSnapshot] = useState<BlueprintSnapshot | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [drift, setDrift] = useState<DriftFinding[]>([]);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [driftBaseline, setDriftBaseline] = useState('');
  const [impactNode, setImpactNode] = useState('');
  const [impactChange, setImpactChange] = useState('modify');
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.replace('/login'); return; }
    loadSnapshot();
  }, [router]);

  async function loadSnapshot() {
    try {
      const res = await api.blueprints.get(params.id as string);
      setSnapshot(res as BlueprintSnapshot);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) setError('Snapshot not found');
      else setError('Failed to load snapshot');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await api.blueprints.analyze(params.id as string);
      setAnalysis(res as AnalysisResult);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDrift() {
    if (!driftBaseline) return;
    try {
      const res = await api.blueprints.drift(params.id as string, driftBaseline);
      setDrift(res.findings as DriftFinding[]);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Drift analysis failed');
    }
  }

  async function handleImpact() {
    if (!impactNode) return;
    try {
      const res = await api.blueprints.impact(params.id as string, impactNode, impactChange);
      setImpact(res as ImpactResult);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Impact analysis failed');
    }
  }

  const severityColors: Record<string, string> = {
    info: '#3b82f6', warning: '#f59e0b', error: '#ef4444',
  };

  const riskColors: Record<string, string> = {
    low: '#10b981', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
  };

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '2rem' }}>Loading...</div>;
  if (!snapshot) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#ef4444', padding: '2rem' }}>{error || 'Snapshot not found'}</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <a href="/blueprints" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>&larr; Back to Blueprints</a>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{snapshot.branch} @ {snapshot.commitSha.slice(0, 7)}</h2>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{new Date(snapshot.createdAt).toLocaleString()}</span>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
            {snapshot.nodes.length} nodes, {snapshot.edges.length} edges
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={handleAnalyze} disabled={analyzing}
              style={{ padding: '0.5rem 1rem', background: analyzing ? '#64748b' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: analyzing ? 'not-allowed' : 'pointer' }}>
              {analyzing ? 'Analyzing...' : 'Analyze Architecture'}
            </button>
            <button onClick={() => router.push(`/blueprints`)}
              style={{ padding: '0.5rem 1rem', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer' }}>
              Back
            </button>
          </div>
        </div>

        {analysis && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Architecture Analysis</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ padding: '0.25rem 0.75rem', borderRadius: 6, background: '#8b5cf622', color: '#8b5cf6', fontWeight: 600, fontSize: '0.875rem' }}>
                {analysis.pattern}
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>{analysis.description}</p>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Recommendations</h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              {analysis.recommendations.map((r, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{r}</li>)}
            </ul>
          </div>
        )}

        <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Node Graph</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {snapshot.nodes.map((n) => (
              <div key={n.id} onClick={() => setSelectedNode(selectedNode === n.id ? null : n.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: selectedNode === n.id ? '#0f172a' : 'transparent', borderRadius: 6, cursor: 'pointer' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: nodeColors[n.type] ?? '#64748b' }} />
                  <span style={{ fontSize: '0.875rem' }}>{n.name}</span>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{n.type}</span>
                </div>
                {n.path && <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{n.path}</span>}
              </div>
            ))}
          </div>
          {selectedNode && (
            <div style={{ marginTop: '0.75rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Connected Edges</h4>
              {snapshot.edges.filter((e) => e.sourceId === selectedNode || e.targetId === selectedNode).map((e) => {
                const isSource = e.sourceId === selectedNode;
                const other = snapshot.nodes.find((n) => n.id === (isSource ? e.targetId : e.sourceId));
                return (
                  <div key={e.id} style={{ padding: '0.25rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                    {isSource ? '→' : '←'} {e.type} {other?.name ?? 'unknown'}
                    <span style={{ color: edgeColors[e.type] ?? '#64748b', marginLeft: '0.25rem', fontSize: '0.75rem' }}>{e.type}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Drift Detection</h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Baseline Snapshot ID</label>
              <input value={driftBaseline} onChange={(e) => setDriftBaseline(e.target.value)} placeholder="snapshot-id"
                style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
              <button onClick={handleDrift} disabled={!driftBaseline}
                style={{ padding: '0.4rem 1rem', background: driftBaseline ? '#f59e0b' : '#64748b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: driftBaseline ? 'pointer' : 'not-allowed', fontSize: '0.85rem' }}>
                Detect Drift
              </button>
            </div>
            {drift.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {drift.map((f) => (
                  <div key={f.id} style={{ padding: '0.5rem', background: '#0f172a', borderRadius: 4, fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
                      <span style={{ padding: '0.125rem 0.375rem', borderRadius: 3, fontSize: '0.7rem', background: (severityColors[f.severity] ?? '#64748b') + '22', color: severityColors[f.severity] ?? '#64748b' }}>
                        {f.severity}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{f.rule}</span>
                    </div>
                    <p style={{ margin: 0, color: '#e2e8f0' }}>{f.message}</p>
                    {f.suggestedFix && <p style={{ margin: '0.25rem 0 0', color: '#10b981', fontSize: '0.75rem' }}>{f.suggestedFix}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Impact Analysis</h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Target Node ID</label>
              <input value={impactNode} onChange={(e) => setImpactNode(e.target.value)} placeholder="node-id"
                style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
              <select value={impactChange} onChange={(e) => setImpactChange(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                <option value="modify">Modify</option>
                <option value="delete">Delete</option>
                <option value="rename">Rename</option>
              </select>
              <button onClick={handleImpact} disabled={!impactNode}
                style={{ padding: '0.4rem 1rem', background: impactNode ? '#3b82f6' : '#64748b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: impactNode ? 'pointer' : 'not-allowed', fontSize: '0.85rem' }}>
                Analyze Impact
              </button>
            </div>
            {impact && (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.8rem', background: (riskColors[impact.risk] ?? '#64748b') + '22', color: riskColors[impact.risk] ?? '#64748b', fontWeight: 600 }}>
                    {impact.risk.toUpperCase()} RISK
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{impact.target} &middot; {impact.change}</span>
                </div>
                <p style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontSize: '0.8rem' }}>Direct impact: {impact.directImpact.join(', ') || 'none'}</p>
                {impact.indirectImpact.length > 0 && (
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>Indirect impact: {impact.indirectImpact.join(', ')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
