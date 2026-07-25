import type { Theme, ColorTokens, SpacingTokens, TypographyTokens, ShadowTokens, BorderRadiusTokens } from './types.js';

export interface ThemeConfig {
  primaryColor?: string;
  borderRadius?: 'sm' | 'md' | 'lg';
}

const spacing: SpacingTokens = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
};

const typography: TypographyTokens = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontMono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
  fontSizeXs: '0.75rem',
  fontSizeSm: '0.875rem',
  fontSizeBase: '1rem',
  fontSizeLg: '1.125rem',
  fontSizeXl: '1.25rem',
  fontSize2xl: '1.5rem',
  fontSize3xl: '2rem',
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,
  lineHeightTight: 1.25,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

const shadows: ShadowTokens = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
};

const borderRadius: BorderRadiusTokens = {
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
};

function lightColors(primary?: string): ColorTokens {
  const p = primary ?? '#3b82f6';
  return {
    primary: p,
    primaryHover: `${p}dd`,
    primaryText: '#ffffff',
    secondary: '#6b7280',
    secondaryHover: '#4b5563',
    secondaryText: '#ffffff',
    background: '#ffffff',
    surface: '#f9fafb',
    surfaceHover: '#f3f4f6',
    border: '#d1d5db',
    borderLight: '#e5e7eb',
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#3b82f6',
  };
}

function darkColors(primary?: string): ColorTokens {
  const p = primary ?? '#60a5fa';
  return {
    primary: p,
    primaryHover: `${p}dd`,
    primaryText: '#ffffff',
    secondary: '#9ca3af',
    secondaryHover: '#d1d5db',
    secondaryText: '#111827',
    background: '#111827',
    surface: '#1f2937',
    surfaceHover: '#374151',
    border: '#4b5563',
    borderLight: '#374151',
    textPrimary: '#f9fafb',
    textSecondary: '#d1d5db',
    textMuted: '#6b7280',
    danger: '#f87171',
    dangerHover: '#ef4444',
    warning: '#fbbf24',
    success: '#34d399',
    info: '#60a5fa',
  };
}

export const defaultTheme: Theme = {
  name: 'light',
  colors: lightColors(),
  spacing,
  typography,
  shadows,
  borderRadius,
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: darkColors(),
  spacing,
  typography,
  shadows,
  borderRadius,
};

export function createTheme(config: ThemeConfig & { dark?: boolean }): Theme {
  const isDark = config.dark ?? false;
  return {
    name: isDark ? 'dark' : 'custom',
    colors: isDark ? darkColors(config.primaryColor) : lightColors(config.primaryColor),
    spacing,
    typography,
    shadows,
    borderRadius: {
      ...borderRadius,
      md: config.borderRadius === 'sm' ? borderRadius.sm : config.borderRadius === 'lg' ? borderRadius.lg : borderRadius.md,
    },
  };
}
