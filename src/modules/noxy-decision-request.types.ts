import type { UUIDTypes } from 'uuid';
import type { Timestamp } from '@/modules/noxy-common.types';

export type NoxyMessageId = UUIDTypes;

export type NoxyEncryptedDecisionRequest = {
  kyber_ct: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
};

export const NoxyDecisionOutcomeValues = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const;

export type NoxyDecisionOutcomeValue =
  (typeof NoxyDecisionOutcomeValues)[keyof typeof NoxyDecisionOutcomeValues];

export type NoxyDecisionOutcome = {
  decisionId: UUIDTypes;
  outcome: NoxyDecisionOutcomeValue;
  receivedAt: Timestamp;
};
