'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'gruvbox-dark' | 'gruvbox-light';
export type GruvboxAccent = 'orange' | 'aqua' | 'yellow' | 'green' | 'blue';

interface ThemeContextType {
  theme: Theme;
  accent: GruvboxAccent;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: GruvboxAccent) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'gruvbox-dark',
  accent: 'orange',
  setTheme: () => {},
  setAccent: () => {},
  toggleTheme: () => {},
});

const THEME_KEY = 'zenith_theme_v2';
const ACCENT_KEY = 'zenith_accent_v1';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'gruvbox-dark';
    try {
      const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem('zenith_theme_v1');
      if (savedTheme === 'gruvbox-light' || savedTheme === 'light') return 'gruvbox-light';
      if (savedTheme === 'gruvbox-dark' || savedTheme === 'dark' || savedTheme === 'oled') return 'gruvbox-dark';
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'gruvbox-dark' : 'gruvbox-light';
    } catch {
      return 'gruvbox-dark';
    }
  });

  const [accent, setAccentState] = useState<GruvboxAccent>(() => {
    if (typeof window === 'undefined') return 'orange';
    try {
      const savedAccent = (localStorage.getItem(ACCENT_KEY) as GruvboxAccent) || 'orange';
      if (['orange', 'aqua', 'yellow', 'green', 'blue'].includes(savedAccent)) return savedAccent;
      return 'orange';
    } catch {
      return 'orange';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
  }, [theme, accent]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch (e) {
      console.warn('Could not save theme to localStorage', e);
    }
  };

  const setAccent = (newAccent: GruvboxAccent) => {
    setAccentState(newAccent);
    document.documentElement.setAttribute('data-accent', newAccent);
    try {
      localStorage.setItem(ACCENT_KEY, newAccent);
    } catch (e) {
      console.warn('Could not save accent to localStorage', e);
    }
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'gruvbox-dark' ? 'gruvbox-light' : 'gruvbox-dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
