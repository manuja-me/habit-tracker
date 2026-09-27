'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'gruvbox-dark' | 'gruvbox-light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'gruvbox-dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

const THEME_KEY = 'zenith_theme_v2';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('gruvbox-dark');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem('zenith_theme_v1');
      if (savedTheme === 'gruvbox-light' || savedTheme === 'light') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThemeState('gruvbox-light');
        document.documentElement.setAttribute('data-theme', 'gruvbox-light');
      } else if (savedTheme === 'gruvbox-dark' || savedTheme === 'dark' || savedTheme === 'oled') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThemeState('gruvbox-dark');
        document.documentElement.setAttribute('data-theme', 'gruvbox-dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initial: Theme = prefersDark ? 'gruvbox-dark' : 'gruvbox-light';
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThemeState(initial);
        document.documentElement.setAttribute('data-theme', initial);
      }
    } catch (e) {
      console.warn('Could not load theme from localStorage', e);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch (e) {
      console.warn('Could not save theme to localStorage', e);
    }
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'gruvbox-dark' ? 'gruvbox-light' : 'gruvbox-dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
