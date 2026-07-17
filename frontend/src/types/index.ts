export interface ServerConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  auth_method: string;
  password?: string;
  private_key_path?: string;
}

export interface Config {
  github_username: string;
  github_token: string;
  client_id: string;
  server_host: string;
  servers: ServerConfig[];
  docker_socket: string;
}

export interface AppData {
  updated_at: string;
  github: { username: string; contributions: number; commits: number; error?: string };
  docker: { running: number; stopped: number; total: number; version?: string; error?: string };
  server: { host: string; online: boolean; latency: number; error?: string };
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpu_usage: number;
  mem_usage: number;
  mem_percent: number;
  network_rx: number;
  network_tx: number;
  io_read: number;
  io_write: number;
  pid_count: number;
}

export interface LogLine {
  time: string;
  tag: string;
  msg: string;
  color: string;
}

export interface ServerMetrics {
  cpu_usage: number;
  mem_total: number;
  mem_used: number;
  disk_total: number;
  disk_used: number;
  uptime: number;
  load_avg: string;
  error?: string;
}

export interface PingResult {
  host: string;
  online: boolean;
  latency: number;
  error?: string;
}

export type TabId = 'overview' | 'github' | 'docker' | 'servers' | 'logs' | 'docs';
