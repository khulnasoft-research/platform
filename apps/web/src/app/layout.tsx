import type { ReactNode } from 'react';
import { ErrorBoundary } from '../lib/ui.js';

export const metadata = {
  title: 'AI Engineering Platform',
  description: 'AI-driven application development platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @keyframes skeleton-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes loading-bounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
          * { box-sizing: border-box; }
        `}</style>
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
