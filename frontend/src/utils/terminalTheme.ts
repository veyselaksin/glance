import type { ITheme } from '@xterm/xterm';
import type { ResolvedTheme } from '../hooks/useTheme';

// Matches the dark content surface (--surface-container-lowest).
const darkTheme: ITheme = {
  background: '#141416',
  foreground: '#E5E5EA',
  cursor: '#0A84FF',
  cursorAccent: '#141416',
  selectionBackground: '#0A84FF4D',
  black: '#1C1C1E',
  red: '#FF453A',
  green: '#30D158',
  yellow: '#FFD60A',
  blue: '#0A84FF',
  magenta: '#BF5AF2',
  cyan: '#64D2FF',
  white: '#E5E5EA',
  brightBlack: '#8E8E93',
  brightRed: '#FF6961',
  brightGreen: '#42E680',
  brightYellow: '#FFE45E',
  brightBlue: '#3D9BFF',
  brightMagenta: '#D070FF',
  brightCyan: '#85DCFF',
  brightWhite: '#FFFFFF',
};

// Light terminal (like Terminal.app "Basic"); ANSI colors darkened for contrast on white.
const lightTheme: ITheme = {
  background: '#FFFFFF',
  foreground: '#1D1D1F',
  cursor: '#007AFF',
  cursorAccent: '#FFFFFF',
  selectionBackground: '#007AFF33',
  black: '#1D1D1F',
  red: '#C4271C',
  green: '#1E7E34',
  yellow: '#9A6700',
  blue: '#0060DF',
  magenta: '#8E3BB8',
  cyan: '#0B7A99',
  white: '#8E8E93',
  brightBlack: '#6E6E73',
  brightRed: '#E0372B',
  brightGreen: '#28A745',
  brightYellow: '#B98100',
  brightBlue: '#007AFF',
  brightMagenta: '#AF52DE',
  brightCyan: '#1597BF',
  brightWhite: '#3A3A3C',
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
