import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type ThemeName = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeName;
  accentColor: string;
  setAccentColor: (color: string) => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'chatclient.theme';
const ACCENT_STORAGE_KEY = 'chatclient.accent';

const themePalettes: Record<ThemeName, Record<string, string>> = {
  light: {
    '--bg': '#f4f6fb',
    '--surface': '#ffffff',
    '--surface-alt': '#f8fafc',
    '--sidebar': '#ffffff',
    '--sidebar-accent': '#f1f5f9',
    '--border': 'rgba(148, 163, 184, 0.25)',
    '--border-strong': 'rgba(148, 163, 184, 0.35)',
    '--text-primary': '#0f172a',
    '--text-secondary': '#475569',
    '--text-inverse': '#f8fafc',
    '--shadow': '0 24px 48px rgba(15, 23, 42, 0.12)',
    '--scrollbar': 'rgba(148, 163, 184, 0.45)',
    '--scrollbar-hover': 'rgba(100, 116, 139, 0.7)',
  },
  dark: {
    '--bg': '#0d1423',
    '--surface': '#131a2b',
    '--surface-alt': '#171f33',
    '--sidebar': '#0a101d',
    '--sidebar-accent': '#131a2b',
    '--border': 'rgba(148, 163, 184, 0.18)',
    '--border-strong': 'rgba(148, 163, 184, 0.32)',
    '--text-primary': '#e2e8f0',
    '--text-secondary': '#94a3b8',
    '--text-inverse': '#0f172a',
    '--shadow': '0 32px 64px rgba(2, 6, 23, 0.55)',
    '--scrollbar': 'rgba(148, 163, 184, 0.35)',
    '--scrollbar-hover': 'rgba(148, 163, 184, 0.6)',
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => char + char)
        .join('')
    : normalized.padEnd(6, '0');
  const int = parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const toHex = (component: number) => clamp(Math.round(component), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mix(color: string, target: string, amount: number) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  return rgbToHex({
    r: sourceRgb.r + (targetRgb.r - sourceRgb.r) * amount,
    g: sourceRgb.g + (targetRgb.g - sourceRgb.g) * amount,
    b: sourceRgb.b + (targetRgb.b - sourceRgb.b) * amount,
  });
}

function getAccentPalette(accent: string) {
  return {
    '--accent': accent,
    '--accent-soft': mix(accent, '#ffffff', 0.78),
    '--accent-strong': mix(accent, '#000000', 0.2),
    '--accent-ring': mix(accent, '#000000', 0.35),
    '--accent-glow': `${hexToRgba(accent, 0.25)}`,
    '--accent-contrast': getContrastColor(accent),
  };
}

function hexToRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function getContrastColor(color: string) {
  const { r, g, b } = hexToRgb(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#f8fafc';
}

function applyTheme(theme: ThemeName, accent: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  const palette = { ...themePalettes[theme], ...getAccentPalette(accent) };
  Object.entries(palette).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });
  root.style.setProperty('color-scheme', theme);
}

function normalizeTheme(value: string | null): ThemeName {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function normalizeAccent(value: string | null): string {
  if (!value) return '#6366f1';
  const hexMatch = value.match(/^#?[0-9a-fA-F]{3,6}$/);
  if (!hexMatch) return '#6366f1';
  return value.startsWith('#') ? value : `#${value}`;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return normalizeTheme(stored);
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    if (typeof window === 'undefined') return '#6366f1';
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return normalizeAccent(stored);
  });

  useEffect(() => {
    applyTheme(theme, accentColor);
  }, [theme, accentColor]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
  }, [accentColor]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      accentColor,
      setAccentColor: (color: string) => setAccentColorState(normalizeAccent(color)),
      toggleTheme: () => setThemeState((prev: ThemeName) => (prev === 'light' ? 'dark' : 'light')),
      setTheme: (next: ThemeName) => setThemeState(next),
    }),
    [theme, accentColor]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

