import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const defaultColors: ThemeColors = {
  primary: '#667eea',
  secondary: '#764ba2',
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const organization = useSelector((state: RootState) => state.organization.current);

  const getThemeColors = (): ThemeColors => {
    const baseColors = {
      primary: organization?.primaryColor || defaultColors.primary,
      secondary: organization?.secondaryColor || defaultColors.secondary,
    };

    if (isDark) {
      return {
        ...baseColors,
        background: '#1a1a1a',
        surface: '#2d2d2d',
        text: '#ffffff',
        textSecondary: '#cccccc',
      };
    }

    return {
      ...baseColors,
      background: '#f5f5f5',
      surface: '#ffffff',
      text: '#333333',
      textSecondary: '#666666',
    };
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    localStorage.setItem('isDarkMode', JSON.stringify(!isDark));
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('isDarkMode');
    if (savedTheme) {
      setIsDark(JSON.parse(savedTheme));
    }
  }, []);

  useEffect(() => {
    const colors = getThemeColors();
    // Apply CSS custom properties for theme colors
    document.documentElement.style.setProperty('--color-primary', colors.primary);
    document.documentElement.style.setProperty('--color-secondary', colors.secondary);
    document.documentElement.style.setProperty('--color-background', colors.background);
    document.documentElement.style.setProperty('--color-surface', colors.surface);
    document.documentElement.style.setProperty('--color-text', colors.text);
    document.documentElement.style.setProperty('--color-text-secondary', colors.textSecondary);
  }, [isDark, organization]);

  const value: ThemeContextType = {
    colors: getThemeColors(),
    isDark,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};