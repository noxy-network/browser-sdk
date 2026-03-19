import type { UUIDTypes } from 'uuid';
import type { Timestamp } from '@/modules/noxy-common.types';
import type { WalletAddress } from '@/modules/noxy-identity.types';
import type { NoxyDeviceId } from '@/modules/noxy-device.types';

export type NoxyNetworkOptions = {
  /** App identifier issued by Noxy */
  appId: string;

  /** Explicit relay nodes url */
  relayNodesUrl: `wss://${string}`;

  /** Max retry attempts */
  maxRetries?: number;

  /** Retry timeout (ms) */
  retryTimeoutMs?: number;

  /** Fire-and-forget or require acknowledgement */
  requireAck?: boolean;
};

export type NoxyNetworkMessage = {
  requestId: UUIDTypes,
  sessionId?: string,
  deviceId?: NoxyDeviceId,
  appId: string,
  timestamp: Timestamp,
  nonce: string, // base64 encoded 12 bytes
  payload:
    NoxyNetworkAuthenticatePayload |
    NoxyNetworkAnnounceDevicePayload |
    NoxyNetworkRevokeDevicePayload |
    NoxyNetworkRotateDeviceKeysPayload |
    NoxyNetworkSubscribeNotificationsPayload |
    NoxyNetworkAckPayload
};

export type NoxyNetworkAuthenticatePayload = {
  devicePubkeys: {
    publicKey: string; // base64 encoded
    pqPublicKey: string; // base64 encoded
  },
};

/** Response from the relay for authenticate (stream response). */
export type NoxyNetworkAuthenticateResponse = {
  requestId: UUIDTypes;
  messageId?: UUIDTypes;
  timestamp: Timestamp;
  status: string;
  authenticate: {
    requiresRegistration: boolean;
    deviceId?: NoxyDeviceId;
    sessionId?: string;
  }
};

export type NoxyNetworkAnnounceDevicePayload = {
  type?: 'browser'; // Optional for callers; SDK always sends 'browser' when announcing
  devicePubkeys: {
    publicKey: string; // base64 encoded
    pqPublicKey: string; // base64 encoded
  },
  walletAddress: WalletAddress,
  signature: string, // base64 encoded
};

/** Response from the relay for announce (stream response) */
export type NoxyNetworkAnnounceDeviceResponse = {
  requestId: UUIDTypes;
  messageId?: UUIDTypes;
  timestamp: Timestamp;
  status: string;
  registerDevice: {
    deviceId: string;
    registeredAt: Timestamp;
    sessionId: string;
  }
};

export type NoxyNetworkRevokeDevicePayload = {
  walletAddress: WalletAddress,
  signature: string, // base64 encoded
};

export type NoxyNetworkRotateDeviceKeysPayload = {
  newPubkeys: {
    publicKey: string; // base64 encoded
    pqPublicKey: string; // base64 encoded
  },
  walletAddress: WalletAddress,
  signature: string, // base64 encoded
};

export type NoxyNetworkSubscribeNotificationsPayload = {
  subscribe: boolean,
};

export type NoxyNetworkAckPayload = {
  messageId: UUIDTypes,
  receivedAt: Timestamp,
};

export type NoxyNetworkErrorResponse = {
  requestId: UUIDTypes;
  messageId?: UUIDTypes;
  timestamp: Timestamp;
  status: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  }
};

export function isNoxyNetworkErrorResponse(
  response: unknown
): response is NoxyNetworkErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as NoxyNetworkErrorResponse).error === 'object' &&
    (response as NoxyNetworkErrorResponse).error !== null &&
    'code' in (response as NoxyNetworkErrorResponse).error &&
    'message' in (response as NoxyNetworkErrorResponse).error
  );
}