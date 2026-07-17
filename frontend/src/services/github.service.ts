import { StartDeviceFlow, SignOut } from '../../wailsjs/go/main/App';

export function startDeviceFlow(): Promise<void> {
  return StartDeviceFlow();
}

export function signOut(): Promise<void> {
  return SignOut();
}
