import type { UUIDTypes } from 'uuid';

export type NoxyMessageId = UUIDTypes;

export type NoxyEncryptedNotification = {
  kyber_ct: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
};

