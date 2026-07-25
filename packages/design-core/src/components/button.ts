export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  children: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const baseStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  fontWeight: 500,
  borderRadius: '0.375rem',
  border: '1px solid transparent',
  cursor: 'pointer',
  transition: 'all 150ms ease',
  lineHeight: 1,
} as const;

const sizeMap: Record<ButtonSize, Record<string, string>> = {
  sm: { fontSize: '0.875rem', padding: '0.375rem 0.75rem', height: '2rem' },
  md: { fontSize: '0.875rem', padding: '0.5rem 1rem', height: '2.5rem' },
  lg: { fontSize: '1rem', padding: '0.75rem 1.5rem', height: '3rem' },
};

export const ButtonStyles = {
  base: baseStyles,
  size: sizeMap,
};
