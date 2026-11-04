import { GetActivity, StartDeviceFlow, SignOut } from '../../wailsjs/go/api/GitHubService';
import type { github } from '../../wailsjs/go/models';

export function startDeviceFlow(): Promise<void> {
  return StartDeviceFlow();
}

export function signOut(): Promise<void> {
  return SignOut();
}

/** The user's commits on every branch over the last `days` days (1 = today). */
export function getActivity(days: number): Promise<github.Activity> {
  return GetActivity(days);
}
