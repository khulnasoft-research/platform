import type { ReactNode } from 'react';
import { Component, type ErrorInfo } from 'react';

const theme = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#334155',
  border: '#334155',
  text: '#e2e8f0',
  textMuted: '#64748b',
  primary: '#3b82f6',
  danger: '#ef4444',
};

export function Skeleton({ width = '100%', height = '1rem', style }: { width?: string | number; height?: string | number; style?: Record<string, string> }) {
  return (
    <div
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: '0.375rem',
        background: `linear-gradient(90deg, ${theme.surface} 25%, ${theme.surfaceHover} 50%, ${theme.surface} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function LoadingPage({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: theme.bg,
        padding: '2rem',
      }}
    >
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.primary, animation: 'loading-bounce 0.6s ease-in-out infinite' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.primary, animation: 'loading-bounce 0.6s ease-in-out infinite 0.15s' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.primary, animation: 'loading-bounce 0.6s ease-in-out infinite 0.3s' }} />
      </div>
      <p style={{ color: theme.textMuted, margin: 0, fontSize: '0.875rem' }}>{message}</p>
    </div>
  );
}

export function LoadingSection({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="1rem" width={`${Math.floor(Math.random() * 40) + 60}%`} />
      ))}
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            background: theme.bg,
            color: theme.text,
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem' }}>!</div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Something went wrong</h2>
          <p style={{ color: theme.textMuted, fontSize: '0.875rem', maxWidth: 400, margin: 0 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1.5rem',
              background: theme.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
