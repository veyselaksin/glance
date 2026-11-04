import { StartDeviceFlow, SignOut } from '../../wailsjs/go/api/GitHubService';

export function startDeviceFlow(): Promise<void> {
  return StartDeviceFlow();
}

export function signOut(): Promise<void> {
  return SignOut();
}
