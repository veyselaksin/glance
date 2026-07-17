import {
  GetServers, SaveServer, DeleteServer, SaveSSHKey,
  ConnectSSH, SSHWrite, SSHResize, DisconnectSSH,
  GetServerMetrics, GetServerPing,
} from '../../wailsjs/go/main/App';
import type { ServerConfig, ServerMetrics, PingResult } from '../types';

export function getServers(): Promise<ServerConfig[]> {
  return GetServers() as Promise<ServerConfig[]>;
}

export function saveServer(cfg: ServerConfig): Promise<string> {
  return SaveServer(cfg as any);
}

export function deleteServer(id: string): Promise<void> {
  return DeleteServer(id);
}

export function saveSSHKey(id: string, content: string): Promise<string> {
  return SaveSSHKey(id, content);
}

export function connectSSH(serverId: string): Promise<string> {
  return ConnectSSH(serverId);
}

export function sshWrite(sessionId: string, data: string): Promise<void> {
  return SSHWrite(sessionId, data);
}

export function sshResize(sessionId: string, cols: number, rows: number): Promise<void> {
  return SSHResize(sessionId, cols, rows);
}

export function disconnectSSH(sessionId: string): Promise<void> {
  return DisconnectSSH(sessionId);
}

export function getServerMetrics(id: string): Promise<ServerMetrics> {
  return GetServerMetrics(id) as Promise<ServerMetrics>;
}

export function getServerPing(host: string): Promise<PingResult> {
  return GetServerPing(host) as Promise<PingResult>;
}
