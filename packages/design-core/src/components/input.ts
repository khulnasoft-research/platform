export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps {
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
}

export const inputSizeMap: Record<InputSize, Record<string, string>> = {
  sm: { fontSize: '0.875rem', padding: '0.375rem 0.75rem', height: '2rem' },
  md: { fontSize: '0.875rem', padding: '0.5rem 0.75rem', height: '2.5rem' },
  lg: { fontSize: '1rem', padding: '0.75rem 1rem', height: '3rem' },
};
