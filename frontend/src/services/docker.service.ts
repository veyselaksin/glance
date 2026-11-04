import { GetContainers, StopContainer, StartContainer, RestartContainer, DeleteContainer, StreamContainerLogs, DockerRuntime, StartDaemon } from '../../wailsjs/go/api/DockerService';
import type { ContainerInfo } from '../types';

export function getContainers(): Promise<ContainerInfo[]> {
  return GetContainers() as Promise<ContainerInfo[]>;
}

export function stopContainer(id: string): Promise<void> {
  return StopContainer(id);
}

export function startContainer(id: string): Promise<void> {
  return StartContainer(id);
}

export function restartContainer(id: string): Promise<void> {
  return RestartContainer(id);
}

export function deleteContainer(id: string): Promise<void> {
  return DeleteContainer(id);
}

export function streamContainerLogs(id: string, lines: number): Promise<string> {
  return StreamContainerLogs(id, lines);
}

/** Name of the installed runtime ("Docker Desktop", "OrbStack", "Colima"), or "" if none. */
export function getDockerRuntime(): Promise<string> {
  return DockerRuntime();
}

/** Launches the runtime and resolves once the daemon responds (up to ~2 min). */
export function startDockerDaemon(): Promise<string> {
  return StartDaemon();
}
