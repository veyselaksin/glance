import { EventsOn, BrowserOpenURL } from '../../wailsjs/runtime/runtime';

export { BrowserOpenURL };

export type OauthSuccessPayload = string;
export type OauthErrorPayload = string;
export type DeviceCodePayload = { user_code: string; verification_uri: string };
export type AgentLogPayload = { tag: string; msg: string };
export type SshOutputPayload = { session_id: string; data: string };
export type SshClosedPayload = { session_id: string; reason: string };
export type DataUpdatedPayload = import('../types').AppData;

export function onOauthSuccess(cb: (username: OauthSuccessPayload) => void) {
  return EventsOn('oauth_success', cb);
}

export function onOauthError(cb: (msg: OauthErrorPayload) => void) {
  return EventsOn('oauth_error', cb);
}

export function onDeviceCode(cb: (payload: DeviceCodePayload) => void) {
  return EventsOn('device_code', cb);
}

export function onAgentLog(cb: (payload: AgentLogPayload) => void) {
  return EventsOn('agent_log', cb);
}

export function onSshOutput(cb: (payload: SshOutputPayload) => void) {
  return EventsOn('ssh_output', cb);
}

export function onSshClosed(cb: (payload: SshClosedPayload) => void) {
  return EventsOn('ssh_closed', cb);
}

export function onDataUpdated(cb: (d: DataUpdatedPayload) => void) {
  return EventsOn('data_updated', cb);
}
