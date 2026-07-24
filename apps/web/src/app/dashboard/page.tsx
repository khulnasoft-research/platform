'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    loadProjects();
  }, [router]);

  async function loadProjects() {
    try {
      const res = await api.projects.list(
        '00000000-0000-0000-0000-000000000001',
      );
      setProjects(res.projects as Project[]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('session_token');
        router.replace('/login');
        return;
      }
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('session_token');
    router.replace('/');
  }

  async function handleCreateProject() {
    const name = prompt('Project name:');
    if (!name) return;
    try {
      await api.projects.create({
        name,
        organizationId: '00000000-0000-0000-0000-000000000001',
      });
      loadProjects();
    } catch {
      setError('Failed to create project');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#e2e8f0',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>AI Engineering Platform</h1>
          <span style={{ color: '#3b82f6', fontSize: '0.875rem' }}>Projects</span>
          <a href="/agents" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Agents</a>
          <a href="/blueprints" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Blueprints</a>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </header>

      <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Projects</h2>
          <button
            onClick={handleCreateProject}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            New Project
          </button>
        </div>

        {error && (
          <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
        )}

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : projects.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              border: '2px dashed #1e293b',
              borderRadius: 12,
            }}
          >
            <p style={{ color: '#64748b', marginBottom: '0.5rem' }}>
              No projects yet
            </p>
            <p style={{ color: '#475569', fontSize: '0.875rem' }}>
              Create your first project to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '1rem 1.25rem',
                  background: '#1e293b',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>
                    {p.name}
                  </h3>
                  {p.description && (
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                      {p.description}
                    </p>
                  )}
                </div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
