import { GetContainers, StopContainer, StartContainer, RestartContainer, DeleteContainer, StreamContainerLogs } from '../../wailsjs/go/main/App';
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
