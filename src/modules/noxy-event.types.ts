export enum NoxyDeviceEventEnum {
  Registered = 'device_registered',
  Revoked = 'device_revoked',
  KeysRotated = 'device_keys_rotated',
}
export type NoxyDeviceEventType = `${NoxyDeviceEventEnum}`;

export enum NoxyPushNotificationEventEnum {
  MessageReceived = 'push_received',
}
export type NoxyPushNotificationEventType = `${NoxyPushNotificationEventEnum}`;

export type NoxyEventType =
  | NoxyDeviceEventType
  | NoxyPushNotificationEventType;

/** Event handler: sync or async function. */
export type NoxyEventHandler = (...args: unknown[]) => void | Promise<void>;