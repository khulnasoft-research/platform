import type { ReactNode } from 'react';
import type { CardVariant } from './card.js';

const variantMap: Record<CardVariant, Record<string, string>> = {
  default: {
    backgroundColor: 'var(--color-surface, #f9fafb)',
    border: '1px solid var(--color-border-light, #e5e7eb)',
    boxShadow: 'none',
  },
  elevated: {
    backgroundColor: 'var(--color-surface, #f9fafb)',
    border: '1px solid var(--color-border-light, #e5e7eb)',
    boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1))',
  },
  outlined: {
    backgroundColor: 'transparent',
    border: '2px solid var(--color-border, #d1d5db)',
    boxShadow: 'none',
  },
  interactive: {
    backgroundColor: 'var(--color-surface, #f9fafb)',
    border: '1px solid var(--color-border-light, #e5e7eb)',
    boxShadow: 'none',
    cursor: 'pointer',
  },
};

const paddingMap: Record<string, string> = {
  none: '0',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
};

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  onClick,
}: {
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  children?: ReactNode;
  onClick?: () => void;
}) {
  const base: Record<string, string> = {
    borderRadius: 'var(--radius-md, 0.375rem)',
    padding: paddingMap[padding] ?? '1rem',
    transition: 'all 150ms ease',
    ...variantMap[variant],
  };

  return <div style={base} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>{children}</div>;
}
