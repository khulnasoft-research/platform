export type StackDirection = 'row' | 'column';

export interface ContainerProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: boolean;
  centered?: boolean;
}

export interface GridProps {
  columns?: number;
  gap?: 'sm' | 'md' | 'lg';
  responsive?: boolean;
}

export interface StackProps {
  direction?: StackDirection;
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
}

export const containerMaxWidths: Record<string, string> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
};

export const gridGapMap: Record<string, string> = {
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
};

export const stackGapMap: Record<string, string> = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
};
