export type CardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';

export interface CardProps {
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  children?: string;
  onClick?: () => void;
}
