import { GetConfig, SaveConfig } from '../../wailsjs/go/main/App';
import type { Config } from '../types';

export function getConfig(): Promise<Config> {
  return GetConfig() as Promise<Config>;
}

export function saveConfig(cfg: Config): Promise<void> {
  return SaveConfig(cfg as any);
}
