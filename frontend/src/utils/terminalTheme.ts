import type { ITheme } from '@xterm/xterm';
import type { ResolvedTheme } from '../hooks/useTheme';

const darkTheme: ITheme = {
  background: '#000000',
  foreground: '#e5e5e5',
  cursor: '#0A84FF',
  cursorAccent: '#000000',
  selectionBackground: '#0A84FF55',
  black: '#000000',
  red: '#FF453A',
  green: '#30D158',
  yellow: '#FF9500',
  blue: '#0A84FF',
  magenta: '#BF5AF2',
  cyan: '#64D2FF',
  white: '#e5e5e5',
  brightBlack: '#808080',
  brightRed: '#FF6961',
  brightGreen: '#42E680',
  brightYellow: '#FFB340',
  brightBlue: '#3D9BFF',
  brightMagenta: '#D070FF',
  brightCyan: '#85DCFF',
  brightWhite: '#ffffff',
};

const lightTheme: ITheme = {
  background: '#1C1C1E',
  foreground: '#F5F5F7',
  cursor: '#007AFF',
  cursorAccent: '#1C1C1E',
  selectionBackground: '#007AFF55',
  black: '#1C1C1E',
  red: '#FF3B30',
  green: '#34C759',
  yellow: '#FF9500',
  blue: '#007AFF',
  magenta: '#AF52DE',
  cyan: '#32ADE6',
  white: '#F5F5F7',
  brightBlack: '#8E8E93',
  brightRed: '#FF6961',
  brightGreen: '#30D158',
  brightYellow: '#FFB340',
  brightBlue: '#0A84FF',
  brightMagenta: '#BF5AF2',
  brightCyan: '#64D2FF',
  brightWhite: '#ffffff',
};

export function getTerminalTheme(mode: ResolvedTheme): ITheme {
  return mode === 'light' ? lightTheme : darkTheme;
}

export function getTerminalAccentRgb(mode: ResolvedTheme): string {
  return mode === 'light' ? '0;122;255' : '10;132;255';
}

export function getTerminalErrorRgb(): string {
  return '255;69;58';
}
