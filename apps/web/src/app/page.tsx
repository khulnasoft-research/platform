'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Home() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (token) {
      router.replace('/dashboard');
    } else {
      setLoaded(true);
    }
  }, [router]);

  if (!loaded) return null;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#e2e8f0',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem' }}>
          AI Engineering Platform
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          AI-driven application development platform
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a
            href="/login"
            style={{
              padding: '0.75rem 2rem',
              background: '#3b82f6',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Sign In
          </a>
          <a
            href="/register"
            style={{
              padding: '0.75rem 2rem',
              background: '#1e293b',
              color: '#e2e8f0',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Register
          </a>
        </div>
      </div>
    </main>
  );
}
