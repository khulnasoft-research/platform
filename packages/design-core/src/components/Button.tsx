import type { ButtonProps, ButtonVariant, ButtonSize } from './button.js';

const sizeMap: Record<ButtonSize, Record<string, string>> = {
  sm: { fontSize: '0.875rem', padding: '0.375rem 0.75rem', height: '2rem' },
  md: { fontSize: '0.875rem', padding: '0.5rem 1rem', height: '2.5rem' },
  lg: { fontSize: '1rem', padding: '0.75rem 1.5rem', height: '3rem' },
};

const variantMap: Record<ButtonVariant, Record<string, string>> = {
  primary: {
    backgroundColor: 'var(--color-primary, #3b82f6)',
    color: 'var(--color-primary-text, #ffffff)',
    border: '1px solid var(--color-primary, #3b82f6)',
  },
  secondary: {
    backgroundColor: 'var(--color-secondary, #6b7280)',
    color: 'var(--color-secondary-text, #ffffff)',
    border: '1px solid var(--color-secondary, #6b7280)',
  },
  danger: {
    backgroundColor: 'var(--color-danger, #ef4444)',
    color: '#ffffff',
    border: '1px solid var(--color-danger, #ef4444)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary, #111827)',
    border: '1px solid transparent',
  },
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--color-primary, #3b82f6)',
    border: '1px solid var(--color-border, #d1d5db)',
  },
};

const disabledStyle: Record<string, string> = {
  opacity: '0.5',
  cursor: 'not-allowed',
};

const loadingStyle: Record<string, string> = {
  cursor: 'wait',
};

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    children,
    onClick,
    type = 'button',
  } = props;

  const base: Record<string, string> = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontWeight: '500',
    borderRadius: 'var(--radius-md, 0.375rem)',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : loading ? 'wait' : 'pointer',
    transition: 'all 150ms ease',
    lineHeight: '1',
    fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    ...(fullWidth ? { width: '100%' } : {}),
    ...variantMap[variant],
    ...sizeMap[size],
    ...(disabled ? disabledStyle : {}),
    ...(loading ? loadingStyle : {}),
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      style={base}
      onClick={onClick}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      style={{
        animation: 'spin 0.6s linear infinite',
        width: '1em',
        height: '1em',
      }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
