import { createContext, useContext } from 'react';
import type { ThemeMode } from '../types';
import type { ResolvedTheme } from './useTheme';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setPreference: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolved: 'dark',
  setPreference: () => {},
});

export function useThemeContext() {
  return useContext(ThemeContext);
}
