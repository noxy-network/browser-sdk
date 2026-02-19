import { NOXY_DEVICE_KEY_PAIR_TYPE, NOXY_DEVICE_PQ_KEY_PAIR_TYPE } from '@/modules/noxy-common.constants';
import type { Timestamp, Signature } from '@/modules/noxy-common.types';
import type { WalletAddress } from '@/modules/noxy-identity.types';
import type { UUIDTypes } from 'uuid';

export type NoxyDeviceId = UUIDTypes;

export type NoxyDeviceKeyType = typeof NOXY_DEVICE_KEY_PAIR_TYPE | typeof NOXY_DEVICE_PQ_KEY_PAIR_TYPE;

export interface NoxyDeviceDescriptor {
  identityId: WalletAddress;
  appId: string;
  isRevoked: boolean;
  issuedAt: Timestamp;
}

export interface NoxyDeviceIdentitySignature {
  identitySignature: Signature | null;
}

export interface NoxyDeviceKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyType: NoxyDeviceKeyType;
}

export interface NoxyDeviceKeyPairBundle {
  keyPair: NoxyDeviceKeyPair;
  pqKeyPair: NoxyDeviceKeyPair;
}

export interface NoxyDevicePublicKeys {
  publicKey: Uint8Array;
  pqPublicKey: Uint8Array;
}

export interface NoxyDevicePrivateKeys {
  privateKey: Uint8Array;
  pqPrivateKey: Uint8Array;
}

export type NoxyDevice = NoxyDeviceDescriptor & NoxyDevicePublicKeys & NoxyDeviceIdentitySignature;

/**
 * Device schema for the local storage.
 * appId_identityId is the keyPath; deviceId is stored as data (not in keyPath).
 */
export interface NoxyDeviceSchema extends NoxyDevice {
  pk: string; // appId_identityId
}

/**
 * Device private keys schema for the local storage.
 * keyPath is appId_identityId only.
 */
export interface NoxyDeviceKeysSchema {
  pk: string; // appId_identityId
  iv: Uint8Array;
  ciphertext: Uint8Array;
}