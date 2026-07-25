import type { InputSize } from './input.js';

const sizeMap: Record<InputSize, Record<string, string>> = {
  sm: { fontSize: '0.875rem', padding: '0.375rem 0.75rem', height: '2rem' },
  md: { fontSize: '0.875rem', padding: '0.5rem 0.75rem', height: '2.5rem' },
  lg: { fontSize: '1rem', padding: '0.75rem 1rem', height: '3rem' },
};

export function Input({
  size = 'md',
  label,
  placeholder,
  error,
  disabled = false,
  required = false,
  type = 'text',
  value,
  onChange,
  name,
}: {
  size?: InputSize;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'url';
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
}) {
  const wrapperStyle: Record<string, string> = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    width: '100%',
  };

  const labelStyle: Record<string, string> = {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--color-text-secondary, #4b5563)',
    fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  };

  const inputStyle: Record<string, string> = {
    width: '100%',
    borderRadius: 'var(--radius-md, 0.375rem)',
    border: error ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--color-border, #d1d5db)',
    backgroundColor: 'var(--color-background, #ffffff)',
    color: 'var(--color-text-primary, #111827)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    ...sizeMap[size],
    ...(disabled ? { opacity: '0.5', cursor: 'not-allowed' } : {}),
  };

  const errorStyle: Record<string, string> = {
    fontSize: '0.75rem',
    color: 'var(--color-danger, #ef4444)',
  };

  const requiredStyle: Record<string, string> = {
    color: 'var(--color-danger, #ef4444)',
    marginLeft: '0.125rem',
  };

  return (
    <div style={wrapperStyle}>
      {label && (
        <label style={labelStyle}>
          {label}
          {required && <span style={requiredStyle}>*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={value}
        name={name}
        onChange={(e) => onChange?.(e.target.value)}
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-primary, #3b82f6)';
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary, #3b82f6)33';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-danger, #ef4444)' : 'var(--color-border, #d1d5db)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
}
