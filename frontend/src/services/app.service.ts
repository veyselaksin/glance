import { AppVersion, GetLastData } from '../../wailsjs/go/main/App';
import type { AppData } from '../types';

export function getAppVersion(): Promise<string> {
  return AppVersion();
}

export function getLastData(): Promise<AppData | null> {
  return GetLastData() as Promise<AppData | null>;
}
